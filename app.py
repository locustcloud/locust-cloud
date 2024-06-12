import os
from chalice import Chalice, UnauthorizedError
from kubernetes_client.main import get_kubernetes_client
from chalicelib.mutate_cluster import create_deployment, destroy_deployment

app = Chalice(app_name="locust-deployment")

CLUSTER_CONFIGURATION_FILES = [
    os.path.join("chalicelib/kubernetes", filename)
    for filename in os.listdir("chalicelib/kubernetes")
]
AWS_DEFAULT_REGION = "eu-north-1"
AWS_DEFAULT_NAMESPACE = "default"


def get_query_params():
    return app.current_request.query_params or {}


def get_headers():
    return app.current_request.headers or {}


def get_region_name():
    return get_query_params().get("region_name", AWS_DEFAULT_REGION)


def get_namespace():
    return get_query_params().get("namespace", AWS_DEFAULT_NAMESPACE)


@app.route("/1/{cluster_name}", methods=["POST"])
def deploy_pods(cluster_name):
    try:
        aws_access_key_id = get_headers().get("AWS_PUBLIC_KEY")
        aws_secret_access_key = get_headers().get("AWS_SECRET_KEY")

        if not aws_access_key_id or not aws_secret_access_key:
            raise UnauthorizedError("AWS_PUBLIC_KEY and AWS_SECRET_KEY are required")

        region_name = get_region_name()
        namespace = get_namespace()
        kubernetes_client = get_kubernetes_client(
            cluster_name,
            region_name=region_name,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
        )
        create_deployment(
            kubernetes_client,
            configuration_files=CLUSTER_CONFIGURATION_FILES,
            namespace=namespace,
        )

        return {"message": "Deployed"}
    except Exception as e:
        raise UnauthorizedError(f"Unauthorized: {e}")


@app.route("/1/{cluster_name}", methods=["DELETE"])
def destroy_deployed_pods(cluster_name):
    try:
        aws_access_key_id = get_headers().get("AWS_PUBLIC_KEY")
        aws_secret_access_key = get_headers().get("AWS_SECRET_KEY")

        if not aws_access_key_id or not aws_secret_access_key:
            raise UnauthorizedError("AWS_PUBLIC_KEY and AWS_SECRET_KEY are required")

        region_name = get_region_name()
        namespace = get_namespace()
        kubernetes_client = get_kubernetes_client(
            cluster_name,
            region_name=region_name,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
        )
        destroy_deployment(kubernetes_client, namespace=namespace)

        return {"message": "Destroyed"}
    except Exception as e:
        raise UnauthorizedError(f"Unauthorized: {e}")
