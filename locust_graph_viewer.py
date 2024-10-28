from locust import HttpUser, events


class WebsiteUser(HttpUser):
    host = "None"


@events.init.add_listener
def locust_init(environment, **kwargs):
    environment.web_ui.template_args["isGraphViewer"] = True
