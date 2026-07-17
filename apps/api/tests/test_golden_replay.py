"""Golden tests for deterministic replay of persisted event streams."""

from __future__ import annotations

import asyncio
import copy
import json

import pytest

from src.optimizer.milp import RecoveryOptimizer
from src.predictor.cascade import CascadePredictor
from src.replay import replay_scenario
from src.simulator.engine import SimulationEngine
from src.store.repository import ScenarioRepository

FLIGHTS = [
    {
        "id": "NB201",
        "aircraft_id": "N001NB",
        "origin": "KDEN",
        "destination": "KORD",
        "scheduled_departure": "2024-01-15T13:00:00Z",
        "scheduled_arrival": "2024-01-15T15:30:00Z",
        "passengers": 148,
    },
    {
        "id": "NB202",
        "aircraft_id": "N001NB",
        "origin": "KORD",
        "destination": "KDEN",
        "scheduled_departure": "2024-01-15T16:30:00Z",
        "scheduled_arrival": "2024-01-15T18:45:00Z",
        "passengers": 135,
    },
    {
        "id": "NB203",
        "aircraft_id": "N002NB",
        "origin": "KDFW",
        "destination": "KLAX",
        "scheduled_departure": "2024-01-15T14:00:00Z",
        "scheduled_arrival": "2024-01-15T16:00:00Z",
        "passengers": 150,
    },
]

AIRCRAFT = [
    {
        "id": "N001NB",
        "type": "B737-800",
        "base_airport_id": "KDEN",
        "seats": 162,
        "min_turn_minutes": 45,
    },
    {
        "id": "N002NB",
        "type": "B737-800",
        "base_airport_id": "KDFW",
        "seats": 162,
        "min_turn_minutes": 45,
    },
]

CREWS = [
    {
        "id": "CP001",
        "flight_id": "NB201",
        "captain_id": "CAP001",
        "first_officer_id": "FO001",
        "duty_start": "2024-01-15T12:00:00Z",
        "flight_time_minutes": 150,
        "status": "assigned",
    }
]

EVENTS = [
    pytest.param(
        {
            "id": "golden-runway-closure",
            "kind": "runway_closure",
            "triggered_at": "2024-01-15T12:00:00+00:00",
            "params": {
                "airport": "KDEN",
                "runway": "18L",
                "reason": "incident",
                "capacity_cut_pct": 40,
                "duration_hours": 3,
                "severity": "severe",
            },
        },
        id="runway_closure",
    ),
    pytest.param(
        {
            "id": "golden-airspace-closure",
            "kind": "airspace_closure",
            "triggered_at": "2024-01-15T12:00:00+00:00",
            "params": {
                "airports": ["KDEN"],
                "center_lat": 39.856,
                "center_lon": -104.674,
                "radius_nm": 40,
                "duration_hours": 6,
                "severity": "severe",
            },
        },
        id="airspace_closure",
    ),
]


class _FrozenWeather:
    def get_all_cached(self) -> dict:
        return {"KDEN": {"raw": "KDEN 151153Z 18005KT 10SM CLR"}}


def _golden_bytes(stream: list[dict]) -> bytes:
    """Encode replay decisions, excluding only documented run-time metrics."""
    stable = copy.deepcopy(stream)
    for update in stable:
        update.pop("timestamp", None)
        for plan in update.get("recovery_plans", []):
            plan.pop("solve_time_ms", None)
    return json.dumps(stable, sort_keys=True, separators=(",", ":")).encode()


@pytest.mark.parametrize("event", EVENTS)
def test_persisted_scenario_replays_to_byte_identical_event_streams(tmp_path, monkeypatch, event):
    db_path = tmp_path / "aeolus.db"
    repo = ScenarioRepository(db_path)
    engine = SimulationEngine(FLIGHTS, AIRCRAFT, CREWS, repository=repo)
    asyncio.run(
        engine.trigger_event(
            copy.deepcopy(event),
            CascadePredictor(),
            RecoveryOptimizer(timeout_secs=5, deterministic=True),
            _FrozenWeather(),
        )
    )
    scenario_id = engine.scenario_id
    persisted = repo.load(scenario_id)
    assert persisted is not None
    assert persisted.events == [event]

    streams: list[list[dict]] = []
    original_trigger = SimulationEngine.trigger_event

    async def capture_trigger(self, *args, **kwargs):
        update = await original_trigger(self, *args, **kwargs)
        streams[-1].append(copy.deepcopy(update))
        return update

    monkeypatch.setattr(SimulationEngine, "trigger_event", capture_trigger)

    streams.append([])
    asyncio.run(
        replay_scenario(
            scenario_id,
            repo,
            schedule=FLIGHTS,
            aircraft=AIRCRAFT,
            crews=CREWS,
        )
    )

    # Cross the restart boundary between the two golden runs. Closing the
    # original connection leaves the second replay only the SQLite file;
    # neither the creating engine nor its repository can supply live state.
    repo.close()
    reloaded_repo = ScenarioRepository(db_path)
    reloaded = reloaded_repo.load(scenario_id)
    assert reloaded is not None
    assert reloaded.events == persisted.events

    streams.append([])
    asyncio.run(
        replay_scenario(
            scenario_id,
            reloaded_repo,
            schedule=FLIGHTS,
            aircraft=AIRCRAFT,
            crews=CREWS,
        )
    )

    assert len(streams[0]) == len(streams[1]) == len(persisted.events)
    assert _golden_bytes(streams[0]) == _golden_bytes(streams[1])
