"""Dashboard widget scoring: P(w) = αI + βG + γR + δF (plan §2.3)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from intelligence.config import STALE_THRESHOLD_HOURS, WEIGHTS, WIDGETS, WidgetDef


def intent_score(widget: WidgetDef, priorities: List[str]) -> float:
    """1.0 if the primary priority is one the widget serves, 0.5 for a secondary one."""
    if priorities and priorities[0] in widget.required_intent:
        return 1.0
    if any(p in widget.required_intent for p in priorities[1:]):
        return 0.5
    return 0.0


def goal_score(widget: WidgetDef, role: Optional[str]) -> float:
    if not role:
        return widget.default_affinity
    return widget.affinity.get(role, widget.default_affinity)


def readiness_score(widget: WidgetDef, groups_with_data: Set[str]) -> float:
    if not widget.required_data:
        return 1.0
    return sum(1 for g in widget.required_data if g in groups_with_data) / len(widget.required_data)


def freshness_score(widget: WidgetDef, last_sync: Dict[str, Optional[datetime]], now: datetime) -> float:
    if not widget.freshness_source:
        return 1.0
    synced = last_sync.get(widget.freshness_source)
    if not synced:
        return 0.0
    hours = (now - synced).total_seconds() / 3600
    return max(0.0, 1 - hours / STALE_THRESHOLD_HOURS)


def score_widgets(
    *,
    priorities: List[str],
    role: Optional[str],
    persona: str = "student",
    groups_with_data: Set[str],
    last_sync: Dict[str, Optional[datetime]],
    eligible: Dict[str, bool],
    data: Dict[str, Any],
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Ordered widget list for profile_views.view: widgets with something to show
    by P(w) descending (previews count as having something to show), then `empty` ones (no data yet, e.g. job_matches before
    Avasar is connected) by P(w) after them. Ineligible widgets are left out.
    Dismiss/pin (widget_prefs) are applied at read time by the web app.
    """
    now = now or datetime.now(timezone.utc)
    out = []
    for w in WIDGETS:
        if persona not in w.personas or not eligible.get(w.id, True):
            continue
        parts = {
            "I": intent_score(w, priorities),
            "G": goal_score(w, role),
            "R": readiness_score(w, groups_with_data),
            "F": freshness_score(w, last_sync, now),
        }
        score = (
            WEIGHTS["alpha"] * parts["I"] + WEIGHTS["beta"] * parts["G"]
            + WEIGHTS["gamma"] * parts["R"] + WEIGHTS["delta"] * parts["F"]
        )
        widget_data = data.get(w.id)
        state = (
            "preview" if w.preview
            else "stale" if w.freshness_source and parts["F"] == 0
            else "empty" if widget_data is None
            else "partial" if parts["R"] < 1
            else "ready"
        )
        out.append({
            "id": w.id,
            "module": w.module,
            "label": w.label,
            "score": round(score, 4),
            "components": {k: round(v, 3) for k, v in parts.items()},
            "state": state,
            "data": widget_data,
        })
    return sorted(out, key=lambda x: (x["state"] == "empty", -x["score"], x["id"]))
