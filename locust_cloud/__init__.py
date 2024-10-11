import os

os.environ["LOCUST_SKIP_MONKEY_PATCH"] = "1"

import argparse
import logging
import sys

import locust.env
import psycopg
from locust import events
from locust.argument_parser import LocustArgumentParser
from locust_cloud.auth import register_auth
from locust_cloud.timescale.exporter import Exporter
from locust_cloud.timescale.query import register_query
from psycopg_pool import ConnectionPool

PG_USER = os.environ.get("PG_USER")
PG_HOST = os.environ.get("PG_HOST")
PG_PASSWORD = os.environ.get("PG_PASSWORD")
PG_DATABASE = os.environ.get("PG_DATABASE")
PG_PORT = os.environ.get("PG_PORT", 5432)
GRAPH_VIEWER = os.environ.get("GRAPH_VIEWER")
MAX_USER_COUNT = os.environ.get("MAX_USER_COUNT")
logger = logging.getLogger(__name__)


@events.init_command_line_parser.add_listener
def add_arguments(parser: LocustArgumentParser):
    if not (PG_HOST or GRAPH_VIEWER):
        parser.add_argument_group(
            "locust-cloud",
            "locust-cloud disabled, because PG_HOST was not set - this is normal for local runs",
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


def set_autocommit(conn: psycopg.Connection):
    conn.autocommit = True


def create_connection_pool(
    pg_user: str, pg_host: str, pg_password: str, pg_database: str, pg_port: str | int
) -> ConnectionPool:
    try:
        return ConnectionPool(
            conninfo=f"postgres://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}?sslmode=require",
            min_size=1,
            max_size=10,
            configure=set_autocommit,
        )
    except Exception:
        sys.stderr.write(f"Could not connect to postgres ({pg_user}@{pg_host}:{pg_port}).")
        sys.exit(1)


@events.init.add_listener
def on_locust_init(environment: locust.env.Environment, **_args):
    if not (PG_HOST and PG_USER and PG_PASSWORD and PG_DATABASE and PG_PORT):
        return

    try:
        pool = create_connection_pool(
            pg_user=PG_USER,
            pg_host=PG_HOST,
            pg_password=PG_PASSWORD,
            pg_database=PG_DATABASE,
            pg_port=PG_PORT,
        )
        pool.wait()
    except Exception as e:
        logger.exception(e)
        logger.error(f"{PG_HOST=}")
        raise

    if not GRAPH_VIEWER and environment.parsed_options and environment.parsed_options.exporter:
        Exporter(environment, pool)

    if environment.web_ui:
        environment.web_ui.template_args["maxUserCount"] = MAX_USER_COUNT

        if GRAPH_VIEWER:
            environment.web_ui.template_args["isGraphViewer"] = True

        register_auth(environment)
        register_query(environment, pool)
