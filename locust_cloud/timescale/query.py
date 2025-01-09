import datetime
import logging

from flask import Blueprint, make_response, request
from flask_login import login_required
from locust_cloud.client import get_client
from locust_cloud.timescale.queries import queries

logger = logging.getLogger(__name__)


def adapt_timestamp(result):
    return {key: str(value) if isinstance(value, datetime.datetime) else value for key, value in result.items()}


def register_query(environment):
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
                sql_params = request.get_json() if request.content_type == "application/json" else {}

                # start_time = time.perf_counter()

                # exec_time = (time.perf_counter() - start_time) * 1000
                client = get_client()

                results = client.query(sql, sql_params)
                results = [adapt_timestamp(dict(zip(results.column_names, row))) for row in results.result_set]

                client.close()

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
