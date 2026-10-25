"""Worker as a Render *Web Service* (free tier has no Background Workers).

Main thread: a tiny HTTP server on $PORT (Render health checks + wake-up
pings from the web app). Background thread: the unchanged queue loop from
worker.py. Standard library only.

  GET /health  → 200 {"status": "healthy"} while the queue thread is alive,
                 503 if it has died (so Render restarts the instance).

Free instances sleep after ~15 min without inbound HTTP; the web app pings
WORKER_WAKE_URL whenever it queues a job (src/lib/worker-ping.ts). Jobs
queued while asleep simply wait in Postgres until the instance wakes.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from worker import HANDLERS, WORKER_ID, Worker, configure_logging, database_url

log = logging.getLogger("worker.server")


def make_handler(queue_thread: threading.Thread):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (http.server naming)
            if self.path.split("?")[0] not in ("/health", "/"):
                self._send(404, {"error": "not found"})
            elif queue_thread.is_alive():
                self._send(200, {"status": "healthy"})
            else:
                self._send(503, {"status": "unhealthy", "reason": "queue thread stopped"})

        do_HEAD = do_GET  # noqa: N815

        def _send(self, code: int, body: dict) -> None:
            payload = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)

        def log_message(self, *_: Any) -> None:
            pass  # health checks every few seconds would drown the job logs

    return Handler


def main() -> None:
    configure_logging()
    worker = Worker(database_url())
    queue_thread = threading.Thread(target=worker.run_forever, name="queue", daemon=True)
    queue_thread.start()

    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(queue_thread))

    def shutdown(*_: Any) -> None:
        # Stop claiming, let the current job finish (bounded by Render's grace
        # period; a hard kill is covered by job lock expiry), then stop HTTP.
        # server.shutdown() blocks until serve_forever exits, so call it off-thread.
        worker.stop()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    log.info("worker %s: http on 0.0.0.0:%d, polling for %s", WORKER_ID, port, ", ".join(HANDLERS))
    server.serve_forever()
    queue_thread.join(timeout=25)
    log.info("server stopped")


if __name__ == "__main__":
    main()
