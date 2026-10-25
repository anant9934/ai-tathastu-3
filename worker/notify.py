"""Email notifications for finished jobs.

Render's free tier blocks outbound SMTP (ports 25/465/587), so the worker
can't talk to Gmail. Instead it asks the web app to send:
POST {APP_URL}/api/internal/notify {"jobId": ...} with INTERNAL_API_SECRET.
The app decides from the database whether an email is due (resume ready or
failed, a connector the user must fix) and sends each one at most once.

Fire-and-forget on a daemon thread: a slow or failing call never holds up
the queue, and a job's outcome never depends on it. No-op without the secret.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import urllib.error
import urllib.request

log = logging.getLogger("worker.notify")

TIMEOUT_S = 20  # a cold Vercel function + an SMTP round trip


def _endpoint(path: str = "/api/internal/notify") -> str:
    return os.environ.get("APP_URL", "https://www.aitathastu.com").rstrip("/") + path


def _post(job_id: str, secret: str, path: str = "/api/internal/notify", body: dict | None = None) -> None:
    req = urllib.request.Request(
        _endpoint(path),
        data=json.dumps(body or {"jobId": job_id}).encode(),
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
            "User-Agent": "ai-tathastu-worker/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
            reply = json.loads(res.read() or b"{}")
            log.info("notify job %s: %s", job_id, reply.get("sent") or reply.get("queued") or "nothing due")
    except urllib.error.HTTPError as exc:
        log.warning("notify job %s: HTTP %s", job_id, exc.code)
    except Exception as exc:  # noqa: BLE001 - notifications are best effort
        log.warning("notify job %s failed: %s", job_id, exc)


def notify_job(job_id: str) -> None:
    secret = os.environ.get("INTERNAL_API_SECRET", "")
    if not secret:
        return
    threading.Thread(target=_post, args=(job_id, secret), name=f"notify-{job_id}", daemon=True).start()


def notify_profile_updated(job_id: str, user_id: str) -> None:
    """After compute_intelligence: linked apps (Collaborate, Meet) get a profile.updated webhook."""
    secret = os.environ.get("INTERNAL_API_SECRET", "")
    if not secret:
        return
    body = {"userId": user_id, "reason": "profile_recomputed"}
    threading.Thread(
        target=_post, args=(job_id, secret, "/api/internal/profile-updated", body), name=f"profile-{job_id}", daemon=True
    ).start()
