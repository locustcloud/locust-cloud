import yaml
from kubernetes import utils


def apply_yaml_file(api_client, configuration_file):
    with open(configuration_file) as f:
        yaml_config = yaml.safe_load_all(f)
        for config in yaml_config:
            utils.create_from_yaml(api_client, yaml_objects=[config])


def create_cluster(kubernetes_client, configuration_files):
    api_client = kubernetes_client.ApiClient()
    for yaml_file in configuration_files:
        apply_yaml_file(api_client, yaml_file)


def destroy_cluster(kubernetes_client):
    v1 = kubernetes_client.AppsV1Api()
    deployments = v1.list_namespaced_deployment(namespace="default")

    for deployment in deployments.items:
        print(deployment.metadata.name)
        v1.delete_namespaced_deployment(
            name=deployment.metadata.name, namespace=deployment.metadata.namespace
        )
