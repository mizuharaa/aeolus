import { create } from "zustand"

export interface FlightState {
  flight_id: string
  status: "scheduled" | "delayed" | "cancelled" | "diverted" | "airborne"
  delay_minutes: number
  cascade_order: number
  p_delayed: number
  reason?: string
  tail?: string
  origin?: string
  destination?: string
  new_departure?: string
  // Stamped by engine.apply_plan with the plan letter that mutated this
  // flight (e.g. "A" / "B" / "C" / "D"). Used by the map to tell apart
  // cancellations from THE CURRENTLY-APPLIED PLAN vs lingering mutations
  // from a previously-applied plan that the backend will revert on the
  // next broadcast. Without this, switching plans showed a transient
  // "all of A's + B's grey lines" state for ~100ms.
  applied_plan_id?: string | null
  applied_action?:  "cancelled" | "delayed" | "swapped" | null
}

export interface CascadeSummary {
  directly_affected: number
  cascade_1: number
  cascade_2: number
  total_affected: number
  total_delay_minutes?: number
  cancellation_cost_usd?: number
}

export interface ActiveEvent {
  id: string
  kind: string
  params: Record<string, any>
  triggered_at?: string
  expires_at?: string
}

export interface RecoveryPlan {
  plan_id: string
  objective_label: string
  status: "optimal" | "heuristic" | "feasible" | "infeasible"
  total_cost_usd: number
  total_passenger_delay_minutes: number
  cancelled_flights: string[]
  delayed_flights: Array<{ flight_id: string; delay_minutes: number; new_departure?: string }>
  aircraft_swaps: Array<{
    flight_id: string
    old_aircraft: string
    new_aircraft: string
    aircraft_type?: string
  }>
  crew_violations: number
  aircraft_out_of_position?: number
  solve_time_ms: number
  summary?: string
  cost_breakdown?: {
    grand_total_usd: number
    cancellation_total_usd: number
    delay_total_usd: number
    reposition_cost_usd: number
    total_pax_delay_minutes: number
    cancelled_count: number
    delayed_count: number
  }
  // Carbon ledger — Slice 4 / Plan D. Present on every plan, regardless of
  // which objective it was optimised against, so the UI can surface CO₂
  // alongside dollars.
  total_co2_kg?: number
  eu_ets_cost_usd?: number
  carbon_breakdown?: {
    total_co2_kg: number
    total_co2_tonnes: number
    total_fuel_kg: number
    eu_ets_cost_usd: number
    saved_co2_kg: number
    burned_co2_kg: number
    ets_price_usd_per_tonne: number
    per_flight: Array<{
      flight_id: string
      co2_kg: number
      fuel_kg: number
      breakdown: Record<string, number | string>
      note: string
    }>
  }
}

export interface ScheduledFlight {
  id: string
  flight_number?: string
  origin: string
  destination: string
  scheduled_departure: string
  scheduled_arrival: string
  tail_number?: string
  aircraft_id?: string
  passengers?: number
  status?: string
}

export interface FleetAircraft {
  id: string
  type?: string
  seats?: number
  base_airport_id?: string
  range_nm?: number
  min_turn_minutes?: number
}

/** A real aircraft state from OpenSky Network */
export interface LiveFlight {
  icao24: string
  callsign: string
  flight_iata: string | null
  flight_icao: string
  airline_iata: string | null
  airline_name: string
  origin_country: string
  lat: number
  lon: number
  altitude_ft: number | null
  on_ground: boolean
  velocity_kt: number | null
  heading: number | null
  vertical_fpm: number | null
  squawk: string | null
  last_contact: number
  tracking: {
    flightaware: string | null
    flightradar24: string
    adsbexchange: string
    opensky: string
  }
}

interface SimulationStore {
  // Simulation state
  flightStates: Record<string, FlightState>
  activeEvents: ActiveEvent[]
  recoveryPlans: RecoveryPlan[]
  cascadeSummary: CascadeSummary | null
  schedule: ScheduledFlight[]
  fleet: FleetAircraft[]
  isLoading: boolean
  lastEventAt: number | null
  appliedPlanId: string | null

