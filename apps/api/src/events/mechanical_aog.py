"""
Aircraft-on-Ground (AOG) mechanical disruption event.
A specific tail number is grounded for maintenance.
"""
from datetime import timedelta
from typing import Any

from src.events.base import DisruptionEvent, EventKind

DEFECT_CATEGORIES = {
    "engine": {
        "description": "Engine defect or malfunction",
        "default_duration_h": 8.0,
        "min_turn_addition_h": 2.0,
    },
    "avionics": {
        "description": "Avionics or flight management system fault",
        "default_duration_h": 4.0,
        "min_turn_addition_h": 1.0,
    },
    "hydraulics": {
        "description": "Hydraulic system failure",
        "default_duration_h": 6.0,
        "min_turn_addition_h": 2.0,
    },
    "landing_gear": {
        "description": "Landing gear anomaly requiring inspection",
        "default_duration_h": 5.0,
        "min_turn_addition_h": 1.5,
    },
    "pressurization": {
        "description": "Cabin pressurization fault",
        "default_duration_h": 3.0,
        "min_turn_addition_h": 1.0,
    },
    "bird_strike": {
        "description": "Bird strike requiring airframe/engine inspection",
        "default_duration_h": 4.0,
        "min_turn_addition_h": 1.5,
    },
    "fuel_leak": {
        "description": "Fuel system leak requiring repair",
        "default_duration_h": 6.0,
        "min_turn_addition_h": 2.0,
    },
    "tire_blowout": {
        "description": "Tire blowout on landing requiring replacement and runway inspection",
        "default_duration_h": 3.0,
        "min_turn_addition_h": 1.0,
    },
}


class MechanicalAOGEvent(DisruptionEvent):
    """
    Aircraft-on-Ground event — a specific aircraft is grounded for mechanical reasons.
    All flights assigned to that tail are impacted and require aircraft swap or cancellation.
    """

    kind: EventKind = EventKind.MECHANICAL_AOG

    param_schema: dict = {
        "type": "object",
        "required": ["aircraft_tail", "defect_category"],
        "properties": {
            "aircraft_tail": {
                "type": "string",
                "description": "Tail number of the grounded aircraft",
                "example": "N042NB",
            },
            "defect_category": {
                "type": "string",
                "enum": list(DEFECT_CATEGORIES.keys()),
                "default": "engine",
            },
            "location_airport": {
                "type": "string",
                "description": "Airport where AOG occurred",
                "example": "KDEN",
            },
            "duration_hours": {
                "type": "number",
                "description": "Expected repair duration in hours (0 = use category default)",
                "default": 0,
            },
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
            "kind": "mechanical_aog",
            "label": "Engine AOG at Denver",
            "description": "Engine defect grounds N042NB at KDEN, cascading 4 downstream flights through the rotation",
            "params": {
                "aircraft_tail": "N042NB",
                "defect_category": "engine",
                "location_airport": "KDEN",
                "duration_hours": 8,
                "severity": "severe",
            },
        }

    def duration(self) -> timedelta:
        duration_hours = self.params.get("duration_hours", 0)
        if duration_hours and duration_hours > 0:
            return timedelta(hours=duration_hours)
        defect = self.params.get("defect_category", "engine")
        default_hours = DEFECT_CATEGORIES.get(defect, {}).get("default_duration_h", 6.0)
        return timedelta(hours=default_hours)

    def severity_label(self) -> str:
        tail = self.params.get("aircraft_tail", "")
        defect = self.params.get("defect_category", "engine")
        location = self.params.get("location_airport", "")
        desc = DEFECT_CATEGORIES.get(defect, {}).get("description", defect)
        return f"AOG {tail} at {location}: {desc}"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        All flights assigned to the grounded aircraft tail number.
        These all need to be recovered via swap, delay, or cancellation.
        """
        tail = self.params.get("aircraft_tail", "")
        start, end = self.event_window()
        aog_duration = self.duration()
        aog_end_time = self.triggered_at + aog_duration

        affected = []
        aog_end_naive = (
            aog_end_time.replace(tzinfo=None) if aog_end_time.tzinfo else aog_end_time
        )
        for flight in schedule:
            if flight.get("aircraft_id") == tail:
                # Check if flight is scheduled during or after AOG period
                dep_str = flight.get("scheduled_departure", "")
                try:
                    dep = __import__("datetime").datetime.fromisoformat(
                        dep_str.replace("Z", "+00:00")
                    )
                    dep_naive = dep.replace(tzinfo=None) if dep.tzinfo else dep
                    if dep_naive <= aog_end_naive:
                        affected.append(flight)
                except (ValueError, AttributeError):
                    affected.append(flight)

        return affected

    def constraints(self) -> list[dict]:
        tail = self.params.get("aircraft_tail", "")
        defect = self.params.get("defect_category", "engine")
        location = self.params.get("location_airport", "")

        return [
            {
                "type": "aircraft_grounded",
                "aircraft_tail": tail,
                "defect_category": defect,
                "location_airport": location,
                "duration_hours": self.duration().total_seconds() / 3600,
                "require_swap": True,
                "min_spare_type_match": defect not in ("tire_blowout", "pressurization"),
            }
        ]
