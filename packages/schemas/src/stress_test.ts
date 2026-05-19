// ── Network vulnerability stress-test schemas (Slice 6) ──────────────────────
//
// Mirrors `apps/api/src/network/stress_test.py`. Consumed by the
// `/simulator/stress-test` page to render the heatmap + ranked-vulnerability
// table.

/** One Monte-Carlo iteration outcome. */
export interface ScenarioResult {
  airport:            string
  event_kind:         string
  severity:           string
  duration_min:       number
  affected:           number
  direct_hits:        number
  cascade_1:          number
  cascade_2:          number
  cancelled_estimate: number
  total_delay_min:    number
  pax_delay_min:      number
  score:              number
}

/** Roll-up over all iterations for a single airport. */
export interface AirportSummary {
  airport:           string
  iterations:        number
  avg_affected:      number
  p95_affected:      number
  avg_pax_delay_min: number
  p95_pax_delay_min: number
  avg_score:         number
  p95_score:         number
  worst_kind:        string
  samples:           ScenarioResult[]
}

export interface StressTestRequest {
  airports?:              string[]
  event_kinds?:            string[]
  iterations_per_airport?: number   // default 5, clamped [1, 20]
  seed?:                   number | null
}

export interface StressTestResponse {
  iterations_per_airport: number
  total_scenarios:        number
  airports:               string[]
  event_kinds:            string[]
  ranked:                 AirportSummary[]
  /** Heatmap matrix: airport → event_kind → max score across iterations. */
  heatmap:                Record<string, Record<string, number>>
  fleet_size:             number
  schedule_size:          number
}
