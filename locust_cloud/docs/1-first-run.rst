`Locust Cloud <https://locust.cloud/>`_ is a hosted version of Locust that allows you to run distributed load tests without having to set up and maintain your own infrastructure.

It also allows more detailed reporting and analysis, as well as storing historical test results and tracking them over time.

#########
First run
#########

Once you have signed up for Locust Cloud, you can run your first test in just a few minutes:

1. Log in

.. code-block:: console

    $ locust --cloud --login
    Enter the number for the region to authenticate against

    1. us-east-1
    2. eu-north-1

    > 1

    Attempting to automatically open the SSO authorization page in your default browser.
    ...

.. note::
    After logging in, an API token will be stored on your machine, and you will not need to log in until it expires.

2. Run a load test

.. code-block:: console

    $ locust --cloud -f my_locustfile.py --users 100 # ... other regular locust parameters
    [LOCUST-CLOUD] INFO: Deploying load generators
    [LOCUST-CLOUD] INFO: Waiting for load generators to be ready...
    ...
