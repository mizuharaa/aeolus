"""
Security event disruption.
Covers bomb threats, suspicious packages, terminal evacuations, and breaches.
"""
from datetime import timedelta
from typing import Any

from src.events.base import DisruptionEvent, EventKind

SECURITY_EVENT_TYPES = {
    "bomb_threat": {
        "description": "Bomb threat requiring terminal evacuation and sweep",
        "default_duration_h": 3.0,
    },
    "suspicious_package": {
        "description": "Suspicious package causing concourse shutdown",
        "default_duration_h": 2.0,
    },
    "terminal_evacuation": {
        "description": "General terminal evacuation (threat or incident)",
        "default_duration_h": 2.5,
    },
    "security_breach": {
        "description": "Security breach requiring re-screening of all passengers",
        "default_duration_h": 4.0,
    },
    "active_threat": {
        "description": "Active security threat — full airport lockdown",
        "default_duration_h": 6.0,
    },
}


class SecurityEvent(DisruptionEvent):
    """
    Airport security disruption — partial or full closure of terminals/concourses.
    """

    kind: EventKind = EventKind.SECURITY_EVENT

    param_schema: dict = {
        "type": "object",
        "required": ["airport", "event_type"],
        "properties": {
            "airport": {"type": "string", "description": "ICAO airport code", "example": "KJFK"},
            "event_type": {
                "type": "string",
                "enum": list(SECURITY_EVENT_TYPES.keys()),
                "default": "suspicious_package",
            },
            "terminal": {
                "type": "string",
                "description": "Affected terminal/concourse (empty = entire airport)",
                "default": "",
            },
            "start": {"type": "string", "default": "T+0h"},
            "end": {"type": "string", "default": "T+3h"},
            "severity": {
                "type": "string",
                "enum": ["moderate", "severe", "extreme"],
                "default": "severe",
            },
        },
    }

    @classmethod
    def default_scenario(cls) -> dict:
        return {
            "kind": "security_event",
            "label": "JFK Terminal 4 Bomb Threat",
            "description": "Bomb threat forces evacuation of JFK Terminal 4, affecting all international and domestic departures",
            "params": {
                "airport": "KJFK",
                "event_type": "bomb_threat",
                "terminal": "T4",
                "start": "T+0h",
                "end": "T+3h",
                "severity": "severe",
            },
        }

    def duration(self) -> timedelta:
        explicit = self.params.get("duration_hours")
        if explicit:
            return timedelta(hours=float(explicit))
        event_type = self.params.get("event_type", "suspicious_package")
        hours = SECURITY_EVENT_TYPES.get(event_type, {}).get("default_duration_h", 3.0)
        return timedelta(hours=hours)

    def severity_label(self) -> str:
        event_type = self.params.get("event_type", "suspicious_package")
        airport = self.params.get("airport", "")
        terminal = self.params.get("terminal", "")
        desc = SECURITY_EVENT_TYPES.get(event_type, {}).get("description", event_type)
        loc = f"{airport} {terminal}".strip()
        return f"Security Event at {loc}: {desc}"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Flights departing from or arriving at the affected airport during the security event.
        """
        airport = self.params.get("airport", "")
        start, end = self.event_window()
        affected = []

        for flight in schedule:
            if self._flight_overlaps_window(flight, start, end, airport=airport):
                affected.append(flight)

        return affected

    def constraints(self) -> list[dict]:
        airport = self.params.get("airport", "")
        event_type = self.params.get("event_type", "suspicious_package")
        terminal = self.params.get("terminal", "")
        severity = self.params.get("severity", "severe")

        # Active threat or bomb threat = full airport unavailable
        # Others = partial (reduce capacity or delay departures only)
        if event_type in ("bomb_threat", "active_threat", "terminal_evacuation"):
            constraint_type = "airport_unavailable"
        else:
            constraint_type = "capacity_reduced"

        constraints = [
            {
                "type": constraint_type,
                "airport": airport,
                "terminal": terminal,
                "event_type": event_type,
                "start": self.params.get("start", "T+0h"),
                "end": self.params.get("end", "T+3h"),
                "severity": severity,
                "re_screening_delay_minutes": 90 if event_type == "security_breach" else 0,
            }
        ]

        return constraints
