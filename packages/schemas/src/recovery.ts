// ── Recovery-optimizer shared schemas ────────────────────────────────────────
//
// Mirrors `apps/api/src/optimizer/milp.py` (RecoveryPlan dataclass) and
// `apps/api/src/optimizer/explain.py` (Counterfactual). Every field consumed
// by `apps/web/stores/simulation.ts` MUST live here — keep them in lockstep.

export type PlanStatus = "optimal" | "heuristic" | "feasible" | "infeasible"

// ── Building blocks ─────────────────────────────────────────────────────────

export interface AircraftSwap {
  flight_id:      string
  old_aircraft:   string
  new_aircraft:   string
  aircraft_type?: string
}

export interface DelayedFlight {
  flight_id:      string
  delay_minutes:  number
  new_departure?: string
}

export interface CostBreakdown {
  grand_total_usd:         number
  cancellation_total_usd:  number
  delay_total_usd:         number
  reposition_cost_usd:     number
  total_pax_delay_minutes: number
  cancelled_count:         number
  delayed_count:           number
}

/** Per-flight row in the CO₂ ledger — see optimizer/milp.py carbon_breakdown. */
export interface CarbonPerFlight {
  flight_id: string
  co2_kg:    number
  fuel_kg:   number
  breakdown: Record<string, number | string>
  note:      string
}

/** Plan-level CO₂ ledger priced under the EU ETS spot price (Slice 4). */
export interface CarbonBreakdown {
  total_co2_kg:             number
  total_co2_tonnes:         number
  total_fuel_kg:            number
  eu_ets_cost_usd:          number
  saved_co2_kg:             number
  burned_co2_kg:            number
  ets_price_usd_per_tonne:  number
  per_flight:               CarbonPerFlight[]
}

// ── Recovery plan ───────────────────────────────────────────────────────────

export interface RecoveryPlan {
  plan_id:         string                       // "A", "B", "C", or "D"
  objective_label: string
  status:          PlanStatus
  total_cost_usd:                number
  total_passenger_delay_minutes: number
  cancelled_flights:             string[]
  delayed_flights:               DelayedFlight[]
  aircraft_swaps:                AircraftSwap[]
  crew_violations:               number
  aircraft_out_of_position?:     number
  solve_time_ms:                 number
  summary?:                      string

  cost_breakdown?:               CostBreakdown
  // ── Carbon ledger (Slice 4 — Plan D) ─────────────────────────────────────
  // Present on every plan, not just Plan D, so any card can render CO₂.
  total_co2_kg?:                 number
  eu_ets_cost_usd?:              number
  carbon_breakdown?:             CarbonBreakdown
}

// ── Plan-objective metadata ─────────────────────────────────────────────────

export interface RecoveryObjective {
  label:            string
  cancel_weight:    number  // α
  pax_delay_weight: number  // β
  crew_weight:      number  // γ
  position_weight:  number  // δ
}

/**
 * Plan-objective registry. Mirrors `PLAN_WEIGHTS` in `optimizer/milp.py` —
 * change one, change the other.
 */
export const RECOVERY_OBJECTIVES: Record<string, RecoveryObjective> = {
  A: { label: "Minimize Cost",               cancel_weight: 10, pax_delay_weight: 1,  crew_weight: 5, position_weight: 2  },
  B: { label: "Minimize Passenger Impact",   cancel_weight: 1,  pax_delay_weight: 10, crew_weight: 2, position_weight: 1  },
  C: { label: "Protect Tomorrow's Schedule", cancel_weight: 2,  pax_delay_weight: 3,  crew_weight: 2, position_weight: 10 },
  // Plan D — Green Recovery: prices the recovery action set in EU-ETS dollars.
  D: { label: "Green Recovery",              cancel_weight: 1,  pax_delay_weight: 2,  crew_weight: 4, position_weight: 1  },
}

// ── Requests ────────────────────────────────────────────────────────────────

export interface SolveRequest {
  event: import("./events").ActiveEvent
  flights: import("./network").ScheduledFlight[]
  current_time?: string                   // ISO-8601
}

/** Counterfactual explainer input — POST /recovery/explain (Slice 5). */
export interface ExplainRequest {
  plan_id: string
  top_n?:  number   // defaults to 6
}

/** One single-flip what-if applied to a plan's decision set. */
export interface Counterfactual {
  flight_id:           string
  flip:                "cancel→keep" | "keep→cancel" | "delay→ontime" | "ontime→delay" | string
  delta_cost_usd:      number
  delta_pax_delay_min: number
  delta_co2_kg:        number
  delta_eu_ets_usd:    number
  summary:             string
}

/** Glass-box rationale wrapping a base ledger and N flipped-decision deltas. */
export interface ExplainResponse {
  plan_id:            string
  base_cost_usd:      number
  base_pax_delay_min: number
  base_co2_kg:        number
  base_eu_ets_usd:    number
  counterfactuals:    Counterfactual[]
  rationale:          string
}