  // Real live flights from OpenSky
  liveFlights: LiveFlight[]
  liveFlightsTs: number | null
  showLiveFlights: boolean
  showSimulation: boolean
  selectedLiveFlight: LiveFlight | null

  // Actions
  setUpdate: (update: any) => void
  setSchedule: (schedule: ScheduledFlight[]) => void
  setFleet: (fleet: FleetAircraft[]) => void
  reset: () => void
  setLoading: (loading: boolean) => void
  applyPlan: (planId: string | null) => void
  setLiveFlights: (flights: LiveFlight[], ts?: number) => void
  hydrateLiveFromCache: () => void
  hydrateStaticFromCache: () => void
  setShowLiveFlights: (show: boolean) => void
  setShowSimulation: (show: boolean) => void
  setSelectedLiveFlight: (flight: LiveFlight | null) => void
}

// ────────────────────────────────────────────────────────────────────
// Internal merge helpers
//
// The backend emits four kinds of inbound messages we care about:
//   1. `connected`        — initial WS snapshot on (re)connect
//   2. `state_snapshot`   — same shape, fired on explicit `get_state`
//   3. `simulation_update`— a real new event was just processed
//   4. `flight_state`     — single-flight push
//
// Pre-fix, the store collapsed all four into one merge that:
//   a) wiped `recoveryPlans` if the snapshot sent `[]`  (`?? ` doesn't
//      coalesce empty arrays, so `[]` overwrote a populated list)
//   b) reset `appliedPlanId` to `null` on EVERY message, including pings
//      and snapshots — operators lost their applied plan whenever they
//      navigated routes or refreshed.
//
// Post-fix:
//   • A snapshot (connected / state_snapshot) is treated as a hint, not a
//     truth: it can REPLACE empty client state, but never REPLACE non-empty
//     client state with empty server state. The server might restart between
//     navigations; we don't let a transient gap erase what we already know.
//   • An empty-array recovery_plans on a real `simulation_update` IS honored
//     (a new event with no feasible plan is a legitimate "wipe").
//   • `appliedPlanId` only resets when a brand-new `event` arrives.
// ────────────────────────────────────────────────────────────────────

type UpdateKind = "snapshot" | "event" | "applied" | "single-flight" | "unknown"

function classify(update: any): UpdateKind {
  const t = update?.type
  if (t === "connected" || t === "state_snapshot") return "snapshot"
  if (t === "simulation_update" || update?.event)  return "event"
  if (t === "plan_applied" || t === "plan_unapplied") return "applied"
  // event_cancelled ships the full reverted state + authoritative
  // applied_plan_id — treat like an apply-style server-authoritative update
  if (t === "event_cancelled") return "applied"
  if (t === "flight_state")                        return "single-flight"
  // Some legacy paths broadcast without a `type`. If they carry plans or
  // an `event` payload, treat as event; otherwise let the merge keep state.
  if (update?.recovery_plans || update?.cascade_summary) return "event"
  return "unknown"
}

/** Pick a fresh value only when it would not REGRESS the client. */
function pickArray<T>(incoming: T[] | undefined | null, existing: T[], kind: UpdateKind): T[] {
  if (incoming == null) return existing
  // Snapshot messages can only REPLACE empty client state. They never
  // overwrite a populated list with an empty one — that's the bug that
  // caused "Awaiting Disruption" to flash on every secondary page.
  if (kind === "snapshot" && incoming.length === 0 && existing.length > 0) return existing
  return incoming
}

function pickObj<T extends object>(incoming: T | undefined | null, existing: T | null, kind: UpdateKind): T | null {
  if (incoming == null) return existing
  if (kind === "snapshot" && existing != null && Object.keys(incoming).length === 0) return existing
  return incoming
}

