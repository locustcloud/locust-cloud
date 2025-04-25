import json
import os
import pathlib
import re
import select
import subprocess
import time
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import locust_cloud.common
import platformdirs
import pytest
import requests
from locust_cloud.apisession import unauthorized_message

CLOUD_CONFIG_FILE = pathlib.Path(platformdirs.user_config_dir(appname="locust-cloud")) / "config"
LOCUSTCLOUD_USERNAME = os.environ["LOCUSTCLOUD_USERNAME"]
LOCUSTCLOUD_PASSWORD = os.environ["LOCUSTCLOUD_PASSWORD"]
REGION = "eu-north-1"
API_URL = locust_cloud.common.get_api_url(REGION)


@pytest.fixture(scope="session", autouse=True)
def backup_cloud_config_file():
    do_backup = CLOUD_CONFIG_FILE.exists()
    backup_file = CLOUD_CONFIG_FILE.parent / (CLOUD_CONFIG_FILE.name + "_backup")

    if do_backup:
        CLOUD_CONFIG_FILE.rename(backup_file)

    try:
        yield
    finally:
        if do_backup:
            backup_file.rename(CLOUD_CONFIG_FILE)

        else:  # was not there before the test, should not be there after
            if CLOUD_CONFIG_FILE.exists():
                CLOUD_CONFIG_FILE.unlink()


def check_for_output(stream, regex, timeout=None) -> re.Match | None:
    start = time.time()

    while True:
        res = select.select([stream], [], [], 1.0)

        if res[0]:
            line = stream.readline()
            if m := regex.match(line):
                return m

        if timeout and time.time() - start > timeout:
            break

    return None


def test_cli_auth() -> None:
    # Ensure there is no cloud config file by deleting it
    if CLOUD_CONFIG_FILE.exists():
        CLOUD_CONFIG_FILE.unlink()
    assert not CLOUD_CONFIG_FILE.exists()

    env = {
        "PATH": os.environ["PATH"],  # Needed for obvious reasons
        "PYTHONUNBUFFERED": "1",  # To avoid issues when reading from the process output stream
        "BROWSER": "echo 'Fake browser launch %s'",  # Prevents the automatic opening of a browser window during the test
    }

    # Check that we get the message that login is required
    process = subprocess.Popen(["locust-cloud"], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    process.wait(timeout=1)
    assert process.stdout  # typing, not testing...
    assert unauthorized_message in process.stdout.read()

    # Do a locust-cloud --login
    process = subprocess.Popen(
        ["locust-cloud", "--login"],
        env=env,
        stdout=subprocess.PIPE,
        stdin=subprocess.PIPE,
        text=True,
    )
    assert process.stdout  # typing, not testing...
    assert process.stdin  # typing, not testing...

    # Provide input for the choosing of the region
    process.stdin.write("2\n")
    process.stdin.flush()

    # Wait for the login url to be printed
    m = check_for_output(process.stdout, re.compile(r"(http.*)"), timeout=10)
    assert m, "Didn't get a url in the output before timeout"
    url = m.groups()[0]

    # Make a request to the login url
    session = requests.Session()
    response = requests.get(url)
    assert response.ok, "Failed to load login url"

    auth_id = parse_qs(urlparse(url).query).get("auth_id", [])[0]

    assert auth_id, "Auth id is missing"

    # Login form submits to the deployer, so we'll skip a step
    response = session.post(
        f"{API_URL}/authenticate",
        json={"email": LOCUSTCLOUD_USERNAME, "password": LOCUSTCLOUD_PASSWORD, "auth_id": auth_id},
    )

    # Check that we end up on the success page
    assert response.json().get("auth_id") == auth_id

    # Wait for the process to finish
    process.wait()

    # Check that a cloud config file has been created
    assert CLOUD_CONFIG_FILE.exists()
    cloud_config = json.loads(CLOUD_CONFIG_FILE.read_text())
    for key in ("id_token", "refresh_token", "refresh_token_expires", "region"):
        assert key in cloud_config, f"Missing cloud config key: '{key}'"

    # Check that refresh_token_expires is around 365 days in the future
    expires_in = cloud_config["refresh_token_expires"] - time.time()
    assert -10 < expires_in - timedelta(days=365).total_seconds() < 10
