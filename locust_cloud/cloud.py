import base64
import gzip
import importlib.metadata
import io
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
from argparse import ArgumentTypeError, Namespace
from collections import OrderedDict
from collections.abc import Generator
from dataclasses import dataclass
from typing import IO, Any
from zipfile import ZipFile

import configargparse
import jwt
import platformdirs
import requests
import socketio
import socketio.exceptions

__version__ = importlib.metadata.version("locust-cloud")
CWD = pathlib.Path.cwd()


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


def valid_extra_files_path(file_path: str) -> pathlib.Path:
    p = pathlib.Path(file_path).resolve()

    if not CWD in p.parents:
        raise ArgumentTypeError(f"Can only reference files under current working directory: {CWD}")
    if not p.exists():
        raise ArgumentTypeError(f"File not found: {file_path}")
    return p


def transfer_encode(file_name: str, stream: IO[bytes]) -> dict[str, str]:
    return {
        "filename": file_name,
        "data": base64.b64encode(gzip.compress(stream.read())).decode(),
    }


def transfer_encoded_file(file_path: str) -> dict[str, str]:
    try:
        with open(file_path, "rb") as f:
            return transfer_encode(file_path, f)
    except FileNotFoundError:
        raise ArgumentTypeError(f"File not found: {file_path}")


