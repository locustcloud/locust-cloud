#########
First run
#########

1. `Install Python <https://docs.python-guide.org/starting/installation/>`_, if you dont already have it.

2. Install `locust-cloud`

.. code-block:: console

    $ pip install locust-cloud
    Collecting locust-cloud
    ...

3. Log in

.. code-block:: console

    $ locust-cloud --login
    Enter the number for the region to authenticate against

    1. us-east-1
    2. eu-north-1

    > 1

    Attempting to automatically open the SSO authorization page in your default browser.
    ...

.. note::
    After logging in, an API token will be stored on your machine, and you will not need to log in until it expires.

4. Run a load test

.. code-block:: console

    $ locust-cloud -f my_locustfile.py --users 100 # ... other regular locust parameters
    [LOCUST-CLOUD] INFO: Deploying load generators
    [LOCUST-CLOUD] INFO: Waiting for load generators to be ready...
    ...
