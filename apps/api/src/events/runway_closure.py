"""
Runway closure disruption event.
Models planned/unplanned runway closures that reduce airport capacity.
"""

import hashlib
import random
from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

CLOSURE_REASONS = {
    "construction": {
        "description": "Scheduled runway rehabilitation/construction",
        "capacity_reduction_pct": 50,
        "typical_duration_h": 8.0,
    },
    "wildlife": {
        "description": "Wildlife incursion requiring runway sweep",
        "capacity_reduction_pct": 40,
        "typical_duration_h": 0.5,
    },
    "debris": {
        "description": "FOD (Foreign Object Debris) requiring inspection",
        "capacity_reduction_pct": 50,
        "typical_duration_h": 1.0,
    },
    "incident": {
        "description": "Aircraft incident on or near runway",
        "capacity_reduction_pct": 60,
        "typical_duration_h": 3.0,
    },
    "weather_damage": {
        "description": "Runway surface damage from weather (ice, flooding)",
        "capacity_reduction_pct": 30,
        "typical_duration_h": 4.0,
    },
    "pavement_failure": {
        "description": "Pavement failure requiring emergency repair",
        "capacity_reduction_pct": 50,
        "typical_duration_h": 6.0,
    },
}


class RunwayClosureEvent(DisruptionEvent):
    """
    Runway closure — reduces airport throughput by closing one or more runways.
    Remaining runways handle traffic but with reduced capacity.
    """

    kind: EventKind = EventKind.RUNWAY_CLOSURE

    param_schema: dict = {
        "type": "object",
        "required": ["airport", "runway"],
        "properties": {
            "airport": {"type": "string", "description": "ICAO airport code", "example": "KDFW"},
            "runway": {
                "type": "string",
                "description": "Runway designator(s), e.g. '18L' or '18L/36R'",
                "example": "18L",
            },
            "reason": {
                "type": "string",
                "enum": list(CLOSURE_REASONS.keys()),
                "default": "construction",
            },
            "capacity_cut_pct": {
                "type": "integer",
                "description": "Percentage reduction in hourly capacity (0-100)",
                "default": 40,
            },
            "start": {"type": "string", "default": "T+0h"},
            "end": {"type": "string", "default": "T+4h"},
            "severity": {
                "type": "string",
                "enum": ["mild", "moderate", "severe"],
                "default": "moderate",
            },
        },
    }

    @classmethod
    def default_scenario(cls) -> dict:
        return {
            "kind": "runway_closure",
            "label": "DFW Runway 18L Incident",
            "description": "Aircraft incident closes DFW runway 18L, reducing capacity 40% during afternoon peak",
            "params": {
                "airport": "KDFW",
                "runway": "18L",
                "reason": "incident",
                "capacity_cut_pct": 40,
                "start": "T+0h",
                "end": "T+3h",
                "severity": "moderate",
            },
        }

    def duration(self) -> timedelta:
        reason = self.params.get("reason", "construction")
        typical_h = CLOSURE_REASONS.get(reason, {}).get("typical_duration_h", 4.0)
        return timedelta(hours=typical_h)

    def severity_label(self) -> str:
        airport = self.params.get("airport", "")
        runway = self.params.get("runway", "")
        reason = self.params.get("reason", "construction")
        desc = CLOSURE_REASONS.get(reason, {}).get("description", reason)
        cut = self.params.get("capacity_cut_pct", 40)
        return f"{airport} Runway {runway} closure ({cut}% capacity): {desc}"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Flights at the affected airport during the closure window.
        All are potentially affected due to capacity reduction.
        """
        airport = self.params.get("airport", "")
        start, end = self.event_window()
        capacity_cut = self.params.get("capacity_cut_pct", 40) / 100.0

        candidates = []
        for flight in schedule:
            if self._flight_overlaps_window(flight, start, end, airport=airport):
                candidates.append(flight)

        # Return a deterministic sample of the flights that will experience
        # delays based on the capacity cut. Keep the RNG local to this event:
        # seeding the module-level generator makes otherwise unrelated work
        # depend on whether a runway-closure event ran first.
        seed_src = f"{self.id}|{sorted(self.params.items())}".encode()
        seed = int.from_bytes(hashlib.sha256(seed_src).digest()[:4], "big")
        rng = random.Random(seed)
        rng.shuffle(candidates)
        cutoff = len(candidates) * capacity_cut
        return candidates[: int(cutoff)]

    def constraints(self) -> list[dict]:
        airport = self.params.get("airport", "")
        runway = self.params.get("runway", "")
        capacity_cut = self.params.get("capacity_cut_pct", 40)
        reason = self.params.get("reason", "construction")

        return [
            {
                "type": "capacity_reduced",
                "airport": airport,
                "runway": runway,
                "reason": CLOSURE_REASONS.get(reason, {}).get("description", reason),
                "capacity_reduction_pct": capacity_cut,
                "start": self.params.get("start", "T+0h"),
                "end": self.params.get("end", "T+4h"),
                "average_delay_minutes": int(capacity_cut * 0.6),  # empirical relationship
            }
        ]
