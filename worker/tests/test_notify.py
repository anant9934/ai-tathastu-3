"""Run from worker/:  python -m pytest -q   (no DB, no network)."""

import json
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import notify  # noqa: E402
from jobs import Job  # noqa: E402
from worker import Worker  # noqa: E402


def job(type_: str) -> Job:
    return Job(id="11111111-1111-4111-8111-111111111111", type=type_, user_id="u", payload={}, attempts=1, max_attempts=3)


class NotifyTests(unittest.TestCase):
    def test_posts_job_id_with_bearer_secret(self):
        seen = {}

        class Res:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return b'{"sent": "resume_ready"}'

        def fake_urlopen(req, timeout):
            seen["url"], seen["auth"], seen["body"] = req.full_url, req.get_header("Authorization"), json.loads(req.data)
            return Res()

        with mock.patch.dict(os.environ, {"APP_URL": "https://app.example/"}), mock.patch.object(
            notify.urllib.request, "urlopen", fake_urlopen
        ):
            notify._post("job-1", "s" * 40)
        self.assertEqual(seen["url"], "https://app.example/api/internal/notify")
        self.assertEqual(seen["auth"], "Bearer " + "s" * 40)
        self.assertEqual(seen["body"], {"jobId": "job-1"})

    def test_noop_without_secret(self):
        with mock.patch.dict(os.environ, {"INTERNAL_API_SECRET": ""}), mock.patch.object(notify.threading, "Thread") as t:
            notify.notify_job("job-1")
        t.assert_not_called()

    def test_network_errors_never_raise(self):
        with mock.patch.object(notify.urllib.request, "urlopen", side_effect=OSError("down")):
            notify._post("job-1", "s" * 40)  # logs, doesn't raise

    def test_which_outcomes_notify(self):
        with mock.patch("worker.notify_job") as n, mock.patch("worker.notify_profile_updated") as p:
            Worker.notify(job("resume_extract"), "done")
            Worker.notify(job("resume_extract"), "failed")
            Worker.notify(job("connector_sync"), "needs_review")
            Worker.notify(job("connector_sync"), "done")  # a healthy sync: no email
            Worker.notify(job("compute_intelligence"), "done")
            Worker.notify(job("compute_intelligence"), "failed")
        self.assertEqual(n.call_count, 3)
        p.assert_called_once_with("11111111-1111-4111-8111-111111111111", "u")


if __name__ == "__main__":
    unittest.main()
