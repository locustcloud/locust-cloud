import atexit
import sys

import psycopg2
from flask import jsonify, request


class Api:
    def __init__(self, app, pg_host, pg_user, pg_password, pg_database, pg_port):
        try:
            self.app = app
            self.conn = psycopg2.connect(
                host=pg_host,
                user=pg_user,
                password=pg_password,
                database=pg_database,
                port=pg_port,
                keepalives_idle=120,
                keepalives_interval=20,
                keepalives_count=6,
            )
            self.cursor = self.conn.cursor()

            atexit.register(self._on_exit)

        except Exception:
            sys.stderr.write(f"Could not connect to postgres ({pg_user}@{pg_host}:{pg_port}).\n")
            sys.exit(1)

        self._register_routes()

    def _on_exit(self):
        self.conn.close()
        self.cursor.close()

    def _register_routes(self):
        @self.app.route("/cloud-stats/query", methods=["POST"])
        def query():
            assert request.method == "POST"

            self.cursor.execute("SELECT * FROM request")

            return jsonify({"results": self.cursor.fetchall()})
