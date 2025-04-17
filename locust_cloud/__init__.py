from locust import events
from locust_cloud.args import cloud_parser
from locust_cloud.cloud import main

__all__ = ["main"]


@events.init_command_line_parser.add_listener
def _(parser):
    cloud_group = parser.add_argument_group(
        "Locust Cloud",
        """Launches a distributed Locust run on locust.cloud infrastructure.

Example: locust --cloud -f my_locustfile.py --users 1000 ...""",
    )

    # This arguments is defined here because only makes sense when
    # running from locust core
    cloud_group.add_argument(
        "--cloud",
        action="store_true",
        help="Run Locust in cloud mode.",
    )

    for action in cloud_parser._actions:
        cloud_group._add_action(action)
