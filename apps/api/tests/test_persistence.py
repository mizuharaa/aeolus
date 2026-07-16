"""
Scenario persistence + replay determinism.

Covers the two integration cases from the persistence outcome: a scenario
mid-disruption survives a "kill and restart" of the process (new engine +
new repository connection, same on-disk DB), and replaying a saved scenario
twice produces byte-identical recovery decisions.

Async engine calls are driven with ``asyncio.run`` rather than
``pytest.mark.asyncio`` — pytest-asyncio isn't installed in this venv (see
the pre-existing failure in test_event_catalog.py), and there's nothing
async about the test bodies themselves.
"""

from __future__ import annotations

import asyncio
import copy

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
    {"id": "N001NB", "type": "B737-800", "base_airport_id": "KDEN", "seats": 162, "min_turn_minutes": 45},
    {"id": "N002NB", "type": "B737-800", "base_airport_id": "KDFW", "seats": 162, "min_turn_minutes": 45},
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
    },
]

AIRSPACE_CLOSURE_EVENT = {
    "kind": "airspace_closure",
    "params": {
        "airports": ["KDEN"],
        "center_lat": 39.856,
        "center_lon": -104.674,
        "radius_nm": 40,
        "severity": "severe",
        "duration_hours": 6,
        "start": "T+0h",
        "end": "T+6h",
    },
}


class _StubWeather:
    """No live METAR fetch in tests — the predictor only needs the method
    to exist and return a dict."""

    def get_all_cached(self) -> dict:
        return {}


def _trigger(engine: SimulationEngine, event: dict) -> dict:
    predictor = CascadePredictor()
    optimizer = RecoveryOptimizer(timeout_secs=5, deterministic=True)
    return asyncio.run(engine.trigger_event(dict(event), predictor, optimizer, _StubWeather()))


def _without_timing(plans: list[dict]) -> list[dict]:
    """solve_time_ms is a wall-clock measurement of that particular solve,
    not a recovery decision — strip it before comparing plans for equality."""
    stripped = copy.deepcopy(plans)
    for plan in stripped:
        plan.pop("solve_time_ms", None)
    return stripped


def test_restart_persists_airspace_closure_mid_disruption(tmp_path):
    db_path = tmp_path / "aeolus.db"

    repo = ScenarioRepository(db_path)
    engine = SimulationEngine(FLIGHTS, AIRCRAFT, CREWS, repository=repo)
    _trigger(engine, AIRSPACE_CLOSURE_EVENT)

    assert engine.scenario_id is not None
    assert len(engine.state.active_events) == 1
    assert engine.state.active_events[0]["kind"] == "airspace_closure"
    assert len(engine.state.recovery_plans) == 4  # plans A-D

    original_events = copy.deepcopy(engine.state.active_events)
    original_plans = copy.deepcopy(engine.state.recovery_plans)

    # "Kill and restart": a brand new process would open a fresh connection
    # to the same on-disk DB and construct a fresh engine — nothing carries
    # over except what's on disk.
    repo.close()
    restarted_repo = ScenarioRepository(db_path)
    restarted_engine = SimulationEngine(FLIGHTS, AIRCRAFT, CREWS, repository=restarted_repo)
    restored = restarted_engine.restore_from_repository()

    assert restored is True
    assert restarted_engine.scenario_id == engine.scenario_id
    assert restarted_engine.state.active_events == original_events
    assert restarted_engine.state.recovery_plans == original_plans


def test_replay_twice_produces_identical_plans(tmp_path):
    db_path = tmp_path / "aeolus.db"

    repo = ScenarioRepository(db_path)
    engine = SimulationEngine(FLIGHTS, AIRCRAFT, CREWS, repository=repo)
    _trigger(engine, AIRSPACE_CLOSURE_EVENT)
    scenario_id = engine.scenario_id
    original_plans = _without_timing(engine.state.recovery_plans)

    replay_1 = asyncio.run(
        replay_scenario(scenario_id, repo, schedule=FLIGHTS, aircraft=AIRCRAFT, crews=CREWS)
    )
    replay_2 = asyncio.run(
        replay_scenario(scenario_id, repo, schedule=FLIGHTS, aircraft=AIRCRAFT, crews=CREWS)
    )

    assert _without_timing(replay_1) == _without_timing(replay_2)
    assert _without_timing(replay_1) == original_plans
