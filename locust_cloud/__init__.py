from locust_cloud.auth import register_auth
from locust_cloud.timescale.exporter import Timescale

import os

from locust import events
from locust.argument_parser import LocustArgumentParser

PG_USER = os.environ.get("PG_USER")
PG_HOST = os.environ.get("PG_HOST")
PG_PASSWORD = os.environ.get("PG_PASSWORD")
PG_DATABASE = os.environ.get("PG_DATABASE")
PG_PORT = os.environ.get("PG_PORT", 5432)


@events.init_command_line_parser.add_listener
def add_arguments(parser: LocustArgumentParser):
    locust_cloud = parser.add_argument_group(
        "locust-cloud",
        "Arguments for use with Locust cloud!",
    )

    locust_cloud.add_argument(
        "--exporter",
        default=True,
        action="store_true",
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
def on_locust_init(environment, **args):
    os.environ["LOCUST_BUILD_PATH"] = os.path.join(os.path.dirname(__file__), "webui/dist")

    if environment.parsed_options.exporter:
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
