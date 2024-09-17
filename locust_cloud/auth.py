import datetime
import os

import requests
from flask import redirect, request, url_for
from flask_login import UserMixin, current_user, login_user

LAMBDA = "https://deployer.locust.cloud/1"


class AuthUser(UserMixin):
    def __init__(self, user_sub_id):
        self.user_sub_id = user_sub_id

    def get_id(self):
        return self.user_sub_id


def set_credentials(credentials, response):
    id_token = credentials["cognito_client_id_token"]
    user_sub_id = credentials["user_sub_id"]
    refresh_token = credentials["refresh_token"]

    response.set_cookie("cognito_token", id_token, expires=datetime.datetime.utcnow() + datetime.timedelta(days=1))
    response.set_cookie("user_token", refresh_token, expires=datetime.datetime.utcnow() + datetime.timedelta(days=365))
    response.set_cookie("user_sub_id", user_sub_id, expires=datetime.datetime.utcnow() + datetime.timedelta(days=365))

    return response


def load_user(user_sub_id):
    refresh_token = request.cookies.get("user_token")

    if refresh_token:
        return AuthUser(user_sub_id)

    return None


def register_auth(environment):
    environment.web_ui.app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    environment.web_ui.app.debug = False
    environment.web_ui.login_manager.user_loader(load_user)
    environment.web_ui.auth_args = {
        "username_password_callback": "/authenticate",
    }

    @environment.web_ui.app.after_request
    def refresh_handler(response):
        if request.path == "/" and current_user:
            refresh_token = request.cookies.get("user_token")
            user_sub_id = request.cookies.get("user_sub_id")
            if user_sub_id and refresh_token:
                auth_response = requests.post(
                    f"{LAMBDA}/auth/login", json={"user_sub_id": user_sub_id, "refresh_token": refresh_token}
                )
                credentials = auth_response.json()
                response = set_credentials(credentials, response)

        return response

    @environment.web_ui.app.route("/authenticate")
    def login_submit():
        username = request.args.get("username")
        password = request.args.get("password")

        try:
            auth_response = requests.post(f"{LAMBDA}/auth/login", json={"username": username, "password": password})

            if auth_response.status_code == 200:
                credentials = auth_response.json()
                response = redirect(url_for("index"))
                response = set_credentials(credentials, response)
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
