"""
Drone incursion disruption event.

Distinct from `airspace_closure` in one way that changes the whole model: a
NOTAM'd closure publishes an end time, but a drone sighting suspends runway
operations for an **unknown** length of time. The field reopens when the search
comes up empty and re-closes on the next sighting, so:

  * duration is a *distribution* (log-normal, median 45 min, p95 3 h) rather
    than a fixed value — the optimizer solves across sampled durations, see
    `src/optimizer/uncertain.py`;
  * repeated suspensions from the same sighting are ONE incident, folded by
    `fold_into_incident()` instead of stacking as independent events.

Detection confidence matters: an unverified pilot report usually clears after a
single sweep, a corroborated radar / C-UAS track holds the field much longer.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from src.events.base import DisruptionEvent, EventKind

DETECTION_CONFIDENCE: dict[str, dict[str, Any]] = {
    "pilot_report": {
        "label": "Unverified pilot report",
        "median_scale": 0.7,
        "severity": "moderate",
    },
    "radar": {
        "label": "Corroborated radar / C-UAS track",
        "median_scale": 1.0,
        "severity": "severe",
    },
}

DEFAULT_MEDIAN_MINUTES = 45.0
DEFAULT_P95_MINUTES = 180.0


def detection_scale(detection: str) -> float:
    return float(DETECTION_CONFIDENCE.get(detection, DETECTION_CONFIDENCE["radar"])["median_scale"])


def duration_distribution(params: dict) -> dict:
    """The closure-length distribution declared by an event's params.

    The math that samples it lives with its consumer in
    `src/optimizer/uncertain.py`; this is only the declaration.
    """
    scale = detection_scale(str(params.get("detection", "radar")))
    median = float(params.get("median_minutes", DEFAULT_MEDIAN_MINUTES)) * scale
    p95 = float(params.get("p95_minutes", DEFAULT_P95_MINUTES)) * scale
    return {
        "kind": "lognormal",
        "median_minutes": round(median, 1),
        "p95_minutes": round(p95, 1),
    }


def fold_into_incident(active_events: list[dict], event: dict) -> tuple[int, dict] | None:
    """Fold a re-closure into the incident it belongs to.

    Returns ``(index, merged_event)`` when `event` is another suspension of an
    incursion already in flight (same kind, same ``incident_id``), else None.

    Tan Son Nhat on 11 Aug 2026 suspended operations twice — 18:16 and 19:40 —
    for one drone. Triggering that as two independent events would double-count
    the disruption and let an operator cancel half of it; folding keeps a single
    event whose exposure and uncertainty grow with each re-closure.
    """
    incident_id = (event.get("params") or {}).get("incident_id")
    if not incident_id:
        return None

    for idx, prior in enumerate(active_events):
        if prior.get("kind") != event.get("kind"):
            continue
        prior_params = prior.get("params") or {}
        if prior_params.get("incident_id") != incident_id:
            continue

        params = event.get("params") or {}
        closures = list(prior_params.get("closures") or [_closure(prior_params)])
        closures.append(_closure(params))
        total_median = sum(c["median_minutes"] for c in closures)

        merged_params = {
            **prior_params,
            **params,
            "closures": closures,
            "reopen_count": len(closures) - 1,
            "median_minutes": total_median,
            # ponytail: the re-closures' p95 keeps the first closure's relative
            # spread rather than convolving two log-normals — a defensible
            # "same uncertainty, more exposure" reading. Convolve properly only
            # if incidents with many re-closures start mattering.
            "p95_minutes": total_median
            * (
                float(prior_params.get("p95_minutes", DEFAULT_P95_MINUTES))
                / max(1e-6, float(prior_params.get("median_minutes", DEFAULT_MEDIAN_MINUTES)))
            ),
            "severity": _worst_severity(
                str(prior_params.get("severity", "moderate")),
                str(params.get("severity", "moderate")),
            ),
        }
        # The whole incident is re-read at the latest closure's detection
        # confidence: once radar corroborates a sighting that started as a
        # pilot report, the earlier suspension is part of a confirmed incident.
        merged_params["duration_hours"] = (
            duration_distribution(merged_params)["median_minutes"] / 60.0
        )
        merged = {
            **prior,
            **event,
            "id": prior.get("id", event.get("id")),
            "triggered_at": prior.get("triggered_at", event.get("triggered_at")),
            "params": merged_params,
        }
        return idx, merged

    return None


def _closure(params: dict) -> dict:
    return {
        "start": params.get("start", "T+0h"),
        "median_minutes": float(params.get("median_minutes", DEFAULT_MEDIAN_MINUTES)),
        "detection": params.get("detection", "radar"),
    }


_SEVERITY_ORDER = ["mild", "moderate", "severe", "extreme"]


def _worst_severity(a: str, b: str) -> str:
    rank = {s: i for i, s in enumerate(_SEVERITY_ORDER)}
    return a if rank.get(a, 1) >= rank.get(b, 1) else b


class DroneIncursionEvent(DisruptionEvent):
    """
    Drone incursion — runway operations suspended for an unknown duration.
    """

    kind: EventKind = EventKind.DRONE_INCURSION

    param_schema: dict = {
        "type": "object",
        "required": ["airport"],
        "properties": {
            "airport": {"type": "string", "description": "ICAO airport code", "example": "KDEN"},
            "runways": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Runway designators suspended; empty means the whole field",
                "default": [],
            },
            "detection": {
                "type": "string",
                "enum": list(DETECTION_CONFIDENCE.keys()),
                "description": "How the drone was detected — drives closure length",
                "default": "radar",
            },
            "median_minutes": {
                "type": "number",
                "description": "Median closure length (log-normal)",
                "default": DEFAULT_MEDIAN_MINUTES,
            },
            "p95_minutes": {
                "type": "number",
                "description": "95th-percentile closure length (log-normal)",
                "default": DEFAULT_P95_MINUTES,
            },
            "incident_id": {
                "type": "string",
                "description": "Groups repeated suspensions of the same sighting",
            },
            "severity": {
                "type": "string",
                "enum": ["mild", "moderate", "severe", "extreme"],
                "default": "severe",
            },
        },
    }

    @classmethod
    def default_scenario(cls) -> dict:
        return {
            "kind": "drone_incursion",
            "label": "Denver Drone Incursion",
            "description": (
                "A drone is tracked over the KDEN airfield; runway operations are "
                "suspended for an unknown length of time (median 45 min, p95 3 h)."
            ),
            "params": {
                "airport": "KDEN",
                "runways": ["16R", "17L"],
                "detection": "radar",
                "median_minutes": DEFAULT_MEDIAN_MINUTES,
                "p95_minutes": DEFAULT_P95_MINUTES,
                "severity": "severe",
            },
        }

    # ── Uncertain horizon ─────────────────────────────────────────────────

    def duration_distribution(self) -> dict:
        return duration_distribution(self.params)

    def duration(self) -> timedelta:
        """Point estimate — the distribution's median. Everything that needs a
        single number (event windows, the cascade predictor) uses this; the
        optimizer uses `duration_distribution()` instead."""
        return timedelta(minutes=self.duration_distribution()["median_minutes"])

    # ── Standard event interface ──────────────────────────────────────────

    def severity_label(self) -> str:
        airport = self.params.get("airport", "")
        detection = str(self.params.get("detection", "radar"))
        label = DETECTION_CONFIDENCE.get(detection, {}).get("label", detection)
        dist = self.duration_distribution()
        runways = self.params.get("runways") or []
        where = f"runway(s) {'/'.join(runways)}" if runways else "all runways"
        reopens = int(self.params.get("reopen_count", 0))
        again = f", {reopens} re-closure(s)" if reopens else ""
        return (
            f"{airport} drone incursion — {where} suspended ({label}{again}); "
            f"median {dist['median_minutes']:.0f} min, p95 {dist['p95_minutes']:.0f} min"
        )

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """Every flight touching the airport while operations are suspended."""
        airport = self.params.get("airport", "")
        start, end = self.event_window()
        return [f for f in schedule if self._flight_overlaps_window(f, start, end, airport=airport)]

    def constraints(self) -> list[dict]:
        return [
            {
                "type": "capacity_reduced",
                "airport": self.params.get("airport", ""),
                "runways": self.params.get("runways", []),
                "capacity_reduction_pct": float(self.params.get("capacity_cut_pct", 100)),
                "detection": self.params.get("detection", "radar"),
                "start": self.params.get("start", "T+0h"),
                # No `end`: that is the whole point of this event type.
                "duration_dist": self.duration_distribution(),
                "reopen_count": int(self.params.get("reopen_count", 0)),
            }
        ]
