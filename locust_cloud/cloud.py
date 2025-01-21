import base64
import gzip
import importlib.metadata
import json
import logging
import os
import pathlib
import sys
import threading
import time
import tomllib
import urllib.parse
import webbrowser
from argparse import Namespace
from collections import OrderedDict
from dataclasses import dataclass
from typing import IO, Any

import configargparse
import jwt
import platformdirs
import requests
import socketio
import socketio.exceptions

__version__ = importlib.metadata.version("locust-cloud")


class LocustTomlConfigParser(configargparse.TomlConfigParser):
    def parse(self, stream: IO[str]) -> OrderedDict[str, Any]:
        try:
            config = tomllib.loads(stream.read())
        except Exception as e:
            raise configargparse.ConfigFileParserException(f"Couldn't parse TOML file: {e}")

        result: OrderedDict[str, Any] = OrderedDict()

        for section in self.sections:
            data = configargparse.get_toml_section(config, section)
            if data:
                for key, value in data.items():
                    if isinstance(value, list):
                        result[key] = value
                    elif value is not None:
                        result[key] = str(value)
                break

        return result


parser = configargparse.ArgumentParser(
    default_config_files=[
        "~/.locust.conf",
        "locust.conf",
        "pyproject.toml",
        "~/.cloud.conf",
        "cloud.conf",
    ],
    auto_env_var_prefix="LOCUSTCLOUD_",
    formatter_class=configargparse.RawTextHelpFormatter,
    config_file_parser_class=configargparse.CompositeConfigParser(
        [
            LocustTomlConfigParser(["tool.locust"]),
            configargparse.DefaultConfigFileParser,
        ]
    ),
    description="""Launches a distributed Locust runs on locust.cloud infrastructure.

Example: locust-cloud -f my_locustfile.py --users 1000 ...""",
    epilog="""Any parameters not listed here are forwarded to locust master unmodified, so go ahead and use things like --users, --host, --run-time, ...
Locust config can also be set using config file (~/.locust.conf, locust.conf, pyproject.toml, ~/.cloud.conf or cloud.conf).
Parameters specified on command line override env vars, which in turn override config files.""",
    add_config_file_help=False,
    add_env_var_help=False,
    add_help=False,
)
parser.add_argument(
    "-h",
    "--help",
    action="help",
    help=configargparse.SUPPRESS,
)
parser.add_argument(
    "-V",
    "--version",
    action="store_true",
    help=configargparse.SUPPRESS,
)
parser.add_argument(
    "-f",
    "--locustfile",
    metavar="<filename>",
    default="locustfile.py",
    help="The Python file that contains your test. Defaults to 'locustfile.py'.",
    env_var="LOCUST_LOCUSTFILE",
)
parser.add_argument(
    "-u",
    "--users",
    type=int,
    default=1,
    help="Number of users to launch. This is the same as the regular Locust argument, but also affects how many workers to launch.",
    env_var="LOCUST_USERS",
)
advanced = parser.add_argument_group("advanced")
advanced.add_argument(
    "--loglevel",
    "-L",
    type=str,
    help="Set --loglevel DEBUG for extra info.",
    default="INFO",
)
advanced.add_argument(
    "--requirements",
    type=str,
    help="Optional requirements.txt file that contains your external libraries.",
)
advanced.add_argument(
    "--login",
    action="store_true",
    default=False,
    help=configargparse.SUPPRESS,
)
advanced.add_argument(
    "--non-interactive",
    action="store_true",
    default=False,
    help="This can be set when, for example, running in a CI/CD environment to ensure no interactive steps while executing.\nRequires that LOCUSTCLOUD_USERNAME, LOCUSTCLOUD_PASSWORD and LOCUSTCLOUD_REGION environment variables are set.",
)
parser.add_argument(
    "--workers",
    type=int,
    help="Number of workers to use for the deployment. Defaults to number of users divided by 500, but the default may be customized for your account.",
    default=None,
)
parser.add_argument(
    "--delete",
    action="store_true",
    help="Delete a running cluster. Useful if locust-cloud was killed/disconnected or if there was an error.",
)
parser.add_argument(
    "--image-tag",
    type=str,
    default=None,
    help=configargparse.SUPPRESS,  # overrides the locust-cloud docker image tag. for internal use
)
parser.add_argument(
    "--mock-server",
    action="store_true",
    default=False,
    help="Start a demo mock service and set --host parameter to point Locust towards it",
)
parser.add_argument(
    "--profile",
    type=str,
    help="Set a profile to group the testruns together",
)

options, locust_options = parser.parse_known_args()

options: Namespace
locust_options: list

logging.basicConfig(
    format="[LOCUST-CLOUD] %(levelname)s: %(message)s",
    level=options.loglevel.upper(),
)
logger = logging.getLogger(__name__)
# Restore log level for other libs. Yes, this can be done more nicely
logging.getLogger("requests").setLevel(logging.INFO)
logging.getLogger("urllib3").setLevel(logging.INFO)

