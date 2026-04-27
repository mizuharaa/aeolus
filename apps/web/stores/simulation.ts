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
  reset: () => void
  setLoading: (loading: boolean) => void
  applyPlan: (planId: string | null) => void
  setLiveFlights: (flights: LiveFlight[], ts?: number) => void
  setShowLiveFlights: (show: boolean) => void
  setShowSimulation: (show: boolean) => void
  setSelectedLiveFlight: (flight: LiveFlight | null) => void
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  flightStates: {},
  activeEvents: [],
  recoveryPlans: [],
  cascadeSummary: null,
  schedule: [],
  isLoading: false,
  lastEventAt: null,
  appliedPlanId: null,

  liveFlights: [],
  liveFlightsTs: null,
  showLiveFlights: true,
  showSimulation: false,
  selectedLiveFlight: null,

  setUpdate: (update) =>
    set((state) => ({
      flightStates: update.flight_states
        ? update.flight_states
        : state.flightStates,
      activeEvents:
        update.active_events !== undefined
          ? update.active_events
          : update.event
          ? [...state.activeEvents, update.event]
          : state.activeEvents,
      recoveryPlans: update.recovery_plans ?? state.recoveryPlans,
      cascadeSummary: update.cascade_summary ?? state.cascadeSummary,
      schedule:
        update.schedule || update.flights
          ? update.schedule || update.flights
          : state.schedule,
      lastEventAt: update.event ? Date.now() : state.lastEventAt,
      appliedPlanId: null,
    })),

  setSchedule: (schedule) => set({ schedule }),

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

  applyPlan: (planId) => set({ appliedPlanId: planId }),

  setLiveFlights: (flights, ts) =>
    set({ liveFlights: flights, liveFlightsTs: ts ?? Date.now() }),

  setShowLiveFlights: (show) => set({ showLiveFlights: show }),

  setShowSimulation: (show) => set({ showSimulation: show }),

  setSelectedLiveFlight: (flight) =>
    set({ selectedLiveFlight: flight }),
}))
