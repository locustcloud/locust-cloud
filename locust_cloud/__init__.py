import os

os.environ["LOCUST_SKIP_MONKEY_PATCH"] = "1"

import argparse

from locust import events
from locust.argument_parser import LocustArgumentParser
from locust_cloud.auth import register_auth
from locust_cloud.timescale.exporter import Timescale

PG_USER = os.environ.get("PG_USER")
PG_HOST = os.environ.get("PG_HOST")
PG_PASSWORD = os.environ.get("PG_PASSWORD")
PG_DATABASE = os.environ.get("PG_DATABASE")
PG_PORT = os.environ.get("PG_PORT", 5432)
GRAPH_VIEWER = os.environ.get("GRAPH_VIEWER")


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


@events.init.add_listener
def on_locust_init(environment, **_args):
    if not (PG_HOST or GRAPH_VIEWER):
        return

    if not GRAPH_VIEWER and environment.parsed_options.exporter:
        Timescale(
            environment,
            pg_user=PG_USER,
            pg_host=PG_HOST,
            pg_password=PG_PASSWORD,
            pg_database=PG_DATABASE,
            pg_port=PG_PORT,
        )

    if environment.web_ui:
        register_auth(environment)
        environment.web_ui.template_args["api_base_url"] = os.environ.get("LOCUST_API_BASE_URL")
