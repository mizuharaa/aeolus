"""
Base classes for all Aeolus disruption events.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EventKind(str, Enum):
    WEATHER_CLOSURE = "weather_closure"
    GROUND_STOP = "ground_stop"
    AIRSPACE_CLOSURE = "airspace_closure"
    SECURITY_EVENT = "security_event"
    MECHANICAL_AOG = "mechanical_aog"
    CREW_SICKOUT = "crew_sickout"
    RUNWAY_CLOSURE = "runway_closure"
    ATC_STAFFING = "atc_staffing"
    VOLCANIC_ASH = "volcanic_ash"
    CYBER_INCIDENT = "cyber_incident"


# Severity ordering for display / sorting
SEVERITY_LEVELS = {
    "mild": 1,
    "moderate": 2,
    "severe": 3,
    "extreme": 4,
}


class DisruptionEvent(BaseModel):
    """
    Base Pydantic model for all disruption events.
    Subclasses must implement affected_flights, constraints, duration,
    severity_label, and provide DEFAULT_SCENARIO.
    """

    id: str = Field(default="", description="UUID assigned at trigger time")
    kind: EventKind
    triggered_at: datetime = Field(default_factory=datetime.utcnow)
    params: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------
    # Abstract interface — subclasses must implement these
    # ------------------------------------------------------------------

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """Return the subset of flights directly impacted by this event."""
        raise NotImplementedError

    def constraints(self) -> list[dict]:
        """Return optimizer constraint dicts describing this event."""
        raise NotImplementedError

    def duration(self) -> timedelta:
        """Return the expected duration of this disruption."""
        raise NotImplementedError

    def severity_label(self) -> str:
        """Return human-readable severity label."""
        severity = self.params.get("severity", "moderate")
        return str(severity).capitalize()

    @classmethod
    def default_scenario(cls) -> dict:
        """Return a pre-built realistic scenario dict for this event type."""
        raise NotImplementedError

    @classmethod
    def default_scenario_dict(cls) -> dict:
        """Alias used by the registry."""
        return cls.default_scenario()

    # ------------------------------------------------------------------
    # Helpers shared by all event types
    # ------------------------------------------------------------------

    def _parse_relative_time(self, time_str: str) -> datetime:
        """
        Parse relative time string like "T+2h", "T+30m" relative to triggered_at.
        Falls back to triggered_at if parsing fails.
        """
        base = self.triggered_at
        s = time_str.strip()
        if s.startswith("T+"):
            s = s[2:]
            if s.endswith("h"):
                hours = float(s[:-1])
                return base + timedelta(hours=hours)
            elif s.endswith("m"):
                minutes = float(s[:-1])
                return base + timedelta(minutes=minutes)
        # Try ISO format
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            return base

    def event_window(self) -> tuple[datetime, datetime]:
        """Return (start, end) absolute datetimes for the event."""
        start_str = self.params.get("start", "T+0h")
        start = self._parse_relative_time(start_str)
        end_str = self.params.get("end")
        if end_str:
            end = self._parse_relative_time(end_str)
        else:
            try:
                end = start + self.duration()
            except (NotImplementedError, Exception):
                end = self._parse_relative_time("T+2h")
        return start, end

    def _flight_overlaps_window(
        self,
        flight: dict,
        start: datetime,
        end: datetime,
        airport: str | None = None,
    ) -> bool:
        """Check if flight touches a time/airport window."""
        dep_str = flight.get("scheduled_departure", "")
        arr_str = flight.get("scheduled_arrival", "")
        try:
            dep = datetime.fromisoformat(dep_str.replace("Z", "+00:00"))
            arr = datetime.fromisoformat(arr_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return False

        # Normalise to naive (compare in event-local UTC space) so we don't mix
        # tz-aware schedule timestamps with naive triggered_at-derived windows.
        dep = dep.replace(tzinfo=None) if dep.tzinfo else dep
        arr = arr.replace(tzinfo=None) if arr.tzinfo else arr
        start = start.replace(tzinfo=None) if start.tzinfo else start
        end = end.replace(tzinfo=None) if end.tzinfo else end

        # Time overlap: [dep, arr] ∩ [start, end] != empty
        overlaps_time = dep <= end and arr >= start

        if airport is None:
            return overlaps_time

        touches_airport = (
            flight.get("origin") == airport or flight.get("destination") == airport
        )
        return overlaps_time and touches_airport
