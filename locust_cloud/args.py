import argparse
import base64
import gzip
import io
import os
import pathlib
import tomllib
from argparse import ArgumentTypeError, Namespace
from collections import OrderedDict
from collections.abc import Callable, Generator
from typing import IO, Any, cast
from zipfile import ZipFile

import configargparse

CWD = pathlib.Path.cwd()


class LocustTomlConfigParser(configargparse.TomlConfigParser):
    def parse(self, stream: IO[str]) -> OrderedDict[str, Any]:
        try:
            config = tomllib.loads(stream.read())
        except Exception as e:
            raise configargparse.ConfigFileParserException(f"Couldn't parse TOML file: {e}")

        result: OrderedDict[str, Any] = OrderedDict()

        for section in self.sections:
            data = configargparse.get_toml_section(config, section)
            if data:
                for key, value in data.items():
                    if isinstance(value, list):
                        result[key] = value
                    elif value is not None:
                        result[key] = str(value)
                break

        return result


def pipe(value: Any, *functions: Callable) -> Any:
    for function in functions:
        value = function(value)

    return value


def valid_extra_files_path(file_path: str) -> pathlib.Path:
    p = pathlib.Path(file_path).resolve()

    if not CWD in p.parents:
        raise ArgumentTypeError(f"Can only reference files under current working directory: {CWD}")
    if not p.exists():
        raise ArgumentTypeError(f"File not found: {file_path}")
    return p


def transfer_encode(file_name: str, stream: IO[bytes]) -> dict[str, str]:
    return {
        "filename": file_name,
        "data": pipe(
            stream.read(),
            gzip.compress,
            base64.b64encode,
            bytes.decode,
        ),
    }


def transfer_encoded_file(file_path: str) -> dict[str, str]:
    try:
        with open(file_path, "rb") as f:
            return transfer_encode(file_path, f)
    except FileNotFoundError:
        raise ArgumentTypeError(f"File not found: {file_path}")


def expanded(paths: list[pathlib.Path]) -> Generator[pathlib.Path, None, None]:
    for path in paths:
        if path.is_dir():
            for root, _, file_names in os.walk(path):
                for file_name in file_names:
                    yield pathlib.Path(root) / file_name
        else:
            yield path


def transfer_encoded_extra_files(paths: list[pathlib.Path]) -> dict[str, str]:
    buffer = io.BytesIO()

    with ZipFile(buffer, "w") as zf:
        for path in set(expanded(paths)):
            zf.write(path.relative_to(CWD))

    buffer.seek(0)
    return transfer_encode("extra-files.zip", buffer)


class MergeToTransferEncodedZip(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        paths = cast(list[pathlib.Path], values)
        value = transfer_encoded_extra_files(paths)
        setattr(namespace, self.dest, value)


parser = configargparse.ArgumentParser(
    default_config_files=[
        "~/.locust.conf",
        "locust.conf",
        "pyproject.toml",
        "~/.cloud.conf",
        "cloud.conf",
    ],
    auto_env_var_prefix="LOCUSTCLOUD_",
    formatter_class=configargparse.RawTextHelpFormatter,
    config_file_parser_class=configargparse.CompositeConfigParser(
        [
            LocustTomlConfigParser(["tool.locust"]),
            configargparse.DefaultConfigFileParser,
        ]
    ),
    description="""Launches a distributed Locust runs on locust.cloud infrastructure.

Example: locust-cloud -f my_locustfile.py --users 1000 ...""",
    epilog="""Any parameters not listed here are forwarded to locust master unmodified, so go ahead and use things like --users, --host, --run-time, ...
Locust config can also be set using config file (~/.locust.conf, locust.conf, pyproject.toml, ~/.cloud.conf or cloud.conf).
Parameters specified on command line override env vars, which in turn override config files.""",
    add_config_file_help=False,
    add_env_var_help=False,
    add_help=False,
)
parser.add_argument(
    "-h",
    "--help",
    action="help",
    help=configargparse.SUPPRESS,
)
parser.add_argument(
    "-V",
    "--version",
    action="store_true",
    help=configargparse.SUPPRESS,
)
parser.add_argument(
    "-f",
    "--locustfile",
    metavar="<filename>",
    default="locustfile.py",
    help="The Python file that contains your test. Defaults to 'locustfile.py'.",
    env_var="LOCUST_LOCUSTFILE",
    type=transfer_encoded_file,
)
parser.add_argument(
    "-u",
    "--users",
    type=int,
    default=1,
    help="Number of users to launch. This is the same as the regular Locust argument, but also affects how many workers to launch.",
    env_var="LOCUST_USERS",
)
advanced = parser.add_argument_group("advanced")
advanced.add_argument(
    "--loglevel",
    "-L",
    type=str.upper,
    help="Set --loglevel DEBUG for extra info.",
    choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    default="INFO",
)
advanced.add_argument(
    "--requirements",
    type=transfer_encoded_file,
    help="Optional requirements.txt file that contains your external libraries.",
)
advanced.add_argument(
    "--login",
    action="store_true",
    default=False,
    help="Launch an interactive session to authenticate your user.\nOnce completed your credentials will be stored and automatically refreshed for quite a long time.\nOnce those expires you will be prompted to perform another login.",
)
advanced.add_argument(
    "--non-interactive",
    action="store_true",
    default=False,
    help="This can be set when, for example, running in a CI/CD environment to ensure no interactive steps while executing.\nRequires that LOCUSTCLOUD_USERNAME, LOCUSTCLOUD_PASSWORD and LOCUSTCLOUD_REGION environment variables are set.",
)
parser.add_argument(
    "--workers",
    type=int,
    help="Number of workers to use for the deployment. Defaults to number of users divided by 500, but the default may be customized for your account.",
    default=None,
)
parser.add_argument(
    "--delete",
    action="store_true",
    help="Delete a running cluster. Useful if locust-cloud was killed/disconnected or if there was an error.",
)
parser.add_argument(
    "--image-tag",
    type=str,
    default=None,
    help=configargparse.SUPPRESS,  # overrides the locust-cloud docker image tag. for internal use
)
parser.add_argument(
    "--mock-server",
    action="store_true",
    default=False,
    help="Start a demo mock service and set --host parameter to point Locust towards it",
)
parser.add_argument(
    "--profile",
    type=str,
    help="Set a profile to group the testruns together",
)
parser.add_argument(
    "--extra-files",
    action=MergeToTransferEncodedZip,
    nargs="*",
    type=valid_extra_files_path,
    help="A list of extra files or directories to upload. Space-separated, e.g. --extra-files testdata.csv *.py my-directory/",
)


def parse_known_args(args: Any | None = None) -> tuple[Namespace, list[str]]:
    return parser.parse_known_args(args)
