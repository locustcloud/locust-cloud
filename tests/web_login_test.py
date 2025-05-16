import builtins
import webbrowser
from unittest.mock import MagicMock

import locust_cloud.common
import locust_cloud.web_login
import pytest
import requests_mock

AUTH_ID = "fake"
REGION = "eu-north-1"
API_URL = locust_cloud.common.get_api_url(REGION)
REGION_CHOICE = locust_cloud.common.VALID_REGIONS.index(REGION) + 1


@pytest.fixture
def mocked_requests():
    with requests_mock.Mocker() as m:
        m.post(
            f"{API_URL}/cli-auth",
            json={
                "authentication_url": "<url goes here>",
                "result_url": f"{API_URL}/cli-auth/result/{AUTH_ID}",
            },
        )
        yield m


@pytest.fixture
def select_region(monkeypatch):
    monkeypatch.setattr(builtins, "input", lambda prompt: REGION_CHOICE)


@pytest.fixture(autouse=True)
def faster_cli_auth_result_polling(monkeypatch):
    monkeypatch.setattr(locust_cloud.web_login, "POLLING_FREQUENCY", 0.1)


@pytest.fixture(autouse=True)
def block_browser_launch(monkeypatch):
    monkeypatch.setattr(webbrowser, "open_new_tab", lambda url: None)


def test_browser_login_failed(mocked_requests, select_region, capsys):  # noqa: ARG001
    mocked_requests.get(
        f"{API_URL}/cli-auth/result/{AUTH_ID}",
        [{"json": {"state": "pending"}}, {"json": {"state": "failed", "reason": "because"}}],
    )
    with pytest.raises(SystemExit):
        locust_cloud.web_login.web_login()

    expected = "Failed to authorize CLI: because"
    assert expected in capsys.readouterr().out


def test_browser_login_succeded(mocked_requests, select_region, monkeypatch, capsys):  # noqa: ARG001
    mock = MagicMock()
    monkeypatch.setattr(locust_cloud.web_login, "write_cloud_config", mock)

    response = {
        "state": "authorized",
        "id_token": "A",
        "refresh_token": "B",
        "user_sub_id": "C",
        "refresh_token_expires": 42,
        "id_token_expires": 52,
    }

    mocked_requests.get(
        f"{API_URL}/cli-auth/result/{AUTH_ID}",
        [{"json": {"state": "pending"}}, {"json": response}],
    )
    locust_cloud.web_login.web_login()

    expected = "Authorization succeded. Now you can start a cloud run using: locust --cloud ..."
    assert expected in capsys.readouterr().out

    expected_cloud_config = locust_cloud.common.CloudConfig(
        id_token=response["id_token"],
        refresh_token=response["refresh_token"],
        user_sub_id=response["user_sub_id"],
        refresh_token_expires=response["refresh_token_expires"],
        id_token_expires=response["id_token_expires"],
        region=REGION,
    )
    mock.assert_called_once_with(expected_cloud_config)
