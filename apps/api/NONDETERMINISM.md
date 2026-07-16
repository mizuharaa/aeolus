# Nondeterminism inventory — sim loop

Sources of nondeterminism found while wiring scenario persistence + replay
(`src/store/repository.py`, `src/replay.py`), and how each is handled.

| Source | Where | Status | Notes |
|---|---|---|---|
| Event `id` / `triggered_at` | `SimulationEngine._trigger_event_unlocked` | **Pinned** | Was unconditionally re-stamped with `uuid4()` / `datetime.now()` on every call — including replay. Now only stamped if the event doesn't already carry them, so replay reuses the original values. This was the main bug: the cascade predictor derives its RNG seed from `sorted(event.items())`, so a re-stamped event silently reseeded on every replay. |
| Cascade predictor RNG | `CascadePredictor._rotation_predict` | **Already pinned** | Seeds `np.random.default_rng` from `sha256(repr(sorted(event.items())))`, not the process's `PYTHONHASHSEED`-salted `hash()`. Deterministic as long as the event dict is unchanged (see above). |
| `crew_sickout` RNG | `src/events/crew_sickout.py` | **Already pinned** | `random.Random(seed)` with an explicit seed param. |
| `runway_closure` RNG | `src/events/runway_closure.py` | **Fixed** | Uses an event-derived seed with an isolated `random.Random`, so runway-closure evaluation is repeatable without mutating the process-wide RNG. Guarded by `tests/test_events.py::TestRunwayClosure::test_simulation_evaluation_does_not_touch_global_random_state`. |
| Live METAR weather | `WeatherClient.get_all_cached()` | **Pinned via snapshot** | `ScenarioRepository` stores the exact METAR dict passed to the predictor at trigger time (`scenario_events.metar_json`). Replay reads it back through `_FrozenWeatherClient` instead of fetching live weather. |
| CP-SAT parallel search | `RecoveryOptimizer._solve_plan` (`num_search_workers=4`) | **Pinned for replay, waived for production** | Under a wall-clock time limit, a 4-worker portfolio search can return different (still-feasible) solutions run to run depending on which worker finishes first. `RecoveryOptimizer(deterministic=True)` forces `num_search_workers=1` + `random_seed=42`, used only by `replay_scenario()`. Production keeps 4 workers for solve speed — `/simulator/trigger` behavior/response shape is unchanged. |
| `solve_time_ms` | `RecoveryPlan.solve_time_ms` | **Waived** | A wall-clock measurement of that particular solve, not a recovery decision. Excluded from replay-equality comparisons (`replay.py` docstring, `test_persistence.py::_without_timing`). |
| `current_time` param | `CascadePredictor.predict(..., current_time=...)` | **Waived (inert)** | Threaded through `_rotation_predict`'s signature but never read in the function body — confirmed by inspection, not used in any delay/order calculation. No pinning needed. |
| Dict/set iteration order | `SimulationEngine`, `RecoveryOptimizer.solve` | **Already pinned** | All iteration is over `dict`s built from list input (insertion-ordered, deterministic in Python 3.7+) or over `set`s used only for O(1) membership tests, never iterated in a way that affects output ordering. |

## Replay scope

`replay_scenario()` (`src/replay.py`) re-triggers a saved scenario's events,
in order, against a fresh engine + fresh predictor + a deterministic
optimizer + frozen weather. It does **not** replay live OpenSky ADS-B data —
the simulator doesn't feed that into cascade predictions or recovery plans,
only into the live map view, so it's out of scope for plan reproducibility.