cloud_conf_file = pathlib.Path(platformdirs.user_config_dir(appname="locust-cloud")) / "config"
valid_regions = ["us-east-1", "eu-north-1"]


def get_api_url(region):
    return os.environ.get("LOCUSTCLOUD_DEPLOYER_URL", f"https://api.{region}.locust.cloud/1")


@dataclass
class CloudConfig:
    id_token: str | None = None
    refresh_token: str | None = None
    refresh_token_expires: int = 0
    region: str | None = None


def read_cloud_config() -> CloudConfig:
    if cloud_conf_file.exists():
        with open(cloud_conf_file) as f:
            return CloudConfig(**json.load(f))

    return CloudConfig()


def write_cloud_config(config: CloudConfig) -> None:
    cloud_conf_file.parent.mkdir(parents=True, exist_ok=True)

    with open(cloud_conf_file, "w") as f:
        json.dump(config.__dict__, f)


def web_login() -> None:
    print("Enter the number for the region to authenticate against")
    print()
    for i, valid_region in enumerate(valid_regions, start=1):
        print(f"  {i}. {valid_region}")
    print()
    choice = input("> ")
    try:
        region_index = int(choice) - 1
        assert 0 <= region_index < len(valid_regions)
    except (ValueError, AssertionError):
        print(f"Not a valid choice: '{choice}'")
        sys.exit(1)

    region = valid_regions[region_index]

    try:
        response = requests.post(f"{get_api_url(region)}/cli-auth")
        response.raise_for_status()
        response_data = response.json()
        authentication_url = response_data["authentication_url"]
        result_url = response_data["result_url"]
    except Exception as e:
        print("Something went wrong trying to authorize the locust-cloud CLI:", str(e))
        sys.exit(1)

    message = f"""
Attempting to automatically open the SSO authorization page in your default browser.
If the browser does not open or you wish to use a different device to authorize this request, open the following URL:

{authentication_url}
    """.strip()
    print()
    print(message)

    webbrowser.open_new_tab(authentication_url)

    while True:  # Should there be some kind of timeout?
        response = requests.get(result_url)

        if not response.ok:
            print("Oh no!")
            print(response.text)
            sys.exit(1)

        data = response.json()

        if data["state"] == "pending":
            time.sleep(1)
            continue
        elif data["state"] == "failed":
            print(f"\nFailed to authorize CLI: {data['reason']}")
            sys.exit(1)
        elif data["state"] == "authorized":
            print("\nAuthorization succeded")
            break
        else:
            print("\nGot unexpected response when authorizing CLI")
            sys.exit(1)

    config = CloudConfig(
        id_token=data["id_token"],
        refresh_token=data["refresh_token"],
        refresh_token_expires=data["refresh_token_expires"],
        region=region,
    )
    write_cloud_config(config)


class ApiSession(requests.Session):
    def __init__(self) -> None:
        super().__init__()

        if options.non_interactive:
            username = os.getenv("LOCUSTCLOUD_USERNAME")
            password = os.getenv("LOCUSTCLOUD_PASSWORD")
            region = os.getenv("LOCUSTCLOUD_REGION")

            if not all([username, password, region]):
                print(
                    "Running with --non-interaction requires that LOCUSTCLOUD_USERNAME, LOCUSTCLOUD_PASSWORD and LOCUSTCLOUD_REGION environment variables are set."
                )
                sys.exit(1)

            if region not in valid_regions:
                print("Environment variable LOCUSTCLOUD_REGION needs to be set to one of", ", ".join(valid_regions))
                sys.exit(1)

            self.__configure_for_region(region)
            response = requests.post(
                self.__login_url,
                json={"username": username, "password": password},
                headers={"X-Client-Version": __version__},
            )
            if not response.ok:
                print(f"Authentication failed: {response.text}")
                sys.exit(1)

            self.__refresh_token = response.json()["refresh_token"]
            id_token = response.json()["cognito_client_id_token"]

        else:
            config = read_cloud_config()

            if config.refresh_token_expires < time.time() + 24 * 60 * 60:
                message = "You need to authenticate before proceeding. Please run:\n    locust-cloud --login"
                print(message)
                sys.exit(1)

            assert config.region
            self.__configure_for_region(config.region)
            self.__refresh_token = config.refresh_token
            id_token = config.id_token

        assert id_token

        decoded = jwt.decode(id_token, options={"verify_signature": False})
        self.__expiry_time = decoded["exp"] - 60  # Refresh 1 minute before expiry
        self.headers["Authorization"] = f"Bearer {id_token}"

        self.__sub = decoded["sub"]
        self.headers["X-Client-Version"] = __version__

    def __configure_for_region(self, region: str) -> None:
        self.__region = region
        self.api_url = get_api_url(region)
        self.__login_url = f"{self.api_url}/auth/login"

        logger.debug(f"Lambda url: {self.api_url}")

    def __ensure_valid_authorization_header(self) -> None:
        if self.__expiry_time > time.time():
            return

        logger.info(f"Authenticating ({self.__region}, v{__version__})")

        response = requests.post(
            self.__login_url,
            json={"user_sub_id": self.__sub, "refresh_token": self.__refresh_token},
            headers={"X-Client-Version": __version__},
        )

        if not response.ok:
            logger.error(f"Authentication failed: {response.text}")
            sys.exit(1)

        # TODO: Technically the /login endpoint can return a challenge for you
        #       to change your password. Don't know how we should handle that
        #       in the cli.

        id_token = response.json()["cognito_client_id_token"]
        decoded = jwt.decode(id_token, options={"verify_signature": False})
        self.__expiry_time = decoded["exp"] - 60  # Refresh 1 minute before expiry
        self.headers["Authorization"] = f"Bearer {id_token}"

        if not options.non_interactive:
            config = read_cloud_config()
            config.id_token = id_token
            write_cloud_config(config)

    def request(self, method, url, *args, **kwargs) -> requests.Response:
        self.__ensure_valid_authorization_header()
        return super().request(method, f"{self.api_url}{url}", *args, **kwargs)


