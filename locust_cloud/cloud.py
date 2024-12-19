import base64
import gzip
import logging
import os
import sys
import threading
import tomllib
import urllib.parse
from argparse import Namespace
from collections import OrderedDict
from typing import IO, Any

import configargparse
import requests
import socketio
import socketio.exceptions
from locust_cloud import __version__
from locust_cloud.credential_manager import CredentialError, CredentialManager


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
    formatter_class=configargparse.RawDescriptionHelpFormatter,
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
    "--region",
    type=str,
    default=os.environ.get("AWS_DEFAULT_REGION"),
    help="Sets the AWS region to use for the deployed cluster, e.g. us-east-1. It defaults to use AWS_DEFAULT_REGION env var, like AWS tools.",
)
parser.add_argument(
    "--aws-access-key-id",
    type=str,
    help=configargparse.SUPPRESS,
    env_var="AWS_ACCESS_KEY_ID",
    default=None,
)
parser.add_argument(
    "--aws-secret-access-key",
    type=str,
    help=configargparse.SUPPRESS,
    env_var="AWS_SECRET_ACCESS_KEY",
    default=None,
)
parser.add_argument(
    "--username",
    type=str,
    help=configargparse.SUPPRESS,
    default=os.getenv("LOCUST_CLOUD_USERNAME", None),  # backwards compatitibility for dmdb
)
parser.add_argument(
    "--password",
    type=str,
    help=configargparse.SUPPRESS,
    default=os.getenv("LOCUST_CLOUD_PASSWORD", None),  # backwards compatitibility for dmdb
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
    default="latest",
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
logging.getLogger("botocore").setLevel(logging.INFO)
logging.getLogger("boto3").setLevel(logging.INFO)
logging.getLogger("requests").setLevel(logging.INFO)
logging.getLogger("urllib3").setLevel(logging.INFO)


api_url = os.environ.get("LOCUSTCLOUD_DEPLOYER_URL", f"https://api.{options.region}.locust.cloud/1")


def main() -> None:
    if options.version:
        print(f"locust-cloud version {__version__}")
        sys.exit(0)

    if not options.region:
        logger.error(
            "Setting a region is required to use Locust Cloud. Please ensure the AWS_DEFAULT_REGION env variable or the --region flag is set."
        )
        sys.exit(1)
    if options.region:
        os.environ["AWS_DEFAULT_REGION"] = options.region

    if not ((options.username and options.password) or (options.aws_access_key_id and options.aws_secret_access_key)):
        logger.error(
            "Authentication is required to use Locust Cloud. Please ensure the LOCUSTCLOUD_USERNAME and LOCUSTCLOUD_PASSWORD environment variables are set."
        )
        sys.exit(1)
    if not options.locustfile:
        logger.error("A locustfile is required to run a test.")
        sys.exit(1)

    try:
        logger.info(f"Authenticating ({options.region}, v{__version__})")
        logger.debug(f"Lambda url: {api_url}")
        credential_manager = CredentialManager(
            lambda_url=api_url,
            access_key=options.aws_access_key_id,
            secret_key=options.aws_secret_access_key,
            username=options.username,
            password=options.password,
        )

        credentials = credential_manager.get_current_credentials()
        cognito_client_id_token = credentials["cognito_client_id_token"]
        aws_access_key_id = credentials.get("access_key")
        aws_secret_access_key = credentials.get("secret_key")
        aws_session_token = credentials.get("token", "")

        if options.delete:
            delete(credential_manager)
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
            {"name": env_variable, "value": str(os.environ[env_variable])}
            for env_variable in os.environ
            if env_variable.startswith("LOCUST_")
            and not env_variable
            in [
                "LOCUST_LOCUSTFILE",
                "LOCUST_USERS",
                "LOCUST_WEB_HOST_DISPLAY_NAME",
                "LOCUST_SKIP_MONKEY_PATCH",
            ]
            and os.environ[env_variable]
        ]
        deploy_endpoint = f"{api_url}/deploy"
        payload = {
            "locust_args": [
                {"name": "LOCUST_USERS", "value": str(options.users)},
                {"name": "LOCUST_FLAGS", "value": " ".join(locust_options)},
                {"name": "LOCUSTCLOUD_DEPLOYER_URL", "value": api_url},
                {"name": "LOCUSTCLOUD_PROFILE", "value": options.profile},
                *locust_env_variables,
            ],
            "locustfile": {"filename": options.locustfile, "data": locustfile_data},
            "user_count": options.users,
            "image_tag": options.image_tag,
            "mock_server": options.mock_server,
        }
        if options.workers is not None:
            payload["worker_count"] = options.workers
        if options.requirements:
            payload["requirements"] = {"filename": options.requirements, "data": requirements_data}
        headers = {
            "Authorization": f"Bearer {cognito_client_id_token}",
            "Content-Type": "application/json",
            "AWS_ACCESS_KEY_ID": aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": aws_secret_access_key,
            "AWS_SESSION_TOKEN": aws_session_token,
            "X-Client-Version": __version__,
        }
        try:
            # logger.info(payload) # might be useful when debugging sometimes
            response = requests.post(deploy_endpoint, json=payload, headers=headers)
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
    except CredentialError as ce:
        logger.error(f"Credential error: {ce}")
        sys.exit(1)
    except KeyboardInterrupt:
        logger.debug("Interrupted by user")
        sys.exit(0)

    logger.debug("Load generators deployed successfully!")
    logger.info("Waiting for pods to be ready...")

    shutdown_allowed = threading.Event()
    shutdown_allowed.set()
    reconnect_aborted = threading.Event()
    connect_timeout = threading.Timer(2 * 60, reconnect_aborted.set)

    try:
        ws_connection_info = urllib.parse.urlparse(log_ws_url)
        sio = socketio.Client(handle_sigint=False)

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
        delete(credential_manager)
        shutdown_allowed.wait(timeout=90)
    except Exception as e:
        logger.exception(e)
        delete(credential_manager)
        sys.exit(1)
    else:
        delete(credential_manager)
    finally:
        sio.shutdown()


def delete(credential_manager):
    try:
        logger.info("Tearing down Locust cloud...")
        credential_manager.refresh_credentials()
        refreshed_credentials = credential_manager.get_current_credentials()

        headers = {
            "AWS_ACCESS_KEY_ID": refreshed_credentials.get("access_key", ""),
            "AWS_SECRET_ACCESS_KEY": refreshed_credentials.get("secret_key", ""),
            "Authorization": f"Bearer {refreshed_credentials.get('cognito_client_id_token', '')}",
            "X-Client-Version": __version__,
        }

        token = refreshed_credentials.get("token")
        if token:
            headers["AWS_SESSION_TOKEN"] = token

        response = requests.delete(
            f"{api_url}/teardown",
            headers=headers,
        )

        if response.status_code == 200:
            logger.debug(response.json()["message"])
        else:
            logger.info(
                f"Could not automatically tear down Locust Cloud: HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
            )
    except Exception as e:
        logger.error(f"Could not automatically tear down Locust Cloud: {e.__class__.__name__}:{e}")

    logger.info("Done! ✨")


if __name__ == "__main__":
    main()
