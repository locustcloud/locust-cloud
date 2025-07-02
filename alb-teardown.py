# pyright: reportMissingModuleSource=false
# pyright: reportMissingImports=false
import base64
import re
import tempfile
from datetime import datetime, timezone

import boto3
from botocore.signers import RequestSigner
from kubernetes import client

STS_TOKEN_EXPIRES_IN = 60


def create_cafile(data: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False) as cafile:
        cadata = base64.b64decode(data)
        cafile.write(cadata)
        return cafile.name


def get_bearer_token(session: boto3.session.Session, cluster_name: str) -> str:
    client = session.client("sts")
    region_name = session.region_name
    service_id = client.meta.service_model.service_id
    credentials = session.get_credentials()
    assert credentials
    signer = RequestSigner(service_id, region_name, "sts", "v4", credentials, session.events)

    headers = {"x-k8s-aws-id": cluster_name}

    params = {
        "method": "GET",
        "url": f"https://sts.{region_name}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15",
        "body": {},
        "headers": headers,
        "context": {},
    }

    signed_url = signer.generate_presigned_url(
        params,
        region_name=region_name,
        expires_in=STS_TOKEN_EXPIRES_IN,
        operation_name="",
    )

    base64_url = base64.urlsafe_b64encode(signed_url.encode("utf-8")).decode("utf-8")

    # remove any base64 encoding padding:
    return "k8s-aws-v1." + re.sub(r"=*", "", base64_url)


def get_kubernetes_client() -> client.ApiClient:
    cluster_name = "locust-auto"
    session = boto3.session.Session()
    bearer = get_bearer_token(session, cluster_name)
    eks_client = session.client("eks")
    response = eks_client.describe_cluster(name=cluster_name)
    cluster = response["cluster"]
    cert_filename = create_cafile(cluster["certificateAuthority"]["data"])

    configuration = client.Configuration()
    configuration.host = cluster["endpoint"]
    configuration.verify_ssl = True
    configuration.ssl_ca_cert = cert_filename
    configuration.api_key["authorization"] = bearer
    configuration.api_key_prefix["authorization"] = "Bearer"

    return client.ApiClient(configuration)


EXCLUDE_NAMESPACES = {
    "kube-system",
    "kube-public",
    "voyado",
    "amazon-cloudwatch",
    "amadeu",
    "default",
    "dev",
    "kube-node-lease",
    "aws-observability",
    "zefr",
    "dmdb",
    "wolters-kluwer",
    "codepath",
}

kubernetes_client = get_kubernetes_client()

core_api = client.CoreV1Api(api_client=kubernetes_client)
networking_api = client.NetworkingV1Api(api_client=kubernetes_client)

# Get all namespaces
namespaces = core_api.list_namespace().items
current_time = datetime.now(timezone.utc)

for ns in namespaces:
    namespace = ns.metadata.name
    if namespace in EXCLUDE_NAMESPACES:
        print(f"Skipping namespace: {namespace}")
        continue

    print(f"Checking namespace: {namespace}")
    try:
        ingress = networking_api.read_namespaced_ingress(name="locust-master-ingress", namespace=namespace)
        creation_time = ingress.metadata.creation_timestamp
        age_seconds = int((current_time - creation_time).total_seconds())

        if age_seconds > 3600:
            print(f"Deleting Ingress in namespace: {namespace} (age: {age_seconds} seconds)")
            networking_api.delete_namespaced_ingress(name="locust-master-ingress", namespace=namespace)
        else:
            print(f"Skipping Ingress in {namespace} (created within the last hour)")

    except client.exceptions.ApiException as e:
        if e.status == 404:
            print(f"Ingress not found in {namespace}")
        else:
            print(e)
