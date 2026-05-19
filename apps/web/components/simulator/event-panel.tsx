"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Cloud, OctagonAlert, Ban, ShieldAlert, Wrench,
  HeartPulse, AlertTriangle, Radio, Mountain, ServerCrash,
  Zap, Activity, Loader2, RefreshCw, CloudLightning, Wind,
  TriangleAlert, Globe, MapPin, Gauge,
  CloudSnow, Tornado, Droplets, Bird, Snowflake, Flame, Users, ChevronDown, Eye,
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { useSimulationStore } from "@/stores/simulation"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { airportLabel } from "@/lib/labels"
import { AirportCode } from "./airport-code"
import { c, ff, r } from "@/lib/design-tokens"
import { ButtonPrimary, Eyebrow } from "@/components/ds/primitives"

// Airports + ARTCC facilities are surfaced as ICAO-only codes that mean nothing
// to a non-airline-ops viewer. These helpers turn raw codes into "KORD — Chicago
// O'Hare" inside <option> labels (where we can't render JSX) and to expose a
// canonical name for ARTCC centers in the same dropdowns.

function airportOptionLabel(icao: string): string {
  const ap = airportLabel(icao)
  if (!ap.name && !ap.city) return icao
  const tail = [ap.city, ap.name].filter(Boolean).join(" ")
  return `${icao} — ${tail}`
}

const ARTCC_NAMES: Record<string, string> = {
  ZAU: "Chicago Center",
  ZTL: "Atlanta Center",
  ZFW: "Fort Worth Center",
  ZLA: "Los Angeles Center",
  ZDV: "Denver Center",
  ZNY: "New York Center",
  ZSE: "Seattle Center",
  ZMA: "Miami Center",
  ZAB: "Albuquerque Center",
  ZMP: "Minneapolis Center",
}

function isAirportField(key: string) {
  return key === "airport" || key === "destination_airport" || key === "base"
}

