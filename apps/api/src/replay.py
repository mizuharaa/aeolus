"""
Replay a persisted scenario.

Re-triggers every event of a saved scenario, in order, against a fresh
``SimulationEngine`` and returns the resulting recovery plans. For the
result to be reproducible run to run, replay pins every input that would
otherwise vary:

  - event id / triggered_at   — reused verbatim from the saved timeline
                                 (the cascade predictor's RNG seed is derived
                                 from the event's own content)
  - weather                   — the exact METAR snapshot captured at trigger
                                 time, not a live fetch
  - the CP-SAT solve itself   — single-threaded with a fixed random_seed
                                 (``RecoveryOptimizer(deterministic=True)``);
                                 parallel search under a time limit is not
                                 reproducible on its own

``solve_time_ms`` is intentionally excluded from equality checks — it's a
wall-clock measurement of that run, not a recovery decision.

Usage:
    python -m src.replay <scenario_id> [--db path/to/aeolus.db]
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from src.weather.client import WeatherClient

from src.network import cache
from src.optimizer.milp import RecoveryOptimizer
from src.predictor.cascade import CascadePredictor
from src.simulator.engine import SimulationEngine
from src.store.repository import ScenarioRepository

DEFAULT_DB_PATH = Path(__file__).parent.parent / "state" / "aeolus.db"


class _FrozenWeatherClient:
    """Replays the METAR snapshots captured at trigger time, in order,
    instead of a live fetch — same interface as ``WeatherClient`` for the
    one method the predictor calls."""

    def __init__(self, snapshots: list[dict]):
        self._snapshots = snapshots
        self._index = 0

    def get_all_cached(self) -> dict:
        snap = self._snapshots[self._index] if self._index < len(self._snapshots) else {}
        self._index += 1
        return snap


async def replay_scenario(
    scenario_id: str,
    repo: ScenarioRepository,
    *,
    schedule: list[dict] | None = None,
    aircraft: list[dict] | None = None,
    crews: list[dict] | None = None,
) -> list[dict]:
    """Re-run a saved scenario from its seed. Returns the final recovery
    plans (list of plan dicts) after the last event in its timeline."""
    record = repo.load(scenario_id)
    if record is None:
        raise ValueError(f"No scenario {scenario_id!r} in {repo.db_path}")

    if schedule is None or aircraft is None or crews is None:
        cache.warm()
        schedule = cache.get_flights()
        aircraft = cache.get_aircraft()
        crews = cache.get_crew_pairings()

    engine = SimulationEngine(schedule, aircraft, crews)
    predictor = CascadePredictor()
    optimizer = RecoveryOptimizer(deterministic=True, timeout_secs=10)
    # Same duck-typed interface as WeatherClient for the one method the engine calls.
    weather = cast("WeatherClient", _FrozenWeatherClient(repo.load_metars(scenario_id)))

    for event in record.events:
        await engine.trigger_event(event, predictor, optimizer, weather)

    return engine.state.recovery_plans


def _main() -> None:
    parser = argparse.ArgumentParser(description="Replay a saved Aeolus scenario from its seed")
    parser.add_argument("scenario_id")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    args = parser.parse_args()

    repo = ScenarioRepository(args.db)
    plans = asyncio.run(replay_scenario(args.scenario_id, repo))
    print(json.dumps(plans, indent=2, default=str))


if __name__ == "__main__":
    _main()
