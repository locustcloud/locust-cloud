import json
import logging
import os
import sys
import time
import tomllib
from collections import OrderedDict
from datetime import datetime, timedelta

import boto3
import configargparse
import requests
from botocore.exceptions import ClientError

LAMBDA = "https://deployer.locust.cloud/1"
DEFAULT_CLUSTER_NAME = "locust"
DEFAULT_REGION_NAME = "eu-north-1"


class LocustTomlConfigParser(configargparse.TomlConfigParser):
    def parse(self, stream):
        try:
            config = tomllib.loads(stream.read())
        except Exception as e:
            raise configargparse.ConfigFileParserException(f"Couldn't parse TOML file: {e}")

        # convert to dict and filter based on section names
        result = OrderedDict()

        for section in self.sections:
            data = configargparse.get_toml_section(config, section)
            if data:
                for key, value in data.items():
                    if isinstance(value, list):
                        result[key] = value
                    elif value is None:
                        pass
                    else:
                        result[key] = str(value)
                break

        return result


logging.basicConfig(
    format="[LOCUST-CLOUD] %(levelname)s: %(message)s",
    level=logging.INFO,
)

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
    description="""A tool for Locust Cloud users to deploy clusters.

Example: locust-cloud -f locust.py --aws-access-key-id 123 --aws-secret-access-key 456""",
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
    help="The Python file or module that contains your test, e.g. 'my_test.py'. Defaults to 'locustfile'.",
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
    "--aws-access-key-id",
    type=str,
    help="Authentication for deploying with Locust Cloud",
    env_var="AWS_ACCESS_KEY_ID",
)
parser.add_argument(
    "--aws-secret-access-key",
    type=str,
    help="Authentication for deploying with Locust Cloud",
    env_var="AWS_SECRET_ACCESS_KEY",
)
parser.add_argument(
    "--username",
    type=str,
    help="Authentication for deploying with Locust Cloud",
    env_var="LOCUST_CLOUD_USERNAME",
)
parser.add_argument(
    "--password",
    type=str,
    help="Authentication for deploying with Locust Cloud",
    env_var="LOCUST_CLOUD_PASSWORD",
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
    help="Sets the name of the kubernetes cluster",
    env_var="KUBE_CLUSTER_NAME",
)
parser.add_argument(
    "--kube-namespace",
    type=str,
    default="default",
    help="Sets the namespace for scoping the deployed cluster",
    env_var="KUBE_NAMESPACE",
)

options, locust_options = parser.parse_known_args()


def main():
    aws_access_key_id = options.aws_access_key_id
    aws_secret_access_key = options.aws_secret_access_key
    aws_session_token = None

    if not ((options.aws_access_key_id and options.aws_secret_access_key) or (options.username and options.password)):
        logging.error(
            "Authentication is required to use Locust Cloud. Ensure your username and password are provided, or provide an aws_access_key_id and aws_secret_access_key directly."
        )
        sys.exit(1)

    if options.username and options.password:
        if options.aws_access_key_id or options.aws_secret_access_key:
            logging.info("A username and password have been provided, the AWS keys will be ignored.")
        logging.info("Authenticating...")
        response = requests.post(
            f"{LAMBDA}/auth/login", json={"username": options.username, "password": options.password}
        )

        if response.status_code == 200:
            credentials = response.json()
            aws_access_key_id = credentials["aws_access_key_id"]
            aws_secret_access_key = credentials["aws_secret_access_key"]
            aws_session_token = credentials["aws_session_token"]
            cognito_client_id_token = credentials["cognito_client_id_token"]
        else:
            logging.error(
                f"HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
            )
            sys.exit(1)

    s3_bucket = f"{options.kube_cluster_name}-{options.kube_namespace}"

    try:
        session = boto3.session.Session(
            region_name=options.aws_region_name,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            aws_session_token=aws_session_token,
        )
        locustfile_url = upload_file(
            session,
            s3_bucket=s3_bucket,
            region_name=options.aws_region_name,
            filename=options.locustfile,
        )
        requirements_url = ""
        if options.requirements:
            requirements_url = upload_file(
                session,
                s3_bucket=s3_bucket,
                region_name=options.aws_region_name,
                filename=options.requirements,
                remote_filename="requirements.txt",
            )

        deployed_pods = deploy(
            aws_access_key_id,
            aws_secret_access_key,
            aws_session_token,
            cognito_client_id_token,
            locustfile_url,
            region_name=options.aws_region_name,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
            requirements=requirements_url,
        )
        stream_pod_logs(
            session,
            deployed_pods=deployed_pods,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )
    except KeyboardInterrupt:
        pass
    except Exception as e:
        logging.exception(e)
        sys.exit(1)

    try:
        logging.info("Tearing down Locust cloud...")
        teardown_cluster(
            aws_access_key_id,
            aws_secret_access_key,
            aws_session_token,
            cognito_client_id_token,
            region_name=options.aws_region_name,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )
        teardown_s3(
            session,
            s3_bucket=s3_bucket,
        )
    except Exception as e:
        logging.error(f"Could not automatically tear down Locust Cloud: {e}")
        sys.exit(1)


