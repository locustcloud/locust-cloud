import os
import re
import select
import subprocess
import sys
import textwrap
import time
from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
import requests

CUSTOMER = "c09c09cc-00b1-7063-41ea-080c55f25d67"

SHARED_ENV = {
    "PATH": os.environ["PATH"],
    # For locust cloud
    "AWS_DEFAULT_REGION": "eu-north-1",
    "CUSTOMER_ID": CUSTOMER,
    "LOCUSTCLOUD_CLIENT_VERSION": "1.12.2",
    "LOCUSTCLOUD_DEPLOYER_URL": "https://api.eu-north-1.locust.cloud/1",
    "LOCUSTCLOUD_PROFILE": "automated",
    # For locust
    "LOCUST_LOGLEVEL": "DEBUG",
    "LOCUST_USERS": "1",
    # For flask
    "SECRET_KEY": "1234",  # Specific value doesn't matter
    # For db connection
    "CHHOST": "ugzgl7bpxt.us-east-1.aws.clickhouse.cloud",
    "CHUSER": os.environ["CHUSER"],
    "CHPASSWORD": os.environ["CHPASSWORD"],
}
MASTER_ENV = {
    **SHARED_ENV,
    "LOCUST_MODE_MASTER": "1",
    "LOCUST_WEB_LOGIN": "1",
    "LOCUST_EXIT_CODE_ON_ERROR": "0",
    "LOCUST_WEB_BASE_PATH": f"/{CUSTOMER}",
    "LOCUST_EXPECT_WORKERS": "1",
}
WORKER_ENV = {
    **SHARED_ENV,
    "LOCUST_MODE_WORKER": "1",
    "LOCUST_LOCUSTFILE": "-",
}


@contextmanager
def do_test_run(master_env, worker_env, **kwargs):
    command = ["locust"]

    for k, v in kwargs.items():
        if v is False:
            continue

        command.append(f"--{k.replace('_', '-')}")

        if v is True:
            continue

        command.append(v)

    print("Running", " ".join(command))

    master = subprocess.Popen(command, env=master_env, stdout=sys.stdout, stderr=subprocess.PIPE, text=True)
    worker = subprocess.Popen(command, env=worker_env, stdout=sys.stdout, stderr=subprocess.PIPE, text=True)  # noqa: F841

    try:
        yield master

    finally:
        master.terminate()
        sys.stderr.writelines(master.stderr.readlines())


def check_for_output(stderr, regex, timeout=None):
    start = time.time()

    while True:
        try:
            select.select([stderr], [], [], 1.0)
        except TimeoutError:
            pass
        else:
            line = stderr.readline()
            sys.stderr.write(line)
            if m := regex.match(line):
                return m

        if timeout and time.time() - start > timeout:
            break


@pytest.fixture(autouse=True)
def socket_death():
    import threading

    import socketio
    import socketio.exceptions

    thread_shutdown = threading.Event()

    def run_socket_client():
        sio = socketio.Client(handle_sigint=False)

        @sio.event
        def connect():
            print("Websocket connection established", flush=True)

        @sio.event
        def disconnect():
            print("Websocket disconnected", flush=True)

        @sio.event
        def stderr(message):
            pass

        @sio.event
        def stdout(message):
            pass

        @sio.event
        def shutdown(_):
            print("Got shutdown from locust master", flush=True)
            thread_shutdown.set()

        for _ in range(5 * 60):  # try for 5 minutes
            try:
                sio.connect("http://127.0.0.1:1095", socketio_path=f"/{CUSTOMER}/socket-logs")
                break
            except socketio.exceptions.ConnectionError as e:
                print(f"Failed to obtain websocket connection: {e}", flush=True)
                time.sleep(1)

        else:  # no break
            raise Exception("Failed to obtain socket connection")

        thread_shutdown.wait()
        sio.shutdown()

    thread = threading.Thread(target=run_socket_client)
    print("spawning socket client", flush=True)
    thread.start()
    print("socket client spawned", flush=True)
    yield
    thread.join(timeout=10)


@pytest.fixture
def webui_session():
    class WebUiSession(requests.Session):
        def __init__(self, *args, base_url, **kwargs):
            super().__init__(*args, **kwargs)
            self.__base_url = base_url

        def request(self, method, url, *args, **kwargs):
            response = super().request(method, f"{self.__base_url}{url}", *args, **kwargs)
            print(f"{method} {self.__base_url}{url}")
            print(textwrap.indent(response.text, "  "))
            return response

    return WebUiSession(base_url=f"http://127.0.0.1:8089/{CUSTOMER}")


def test_ch_wait_fails():
    master_env = dict(MASTER_ENV)
    worker_env = dict(WORKER_ENV)

    for env in master_env, worker_env:
        for key in ("CHUSER", "CHPASSWORD"):
            env[key] = "pineapple"

    with do_test_run(master_env, worker_env) as test_run:
        test_run.wait(timeout=15)
        assert check_for_output(
            test_run.stderr, re.compile(r".*AUTHENTICATION_FAILED.*")
        ), "Failed to find database timeout in locust output"
        assert test_run.returncode == 1


def test_fetching_request_data_from_the_webui(webui_session):
    with do_test_run(MASTER_ENV, WORKER_ENV) as test_run:
        # Wait for the webui to be started
        assert check_for_output(test_run.stderr, re.compile(r".* Starting web interface"), timeout=5), "No webui log"
        time.sleep(5)  # The log message comes before the server is started

        # Authenticate towards the webui
        response = webui_session.post(
            "/authenticate",
            data={"username": os.environ["LOCUSTCLOUD_USERNAME"], "password": os.environ["LOCUSTCLOUD_PASSWORD"]},
        )
        assert response.status_code == 200, "Failed to authenticate"
        # assert not "Invalid login for this deployment" in response.text
        # assert "available_user_classes" in response.text, f"missing text from response {response.text}"

        start = str(datetime.now(UTC)).split(".")[0]

        # Start the test run through the webui
        swarm_response = webui_session.post(
            "/swarm",
            data={
                "user_count": 1,
                "spawn_rate": 1,
                "host": "https://mock-test-target.eu-north-1.locust.cloud",
            },
        )
        try:
            swarm_response.json()["success"]
        except Exception:
            assert False, f"couldnt parse swarm response as json or not successful: {swarm_response.text}"

        # Wait for a while
        time.sleep(10)

        # Stop the test run
        assert webui_session.get("/stop").json()["success"], "Failed to stop test run"

        # Wait for the test to finish
        m = check_for_output(test_run.stderr, re.compile(r".*Test run id (.*) stopping.*"), timeout=30)
        assert m, "Didn't get a test run id in the locust output before timeout"
        test_run_id = m.groups()[0]

        end = str(datetime.now(UTC)).split(".")[0]
        test_run_id = str(datetime.fromisoformat(test_run_id)).split(".")[0]

        # Fetch some stats
        results = webui_session.post(
            "/cloud-stats/requests", json={"start": start, "end": end, "testrun": test_run_id}
        ).json()

        assert results, "Got no request stats"

        for result in results:
            assert result["method"] == "POST"

        assert sum(int(result["requests"]) for result in results) >= 5
