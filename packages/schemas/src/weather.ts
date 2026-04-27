// ── Weather / METAR schemas ───────────────────────────────────────────────────

export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR"

export interface MetarObservation {
  icao: string
  raw_text?: string
  observation_time?: string          // ISO-8601
  temp_c?: number
  dewpoint_c?: number
  wind_dir_deg?: number
  wind_speed_kt?: number
  wind_gust_kt?: number
  visibility_sm?: number
  ceiling_ft?: number
  altimeter_in?: number
  flight_category?: FlightCategory
  wx_string?: string                 // e.g. "-RA BR"
}

export interface MetarResponse {
  data: MetarObservation[]
  cached_at: string                  // ISO-8601
}
