import importlib.metadata
import json
import os
import pathlib
from dataclasses import dataclass

import platformdirs

__version__ = importlib.metadata.version("locust-cloud")


VALID_REGIONS = ["us-east-1", "eu-north-1"]
CLOUD_CONF_FILE = pathlib.Path(platformdirs.user_config_dir(appname="locust-cloud")) / "config"


@dataclass
class CloudConfig:
    id_token: str | None = None
    refresh_token: str | None = None
    refresh_token_expires: int = 0
    region: str | None = None


def get_api_url(region):
    return os.environ.get("LOCUSTCLOUD_DEPLOYER_URL", f"https://api.{region}.locust.cloud/1")


def read_cloud_config() -> CloudConfig:
    if CLOUD_CONF_FILE.exists():
        with open(CLOUD_CONF_FILE) as f:
            return CloudConfig(**json.load(f))

    return CloudConfig()


def write_cloud_config(config: CloudConfig) -> None:
    CLOUD_CONF_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(CLOUD_CONF_FILE, "w") as f:
        json.dump(config.__dict__, f)
