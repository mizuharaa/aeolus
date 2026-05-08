"""Recovery optimizer endpoints."""
import datetime
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.optimizer.crew_overbooking import CrewOverbookingOptimizer

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "network"

_crew_ob_optimizer = CrewOverbookingOptimizer()


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
            raw = yaml.safe_load(f)
            crews    = raw.get("crew_pairings", [])
            members  = raw.get("crew_members", [])
        return flights, aircraft, crews, members
    except Exception:
        return [], [], [], []


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
    flights, aircraft, crews, _ = _load_network()
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
    predictions = predictor.predict(flights, event, metar_data, datetime.datetime.now(datetime.timezone.utc)) if predictor else {}

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
                "plan_id":                      p.plan_id,
                "objective_label":              p.objective_label,
                "status":                       p.status,
                "solve_time_ms":                p.solve_time_ms,
                "cancelled_flights":            p.cancelled_flights,
                "delayed_flights":              p.delayed_flights,
                "aircraft_swaps":               p.aircraft_swaps,
                "crew_reassignments":           p.crew_reassignments,
                "total_cost_usd":               p.total_cost_usd,
                "total_passenger_delay_minutes": p.total_passenger_delay_minutes,
                "crew_violations":              p.crew_violations,
                "aircraft_out_of_position":     p.aircraft_out_of_position,
                "cost_breakdown":               p.cost_breakdown,
                "summary":                      p.summary,
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


@router.post("/recovery/crew-overbooking")
async def solve_crew_overbooking(request: Request):
    """
    Run the crew overbooking MILP.

    Detects which flights lack legal crew due to the active disruption,
    finds the maximum-coverage reassignment of available crew, and returns
    compensation obligations per uncovered flight.
    """
    engine    = getattr(request.app.state, "engine", None)
    predictor = getattr(request.app.state, "predictor", None)
    weather   = getattr(request.app.state, "weather", None)

    flights, aircraft, crews, members = _load_network()
    flights_by_id = {f["id"]: f for f in flights}

    active_events: list[dict]  = engine.state.active_events if engine else []
    flight_states: dict        = engine.state.flight_states if engine else {}
    event_kind = active_events[0].get("kind", "") if active_events else ""

    # Cascade predictions
    metar_data  = weather.get_all_cached() if weather else {}
    active_ev   = active_events[0] if active_events else {}
    predictions = (
        predictor.predict(flights, active_ev, metar_data, datetime.datetime.now(datetime.timezone.utc))
        if predictor else {}
    )

    # Determine which crew are affected
    affected_pct = 0.0
    for ev in active_events:
        if ev.get("kind") == "crew_sickout":
            affected_pct = float(ev.get("params", {}).get("percentage", 30)) / 100.0

    all_captain_ids  = {m["id"] for m in members if m.get("role") == "captain"}
    affected_count   = max(1, int(len(all_captain_ids) * affected_pct)) if affected_pct else 0

    # Naive: mark the first N captains as unavailable (in a real system, engine tracks this)
    sorted_caps      = sorted(all_captain_ids)
    unavailable_caps = set(sorted_caps[:affected_count])
    available_caps   = all_captain_ids - unavailable_caps

    # Identify open flights (disrupted + status not cancelled by engine already)
    open_flights: list[dict] = []
    disrupted_ids: list[str] = []
    for fid, fstate in flight_states.items():
        if fstate.get("cascade_order", -1) < 0:
            continue
        disrupted_ids.append(fid)
        flight = flights_by_id.get(fid)
        if not flight:
            continue
        # Check if original pairing uses an unavailable captain
        pairing = next((p for p in crews if p.get("flight_id") == fid), None)
        if pairing and pairing.get("captain_id") in unavailable_caps:
            open_flights.append({**flight, "aircraft_type": ""})
        elif not pairing and event_kind in {"crew_sickout"}:
            open_flights.append({**flight, "aircraft_type": ""})

    result = _crew_ob_optimizer.solve(
        open_flights=open_flights,
        crew_members=members,
        existing_pairings=crews,
        available_crew_ids=available_caps,
        event_kind=event_kind,
        disrupted_flight_ids=disrupted_ids,
        predictions=predictions,
    )

    return result.to_dict()