def main() -> None:
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

    session = ApiSession()

    try:
        if options.delete:
            delete(session)
            return

        try:
            with open(options.locustfile, "rb") as f:
                locustfile_data = base64.b64encode(gzip.compress(f.read())).decode()
        except FileNotFoundError:
            logger.error(f"File not found: {options.locustfile}")
            sys.exit(1)

        requirements_data = None

        if options.requirements:
            try:
                with open(options.requirements, "rb") as f:
                    requirements_data = base64.b64encode(gzip.compress(f.read())).decode()
            except FileNotFoundError:
                logger.error(f"File not found: {options.requirements}")
                sys.exit(1)

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
            "locustfile": {"filename": options.locustfile, "data": locustfile_data},
            "user_count": options.users,
            "mock_server": options.mock_server,
        }

        if options.image_tag is not None:
            payload["image_tag"] = options.image_tag

        if options.workers is not None:
            payload["worker_count"] = options.workers

        if options.requirements:
            payload["requirements"] = {"filename": options.requirements, "data": requirements_data}

        try:
            response = session.post("/deploy", json=payload)
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to deploy the load generators: {e}")
            sys.exit(1)

        if response.status_code == 200:
            log_ws_url = response.json()["log_ws_url"]
        else:
            try:
                logger.error(f"{response.json()['Message']} (HTTP {response.status_code}/{response.reason})")
            except Exception:
                logger.error(
                    f"HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
                )
            sys.exit(1)

    except KeyboardInterrupt:
        # TODO: This would potentially leave a deployment running, combine with try-catch below?
        logger.debug("Interrupted by user")
        sys.exit(0)

    logger.debug("Load generators deployed successfully!")
    logger.info("Waiting for pods to be ready...")

    shutdown_allowed = threading.Event()
    shutdown_allowed.set()
    reconnect_aborted = threading.Event()
    connect_timeout = threading.Timer(2 * 60, reconnect_aborted.set)
    sio = socketio.Client(handle_sigint=False)

    try:
        ws_connection_info = urllib.parse.urlparse(log_ws_url)

        @sio.event
        def connect():
            shutdown_allowed.clear()
            connect_timeout.cancel()
            logger.debug("Websocket connection established, switching to Locust logs")

        @sio.event
        def disconnect():
            logger.debug("Websocket disconnected")

        @sio.event
        def stderr(message):
            sys.stderr.write(message)

        @sio.event
        def stdout(message):
            sys.stdout.write(message)

        @sio.event
        def shutdown(message):
            logger.debug("Got shutdown from locust master")
            if message:
                print(message)

            shutdown_allowed.set()

        # The _reconnect_abort value on the socketio client will be populated with a newly created threading.Event if it's not already set.
        # There is no way to set this by passing it in the constructor.
        # This event is the only way to interupt the retry logic when the connection is attempted.
        sio._reconnect_abort = reconnect_aborted
        connect_timeout.start()
        sio.connect(
            f"{ws_connection_info.scheme}://{ws_connection_info.netloc}",
            socketio_path=ws_connection_info.path,
            retry=True,
        )
        logger.debug("Waiting for shutdown")
        shutdown_allowed.wait()

    except KeyboardInterrupt:
        logger.debug("Interrupted by user")
        delete(session)
        shutdown_allowed.wait(timeout=90)
    except Exception as e:
        logger.exception(e)
        delete(session)
        sys.exit(1)
    else:
        delete(session)
    finally:
        sio.shutdown()


def delete(session):
    try:
        logger.info("Tearing down Locust cloud...")
        response = session.delete(
            "/teardown",
        )

        if response.status_code == 200:
            logger.debug(response.json()["message"])
        else:
            logger.info(
                f"Could not automatically tear down Locust Cloud: HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
            )
    except Exception as e:
        logger.error(f"Could not automatically tear down Locust Cloud: {e.__class__.__name__}:{e}")

    logger.info("Done! ✨")  # FIXME: Should probably not say it's done since at this point it could still be running


if __name__ == "__main__":
    main()
