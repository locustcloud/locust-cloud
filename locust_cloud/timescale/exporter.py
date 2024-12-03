import atexit
import json
import logging
import os
import socket
import sys
from datetime import UTC, datetime, timedelta

import gevent
import greenlet
import locust.env
import psycopg
import psycopg.types.json
from locust.exception import CatchResponseError
from locust.runners import MasterRunner


def safe_serialize(obj):
    def default(o):
        return f"<<non-serializable: {type(o).__qualname__}>>"

    return json.dumps(obj, default=default)


def format_datetime(d: datetime):
    return d.strftime("%Y-%m-%d, %H:%M:%S.%f")


def parse_datetime(s: str):
    return datetime.strptime(s, "%Y-%m-%d, %H:%M:%S.%f").replace(tzinfo=UTC)


class Exporter:
    def __init__(self, environment: locust.env.Environment, pool):
        self.env = environment
        self._run_id = None
        self._samples: list[tuple] = []
        self._background = gevent.spawn(self._run)
        self._hostname = socket.gethostname()
        self._finished = False
        self._has_logged_test_stop = False
        self._pid = os.getpid()
        self.pool = pool

        events = self.env.events
        events.test_start.add_listener(self.on_test_start)
        events.test_stop.add_listener(self.on_test_stop)
        events.request.add_listener(self.on_request)
        events.cpu_warning.add_listener(self.on_cpu_warning)
        events.quit.add_listener(self.on_quit)
        events.spawning_complete.add_listener(self.spawning_complete)
        atexit.register(self.log_stop_test_run)

    def on_cpu_warning(self, environment: locust.env.Environment, cpu_usage, message=None, timestamp=None, **kwargs):
        # passing a custom message & timestamp to the event is a haxx to allow using this event for reporting generic events
        if not timestamp:
            timestamp = datetime.now(UTC).isoformat()
        if not message:
            message = f"High CPU usage ({cpu_usage}%)"
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO events (time, text, run_id, customer) VALUES (%s, %s, %s, current_user)",
                (timestamp, message, self._run_id),
            )

    def on_test_start(self, environment: locust.env.Environment):
        if not self.env.parsed_options or not self.env.parsed_options.worker:
            self._has_logged_test_stop = False
            self._run_id = environment._run_id = datetime.now(UTC)  # type: ignore
            self.env.parsed_options.run_id = format_datetime(environment._run_id)  # type: ignore
            self.log_start_testrun()
            self._user_count_logger = gevent.spawn(self._log_user_count)
            self._update_end_time_task = gevent.spawn(self._update_end_time)
        if self.env.parsed_options.worker:
            self._run_id = parse_datetime(self.env.parsed_options.run_id)

    def _log_user_count(self):
        while True:
            if self.env.runner is None:
                return  # there is no runner, so nothing to log...
            try:
                with self.pool.connection() as conn:
                    conn.execute(
                        """INSERT INTO number_of_users(time, run_id, user_count, customer) VALUES (%s, %s, %s, current_user)""",
                        (datetime.now(UTC).isoformat(), self._run_id, self.env.runner.user_count),
                    )
            except psycopg.Error as error:
                logging.error("Failed to write user count to Postgresql: " + repr(error))
            gevent.sleep(2.0)

    def _run(self):
        while True:
            if self._samples:
                # Buffer samples, so that a locust greenlet will write to the new list
                # instead of the one that has been sent into postgres client
                samples_buffer = self._samples
                self._samples = []
                self.write_samples_to_db(samples_buffer)
            else:
                if self._finished:
                    break
            gevent.sleep(0.5)

    def _update_end_time(self):
        # delay setting first end time
        # so UI doesn't display temporary value
        gevent.sleep(5)

        # Regularly update endtime to prevent missing endtimes when a test crashes
        while True:
            current_end_time = datetime.now(UTC)
            try:
                with self.pool.connection() as conn:
                    conn.execute(
                        "UPDATE testruns SET end_time = %s WHERE id = %s",
                        (current_end_time, self._run_id),
                    )
                gevent.sleep(60)
            except psycopg.Error as error:
                logging.error("Failed to update testruns table with end time: " + repr(error))
                gevent.sleep(1)

    def write_samples_to_db(self, samples):
        try:
            with self.pool.connection() as conn:
                conn: psycopg.connection.Connection
                with conn.cursor().copy(
                    "COPY requests (time,run_id,greenlet_id,loadgen,name,request_type,response_time,success,response_length,exception,pid,url,context) FROM STDIN"
                ) as copy:
                    for sample in samples:
                        copy.write_row(sample)
        except psycopg.Error as error:
            logging.error("Failed to write samples to Postgresql timescale database: " + repr(error))

    def on_test_stop(self, environment):
        if getattr(self, "_update_end_time_task", False):
            self._update_end_time_task.kill()
        if getattr(self, "_user_count_logger", False):
            self._user_count_logger.kill()
            with self.pool.connection() as conn:
                conn.execute(
                    """INSERT INTO number_of_users(time, run_id, user_count, customer) VALUES (%s, %s, %s, current_user)""",
                    (datetime.now(UTC).isoformat(), self._run_id, 0),
                )
        self.log_stop_test_run()
        self._has_logged_test_stop = True

    def on_quit(self, exit_code, **kwargs):
        self._finished = True
        atexit.unregister(self.log_stop_test_run)  # make sure we dont capture additional ctrl-c:s
        self._background.join(timeout=10)
        if getattr(self, "_update_end_time_task", False):
            self._update_end_time_task.kill()
        if getattr(self, "_user_count_logger", False):
            self._user_count_logger.kill()
        if not self._has_logged_test_stop:
            self.log_stop_test_run()
        if not self.env.parsed_options.worker:
            self.log_exit_code(exit_code)

    def on_request(
        self,
        request_type,
        name,
        response_time,
        response_length,
        exception,
        context,
        start_time=None,
        url=None,
        **kwargs,
    ):
        # handle if a worker connects after test_start
        if not self._run_id:
            self._run_id = parse_datetime(self.env.parsed_options.run_id)
        success = 0 if exception else 1
        if start_time:
            time = datetime.fromtimestamp(start_time, tz=UTC)
        else:
            # some users may not send start_time, so we just make an educated guess
            # (which will be horribly wrong if users spend a lot of time in a with/catch_response-block)
            time = datetime.now(UTC) - timedelta(milliseconds=response_time or 0)
        greenlet_id = getattr(greenlet.getcurrent(), "minimal_ident", 0)  # if we're debugging there is no greenlet

        if exception:
            if isinstance(exception, CatchResponseError):
                exception = str(exception)
            else:
                try:
                    exception = repr(exception)
                except AttributeError:
                    exception = f"{exception.__class__} (and it has no string representation)"

            exception = exception[:300]
        else:
            exception = None

        sample = (
            time,
            self._run_id,
            greenlet_id,
            self._hostname,
            name,
            request_type,
            response_time,
            success,
            response_length,
            exception,
            self._pid,
            url[0:255] if url else None,
            psycopg.types.json.Json(context, safe_serialize),
        )

        self._samples.append(sample)

    def log_start_testrun(self):
        cmd = sys.argv[1:]
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO testruns (id, num_users, worker_count, username, locustfile, profile, arguments, customer) VALUES (%s,%s,%s,%s,%s,%s,%s,current_user)",
                (
                    self._run_id,
                    self.env.runner.target_user_count if self.env.runner else 1,
                    len(self.env.runner.clients)
                    if isinstance(
                        self.env.runner,
                        MasterRunner,
                    )
                    else 0,
                    self.env.web_ui.template_args.get("username", "") if self.env.web_ui else "",
                    self.env.parsed_locustfiles[0].split("/")[-1].split("__")[-1],
                    self.env.parsed_options.profile,
                    " ".join(cmd),
                ),
            )
            conn.execute(
                "INSERT INTO events (time, text, run_id, customer) VALUES (%s, %s, %s, current_user)",
                (datetime.now(UTC).isoformat(), "Test run started", self._run_id),
            )

    def spawning_complete(self, user_count):
        if not self.env.parsed_options.worker:  # only log for master/standalone
            end_time = datetime.now(UTC)
            try:
                with self.pool.connection() as conn:
                    conn.execute(
                        "INSERT INTO events (time, text, run_id, customer) VALUES (%s, %s, %s, current_user)",
                        (end_time, f"Rampup complete, {user_count} users spawned", self._run_id),
                    )
            except psycopg.Error as error:
                logging.error(
                    "Failed to insert rampup complete event time to Postgresql timescale database: " + repr(error)
                )

    def log_stop_test_run(self):
        logging.debug(f"Test run id {self._run_id} stopping")
        if self.env.parsed_options.worker:
            return  # only run on master or standalone
        end_time = datetime.now(UTC)
        try:
            with self.pool.connection() as conn:
                conn.execute(
                    "UPDATE testruns SET end_time = %s WHERE id = %s",
                    (end_time, self._run_id),
                )

                try:
                    # The AND time > run_id clause in the following statements are there to help Timescale performance
                    # We dont use start_time / end_time to calculate RPS, instead we use the time between the actual first and last request
                    # (as this is a more accurate measurement of the actual test)
                    conn.execute(
                        """
UPDATE testruns
SET (requests, resp_time_avg, rps_avg, fail_ratio) =
(SELECT reqs, resp_time, reqs / GREATEST(duration, 1), fails / GREATEST(reqs, 1)) FROM
(SELECT
 COUNT(*)::numeric AS reqs,
 AVG(response_time)::numeric as resp_time
 FROM requests_view WHERE run_id = %(run_id)s AND time > %(run_id)s) AS _,
(SELECT
 EXTRACT(epoch FROM (SELECT MAX(time)-MIN(time) FROM requests_view WHERE run_id = %(run_id)s AND time > %(run_id)s))::numeric AS duration) AS __,
(SELECT
 COUNT(*)::numeric AS fails
 FROM requests_view WHERE run_id = %(run_id)s AND time > %(run_id)s AND success = 0) AS ___
WHERE id = %(run_id)s""",
                        {"run_id": self._run_id},
                    )
                except psycopg.errors.DivisionByZero:  # remove this except later, because it shouldnt happen any more
                    logging.info(
                        "Got DivisionByZero error when trying to update testruns, most likely because there were no requests logged"
                    )
        except psycopg.Error as error:
            logging.error(
                "Failed to update testruns record (or events) with end time to Postgresql timescale database: "
                + repr(error)
            )

    def log_exit_code(self, exit_code=None):
        try:
            with self.pool.connection() as conn:
                conn.execute(
                    "UPDATE testruns SET exit_code = %s WHERE id = %s",
                    (exit_code, self._run_id),
                )
                conn.execute(
                    "INSERT INTO events (time, text, run_id, customer) VALUES (%s, %s, %s, current_user)",
                    (datetime.now(UTC).isoformat(), f"Finished with exit code: {exit_code}", self._run_id),
                )
        except psycopg.Error as error:
            logging.error(
                "Failed to update testruns record (or events) with end time to Postgresql timescale database: "
                + repr(error)
            )
