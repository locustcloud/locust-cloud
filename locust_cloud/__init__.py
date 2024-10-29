import importlib.metadata
import os

os.environ["LOCUST_SKIP_MONKEY_PATCH"] = "1"
__version__ = importlib.metadata.version("locust-cloud")

import argparse
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

GRAPH_VIEWER = os.environ.get("GRAPH_VIEWER")
logger = logging.getLogger(__name__)


@events.init_command_line_parser.add_listener
def add_arguments(parser: LocustArgumentParser):
    if not (os.environ.get("PGHOST") or GRAPH_VIEWER):
        parser.add_argument_group(
            "locust-cloud",
            "locust-cloud disabled, because PGHOST was not set - this is normal for local runs",
        )
        return

    os.environ["LOCUST_BUILD_PATH"] = os.path.join(os.path.dirname(__file__), "webui/dist")
    locust_cloud = parser.add_argument_group(
        "locust-cloud",
        "Arguments for use with Locust cloud",
    )
    locust_cloud.add_argument(
        "--exporter",
        default=True,
        action=argparse.BooleanOptionalAction,
        env_var="LOCUST_EXPORTER",
        help="Exports Locust stats to Timescale",
    )
    locust_cloud.add_argument(
        "--description",
        type=str,
        env_var="LOCUST_DESCRIPTION",
        default="",
        help="Description of the test being run",
    )
    # do not set
    # used for sending the run id from master to workers
    locust_cloud.add_argument(
        "--run-id",
        type=str,
        env_var="LOCUSTCLOUD_RUN_ID",
        help=configargparse.SUPPRESS,
    )


def set_autocommit(conn: psycopg.Connection):
    conn.autocommit = True


@events.init.add_listener
def on_locust_init(environment: locust.env.Environment, **_args):
    if not (os.environ.get("PGHOST")):
        return

    try:
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
        pool.wait()
    except Exception as e:
        logger.exception(e)
        raise

    if not GRAPH_VIEWER:
        IdleExit(environment)

    if not GRAPH_VIEWER and environment.parsed_options and environment.parsed_options.exporter:
        Exporter(environment, pool)

    if environment.web_ui:
        if GRAPH_VIEWER:
            environment.web_ui.template_args["isGraphViewer"] = True

        register_auth(environment)
        register_query(environment, pool)
