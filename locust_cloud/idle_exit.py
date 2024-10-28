import logging
import sys

import gevent
import locust.env
from locust import events

logger = logging.getLogger(__name__)


class IdleExit:
    def __init__(self, environment: locust.env.Environment):
        self.environment = environment
        self._destroy_task: gevent.Greenlet | None = None
        events.test_start.add_listener(self.on_locust_state_change)
        events.test_stop.add_listener(self.on_test_stop)
        events.quit.add_listener(self.on_locust_state_change)

        if not self.environment.parsed_options.autostart:
            self._destroy_task = gevent.spawn(self._destroy)

    def _destroy(self):
        gevent.sleep(1800)
        logger.info("Locust was detected as idle (no test running) for more than 30 minutes")
        self.environment.runner.quit()

        if self.environment.web_ui:
            self.environment.web_ui.greenlet.kill(timeout=5)

            if self.environment.web_ui.greenlet.started:
                sys.exit(1)

    def on_test_stop(self, **kwargs):
        self._destroy_task = gevent.spawn(self._destroy)

    def on_locust_state_change(self, **kwargs):
        if self._destroy_task:
            self._destroy_task.kill()
