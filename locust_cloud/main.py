import requests
import sys
import logging
import configargparse
from collections import OrderedDict
from kubernetes_client.main import get_kubernetes_client
from kubernetes import watch

LAMBDA = "https://alpha.getlocust.com"
DEFAULT_CLUSTER_NAME = "locust"
DEFAULT_REGION_NAME = "eu-north-1"

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib


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

Example: locust-cloud -f locust.py --aws-public-key 123 --aws-secret-key 456""",
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
    "--aws-public-key",
    type=str,
    help="Authentication for deploying with Locust Cloud",
    env_var="AWS_PUBLIC_KEY",
)
parser.add_argument(
    "--aws-secret-key",
    type=str,
    help="Authentication for deploying with Locust Cloud",
    env_var="AWS_SECRET_KEY",
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
parser.add_argument(
    "--loglevel",
    "-L",
    type=str,
    help="Use DEBUG for tracing issues with load gens etc",
)

options, locust_options = parser.parse_known_args()


def main():
    if options.loglevel:
        logging.getLogger().setLevel(options.loglevel.upper())
        locust_options.append("-L")
        locust_options.append(options.loglevel)

    if not options.aws_public_key or not options.aws_secret_key:
        sys.stderr.write(
            "aws-public-key and aws-secret-key need to be set to use Locust Cloud\n"
        )
        sys.exit(1)

    locustfile = options.locustfile or "locustfile.py"

    deploy(
        options.aws_public_key,
        options.aws_secret_key,
        region_name=options.aws_region_name,
        cluster_name=options.kube_cluster_name,
        namespace=options.kube_namespace,
    )
    try:
        stream_pod_logs(
            options.aws_public_key,
            options.aws_secret_key,
            region_name=options.aws_region_name,
            cluster_name=options.kube_cluster_name,
            namespace=options.kube_namespace,
        )
    except KeyboardInterrupt:
        pass

    try:
        teardown(
            options.aws_public_key,
            options.aws_secret_key,
            region_name=options.aws_region_name,
            cluster_name=options.kube_namespace,
            namespace=options.kube_namespace,
        )
    except Exception:
        logging.error("Could not tear down locust cloud")


def stream_pod_logs(
    aws_public_key,
    aws_secret_key,
    region_name=DEFAULT_REGION_NAME,
    cluster_name=DEFAULT_CLUSTER_NAME,
    namespace="default",
):
    kubernetes_client = get_kubernetes_client(
        cluster_name,
        region_name=region_name,
        aws_access_key_id=aws_public_key,
        aws_secret_access_key=aws_secret_key,
    )

    v1 = kubernetes_client.CoreV1Api()

    pods = [
        pod.metadata.name for pod in v1.list_namespaced_pod(namespace="default").items
    ]

    w = watch.Watch()

    try:
        for pod in pods:
            for log in w.stream(
                v1.read_namespaced_pod_log, name=pod, namespace="default"
            ):
                print(log)
    except Exception:
        w.stop()


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