function pickRecord<V>(
  incoming: Record<string, V> | undefined | null,
  existing: Record<string, V>,
  kind: UpdateKind,
): Record<string, V> {
  if (incoming == null) return existing
  if (kind === "snapshot" && Object.keys(incoming).length === 0 && Object.keys(existing).length > 0) {
    return existing
  }
  return incoming
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  flightStates: {},
  activeEvents: [],
  recoveryPlans: [],
  cascadeSummary: null,
  schedule: [],
  fleet: [],
  isLoading: false,
  lastEventAt: null,
  appliedPlanId: null,

  liveFlights: [],
  liveFlightsTs: null,
  showLiveFlights: true,
  showSimulation: false,
  selectedLiveFlight: null,

  setUpdate: (update) =>
    set((state) => {
      const kind = classify(update)

      // `single-flight` updates only patch one flight's state; everything
      // else stays put.
      if (kind === "single-flight" && update?.flight_id && update?.state) {
        return {
          flightStates: { ...state.flightStates, [update.flight_id]: { ...state.flightStates[update.flight_id], ...update.state } },
        }
      }

      // Merge `active_events`: an event-kind update with a single new event
      // (no full list) appends — same as before. Snapshots replace the list
      // (subject to the snapshot guard).
      let nextActive = state.activeEvents
      if (Array.isArray(update?.active_events)) {
        nextActive = pickArray(update.active_events as ActiveEvent[], state.activeEvents, kind)
      } else if (update?.event) {
        const e = update.event as ActiveEvent
        nextActive = state.activeEvents.some((x) => x.id === e.id)
          ? state.activeEvents
          : [...state.activeEvents, e]
      }

      const nextSchedule = update?.schedule || update?.flights
        ? (update.schedule || update.flights) as ScheduledFlight[]
        : state.schedule

      // ── appliedPlanId merge ─────────────────────────────────────────
      //   • brand-new event arrives  → reset to null (operator should pick
      //     fresh, prior plan is no longer relevant);
      //   • `plan_applied` / `plan_unapplied` message → take the server's
      //     authoritative `applied_plan_id` directly (the apply endpoint
      //     mutated engine state, we mirror it);
      //   • `connected` / `state_snapshot` → adopt the server value if it
      //     differs from null AND we have no local guess. Snapshot guard:
      //     don't let a stale snapshot wipe a recently-applied plan.
      //   • otherwise keep the existing client value.
      let nextApplied: string | null = state.appliedPlanId
      if (kind === "event" && update?.event) {
        nextApplied = null
      } else if (kind === "applied") {
        nextApplied = (update?.applied_plan_id ?? update?.plan_id ?? null) as string | null
      } else if (kind === "snapshot" && update?.applied_plan_id != null) {
        nextApplied = String(update.applied_plan_id)
      }

      return {
        flightStates:   pickRecord(update?.flight_states as Record<string, FlightState> | undefined, state.flightStates, kind),
        activeEvents:   nextActive,
        recoveryPlans:  pickArray<RecoveryPlan>(update?.recovery_plans, state.recoveryPlans, kind),
        cascadeSummary: pickObj<CascadeSummary>(update?.cascade_summary, state.cascadeSummary, kind),
        schedule:       nextSchedule,
        appliedPlanId:  nextApplied,
        lastEventAt:    kind === "event" && update?.event ? Date.now() : state.lastEventAt,
      }
    }),

  setSchedule: (schedule) => {
    // Cache the Nimbus schedule so a reload paints the fleet + routes
    // instantly instead of waiting on the API roundtrip (kills the long
    // dashboard boot). Read back by hydrateStaticFromCache().
    try {
      if (schedule.length > 0)
        sessionStorage.setItem("aeolus-schedule-cache", JSON.stringify({ schedule, ts: Date.now() }))
    } catch {}
    set({ schedule })
  },

  setFleet: (fleet) => {
    try {
      if (fleet.length > 0)
        sessionStorage.setItem("aeolus-fleet-cache", JSON.stringify({ fleet, ts: Date.now() }))
    } catch {}
    set({ fleet })
  },

  hydrateStaticFromCache: () => {
    try {
      if (get().schedule.length === 0) {
        const raw = sessionStorage.getItem("aeolus-schedule-cache")
        if (raw) {
          const { schedule } = JSON.parse(raw) as { schedule: ScheduledFlight[]; ts: number }
          if (Array.isArray(schedule) && schedule.length > 0) set({ schedule })
        }
      }
      if (get().fleet.length === 0) {
        const raw = sessionStorage.getItem("aeolus-fleet-cache")
        if (raw) {
          const { fleet } = JSON.parse(raw) as { fleet: FleetAircraft[]; ts: number }
          if (Array.isArray(fleet) && fleet.length > 0) set({ fleet })
        }
      }
    } catch {}
  },

  reset: () =>
    set({
      flightStates: {},
      activeEvents: [],
      recoveryPlans: [],
      cascadeSummary: null,
      lastEventAt: null,
      appliedPlanId: null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  // Apply (or unapply) a recovery plan. Optimistically flips the local
  // appliedPlanId immediately so the button feels responsive, then POSTs
  // to /recovery/apply. The backend mutates engine.state.flight_states
  // and broadcasts a `plan_applied` message that every connected tab
  // (cascade / carbon / crew / passengers / plans) picks up via setUpdate,
  // so secondary surfaces finally "catch up" when the operator commits.
  applyPlan: (planId) => {
    set({ appliedPlanId: planId })
    // Fire-and-forget. If the backend rejects (e.g. unknown plan_id), we
    // still keep the optimistic state — the next WS broadcast or snapshot
    // will correct it. We deliberately don't await this so the UI stays
    // snappy even if the API roundtrip takes a moment.
    try {
      // Late import avoids a circular dep with the api client during HMR.
      const { apiClient } = require("@/lib/api")
      apiClient
        .post("/recovery/apply", { plan_id: planId })
        .catch((e: unknown) => {
          if (typeof console !== "undefined") {
            console.warn("[applyPlan] backend apply failed:", e)
          }
        })
    } catch {
      // No api client available in this environment — local-only apply.
    }
  },

  setLiveFlights: (flights, ts) => {
    const stamp = ts ?? Date.now()
    // Cache the fleet in sessionStorage so a reload / re-navigation to the
    // dashboard paints the last-known planes instantly instead of showing an
    // empty map while the next ADS-B fetch is in flight (stops the "constant
    // loading" feel). Read back by hydrateLiveFromCache().
    try {
      sessionStorage.setItem("aeolus-live-cache", JSON.stringify({ flights, ts: stamp }))
    } catch {}
    set({ liveFlights: flights, liveFlightsTs: stamp })
  },

  hydrateLiveFromCache: () => {
    if (get().liveFlights.length > 0) return
    try {
      const raw = sessionStorage.getItem("aeolus-live-cache")
      if (!raw) return
      const { flights, ts } = JSON.parse(raw) as { flights: LiveFlight[]; ts: number }
      // Only trust a recent cache (90s) — older than that and the positions
      // are stale enough that a fresh fetch is worth waiting for.
      if (Array.isArray(flights) && flights.length > 0 && Date.now() - ts < 90_000) {
        set({ liveFlights: flights, liveFlightsTs: ts })
      }
    } catch {}
  },

  setShowLiveFlights: (show) => set({ showLiveFlights: show }),

  setShowSimulation: (show) => set({ showSimulation: show }),

  setSelectedLiveFlight: (flight) =>
    set({ selectedLiveFlight: flight }),
}))

// ────────────────────────────────────────────────────────────────────
// Selectors
//
// `useHasActiveDisruption()` is the canonical "should we show the
// awaiting-disruption empty state?" predicate. It looks at THREE signals
// instead of just `recoveryPlans.length === 0`, so a page that lands
// mid-snapshot doesn't flash empty:
//
//   1. recoveryPlans non-empty — optimizer already produced plans
//   2. activeEvents non-empty — engine has at least one event in flight
//   3. any flight has cascade_order >= 0 — cascade predictor already
//      annotated the schedule
//
// Any one of these means "we have a disruption to display".
// ────────────────────────────────────────────────────────────────────

export function useHasActiveDisruption(): boolean {
  return useSimulationStore((s) => {
    if (s.recoveryPlans.length > 0) return true
    if (s.activeEvents.length > 0)  return true
    for (const fid in s.flightStates) {
      if ((s.flightStates[fid]?.cascade_order ?? -1) >= 0) return true
    }
    return false
  })
}

/** Number of plans currently available. Use sparingly — most pages should
 *  use `useHasActiveDisruption()` so they don't flash empty mid-snapshot. */
export function usePlanCount(): number {
  return useSimulationStore((s) => s.recoveryPlans.length)
}
