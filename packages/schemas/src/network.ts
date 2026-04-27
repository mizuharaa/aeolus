// ── Network entities ──────────────────────────────────────────────────────────

export type AircraftType = "B737-800" | "A320" | "E175" | "B757-200"

export interface Airport {
  icao: string
  name: string
  city: string
  lat: number
  lon: number
  hourly_capacity: number
  elevation_ft: number
}

export interface Aircraft {
  tail_number: string
  aircraft_type: AircraftType
  seat_capacity: number
  base_airport: string
  min_turn_minutes: number
  current_airport?: string
}

export interface ScheduledFlight {
  id: string
  flight_number: string
  origin: string
  destination: string
  scheduled_departure: string   // ISO-8601
  scheduled_arrival: string     // ISO-8601
  tail_number: string
  aircraft_type: AircraftType
  passengers: number
  status?: FlightStatus
}

export type FlightStatus =
  | "scheduled"
  | "delayed"
  | "cancelled"
  | "diverted"
  | "airborne"
  | "landed"

export interface CrewPairing {
  id: string
  captain_id: string
  first_officer_id: string
  base: string
  flights: string[]            // ordered flight IDs
  report_time: string          // ISO-8601
  release_time: string         // ISO-8601
  duty_minutes: number
  flight_time_minutes: number
}
