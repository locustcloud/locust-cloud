import yaml
from kubernetes import utils, watch


def apply_cloudwatch_configmap(api_client, config, cluster_name, namespace):
    # indentation of this string is important
    config["data"]["output.conf"] = f"""
[OUTPUT]
    Name cloudwatch_logs
    Match   kube.*
    region eu-north-1
    log_group_name /eks/{cluster_name}-{namespace}
    log_stream_prefix from-fluent-bit-
    log_retention_days 60
    auto_create_group true
    """

    try:
        utils.create_from_yaml(api_client, yaml_objects=[config], namespace=namespace)
    except utils.FailToCreateError:
        # Cloudwatch configmap may already exist
        pass


def apply_yaml_file(api_client, configuration_file, cluster_name, namespace):
    with open(configuration_file) as f:
        yaml_config = yaml.safe_load_all(f)

        for config in yaml_config:
            if "cloudwatch-configmap" in configuration_file:
                apply_cloudwatch_configmap(api_client, config, cluster_name, namespace)
            else:
                utils.create_from_yaml(
                    api_client, yaml_objects=[config], namespace=namespace
                )


def wait_for_pods_deployment(kubernetes_client, namespace):
    v1 = kubernetes_client.CoreV1Api()
    w = watch.Watch()

    for event in w.stream(v1.list_namespaced_pod, namespace=namespace):
        pod_status = event["object"].status.phase

        if pod_status == "Running":
            pods = v1.list_namespaced_pod(namespace=namespace)
            all_ready = all([pod.status.phase == "Running" for pod in pods.items])

            if all_ready:
                w.stop()


def create_deployment(kubernetes_client, configuration_files, cluster_name, namespace):
    api_client = kubernetes_client.ApiClient()
    for yaml_file in configuration_files:
        apply_yaml_file(api_client, yaml_file, cluster_name, namespace)

    wait_for_pods_deployment(kubernetes_client, namespace)


def destroy_deployment(kubernetes_client, namespace):
    v1 = kubernetes_client.AppsV1Api()
    deployments = v1.list_namespaced_deployment(
        namespace=namespace, label_selector="created-by=locust-cloud-deploy"
    )

    for deployment in deployments.items:
        v1.delete_namespaced_deployment(
            name=deployment.metadata.name, namespace=namespace
        )
