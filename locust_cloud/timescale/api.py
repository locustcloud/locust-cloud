from locust_cloud.timescale.queries import queries

import atexit
import sys

from flask import jsonify, request
from psycopg2 import pool


def adapt_timestamp(result):
    return {key: str(value) for key, value in result.items()}


class Api:
    def __init__(self, app, pg_host, pg_user, pg_password, pg_database, pg_port):
        self.app = app

        self.pg_user = pg_user
        self.pg_host = pg_host
        self.pg_password = pg_password
        self.pg_database = pg_database
        self.pg_port = pg_port

        self._create_connection()
        self._register_routes()

        atexit.register(self.clear_connection)

    def _create_connection(self):
        try:
            self.pool = pool.SimpleConnectionPool(
                minconn=1,
                maxconn=100,
                host=self.pg_host,
                user=self.pg_user,
                password=self.pg_password,
                database=self.pg_database,
                port=self.pg_port,
            )
        except Exception:
            sys.stderr.write(f"Could not connect to postgres ({self.pg_user}@{self.pg_host}:{self.pg_port}).")
            sys.exit(1)

    def _register_routes(self):
        @self.app.route("/cloud-stats/<query>", methods=["POST"])
        def query(query):
            assert request.method == "POST"

            results = []

            try:
                if query and queries[query]:
                    conn = self.pool.getconn()
                    cursor = conn.cursor()

                    sql_params = request.get_json()

                    cursor.execute(queries[query], sql_params)

                    results = [
                        adapt_timestamp(dict(zip([column[0] for column in cursor.description], row)))
                        for row in cursor.fetchall()
                    ]

                    cursor.close()
                    self.pool.putconn(conn)

                return jsonify(results)
            except Exception as e:
                print(e)

            return jsonify(results)

    def clear_connection(self):
        self.pool.closeall()
