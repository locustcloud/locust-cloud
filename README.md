# Locust Cloud

Locust cloud allows for customers to deploy their load runners from the CLI. To find out more about Locust Cloud and becoming a customer, visit locust.cloud.

### API

Customers of Locust Cloud will receive a login with a username and password.
The login may be passed to the locust-cloud script as arguments, along with the locust file you wish to deploy:
```
locust-cloud --username user --password password -f locustfile.py
```

Optionally a requirements file may be provided, telling locust cloud to install additional python packages that may be required by your locust file:
```
locust-cloud --username user --password password -f locustfile.py --requirements requirements.txt
```
