/**
 * Playtest store — Zustand slice for the free-flight sandbox.
 *
 * Separate from the canonical `useSimulationStore` because the playtest
 * surface should never pollute the dashboard's live state. The user can
 * have a triggered disruption running on Nimbus Air in one tab while
 * building a totally synthetic schedule in another tab here.
 *
 * No server-side persistence — the user's playtest flights live entirely
 * in memory and vanish on refresh. That's the deal with sandboxes.
 */
import { create } from "zustand"

export interface PlaytestFlight {
  id:                  string
  aircraft_id:         string
  origin:              string                      // ICAO ("KORD")
  destination:         string
  scheduled_departure: string                      // ISO-8601
  scheduled_arrival:   string                      // ISO-8601
  passengers:          number
  status:              "scheduled" | "delayed" | "cancelled"
  delay_minutes:       number
}

export interface PlaytestFlightState {
  flight_id:     string
  status:        "scheduled" | "delayed" | "cancelled" | "diverted" | "airborne"
  delay_minutes: number
  cascade_order: number                            // -1 unaffected, 0 direct, 1+ cascade
  p_delayed:     number
  tail?:         string
  origin?:       string
  destination?:  string
}

export interface PlaytestCascadeSummary {
  directly_affected:   number
  cascade_1:           number
  cascade_2:           number
  total_affected:      number
  total_delay_minutes: number
}

export interface PlaytestEvent {
  kind:   string
  params: Record<string, any>
}

export interface PlaytestCostBreakdown {
  grand_total_usd:         number
  cancellation_total_usd:  number
  delay_total_usd:         number
  total_pax_delay_minutes: number
  cancelled_count:         number
  delayed_count:           number
}

export interface PlaytestCarbon {
  total_co2_kg:    number
  total_co2_tonnes: number
  eu_ets_cost_usd: number
  burned_co2_kg:   number
  saved_co2_kg:    number
}

interface PlaytestStore {
  flights:        PlaytestFlight[]
  flightStates:   Record<string, PlaytestFlightState>
  cascadeSummary: PlaytestCascadeSummary | null
  cost:           PlaytestCostBreakdown | null
  carbon:         PlaytestCarbon | null
  event:          PlaytestEvent | null
  isSolving:      boolean
  lastError:      string | null

  addFlight:    (f: Omit<PlaytestFlight, "status" | "delay_minutes">) => void
  removeFlight: (id: string) => void
  clearFlights: () => void
  /** Atomic update after a /playtest/cascade request lands. */
  applyResult:  (data: {
    flight_states:   Record<string, PlaytestFlightState>
    cascade_summary: PlaytestCascadeSummary
    cost?:           PlaytestCostBreakdown
    carbon?:         PlaytestCarbon
    event?:          PlaytestEvent | null
  }) => void
  setEvent:     (e: PlaytestEvent | null) => void
  setSolving:   (busy: boolean) => void
  setError:     (msg: string | null) => void
  resetResult:  () => void
}

export const usePlaytestStore = create<PlaytestStore>((set) => ({
  flights:        [],
  flightStates:   {},
  cascadeSummary: null,
  cost:           null,
  carbon:         null,
  event:          null,
  isSolving:      false,
  lastError:      null,

  addFlight: (f) =>
    set((state) => ({
      flights: [
        ...state.flights,
        { ...f, status: "scheduled" as const, delay_minutes: 0 },
      ],
    })),

  removeFlight: (id) =>
    set((state) => ({
      flights:      state.flights.filter((x) => x.id !== id),
      // Drop the result if the user removes a flight — otherwise the
      // cascade summary refers to a flight that no longer exists.
      flightStates: {},
      cascadeSummary: null,
      cost: null,
      carbon: null,
    })),

  clearFlights: () =>
    set({
      flights:        [],
      flightStates:   {},
      cascadeSummary: null,
      cost:           null,
      carbon:         null,
      event:          null,
    }),

  applyResult: (data) =>
    set({
      flightStates:   data.flight_states,
      cascadeSummary: data.cascade_summary,
      cost:           data.cost ?? null,
      carbon:         data.carbon ?? null,
      event:          data.event ?? null,
      isSolving:      false,
      lastError:      null,
    }),

  setEvent:    (event) => set({ event }),
  setSolving:  (isSolving) => set({ isSolving }),
  setError:    (lastError) => set({ lastError, isSolving: false }),
  resetResult: () =>
    set({
      flightStates:   {},
      cascadeSummary: null,
      cost:           null,
      carbon:         null,
      event:          null,
    }),
}))
