# Locust Cloud

Locust cloud is a python package allowing for deploying with Locust Cloud from the CLI. The Python package leverages an AWS lambda for deployments.

### Lambda Endpoints

The Chalice endpoint exposes two endpoints; one to deploy and one to teardown the deployment. In order to authenticate, create a user with permissions to the desired cluster and provide the access keys in `AWS_PUBLIC_KEY` and `AWS_SECRET_KEY`. Then simply `POST` `endpoint/<cluster_name>` to deploy and `DELETE` to teardown. 

Additional query parameters are:
- `region_name`: AWS region name for the deployment (defaults to eu-north-1)
- `namespace`: Kubernetes namespace to scope the deployed pods (defaults to default)

### Local Deployment

A manual deployment can be created using chalice and posting the endpoint using CURL or a similar tool:
```
chalice local
curl --location --request POST 'http://127.0.0.1:8000/1/locust' \
--header 'AWS_PUBLIC_KEY: {PUBLIC_KEY}' \
--header 'AWS_SECRET_KEY: {SECRET_KEY}'
```

### Local Debugging

For debugging purposes logs can be received using kubectl:
```
kubectl logs pod/locust-pod-worker-#
kubectl logs pod/locust-pod-master-#
```
Use port forwarding to interact with the Locust deployment locally:
```
kubectl port-forward pod/locust-master-# 8089:8089
```

### Helpful Links

- The [Python Kubernetes Client](https://github.com/kubernetes-client/python) has many useful [examples](https://github.com/kubernetes-client/python/blob/master/examples/README.md)
- The [Remote Cluster Kubernetes Example](https://github.com/kubernetes-client/python/blob/master/examples/remote_cluster.py) describes receiving and using a bearer token for authentication with the kubernetes client. This is important because the AWS Lambda will not have a kubeconfig
- The [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) Python package has many helpful functions for interacting directly with AWS
- [AWS Fargate](https://docs.aws.amazon.com/eks/latest/userguide/fargate.html)
