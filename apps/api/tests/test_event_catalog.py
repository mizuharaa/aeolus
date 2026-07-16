"""Regression coverage for the public event catalog and trigger execution."""

from __future__ import annotations

import asyncio
import threading
import time

import pytest

from src.events.base import EventKind
from src.events.catalog import (
    EVENT_DEFAULTS,
    constraint_kind_for,
    normalize_event_params,
)
from src.events.registry import EVENT_REGISTRY, create_event
from src.simulator.engine import SimulationEngine

VISIBLE_EVENT_KINDS = {
    "weather_closure",
    "thunderstorm",
    "blizzard",
    "sandstorm",
    "dense_fog",
    "wind_shear",
    "hurricane",
    "volcanic_ash",
    "ground_stop",
    "airspace_closure",
    "atc_staffing",
    "mechanical_aog",
    "bird_strike",
    "deicing_shortage",
    "runway_closure",
    "fuel_contamination",
    "crew_sickout",
    "labor_action",
    "security_event",
    "airport_emergency",
    "cyber_incident",
}


def test_catalog_registry_and_enum_cover_every_visible_event():
    assert set(EVENT_DEFAULTS) == VISIBLE_EVENT_KINDS
    assert {kind.value for kind in EventKind} == VISIBLE_EVENT_KINDS
    assert {kind.value for kind in EVENT_REGISTRY} == VISIBLE_EVENT_KINDS


@pytest.mark.parametrize("kind", sorted(VISIBLE_EVENT_KINDS))
def test_factory_accepts_every_visible_event(kind):
    event = create_event(kind, {})
    assert event.kind.value == kind
    assert event.params["duration_hours"] > 0


def test_parameter_aliases_are_normalized_for_predictor_and_optimizer():
    ground_stop = normalize_event_params(
        "ground_stop", {"destination_airport": "kjfk", "duration_hours": 2}
    )
    assert ground_stop["airport"] == "KJFK"
    assert ground_stop["destination_airport"] == "KJFK"

    staffing = normalize_event_params("atc_staffing", {"facility_id": "zau", "staffing_pct": 50})
    assert staffing["sector_or_airport"] == "ZAU"
    assert staffing["average_delay_minutes"] == 60

    fuel = normalize_event_params("fuel_contamination", {"severity": "critical"})
    assert fuel["severity"] == "extreme"


@pytest.mark.parametrize(
    ("kind", "canonical"),
    [
        ("thunderstorm", "weather_closure"),
        ("bird_strike", "mechanical_aog"),
        ("deicing_shortage", "runway_closure"),
        ("labor_action", "crew_sickout"),
        ("airport_emergency", "security_event"),
    ],
)
def test_extended_events_have_optimizer_constraint_mapping(kind, canonical):
    assert constraint_kind_for(kind) == canonical


def test_invalid_event_controls_are_rejected_early():
    with pytest.raises(ValueError, match="Unknown event kind"):
        normalize_event_params("not_real", {})
    with pytest.raises(ValueError, match="duration_hours"):
        normalize_event_params("ground_stop", {"duration_hours": 0})
    with pytest.raises(ValueError, match="staffing_pct"):
        normalize_event_params("atc_staffing", {"staffing_pct": 101})


class _Weather:
    def get_all_cached(self):
        return {}


class _Predictor:
    def predict(self, *, flights, **_kwargs):
        return {
            flight["id"]: {
                "p_delayed": 0.9,
                "expected_delay_min": 60,
                "cascade_order": 0,
            }
            for flight in flights
        }


class _Plan:
    def to_dict(self):
        return {"plan_id": "A", "cancelled_flights": [], "delayed_flights": []}


class _Optimizer:
    def __init__(self):
        self.active = 0
        self.max_active = 0
        self._lock = threading.Lock()

    def solve(self, **_kwargs):
        with self._lock:
            self.active += 1
            self.max_active = max(self.max_active, self.active)
        time.sleep(0.03)
        with self._lock:
            self.active -= 1
        return [_Plan()]


@pytest.mark.asyncio
async def test_concurrent_triggers_are_serialized():
    engine = SimulationEngine(
        [
            {
                "id": "NB101",
                "aircraft_id": "N001NB",
                "origin": "KORD",
                "destination": "KATL",
                "scheduled_departure": "2024-01-15T12:00:00Z",
                "scheduled_arrival": "2024-01-15T14:00:00Z",
            }
        ],
        [{"id": "N001NB"}],
        [],
    )
    optimizer = _Optimizer()
    event = {
        "kind": "weather_closure",
        "params": normalize_event_params("weather_closure", {}),
    }

    await asyncio.gather(
        engine.trigger_event(dict(event), _Predictor(), optimizer, _Weather()),
        engine.trigger_event(dict(event), _Predictor(), optimizer, _Weather()),
    )

    assert optimizer.max_active == 1
    assert len(engine.state.active_events) == 2
