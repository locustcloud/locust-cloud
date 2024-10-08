import logging
import time
from datetime import UTC, datetime
from typing import Any

import boto3
import jwt
import requests
from botocore.credentials import RefreshableCredentials
from botocore.session import Session as BotocoreSession

logger = logging.getLogger(__name__)


class CredentialError(Exception):
    """Custom exception for credential-related errors."""

    pass


class CredentialManager:
    def __init__(
        self,
        lambda_url: str,
        username: str | None = None,
        password: str | None = None,
        user_sub_id: str | None = None,
        refresh_token: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
    ) -> None:
        self.lambda_url = lambda_url
        self.username = username
        self.password = password
        self.user_sub_id = user_sub_id
        self.refresh_token = refresh_token

        self.credentials = {
            "access_key": access_key,
            "secret_key": secret_key,
        }
        self.cognito_client_id_token: str = ""
        self.expiry_time: float = 0

        self.obtain_credentials()

        self.refreshable_credentials = RefreshableCredentials.create_from_metadata(
            metadata=self.get_current_credentials(),
            refresh_using=self.refresh_credentials,
            method="custom-refresh",
        )

        botocore_session = BotocoreSession()
        botocore_session._credentials = self.refreshable_credentials  # type: ignore
        botocore_session.set_config_variable("signature_version", "v4")

        self.session = boto3.Session(botocore_session=botocore_session)
        logger.debug("Boto3 session created with RefreshableCredentials.")

    def obtain_credentials(self) -> None:
        payload = {}
        if self.username and self.password:
            payload = {"username": self.username, "password": self.password}
        elif self.user_sub_id and self.refresh_token:
            payload = {"user_sub_id": self.user_sub_id, "refresh_token": self.refresh_token}
        else:
            raise CredentialError("Insufficient credentials to obtain AWS session.")

        try:
            response = requests.post(f"{self.lambda_url}/auth/login", json=payload)
            response.raise_for_status()
            data = response.json()

            token_key = next(
                (key for key in ["cognito_client_id_token", "id_token", "access_token"] if key in data), None
            )

            if not token_key:
                raise CredentialError("No valid token found in authentication response.")

            self.credentials = {
                "access_key": data.get("aws_access_key_id"),
                "secret_key": data.get("aws_secret_access_key"),
                "token": data.get("aws_session_token"),
            }

            token = data.get(token_key)
            if not token:
                raise CredentialError(f"Token '{token_key}' is missing in the authentication response.")

            decoded = jwt.decode(token, options={"verify_signature": False})
            self.expiry_time = decoded.get("exp", time.time() + 3600) - 60  # Refresh 1 minute before expiry

            self.cognito_client_id_token = token

        except requests.exceptions.HTTPError as http_err:
            response = http_err.response
            if response is not None and response.status_code == 401:
                raise CredentialError("Incorrect username or password.") from http_err
            else:
                error_info = f"HTTP {response.status_code} {response.reason}" if response else "No response received."
                raise CredentialError(f"HTTP error occurred while obtaining credentials: {error_info}") from http_err
        except requests.exceptions.RequestException as req_err:
            raise CredentialError(f"Request exception occurred while obtaining credentials: {req_err}") from req_err
        except jwt.DecodeError as decode_err:
            raise CredentialError(f"Failed to decode JWT token: {decode_err}") from decode_err
        except KeyError as key_err:
            raise CredentialError(f"Missing expected key in authentication response: {key_err}") from key_err

    def refresh_credentials(self) -> dict[str, Any]:
        logger.debug("Refreshing credentials using refresh_credentials method.")
        self.obtain_credentials()
        return {
            "access_key": self.credentials.get("access_key"),
            "secret_key": self.credentials.get("secret_key"),
            "token": self.credentials.get("token"),
            "expiry_time": datetime.fromtimestamp(self.expiry_time, tz=UTC).isoformat(),
        }

    def get_current_credentials(self) -> dict[str, Any]:
        if not self.cognito_client_id_token:
            raise CredentialError("cognito_client_id_token not set in CredentialManager.")

        return {
            "access_key": self.credentials.get("access_key"),
            "secret_key": self.credentials.get("secret_key"),
            "token": self.credentials.get("token"),
            "expiry_time": datetime.fromtimestamp(self.expiry_time, tz=UTC).isoformat(),
            "cognito_client_id_token": self.cognito_client_id_token,
        }
