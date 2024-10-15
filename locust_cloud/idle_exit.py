import logging
import sys

import gevent
import locust.env
from locust import events

logger = logging.getLogger(__name__)


class IdleExit:
    def __init__(self, environment: locust.env.Environment):
        self.environment = environment
        self._destroy_task = None
        events.test_start.add_listener(self.on_locust_state_change)
        events.test_stop.add_listener(self.on_test_stop)
        events.quit.add_listener(self.on_locust_state_change)

    def _destroy(self):
        gevent.sleep(10)
        logger.info("Locust was detected as idle, shutting down...")
        self.environment.runner.quit()
        sys.exit(0)

    def on_test_stop(self, **_kwargs):
        self._destroy_task = gevent.spawn(self._destroy)

    def on_locust_state_change(self, **_kwargs):
        if self._destroy_task:
            self._destroy_task.kill()