function selectOptionLabel(fieldKey: string, raw: string): string {
  if (isAirportField(fieldKey)) return airportOptionLabel(raw)
  if (fieldKey === "facility_id") {
    const name = ARTCC_NAMES[raw]
    return name ? `${raw} — ${name}` : raw
  }
  return raw
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AIRPORTS = ["KORD","KATL","KDFW","KLAX","KDEN","KJFK","KSEA","KMIA","KPHX","KLAS","KBOS","KSFO","KIAH","KDTW","KMSP"]
const AIRCRAFT  = Array.from({ length: 40 }, (_, i) => `N${String(i + 1).padStart(3, "0")}NB`)

const EVENT_TYPES = [
  // Weather
  { value: "weather_closure",   label: "Weather Closure",     Icon: Cloud,          color: "sky"     },
  { value: "thunderstorm",      label: "Thunderstorm Cell",   Icon: CloudLightning, color: "blue"    },
  { value: "blizzard",          label: "Winter Storm",        Icon: CloudSnow,      color: "slate"   },
  { value: "sandstorm",         label: "Sandstorm / Haboob",  Icon: Wind,           color: "amber"   },
  { value: "dense_fog",         label: "Dense Fog",           Icon: Eye,            color: "stone"   },
  { value: "wind_shear",        label: "Wind Shear",          Icon: Gauge,          color: "cyan"    },
  { value: "hurricane",         label: "Hurricane / Cyclone", Icon: Tornado,        color: "purple"  },
  { value: "volcanic_ash",      label: "Volcanic Ash",        Icon: Mountain,       color: "stone"   },
  // ATC & Airspace
  { value: "ground_stop",       label: "Ground Stop",         Icon: OctagonAlert,   color: "orange"  },
  { value: "airspace_closure",  label: "Airspace Closure",    Icon: Ban,            color: "red"     },
  { value: "atc_staffing",      label: "ATC Shortage",        Icon: Radio,          color: "indigo"  },
  // Aircraft & Operations
  { value: "mechanical_aog",    label: "Mechanical AOG",      Icon: Wrench,         color: "amber"   },
  { value: "bird_strike",       label: "Bird Strike / FOD",   Icon: Bird,           color: "lime"    },
  { value: "deicing_shortage",  label: "Deicing Shortage",    Icon: Snowflake,      color: "blue"    },
  { value: "runway_closure",    label: "Runway Closure",      Icon: AlertTriangle,  color: "yellow"  },
  { value: "fuel_contamination",label: "Fuel Contamination",  Icon: Droplets,       color: "orange"  },
  // Crew & Personnel
  { value: "crew_sickout",      label: "Crew Sick-out",       Icon: HeartPulse,     color: "pink"    },
  { value: "labor_action",      label: "Labor Slowdown",      Icon: Users,          color: "emerald" },
  // Security & Emergency
  { value: "security_event",    label: "Security Event",      Icon: ShieldAlert,    color: "rose"    },
  { value: "airport_emergency", label: "Airport Emergency",   Icon: Flame,          color: "red"     },
  { value: "cyber_incident",    label: "Cyber Incident",      Icon: ServerCrash,    color: "violet"  },
] as const

type EventKind = typeof EVENT_TYPES[number]["value"]

const EVENT_CATEGORIES: { label: string; events: EventKind[] }[] = [
  { label: "Weather", events: ["weather_closure","thunderstorm","blizzard","sandstorm","dense_fog","wind_shear","hurricane","volcanic_ash"] },
  { label: "Air Traffic Control", events: ["ground_stop","airspace_closure","atc_staffing"] },
  { label: "Aircraft & Operations", events: ["mechanical_aog","bird_strike","deicing_shortage","runway_closure","fuel_contamination"] },
  { label: "Crew & Personnel", events: ["crew_sickout","labor_action"] },
  { label: "Security & Emergency", events: ["security_event","airport_emergency","cyber_incident"] },
]

const EVENT_DESCRIPTIONS: Record<EventKind, string> = {
  weather_closure:
    "A weather system forces closure or severe capacity reductions at the affected airport. Ground operations halt as conditions drop below VFR minimums, causing widespread delays and diversions across the entire hub bank structure.",
  thunderstorm:
    "A convective cell or squall line produces embedded cumulonimbus clouds with lightning, hail, and severe turbulence. Aircraft must deviate up to 40 nm around active cells, significantly dropping arrival rates and congesting vectoring airspace.",
  blizzard:
    "Heavy snowfall exceeding 1 in/hr combined with winds over 35 kt creates whiteout conditions and rapid runway accumulation. Deicing queues build, CAT III approaches may be suspended, and ramp operations slow significantly — snow removal cannot keep pace above 2 in/hr.",
  sandstorm:
    "A haboob or blowing-dust event reduces visibility below 1/4 mile and coats engine inlet screens with abrasive particles. Engines require borescope inspection before return to service after even a brief dust ingestion event.",
  dense_fog:
    "IFR or LIFR conditions reduce visibility and ceiling below CAT I minimums (RVR 1800 / 200 ft). Only CAT II/III-certified aircraft and crews can continue approaches, dropping a major hub's arrival rate from ~100 to ~30 operations per hour.",
  wind_shear:
    "Low-Level Wind Shear (LLWS) detected via PIREP or LLWAS forces increased spacing and frequent missed approaches on the affected runway. Particularly severe during thunderstorm outflows and cold-front passages — some crews go missed multiple times before landing.",
  hurricane:
    "Pre-emptive mass cancellations begin 48-72 hours before landfall as airlines ferry aircraft out of the storm track to safe bases. Post-storm, airport structural assessment and crew return positioning can take 24-96 hours before operations fully resume.",
  volcanic_ash:
    "An ash cloud SIGMET makes transiting the affected radius hazardous — volcanic glass particles cause engine flame-out and windshield abrasion. All routes within the plume radius must reroute or cancel; the closure can persist for days depending on wind direction.",
  ground_stop:
    "The FAA issues a Ground Stop (GS) halting all departures destined for the affected airport. Aircraft already airborne continue; all on-ground departures are held at origin. A Ground Delay Program (GDP) typically follows if the stop persists beyond 1-2 hours.",
  airspace_closure:
    "A NOTAM-based Temporary Flight Restriction (TFR) closes a block of en-route airspace, forcing all transiting traffic onto longer reroutes. Depending on the closed ARTCC sector, rerouting can add 45-120 minutes to block times and overload adjacent sectors.",
  atc_staffing:
    "Understaffing at an ARTCC (Air Route Traffic Control Center) reduces the number of active sectors, widening spacing requirements and lowering throughput. Arrival and departure rates can drop 30-50%, creating system-wide delay propagation across the NAS.",
  mechanical_aog:
    "An Aircraft-on-Ground (AOG) event grounds a tail number until maintenance certifies it airworthy. Every subsequent rotation on that aircraft is delayed or cancelled, often requiring spare aircraft swaps or short-notice wet-lease to cover the broken rotation chain.",
  bird_strike:
    "A bird ingestion event into one or both engines requires an immediate landing and engineering inspection. High-mass strikes from geese or pelicans may require engine removal, grounding the aircraft for 4-48 hours and breaking its full day's rotation.",
  deicing_shortage:
    "A surge of departures during freezing precipitation overwhelms deicing pad capacity, creating 45-90 minute queues per aircraft. Holdover times are short and aircraft may require re-treatment before departure, decoupling gate push from wheels-up by 60-120 minutes.",
  runway_closure:
    "FOD removal, pavement failure, or emergency vehicle response closes one or more runways. Losing one runway at a dual-runway airport cuts arrival/departure capacity by approximately 45%, typically triggering a Ground Delay Program within 30 minutes.",
  fuel_contamination:
    "A quality-control failure, water infiltration, or misfueling event triggers a hold on all fuel from the affected supply source. Departures halt until independent testing clears the fuel; airborne aircraft must divert to alternate airports with unaffected fuel supplies.",
  crew_sickout:
    "Coordinated or uncoordinated crew absences remove a percentage of qualified pilots or cabin crew from duty. Flights without a legal crew cannot depart regardless of aircraft readiness; crew scheduling must source reserves across all crew bases simultaneously.",
  labor_action:
    "A work slowdown — sometimes called a 'blue flu' — reduces effective staffing without a formal strike. Turnaround times increase 20-60% as crews work strictly to contract minimums; airlines cannot legally compel faster operations during an organized job action.",
  security_event:
    "A bomb threat, unattended bag incident, or unruly passenger requiring military escort triggers terminal evacuation and full re-screening. TSA re-screening of all passengers creates 2-6 hour gate hold queues; international arrivals may be held at remote stands indefinitely.",
  airport_emergency:
    "A full emergency declaration for terminal fire, structural failure, or a mass-casualty event closes the airfield for emergency vehicle access. Inbound flights are held at altitude or diverted; full recovery and re-certification typically takes 1-12 hours depending on incident severity.",
  cyber_incident:
    "A CrowdStrike/SITA-style IT failure simultaneously degrades check-in, weight & balance, dispatch, and crew scheduling systems. Manual fallback procedures add 30-90 minutes to every gate turn; a complete outage (100% degradation) effectively halts departure processing network-wide.",
}

const FORM_SCHEMA: Record<EventKind, {
  fields: { key: string; label: string; type: "select" | "number"; options?: string[]; min?: number; max?: number; step?: number }[]
  defaults: Record<string, string>
}> = {
  weather_closure: {
    fields: [
      { key: "airport",        label: "Airport",        type: "select", options: AIRPORTS },
      { key: "severity",       label: "Severity",       type: "select", options: ["mild","moderate","severe","extreme"] },
      { key: "duration_hours", label: "Duration (hrs)", type: "number", min: 0.5, max: 24, step: 0.5 },
    ],
    defaults: { airport: "KORD", severity: "severe", duration_hours: "4" },
  },
  thunderstorm: {
    fields: [
      { key: "airport",        label: "Airport",        type: "select", options: AIRPORTS },
      { key: "severity",       label: "Severity",       type: "select", options: ["moderate","severe","extreme"] },
      { key: "duration_hours", label: "Duration (hrs)", type: "number", min: 0.5, max: 12, step: 0.5 },
    ],
    defaults: { airport: "KORD", severity: "severe", duration_hours: "3" },
  },
  blizzard: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "snowfall_rate",  label: "Snowfall (in/hr)",  type: "number", min: 0.5, max: 6, step: 0.5 },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1,   max: 24, step: 1 },
    ],
    defaults: { airport: "KORD", snowfall_rate: "2", duration_hours: "6" },
  },
  sandstorm: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "visibility_sm",  label: "Visibility (SM)",   type: "number", min: 0.1, max: 2, step: 0.1 },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1,   max: 12, step: 1 },
    ],
    defaults: { airport: "KPHX", visibility_sm: "0.25", duration_hours: "4" },
  },
  dense_fog: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "visibility_sm",  label: "Visibility (SM)",   type: "number", min: 0.1, max: 1, step: 0.1 },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1,   max: 12, step: 1 },
    ],
    defaults: { airport: "KSFO", visibility_sm: "0.25", duration_hours: "4" },
  },
  wind_shear: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "wind_speed_kt",  label: "Wind speed (kt)",   type: "number", min: 20,  max: 80, step: 5 },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 0.5, max: 6,  step: 0.5 },
    ],
    defaults: { airport: "KDFW", wind_speed_kt: "35", duration_hours: "2" },
  },
  hurricane: {
    fields: [
      { key: "airport",        label: "Affected airport",  type: "select", options: AIRPORTS },
      { key: "category",       label: "Category",          type: "select", options: ["1","2","3","4","5"] },
      { key: "duration_hours", label: "Disruption (hrs)",  type: "number", min: 12, max: 96, step: 6 },
    ],
    defaults: { airport: "KMIA", category: "3", duration_hours: "48" },
  },
  volcanic_ash: {
    fields: [
      { key: "ash_cloud_radius_nm", label: "Plume radius (nm)", type: "number", min: 50,  max: 500, step: 25 },
      { key: "duration_hours",      label: "Duration (hrs)",    type: "number", min: 6,   max: 72,  step: 1  },
    ],
    defaults: { ash_cloud_radius_nm: "200", duration_hours: "18" },
  },
  ground_stop: {
    fields: [
      { key: "destination_airport", label: "Destination airport", type: "select", options: AIRPORTS },
      { key: "duration_hours",      label: "Duration (hrs)",      type: "number", min: 0.5, max: 12, step: 0.5 },
    ],
    defaults: { destination_airport: "KATL", duration_hours: "2" },
  },
  airspace_closure: {
    fields: [
      { key: "airport",        label: "Anchor airport",    type: "select", options: AIRPORTS },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1, max: 48, step: 1 },
    ],
    defaults: { airport: "KDEN", duration_hours: "6" },
  },
  atc_staffing: {
    fields: [
      { key: "facility_id",    label: "ARTCC facility",    type: "select", options: ["ZAU","ZTL","ZFW","ZLA","ZDV","ZNY","ZSE","ZMA","ZAB","ZMP"] },
      { key: "staffing_pct",   label: "Staffing %",        type: "number", min: 30, max: 95, step: 5 },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1,  max: 12, step: 1 },
    ],
    defaults: { facility_id: "ZAU", staffing_pct: "60", duration_hours: "6" },
  },
  mechanical_aog: {
    fields: [
      { key: "aircraft_tail",  label: "Aircraft tail",     type: "select", options: AIRCRAFT },
      { key: "airport",        label: "Current airport",   type: "select", options: AIRPORTS },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1, max: 48, step: 1 },
    ],
    defaults: { aircraft_tail: "N001NB", airport: "KATL", duration_hours: "8" },
  },
  bird_strike: {
    fields: [
      { key: "aircraft_tail",  label: "Aircraft tail",     type: "select", options: AIRCRAFT },
      { key: "airport",        label: "Incident airport",  type: "select", options: AIRPORTS },
      { key: "duration_hours", label: "Inspection (hrs)",  type: "number", min: 2, max: 48, step: 1 },
    ],
    defaults: { aircraft_tail: "N005NB", airport: "KJFK", duration_hours: "8" },
  },
  deicing_shortage: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "queue_length",   label: "Queue (aircraft)",  type: "number", min: 5,  max: 40, step: 1 },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1,  max: 8,  step: 0.5 },
    ],
    defaults: { airport: "KORD", queue_length: "20", duration_hours: "3" },
  },
  runway_closure: {
    fields: [
      { key: "airport",          label: "Airport",           type: "select", options: AIRPORTS },
      { key: "capacity_cut_pct", label: "Capacity cut (%)",  type: "number", min: 10, max: 100, step: 5 },
      { key: "duration_hours",   label: "Duration (hrs)",    type: "number", min: 0.5, max: 24, step: 0.5 },
    ],
    defaults: { airport: "KDFW", capacity_cut_pct: "45", duration_hours: "6" },
  },
  fuel_contamination: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "severity",       label: "Severity",          type: "select", options: ["partial","critical"] },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 1, max: 24, step: 1 },
    ],
    defaults: { airport: "KATL", severity: "critical", duration_hours: "6" },
  },
  crew_sickout: {
    fields: [
      { key: "base",             label: "Crew base",         type: "select", options: AIRPORTS },
      { key: "percent_affected", label: "% affected",        type: "number", min: 5,  max: 100, step: 5 },
      { key: "duration_hours",   label: "Duration (hrs)",    type: "number", min: 1,  max: 48,  step: 1 },
    ],
    defaults: { base: "KORD", percent_affected: "30", duration_hours: "8" },
  },
  labor_action: {
    fields: [
      { key: "base",           label: "Crew base",           type: "select", options: AIRPORTS },
      { key: "slowdown_pct",   label: "Slowdown %",          type: "number", min: 10, max: 80, step: 5 },
      { key: "duration_hours", label: "Duration (hrs)",      type: "number", min: 2,  max: 48, step: 1 },
    ],
    defaults: { base: "KORD", slowdown_pct: "30", duration_hours: "12" },
  },
  security_event: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "severity",       label: "Severity",          type: "select", options: ["moderate","severe","extreme"] },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 0.5, max: 12, step: 0.5 },
    ],
    defaults: { airport: "KJFK", severity: "severe", duration_hours: "3" },
  },
  airport_emergency: {
    fields: [
      { key: "airport",        label: "Airport",           type: "select", options: AIRPORTS },
      { key: "severity",       label: "Severity",          type: "select", options: ["moderate","severe","extreme"] },
      { key: "duration_hours", label: "Duration (hrs)",    type: "number", min: 0.5, max: 12, step: 0.5 },
    ],
    defaults: { airport: "KLAX", severity: "severe", duration_hours: "2" },
  },
  cyber_incident: {
    fields: [
      { key: "degradation_pct", label: "Degradation %",   type: "number", min: 20, max: 100, step: 5 },
      { key: "duration_hours",  label: "Duration (hrs)",  type: "number", min: 1,  max: 24,  step: 1 },
    ],
    defaults: { degradation_pct: "60", duration_hours: "12" },
  },
}

