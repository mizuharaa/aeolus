"""Disruption event endpoints."""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

# Default scenario params for each event type
DEFAULT_PARAMS = {
    "weather_closure": {"airport": "KORD", "severity": "severe", "duration_hours": 4},
    "ground_stop": {"airport": "KORD", "duration_hours": 3},
    "airspace_closure": {
        "polygon": {"type": "Polygon", "coordinates": [[[44.0, 25.0], [63.0, 25.0], [63.0, 40.0], [44.0, 40.0], [44.0, 25.0]]]},
        "duration_hours": 24,
    },
    "security_event": {"airport": "KATL", "severity": "severe", "duration_hours": 3},
    "mechanical_aog": {"aircraft_tail": "N001NB", "airport": "KATL", "duration_hours": 8},
    "crew_sickout": {"base": "KORD", "percent_affected": 30, "duration_hours": 8},
    "runway_closure": {"airport": "KDFW", "runway_id": "17L", "capacity_cut_pct": 45, "duration_hours": 6},
    "atc_staffing": {"sector_or_airport": "KLAS", "capacity_pct": 40, "duration_hours": 5},
    "volcanic_ash": {
        "polygon": {"type": "Polygon", "coordinates": [[[-125.0, 44.0], [-117.0, 44.0], [-117.0, 50.0], [-125.0, 50.0], [-125.0, 44.0]]]},
        "duration_hours": 18,
        "severity": "severe",
    },
    "cyber_incident": {"airline": "NimbusAir", "degradation_pct": 60, "duration_hours": 12},
}

EVENT_DESCRIPTIONS = {
    "weather_closure": "Airport unavailable due to severe weather (thunderstorm, blizzard, etc.)",
    "ground_stop": "FAA issues GDP/GS — no departures until further notice",
    "airspace_closure": "Polygon of airspace blocked (geopolitical, NOTAM, military)",
    "security_event": "Security incident — airport evacuated, TSA re-screening required",
    "mechanical_aog": "Aircraft on ground — mechanical failure, awaiting parts/repairs",
    "crew_sickout": "Bulk crew unavailability — illness, sick call campaign",
    "runway_closure": "One or more runways closed — emergency repair, FOD, incident",
    "atc_staffing": "ATC staffing shortage — reduced TRACON/ARTCC throughput",
    "volcanic_ash": "Ash cloud — flights must avoid altitude range over affected polygon",
    "cyber_incident": "IT system degradation — manual processes, slower turnarounds",
}


class TriggerEventRequest(BaseModel):
    kind: str
    params: dict[str, Any] = {}


@router.get("/events/types")
async def get_event_types():
    return {
        "event_types": [
            {
                "kind": kind,
                "label": kind.replace("_", " ").title(),
                "description": EVENT_DESCRIPTIONS.get(kind, ""),
                "default_params": params,
            }
            for kind, params in DEFAULT_PARAMS.items()
        ]
    }


@router.get("/events/active")
async def get_active_events(request: Request):
    engine = request.app.state.engine
    if engine:
        return {"events": engine.state.active_events}
    return {"events": []}


@router.post("/events/trigger")
async def trigger_event(payload: TriggerEventRequest, request: Request):
    engine = request.app.state.engine
    predictor = request.app.state.predictor
    optimizer = request.app.state.optimizer
    weather = request.app.state.weather

    if payload.kind not in DEFAULT_PARAMS:
        raise HTTPException(status_code=400, detail=f"Unknown event kind: {payload.kind}")

    # Merge with defaults
    merged_params = {**DEFAULT_PARAMS[payload.kind], **payload.params}
    event = {
        "id": str(uuid.uuid4()),
        "kind": payload.kind,
        "triggered_at": datetime.utcnow().isoformat(),
        "params": merged_params,
    }

    if engine:
        result = await engine.trigger_event(event, predictor, optimizer, weather)
        return result
    else:
        return {"event": event, "message": "Engine not initialized"}


@router.delete("/events/{event_id}")
async def cancel_event(event_id: str, request: Request):
    engine = request.app.state.engine
    if engine:
        engine.state.active_events = [e for e in engine.state.active_events if e.get("id") != event_id]
        return {"status": "cancelled", "event_id": event_id}
    raise HTTPException(status_code=404, detail="Event not found")


_SCENARIOS_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "scenarios"


@router.get("/events/scenarios")
async def get_scenarios():
    import yaml
    scenarios = []
    try:
        for f in _SCENARIOS_DIR.glob("*.yaml"):
            with open(f) as fh:
                s = yaml.safe_load(fh)
                if s:
                    scenarios.append(s)
    except Exception:
        pass
    return {"scenarios": scenarios}
