// ── Disruption events ─────────────────────────────────────────────────────────

export type EventKind =
  | "weather_closure"
  | "ground_stop"
  | "airspace_closure"
  | "security_event"
  | "mechanical_aog"
  | "crew_sickout"
  | "runway_closure"
  | "atc_staffing"
  | "volcanic_ash"
  | "cyber_incident"

export type Severity = "mild" | "moderate" | "severe" | "extreme"

export interface EventParams {
  airport?: string
  base?: string
  aircraft_tail?: string
  sector_or_airport?: string
  airline?: string
  severity?: Severity
  duration_hours?: number
  runway_id?: string
  capacity_cut_pct?: number
  capacity_pct?: number
  percent_affected?: number
  degradation_pct?: number
  polygon?: GeoJSONPolygon
}

export interface GeoJSONPolygon {
  type: "Polygon"
  coordinates: number[][][]
}

export interface ActiveEvent {
  id: string
  kind: EventKind
  params: EventParams
  triggered_at: string         // ISO-8601
  expires_at?: string          // ISO-8601
}

export interface EventTypeDefinition {
  kind: EventKind
  label: string
  description: string
  default_params: EventParams
}

export interface TriggerEventRequest {
  kind: EventKind
  params?: Partial<EventParams>
}
