import yaml
from kubernetes import utils


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
        response = utils.create_from_yaml(api_client, yaml_objects=[config], namespace=namespace)
        return response[0][0].metadata.name
    except utils.FailToCreateError:
        # Cloudwatch configmap may already exist
        return None


def set_env_variables(config, env_variables):
    config["spec"]["template"]["spec"]["containers"][0]["env"].extend(env_variables)


def apply_yaml_file(api_client, configuration_file, env_variables, cluster_name, namespace):
    deployment_name = None

    with open(configuration_file) as f:
        yaml_config = yaml.safe_load_all(f)

        for config in yaml_config:
            if "cloudwatch-configmap" in configuration_file:
                deployment_name = apply_cloudwatch_configmap(api_client, config, cluster_name, namespace)
                continue

            if "master" in configuration_file:
                set_env_variables(config, env_variables)

            response = utils.create_from_yaml(api_client, yaml_objects=[config], namespace=namespace)

            deployment_name = response[0][0].metadata.name

    return deployment_name


def create_deployment(kubernetes_client, configuration_files, env_variables, cluster_name, namespace):
    api_client = kubernetes_client.ApiClient()
    deployed_pods = []
    for yaml_file in configuration_files:
        deployment_name = apply_yaml_file(api_client, yaml_file, env_variables, cluster_name, namespace)

        if deployment_name is not None and "pod" in deployment_name:
            deployed_pods.append(deployment_name)

    return deployed_pods


def destroy_deployment(kubernetes_client, namespace):
    v1 = kubernetes_client.AppsV1Api()
    deployments = v1.list_namespaced_deployment(namespace=namespace, label_selector="created-by=locust-cloud-deploy")

    for deployment in deployments.items:
        v1.delete_namespaced_deployment(name=deployment.metadata.name, namespace=namespace)
