import requests
import sys
import logging
import configargparse
import tomllib
import boto3
import time
import json
from datetime import datetime, timedelta
from botocore.exceptions import ClientError
from collections import OrderedDict

LAMBDA = "https://alpha.getlocust.com/1"
DEFAULT_CLUSTER_NAME = "locust"
DEFAULT_REGION_NAME = "eu-north-1"


class LocustTomlConfigParser(configargparse.TomlConfigParser):
    def parse(self, stream):
        try:
            config = tomllib.loads(stream.read())
        except Exception as e:
            raise configargparse.ConfigFileParserException(
                f"Couldn't parse TOML file: {e}"
            )

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
    format="[LOCUST-CLOUD] %(message)s",
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
    type=str,
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
    if not options.aws_access_key_id or not options.aws_secret_access_key:
        sys.stderr.write(
            "aws-access-key-id and aws-secret-access-key need to be set to use Locust Cloud\n"
        )
        sys.exit(1)

    locustfile = options.locustfile or "locustfile.py"

    try:
        session = boto3.session.Session(
            region_name=options.aws_region_name,
            aws_access_key_id=options.aws_access_key_id,
            aws_secret_access_key=options.aws_secret_access_key,
        )

        upload_locustfile(
            session,
            locustfile,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )
        deployed_pods = deploy(
            options.aws_access_key_id,
            options.aws_secret_access_key,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
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
        print(e)
        sys.stderr.write(
            "An unkown error occured during deployment. Please contact an administrator\n"
        )

    try:
        teardown(
            options.aws_access_key_id,
            options.aws_secret_access_key,
            region_name=options.aws_region_name,
            cluster_name=options.kube_namespace,
            namespace=options.kube_namespace,
        )
    except Exception:
        sys.stderr.write("Could not tear down Locust Cloud\n")
        sys.exit(1)


def upload_locustfile(session, locustfile, cluster_name, namespace):
    logging.info("Uploading your locustfile...")

    s3 = session.client("s3")
    s3_bucket = f"{cluster_name}-{namespace}"
    s3_file_name = "locustfile.py"

    try:
        s3.upload_file(locustfile, s3_bucket, s3_file_name)
    except FileNotFoundError:
        sys.stderr.write(f"Could not find '{locustfile}'\n")
        sys.exit(1)


def deploy(
    aws_access_key_id,
    aws_secret_access_key,
    region_name=None,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    logging.info("Your request for deployment has been submitted, please wait...")
    response = requests.post(
        f"{LAMBDA}/{cluster_name}",
        headers={
            "AWS_ACCESS_KEY_ID": aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": aws_secret_access_key,
        },
        params={"region_name": region_name, "namespace": namespace},
    )

    if response.status_code != 200:
        if response.json().get("message"):
            sys.stderr.write(f"{response.json().get('message')}\n")
        else:
            sys.stderr.write(
                "An unkown error occured during deployment. Please contact an administrator\n"
            )

        sys.exit(1)

    logging.info("Deployment created successfully!")
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
    master_pod_name = [pod_name for pod_name in deployed_pods if "master" in pod_name][
        0
    ]

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

    logging.info("Pods are ready! Logging will now switch to Cloudwatch")

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
                print(json.loads(message)["log"])
            except json.JSONDecodeError:
                print(message)

        time.sleep(5)


def teardown(
    aws_access_key_id,
    aws_secret_access_key,
    region_name=None,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    logging.info("Tearing down Locust cloud...")

    requests.delete(
        f"{LAMBDA}/{cluster_name}",
        headers={
            "AWS_ACCESS_KEY_ID": aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": aws_secret_access_key,
        },
        params={"region_name": region_name, "namespace": namespace},
    )
