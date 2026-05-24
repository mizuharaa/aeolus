"""
ATC (Air Traffic Control) staffing shortage disruption event.
Models TRACON/ARTCC understaffing that reduces sector throughput.
"""

from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

FACILITY_TYPES = {
    "artcc": {
        "description": "ARTCC en-route center staffing shortage",
        "scope": "regional",
        "typical_delay_min": 45,
    },
    "tracon": {
        "description": "TRACON approach control staffing shortage",
        "scope": "terminal_area",
        "typical_delay_min": 30,
    },
    "tower": {
        "description": "Control tower staffing shortage",
        "scope": "airport",
        "typical_delay_min": 20,
    },
    "combined": {
        "description": "Combined TRACON/Tower staffing shortage",
        "scope": "terminal_area",
        "typical_delay_min": 40,
    },
}

# Major US ARTCC facilities and their primary airports
ARTCC_AIRPORTS = {
    "ZAU": ["KORD", "KMKE", "KRFD"],  # Chicago
    "ZTL": ["KATL", "KBNA", "KCLT"],  # Atlanta
    "ZFW": ["KDFW", "KAUS", "KSAT"],  # Fort Worth
    "ZLA": ["KLAX", "KLAS", "KSAN"],  # Los Angeles
    "ZDV": ["KDEN", "KCOS"],  # Denver
    "ZNY": ["KJFK", "KEWR", "KLGA"],  # New York
    "ZSE": ["KSEA", "KPDX"],  # Seattle
    "ZMA": ["KMIA", "KFLL", "KTPA"],  # Miami
    "ZAB": ["KPHX", "KTUS", "KALB"],  # Albuquerque
    "ZMP": ["KMSP", "KDTW", "KDSM"],  # Minneapolis
}


class ATCStaffingEvent(DisruptionEvent):
    """
    ATC staffing shortage — creates ground delay programs (GDP) and
    airspace flow programs (AFP) that throttle departure rates.
    """

    kind: EventKind = EventKind.ATC_STAFFING

    param_schema: dict = {
        "type": "object",
        "required": ["facility_id"],
        "properties": {
            "facility_id": {
                "type": "string",
                "description": "FAA facility ID (e.g. ZAU, KDFW TRACON)",
                "example": "ZAU",
            },
            "facility_type": {
                "type": "string",
                "enum": list(FACILITY_TYPES.keys()),
                "default": "artcc",
            },
            "staffing_pct": {
                "type": "number",
                "description": "Percentage of normal staffing available (0-100)",
                "default": 60,
            },
            "affected_airports": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Airports under this facility (auto-populated from facility_id)",
                "default": [],
            },
            "average_delay_minutes": {
                "type": "integer",
                "description": "Expected MIT (miles-in-trail) / GDP delay in minutes",
                "default": 30,
            },
            "start": {"type": "string", "default": "T+0h"},
            "end": {"type": "string", "default": "T+6h"},
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
            "kind": "atc_staffing",
            "label": "Chicago ARTCC (ZAU) Staffing Shortage",
            "description": "ZAU operating at 60% staffing, issuing 30-min MIT delays for all arrivals into ORD/MDW/MKE complex",
            "params": {
                "facility_id": "ZAU",
                "facility_type": "artcc",
                "staffing_pct": 60,
                "capacity_pct": 60,  # alias used by some clients
                "affected_airports": ["KORD", "KMKE", "KRFD"],
                "average_delay_minutes": 30,
                "start": "T+0h",
                "end": "T+6h",
                "severity": "moderate",
            },
        }

    def duration(self) -> timedelta:
        # ATC staffing shortages typically last until end of shift (6-8 hours)
        severity = self.params.get("severity", "moderate")
        hours = {"mild": 2.0, "moderate": 6.0, "severe": 10.0}.get(severity, 6.0)
        return timedelta(hours=hours)

    def severity_label(self) -> str:
        facility_id = self.params.get("facility_id", "")
        facility_type = self.params.get("facility_type", "artcc")
        staffing_pct = self.params.get("staffing_pct", 60)
        desc = FACILITY_TYPES.get(facility_type, {}).get("description", "ATC staffing issue")
        return f"{facility_id} {desc} ({staffing_pct}% staffed)"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Flights arriving at or departing from airports under the affected ATC facility.
        """
        facility_id = self.params.get("facility_id", "")
        affected_airports = set(
            self.params.get("affected_airports", []) or ARTCC_AIRPORTS.get(facility_id, [])
        )
        start, end = self.event_window()
        affected = []

        for flight in schedule:
            touches_affected = (
                flight.get("origin") in affected_airports
                or flight.get("destination") in affected_airports
            )
            if touches_affected and self._flight_overlaps_window(flight, start, end):
                affected.append(flight)

        return affected

    def constraints(self) -> list[dict]:
        facility_id = self.params.get("facility_id", "")
        facility_type = self.params.get("facility_type", "artcc")
        affected_airports = self.params.get("affected_airports", []) or ARTCC_AIRPORTS.get(
            facility_id, []
        )
        avg_delay = self.params.get("average_delay_minutes", 30)
        staffing_pct = self.params.get("staffing_pct", 60)

        return [
            {
                "type": "atc_gdp",
                "facility_id": facility_id,
                "facility_type": facility_type,
                "affected_airports": affected_airports,
                "staffing_pct": staffing_pct,
                "average_delay_minutes": avg_delay,
                "miles_in_trail": 15 if avg_delay > 30 else 10,
                "start": self.params.get("start", "T+0h"),
                "end": self.params.get("end", "T+6h"),
            }
        ]
