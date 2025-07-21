import shutil
import tempfile
import textwrap
from contextlib import contextmanager
from pathlib import Path

from locust_cloud.import_finder import get_imported_files


@contextmanager
def temporary_file(content, dir=Path.cwd(), suffix=".py"):
    with tempfile.NamedTemporaryFile(dir=dir, suffix=suffix) as f:
        f.write(content.encode())
        f.seek(0)
        yield f.name


def import_name(path):
    return str(Path(path).relative_to(Path.cwd())).removesuffix(".py")


def test_ignore_external_packages_imports():
    with temporary_file("import requests") as f:
        assert len(get_imported_files(Path(f))) == 0


def test_import_file():
    with temporary_file(
        textwrap.dedent(
            """
                def foo():
                    return "bar"
            """
        )
    ) as to_import:
        with temporary_file(f"import {import_name(to_import)}\n") as f:
            imports = get_imported_files(Path(f))
            assert imports == {Path(to_import).relative_to(Path.cwd())}


def test_from_import_file():
    with temporary_file(
        textwrap.dedent(
            """
                def foo():
                    return "bar"
            """
        )
    ) as to_import:
        with temporary_file(f"from {import_name(to_import)} import foo") as f:
            assert get_imported_files(Path(f)) == {Path(to_import).relative_to(Path.cwd())}


def test_all_imports():
    with temporary_file(
        textwrap.dedent(
            """
                def foo():
                    return "bar"
            """
        )
    ) as to_import:
        with temporary_file(
            textwrap.dedent(
                f"""
                    import requests                 # should be ignored
                    import os                       # should be ignored
                    import {import_name(to_import)} # should be included
                """
            )
        ) as f:
            assert get_imported_files(Path(f)) == {Path(to_import).relative_to(Path.cwd())}


def test_second_level_imports():
    with temporary_file(
        textwrap.dedent(
            """
                def foo():
                    return "bar"
            """
        )
    ) as to_import:
        with temporary_file(
            textwrap.dedent(
                f"""
                    def bar():
                        import {import_name(to_import)}
                """
            )
        ) as f:
            assert get_imported_files(Path(f)) == {Path(to_import).relative_to(Path.cwd())}


def test_recursive_imports():
    with temporary_file(
        textwrap.dedent(
            """
                def foo():
                    return "bar"
            """
        )
    ) as to_import_1:
        with temporary_file(f"import {import_name(to_import_1)}") as to_import:
            with temporary_file(f"import {import_name(to_import)}") as f:
                assert get_imported_files(Path(f)) == {
                    Path(to_import).relative_to(Path.cwd()),
                    Path(to_import_1).relative_to(Path.cwd()),
                }


def test_package_imports():
    test_package = Path.cwd() / "test_package"
    test_package.mkdir()

    (test_package / "__init__.py").write_text(
        textwrap.dedent(
            """
                from .test import bar
                def foo():
                    return "bar"
            """
        )
    )
    (test_package / "test.py").write_text(
        textwrap.dedent(
            """
                def bar():
                    return "baz"
            """
        )
    )
    try:
        with temporary_file("import test_package") as f:
            assert get_imported_files(Path(f)) == {test_package.relative_to(Path.cwd())}

        with temporary_file("import test_package.test") as f:
            assert get_imported_files(Path(f)) == {(test_package / "test.py").relative_to(Path.cwd())}

        with temporary_file("from test_package import bar") as f:
            assert get_imported_files(Path(f)) == {test_package.relative_to(Path.cwd())}

        with temporary_file("from test_package.test import bar") as f:
            assert get_imported_files(Path(f)) == {(test_package / "test.py").relative_to(Path.cwd())}
    finally:
        shutil.rmtree(test_package, ignore_errors=True)
