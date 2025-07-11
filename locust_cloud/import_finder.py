import logging
import site
from modulefinder import ModuleFinder
from pathlib import Path

from locust_cloud.common import CWD

logger = logging.getLogger(__name__)

SITE_PACKAGES_PATHS = [Path(p) for p in [site.getusersitepackages(), *site.getsitepackages()]]


def get_imported_files(file_path: Path) -> set[Path]:
    imports: set[Path] = set()

    script_path = Path(file_path).resolve()

    mf = ModuleFinder()
    try:
        mf.run_script(str(script_path))
    except Exception as e:
        logger.debug(f"Unable to run ModuleFinder on {script_path}: {e}")
        return set()

    for mod in mf.modules.values():
        path = getattr(mod, "__file__", None)
        if not path:
            continue  # built-ins, etc.

        p = Path(path).resolve()
        if (
            p != script_path
            and p.is_relative_to(CWD)
            and all(parent not in SITE_PACKAGES_PATHS for parent in p.parents)
            and all(parent not in imports for parent in p.parents)
            and not "site-packages" in str(path)
        ):
            # add the whole package directory if __init__.py, else the file
            imports.add(p.parent if p.name == "__init__.py" else p)

    return imports
