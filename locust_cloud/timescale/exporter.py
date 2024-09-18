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
from psycopg_pool import ConnectionPool


def safe_serialize(obj):
    def default(o):
        return f"<<non-serializable: {type(o).__qualname__}>>"

    return json.dumps(obj, default=default)


class Timescale:
    def __init__(self, environment: locust.env.Environment, pg_user, pg_host, pg_password, pg_database, pg_port):
        self.env = environment
        self._run_id = None
        self._samples: list[dict] = []
        self._background = gevent.spawn(self._run)
        self._hostname = socket.gethostname()
        self._finished = False
        self._pid = os.getpid()

        def set_autocommit(conn: psycopg.Connection):
            conn.autocommit = True

        try:
            self.pool = ConnectionPool(
                conninfo=f"postgres://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}?sslmode=require",
                min_size=1,
                max_size=5,
                configure=set_autocommit,
            )
        except Exception:
            sys.stderr.write(f"Could not connect to postgres ({pg_user}@{pg_host}:{pg_port}).")
            sys.exit(1)

        events = self.env.events
        events.test_start.add_listener(self.on_test_start)
        events.test_stop.add_listener(self.on_test_stop)
        events.request.add_listener(self.on_request)
        events.cpu_warning.add_listener(self.on_cpu_warning)
        events.quit.add_listener(self.on_quit)
        events.spawning_complete.add_listener(self.spawning_complete)
        atexit.register(self.log_stop_test_run)

        if self.env.runner is not None:
            self.env.runner.register_message("run_id", self.set_run_id)

    def set_run_id(self, environment, msg, **kwargs):
        logging.debug(f"run id from master: {msg.data}")
        self._run_id = datetime.strptime(msg.data, "%Y-%m-%d, %H:%M:%S.%f").replace(tzinfo=UTC)

    def on_cpu_warning(self, environment: locust.env.Environment, cpu_usage, message=None, timestamp=None, **kwargs):
        # passing a custom message & timestamp to the event is a haxx to allow using this event for reporting generic events
        if not timestamp:
            timestamp = datetime.now(UTC).isoformat()
        if not message:
            message = f"High CPU usage ({cpu_usage}%)"
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO events (time, text, run_id) VALUES (%s, %s, %s)", (timestamp, message, self._run_id)
            )

    def on_test_start(self, environment: locust.env.Environment):
        if not self.env.parsed_options or not self.env.parsed_options.worker:
            self._run_id = environment._run_id = datetime.now(UTC)  # type: ignore
            msg = environment._run_id.strftime("%Y-%m-%d, %H:%M:%S.%f")  # type: ignore
            if environment.runner is not None:
                logging.debug(f"about to send run_id to workers: {msg}")
                environment.runner.send_message("run_id", msg)
            self.log_start_testrun()
            self._user_count_logger = gevent.spawn(self._log_user_count)

    def _log_user_count(self):
        while True:
            if self.env.runner is None:
                return  # there is no runner, so nothing to log...
            try:
                with self.pool.connection() as conn:
                    conn.execute(
                        """INSERT INTO number_of_users(time, run_id, user_count) VALUES (%s, %s, %s)""",
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

    def write_samples_to_db(self, samples):
        try:
            with self.pool.connection() as conn:
                conn.cursor().executemany(
                    """
INSERT INTO requests (time,run_id,greenlet_id,loadgen,name,request_type,response_time,success,response_length,exception,pid,url,context)
VALUES (%(time)s, %(run_id)s, %(greenlet_id)s, %(loadgen)s, %(name)s, %(request_type)s, %(response_time)s, %(success)s, %(response_length)s, %(exception)s, %(pid)s, %(url)s, %(context)s)
""",
                    samples,
                )
        except psycopg.Error as error:
            logging.error("Failed to write samples to Postgresql timescale database: " + repr(error))

    def on_test_stop(self, environment):
        if getattr(self, "_user_count_logger", False):
            self._user_count_logger.kill()
        self.log_stop_test_run()

    def on_quit(self, exit_code, **kwargs):
        self._finished = True
        atexit._clear()  # make sure we dont capture additional ctrl-c:s
        self._background.join(timeout=10)
        if getattr(self, "_user_count_logger", False):
            self._user_count_logger.kill()
        self.log_stop_test_run(exit_code)

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
        success = 0 if exception else 1
        if start_time:
            time = datetime.fromtimestamp(start_time, tz=UTC)
        else:
            # some users may not send start_time, so we just make an educated guess
            # (which will be horribly wrong if users spend a lot of time in a with/catch_response-block)
            time = datetime.now(UTC) - timedelta(milliseconds=response_time or 0)
        greenlet_id = getattr(greenlet.getcurrent(), "minimal_ident", 0)  # if we're debugging there is no greenlet
        sample = {
            "time": time,
            "run_id": self._run_id,
            "greenlet_id": greenlet_id,
            "loadgen": self._hostname,
            "name": name,
            "request_type": request_type,
            "response_time": response_time,
            "success": success,
            "url": url[0:255] if url else None,
            "pid": self._pid,
            "context": psycopg.types.json.Json(context, safe_serialize),
        }

        if response_length >= 0:
            sample["response_length"] = response_length
        else:
            sample["response_length"] = None

        if exception:
            if isinstance(exception, CatchResponseError):
                sample["exception"] = str(exception)
            else:
                try:
                    sample["exception"] = repr(exception)
                except AttributeError:
                    sample["exception"] = f"{exception.__class__} (and it has no string representation)"
        else:
            sample["exception"] = None

        self._samples.append(sample)

    def log_start_testrun(self):
        cmd = sys.argv[1:]
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO testruns (id, num_users, description, arguments) VALUES (%s,%s,%s,%s)",
                (
                    self._run_id,
                    self.env.parsed_options.num_users or self.env.runner.user_count or 0,
                    "self.env.parsed_options.description",
                    " ".join(cmd),
                ),
            )
            conn.execute(
                "INSERT INTO events (time, text, run_id) VALUES (%s, %s, %s)",
                (datetime.now(UTC).isoformat(), "Test run started", self._run_id),
            )

    def spawning_complete(self, user_count):
        if not self.env.parsed_options.worker:  # only log for master/standalone
            end_time = datetime.now(UTC)
            try:
                with self.pool.connection() as conn:
                    conn.execute(
                        "INSERT INTO events (time, text, run_id) VALUES (%s, %s, %s)",
                        (end_time, f"Rampup complete, {user_count} users spawned", self._run_id),
                    )
            except psycopg.Error as error:
                logging.error(
                    "Failed to insert rampup complete event time to Postgresql timescale database: " + repr(error)
                )

    def log_stop_test_run(self, exit_code=None):
        logging.debug(f"Test run id {self._run_id} stopping")
        if self.env.parsed_options.worker:
            return  # only run on master or standalone
        end_time = datetime.now(UTC)
        try:
            with self.pool.connection() as conn:
                conn.execute(
                    "UPDATE testruns SET end_time = %s, exit_code = %s where id = %s",
                    (end_time, exit_code, self._run_id),
                )
                conn.execute(
                    "INSERT INTO events (time, text, run_id) VALUES (%s, %s, %s)",
                    (end_time, f"Finished with exit code: {exit_code}", self._run_id),
                )
                # The AND time > run_id clause in the following statements are there to help Timescale performance
                # We dont use start_time / end_time to calculate RPS, instead we use the time between the actual first and last request
                # (as this is a more accurate measurement of the actual test)
                try:
                    conn.execute(
                        """
UPDATE testruns
SET (requests, resp_time_avg, rps_avg, fail_ratio) =
(SELECT reqs, resp_time, reqs / GREATEST(duration, 1), fails / reqs) FROM
(SELECT
 COUNT(*)::numeric AS reqs,
 AVG(response_time)::numeric as resp_time
 FROM requests WHERE run_id = %(run_id)s AND time > %(run_id)s) AS _,
(SELECT
 EXTRACT(epoch FROM (SELECT MAX(time)-MIN(time) FROM requests WHERE run_id = %(run_id)s AND time > %(run_id)s))::numeric AS duration) AS __,
(SELECT
 COUNT(*)::numeric AS fails
 FROM requests WHERE run_id = %(run_id)s AND time > %(run_id)s AND success = 0) AS ___
WHERE id = %(run_id)s""",
                        {"run_id": self._run_id},
                    )
                except psycopg.errors.DivisionByZero:
                    logging.info(
                        "Got DivisionByZero error when trying to update testruns, most likely because there were no requests logged"
                    )
        except psycopg.Error as error:
            logging.error(
                "Failed to update testruns record (or events) with end time to Postgresql timescale database: "
                + repr(error)
            )
