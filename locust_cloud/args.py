import argparse
import base64
import gzip
import io
import os
import pathlib
import sys

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib

from argparse import ArgumentTypeError
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
            return transfer_encode(os.path.basename(file_path), f)
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


cloud_parser = configargparse.ArgumentParser(add_help=False)
cloud_parser.add_argument(
    "--cloud",
    action="store_true",
    help="Run Locust in cloud mode.",
)
cloud_parser.add_argument(
    "--login",
    action="store_true",
    help="Launch an interactive session to authenticate your user.\nOnce completed your credentials will be stored and automatically refreshed for quite a long time.\nOnce those expires you will be prompted to perform another login.",
)
cloud_parser.add_argument(
    "--delete",
    action="store_true",
    help="Delete a running cluster. Useful if locust-cloud was killed/disconnected or if there was an error.",
)
cloud_parser.add_argument(
    "--requirements",
    metavar="<filename>",
    type=transfer_encoded_file,
    help="Optional requirements.txt file that contains your external libraries.",
)
cloud_parser.add_argument(
    "--non-interactive",
    action="store_true",
    default=False,
    help="This can be set when, for example, running in a CI/CD environment to ensure no interactive steps while executing.\nRequires that LOCUSTCLOUD_USERNAME, LOCUSTCLOUD_PASSWORD and LOCUSTCLOUD_REGION environment variables are set.",
)
cloud_parser.add_argument(
    "--workers",
    metavar="<int>",
    type=int,
    help="Number of workers to use for the deployment. Defaults to number of users divided by 500, but the default may be customized for your account.",
    default=None,
)
cloud_parser.add_argument(
    "--image-tag",
    type=str,
    default=None,
    help=configargparse.SUPPRESS,  # overrides the locust-cloud docker image tag. for internal use
)
cloud_parser.add_argument(
    "--mock-server",
    action="store_true",
    default=False,
    help="Start a demo mock service and set --host parameter to point Locust towards it",
)
cloud_parser.add_argument(
    "--extra-files",
    action=MergeToTransferEncodedZip,
    nargs="*",
    type=valid_extra_files_path,
    help="A list of extra files or directories to upload. Space-separated, e.g. --extra-files testdata.csv *.py my-directory/",
)
cloud_parser.add_argument(
    "--testrun-tags",
    nargs="*",
    default=None,
    help="A list of tags that can be used to filter testruns",
)

combined_cloud_parser = configargparse.ArgumentParser(
    default_config_files=[
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
    parents=[cloud_parser],
)
combined_cloud_parser.add_argument(
    "-f",
    "--locustfile",
    default="locustfile.py",
    env_var="LOCUST_LOCUSTFILE",
    type=transfer_encoded_file,
)
combined_cloud_parser.add_argument(
    "-u",
    "--users",
    type=int,
    default=1,
    env_var="LOCUST_USERS",
)
combined_cloud_parser.add_argument(
    "--loglevel",
    "-L",
    type=str.upper,
    choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    default="INFO",
)
