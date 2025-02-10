import threading
import time

import flask
import gevent
import gevent.pywsgi
import geventwebsocket.handler
import pytest
import socketio
import socketio.exceptions
from locust_cloud.websocket import SessionMismatchError, Websocket, WebsocketTimeout

LOCUSTCLOUD_SESSION_ID = "valid-session-id"


@pytest.fixture(scope="session", autouse=True)
def websocket_server():
    fake_server_not_ready_app = flask.Flask("be_quiet")

    @fake_server_not_ready_app.route("/not-ready/")
    def not_ready():
        return "", 503

    sio = socketio.Server(async_handlers=True, always_connect=False, async_mode="gevent", cors_allowed_origins="*")
    sio_app = socketio.WSGIApp(sio, fake_server_not_ready_app)
    server = gevent.pywsgi.WSGIServer(
        ("", 1095), sio_app, log=None, error_log=None, handler_class=geventwebsocket.handler.WebSocketHandler
    )

    slow_reconnect = threading.Event()

    @sio.event
    def connect(sid, environ, auth):  # noqa: ARG001
        print("Client connected to websocket server")

        if auth != LOCUSTCLOUD_SESSION_ID:
            print("Rejected connection because it was for the wrong session")
            raise socketio.exceptions.ConnectionRefusedError("Session mismatch")

        if slow_reconnect.is_set():
            slow_reconnect.clear()
            sio.sleep(2)

    @sio.event
    def disconnect(sid):  # noqa: ARG001
        print("Client disconnected from websocket server")

    @sio.event
    def trigger_shutdown(sid, data):  # noqa: ARG001
        print("Got told by test to trigger shutdown")
        sio.call("events", {"events": [{"type": "shutdown", "message": None}], "id": 1}, to=sid, timeout=5)

    @sio.event
    def trigger_slow_reconnect(sid, data):  # noqa: ARG001
        print("Got told by test to trigger reconnect failure")
        slow_reconnect.set()
        sio.disconnect(sid)

    @sio.event
    def trigger_stderr(sid, data):  # noqa: ARG001
        print("Got told by test to send messages on stderr")
        sio.call("events", {"events": [{"type": "stderr", "message": data}], "id": 1}, to=sid, timeout=5)
        sio.call("events", {"events": [{"type": "stderr", "message": data}], "id": 2}, to=sid, timeout=5)

    @sio.event
    def trigger_duplicate_stderr(sid, data):  # noqa: ARG001
        print("Got told by test to send duplicate messages on stderr")
        sio.call("events", {"events": [{"type": "stderr", "message": data}], "id": 3}, to=sid, timeout=5)
        sio.call("events", {"events": [{"type": "stderr", "message": data}], "id": 3}, to=sid, timeout=5)

    def start_websocket_server():
        print("Starting websocket server")
        server.serve_forever()

    server_greenlet = gevent.spawn(start_websocket_server)

    try:
        time.sleep(1)
        yield
    finally:
        server.stop()
        server_greenlet.kill(block=True, timeout=None)


def test_websocket_server_sends_shutdown():
    ws = Websocket()
    ws.initial_connect_timeout = 2
    ws.connect(
        "http://127.0.0.1:1095",
        auth=LOCUSTCLOUD_SESSION_ID,
    )

    ws.sio.call("trigger_shutdown", "")
    ws.wait_timeout = 5
    assert ws.wait(timeout=True)


def test_websocket_server_not_available_before_timeout():
    ws = Websocket()
    ws.initial_connect_timeout = 2

    with pytest.raises(WebsocketTimeout) as exception:
        ws.connect(
            "http://127.0.0.1:1095/not-ready",
            auth=LOCUSTCLOUD_SESSION_ID,
        )

    assert str(exception.value) == "Timed out connecting to locust master"


def test_websocket_server_rejects_session():
    ws = Websocket()

    with pytest.raises(SessionMismatchError) as exception:
        ws.connect(
            "http://127.0.0.1:1095",
            auth="invalid-session-id",
        )

    assert str(exception.value) == "The session from this run of locust-cloud did not match the one on the server"


def test_websocket_deduplication(capsys):
    ws = Websocket()
    ws.connect(
        "http://127.0.0.1:1095",
        auth=LOCUSTCLOUD_SESSION_ID,
    )

    ws.sio.call("trigger_stderr", "banana\n")
    captured = capsys.readouterr()
    assert captured.err == "banana\nbanana\n"

    ws.sio.call("trigger_duplicate_stderr", "pineapple\n")

    captured = capsys.readouterr()
    assert captured.err == "pineapple\n"


def test_websocket_failed_reconnect():
    # FIXME: This test needs to be placed last. It messes up connecting from subsequent tests and I can't be bothered to debug it right now.
    ws = Websocket()
    ws.reconnect_timeout = 1
    ws.connect(
        "http://127.0.0.1:1095",
        auth=LOCUSTCLOUD_SESSION_ID,
    )

    ws.sio.emit("trigger_slow_reconnect", "")
    time.sleep(0.5)

    ws.wait_timeout = 5

    with pytest.raises(WebsocketTimeout) as exception:
        ws.wait(timeout=True)

    assert str(exception.value) == "Timed out connecting to locust master"
