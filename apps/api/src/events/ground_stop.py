"""
Ground Stop (GS) disruption event.
FAA issues ground stops to manage destination airport capacity.
Aircraft are held at origin until GS is lifted.
"""
from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

REASON_DESCRIPTIONS = {
    "volume": "High traffic volume at destination",
    "weather": "Weather at destination requiring flow reduction",
    "staffing": "ATC staffing shortage at destination",
    "equipment": "ATC equipment outage at destination",
    "construction": "Airport construction reducing arrival capacity",
}


class GroundStopEvent(DisruptionEvent):
    """
    FAA Ground Stop — holds departures bound for a specific airport.
    Typically issued for 1-3 hours; may be extended.
    """

    kind: EventKind = EventKind.GROUND_STOP

    param_schema: dict = {
        "type": "object",
        "required": ["destination_airport"],
        "properties": {
            "destination_airport": {
                "type": "string",
                "description": "ICAO code of the destination airport with the ground stop",
                "example": "KATL",
            },
            "affected_origins": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of origin ICAO codes subject to GS (empty = all)",
                "default": [],
            },
            "start": {"type": "string", "default": "T+0h"},
            "end": {"type": "string", "default": "T+2h"},
            "reason": {
                "type": "string",
                "enum": list(REASON_DESCRIPTIONS.keys()),
                "default": "weather",
            },
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
            "kind": "ground_stop",
            "label": "Atlanta Ground Stop",
            "description": "FAA ground stop at KATL due to convective weather, holding all departures for 2 hours",
            "params": {
                "destination_airport": "KATL",
                "affected_origins": [],
                "start": "T+0h",
                "end": "T+2h",
                "reason": "weather",
                "severity": "moderate",
            },
        }

    def duration(self) -> timedelta:
        severity = self.params.get("severity", "moderate")
        hours = {"mild": 1.0, "moderate": 2.0, "severe": 3.5}.get(severity, 2.0)
        return timedelta(hours=hours)

    def severity_label(self) -> str:
        reason = self.params.get("reason", "weather")
        dest = self.params.get("destination_airport", "")
        desc = REASON_DESCRIPTIONS.get(reason, reason)
        return f"Ground Stop at {dest}: {desc}"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Flights destined for the ground-stopped airport during the GS window.
        Optionally filtered by origin airports.
        """
        destination = self.params.get("destination_airport", "")
        affected_origins = self.params.get("affected_origins", [])
        start, end = self.event_window()
        affected = []

        for flight in schedule:
            dest_match = flight.get("destination") == destination
            if not dest_match:
                continue

            origin_match = (
                not affected_origins or flight.get("origin") in affected_origins
            )
            if not origin_match:
                continue

            if self._flight_overlaps_window(flight, start, end):
                affected.append(flight)

        return affected

    def constraints(self) -> list[dict]:
        destination = self.params.get("destination_airport", "")
        affected_origins = self.params.get("affected_origins", [])
        reason = self.params.get("reason", "weather")

        return [
            {
                "type": "ground_stop",
                "destination_airport": destination,
                "affected_origins": affected_origins,
                "start": self.params.get("start", "T+0h"),
                "end": self.params.get("end", "T+2h"),
                "reason": REASON_DESCRIPTIONS.get(reason, reason),
                "hold_at_gate": True,
            }
        ]
