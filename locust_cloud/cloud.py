import importlib.metadata
import json
import logging
import math
import os
import sys
import time
import tomllib
from collections import OrderedDict
from datetime import UTC, datetime, timedelta
from typing import IO, Any

import configargparse
import requests
from botocore.exceptions import ClientError
from locust_cloud.constants import (
    DEFAULT_CLUSTER_NAME,
    DEFAULT_LAMBDA_URL,
    DEFAULT_NAMESPACE,
    DEFAULT_REGION_NAME,
    USERS_PER_WORKER,
)
from locust_cloud.credential_manager import CredentialError, CredentialManager

LOCUST_ENV_VARIABLE_IGNORE_LIST = ["LOCUST_BUILD_PATH", "LOCUST_SKIP_MONKEY_PATCH"]
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
    auto_env_var_prefix="LOCUST_",
    formatter_class=configargparse.RawDescriptionHelpFormatter,
    config_file_parser_class=configargparse.CompositeConfigParser(
        [
            LocustTomlConfigParser(["tool.locust"]),
            configargparse.DefaultConfigFileParser,
        ]
    ),
    description="""Launches distributed Locust runs on locust.cloud infrastructure.

Example: locust-cloud -f my_locustfile.py --aws-region-name us-east-1 --users 1000""",
    epilog="""Any parameters not listed here are forwarded to locust master unmodified, so go ahead and use things like --users, --host, --run-time, ...
Locust config can also be set using config file (~/.locust.conf, locust.conf, pyproject.toml, ~/.cloud.conf or cloud.conf).
Parameters specified on command line override env vars, which in turn override config files.""",
    add_config_file_help=False,
    add_env_var_help=False,
)

parser.add_argument(
    "-f",
    "--locustfile",
    metavar="<filename>",
    default="locustfile.py",
    help="The Python file or module that contains your test, e.g. 'my_test.py'. Defaults to 'locustfile.py'.",
    env_var="LOCUST_LOCUSTFILE",
)
parser.add_argument(
    "-r",
    "--requirements",
    type=str,
    help="Optional requirements.txt file that contains your external libraries.",
    env_var="LOCUST_REQUIREMENTS",
)
parser.add_argument(
    "--aws-region-name",
    type=str,
    default=DEFAULT_REGION_NAME,
    help="Sets the region to use for the deployed cluster",
    env_var="AWS_REGION_NAME",
)
parser.add_argument(
    "--kube-cluster-name",
    type=str,
    default=DEFAULT_CLUSTER_NAME,
    help="Sets the name of the Kubernetes cluster",
    env_var="KUBE_CLUSTER_NAME",
)
parser.add_argument(
    "--kube-namespace",
    type=str,
    default=DEFAULT_NAMESPACE,
    help="Sets the namespace for scoping the deployed cluster",
    env_var="KUBE_NAMESPACE",
)
parser.add_argument(
    "--lambda-url",
    type=str,
    default=DEFAULT_LAMBDA_URL,
    help="Sets the namespace for scoping the deployed cluster",
    env_var="LOCUST_CLOUD_LAMBDA",
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
    help="Authentication for deploying with Locust Cloud",
    env_var="LOCUST_CLOUD_USERNAME",
    default=None,
)
parser.add_argument(
    "--password",
    type=str,
    help="Authentication for deploying with Locust Cloud",
    env_var="LOCUST_CLOUD_PASSWORD",
    default=None,
)
parser.add_argument(
    "--loglevel",
    "-L",
    type=str,
    help="Log level",
    env_var="LOCUST_CLOUD_LOGLEVEL",
    default="INFO",
)
parser.add_argument(
    "--workers",
    type=str,
    help="Number of workers to use for the deployment",
    env_var="LOCUST_CLOUD_WORKERS",
    default=None,
)