def transfer_encoded_extra_files(paths: list[pathlib.Path]) -> dict[str, str]:
    def expanded(paths: list[pathlib.Path]) -> Generator[pathlib.Path, None, None]:
        for path in paths:
            if path.is_dir():
                for root, _, file_names in os.walk(path):
                    for file_name in file_names:
                        yield pathlib.Path(root) / file_name
            else:
                yield path

    buffer = io.BytesIO()

    with ZipFile(buffer, "w") as zf:
        for path in set(expanded(paths)):
            zf.write(path.relative_to(CWD))

    buffer.seek(0)
    return transfer_encode("extra-files.zip", buffer)


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
    type=transfer_encoded_file,
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
    type=transfer_encoded_file,
    help="Optional requirements.txt file that contains your external libraries.",
)
advanced.add_argument(
    "--login",
    action="store_true",
    default=False,
    help="Launch an interactive session to authenticate your user.\nOnce completed your credentials will be stored and automatically refreshed for quite a long time.\nOnce those expires you will be prompted to perform another login.",
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
parser.add_argument(
    "--extra-files",
    nargs="*",
    type=valid_extra_files_path,
    help="A list of extra files or directories to upload. Space-separated, e.g. --extra-files testdata.csv *.py my-directory/",
)

parsed_args: tuple[Namespace, list[str]] = parser.parse_known_args()
options, locust_options = parsed_args

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
                    "Running with --non-interactive requires that LOCUSTCLOUD_USERNAME, LOCUSTCLOUD_PASSWORD and LOCUSTCLOUD_REGION environment variables are set."
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
        #       to change your password.
        #       Now that we have a web based login flow we should force them to
        #       do a locust-cloud --login if we get that.

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


class SessionMismatchError(Exception):
    pass


class WebsocketTimeout(Exception):
    pass


class Websocket:
    def __init__(self) -> None:
        """
        This class was created to encapsulate all the logic involved in the websocket implementation.
        The behaviour of the socketio client once a connection has been established
        is to try to reconnect forever if the connection is lost.
        The way this can be canceled is by setting the _reconnect_abort (threading.Event) on the client
        in which case it will simply proceed with shutting down without giving any indication of an error.
        This class handles timeouts for connection attempts as well as some logic around when the
        socket can be shut down. See descriptions on the methods for further details.
        """
        self.__shutdown_allowed = threading.Event()
        self.__timeout_on_disconnect = True
        self.initial_connect_timeout = 120
        self.reconnect_timeout = 10
        self.wait_timeout = 0
        self.exception: None | Exception = None

        self.sio = socketio.Client(handle_sigint=False)
        self.sio._reconnect_abort = threading.Event()
        # The _reconnect_abort value on the socketio client will be populated with a newly created threading.Event if it's not already set.
        # There is no way to set this by passing it in the constructor.
        # This event is the only way to interupt the retry logic when the connection is attempted.

        self.sio.on("connect", self.__on_connect)
        self.sio.on("disconnect", self.__on_disconnect)
        self.sio.on("connect_error", self.__on_connect_error)
        self.sio.on("events", self.__on_events)

        self.__processed_events: set[int] = set()

    def __set_connection_timeout(self, timeout) -> None:
        """
        Start a threading.Timer that will set the threading.Event on the socketio client
        that aborts any further attempts to reconnect, sets an exception on the websocket
        that will be raised from the wait method and the threading.Event __shutdown_allowed
        on the websocket that tells the wait method that it should stop blocking.
        """

        def _timeout():
            logger.debug(f"Websocket connection timed out after {timeout} seconds")
            self.sio._reconnect_abort.set()
            self.exception = WebsocketTimeout("Timed out connecting to locust master")
            self.__shutdown_allowed.set()

        self.__connect_timeout_timer = threading.Timer(timeout, _timeout)
        self.__connect_timeout_timer.daemon = True
        logger.debug(f"Setting websocket connection timeout to {timeout} seconds")
        self.__connect_timeout_timer.start()

    def connect(self, url, *, auth) -> None:
        """
        Send along retry=True when initiating the socketio client connection
        to make it use it's builtin logic for retrying failed connections that
        is usually used for reconnections. This will retry forever.
        When connecting start a timer to trigger disabling the retry logic and
        raise a WebsocketTimeout exception.
        """
        ws_connection_info = urllib.parse.urlparse(url)
        self.__set_connection_timeout(self.initial_connect_timeout)
        try:
            self.sio.connect(
                f"{ws_connection_info.scheme}://{ws_connection_info.netloc}",
                auth=auth,
                retry=True,
                **{"socketio_path": ws_connection_info.path} if ws_connection_info.path else {},
            )
        except socketio.exceptions.ConnectionError:
            if self.exception:
                raise self.exception

            raise

    def shutdown(self) -> None:
        """
        When shutting down the socketio client a disconnect event will fire.
        Before doing so disable the behaviour of starting a threading.Timer
        to handle timeouts on attempts to reconnect since no further such attempts
        will be made.
        If such a timer is already running, cancel it since the client is being shutdown.
        """
        self.__timeout_on_disconnect = False
        if hasattr(self, "__connect_timeout_timer"):
            self.__connect_timeout_timer.cancel()
        self.sio.shutdown()

    def wait(self, timeout=False) -> bool:
        """
        Block until the threading.Event __shutdown_allowed is set, with a timeout if indicated.
        If an exception has been set on the websocket (from a connection timeout timer or the
        __on_connect_error method), raise it.
        """
        timeout = self.wait_timeout if timeout else None
        logger.debug(f"Waiting for shutdown for {str(timeout)+'s' if timeout else 'ever'}")
        res = self.__shutdown_allowed.wait(timeout)
        if self.exception:
            raise self.exception
        return res

    def __on_connect(self) -> None:
        """
        This gets events whenever a connection is successfully established.
        When this happens, cancel the running threading.Timer that would
        abort reconnect attempts and raise a WebsocketTimeout exception.
        The wait_timeout is originally set to zero when creating the websocket
        but once a connection has been established this is raised to ensure
        that the server is given the chance to send all the logs and an
        official shutdown event.
        """
        self.__connect_timeout_timer.cancel()
        self.wait_timeout = 90
        logger.debug("Websocket connected")

    def __on_disconnect(self) -> None:
        """
        This gets events whenever a connection is lost.
        The socketio client will try to reconnect forever so,
        unless the behaviour has been disabled, a threading.Timer
        is started that will abort reconnect attempts and raise a
        WebsocketTimeout exception.
        """
        if self.__timeout_on_disconnect:
            self.__set_connection_timeout(self.reconnect_timeout)
        logger.debug("Websocket disconnected")

    def __on_events(self, data):
        """
        This gets events explicitly sent by the websocket server.
        This will either be messages to print on stdout/stderr or
        an indication that the CLI can shut down in which case the
        threading.Event __shutdown_allowed gets set on the websocket
        that tells the wait method that it should stop blocking.
        """
        shutdown = False
        shutdown_message = ""

        if data["id"] in self.__processed_events:
            logger.debug(f"Got duplicate data on websocket, id {data['id']}")
            return

        self.__processed_events.add(data["id"])

        for event in data["events"]:
            type = event["type"]

            if type == "shutdown":
                shutdown = True
                shutdown_message = event["message"]
            elif type == "stdout":
                sys.stdout.write(event["message"])
            elif type == "stderr":
                sys.stderr.write(event["message"])
            else:
                raise Exception("Unexpected event type")

        if shutdown:
            logger.debug("Got shutdown from locust master")
            if shutdown_message:
                print(shutdown_message)

            self.__shutdown_allowed.set()

    def __on_connect_error(self, data) -> None:
        """
        This gets events whenever there's an error during connection attempts.
        The specific case that is handled below is triggered when the connection
        is made with the auth parameter not matching the session ID on the server.
        If this error occurs it's because the connection is attempted towards an
        instance of locust not started by this CLI.

        In that case:
        Cancel the running threading.Timer that would abort reconnect attempts
        and raise a WebsocketTimeout exception.
        Set an exception on the websocket that will be raised from the wait method.
        Cancel further reconnect attempts.
        Set the threading.Event __shutdown_allowed on the websocket that tells the
        wait method that it should stop blocking.
        """
        # Do nothing if it's not the specific case we know how to deal with
        if not (isinstance(data, dict) and data.get("message") == "Session mismatch"):
            return

        self.__connect_timeout_timer.cancel()
        self.exception = SessionMismatchError(
            "The session from this run of locust-cloud did not match the one on the server"
        )
        self.sio._reconnect_abort.set()
        self.__shutdown_allowed.set()


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
            payload["extra_files"] = transfer_encoded_extra_files(options.extra_files)

        try:
            response = session.post("/deploy", json=payload)
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to deploy the load generators: {e}")
            sys.exit(1)

        if response.status_code != 200:
            try:
                logger.error(f"{response.json()['Message']} (HTTP {response.status_code}/{response.reason})")
            except Exception:
                logger.error(
                    f"HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
                )
            sys.exit(1)

        log_ws_url = response.json()["log_ws_url"]
        session_id = response.json()["session_id"]
        logger.debug(f"Session ID is {session_id}")

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
            logger.debug(response.json()["message"])
        else:
            logger.info(
                f"Could not automatically tear down Locust Cloud: HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
            )
    except Exception as e:
        logger.error(f"Could not automatically tear down Locust Cloud: {e.__class__.__name__}:{e}")


if __name__ == "__main__":
    main()
