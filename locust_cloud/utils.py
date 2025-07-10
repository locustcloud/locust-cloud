import logging
import site
from modulefinder import ModuleFinder
from pathlib import Path

logger = logging.getLogger(__name__)

CWD = Path.cwd()
IMPORTS_EXCLUDE_PATHS = [Path(p) for p in [site.getusersitepackages(), *site.getsitepackages()]]


def get_imported_files(file_path: Path) -> set[Path]:
    imports: set[Path] = set()

    script_path = Path(file_path).resolve()

    mf = ModuleFinder()
    try:
        mf.run_script(str(script_path))
    except Exception as e:
        logger.exception(e)
        logger.error(f"{script_path} is not a valid Python script")
        return set()

    for mod in mf.modules.values():
        path = getattr(mod, "__file__", None)
        if not path:
            continue  # built-ins, etc.

        p = Path(path).resolve()
        if (
            p == script_path
            or not p.is_relative_to(CWD)
            or any(parent in IMPORTS_EXCLUDE_PATHS for parent in p.parents)
            or any(parent in imports for parent in p.parents)
        ):
            continue

        # add the whole package directory if __init__.py, else the file
        imports.add(p.parent if p.name == "__init__.py" else p)

    return imports
