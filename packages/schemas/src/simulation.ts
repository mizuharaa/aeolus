// ── Simulation state ──────────────────────────────────────────────────────────

export interface FlightState {
  flight_id: string
  status: "scheduled" | "delayed" | "cancelled" | "diverted" | "airborne"
  delay_minutes: number
  cascade_order: number         // -1=unaffected, 0=direct, 1=cascade-1, 2=cascade-2
  p_delayed: number             // probability 0–1
  reason?: string
  tail?: string
  origin?: string
  destination?: string
  new_departure?: string        // ISO-8601 if rescheduled
}

export interface CascadeSummary {
  directly_affected: number
  cascade_1: number
  cascade_2: number
  total_affected: number
  total_delay_minutes?: number
  cancellation_cost_usd?: number
}

export interface SimulationState {
  sim_time?: string            // ISO-8601
  active_events: import("./events").ActiveEvent[]
  flight_states: Record<string, FlightState>
  recovery_plans: import("./recovery").RecoveryPlan[]
  schedule: import("./network").ScheduledFlight[]
}

// ── WebSocket message envelopes ───────────────────────────────────────────────

export type WSMessageType =
  | "ping"
  | "pong"
  | "state_snapshot"
  | "flight_update"
  | "event_triggered"
  | "recovery_plans"
  | "cascade_update"

export interface WSMessage<T = unknown> {
  type: WSMessageType
  payload?: T
  timestamp?: string
}

export interface FlightUpdatePayload {
  flight_states: Record<string, FlightState>
  cascade_summary?: CascadeSummary
  event?: import("./events").ActiveEvent
  active_events?: import("./events").ActiveEvent[]
  recovery_plans?: import("./recovery").RecoveryPlan[]
  schedule?: import("./network").ScheduledFlight[]
}
