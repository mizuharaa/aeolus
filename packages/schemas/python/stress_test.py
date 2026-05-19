"""
Network vulnerability stress-test schemas — Slice 6.

Mirrors the response shape returned by `POST /api/v1/network/stress-test`
(see `apps/api/src/network/stress_test.py`). Used by the
`/simulator/stress-test` page to render the heatmap + ranked-vulnerability
table.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class ScenarioResult(BaseModel):
    """One Monte-Carlo iteration outcome."""
    airport:             str
    event_kind:          str
    severity:            str
    duration_min:        int
    affected:            int
    direct_hits:         int
    cascade_1:           int
    cascade_2:           int
    cancelled_estimate:  int
    total_delay_min:     int
    pax_delay_min:       int
    score:               float


class AirportSummary(BaseModel):
    """Roll-up over all iterations for a single airport."""
    airport:           str
    iterations:        int   = 0
    avg_affected:      float = 0.0
    p95_affected:      int   = 0
    avg_pax_delay_min: float = 0.0
    p95_pax_delay_min: int   = 0
    avg_score:         float = 0.0
    p95_score:         float = 0.0
    worst_kind:        str   = ""
    samples:           list[ScenarioResult] = Field(default_factory=list)


class StressTestRequest(BaseModel):
    airports:              Optional[list[str]] = None
    event_kinds:            Optional[list[str]] = None
    iterations_per_airport: int = 5
    seed:                   Optional[int] = 42


class StressTestResponse(BaseModel):
    iterations_per_airport: int
    total_scenarios:        int
    airports:               list[str]
    event_kinds:            list[str]
    ranked:                 list[AirportSummary] = Field(default_factory=list)
    # Heatmap: airport → event_kind → max score across iterations.
    heatmap:                dict[str, dict[str, float]] = Field(default_factory=dict)
    fleet_size:             int = 0
    schedule_size:          int = 0
