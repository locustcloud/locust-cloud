import os
from datetime import UTC, datetime, timedelta
from typing import TypedDict

import locust.env
import requests
import werkzeug
from flask import redirect, request, url_for
from flask_login import UserMixin, login_user
from locust_cloud.constants import (
    DEFAULT_DEPLOYER_URL,
)

DEPLOYER_URL = os.environ.get("LOCUSTCLOUD_DEPLOYER_URL", DEFAULT_DEPLOYER_URL)


class Credentials(TypedDict):
    user_sub_id: str
    refresh_token: str


class AuthUser(UserMixin):
    def __init__(self, user_sub_id: str):
        self.user_sub_id = user_sub_id

    def get_id(self):
        return self.user_sub_id


def set_credentials(username: str, credentials: Credentials, response: werkzeug.wrappers.response.Response):
    if not credentials.get("user_sub_id"):
        return response

    user_sub_id = credentials["user_sub_id"]
    refresh_token = credentials["refresh_token"]

    response.set_cookie("username", username, expires=datetime.now(tz=UTC) + timedelta(days=365))
    response.set_cookie("user_token", refresh_token, expires=datetime.now(tz=UTC) + timedelta(days=365))
    response.set_cookie("user_sub_id", user_sub_id, expires=datetime.now(tz=UTC) + timedelta(days=365))

    return response


def register_auth(environment: locust.env.Environment):
    environment.web_ui.app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    environment.web_ui.app.debug = False

    def load_user(user_sub_id: str):
        username = request.cookies.get("username")
        refresh_token = request.cookies.get("user_token")

        if refresh_token:
            environment.web_ui.template_args["username"] = username
            return AuthUser(user_sub_id)

        return None

    environment.web_ui.login_manager.user_loader(load_user)
    environment.web_ui.auth_args = {
        "username_password_callback": "/authenticate",
    }

    @environment.web_ui.app.route("/authenticate", methods=["POST"])
    def login_submit():
        username = request.form.get("username", "")
        password = request.form.get("password")

        try:
            auth_response = requests.post(
                f"{DEPLOYER_URL}/auth/login",
                json={"username": username, "password": password},
            )

            if auth_response.status_code == 200:
                credentials = auth_response.json()
                response = redirect(url_for("index"))
                response = set_credentials(username, credentials, response)
                login_user(AuthUser(credentials["user_sub_id"]))

                return response

            environment.web_ui.auth_args = {**environment.web_ui.auth_args, "error": "Invalid username or password"}

            return redirect(url_for("login"))
        except Exception:
            environment.web_ui.auth_args = {
                **environment.web_ui.auth_args,
                "error": "An unknown error occured, please try again",
            }

            return redirect(url_for("login"))
