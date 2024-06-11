# Locust Cloud

### Setup

Setup the new client by creating a new namespace or cluster:
```
eksctl create cluster --name cluster-name --region eu-north-1 --fargate

# OR

kubectl create namespace new-namespace
```
To interact with the cluster locally, update the local kubeconfig:
```
aws eks update-kubeconfig --region eu-north-1 --name cluster-name
```

A manual deployment can be created using the kubectl CLI:
```
kubectl create -f ./chalicelib/kubernetes
```
For debugging purposes logs can be received using kubectl:
```
kubectl logs pod/locust-worker-#
kubectl logs pod/locust-master-#
```
Finally, use port forwarding to interact with the Locust deployment locally:
```
kubectl port-forward pod/locust-master-# 8089:8089
```

### Lambda Endpoints

The Chalice endpoint exposes two endpoints; one to deploy and one to teardown the deployment. In order to authenticate, create a user with permissions to the desired cluster and provide the access keys in `AWS_PUBLIC_KEY` and `AWS_SECRET_KEY`. Then simply `POST` `endpoint/<cluster_name>` to deploy and `DELETE` to teardown. 

Additional query parameters are:
- `region_name`: AWS region name for the deployment (defaults to eu-north-1)
- `namespace`: Kubernetes namespace to scope the deployed pods


### Helpful Links

- The [Python Kubernetes Client](https://github.com/kubernetes-client/python) has many useful [examples](https://github.com/kubernetes-client/python/blob/master/examples/README.md)
- The [Remote Cluster Kubernetes Example](https://github.com/kubernetes-client/python/blob/master/examples/remote_cluster.py) describes receiving and using a bearer token for authentication with the kubernetes client. This is important because the AWS Lambda will not have a kubeconfig
- The [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) Python package has many helpful functions for interacting directly with AWS
