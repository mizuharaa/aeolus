"""
Recovery-optimizer shared schemas.

Mirrors the wire shape returned by `POST /api/v1/recovery/solve`,
`POST /api/v1/recovery/explain`, and the cached plans on the simulation
engine. Every field that the frontend store (`apps/web/stores/simulation.ts`)
expects MUST appear here — keep these in lockstep.
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field

PlanStatus = Literal["optimal", "heuristic", "feasible", "infeasible"]


# ── Recovery-plan building blocks ─────────────────────────────────────────────

class AircraftSwap(BaseModel):
    flight_id:     str
    old_aircraft:  str
    new_aircraft:  str
    aircraft_type: Optional[str] = None


class DelayedFlight(BaseModel):
    flight_id:    str
    delay_minutes: int
    new_departure: Optional[str] = None


class CostBreakdown(BaseModel):
    """Plan-level financial decomposition (DOT BTS 2023 + Form 41 sources)."""
    grand_total_usd:          float = 0.0
    cancellation_total_usd:   float = 0.0
    delay_total_usd:          float = 0.0
    reposition_cost_usd:      float = 0.0
    total_pax_delay_minutes:  int   = 0
    cancelled_count:          int   = 0
    delayed_count:            int   = 0


class CarbonPerFlight(BaseModel):
    """Per-flight row in the CO₂ ledger — see optimizer/milp.py carbon_breakdown."""
    flight_id:  str
    co2_kg:     float = 0.0
    fuel_kg:    float = 0.0
    breakdown:  dict  = Field(default_factory=dict)
    note:       str   = ""


class CarbonBreakdown(BaseModel):
    """Plan-level CO₂ ledger priced under the EU ETS spot price (Slice 4)."""
    total_co2_kg:              float = 0.0
    total_co2_tonnes:          float = 0.0
    total_fuel_kg:             float = 0.0
    eu_ets_cost_usd:           float = 0.0
    saved_co2_kg:              float = 0.0
    burned_co2_kg:             float = 0.0
    ets_price_usd_per_tonne:   float = 0.0
    per_flight: list[CarbonPerFlight] = Field(default_factory=list)


# ── Recovery plan ─────────────────────────────────────────────────────────────

class RecoveryPlan(BaseModel):
    plan_id:         str                    # "A", "B", "C", or "D"
    objective_label: str
    status:          PlanStatus
    total_cost_usd:                float = 0.0
    total_passenger_delay_minutes: int   = 0
    cancelled_flights:    list[str]           = Field(default_factory=list)
    delayed_flights:      list[DelayedFlight] = Field(default_factory=list)
    aircraft_swaps:       list[AircraftSwap]  = Field(default_factory=list)
    crew_violations:           int = 0
    aircraft_out_of_position:  int = 0
    solve_time_ms:             int = 0
    summary:                   str = ""

    # Slice-level decomposition. Kept optional on the wire so older clients can
    # ignore them, but the v2 backend always emits both.
    cost_breakdown:    Optional[CostBreakdown]    = None
    # ── Carbon ledger (Slice 4 — Plan D) ─────────────────────────────────────
    # Present on every plan regardless of which objective it was solved against,
    # so any plan card can render CO₂ alongside dollars.
    total_co2_kg:      float = 0.0
    eu_ets_cost_usd:   float = 0.0
    carbon_breakdown:  Optional[CarbonBreakdown]  = None


# ── Plan-objective metadata (Slice 4 adds Plan D) ─────────────────────────────

class RecoveryObjective(BaseModel):
    label:            str
    cancel_weight:    float   # α
    pax_delay_weight: float   # β
    crew_weight:      float   # γ
    position_weight:  float   # δ


RECOVERY_OBJECTIVES: dict[str, RecoveryObjective] = {
    "A": RecoveryObjective(label="Minimize Cost",               cancel_weight=10.0, pax_delay_weight=1.0,  crew_weight=5.0, position_weight=2.0),
    "B": RecoveryObjective(label="Minimize Passenger Impact",   cancel_weight=1.0,  pax_delay_weight=10.0, crew_weight=2.0, position_weight=1.0),
    "C": RecoveryObjective(label="Protect Tomorrow's Schedule", cancel_weight=2.0,  pax_delay_weight=3.0,  crew_weight=2.0, position_weight=10.0),
    # Plan D — Green Recovery: weights carbon highest. The MILP scores
    # cancel-vs-delay-vs-ferry through the EU ETS price, so the same α/β/γ/δ
    # quadruple maps cleanly to a CO₂-aware objective.
    "D": RecoveryObjective(label="Green Recovery",              cancel_weight=1.0,  pax_delay_weight=2.0,  crew_weight=4.0, position_weight=1.0),
}


# ── Request shapes ────────────────────────────────────────────────────────────

class SolveRequest(BaseModel):
    event_ids:            list[str] = Field(default_factory=list)
    disrupted_flight_ids: list[str] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    """Counterfactual explainer input — see /recovery/explain (Slice 5)."""
    plan_id: str
    top_n:   int = 6


class Counterfactual(BaseModel):
    """One single-flip what-if applied to a plan's decision set."""
    flight_id:           str
    flip:                str           # "cancel→keep" | "keep→cancel" | "delay→ontime" | "ontime→delay"
    delta_cost_usd:      float
    delta_pax_delay_min: int
    delta_co2_kg:        float
    delta_eu_ets_usd:    float
    summary:             str


class ExplainResponse(BaseModel):
    """Glass-box rationale wrapping a base ledger and N flipped-decision deltas."""
    plan_id:            str
    base_cost_usd:      float
    base_pax_delay_min: int
    base_co2_kg:        float
    base_eu_ets_usd:    float
    counterfactuals:    list[Counterfactual] = Field(default_factory=list)
    rationale:          str = ""
