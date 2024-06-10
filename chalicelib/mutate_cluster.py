import yaml
from kubernetes import utils


def apply_yaml_file(api_client, configuration_file, namespace):
    with open(configuration_file) as f:
        yaml_config = yaml.safe_load_all(f)
        for config in yaml_config:
            utils.create_from_yaml(
                api_client, yaml_objects=[config], namespace=namespace
            )


def create_deployment(kubernetes_client, configuration_files, namespace):
    api_client = kubernetes_client.ApiClient()
    for yaml_file in configuration_files:
        apply_yaml_file(api_client, yaml_file, namespace)


def destroy_deployment(kubernetes_client, namespace):
    v1 = kubernetes_client.AppsV1Api()
    deployments = v1.list_namespaced_deployment(
        namespace=namespace, label_selector="created-by=locust-cloud-deploy"
    )

    for deployment in deployments.items:
        v1.delete_namespaced_deployment(
            name=deployment.metadata.name, namespace=namespace
        )
