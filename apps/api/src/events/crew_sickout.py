"""
Crew sickout / mass callout disruption event.
Models mass crew unavailability due to illness, labor action, or crew rest violations.
"""

import hashlib
import random
from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

SICKOUT_TYPES = {
    "illness_outbreak": {
        "description": "Illness outbreak causing mass crew callouts",
        "default_duration_h": 24.0,
    },
    "labor_action": {
        "description": "Coordinated sick-out / work-to-rule action",
        "default_duration_h": 48.0,
    },
    "rest_violation": {
        "description": "FAR 117 rest violations rendering crew unavailable",
        "default_duration_h": 10.0,
    },
    "single_callout": {
        "description": "Individual crew member sick call",
        "default_duration_h": 8.0,
    },
    "domino": {
        "description": "Cascading callouts from delayed inbound crew",
        "default_duration_h": 6.0,
    },
}


class CrewSickoutEvent(DisruptionEvent):
    """
    Crew sickout disruption — a percentage of crew at one or more bases
    become unavailable, creating open pairings.
    """

    kind: EventKind = EventKind.CREW_SICKOUT

    param_schema: dict = {
        "type": "object",
        "required": ["sickout_type"],
        "properties": {
            "sickout_type": {
                "type": "string",
                "enum": list(SICKOUT_TYPES.keys()),
                "default": "illness_outbreak",
            },
            "affected_bases": {
                "type": "array",
                "items": {"type": "string"},
                "description": "ICAO codes of affected crew bases (empty = system-wide)",
                "default": ["KORD"],
            },
            "affected_roles": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["captain", "first_officer", "flight_attendant"],
                },
                "description": "Affected crew roles",
                "default": ["captain", "first_officer"],
            },
            "callout_pct": {
                "type": "number",
                "description": "Percentage of crew calling out (0-100)",
                "default": 15,
            },
            "duration_hours": {
                "type": "number",
                "description": "Duration in hours (0 = use type default)",
                "default": 0,
            },
            "severity": {
                "type": "string",
                "enum": ["mild", "moderate", "severe", "extreme"],
                "default": "moderate",
            },
        },
    }

    @classmethod
    def default_scenario(cls) -> dict:
        return {
            "kind": "crew_sickout",
            "label": "ORD Pilot Illness Outbreak",
            "description": "Illness outbreak at Chicago base takes 15% of pilots offline for 24 hours creating widespread open pairings",
            "params": {
                "sickout_type": "illness_outbreak",
                "affected_bases": ["KORD"],
                "affected_roles": ["captain", "first_officer"],
                "callout_pct": 15,
                "duration_hours": 24,
                "severity": "moderate",
            },
        }

    def duration(self) -> timedelta:
        duration_hours = self.params.get("duration_hours", 0)
        if duration_hours and duration_hours > 0:
            return timedelta(hours=duration_hours)
        sickout_type = self.params.get("sickout_type", "illness_outbreak")
        default_h = SICKOUT_TYPES.get(sickout_type, {}).get("default_duration_h", 24.0)
        return timedelta(hours=default_h)

    def severity_label(self) -> str:
        sickout_type = self.params.get("sickout_type", "illness_outbreak")
        pct = self.params.get("callout_pct", 15)
        bases = ", ".join(self.params.get("affected_bases", ["all bases"]))
        desc = SICKOUT_TYPES.get(sickout_type, {}).get("description", sickout_type)
        return f"{desc} ({pct}% callout at {bases})"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Flights whose crew pairings are at affected bases and overlapping
        the sickout window. Returns a proportion based on callout_pct.
        """
        affected_bases = set(self.params.get("affected_bases", []))
        callout_pct = self.params.get("callout_pct", 15) / 100.0
        start, end = self.event_window()

        start_naive = start.replace(tzinfo=None) if start.tzinfo else start
        end_naive = end.replace(tzinfo=None) if end.tzinfo else end

        candidates = []
        for flight in schedule:
            dep_str = flight.get("scheduled_departure", "")
            try:
                dep = __import__("datetime").datetime.fromisoformat(dep_str.replace("Z", "+00:00"))
                dep = dep.replace(tzinfo=None) if dep.tzinfo else dep
            except (ValueError, AttributeError):
                continue

            flight_in_window = start_naive <= dep <= end_naive
            at_affected_base = (
                not affected_bases
                or flight.get("origin") in affected_bases
                or flight.get("crew_base") in affected_bases
            )

            if flight_in_window and at_affected_base:
                candidates.append(flight)

        # Probabilistically select based on callout percentage. Seed from the
        # event's identity so the result is deterministic per event but two
        # different sickout events don't pick the identical flight subset, and
        # the global random stream isn't mutated as a side effect.
        seed_src = f"{self.id}|{sorted(self.params.items())}".encode()
        seed = int.from_bytes(hashlib.sha256(seed_src).digest()[:4], "big")
        rng = random.Random(seed)
        return [f for f in candidates if rng.random() < callout_pct]

    def constraints(self) -> list[dict]:
        return [
            {
                "type": "crew_unavailable",
                "affected_bases": self.params.get("affected_bases", []),
                "affected_roles": self.params.get("affected_roles", ["captain", "first_officer"]),
                "callout_pct": self.params.get("callout_pct", 15),
                "sickout_type": self.params.get("sickout_type", "illness_outbreak"),
                "duration_hours": self.duration().total_seconds() / 3600,
                "allow_deadhead": True,
                "allow_reserve": True,
            }
        ]
