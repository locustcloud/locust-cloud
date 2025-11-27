import sys
import time
import webbrowser

import requests
from locust_cloud.common import CloudConfig, get_api_url, write_cloud_config

POLLING_FREQUENCY = 1


def web_login() -> None:
    try:
        response = requests.post(f"{get_api_url('us-east-1')}/cli-auth")
        response.raise_for_status()
        response_data = response.json()
        authentication_url = response_data["authentication_url"]
        result_url = response_data["result_url"]
    except Exception as e:
        print("Something went wrong trying to authorize the locust-cloud CLI:", str(e))
        sys.exit(1)

    message = f"""
Attempting to automatically open the SSO authorization page in your default browser.
If the browser does not open or you wish to use a different device to authorize this request, open the following URL:

{authentication_url}
    """.strip()
    print(message)

    webbrowser.open_new_tab(authentication_url)

    try:
        retries = 0
        while True:
            response = requests.get(result_url)

            if not response.ok:
                print(f"Could not login to Locust Cloud: {response.text}")
                sys.exit(1)

            data = response.json()

            if data["state"] == "pending":
                if retries == 10:
                    print("\nWaiting for response from login...")

                retries += 1
                time.sleep(POLLING_FREQUENCY)
                continue
            elif data["state"] == "failed":
                print(f"\nFailed to authorize CLI: {data['reason']}")
                sys.exit(1)
            elif data["state"] == "authorized":
                print("\nAuthorization succeded. Now you can start a cloud run using: locust --cloud ...")
                break
            else:
                print("\nGot unexpected response when authorizing CLI")
                sys.exit(1)

        config = CloudConfig(
            id_token=data["id_token"],
            refresh_token=data["refresh_token"],
            user_sub_id=data["user_sub_id"],
            refresh_token_expires=data["refresh_token_expires"],
            id_token_expires=data["id_token_expires"],
            region=data["region"],
        )
        write_cloud_config(config)
    except KeyboardInterrupt:
        pass  # don't show nasty callstack
    except Exception as e:
        print(f"Could not login to Locust Cloud: {e.__class__.__name__}:{e}")