// ─── Semantic tone palette ───────────────────────────────────────────────────
// Replaces the 16-hue rainbow with 5 brand-voltage tones, one per event
// category. Same color = same meaning everywhere on the dashboard.
//
//  weather  → mint     (atmospheric / cool)
//  atc      → coral    (stop / urgent)
//  ops      → mustard  (mechanical / warning)
//  crew     → peach    (personnel)
//  security → forest-on-cream (gravity but not panic)
//
// Selected tile inverts to dark ink on canvas (Airtable editorial pattern).

type Tone = {
  bg: string         // soft surface for the un-selected tile
  ink: string        // text color
  border: string     // hairline border tint
  ringHex: string    // selection ring
  iconBg: string     // small icon chip background
  selectedBg: string // surface for selected/active tile
  selectedInk: string
}

const EVENT_TONES = {
  weather: {
    bg: "#F1F7F4",                  // mint tint
    ink: c.statusOnTime.ink,        // forest
    border: c.signatureMint,
    ringHex: c.statusOnTime.dot,
    iconBg: c.signatureMint,
    selectedBg: c.statusOnTime.bg,
    selectedInk: c.statusOnTime.ink,
  },
  atc: {
    bg: c.statusCancelled.bg,
    ink: c.statusCancelled.ink,
    border: c.statusCancelled.dot,
    ringHex: c.statusCancelled.dot,
    iconBg: "#F0CDC0",              // coral chip
    selectedBg: c.statusCancelled.bg,
    selectedInk: c.statusCancelled.ink,
  },
  ops: {
    bg: c.statusDelayed.bg,         // peach
    ink: "#5C3D0F",                 // mustard ink
    border: c.signatureMustard,
    ringHex: c.signatureMustard,
    iconBg: "#F5D58A",
    selectedBg: c.statusDelayed.bg,
    selectedInk: "#5C3D0F",
  },
  crew: {
    bg: "#FCEAD9",                  // peach soft
    ink: c.statusDelayed.ink,
    border: c.signaturePeach,
    ringHex: c.signaturePeach,
    iconBg: "#F8D2B4",
    selectedBg: "#FCEAD9",
    selectedInk: c.statusDelayed.ink,
  },
  security: {
    bg: c.signatureCream,
    ink: c.statusOnTime.ink,        // forest
    border: c.statusOnTime.dot,
    ringHex: c.statusOnTime.dot,
    iconBg: "#E5D9C0",
    selectedBg: c.signatureCream,
    selectedInk: c.statusOnTime.ink,
  },
} as const satisfies Record<string, Tone>

