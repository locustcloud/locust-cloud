import logging
import os
import sys

import clickhouse_connect
from clickhouse_connect.driver import httputil
from clickhouse_connect.driver.exceptions import DatabaseError

pool_mgr = httputil.get_pool_manager(maxsize=16, num_pools=12)
logger = logging.getLogger(__name__)


def get_client():
    try:
        return clickhouse_connect.get_client(
            host=os.environ["CHHOST"],
            username=os.environ["CHUSER"],
            password=os.environ["CHPASSWORD"],
            secure=True,
            pool_mgr=pool_mgr,
        )
    except DatabaseError as e:
        if "AUTHENTICATION_FAILED" in str(e):
            logger.error(str(e))
            sys.exit(1)
