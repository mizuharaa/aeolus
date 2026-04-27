// ── Recovery optimizer schemas ────────────────────────────────────────────────

export type PlanStatus = "optimal" | "heuristic" | "feasible" | "infeasible"

export interface AircraftSwap {
  flight_id: string
  old_aircraft: string
  new_aircraft: string
}

export interface DelayedFlight {
  flight_id: string
  delay_minutes: number
}

export interface RecoveryPlan {
  plan_id: string                         // "A", "B", or "C"
  objective_label: string
  status: PlanStatus
  total_cost_usd: number
  total_passenger_delay_minutes: number
  cancelled_flights: string[]
  delayed_flights: DelayedFlight[]
  aircraft_swaps: AircraftSwap[]
  crew_violations: number
  solve_time_ms: number
}

export interface RecoveryObjective {
  label: string
  cancel_weight: number                   // α
  pax_delay_weight: number                // β
  crew_weight: number                     // γ
  position_weight: number                 // δ
}

export const RECOVERY_OBJECTIVES: Record<string, RecoveryObjective> = {
  A: { label: "Minimize Cost",         cancel_weight: 10, pax_delay_weight: 1,  crew_weight: 5, position_weight: 2  },
  B: { label: "Minimize Pax Impact",   cancel_weight: 1,  pax_delay_weight: 10, crew_weight: 2, position_weight: 1  },
  C: { label: "Protect Tomorrow",      cancel_weight: 2,  pax_delay_weight: 3,  crew_weight: 2, position_weight: 10 },
}

export interface SolveRequest {
  event: import("./events").ActiveEvent
  flights: import("./network").ScheduledFlight[]
  current_time?: string                   // ISO-8601
}
