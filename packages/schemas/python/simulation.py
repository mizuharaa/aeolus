from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel


class FlightState(BaseModel):
    flight_id: str
    status: Literal["scheduled", "delayed", "cancelled", "diverted", "airborne"]
    delay_minutes: int = 0
    cascade_order: int = -1         # -1=unaffected, 0=direct, 1,2=cascade
    p_delayed: float = 0.0          # probability 0–1
    reason: Optional[str] = None
    tail: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    new_departure: Optional[str] = None


class CascadeSummary(BaseModel):
    directly_affected: int = 0
    cascade_1: int = 0
    cascade_2: int = 0
    total_affected: int = 0
    total_delay_minutes: Optional[int] = None
    cancellation_cost_usd: Optional[float] = None


class SimulationState(BaseModel):
    sim_time: Optional[str] = None
    active_events: list = []
    flight_states: dict[str, FlightState] = {}
    recovery_plans: list = []
    schedule: list = []