options, locust_options = parser.parse_known_args()
logging.basicConfig(
    format="[LOCUST-CLOUD] %(levelname)s: %(message)s",
    level=options.loglevel.upper(),
)
logger = logging.getLogger(__name__)
# Restore log level for other libs. Yes, this can be done more nicely
logging.getLogger("botocore").setLevel(logging.INFO)
logging.getLogger("boto3").setLevel(logging.INFO)
logging.getLogger("s3transfer").setLevel(logging.INFO)
logging.getLogger("requests").setLevel(logging.INFO)
logging.getLogger("urllib3").setLevel(logging.INFO)


def main() -> None:
    s3_bucket = f"{options.kube_cluster_name}-{options.kube_namespace}"
    deployed_pods: list[Any] = []
    worker_count = options.workers or math.ceil(locust_options.users / USERS_PER_WORKER)
    worker_count = worker_count if worker_count > 2 else 2

    try:
        if not (
            (options.username and options.password) or (options.aws_access_key_id and options.aws_secret_access_key)
        ):
            logger.error(
                "Authentication is required to use Locust Cloud. Please ensure the LOCUST_CLOUD_USERNAME and LOCUST_CLOUD_PASSWORD environment variables are set."
            )
            sys.exit(1)

        logger.info(f"Logging you into Locust Cloud ({options.aws_region_name}, v{__version__})")
        logger.debug(f"Lambda url: {options.lambda_url}")
        credential_manager = CredentialManager(
            lambda_url=options.lambda_url,
            access_key=options.aws_access_key_id,
            secret_key=options.aws_secret_access_key,
            username=options.username,
            password=options.password,
            region_name=options.aws_region_name,
        )

        credentials = credential_manager.get_current_credentials()
        cognito_client_id_token = credentials["cognito_client_id_token"]
        aws_access_key_id = credentials.get("access_key")
        aws_secret_access_key = credentials.get("secret_key")
        aws_session_token = credentials.get("token", "")

        logger.info(f"Uploading {options.locustfile}")
        s3 = credential_manager.session.client("s3")
        try:
            s3.upload_file(options.locustfile, s3_bucket, os.path.basename(options.locustfile))
            locustfile_url = s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": s3_bucket, "Key": os.path.basename(options.locustfile)},
                ExpiresIn=3600,
            )
            logger.debug(f"Uploaded {options.locustfile} successfully")
        except FileNotFoundError:
            logger.error(f"File not found: {options.locustfile}")
            sys.exit(1)
        except ClientError as e:
            logger.error(f"Failed to upload {options.locustfile}: {e}")
            sys.exit(1)

        requirements_url = ""
        if options.requirements:
            logger.info(f"Uploading {options.requirements}")
            try:
                s3.upload_file(options.requirements, s3_bucket, "requirements.txt")
                requirements_url = s3.generate_presigned_url(
                    ClientMethod="get_object",
                    Params={"Bucket": s3_bucket, "Key": "requirements.txt"},
                    ExpiresIn=3600,
                )
                logger.debug(f"Uploaded {options.requirements} successfully")
            except FileNotFoundError:
                logger.error(f"File not found: {options.requirements}")
                sys.exit(1)
            except ClientError as e:
                logger.error(f"Failed to upload {options.requirements}: {e}")
                sys.exit(1)

        logger.info("Deploying load generators")
        locust_env_variables = [
            {"name": env_variable, "value": str(os.environ[env_variable])}
            for env_variable in os.environ
            if env_variable.startswith("LOCUST_") and os.environ[env_variable]
        ]
        deploy_endpoint = f"{options.lambda_url}/{options.kube_cluster_name}"
        payload = {
            "locust_args": [
                {"name": "LOCUST_LOCUSTFILE", "value": locustfile_url},
                {"name": "LOCUST_REQUIREMENTS_URL", "value": requirements_url},
                {"name": "LOCUST_FLAGS", "value": " ".join(locust_options)},
                {"name": "LOCUST_WEB_HOST_DISPLAY_NAME", "value": "_____"},
                {"name": "LOCUST_API_BASE_URL", "value": DEFAULT_LAMBDA_URL},
                *locust_env_variables,
            ],
            "worker_count": worker_count,
        }
        headers = {
            "Authorization": f"Bearer {cognito_client_id_token}",
            "Content-Type": "application/json",
            "AWS_ACCESS_KEY_ID": aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": aws_secret_access_key,
            "AWS_SESSION_TOKEN": aws_session_token,
        }
        try:
            response = requests.post(deploy_endpoint, json=payload, headers=headers)
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to deploy the load generators: {e}")
            sys.exit(1)

        if response.status_code == 200:
            deployed_pods = response.json().get("pods", [])
        else:
            logger.error(
                f"HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
            )
            sys.exit(1)
    except CredentialError as ce:
        logger.error(f"Credential error: {ce}")
        sys.exit(1)

    log_group_name = f"/eks/{options.kube_cluster_name}-{options.kube_namespace}"
    master_pod_name = next((pod for pod in deployed_pods if "master" in pod), None)

    if not master_pod_name:
        logger.error(
            "Master pod not found among deployed pods. Something went wrong during the load generator deployment, please try again or contact an administrator for assistance"
        )
        sys.exit(1)

    logger.debug("Load generators deployed successfully!")

    try:
        logger.info("Waiting for pods to be ready...")

        log_stream: str | None = None
        while log_stream is None:
            try:
                client = credential_manager.session.client("logs")
                response = client.describe_log_streams(
                    logGroupName=log_group_name,
                    logStreamNamePrefix=f"from-fluent-bit-kube.var.log.containers.{master_pod_name}",
                )
                all_streams = response.get("logStreams", [])
                if all_streams:
                    log_stream = all_streams[0].get("logStreamName")
                else:
                    time.sleep(1)
            except ClientError as e:
                logger.error(f"Error describing log streams: {e}")
                time.sleep(5)
        logger.debug("Pods are ready, switching to Locust logs")

        timestamp = int((datetime.now(UTC) - timedelta(minutes=5)).timestamp() * 1000)

        while True:
            try:
                client = credential_manager.session.client("logs")
                response = client.get_log_events(
                    logGroupName=log_group_name,
                    logStreamName=log_stream,
                    startTime=timestamp,
                    startFromHead=True,
                )
                for event in response.get("events", []):
                    message = event.get("message", "")
                    event_timestamp = event.get("timestamp", timestamp) + 1
                    try:
                        message_json = json.loads(message)
                        if "log" in message_json:
                            print(message_json["log"])
                    except json.JSONDecodeError:
                        print(message)
                    timestamp = event_timestamp
                time.sleep(5)
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code == "ExpiredTokenException":
                    logger.debug("AWS session token expired during log streaming. Refreshing credentials.")
                    time.sleep(5)
    except KeyboardInterrupt:
        logger.debug("Interrupted by user")
    except Exception as e:
        logger.exception(e)
        sys.exit(1)
    finally:
        try:
            logger.info("Tearing down Locust cloud...")
            credential_manager.refresh_credentials()
            refreshed_credentials = credential_manager.get_current_credentials()

            headers = {
                "AWS_ACCESS_KEY_ID": refreshed_credentials.get("access_key", ""),
                "AWS_SECRET_ACCESS_KEY": refreshed_credentials.get("secret_key", ""),
                "Authorization": f"Bearer {refreshed_credentials.get('cognito_client_id_token', '')}",
            }

            token = refreshed_credentials.get("token")
            if token:
                headers["AWS_SESSION_TOKEN"] = token

            response = requests.delete(
                f"{options.lambda_url}/{options.kube_cluster_name}",
                headers=headers,
                params={"namespace": options.kube_namespace} if options.kube_namespace else {},
            )

            if response.status_code != 200:
                logger.error(
                    f"Could not automatically tear down Locust Cloud: HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
                )
        except Exception as e:
            logger.error(f"Could not automatically tear down Locust Cloud: {e}")

        try:
            logger.info("Cleaning up locust files")
            s3 = credential_manager.session.resource("s3")
            bucket = s3.Bucket(s3_bucket)
            bucket.objects.all().delete()
            logger.info("Done! ✨")
        except ClientError as e:
            logger.error(f"Failed to clean up locust files: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
