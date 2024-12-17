import os

import clickhouse_connect
from clickhouse_connect.driver import httputil

pool_mgr = httputil.get_pool_manager(maxsize=16, num_pools=12)


def get_client():
    return clickhouse_connect.get_client(
        host=os.environ["CHHOST"],
        username=os.environ["CHUSER"],
        password=os.environ["CHPASSWORD"],
        secure=True,
        pool_mgr=pool_mgr,
    )
