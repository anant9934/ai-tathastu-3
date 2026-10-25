"""Shared job types for handlers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class Job:
    id: str
    type: str
    user_id: str
    payload: Dict[str, Any]
    attempts: int
    max_attempts: int


class NeedsReview(Exception):
    """Raise from a handler when a human must look at the job; it is not retried."""
