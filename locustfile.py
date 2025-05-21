# Simple locustfile for testing against example target
import pathlib
import random

from locust import FastHttpUser, run_single_user, task  # pyright: ignore [reportMissingImports]

product_ids = [1, 2, 42, 4711]


class MyUser(FastHttpUser):
    @task
    def t(self) -> None:
        with self.rest("POST", "/authenticate", json={"username": "foo", "password": "bar"}) as resp:
            if error := resp.js.get("error"):
                resp.failure(error)

        for product_id in random.sample(product_ids, 2):
            with self.rest("POST", "/cart/add", json={"productId": product_id}) as resp:
                pass

        with self.rest("POST", "/checkout/confirm") as resp:
            if not resp.js.get("orderId"):
                resp.failure("orderId missing")


extra = pathlib.Path("testdata/extra-files/extra.txt")
if extra.exists():
    print("--extra-files verification:", extra.read_text())

try:
    import example  # type: ignore

    example.hello()
except ImportError:
    pass  # ignore this for local runs

try:
    import dotenv  # type: ignore # noqa: F401

    print("dotenv imported successfully, --requirements seems to be working")
except ImportError:
    pass  # ignore this for local runs


if __name__ == "__main__":
    run_single_user(MyUser)
