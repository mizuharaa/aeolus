"""
Weather closure disruption event.
Covers thunderstorms, blizzards, fog banks, and other meteorological closures.
"""
from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

SEVERITY_DURATION_HOURS = {
    "mild": 1.5,
    "moderate": 3.0,
    "severe": 5.0,
    "extreme": 8.0,
}

CONDITION_DESCRIPTIONS = {
    "thunderstorm": "Severe thunderstorm activity requiring ground stop",
    "blizzard": "Blizzard conditions with near-zero visibility",
    "fog": "Dense fog bank reducing visibility below minimums",
    "ice": "Freezing rain/ice creating hazardous surface conditions",
    "tornado_warning": "Tornado warning requiring immediate evacuation of ramp",
    "wind_shear": "Low-level wind shear advisory in effect",
    "snow": "Heavy snow accumulation exceeding removal capacity",
}


class WeatherClosureEvent(DisruptionEvent):
    """
    Airport weather closure — grounds or severely restricts operations
    at one or more airports for the event duration.
    """

    kind: EventKind = EventKind.WEATHER_CLOSURE

    param_schema: dict = {
        "type": "object",
        "required": ["airport", "severity", "conditions"],
        "properties": {
            "airport": {
                "type": "string",
                "description": "ICAO airport code",
                "example": "KORD",
            },
            "start": {
                "type": "string",
                "description": "Relative start time, e.g. T+0h",
                "default": "T+0h",
            },
            "end": {
                "type": "string",
                "description": "Relative end time, e.g. T+4h",
                "default": "T+4h",
            },
            "severity": {
                "type": "string",
                "enum": ["mild", "moderate", "severe", "extreme"],
                "default": "severe",
            },
            "conditions": {
                "type": "string",
                "enum": list(CONDITION_DESCRIPTIONS.keys()),
                "default": "thunderstorm",
            },
        },
    }

    @classmethod
    def default_scenario(cls) -> dict:
        return {
            "kind": "weather_closure",
            "label": "Chicago O'Hare Thunderstorm",
            "description": "Severe thunderstorm complex closes ORD for 4 hours during peak afternoon banks",
            "params": {
                "airport": "KORD",
                "start": "T+0h",
                "end": "T+4h",
                "severity": "severe",
                "conditions": "thunderstorm",
            },
        }

    def duration(self) -> timedelta:
        explicit = self.params.get("duration_hours")
        if explicit:
            return timedelta(hours=float(explicit))
        severity = self.params.get("severity", "moderate")
        hours = SEVERITY_DURATION_HOURS.get(severity, 3.0)
        return timedelta(hours=hours)

    def severity_label(self) -> str:
        severity = self.params.get("severity", "moderate")
        conditions = self.params.get("conditions", "weather")
        desc = CONDITION_DESCRIPTIONS.get(conditions, conditions.replace("_", " ").title())
        return f"{severity.capitalize()} — {desc}"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Returns flights departing or arriving at the closed airport
        that overlap the closure window.
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
        severity = self.params.get("severity", "moderate")

        # Extreme events may partially affect nearby airports too
        constraints = [
            {
                "type": "airport_unavailable",
                "airport": airport,
                "start": self.params.get("start", "T+0h"),
                "end": self.params.get("end", "T+4h"),
                "severity": severity,
                "conditions": self.params.get("conditions", "thunderstorm"),
                "reason": f"Weather closure: {self.params.get('conditions', 'weather event')}",
            }
        ]

        # Severe/extreme: also reduce capacity at alternates as diverts pour in
        if severity in ("severe", "extreme"):
            constraints.append(
                {
                    "type": "divert_pressure",
                    "primary_airport": airport,
                    "capacity_reduction_pct": 20,
                    "start": self.params.get("start", "T+0h"),
                    "end": self.params.get("end", "T+4h"),
                }
            )

        return constraints
