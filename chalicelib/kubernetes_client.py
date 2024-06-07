import re
import boto3
import tempfile
import base64
from botocore.signers import RequestSigner
from kubernetes import client


def _write_cafile(data: str) -> tempfile.NamedTemporaryFile:
    cafile = tempfile.NamedTemporaryFile(delete=False)
    cadata_b64 = data
    cadata = base64.b64decode(cadata_b64)
    cafile.write(cadata)
    cafile.flush()
    return cafile


def get_bearer_token(region):
    STS_TOKEN_EXPIRES_IN = 60
    session = boto3.session.Session(region_name=region)

    token_service_client = session.client("sts")

    service_id = token_service_client.meta.service_model.service_id

    signer = RequestSigner(
        service_id, region, "sts", "v4", session.get_credentials(), session.events
    )

    params = {
        "method": "GET",
        "url": f"https://sts.{region}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15",
        "body": {},
        "headers": {"x-k8s-aws-id": region},
        "context": {},
    }

    signed_url = signer.generate_presigned_url(
        params,
        region_name=region,
        expires_in=STS_TOKEN_EXPIRES_IN,
        operation_name="",
    )

    base64_url = base64.urlsafe_b64encode(signed_url.encode("utf-8")).decode("utf-8")

    # remove any base64 encoding padding:
    return "k8s-aws-v1." + re.sub(r"=*", "", base64_url)


def get_kubernetes_client(cluster, region):
    eks_client = boto3.client("eks")

    response = eks_client.describe_cluster(name=cluster)

    cluster = response["cluster"]
    endpoint = cluster["endpoint"]
    cert_authority = _write_cafile(cluster["certificateAuthority"]["data"])

    configuration = client.Configuration()
    configuration.host = endpoint
    configuration.verify_ssl = True
    configuration.ssl_ca_cert = cert_authority.name
    bearer = get_bearer_token(region)
    configuration.api_key["authorization"] = bearer
    configuration.api_key_prefix["authorization"] = "Bearer"

    client.Configuration.set_default(configuration)
    return client
