"""Recovery optimizer endpoints."""
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "network"


class SolveRequest(BaseModel):
    event_ids: list[str] = []
    disrupted_flight_ids: list[str] = []


def _load_network():
    try:
        with open(DATA_DIR / "flights.yaml") as f:
            flights = yaml.safe_load(f).get("flights", [])
        with open(DATA_DIR / "aircraft.yaml") as f:
            aircraft = yaml.safe_load(f).get("aircraft", [])
        with open(DATA_DIR / "crews.yaml") as f:
            crews = yaml.safe_load(f).get("crew_pairings", [])
        return flights, aircraft, crews
    except Exception:
        return [], [], []


@router.post("/recovery/solve")
async def solve_recovery(payload: SolveRequest, request: Request):
    """Run the recovery optimizer and return 3 plans."""
    optimizer = request.app.state.optimizer
    predictor = request.app.state.predictor
    weather = request.app.state.weather
    engine = request.app.state.engine

    if not optimizer:
        raise HTTPException(status_code=503, detail="Optimizer not initialized")

    # Get schedule + active constraints
    flights, aircraft, crews = _load_network()
    active_events = engine.state.active_events if engine else []
    constraints = []
    for ev in active_events:
        kind = ev.get("kind", "")
        params = ev.get("params", {})
        if kind in ("weather_closure", "ground_stop", "security_event"):
            constraints.append({"type": "airport_unavailable", "airport": params.get("airport", ""), "start": "", "end": ""})
        elif kind == "mechanical_aog":
            constraints.append({"type": "aircraft_grounded", "aircraft_tail": params.get("aircraft_tail", "")})

    # Get cascade predictions
    disrupted = payload.disrupted_flight_ids or (
        list(engine.state.flight_states.keys()) if engine else []
    )
    metar_data = weather.get_all_cached() if weather else {}
    event = active_events[0] if active_events else {}
    predictions = predictor.predict(flights, event, metar_data, __import__("datetime").datetime.utcnow()) if predictor else {}

    plans = optimizer.solve(
        schedule=flights,
        aircraft=aircraft,
        crews=crews,
        events=constraints,
        disrupted_flights=disrupted,
        cascade_predictions=predictions,
    )

    return {
        "plans": [
            {
                "plan_id": p.plan_id,
                "objective_label": p.objective_label,
                "status": p.status,
                "solve_time_ms": p.solve_time_ms,
                "cancelled_flights": p.cancelled_flights,
                "delayed_flights": p.delayed_flights,
                "aircraft_swaps": p.aircraft_swaps,
                "crew_reassignments": p.crew_reassignments,
                "total_cost_usd": p.total_cost_usd,
                "total_passenger_delay_minutes": p.total_passenger_delay_minutes,
                "crew_violations": p.crew_violations,
                "aircraft_out_of_position": p.aircraft_out_of_position,
                "summary": p.summary,
            }
            for p in plans
        ]
    }


@router.get("/recovery/plans")
async def get_current_plans(request: Request):
    """Return most recent recovery plans from the simulation engine."""
    engine = request.app.state.engine
    if engine:
        return {"plans": engine.state.recovery_plans}
    return {"plans": []}
