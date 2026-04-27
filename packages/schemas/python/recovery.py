from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel

PlanStatus = Literal["optimal", "heuristic", "feasible", "infeasible"]


class AircraftSwap(BaseModel):
    flight_id: str
    old_aircraft: str
    new_aircraft: str


class DelayedFlight(BaseModel):
    flight_id: str
    delay_minutes: int


class RecoveryPlan(BaseModel):
    plan_id: str                    # "A", "B", or "C"
    objective_label: str
    status: PlanStatus
    total_cost_usd: float
    total_passenger_delay_minutes: int
    cancelled_flights: list[str] = []
    delayed_flights: list[DelayedFlight] = []
    aircraft_swaps: list[AircraftSwap] = []
    crew_violations: int = 0
    solve_time_ms: int = 0
