import os
from chalice import Chalice, UnauthorizedError
from chalicelib.kubernetes_client import get_kubernetes_client
from chalicelib.mutate_cluster import create_cluster, destroy_cluster

app = Chalice(app_name="locust-deployment")

CLUSTER_CONFIGURATION_FILES = [
    os.path.join("kubernetes", filename) for filename in os.listdir("kubernetes")
]
AWS_DEFAULT_REGION = "eu-north-1"


def get_region():
    return (
        app.current_request.query_params.get("region", AWS_DEFAULT_REGION)
        if app.current_request.query_params
        else AWS_DEFAULT_REGION
    )


@app.route("/{cluster}", methods=["POST"])
def deploy_pods(cluster):
    try:
        print(cluster)
        region = get_region()
        kubernetes_client = get_kubernetes_client(cluster, region=region)
        print(kubernetes_client)
        create_cluster(
            kubernetes_client,
            configuration_files=CLUSTER_CONFIGURATION_FILES,
        )

        return "Deployed"
    except Exception as e:
        raise UnauthorizedError(f"Unauthorized: {e}")


@app.route("/{cluster}", methods=["DELETE"])
def destroy_deployed_pods(cluster):
    try:
        region = get_region()
        kubernetes_client = get_kubernetes_client(cluster, region=region)
        destroy_cluster(
            kubernetes_client,
            yaml_configuration=CLUSTER_CONFIGURATION_FILES,
        )

        return "Destroyed"
    except Exception as e:
        raise UnauthorizedError(f"Unauthorized: {e}")
