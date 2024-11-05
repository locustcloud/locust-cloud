import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any, TypedDict, cast

import locust.env
import requests
import werkzeug
from flask import Blueprint, redirect, request, session, url_for
from flask_login import UserMixin, login_user
from locust.html import render_template_from
from locust_cloud import __version__
from locust_cloud.constants import DEFAULT_DEPLOYER_URL

DEPLOYER_URL = os.environ.get("LOCUSTCLOUD_DEPLOYER_URL", DEFAULT_DEPLOYER_URL)
ALLOW_SIGNUP = os.environ.get("ALLOW_SIGNUP", True)


logger = logging.getLogger(__name__)


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

    web_base_path = environment.parsed_options.web_base_path
    auth_blueprint = Blueprint("locust_cloud_auth", __name__, url_prefix=web_base_path)

    def load_user(user_sub_id: str):
        username = request.cookies.get("username")
        refresh_token = request.cookies.get("user_token")

        if refresh_token:
            environment.web_ui.template_args["username"] = username
            return AuthUser(user_sub_id)

        return None

    environment.web_ui.login_manager.user_loader(load_user)
    environment.web_ui.auth_args = cast(
        Any,
        {
            "username_password_callback": f"{web_base_path}/authenticate",
        },
    )

    if ALLOW_SIGNUP:
        environment.web_ui.auth_args["auth_providers"] = [
            {"label": "Sign Up", "callback_url": f"{web_base_path}/signup"}
        ]

    @auth_blueprint.route("/authenticate", methods=["POST"])
    def login_submit():
        username = request.form.get("username", "")
        password = request.form.get("password")

        try:
            auth_response = requests.post(
                f"{DEPLOYER_URL}/auth/login",
                json={"username": username, "password": password},
                headers={"X-Client-Version": __version__},
            )

            auth_response.raise_for_status()

            credentials = auth_response.json()
            response = redirect(url_for("locust.index"))
            response = set_credentials(username, credentials, response)
            login_user(AuthUser(credentials["user_sub_id"]))

            return response
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                session["auth_error"] = "Invalid username or password"
            else:
                logger.error(f"Unknown response from auth: {e.response.status_code} {e.response.text}")

                session["auth_error"] = "Unknown error during authentication, check logs and/or contact support"

            return redirect(url_for("locust.login"))

    @auth_blueprint.route("/signup")
    def signup():
        if not ALLOW_SIGNUP:
            return redirect(url_for("locust.login"))

        if session.get("username"):
            sign_up_args = {
                "custom_form": {
                    "inputs": [
                        {
                            "label": "Confirmation Code",
                            "name": "confirmation_code",
                        },
                    ],
                    "callback_url": f"{web_base_path}/confirm-signup",
                    "submit_button_text": "Confirm Email",
                },
                "info": "Please check your email and enter the confirmation code",
            }
        else:
            sign_up_args = {
                "custom_form": {
                    "inputs": [
                        {
                            "label": "Username",
                            "name": "username",
                        },
                        {
                            "label": "Password",
                            "name": "password",
                            "is_secret": True,
                        },
                        {
                            "label": "Access Code",
                            "name": "access_code",
                        },
                    ],
                    "callback_url": f"{web_base_path}/create-account",
                    "submit_button_text": "Sign Up",
                },
            }

        if session.get("auth_sign_up_error"):
            sign_up_args["error"] = session["auth_sign_up_error"]

        return render_template_from(
            "auth.html",
            auth_args=sign_up_args,
        )

    @auth_blueprint.route("/create-account", methods=["POST"])
    def create_account():
        if not ALLOW_SIGNUP:
            return redirect(url_for("locust.login"))

        session["auth_sign_up_error"] = ""

        username = request.form.get("username", "")
        password = request.form.get("password")
        access_code = request.form.get("access_code")

        try:
            auth_response = requests.post(
                f"{DEPLOYER_URL}/auth/signup",
                json={"username": username, "password": password, "access_code": access_code},
            )

            auth_response.raise_for_status()

            session["user_sub"] = auth_response.json().get("user_sub")
            session["username"] = username

            return redirect(url_for("locust_cloud_auth.signup"))
        except requests.exceptions.HTTPError as e:
            message = e.response.json().get("Message")
            session["auth_sign_up_error"] = message

            return redirect(url_for("locust_cloud_auth.signup"))

    @auth_blueprint.route("/confirm-signup", methods=["POST"])
    def confirm_signup():
        if not ALLOW_SIGNUP:
            return redirect(url_for("locust.login"))

        session["auth_sign_up_error"] = ""
        confirmation_code = request.form.get("confirmation_code")

        try:
            auth_response = requests.post(
                f"{DEPLOYER_URL}/auth/confirm-signup",
                json={
                    "username": session.get("username"),
                    "user_sub": session["user_sub"],
                    "confirmation_code": confirmation_code,
                },
            )

            auth_response.raise_for_status()

            session["username"] = None
            session["auth_info"] = "Account created successfully!"

            return redirect(url_for("locust.login"))
        except requests.exceptions.HTTPError as e:
            message = e.response.json().get("Message")
            session["auth_sign_up_error"] = message

            return redirect(url_for("locust_cloud_auth.signup"))

    environment.web_ui.app.register_blueprint(auth_blueprint)
