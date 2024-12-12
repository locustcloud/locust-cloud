import importlib.metadata
import os
import sys

os.environ["LOCUST_SKIP_MONKEY_PATCH"] = "1"

from locust_cloud.socket_logging import setup_socket_logging

if os.environ.get("LOCUST_MODE_MASTER") == "1":
    major, minor, *rest = os.environ["LOCUSTCLOUD_CLIENT_VERSION"].split(".")

    if int(major) > 1 or int(major) == 1 and int(minor) >= 12:
        setup_socket_logging()

__version__ = importlib.metadata.version("locust-cloud")

import logging

import configargparse
import locust.env
import psycopg
from locust import events
from locust.argument_parser import LocustArgumentParser
from locust_cloud.auth import register_auth
from locust_cloud.idle_exit import IdleExit
from locust_cloud.timescale.exporter import Exporter
from locust_cloud.timescale.query import register_query
from psycopg.conninfo import make_conninfo
from psycopg_pool import ConnectionPool

logger = logging.getLogger(__name__)


@events.init_command_line_parser.add_listener
def add_arguments(parser: LocustArgumentParser):
    if not (os.environ.get("PGHOST")):
        parser.add_argument_group(
            "locust-cloud",
            "locust-cloud disabled, because PGHOST was not set - this is normal for local runs",
        )
        return

    try:
        REGION = os.environ["AWS_DEFAULT_REGION"]
    except KeyError:
        logger.fatal("Missing AWS_DEFAULT_REGION env var")
        sys.exit(1)

    os.environ["LOCUST_BUILD_PATH"] = os.path.join(os.path.dirname(__file__), "webui/dist")
    locust_cloud = parser.add_argument_group(
        "locust-cloud",
        "Arguments for use with Locust cloud",
    )
    # do not set
    # used for sending the run id from master to workers
    locust_cloud.add_argument(
        "--run-id",
        type=str,
        env_var="LOCUSTCLOUD_RUN_ID",
        help=configargparse.SUPPRESS,
    )
    locust_cloud.add_argument(
        "--allow-signup",
        env_var="LOCUSTCLOUD_ALLOW_SIGNUP",
        help=configargparse.SUPPRESS,
        default=False,
        action="store_true",
    )
    locust_cloud.add_argument(
        "--allow-forgot-password",
        env_var="LOCUSTCLOUD_FORGOT_PASSWORD",
        help=configargparse.SUPPRESS,
        default=False,
        action="store_true",
    )
    locust_cloud.add_argument(
        "--graph-viewer",
        env_var="LOCUSTCLOUD_GRAPH_VIEWER",
        help=configargparse.SUPPRESS,
        default=False,
        action="store_true",
    )
    locust_cloud.add_argument(
        "--deployer-url",
        type=str,
        env_var="LOCUSTCLOUD_DEPLOYER_URL",
        help=configargparse.SUPPRESS,
        default=f"https://api.{REGION}.locust.cloud/1",
    )
    locust_cloud.add_argument(
        "--profile",
        type=str,
        env_var="LOCUSTCLOUD_PROFILE",
        help=configargparse.SUPPRESS,
        default=None,
    )


def set_autocommit(conn: psycopg.Connection):
    conn.autocommit = True


@events.init.add_listener
def on_locust_init(environment: locust.env.Environment, **_args):
    if not (os.environ.get("PGHOST")):
        return

    conninfo = make_conninfo(
        sslmode="require",
    )
    pool = ConnectionPool(
        conninfo,
        min_size=1,
        max_size=20,
        configure=set_autocommit,
        check=ConnectionPool.check_connection,
    )
    pool.wait(timeout=10)

    if not environment.parsed_options.graph_viewer:
        IdleExit(environment)
        Exporter(environment, pool)

    if environment.web_ui:
        environment.web_ui.template_args["locustVersion"] = locust.__version__
        environment.web_ui.template_args["locustCloudVersion"] = __version__
        environment.web_ui.template_args["webBasePath"] = environment.parsed_options.web_base_path

        if environment.parsed_options.graph_viewer:
            environment.web_ui.template_args["isGraphViewer"] = True

        register_auth(environment)
        register_query(environment, pool)
