"""Network data endpoints."""
from pathlib import Path

import yaml
from fastapi import APIRouter, Request
from pydantic import BaseModel

from src.network.stress_test import (
    DEFAULT_AIRPORTS,
    DEFAULT_EVENT_KINDS,
    run_stress_test,
)

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "network"


def _load_yaml(filename: str) -> dict:
    try:
        with open(DATA_DIR / filename) as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        return {}


@router.get("/network")
async def get_network():
    airports = _load_yaml("airports.yaml").get("airports", [])
    aircraft = _load_yaml("aircraft.yaml").get("aircraft", [])
    flights = _load_yaml("flights.yaml").get("flights", [])
    crews = _load_yaml("crews.yaml").get("crew_pairings", [])
    return {
        "airline": "Nimbus Air",
        "airports": airports,
        "aircraft": aircraft,
        "flights": flights,
        "crew_pairings": crews,
        "stats": {
            "airport_count": len(airports),
            "aircraft_count": len(aircraft),
            "flight_count": len(flights),
            "crew_pairing_count": len(crews),
        },
    }


@router.get("/airports")
async def get_airports():
    data = _load_yaml("airports.yaml")
    return {"airports": data.get("airports", [])}


@router.get("/airports/{airport_id}")
async def get_airport(airport_id: str):
    data = _load_yaml("airports.yaml")
    for ap in data.get("airports", []):
        if ap["id"] == airport_id.upper():
            return ap
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Airport {airport_id} not found")


@router.get("/aircraft")
async def get_aircraft():
    data = _load_yaml("aircraft.yaml")
    return {"aircraft": data.get("aircraft", [])}


@router.get("/aircraft/{tail}")
async def get_single_aircraft(tail: str):
    data = _load_yaml("aircraft.yaml")
    for ac in data.get("aircraft", []):
        if ac["id"] == tail.upper():
            return ac
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Aircraft {tail} not found")


@router.get("/flights")
async def get_flights(status: str | None = None, origin: str | None = None, destination: str | None = None):
    data = _load_yaml("flights.yaml")
    flights = data.get("flights", [])
    if status:
        flights = [f for f in flights if f.get("status") == status]
    if origin:
        flights = [f for f in flights if f.get("origin") == origin.upper()]
    if destination:
        flights = [f for f in flights if f.get("destination") == destination.upper()]
    return {"flights": flights, "count": len(flights)}


@router.get("/flights/{flight_id}")
async def get_flight(flight_id: str):
    data = _load_yaml("flights.yaml")
    for f in data.get("flights", []):
        if f["id"] == flight_id.upper():
            return f
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Flight {flight_id} not found")


@router.get("/crews")
async def get_crews():
    data = _load_yaml("crews.yaml")
    return {
        "crew_members": data.get("crew_members", []),
        "crew_pairings": data.get("crew_pairings", []),
    }


@router.get("/schedule")
async def get_schedule(request: Request):
    """Return current schedule with live state from simulation engine."""
    engine = request.app.state.engine
    if engine:
        return {"flights": engine.get_schedule_snapshot()}
    return {"flights": _load_yaml("flights.yaml").get("flights", [])}


class StressTestRequest(BaseModel):
    airports: list[str] | None = None
    event_kinds: list[str] | None = None
    iterations_per_airport: int = 5
    seed: int | None = 42


@router.post("/network/stress-test")
async def post_stress_test(payload: StressTestRequest, request: Request):
    """
    Network vulnerability stress test — Slice 6.

    Runs a Monte-Carlo sweep of single-airport disruptions across the
    Nimbus Air schedule and returns a ranked vulnerability heatmap. Used
    by `/simulator/stress-test` to surface the most fragile hubs before
    a real disruption hits.
    """
    predictor = getattr(request.app.state, "predictor", None)
    if predictor is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Cascade predictor not initialised")

    flights = _load_yaml("flights.yaml").get("flights", [])
    aircraft = _load_yaml("aircraft.yaml").get("aircraft", [])

    return run_stress_test(
        flights=flights,
        aircraft=aircraft,
        predictor=predictor,
        airports=payload.airports or DEFAULT_AIRPORTS,
        event_kinds=payload.event_kinds or DEFAULT_EVENT_KINDS,
        iterations_per_airport=max(1, min(20, payload.iterations_per_airport)),
        seed=payload.seed,
    )
