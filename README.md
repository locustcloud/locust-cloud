### Commands

```
eksctl create cluster --name locust --region eu-north-1 --fargate
kubectl apply -f ./kubernetes
kubectl logs pod/locust-worker-#
kubectl port-forward pod/locust-master-# 8089:8089
aws eks update-kubeconfig --region eu-north-1 --name locust
```
