import os

import clickhouse_connect


def get_client():
    return clickhouse_connect.get_client(
        host=os.environ["CHHOST"],
        username=os.environ["CHUSER"],
        password=os.environ["CHPASSWORD"],
        secure=True,
    )
