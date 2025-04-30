import base64
import gzip
import io
import pathlib
from argparse import ArgumentTypeError
from zipfile import ZipFile

import pytest
from locust_cloud.args import (
    CWD,
    combined_cloud_parser,
    expanded,
    pipe,
    transfer_encode,
    transfer_encoded_args_files,
    transfer_encoded_file,
    valid_extra_files_path,
)


def test_pipe():
    one = lambda x: x * 3
    two = lambda x: x + 3
    assert pipe(4, one, two) == 15


def test_valid_extra_files_path():
    with pytest.raises(ArgumentTypeError) as exception:
        valid_extra_files_path("../pineapple")

    assert str(exception.value) == f"Can only reference files under current working directory: {CWD}"

    bad_path = str(CWD / "does-not-exist")

    with pytest.raises(ArgumentTypeError) as exception:
        valid_extra_files_path(bad_path)

    assert str(exception.value) == f"File not found: {bad_path}"


def test_transfer_encode():
    file_name = "pineapple.txt"
    data = b"pineapple"
    result = transfer_encode(file_name, io.BytesIO(data))
    assert file_name == result["filename"]
    assert data == pipe(
        result["data"],
        str.encode,
        base64.b64decode,
        gzip.decompress,
    )


def test_transfer_encoded_file():
    with pytest.raises(ArgumentTypeError) as exception:
        transfer_encoded_file("does-not-exist")

    assert str(exception.value) == "File not found: does-not-exist"


def test_expanded():
    result = list(expanded([pathlib.Path("locustfile.py"), pathlib.Path("testdata/extra-files")]))
    assert result == [pathlib.Path("locustfile.py"), pathlib.Path("testdata/extra-files/extra.txt")]


def test_transfer_encoded_args_files():
    result = transfer_encoded_args_files([pathlib.Path("testdata/extra-files").resolve()], "extra-files")
    assert result["filename"] == "extra-files.zip"

    buffer = pipe(
        result["data"],
        str.encode,
        base64.b64decode,
        gzip.decompress,
        io.BytesIO,
    )

    with ZipFile(buffer) as zf:
        assert zf.namelist() == ["testdata/extra-files/extra.txt"]


def test_parser_locustfile(capsys):
    with pytest.raises(SystemExit):
        combined_cloud_parser.parse_known_args("locust-cloud --locustfile does-not-exist")

    expected = "error: argument -f/--locustfile: File not found: does-not-exist"
    assert expected in capsys.readouterr().err

    options, _ = combined_cloud_parser.parse_known_args("locust-cloud --locustfile testdata/extra-files/extra.txt")
    assert options.locustfile == transfer_encoded_file("testdata/extra-files/extra.txt")


def test_parser_extra_files(capsys):
    with pytest.raises(SystemExit):
        combined_cloud_parser.parse_known_args("locust-cloud --extra-files ../pineapple")

    expected = "error: argument --extra-files: Can only reference files under current working directory"
    assert expected in capsys.readouterr().err

    with pytest.raises(SystemExit):
        combined_cloud_parser.parse_known_args("locust-cloud --extra-files does-not-exist")

    expected = "error: argument --extra-files: File not found: does-not-exist"
    assert expected in capsys.readouterr().err

    options, _ = combined_cloud_parser.parse_known_args("locust-cloud --extra-files testdata/extra-files")
    assert options.extra_files["filename"] == "extra-files.zip"
    buffer = pipe(
        options.extra_files["data"],
        str.encode,
        base64.b64decode,
        gzip.decompress,
        io.BytesIO,
    )

    with ZipFile(buffer) as zf:
        assert zf.namelist() == ["testdata/extra-files/extra.txt"]


def test_parser_loglevel(capsys):
    options, _ = combined_cloud_parser.parse_known_args("locust-cloud --loglevel DEBUG")
    assert options.loglevel == "DEBUG"

    with pytest.raises(SystemExit):
        combined_cloud_parser.parse_known_args("locust-cloud --loglevel pineapple")

    expected = "error: argument --loglevel/-L: invalid choice: 'PINEAPPLE'"
    assert expected in capsys.readouterr().err
