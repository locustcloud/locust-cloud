import yaml
from kubernetes import utils


def apply_yaml_file(api_client, configuration_file):
    with open(configuration_file) as f:
        docs = yaml.safe_load_all(f)
        for doc in docs:
            print(doc)
            utils.create_from_yaml(api_client, yaml_objects=[doc])


def create_cluster(kubernetes_client, configuration_files):
    api_client = kubernetes_client.ApiClient()
    for yaml_file in configuration_files:
        print(f"Applying {yaml_file}")
        apply_yaml_file(api_client, yaml_file)
        print(f"Successfully applied {yaml_file}")


def destroy_cluster(kubernetes_client):
    v1 = kubernetes_client.CoreV1Api()
    pods = v1.list_pod_for_all_namespaces(
        label_selector="created-by=locust-cloud-deploy"
    ).items

    for pod in pods:
        print(f"Deleting pod {pod.metadata.name} in namespace {pod.metadata.namespace}")
        v1.delete_namespaced_pod(
            name=pod.metadata.name, namespace=pod.metadata.namespace
        )
