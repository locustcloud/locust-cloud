import requests
import sys
import logging
from locust.argument_parser import LocustArgumentParser
from locust import events

LAMBDA = "http://127.0.0.1:8000"
DEFAULT_CLUSTER_NAME = "locust"


@events.init_command_line_parser.add_listener
def add_arguments(parser: LocustArgumentParser):
    locust_cloud = parser.add_argument_group(
        "locust-cloud",
        "Arguments for members of Locust Cloud",
    )
    locust_cloud.add_argument(
        "--cloud",
        action="store_true",
        help="Deploys your Locust file to EKS",
        env_var="LOCUST_CLOUD_DEPLOY",
    )
    locust_cloud.add_argument(
        "--aws-public-key",
        type=str,
        help="Authentication for deploying with Locust Cloud",
        env_var="AWS_PUBLIC_KEY",
    )
    locust_cloud.add_argument(
        "--aws-secret-key",
        type=str,
        help="Authentication for deploying with Locust Cloud",
        env_var="AWS_SECRET_KEY",
    )
    locust_cloud.add_argument(
        "--aws-region-name",
        type=str,
        default=None,
        help="Sets the region to use for the deployed cluster",
        env_var="AWS_REGION_NAME",
    )
    locust_cloud.add_argument(
        "--kube-cluster-name",
        type=str,
        default=DEFAULT_CLUSTER_NAME,
        help="Sets the name of the kubernetes cluster",
        env_var="KUBE_CLUSTER_NAME",
    )
    locust_cloud.add_argument(
        "--kube-namespace",
        type=str,
        default=None,
        help="Sets the namespace for scoping the deployed cluster",
        env_var="KUBE_NAMESPACE",
    )


@events.init.add_listener
def on_locust_init(environment, **kwargs):
    options = environment.parsed_options

    if options.cloud:
        deploy(
            options.aws_public_key,
            options.aws_secret_key,
            region_name=options.aws_region_name,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )


@events.quitting.add_listener
def on_locust_quit(environment):
    options = environment.parsed_options

    if options.cloud:
        teardown(
            options.aws_public_key,
            options.aws_secret_key,
            region_name=options.aws_region_name,
            cluster_name=options.kube_namespace,
            namespace=options.kube_namespace,
        )


def deploy(
    aws_public_key,
    aws_secret_key,
    region_name=None,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace=None,
):
    if not aws_public_key or not aws_secret_key:
        sys.stderr.write(
            "aws-public-key and aws-secret-key need to be set to use Locust Cloud\n"
        )
        sys.exit(1)

    logging.info("Your request for deployment has been submitted, please wait...")
    print(cluster_name)
    response = requests.post(
        f"{LAMBDA}/{cluster_name}",
        headers={"AWS_PUBLIC_KEY": aws_public_key, "AWS_SECRET_KEY": aws_secret_key},
        params={"region_name": region_name, "namespace": namespace},
    )

    if response.status_code != 200:
        sys.stderr.write(f"{response.json().get('Message')}\n")
        sys.exit(1)

    logging.info("Locust cloud is ready!")


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
