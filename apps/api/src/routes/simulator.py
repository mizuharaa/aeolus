"""Simulator control endpoints."""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

SCENARIOS_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "scenarios"


class TriggerRequest(BaseModel):
    kind: str
    params: dict[str, Any] = {}


@router.post("/simulator/trigger")
async def trigger_disruption(payload: TriggerRequest, request: Request):
    """Trigger a disruption event and run full cascade + recovery analysis."""
    engine = request.app.state.engine
    predictor = request.app.state.predictor
    optimizer = request.app.state.optimizer
    weather = request.app.state.weather

    if not engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")

    DEFAULT_PARAMS = {
        "weather_closure": {"airport": "KORD", "severity": "severe", "duration_hours": 4},
        "ground_stop": {"airport": "KORD", "duration_hours": 3},
        "airspace_closure": {"duration_hours": 24},
        "security_event": {"airport": "KATL", "severity": "severe", "duration_hours": 3},
        "mechanical_aog": {"aircraft_tail": "N001NB", "airport": "KATL", "duration_hours": 8},
        "crew_sickout": {"base": "KORD", "percent_affected": 30, "duration_hours": 8},
        "runway_closure": {
            "airport": "KDFW",
            "runway_id": "17L",
            "capacity_cut_pct": 45,
            "duration_hours": 6,
        },
        "atc_staffing": {"sector_or_airport": "KLAS", "capacity_pct": 40, "duration_hours": 5},
        "volcanic_ash": {"duration_hours": 18, "severity": "severe"},
        "cyber_incident": {"airline": "NimbusAir", "degradation_pct": 60, "duration_hours": 12},
    }
    merged = {**DEFAULT_PARAMS.get(payload.kind, {}), **payload.params}
    event = {
        "id": str(uuid.uuid4()),
        "kind": payload.kind,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "params": merged,
    }
    result = await engine.trigger_event(event, predictor, optimizer, weather)
    return result


@router.post("/simulator/reset")
async def reset_simulator(request: Request):
    """Reset simulation to clean state."""
    engine = request.app.state.engine
    if engine:
        engine.reset()
    return {"status": "reset", "message": "Simulation reset to initial schedule"}


@router.get("/simulator/state")
async def get_simulator_state(request: Request):
    """Return current simulation state."""
    engine = request.app.state.engine
    if not engine:
        return {"status": "not_initialized"}
    return {
        "sim_time": engine.state.sim_time.isoformat()
        if hasattr(engine.state, "sim_time")
        else None,
        "active_events": engine.state.active_events,
        "flight_states": engine.state.flight_states,
        "recovery_plans": engine.state.recovery_plans,
        "schedule": engine.get_schedule_snapshot(),
    }


@router.get("/simulator/schedule")
async def get_simulator_schedule(request: Request):
    """Return the current flight schedule with per-flight states."""
    engine = request.app.state.engine
    if not engine:
        return {"flights": []}
    return {"flights": engine.get_schedule_snapshot()}


@router.get("/simulator/scenarios")
async def list_scenarios():
    """Return available canned scenarios."""
    scenarios = []
    try:
        for f in SCENARIOS_DIR.glob("*.yaml"):
            with open(f) as fh:
                s = yaml.safe_load(fh)
                if s:
                    scenarios.append(s)
    except Exception:
        pass
    return {"scenarios": scenarios}


@router.post("/simulator/scenarios/{scenario_name}/load")
async def load_scenario(scenario_name: str, request: Request):
    """Load and trigger a canned scenario."""
    engine = request.app.state.engine
    predictor = request.app.state.predictor
    optimizer = request.app.state.optimizer
    weather = request.app.state.weather

    scenario_file = SCENARIOS_DIR / f"{scenario_name}.yaml"
    if not scenario_file.exists():
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_name}' not found")

    with open(scenario_file) as f:
        scenario = yaml.safe_load(f)

    # Reset first
    if engine:
        engine.reset()

    results = []
    for ev_def in scenario.get("events", []):
        event = {
            "id": str(uuid.uuid4()),
            "kind": ev_def["kind"],
            "triggered_at": datetime.now(timezone.utc).isoformat(),
            "params": ev_def.get("params", {}),
            "scenario": scenario_name,
        }
        if engine:
            result = await engine.trigger_event(event, predictor, optimizer, weather)
            results.append(result)

    return {
        "scenario": scenario_name,
        "display_name": scenario.get("display_name", scenario_name),
        "events_triggered": len(results),
        "result": results[-1] if results else {},
    }
