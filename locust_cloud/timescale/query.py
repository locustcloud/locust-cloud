import logging

from flask import make_response, request
from flask_login import login_required
from locust_cloud.timescale.queries import queries

logger = logging.getLogger(__name__)


def adapt_timestamp(result):
    return {key: str(value) if value else None for key, value in result.items()}


def register_query(environment, pool):
    @environment.web_ui.app.route("/cloud-stats/<query>", methods=["POST"])
    @login_required
    def query(query):
        results = []
        try:
            if query and queries[query]:
                # start_time = time.perf_counter()
                with pool.connection() as conn:
                    # get_conn_time = (time.perf_counter() - start_time) * 1000
                    sql_params = request.get_json()
                    # start_time = time.perf_counter()
                    from datetime import datetime, timedelta

                    if "start" in sql_params:
                        # protect the database against huge queries
                        start_time = datetime.fromisoformat(sql_params["start"])
                        end_time = datetime.fromisoformat(sql_params["end"])
                        if end_time >= start_time + timedelta(hours=6):
                            logger.warning(
                                f"UI asked for too long time interval. Start was {sql_params['start']}, end was {sql_params['end']}"
                            )
                            return []

                    cursor = conn.execute(queries[query], sql_params)
                    # exec_time = (time.perf_counter() - start_time) * 1000
                    assert cursor
                    # start_time = time.perf_counter()
                    results = [
                        adapt_timestamp(
                            dict(
                                zip(
                                    [column[0] for column in cursor.description],
                                    row,
                                )
                            )
                        )
                        for row in cursor.fetchall()
                    ]
                # fetch_time = (time.perf_counter() - start_time) * 1000
                # logger.info(
                #     f"Executed query '{query}' with params {sql_params}. It took {round(get_conn_time)}+{round(exec_time)}+{round(fetch_time)}ms"
                # )
                return results
            else:
                logger.warning(f"Received invalid query key: '{query}'")
                return make_response("Invalid query key", 401)
        except Exception as e:
            logger.info(f"Error executing UI query '{query}': {e}", exc_info=True)
            return make_response("Error executing query", 401)
