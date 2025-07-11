import ast
import importlib.util
import logging
import site
from pathlib import Path

from locust_cloud.common import CWD

logger = logging.getLogger(__name__)

SITE_PACKAGES_PATHS = [Path(p) for p in [site.getusersitepackages(), *site.getsitepackages()]]


def imported_modules(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name.split(".")[0]
        if isinstance(node, ast.ImportFrom):
            if node.level:  # relative import
                continue
            if node.module:
                yield node.module.split(".")[0]


def get_imported_files(file_path: Path) -> list[Path]:
    """
    Get a list of path that are imported from the given python script
    They are returned as relative paths to CWD
    """
    imports: set[Path] = set()

    script_path = Path(file_path).resolve()
    tree = ast.parse(script_path.read_text())

    for mod in imported_modules(tree):
        spec = importlib.util.find_spec(mod)
        if spec and spec.origin:
            p = Path(spec.origin).resolve()
            if (
                p != script_path
                and p.is_relative_to(CWD)
                and all(parent not in SITE_PACKAGES_PATHS for parent in p.parents)
                and all(parent not in imports for parent in p.parents)
                and not "site-packages" in str(p)
            ):
                # add the whole package directory if __init__.py, else the file
                imports.add(p.parent if p.name == "__init__.py" else p)
        else:
            logger.debug(f"Unable to find spec for module: {mod}")

    return [i.relative_to(CWD) for i in imports]
