"""Event registry and factory for Aeolus disruption events."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from src.events.airspace_closure import AirspaceClosureEvent
from src.events.atc_staffing import ATCStaffingEvent
from src.events.base import DisruptionEvent, EventKind
from src.events.crew_sickout import CrewSickoutEvent
from src.events.cyber_incident import CyberIncidentEvent
from src.events.ground_stop import GroundStopEvent
from src.events.mechanical_aog import MechanicalAOGEvent
from src.events.runway_closure import RunwayClosureEvent
from src.events.security_event import SecurityEvent
from src.events.volcanic_ash import VolcanicAshEvent
from src.events.weather_closure import WeatherClosureEvent

EVENT_REGISTRY: dict[EventKind, type[DisruptionEvent]] = {
    EventKind.WEATHER_CLOSURE: WeatherClosureEvent,
    EventKind.GROUND_STOP: GroundStopEvent,
    EventKind.AIRSPACE_CLOSURE: AirspaceClosureEvent,
    EventKind.SECURITY_EVENT: SecurityEvent,
    EventKind.MECHANICAL_AOG: MechanicalAOGEvent,
    EventKind.CREW_SICKOUT: CrewSickoutEvent,
    EventKind.RUNWAY_CLOSURE: RunwayClosureEvent,
    EventKind.ATC_STAFFING: ATCStaffingEvent,
    EventKind.VOLCANIC_ASH: VolcanicAshEvent,
    EventKind.CYBER_INCIDENT: CyberIncidentEvent,
}

# Build default scenarios from each event class
DEFAULT_SCENARIOS: dict[str, dict] = {}
for _kind, _cls in EVENT_REGISTRY.items():
    try:
        DEFAULT_SCENARIOS[_kind.value] = _cls.default_scenario()
    except NotImplementedError:
        pass


def create_event(
    kind: str,
    params: dict,
    triggered_at: datetime | None = None,
    event_id: str | None = None,
) -> DisruptionEvent:
    """
    Factory function to instantiate the correct DisruptionEvent subclass.

    Args:
        kind: EventKind string value (e.g. "weather_closure")
        params: Event-specific parameters dict
        triggered_at: Timestamp; defaults to now
        event_id: UUID string; auto-generated if not provided

    Returns:
        Instantiated DisruptionEvent subclass

    Raises:
        ValueError: If kind is not recognised
    """
    try:
        event_kind = EventKind(kind)
    except ValueError:
        raise ValueError(
            f"Unknown event kind '{kind}'. Valid kinds: {[k.value for k in EventKind]}"
        )

    cls = EVENT_REGISTRY[event_kind]
    return cls(
        id=event_id or str(uuid.uuid4()),
        kind=event_kind,
        triggered_at=triggered_at or datetime.now(timezone.utc),
        params=params,
    )


def get_param_schema(kind: str) -> dict:
    """Return the JSON schema for a given event kind's params."""
    try:
        event_kind = EventKind(kind)
    except ValueError:
        raise ValueError(f"Unknown event kind: {kind}")

    cls = EVENT_REGISTRY[event_kind]
    return getattr(cls, "param_schema", {})


def list_event_types() -> list[dict]:
    """Return metadata for all registered event types."""
    result = []
    for kind, cls in EVENT_REGISTRY.items():
        result.append(
            {
                "kind": kind.value,
                "label": kind.value.replace("_", " ").title(),
                "param_schema": getattr(cls, "param_schema", {}),
                "default_scenario": DEFAULT_SCENARIOS.get(kind.value, {}),
            }
        )
    return result
