import subprocess

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class BuildFrontend(BuildHookInterface):
    def initialize(self, version, build_data):
        try:
            subprocess.check_output("yarn install", cwd="locust_cloud/webui", shell=True, stderr=subprocess.STDOUT)
            subprocess.check_output("yarn build", cwd="locust_cloud/webui", shell=True, stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"'{e.cmd}' got exit code {e.returncode}: {e.output}")

        return super().initialize(version, build_data)
