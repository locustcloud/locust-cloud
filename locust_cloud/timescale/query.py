import logging
from datetime import UTC

from flask import Blueprint, make_response, request
from flask_login import login_required
from locust_cloud.timescale.queries import queries

logger = logging.getLogger(__name__)


def adapt_timestamp(result):
    return {key: str(value) if value else None for key, value in result.items()}


def register_query(environment, pool):
    cloud_stats_blueprint = Blueprint(
        "locust_cloud_stats", __name__, url_prefix=environment.parsed_options.web_base_path
    )

    @cloud_stats_blueprint.route("/cloud-stats/<query>", methods=["POST"])
    @login_required
    def query(query):
        results = []
        try:
            if query and queries[query]:
                sql = queries[query]
                # start_time = time.perf_counter()
                with pool.connection() as conn:
                    # get_conn_time = (time.perf_counter() - start_time) * 1000
                    sql_params = request.get_json() if request.content_type == "application/json" else {}
                    # start_time = time.perf_counter()
                    from datetime import datetime, timedelta

                    if "start" in sql_params:
                        # protect the database against huge queries
                        start_time = datetime.fromisoformat(sql_params["start"])
                        end_time = datetime.fromisoformat(sql_params["end"])
                        if end_time >= start_time + timedelta(hours=48):
                            logger.warning(
                                f"UI asked for too long time interval. Start was {sql_params['start']}, end was {sql_params['end']}"
                            )
                            return []
                        if start_time >= datetime(2024, 10, 30, 11, tzinfo=UTC):
                            # when runs before this go out of scope, we can just update the query
                            sql = sql.replace("FROM requests_summary_view", "FROM requests_summary_view_v1")

                    cursor = conn.execute(sql, sql_params)
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
                return make_response({"error": "Invalid query key"}, 401)
        except Exception as e:
            logger.info(f"Error executing UI query '{query}': {e}", exc_info=True)
            return make_response({"error": "Error executing query"}, 401)

    environment.web_ui.app.register_blueprint(cloud_stats_blueprint)