type ToneKey = keyof typeof EVENT_TONES

const EVENT_TONE_BY_KIND: Record<EventKind, ToneKey> = {
  weather_closure: "weather", thunderstorm: "weather", blizzard: "weather",
  sandstorm: "weather", dense_fog: "weather", wind_shear: "weather",
  hurricane: "weather", volcanic_ash: "weather",
  ground_stop: "atc", airspace_closure: "atc", atc_staffing: "atc",
  mechanical_aog: "ops", bird_strike: "ops", deicing_shortage: "ops",
  runway_closure: "ops", fuel_contamination: "ops",
  crew_sickout: "crew", labor_action: "crew",
  security_event: "security", airport_emergency: "security", cyber_incident: "security",
}

function toneFor(kind: EventKind): Tone {
  return EVENT_TONES[EVENT_TONE_BY_KIND[kind]]
}

// ─── Live data types ──────────────────────────────────────────────────────────

interface FAAProgram {
  type: "ground_stop" | "ground_delay_program" | "departure_delay"
  airport_iata: string
  airport_icao: string
  reason: string
  avg_delay_minutes?: number
  avg_delay_raw?: string
  start?: string
  recheck?: string
  end?: string
  in_nimbus_network: boolean
  sim_event: { kind: string; params: Record<string, any> }
}

interface NWSAlert {
  id: string
  event: string
  headline: string
  severity: string
  area: string
  effective: string
  expires: string
  sender: string
  affected_nimbus_airports: string[]
  sim_event: { kind: string; params: Record<string, any> } | null
}

type LiveUsFaaSummary = {
  concurrent_total: number
  concurrent_ground_stops: number
  concurrent_gdps: number
  concurrent_departure_delay_programs: number
  unique_us_airports: number
  nimbus_network_overlap: number
} | null

type LiveUsNwsSummary = {
  nationwide_alerts_matched: number
  returned: number
  severe_or_extreme: number
  nimbus_touched: number
} | null

type FaaLivePayload = {
  programs: FAAProgram[]
  nimbus_affected?: number
  us_summary?: LiveUsFaaSummary
  source?: string
  error?: string
}
type NwsLivePayload = {
  alerts: NWSAlert[]
  nimbus_affected?: number
  us_summary?: LiveUsNwsSummary
  source?: string
  error?: string
}

const FAA_TYPE_ORDER: Record<string, number> = {
  ground_stop: 0,
  ground_delay_program: 1,
  departure_delay: 2,
}

// ─── Alert row ───────────────────────────────────────────────────────────────

