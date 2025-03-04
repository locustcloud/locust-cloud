import logging
import os
import sys
import webbrowser
from threading import Thread

import requests
from locust_cloud.apisession import ApiSession
from locust_cloud.args import parse_known_args
from locust_cloud.common import __version__
from locust_cloud.input_events import input_listener
from locust_cloud.web_login import web_login
from locust_cloud.websocket import SessionMismatchError, Websocket, WebsocketTimeout

logger = logging.getLogger(__name__)


def configure_logging(loglevel: str) -> None:
    format = (
        "[%(asctime)s] %(levelname)s: %(message)s"
        if loglevel == "INFO"
        else "[%(asctime)s] %(levelname)s/%(module)s: %(message)s"
    )
    logging.basicConfig(format=format, level=loglevel)
    # Restore log level for other libs. Yes, this can probably be done more nicely
    logging.getLogger("requests").setLevel(logging.INFO)
    logging.getLogger("urllib3").setLevel(logging.INFO)


def main() -> None:
    options, locust_options = parse_known_args()
    configure_logging(options.loglevel)

    if options.version:
        print(f"locust-cloud version {__version__}")
        sys.exit(0)
    if not options.locustfile:
        logger.error("A locustfile is required to run a test.")
        sys.exit(1)

    if options.login:
        try:
            web_login()
        except KeyboardInterrupt:
            pass
        sys.exit()

    session = ApiSession(options.non_interactive)
    websocket = Websocket()

    if options.delete:
        delete(session)
        sys.exit()

    try:
        logger.info("Deploying load generators")
        locust_env_variables = [
            {"name": env_variable, "value": os.environ[env_variable]}
            for env_variable in os.environ
            if env_variable.startswith("LOCUST_")
            and env_variable
            not in [
                "LOCUST_LOCUSTFILE",
                "LOCUST_USERS",
                "LOCUST_WEB_HOST_DISPLAY_NAME",
                "LOCUST_SKIP_MONKEY_PATCH",
            ]
        ]
        payload = {
            "locust_args": [
                {"name": "LOCUST_USERS", "value": str(options.users)},
                {"name": "LOCUST_FLAGS", "value": " ".join(locust_options)},
                {"name": "LOCUSTCLOUD_DEPLOYER_URL", "value": session.api_url},
                {"name": "LOCUSTCLOUD_PROFILE", "value": options.profile},
                *locust_env_variables,
            ],
            "locustfile": options.locustfile,
            "user_count": options.users,
            "mock_server": options.mock_server,
        }

        if options.image_tag is not None:
            payload["image_tag"] = options.image_tag

        if options.workers is not None:
            payload["worker_count"] = options.workers

        if options.requirements:
            payload["requirements"] = options.requirements

        if options.extra_files:
            payload["extra_files"] = options.extra_files

        try:
            response = session.post("/deploy", json=payload)
            js = response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to deploy the load generators: {e}")
            sys.exit(1)

        if response.status_code != 200:
            try:
                logger.error(f"{js['Message']} (HTTP {response.status_code}/{response.reason})")
            except Exception:
                logger.error(
                    f"HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
                )
            sys.exit(1)

        log_ws_url = js["log_ws_url"]
        session_id = js["session_id"]
        webui_url = log_ws_url.replace("/socket-logs", "")

        def open_ui():
            webbrowser.open_new_tab(webui_url)

        Thread(target=input_listener({"\r": open_ui, "\n": open_ui}), daemon=True).start()

        # logger.debug(f"Session ID is {session_id}")

        logger.info("Waiting for load generators to be ready...")
        websocket.connect(
            log_ws_url,
            auth=session_id,
        )
        websocket.wait()

    except KeyboardInterrupt:
        logger.debug("Interrupted by user")
        delete(session)
        try:
            websocket.wait(timeout=True)
        except (WebsocketTimeout, SessionMismatchError) as e:
            logger.error(str(e))
            sys.exit(1)
    except WebsocketTimeout as e:
        logger.error(str(e))
        delete(session)
        sys.exit(1)
    except SessionMismatchError as e:
        # In this case we do not trigger the teardown since the running instance is not ours
        logger.error(str(e))
        sys.exit(1)
    except Exception as e:
        logger.exception(e)
        delete(session)
        sys.exit(1)
    else:
        delete(session)
    finally:
        logger.debug("Shutting down websocket")
        websocket.shutdown()


def delete(session):
    try:
        logger.info("Tearing down Locust cloud...")
        response = session.delete(
            "/teardown",
        )

        if response.status_code == 200:
            logger.debug(f"Response message from teardown: {response.json()['message']}")
        else:
            logger.info(
                f"Could not automatically tear down Locust Cloud: HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
            )
    except Exception as e:
        logger.error(f"Could not automatically tear down Locust Cloud: {e.__class__.__name__}:{e}")


if __name__ == "__main__":
    main()
