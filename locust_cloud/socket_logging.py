import atexit
import logging
import os
import sys
from collections import deque
from contextlib import suppress

import flask
import gevent
import gevent.pywsgi
import geventwebsocket.handler
import socketio


def setup_socket_logging():
    """
    Set up a separate server listening for incomming websocket connections.
    Because it listens on a separate port from the webui and the ALB only
    accepts connections on port 443, this will be exposed on a different
    path (/<customer-id>/socket-logs) with a separate target group.
    The targetgroup will want to do health checks before exposing the server
    so a small flask app exposing the health check endpoint is added to the
    server in addition to the websocket stuff.
    """

    logger = logging.getLogger(__name__)
    logger.propagate = False
    logger.addHandler(logging.NullHandler())

    # This app will use a logger with the same name as the application
    # which means it will pick up the one set up above.
    healthcheck_app = flask.Flask(__name__)

    # /login is the health check endpoint currently configured for the
    # ALB controller in kubernetes.
    # See cloud-onboarder/kubernetes/alb-load-balancer-ingress.yaml
    @healthcheck_app.route("/login")
    def healthcheck():
        return ""

    sio = socketio.Server(async_handlers=True, always_connect=True, async_mode="gevent", cors_allowed_origins="*")
    sio_app = socketio.WSGIApp(sio, healthcheck_app, socketio_path=f"/{os.environ['CUSTOMER_ID']}/socket-logs")
    message_queue = deque(maxlen=500)

    class QueueCopyStream:
        def __init__(self, name, original):
            self.name = name
            self.original = original

        def write(self, message):
            self.original.write(message)
            message_queue.append((self.name, message))

        def flush(self):
            self.original.flush()

    def connected_sid():
        for rooms in sio.manager.rooms.values():
            for clients in rooms.values():
                for sid in clients.keys():
                    return sid

    def emitter():
        while True:
            while message_queue and (sid := connected_sid()):
                name, message = message_queue[0]

                with suppress(TimeoutError):
                    sio.call(name, message, to=sid, timeout=5)
                    message_queue.popleft()

                    if name == "shutdown":
                        return

            gevent.sleep(1)

    emitter_greenlet = gevent.spawn(emitter)

    sys.stderr = QueueCopyStream("stderr", sys.stderr)
    sys.stdout = QueueCopyStream("stdout", sys.stdout)

    @atexit.register
    def notify_shutdown(*args, **kwargs):
        message_queue.append(("shutdown", ""))
        emitter_greenlet.join(timeout=30)

    class WebSocketHandlerWithoutLogging(geventwebsocket.handler.WebSocketHandler):
        """
        Subclassing WebSocketHandler so it doesn't set a logger on
        the server that I've explicitly configured not to have one.
        """

        @property
        def logger(self):
            return logger

    @gevent.spawn
    def start_websocket_server():
        server = gevent.pywsgi.WSGIServer(
            ("", 1095), sio_app, log=None, error_log=None, handler_class=WebSocketHandlerWithoutLogging
        )
        server.serve_forever()
        gevent.get_hub().join()