function renderAlertRow(
  alert: NWSAlert,
  isNimbus: boolean,
  isLoadingEvent: boolean,
  onLoadToSim: (kind: string, params: Record<string, any>) => Promise<void>
) {
  const sevColor =
    alert.severity === "Extreme" ? "text-red-700"
    : alert.severity === "Severe" ? "text-orange-700"
    : "text-amber-700"
  const sevBg =
    alert.severity === "Extreme" ? "bg-red-100 text-red-700 border-red-200"
    : alert.severity === "Severe" ? "bg-orange-100 text-orange-700 border-orange-200"
    : "bg-amber-50 text-amber-700 border-amber-200"
  return (
    <div
      key={alert.id}
      className={`rounded-xl border p-3 ${
        isNimbus ? "border-sky-200 bg-sky-50/80" : "border-border bg-secondary/30"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {alert.event.toLowerCase().includes("thunder") || alert.event.toLowerCase().includes("tornado")
              ? <CloudLightning className={`w-3.5 h-3.5 shrink-0 ${sevColor}`} />
              : alert.event.toLowerCase().includes("wind")
              ? <Wind className={`w-3.5 h-3.5 shrink-0 ${sevColor}`} />
              : <TriangleAlert className={`w-3.5 h-3.5 shrink-0 ${sevColor}`} />
            }
            <span className={`text-xs font-semibold ${sevColor}`}>{alert.event}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${sevBg}`}>
              {alert.severity}
            </span>
          </div>
          {isNimbus && (
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              <span className="text-[9px] text-sky-600 font-semibold">Nimbus:</span>
              {alert.affected_nimbus_airports.map((ap) => (
                <span key={ap} className="text-[9px] font-mono px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded-md border border-sky-200">
                  {ap.replace(/^K/, "")}
                </span>
              ))}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground line-clamp-2">{alert.area}</div>
        </div>
        {isNimbus && alert.sim_event && (
          <button
            disabled={isLoadingEvent}
            onClick={() => onLoadToSim(alert.sim_event!.kind, alert.sim_event!.params)}
            className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ background: c.ink, color: c.onPrimary }}
          >
            <Zap className="w-3 h-3" /> Sim
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Live Feed ────────────────────────────────────────────────────────────────

type DisruptionItem = {
  id: string
  typeLabel: string
  typeSeverity: "critical" | "high" | "moderate"
  title: string
  detail: string
  airports: string[]
  isNimbus: boolean
  score: number
  simEvent?: { kind: string; params: Record<string, any> }
}

function SectionToggle({ label, badge, children, defaultOpen = true }: {
  label: string
  badge?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full mb-2 group"
      >
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-1 text-left">{label}</span>
        {badge}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function LiveFeed({
  onLoadToSim,
  isLoadingEvent,
}: {
  onLoadToSim: (kind: string, params: Record<string, any>) => Promise<void>
  isLoadingEvent: boolean
}) {
  const [faaData, setFaaData]       = useState<FaaLivePayload | null>(null)
  const [alertsData, setAlertsData] = useState<NwsLivePayload | null>(null)
  const [fetching, setFetching]     = useState(false)
  const [lastFetch, setLastFetch]   = useState<Date | null>(null)
  const [nimbusOnly, setNimbusOnly] = useState(false)

  const fetchAll = useCallback(async () => {
    setFetching(true)
    try {
      const snap = await apiClient.get<{
        refreshed_at: string
        faa: FaaLivePayload
        nws: NwsLivePayload
      }>("/live/national-snapshot")
      setFaaData(snap.data.faa)
      setAlertsData(snap.data.nws)
      setLastFetch(new Date(snap.data.refreshed_at))
    } catch {
      const [faaRes, alertsRes] = await Promise.allSettled([
        apiClient.get<FaaLivePayload>("/live/faa-status"),
        apiClient.get<NwsLivePayload>("/live/weather-alerts"),
      ])
      if (faaRes.status === "fulfilled") setFaaData(faaRes.value.data)
      if (alertsRes.status === "fulfilled") setAlertsData(alertsRes.value.data)
      setLastFetch(new Date())
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchAll])

  const programs = useMemo(() =>
    [...(faaData?.programs ?? [])].sort(
      (a, b) => (FAA_TYPE_ORDER[a.type] ?? 9) - (FAA_TYPE_ORDER[b.type] ?? 9)
    ), [faaData])

  const allAlerts    = alertsData?.alerts ?? []
  const nimbusAlerts = allAlerts.filter((a) => a.affected_nimbus_airports.length > 0)
  const wxFiltered   = nimbusOnly ? nimbusAlerts : allAlerts
  const highImpactWx = wxFiltered.filter((a) => a.severity === "Severe" || a.severity === "Extreme")
  const otherWx      = wxFiltered.filter((a) => a.severity !== "Severe" && a.severity !== "Extreme")

  const groundStops  = programs.filter((p) => p.type === "ground_stop")
  const gdps         = programs.filter((p) => p.type === "ground_delay_program")
  const depDelays    = programs.filter((p) => p.type === "departure_delay")

  const faaSum = faaData?.us_summary
  const nwsSum = alertsData?.us_summary
  const minutesAgo = lastFetch ? Math.floor((Date.now() - lastFetch.getTime()) / 60_000) : null

  // ── Synthesize "Top Disruptions" from both FAA + NWS ──
  const topDisruptions = useMemo<DisruptionItem[]>(() => {
    const items: DisruptionItem[] = []
    for (const prog of programs) {
      const base = prog.type === "ground_stop" ? 100 : prog.type === "ground_delay_program" ? 70 : 40
      items.push({
        id: `faa-${prog.airport_iata}-${prog.type}`,
        typeLabel: prog.type === "ground_stop" ? "Ground Stop" : prog.type === "ground_delay_program" ? "GDP" : "Dep Delay",
        typeSeverity: prog.type === "ground_stop" ? "critical" : prog.type === "ground_delay_program" ? "high" : "moderate",
        title: `${prog.airport_iata} — ${prog.type === "ground_stop" ? "Ground Stop" : prog.type === "ground_delay_program" ? "Ground Delay Program" : "Departure Delay Program"}`,
        detail: [prog.reason, prog.avg_delay_minutes ? `avg ${prog.avg_delay_minutes}m delay` : ""].filter(Boolean).join(" · "),
        airports: [prog.airport_iata],
        isNimbus: prog.in_nimbus_network,
        score: base + (prog.in_nimbus_network ? 50 : 0),
        simEvent: prog.in_nimbus_network ? prog.sim_event : undefined,
      })
    }
    for (const alert of allAlerts) {
      if (alert.severity !== "Severe" && alert.severity !== "Extreme") continue
      const base = alert.severity === "Extreme" ? 90 : 60
      const isNimbus = alert.affected_nimbus_airports.length > 0
      items.push({
        id: `nws-${alert.id}`,
        typeLabel: alert.severity,
        typeSeverity: alert.severity === "Extreme" ? "critical" : "high",
        title: alert.event,
        detail: alert.area.split(",").slice(0, 2).join(",").trim(),
        airports: alert.affected_nimbus_airports,
        isNimbus,
        score: base + (isNimbus ? 50 : 0),
        simEvent: isNimbus && alert.sim_event ? alert.sim_event : undefined,
      })
    }
    return items.sort((a, b) => b.score - a.score).slice(0, 7)
  }, [programs, allAlerts])

  const nimbusHit = topDisruptions.filter((d) => d.isNimbus).length

  return (
    <div className="space-y-4 pb-2">

      {/* ── Status strip ── */}
      <div
        className="border p-3.5"
        style={{ borderRadius: r.md, borderColor: c.hairline, background: c.surfaceSoft }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 flex items-center justify-center shrink-0"
              style={{ borderRadius: r.sm, background: c.canvas, border: `1px solid ${c.hairline}` }}
            >
              <Globe className="w-3.5 h-3.5" style={{ color: c.ink }} />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">US National Airspace</div>
              <div className="text-[10px] text-muted-foreground">
                {minutesAgo === null ? "Fetching…" : minutesAgo === 0 ? "Live" : `${minutesAgo}m ago`}
                {nimbusHit > 0 && (
                  <span className="ml-1.5 text-orange-600 font-semibold">· {nimbusHit} Nimbus impact{nimbusHit !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={fetching}
            className="flex items-center gap-1.5 text-[10px] font-semibold transition-colors disabled:opacity-40"
            style={{ color: c.ink, background: "transparent", border: "none", cursor: "pointer" }}
          >
            <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { color: "text-red-600",    bg: "bg-red-50",    val: faaSum?.concurrent_ground_stops ?? "—",           label: "GS" },
            { color: "text-orange-600", bg: "bg-orange-50", val: faaSum?.concurrent_gdps ?? "—",                   label: "GDP" },
            { color: "text-sky-600",    bg: "bg-sky-50",    val: nwsSum?.severe_or_extreme ?? "—",                 label: "Sev / Ext" },
            { color: "text-teal-600",   bg: "bg-teal-50",   val: faaSum?.nimbus_network_overlap ?? "—",            label: "Nimbus hit" },
          ].map(({ color, bg, val, label }) => (
            <div key={label} className={`rounded-xl ${bg} border border-border/40 px-2 py-2 text-center`}>
              <div className={`text-base font-black font-mono leading-none ${color}`}>{val}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Loading state ── */}
      {fetching && !faaData && !alertsData && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: c.ink }} />
          Fetching live national airspace data…
        </div>
      )}

      {/* ── Nimbus only toggle ── */}
      <div className="flex items-center justify-between -mt-1">
        <span className="text-[9px] text-muted-foreground">Showing all US events</span>
        <label className="flex items-center gap-1.5 text-[9px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={nimbusOnly}
            onChange={(e) => setNimbusOnly(e.target.checked)}
          />
          Nimbus network only
        </label>
      </div>

      {/* ── Top Active Disruptions ── */}
      {topDisruptions.length > 0 && (
        <SectionToggle
          label="Top Active Disruptions"
          badge={
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              {topDisruptions.length}
            </span>
          }
          defaultOpen
        >
          <div className="space-y-1.5 mb-1">
            {topDisruptions.map((d) => (
              <div
                key={d.id}
                className={`rounded-xl border p-2.5 flex items-start gap-2.5 ${
                  d.isNimbus
                    ? d.typeSeverity === "critical" ? "border-red-200 bg-red-50/70" : "border-orange-200 bg-orange-50/60"
                    : "border-border bg-secondary/30"
                }`}
              >
                {/* Severity dot */}
                <div className="mt-0.5 shrink-0">
                  <span className={`block w-2 h-2 rounded-full ${
                    d.typeSeverity === "critical" ? "bg-red-500" : d.typeSeverity === "high" ? "bg-orange-500" : "bg-amber-400"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground truncate">{d.title}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                      d.typeSeverity === "critical" ? "bg-red-100 text-red-800 border-red-200"
                      : d.typeSeverity === "high" ? "bg-orange-100 text-orange-800 border-orange-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {d.typeLabel}
                    </span>
                    {d.isNimbus && (
                      <span className="text-[9px] font-bold shrink-0" style={{ color: c.statusOnTime.ink }}>Nimbus</span>
                    )}
                  </div>
                  {d.detail && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{d.detail}</div>
                  )}
                  {d.airports.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {d.airports.slice(0, 4).map((ap) => (
                        <span key={ap} className="text-[9px] font-mono px-1.5 py-0.5 bg-white rounded-md border border-border/60">
                          {ap.replace(/^K/, "")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {d.simEvent && (
                  <button
                    disabled={isLoadingEvent}
                    onClick={() => onLoadToSim(d.simEvent!.kind, d.simEvent!.params)}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 transition-all disabled:opacity-40"
                    style={{ borderRadius: r.sm, background: c.ink, color: c.onPrimary, border: "none", cursor: "pointer" }}
                  >
                    <Zap className="w-3 h-3" /> Sim
                  </button>
                )}
              </div>
            ))}
          </div>
        </SectionToggle>
      )}

      {/* ── FAA Ground Programs ── */}
      <SectionToggle
        label="FAA Ground Programs"
        badge={programs.length > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
            {programs.length} active
          </span>
        )}
        defaultOpen={false}
      >
        {faaData?.error && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-700 mb-2">
            FAA status temporarily unavailable. See nasstatus.faa.gov.
          </div>
        )}
        {!fetching && !faaData?.error && programs.length === 0 && faaData && (
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-center text-xs text-muted-foreground mb-2">
            No active FAA programs — NAS operating normally.
          </div>
        )}

        {/* Ground Stops — highest priority */}
        {groundStops.length > 0 && (
          <div className="mb-3">
            <div className="text-[9px] font-bold uppercase tracking-wider text-red-700 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Ground Stops ({groundStops.length})
            </div>
            <div className="space-y-1.5">
              {groundStops.map((prog, i) => (
                <div key={`gs-${i}`} className={`rounded-xl border p-2.5 ${prog.in_nimbus_network ? "border-red-200 bg-red-50/80" : "border-border bg-secondary/30"}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-sm text-foreground">{prog.airport_iata}</span>
                        {prog.in_nimbus_network && <span className="text-[9px] font-bold" style={{ color: c.statusOnTime.ink }}>Nimbus</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {prog.reason}{prog.avg_delay_minutes ? ` · avg ${prog.avg_delay_minutes}m` : ""}
                      </div>
                      {prog.recheck && <div className="text-[9px] text-muted-foreground/60 mt-0.5">Recheck: {prog.recheck}</div>}
                    </div>
                    {prog.in_nimbus_network && (
                      <button disabled={isLoadingEvent} onClick={() => onLoadToSim(prog.sim_event.kind, prog.sim_event.params)}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 disabled:opacity-40"
                        style={{ borderRadius: r.sm, background: c.ink, color: c.onPrimary, border: "none", cursor: "pointer" }}>
                        <Zap className="w-3 h-3" /> Sim
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GDPs */}
        {gdps.length > 0 && (
          <div className="mb-3">
            <div className="text-[9px] font-bold uppercase tracking-wider text-orange-700 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Ground Delay Programs ({gdps.length})
            </div>
            <div className="space-y-1.5">
              {gdps.map((prog, i) => (
                <div key={`gdp-${i}`} className={`rounded-xl border p-2.5 ${prog.in_nimbus_network ? "border-orange-200 bg-orange-50/70" : "border-border bg-secondary/30"}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-sm">{prog.airport_iata}</span>
                        {prog.avg_delay_minutes && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full border border-orange-200">avg {prog.avg_delay_minutes}m</span>}
                        {prog.in_nimbus_network && <span className="text-[9px] font-bold" style={{ color: c.statusOnTime.ink }}>Nimbus</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{prog.reason}</div>
                      {(prog.start || prog.recheck) && (
                        <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {prog.start && `Start: ${prog.start}`}{prog.recheck && ` · Recheck: ${prog.recheck}`}
                        </div>
                      )}
                    </div>
                    {prog.in_nimbus_network && (
                      <button disabled={isLoadingEvent} onClick={() => onLoadToSim(prog.sim_event.kind, prog.sim_event.params)}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 disabled:opacity-40"
                        style={{ borderRadius: r.sm, background: c.ink, color: c.onPrimary, border: "none", cursor: "pointer" }}>
                        <Zap className="w-3 h-3" /> Sim
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Departure Delays */}
        {depDelays.length > 0 && (
          <div className="mb-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Departure Delays ({depDelays.length})
            </div>
            <div className="space-y-1.5">
              {depDelays.map((prog, i) => (
                <div key={`dep-${i}`} className={`rounded-xl border p-2.5 ${prog.in_nimbus_network ? "border-amber-200 bg-amber-50/60" : "border-border bg-secondary/30"}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{prog.airport_iata}</span>
                    {prog.avg_delay_minutes && <span className="text-[9px] text-muted-foreground">avg {prog.avg_delay_minutes}m</span>}
                    <span className="text-[10px] text-muted-foreground flex-1 truncate">{prog.reason}</span>
                    {prog.in_nimbus_network && (
                      <button disabled={isLoadingEvent} onClick={() => onLoadToSim(prog.sim_event.kind, prog.sim_event.params)}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 disabled:opacity-40"
                        style={{ borderRadius: r.sm, background: c.ink, color: c.onPrimary, border: "none", cursor: "pointer" }}>
                        <Zap className="w-3 h-3" /> Sim
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionToggle>

      {/* ── NWS Weather Alerts ── */}
      <SectionToggle
        label="NWS Weather Alerts"
        badge={nimbusAlerts.length > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            {nimbusAlerts.length} Nimbus
          </span>
        )}
        defaultOpen={false}
      >
        {alertsData?.error && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-700 mb-2">
            NWS alerts temporarily unavailable.
          </div>
        )}
        {!fetching && !alertsData?.error && wxFiltered.length === 0 && alertsData && (
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-center text-xs text-muted-foreground mb-2">
            {nimbusOnly ? "No alerts overlap Nimbus airports." : "No active aviation-relevant NWS alerts."}
          </div>
        )}
        {nwsSum != null && (
          <p className="text-[9px] text-muted-foreground mb-2">
            {wxFiltered.length} of {nwsSum.nationwide_alerts_matched} aviation alerts · {nwsSum.severe_or_extreme} severe/extreme
          </p>
        )}
        {wxFiltered.length > 0 && (
          <div className="space-y-3 max-h-[min(55vh,28rem)] overflow-y-auto pr-0.5">
            {highImpactWx.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-orange-800 mb-1.5">Severe &amp; extreme</div>
                <div className="space-y-1.5">
                  {highImpactWx.map((alert) =>
                    renderAlertRow(alert, alert.affected_nimbus_airports.length > 0, isLoadingEvent, onLoadToSim)
                  )}
                </div>
              </div>
            )}
            {otherWx.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Advisories &amp; moderate</div>
                <div className="space-y-1.5">
                  {otherWx.map((alert) =>
                    renderAlertRow(alert, alert.affected_nimbus_airports.length > 0, isLoadingEvent, onLoadToSim)
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionToggle>
    </div>
  )
}

// ─── Main EventPanel ──────────────────────────────────────────────────────────

export function EventPanel() {
  const [selectedKind, setSelectedKind]       = useState<EventKind>("weather_closure")
  const [values, setValues]                   = useState<Record<string, string>>(FORM_SCHEMA.weather_closure.defaults)
  const [isLoading, setIsLoading]             = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  const { activeEvents, setUpdate }           = useSimulationStore()

  const selectKind = (kind: EventKind) => {
    setSelectedKind(kind)
    setValues(FORM_SCHEMA[kind].defaults)
    setShowDescription(false)
  }

  const setField = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))

  const triggerEvent = async (kind: string, params: Record<string, any>) => {
    setIsLoading(true)
    try {
      const r = await apiClient.post<{
        cascade_summary?: {
          total_affected: number
          directly_affected: number
          cascade_1?: number
          cascade_2?: number
        }
        [key: string]: unknown
      }>("/simulator/trigger", { kind, params })
      const info = EVENT_TYPES.find((e) => e.value === kind)
      const cs = r.data?.cascade_summary
      toast.success(`${info?.label ?? kind} triggered`, {
        description: cs
          ? `${cs.total_affected} flights affected · ${cs.directly_affected} direct, ${(cs.cascade_1 ?? 0) + (cs.cascade_2 ?? 0)} cascade`
          : "Recovery plans ready.",
      })
      setUpdate(r.data)
    } catch (err: any) {
      toast.error("Failed to trigger event", { description: err?.message || "Check API connection" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTrigger = () => {
    const params: Record<string, any> = {}
    for (const f of FORM_SCHEMA[selectedKind].fields) {
      const raw = values[f.key]
      params[f.key] = f.type === "number" ? Number(raw) : raw
    }
    triggerEvent(selectedKind, params)
  }

  const selectedInfo = EVENT_TYPES.find((e) => e.value === selectedKind)!
  const tone         = toneFor(selectedKind)
  const schema       = FORM_SCHEMA[selectedKind]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="panel-header shrink-0" style={{ paddingLeft: 12, paddingRight: 12 }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: c.surfaceSoft, border: `1px solid ${c.hairline}` }}
        >
          <Zap className="w-3.5 h-3.5" style={{ color: c.ink }} />
        </div>
        <div>
          <div className="section-title">Event Control</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">21 disruption types · live NAS feed</div>
        </div>
      </div>

      <Tabs defaultValue="trigger" className="flex-1 flex flex-col min-h-0">

        {/* Tab bar */}
        <div className="px-3 pt-3 pb-0 shrink-0 border-b border-border/50">
          <TabsList
            className="w-full mb-3 h-9 rounded-lg p-0.5"
            style={{ background: "#EBEBEB" }}
          >
            <TabsTrigger
              value="trigger"
              className="flex-1 text-[11px] h-8 rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Events
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="flex-1 text-[11px] h-8 rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Live
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="flex-1 text-[11px] h-8 rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
            >
              Active
              {activeEvents.length > 0 && (
                <span
                  className="ml-1.5 text-[9px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center shrink-0"
                  style={{ background: c.ink, color: c.onPrimary }}
                >
                  {activeEvents.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Trigger tab ── */}
        <TabsContent value="trigger" className="flex-1 overflow-y-auto px-3 py-3 space-y-4 mt-0">

          {/* Categorized event grid — every category gets one brand voltage tone
              (mint / coral / mustard / peach / forest-on-cream) so the panel
              reads as 5 grouped clusters instead of a 21-color rainbow.
              Selected tile inverts to dark ink (Airtable editorial pattern). */}
          <div className="space-y-3.5">
            {EVENT_CATEGORIES.map((cat) => {
              const catEvents = cat.events.map((v) => EVENT_TYPES.find((e) => e.value === v)!).filter(Boolean)
              return (
                <div key={cat.label}>
                  <Eyebrow>{cat.label}</Eyebrow>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {catEvents.map((et) => {
                      const isSel = selectedKind === et.value
                      const t     = toneFor(et.value)
                      return (
                        <button
                          key={et.value}
                          onClick={() => selectKind(et.value)}
                          className="flex items-center gap-2 px-2.5 py-2.5 text-left transition-all"
                          style={{
                            borderRadius: r.md,
                            border: `1px solid ${isSel ? c.ink : c.hairline}`,
                            background: isSel ? c.ink : c.canvas,
                            color: isSel ? c.onPrimary : c.body,
                            boxShadow: isSel ? "0 1px 2px rgba(24,29,38,0.08)" : "none",
                            fontFamily: ff.body,
                          }}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: r.sm,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              background: isSel ? t.iconBg : t.bg,
                              color: t.ink,
                            }}
                          >
                            <et.Icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[11px] font-semibold leading-tight">{et.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Form for selected event */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedKind}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              style={{
                borderRadius: r.lg,
                border: `1px solid ${tone.border}`,
                background: tone.bg,
                overflow: "hidden",
                fontFamily: ff.body,
              }}
            >
              {/* Event header */}
              <div
                className="flex items-center justify-between gap-2 px-4 py-3"
                style={{ borderBottom: `1px solid ${tone.border}` }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 flex items-center justify-center shrink-0"
                    style={{ borderRadius: r.sm, background: tone.iconBg, color: tone.ink }}
                  >
                    <selectedInfo.Icon className="w-4 h-4" />
                  </span>
                  <div className="text-sm font-bold leading-tight" style={{ color: tone.ink }}>
                    {selectedInfo.label}
                  </div>
                </div>
                <button
                  onClick={() => setShowDescription((d) => !d)}
                  className="flex items-center gap-1 text-[10px] font-semibold shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: tone.ink, background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {showDescription ? "Less" : "Info"}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showDescription ? "rotate-180" : ""}`} />
                </button>
              </div>

              <div className="px-4 py-3.5 space-y-3">
                {/* Expandable description */}
                <AnimatePresence>
                  {showDescription && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p
                        className="text-[11px] leading-relaxed pb-3 mb-0.5 opacity-80"
                        style={{ color: tone.ink, borderBottom: `1px solid ${tone.border}` }}
                      >
                        {EVENT_DESCRIPTIONS[selectedKind]}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form fields */}
                <div className="grid grid-cols-1 gap-3">
                  {schema.fields.map((f) => (
                    <div key={f.key}>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                        {f.label}
                      </label>
                      {f.type === "select" ? (
                        <select
                          value={values[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          className="w-full h-9 text-xs px-3 outline-none transition-shadow"
                          style={{ background: c.canvas, border: `1px solid ${c.hairline}`, borderRadius: r.sm, color: c.ink, fontFamily: ff.body }}
                          onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 3px rgba(27,97,201,0.35)"}
                          onBlur={(e) => e.currentTarget.style.boxShadow = "none"}
                        >
                          {f.options?.map((opt) => (
                            <option key={opt} value={opt}>{selectOptionLabel(f.key, opt)}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          value={values[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          min={f.min} max={f.max} step={f.step}
                          className="w-full h-9 text-xs px-3 outline-none transition-shadow"
                          style={{ background: c.canvas, border: `1px solid ${c.hairline}`, borderRadius: r.sm, color: c.ink, fontFamily: ff.mono }}
                          onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 3px rgba(27,97,201,0.35)"}
                          onBlur={(e) => e.currentTarget.style.boxShadow = "none"}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Trigger button — design-system primary CTA */}
                <ButtonPrimary
                  onClick={handleTrigger}
                  disabled={isLoading}
                  className="w-full mt-1"
                  leadingIcon={isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Zap className="w-4 h-4" />}
                >
                  {isLoading ? "Solving…" : `Trigger ${selectedInfo.label}`}
                </ButtonPrimary>
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ── Live Feed tab ── */}
        <TabsContent value="live" className="flex-1 overflow-y-auto px-3 py-3 mt-0">
          <LiveFeed onLoadToSim={triggerEvent} isLoadingEvent={isLoading} />
        </TabsContent>

        {/* ── Active tab ── */}
        <TabsContent value="active" className="flex-1 overflow-y-auto px-3 py-3 mt-0">
          {activeEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-center">
              <div
                className="w-12 h-12 flex items-center justify-center mb-3"
                style={{ borderRadius: r.lg, background: c.surfaceSoft, border: `1px solid ${c.hairline}` }}
              >
                <Activity className="w-6 h-6" style={{ color: c.muted }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: c.ink }}>No active events</p>
              <p className="text-xs mt-1" style={{ color: c.muted }}>Trigger an event to see cascade effects.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeEvents.map((ev) => {
                const info = EVENT_TYPES.find((e) => e.value === ev.kind)
                const t    = toneFor(ev.kind as EventKind)
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3.5"
                    style={{ borderRadius: r.md, border: `1px solid ${t.border}`, background: t.bg, fontFamily: ff.body }}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      {info && (
                        <span
                          className="w-7 h-7 flex items-center justify-center"
                          style={{ borderRadius: r.sm, background: t.iconBg, color: t.ink }}
                        >
                          <info.Icon className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="text-xs font-bold" style={{ color: t.ink }}>{info?.label ?? ev.kind}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      {ev.params?.airport && (
                        <div>
                          Airport: <AirportCode code={ev.params.airport} />
                          {airportLabel(ev.params.airport).city && (
                            <span className="ml-1 text-muted-foreground/80">
                              · {airportLabel(ev.params.airport).city}
                            </span>
                          )}
                        </div>
                      )}
                      {ev.params?.destination_airport && (
                        <div>
                          Dest: <AirportCode code={ev.params.destination_airport} />
                          {airportLabel(ev.params.destination_airport).city && (
                            <span className="ml-1 text-muted-foreground/80">
                              · {airportLabel(ev.params.destination_airport).city}
                            </span>
                          )}
                        </div>
                      )}
                      {ev.params?.aircraft_tail && <div>Tail: <span className="font-mono">{ev.params.aircraft_tail}</span></div>}
                      {ev.params?.base && (
                        <div>
                          Base: <AirportCode code={ev.params.base} />
                          {airportLabel(ev.params.base).city && (
                            <span className="ml-1 text-muted-foreground/80">
                              · {airportLabel(ev.params.base).city}
                            </span>
                          )}
                        </div>
                      )}
                      {ev.params?.facility_id && (
                        <div>
                          ARTCC: <span className="font-mono">{ev.params.facility_id}</span>
                          {ARTCC_NAMES[ev.params.facility_id] && (
                            <span className="ml-1 text-muted-foreground/80">· {ARTCC_NAMES[ev.params.facility_id]}</span>
                          )}
                        </div>
                      )}
                      {ev.params?.duration_hours && <div>Duration: <span className="font-mono">{ev.params.duration_hours}h</span></div>}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
