import subprocess

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class BuildFrontend(BuildHookInterface):
    def initialize(self, version, build_data):
        subprocess.check_output("yarn build", cwd="locust_cloud/webui", shell=True)

        return super().initialize(version, build_data)
