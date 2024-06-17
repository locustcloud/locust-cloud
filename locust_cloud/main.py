import requests
import sys
import logging
import configargparse
import tomllib
import boto3
import json
import time
import datetime
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
    if not options.aws_public_key or not options.aws_secret_key:
        sys.stderr.write(
            "aws-public-key and aws-secret-key need to be set to use Locust Cloud\n"
        )
        sys.exit(1)

    locustfile = options.locustfile or "locustfile.py"

    try:
        session = boto3.session.Session(
            region_name=options.aws_region_name,
            aws_access_key_id=options.aws_public_key,
            aws_secret_access_key=options.aws_secret_key,
        )

        upload_locustfile(
            session,
            locustfile,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )
        deploy(
            options.aws_public_key,
            options.aws_secret_key,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )
        stream_pod_logs(
            session,
            region_name=options.aws_region_name,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )
    except KeyboardInterrupt:
        pass
    except Exception:
        sys.stderr.write(
            "An unkown error occured during deployment. Please contact an administrator\n"
        )
        sys.exit(1)

    try:
        teardown(
            options.aws_public_key,
            options.aws_secret_key,
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
    aws_public_key,
    aws_secret_key,
    region_name=None,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    logging.info("Your request for deployment has been submitted, please wait...")
    response = requests.post(
        f"{LAMBDA}/{cluster_name}",
        headers={"AWS_PUBLIC_KEY": aws_public_key, "AWS_SECRET_KEY": aws_secret_key},
        params={"region_name": region_name, "namespace": namespace},
    )

    if response.status_code != 200:
        if response.json().get("Message"):
            sys.stderr.write(f"{response.json().get('Message')}\n")
        else:
            sys.stderr.write(
                "An unkown error occured during deployment. Please contact an administrator\n"
            )

        sys.exit(1)

    logging.info("Locust cloud is ready!")


def stream_pod_logs(
    session,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    logging.info("Fetching logs from cluster...")

    client = session.client("logs")
    log_group_name = f"/eks/{cluster_name}-{namespace}"
    # read logs from master
    query = "field @message | filter @logStream like /master/ | sort @timestamp desc"

    start_query_response = None
    while start_query_response is None:
        try:
            start_query_response = client.start_query(
                logGroupName=log_group_name,
                startTime=int(
                    (
                        datetime.datetime.now() - datetime.timedelta(minutes=5)
                    ).timestamp()
                ),
                endTime=int(datetime.datetime.now().timestamp()),
                queryString=query,
            )
        except ClientError:
            # logs are not ready yet
            time.sleep(1)

    query_id = start_query_response["queryId"]

    while True:
        time.sleep(1)
        query_result = []

        response = client.get_query_results(queryId=query_id)
        if response:
            query_result = response.get("results", [])

        for result in query_result:
            for field in result:
                if field["field"] == "@message":
                    try:
                        log = json.loads(field["value"])["log"]
                    except json.JSONDecodeError:
                        log = field["value"]

                    print(log)


def teardown(
    aws_public_key,
    aws_secret_key,
    region_name=None,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    logging.info("Tearing down Locust cloud...")

    requests.delete(
        f"{LAMBDA}/{cluster_name}",
        headers={"AWS_PUBLIC_KEY": aws_public_key, "AWS_SECRET_KEY": aws_secret_key},
        params={"region_name": region_name, "namespace": namespace},
    )
