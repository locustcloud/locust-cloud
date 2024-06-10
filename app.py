import os
from chalice import Chalice, UnauthorizedError
from chalicelib.kubernetes_client import get_kubernetes_client
from chalicelib.mutate_cluster import create_deployment, destroy_deployment

app = Chalice(app_name="locust-deployment")

CLUSTER_CONFIGURATION_FILES = [
    os.path.join("chalicelib/kubernetes", filename)
    for filename in os.listdir("chalicelib/kubernetes")
]
AWS_DEFAULT_REGION = "eu-north-1"
AWS_DEFAULT_NAMESPACE = "default"


def get_region():
    return (
        app.current_request.query_params.get("region", AWS_DEFAULT_REGION)
        if app.current_request.query_params
        else AWS_DEFAULT_REGION
    )


def get_namespace():
    return (
        app.current_request.query_params.get("namespace", AWS_DEFAULT_REGION)
        if app.current_request.query_params
        else AWS_DEFAULT_NAMESPACE
    )


@app.route("/{cluster_name}", methods=["POST"])
def deploy_pods(cluster_name):
    try:
        region_name = get_region()
        namespace = get_namespace()
        kubernetes_client = get_kubernetes_client(cluster_name, region_name=region_name)
        create_deployment(
            kubernetes_client,
            configuration_files=CLUSTER_CONFIGURATION_FILES,
            namespace=namespace,
        )

        return "Deployed"
    except Exception as e:
        raise UnauthorizedError(f"Unauthorized: {e}")


@app.route("/{cluster_name}", methods=["DELETE"])
def destroy_deployed_pods(cluster_name):
    try:
        region_name = get_region()
        namespace = get_namespace()
        kubernetes_client = get_kubernetes_client(cluster_name, region_name=region_name)
        destroy_deployment(kubernetes_client, namespace=namespace)

        return "Destroyed"
    except Exception as e:
        raise UnauthorizedError(f"Unauthorized: {e}")