def upload_file(session, s3_bucket, region_name, filename, remote_filename=None):
    if not remote_filename:
        remote_filename = filename.split("/")[-1]

    logging.debug(f"Uploading {remote_filename}...")

    s3 = session.client("s3")

    try:
        s3.upload_file(filename, s3_bucket, remote_filename)

        presigned_url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": s3_bucket, "Key": remote_filename},
            ExpiresIn=3600,  # 1 hour
        )

        return presigned_url
    except FileNotFoundError:
        logging.error(f"Could not find '{filename}'")
        sys.exit(1)


def deploy(
    aws_access_key_id,
    aws_secret_access_key,
    aws_session_token,
    cognito_client_id_token,
    locustfile,
    region_name=None,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
    requirements="",
):
    logging.info("Deploying load generators...")
    locust_env_variables = [
        {"name": env_variable, "value": str(os.environ[env_variable])}
        for env_variable in os.environ
        if env_variable.startswith("LOCUST_")
    ]

    response = requests.post(
        f"{LAMBDA}/{cluster_name}",
        headers={
            "AWS_ACCESS_KEY_ID": aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": aws_secret_access_key,
            "AWS_SESSION_TOKEN": aws_session_token,
            "Authorization": f"Bearer {cognito_client_id_token}",
        },
        json={
            "locust_args": [
                {
                    "name": "LOCUST_LOCUSTFILE",
                    "value": locustfile,
                },
                {"name": "LOCUST_REQUIREMENTS_URL", "value": requirements},
                {"name": "LOCUST_FLAGS", "value": " ".join(locust_options)},
                *locust_env_variables,
            ]
        },
        params={"region_name": region_name, "namespace": namespace},
    )

    if response.status_code != 200:
        if response.json().get("message"):
            sys.stderr.write(f"{response.json().get('message')}\n")
        else:
            sys.stderr.write("An unkown error occured during deployment. Please contact an administrator\n")

        sys.exit(1)

    logging.info("Load generators deployed.")
    return response.json()["pods"]


def stream_pod_logs(
    session,
    deployed_pods,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    logging.info("Waiting for pods to be ready...")
    client = session.client("logs")

    log_group_name = f"/eks/{cluster_name}-{namespace}"
    master_pod_name = [pod_name for pod_name in deployed_pods if "master" in pod_name][0]

    log_stream = None
    while log_stream is None:
        try:
            response = client.describe_log_streams(
                logGroupName=log_group_name,
                logStreamNamePrefix=f"from-fluent-bit-kube.var.log.containers.{master_pod_name}",
            )
            all_streams = response.get("logStreams")
            if all_streams:
                log_stream = all_streams[0].get("logStreamName")
            else:
                time.sleep(1)
        except ClientError:
            # log group name does not exist yet
            time.sleep(1)
            continue

    logging.info("Pods are ready, switching to Locust logs.")

    timestamp = int((datetime.now() - timedelta(minutes=5)).timestamp())
    while True:
        response = client.get_log_events(
            logGroupName=log_group_name,
            logStreamName=log_stream,
            startTime=timestamp,
            startFromHead=True,
        )

        for event in response["events"]:
            message = event["message"]
            timestamp = event["timestamp"] + 1

            try:
                message = json.loads(message)
                if "log" in message:
                    print(message["log"])
            except json.JSONDecodeError:
                pass

        time.sleep(5)


def teardown_cluster(
    aws_access_key_id,
    aws_secret_access_key,
    aws_session_token,
    cognito_client_id_token,
    region_name=None,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    response = requests.delete(
        f"{LAMBDA}/{cluster_name}",
        headers={
            "AWS_ACCESS_KEY_ID": aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": aws_secret_access_key,
            "AWS_SESSION_TOKEN": aws_session_token,
            "Authorization": f"Bearer {cognito_client_id_token}",
        },
        params={"region_name": region_name, "namespace": namespace},
    )

    if response.status_code != 200:
        logging.error(
            f"HTTP {response.status_code}/{response.reason} - Response: {response.text} - URL: {response.request.url}"
        )
        sys.exit(1)


def teardown_s3(session, s3_bucket):
    s3 = session.resource("s3")
    bucket = s3.Bucket(s3_bucket)
    bucket.objects.delete()
