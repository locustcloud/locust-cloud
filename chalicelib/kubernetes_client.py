import re
import boto3
import tempfile
import base64
from botocore.signers import RequestSigner
from kubernetes import client

STS_TOKEN_EXPIRES_IN = 60


def _write_cafile(data: str) -> tempfile.NamedTemporaryFile:
    cafile = tempfile.NamedTemporaryFile(delete=False)
    cadata_b64 = data
    cadata = base64.b64decode(cadata_b64)
    cafile.write(cadata)
    cafile.flush()
    return cafile


def get_bearer_token(session, cluster_name, region_name):
    client = session.client("sts")

    service_id = client.meta.service_model.service_id

    signer = RequestSigner(
        service_id, region_name, "sts", "v4", session.get_credentials(), session.events
    )

    params = {
        "method": "GET",
        "url": f"https://sts.{region_name}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15",
        "body": {},
        "headers": {"x-k8s-aws-id": cluster_name},
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


def get_kubernetes_client(
    cluster_name, region_name, aws_access_key_id, aws_secret_access_key
):
    session = boto3.session.Session(
        region_name=region_name,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
    )

    bearer = get_bearer_token(session, cluster_name, region_name)

    eks_client = session.client("eks")

    response = eks_client.describe_cluster(name=cluster_name)

    cluster = response["cluster"]

    endpoint = cluster["endpoint"]
    cert_authority = _write_cafile(cluster["certificateAuthority"]["data"])

    configuration = client.Configuration()
    configuration.host = endpoint
    configuration.verify_ssl = True
    configuration.ssl_ca_cert = cert_authority.name
    configuration.api_key["authorization"] = bearer
    configuration.api_key_prefix["authorization"] = "Bearer"

    client.Configuration.set_default(configuration)
    return client
