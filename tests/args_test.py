import base64
import gzip
import io
import tempfile
from argparse import ArgumentTypeError
from pathlib import Path
from zipfile import ZipFile

import pytest
from locust_cloud.args import (
    combined_cloud_parser,
    expanded,
    transfer_encode,
    transfer_encoded_file,
    valid_project_path,
    zip_project_paths,
)


def test_valid_project_path():
    with tempfile.NamedTemporaryFile() as tmp:
        with pytest.raises(ArgumentTypeError) as exception:
            valid_project_path(tmp.name)

    assert str(exception.value) == f"'{tmp.name}' is not under current working directory: {Path.cwd()}"

    bad_path = str(Path.cwd() / "does-not-exist")

    with pytest.raises(ArgumentTypeError) as exception:
        valid_project_path(bad_path)

    assert str(exception.value) == f"'{bad_path}' does not exist"


def test_transfer_encode():
    file_name = "pineapple.txt"
    data = b"pineapple"
    result = transfer_encode(file_name, io.BytesIO(data))
    assert file_name == result["filename"]
    assert data == gzip.decompress(base64.b64decode(str.encode(result["data"])))


def test_transfer_encoded_file():
    with pytest.raises(ArgumentTypeError) as exception:
        transfer_encoded_file("does-not-exist")

    assert str(exception.value) == "File not found: does-not-exist"


def test_expanded():
    result = list(expanded([Path("locustfile.py"), Path("testdata/extra-files")]))
    assert result == [Path("locustfile.py"), Path("testdata/extra-files/extra.txt")]


def test_project_zip():
    result = zip_project_paths([Path("testdata/extra-files")])
    assert result["filename"] == "project.zip"
    buffer = io.BytesIO(gzip.decompress(base64.b64decode(str.encode(result["data"]))))
    with ZipFile(buffer) as zf:
        assert zf.namelist() == ["testdata/extra-files/extra.txt"]


def test_parser_extra_files(capsys):
    with pytest.raises(SystemExit):
        with tempfile.NamedTemporaryFile() as tmp:
            combined_cloud_parser.parse_known_args(f"locust-cloud --extra-files {tmp.name}")

        expected = f"error: argument --extra-files: '{tmp.name}' is not under current working directory: {Path.cwd()}"
        assert expected in capsys.readouterr().err

    with pytest.raises(SystemExit):
        combined_cloud_parser.parse_known_args("locust-cloud --extra-files does-not-exist")

    expected = "error: argument --extra-files: 'does-not-exist' does not exist"
    assert expected in capsys.readouterr().err


def test_parser_loglevel(capsys):
    options, _ = combined_cloud_parser.parse_known_args("locust-cloud --loglevel DEBUG")
    assert options.loglevel == "DEBUG"

    with pytest.raises(SystemExit):
        combined_cloud_parser.parse_known_args("locust-cloud --loglevel pineapple")

    expected = "error: argument --loglevel/-L: invalid choice: 'PINEAPPLE'"
    assert expected in capsys.readouterr().err
