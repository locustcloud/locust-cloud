# Simple locustfile for testing against example target
import random

from locust import FastHttpUser, run_single_user, task

product_ids = [1, 2, 42, 4711]


class MyUser(FastHttpUser):
    @task
    def t(self) -> None:
        with self.rest("POST", "/authenticate", json={"username": "foo", "password": "bar"}) as resp:
            if error := resp.js.get("error"):
                resp.failure(error)

        for product_id in random.sample(product_ids, 2):
            with self.rest("POST", "/add_to_cart", json={"product_id": product_id}) as resp:
                pass

        with self.rest("POST", "/checkout/confirm") as resp:
            if not resp.js.get("orderId"):
                resp.failure("orderId missing")


if __name__ == "__main__":
    run_single_user(MyUser)
