from locust_cloud.influxdb.exporter import Timescale

from locust import events
from locust.argument_parser import LocustArgumentParser


@events.init_command_line_parser.add_listener
def add_arguments(parser: LocustArgumentParser):
    locust_cloud = parser.add_argument_group(
        "locust-cloud",
        "Arguments for use with Locust cloud!",
    )

    locust_cloud.add_argument(
        "--exporter",
        default=False,
        action="store_true",
        env_var="LOCUST_EXPORTER",
        help="Exports Locust stats to Influx",
    )


@events.init.add_listener
def on_locust_init(environment, **args):
    if environment.parsed_options.exporter:
        Timescale(environment)
