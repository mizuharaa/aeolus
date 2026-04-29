"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Cloud, OctagonAlert, Ban, ShieldAlert, Wrench,
  HeartPulse, AlertTriangle, Radio, Mountain, ServerCrash,
  Zap, Activity, Loader2, RefreshCw, CloudLightning, Wind,
  TriangleAlert, Globe, MapPin, Gauge,
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { useSimulationStore } from "@/stores/simulation"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// ─── Constants ────────────────────────────────────────────────────────────────

const AIRPORTS = ["KORD","KATL","KDFW","KLAX","KDEN","KJFK","KSEA","KMIA","KPHX","KLAS","KBOS","KSFO","KIAH","KDTW","KMSP"]
const AIRCRAFT  = Array.from({ length: 40 }, (_, i) => `N${String(i + 1).padStart(3, "0")}NB`)

const EVENT_TYPES = [
  { value: "weather_closure",  label: "Weather Closure",  Icon: Cloud,         color: "sky"    },
  { value: "ground_stop",      label: "Ground Stop",      Icon: OctagonAlert,  color: "orange" },
  { value: "airspace_closure", label: "Airspace Closure", Icon: Ban,           color: "red"    },
  { value: "security_event",   label: "Security Event",   Icon: ShieldAlert,   color: "rose"   },
  { value: "mechanical_aog",   label: "Mechanical AOG",   Icon: Wrench,        color: "amber"  },
  { value: "crew_sickout",     label: "Crew Sick-out",    Icon: HeartPulse,    color: "pink"   },
  { value: "runway_closure",   label: "Runway Closure",   Icon: AlertTriangle, color: "yellow" },
  { value: "atc_staffing",     label: "ATC Shortage",     Icon: Radio,         color: "indigo" },
  { value: "volcanic_ash",     label: "Volcanic Ash",     Icon: Mountain,      color: "stone"  },
  { value: "cyber_incident",   label: "Cyber Incident",   Icon: ServerCrash,   color: "violet" },
] as const

type EventKind = typeof EVENT_TYPES[number]["value"]

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
  ground_stop: {
    fields: [
      { key: "destination_airport", label: "Destination airport", type: "select", options: AIRPORTS },
      { key: "duration_hours",      label: "Duration (hrs)",      type: "number", min: 0.5, max: 12, step: 0.5 },
    ],
    defaults: { destination_airport: "KATL", duration_hours: "2" },
  },
  airspace_closure: {
    fields: [
      { key: "airport",        label: "Anchor airport", type: "select", options: AIRPORTS },
      { key: "duration_hours", label: "Duration (hrs)", type: "number", min: 1, max: 48, step: 1 },
    ],
    defaults: { airport: "KDEN", duration_hours: "6" },
  },
  security_event: {
    fields: [
      { key: "airport",        label: "Airport",        type: "select", options: AIRPORTS },
      { key: "severity",       label: "Severity",       type: "select", options: ["moderate","severe","extreme"] },
      { key: "duration_hours", label: "Duration (hrs)", type: "number", min: 0.5, max: 12, step: 0.5 },
    ],
    defaults: { airport: "KJFK", severity: "severe", duration_hours: "3" },
  },
  mechanical_aog: {
    fields: [
      { key: "aircraft_tail",  label: "Aircraft tail",   type: "select", options: AIRCRAFT },
      { key: "airport",        label: "Current airport", type: "select", options: AIRPORTS },
      { key: "duration_hours", label: "Duration (hrs)",  type: "number", min: 1, max: 48, step: 1 },
    ],
    defaults: { aircraft_tail: "N001NB", airport: "KATL", duration_hours: "8" },
  },
  crew_sickout: {
    fields: [
      { key: "base",             label: "Crew base",      type: "select", options: AIRPORTS },
      { key: "percent_affected", label: "% affected",     type: "number", min: 5, max: 100, step: 5 },
      { key: "duration_hours",   label: "Duration (hrs)", type: "number", min: 1, max: 48, step: 1 },
    ],
    defaults: { base: "KORD", percent_affected: "30", duration_hours: "8" },
  },
  runway_closure: {
    fields: [
      { key: "airport",          label: "Airport",          type: "select", options: AIRPORTS },
      { key: "capacity_cut_pct", label: "Capacity cut (%)", type: "number", min: 10, max: 100, step: 5 },
      { key: "duration_hours",   label: "Duration (hrs)",   type: "number", min: 0.5, max: 24, step: 0.5 },
    ],
    defaults: { airport: "KDFW", capacity_cut_pct: "45", duration_hours: "6" },
  },
  atc_staffing: {
    fields: [
      { key: "facility_id",    label: "ARTCC facility", type: "select", options: ["ZAU","ZTL","ZFW","ZLA","ZDV","ZNY","ZSE","ZMA","ZAB","ZMP"] },
      { key: "staffing_pct",   label: "Staffing %",     type: "number", min: 30, max: 95, step: 5 },
      { key: "duration_hours", label: "Duration (hrs)", type: "number", min: 1, max: 12, step: 1 },
    ],
    defaults: { facility_id: "ZAU", staffing_pct: "60", duration_hours: "6" },
  },
  volcanic_ash: {
    fields: [
      { key: "ash_cloud_radius_nm", label: "Plume radius (nm)", type: "number", min: 50, max: 500, step: 25 },
      { key: "duration_hours",      label: "Duration (hrs)",    type: "number", min: 6, max: 72, step: 1 },
    ],
    defaults: { ash_cloud_radius_nm: "200", duration_hours: "18" },
  },
  cyber_incident: {
    fields: [
      { key: "degradation_pct", label: "Degradation %",  type: "number", min: 20, max: 100, step: 5 },
      { key: "duration_hours",  label: "Duration (hrs)", type: "number", min: 1, max: 24, step: 1 },
    ],
    defaults: { degradation_pct: "60", duration_hours: "12" },
  },
}

const COLOR_CLASSES: Record<string, { soft: string; ring: string; text: string; iconBg: string; border: string }> = {
  sky:    { soft: "bg-sky-50",     ring: "ring-sky-300",    text: "text-sky-700",    iconBg: "bg-sky-100",    border: "border-sky-200"    },
  orange: { soft: "bg-orange-50",  ring: "ring-orange-300", text: "text-orange-700", iconBg: "bg-orange-100", border: "border-orange-200" },
  red:    { soft: "bg-red-50",     ring: "ring-red-300",    text: "text-red-700",    iconBg: "bg-red-100",    border: "border-red-200"    },
  rose:   { soft: "bg-rose-50",    ring: "ring-rose-300",   text: "text-rose-700",   iconBg: "bg-rose-100",   border: "border-rose-200"   },
  amber:  { soft: "bg-amber-50",   ring: "ring-amber-300",  text: "text-amber-700",  iconBg: "bg-amber-100",  border: "border-amber-200"  },
  pink:   { soft: "bg-pink-50",    ring: "ring-pink-300",   text: "text-pink-700",   iconBg: "bg-pink-100",   border: "border-pink-200"   },
  yellow: { soft: "bg-yellow-50",  ring: "ring-yellow-300", text: "text-yellow-800", iconBg: "bg-yellow-100", border: "border-yellow-200" },
  indigo: { soft: "bg-indigo-50",  ring: "ring-indigo-300", text: "text-indigo-700", iconBg: "bg-indigo-100", border: "border-indigo-200" },
  stone:  { soft: "bg-stone-50",   ring: "ring-stone-300",  text: "text-stone-700",  iconBg: "bg-stone-100",  border: "border-stone-200"  },
  violet: { soft: "bg-violet-50",  ring: "ring-violet-300", text: "text-violet-700", iconBg: "bg-violet-100", border: "border-violet-200" },
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
            style={{ background: "#2BA8A2", color: "white" }}
          >
            <Zap className="w-3 h-3" /> Sim
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Live Feed ────────────────────────────────────────────────────────────────

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
  const [nimbusWeatherOnly, setNimbusWeatherOnly] = useState(false)

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

  const programs = [...(faaData?.programs ?? [])].sort(
    (a, b) => (FAA_TYPE_ORDER[a.type] ?? 9) - (FAA_TYPE_ORDER[b.type] ?? 9)
  )
  const allAlerts = alertsData?.alerts ?? []
  const weatherFiltered = nimbusWeatherOnly
    ? allAlerts.filter((a) => a.affected_nimbus_airports.length > 0)
    : allAlerts
  const highImpactWx = weatherFiltered.filter((a) => a.severity === "Severe" || a.severity === "Extreme")
  const otherWx = weatherFiltered.filter((a) => a.severity !== "Severe" && a.severity !== "Extreme")
  const nimbusAlerts = allAlerts.filter((a) => a.affected_nimbus_airports.length > 0)

  const faaSum = faaData?.us_summary
  const nwsSum = alertsData?.us_summary
  const minutesAgo = lastFetch ? Math.floor((Date.now() - lastFetch.getTime()) / 60_000) : null
  const hasFaaError = !!faaData?.error
  const hasAlertsError = !!alertsData?.error

  return (
    <div className="space-y-4 pb-2">
      {/* US overview */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "rgba(43,168,162,0.18)", background: "linear-gradient(135deg, #E8F6F5 0%, #FFFFFF 100%)" }}>
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(43,168,162,0.14)", border: "1px solid rgba(43,168,162,0.20)" }}
          >
            <Globe className="w-4.5 h-4.5" style={{ color: "#2BA8A2" }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="section-title mb-0.5">United States — Live</h3>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Concurrent FAA traffic programs and NWS weather alerts (public feeds).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { Icon: Gauge,        color: "text-red-600",    val: faaSum?.concurrent_total,           label: "FAA programs" },
            { Icon: MapPin,       color: "text-amber-600",  val: faaSum?.unique_us_airports,          label: "US airports" },
            { Icon: Cloud,        color: "text-sky-600",    val: nwsSum?.nationwide_alerts_matched,   label: "NWS alerts (US)" },
            { Icon: CloudLightning, color: "text-orange-600", val: nwsSum?.severe_or_extreme,         label: "Severe / extreme" },
          ].map(({ Icon, color, val, label }) => (
            <div key={label} className="rounded-xl border border-border/70 bg-white/70 px-3 py-2.5 flex items-center gap-2.5">
              <Icon className={`w-4 h-4 ${color} shrink-0`} />
              <div>
                <div className="text-base font-bold font-mono leading-none text-foreground">
                  {val ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>
        {faaSum != null && faaSum.nimbus_network_overlap > 0 && (
          <p className="text-[10px] font-semibold" style={{ color: "#2BA8A2" }}>
            {faaSum.nimbus_network_overlap} program(s) touch the Nimbus network — use Sim to load.
          </p>
        )}
      </div>

      {/* Refresh bar */}
      <div className="flex items-center justify-between sticky top-0 bg-white pt-0.5 pb-1.5 z-10 border-b border-border/40 -mx-1 px-1">
        <div className="text-[10px] text-muted-foreground">
          {minutesAgo === null ? "Fetching…" : minutesAgo === 0 ? "Just refreshed" : `Refreshed ${minutesAgo}m ago`}
        </div>
        <button
          onClick={fetchAll}
          disabled={fetching}
          className="flex items-center gap-1.5 text-[10px] font-semibold transition-colors disabled:opacity-40"
          style={{ color: "#2BA8A2" }}
        >
          <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* FAA programs */}
      <section>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            FAA — National Traffic
          </span>
          {programs.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {programs.length} concurrent
            </span>
          )}
        </div>
        {faaSum != null && (
          <p className="text-[9px] text-muted-foreground mb-2">
            Ground stops: {faaSum.concurrent_ground_stops} · GDP: {faaSum.concurrent_gdps} · Dep delay: {faaSum.concurrent_departure_delay_programs}
          </p>
        )}

        {fetching && !faaData && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" style={{ color: "#2BA8A2" }} />
            Loading NAS status…
          </div>
        )}
        {hasFaaError && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-700">
            FAA status temporarily unavailable. See nasstatus.faa.gov.
          </div>
        )}
        {!fetching && !hasFaaError && programs.length === 0 && faaData && (
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-center text-xs text-muted-foreground">
            No active FAA programs in the current snapshot.
          </div>
        )}
        {programs.length > 0 && (
          <div className="space-y-2 max-h-[min(50vh,24rem)] overflow-y-auto pr-0.5">
            {programs.map((prog, i) => (
              <div
                key={`${prog.airport_iata}-${prog.type}-${i}`}
                className={`rounded-xl border p-3 transition-colors ${
                  prog.in_nimbus_network ? "border-red-200 bg-red-50/80" : "border-border bg-secondary/30"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-sm font-mono font-bold ${prog.in_nimbus_network ? "text-red-800" : "text-foreground"}`}>
                        {prog.airport_iata}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase border ${
                        prog.type === "ground_stop" ? "bg-red-100 text-red-800 border-red-200"
                        : prog.type === "ground_delay_program" ? "bg-orange-100 text-orange-800 border-orange-200"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                      }`}>
                        {prog.type === "ground_stop" ? "GS" : prog.type === "ground_delay_program" ? "GDP" : "DEP DLY"}
                      </span>
                      {prog.in_nimbus_network && (
                        <span className="text-[9px] font-bold" style={{ color: "#2BA8A2" }}>Nimbus</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2">
                      {prog.reason}{prog.avg_delay_minutes ? ` · avg ${prog.avg_delay_minutes}m` : ""}
                    </div>
                    {(prog.recheck || prog.start) && (
                      <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                        {prog.start && `Start: ${prog.start}`}
                        {prog.recheck && ` · Recheck: ${prog.recheck}`}
                      </div>
                    )}
                  </div>
                  {prog.in_nimbus_network && (
                    <button
                      disabled={isLoadingEvent}
                      onClick={() => onLoadToSim(prog.sim_event.kind, prog.sim_event.params)}
                      className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                      style={{ background: "#2BA8A2", color: "white" }}
                    >
                      <Zap className="w-3 h-3" /> Sim
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* NWS weather */}
      <section>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            NWS — US Weather
          </span>
          {nimbusAlerts.length > 0 && (
            <span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
              {nimbusAlerts.length} w/ Nimbus
            </span>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-[9px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={nimbusWeatherOnly}
              onChange={(e) => setNimbusWeatherOnly(e.target.checked)}
            />
            Nimbus only
          </label>
        </div>
        {nwsSum != null && (
          <p className="text-[9px] text-muted-foreground mb-2">
            Showing {Math.min(weatherFiltered.length, nwsSum.returned || weatherFiltered.length)} of {nwsSum.nationwide_alerts_matched} aviation alerts.
          </p>
        )}
        {fetching && !alertsData && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" style={{ color: "#2BA8A2" }} />
            Loading NWS…
          </div>
        )}
        {hasAlertsError && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-700">
            NWS alerts temporarily unavailable.
          </div>
        )}
        {!fetching && !hasAlertsError && weatherFiltered.length === 0 && alertsData && (
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-3 text-center text-xs text-muted-foreground">
            {nimbusWeatherOnly ? "No alerts overlap Nimbus airports." : "No active aviation-relevant NWS alerts."}
          </div>
        )}
        {weatherFiltered.length > 0 && (
          <div className="space-y-3 max-h-[min(55vh,30rem)] overflow-y-auto pr-0.5">
            {highImpactWx.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-orange-800 mb-2">
                  Severe &amp; extreme
                </div>
                <div className="space-y-2">
                  {highImpactWx.map((alert) =>
                    renderAlertRow(alert, alert.affected_nimbus_airports.length > 0, isLoadingEvent, onLoadToSim)
                  )}
                </div>
              </div>
            )}
            {otherWx.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Advisories &amp; moderate
                </div>
                <div className="space-y-2">
                  {otherWx.map((alert) =>
                    renderAlertRow(alert, alert.affected_nimbus_airports.length > 0, isLoadingEvent, onLoadToSim)
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Main EventPanel ──────────────────────────────────────────────────────────

export function EventPanel() {
  const [selectedKind, setSelectedKind] = useState<EventKind>("weather_closure")
  const [values, setValues]             = useState<Record<string, string>>(FORM_SCHEMA.weather_closure.defaults)
  const [isLoading, setIsLoading]       = useState(false)
  const { activeEvents, setUpdate }     = useSimulationStore()

  const selectKind = (kind: EventKind) => {
    setSelectedKind(kind)
    setValues(FORM_SCHEMA[kind].defaults)
  }

  const setField = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))

  const triggerEvent = async (kind: string, params: Record<string, any>) => {
    setIsLoading(true)
    try {
      const r = await apiClient.post("/simulator/trigger", { kind, params })
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
  const palette      = COLOR_CLASSES[selectedInfo.color] ?? COLOR_CLASSES.orange
  const schema       = FORM_SCHEMA[selectedKind]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="trigger" className="flex flex-col h-full">

        {/* Tab bar */}
        <div className="px-4 pt-3.5 pb-0 shrink-0 border-b border-border/60">
          <TabsList
            className="mb-3 h-9 rounded-xl gap-0.5 p-0.5"
            style={{ background: "rgba(43,168,162,0.10)" }}
          >
            <TabsTrigger
              value="trigger"
              className="text-xs h-8 px-3 rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:shadow-nav"
              style={{ color: "inherit" }}
            >
              Trigger Event
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="text-xs h-8 px-3 rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:shadow-nav relative"
            >
              Live Feed
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="text-xs h-8 px-3 rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:shadow-nav relative"
            >
              Active
              {activeEvents.length > 0 && (
                <span
                  className="ml-1.5 text-[9px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center text-white"
                  style={{ background: "#EF6C4A" }}
                >
                  {activeEvents.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Trigger tab ── */}
        <TabsContent value="trigger" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">

          {/* Event type grid */}
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPES.map((et) => {
              const isSel = selectedKind === et.value
              const c = COLOR_CLASSES[et.color]
              return (
                <button
                  key={et.value}
                  onClick={() => selectKind(et.value)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    isSel
                      ? `${c.soft} ${c.text} border-transparent ring-2 ${c.ring} shadow-sm`
                      : "bg-white text-foreground/80 border-border/50 hover:border-teal/40 hover:bg-teal-bg/60"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSel ? c.iconBg : "bg-secondary"}`}>
                    <et.Icon className={`w-4 h-4 ${isSel ? c.text : "text-muted-foreground"}`} />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{et.label}</span>
                </button>
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
              className={`rounded-2xl border ${palette.border} ${palette.soft} p-4 space-y-3`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${palette.iconBg}`}>
                  <selectedInfo.Icon className={`w-4 h-4 ${palette.text}`} />
                </span>
                <div className={`text-sm font-bold ${palette.text}`}>{selectedInfo.label}</div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {schema.fields.map((f) => (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                      {f.label}
                    </label>
                    {f.type === "select" ? (
                      <select
                        value={values[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className="w-full h-9 text-xs bg-white border border-border/60 rounded-xl px-3 outline-none transition"
                        style={{ boxShadow: "none" }}
                        onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 3px rgba(43,168,162,0.18)"}
                        onBlur={(e) => e.currentTarget.style.boxShadow = "none"}
                      >
                        {f.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={values[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        min={f.min} max={f.max} step={f.step}
                        className="w-full h-9 text-xs bg-white border border-border/60 rounded-xl px-3 outline-none transition"
                        style={{ boxShadow: "none" }}
                        onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 3px rgba(43,168,162,0.18)"}
                        onBlur={(e) => e.currentTarget.style.boxShadow = "none"}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Gold CTA button */}
              <button
                onClick={handleTrigger}
                disabled={isLoading}
                className="btn-gold w-full h-11 text-sm"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Solving…</>
                ) : (
                  <><Zap className="w-4 h-4" /> Trigger {selectedInfo.label}</>
                )}
              </button>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ── Live Feed tab ── */}
        <TabsContent value="live" className="flex-1 overflow-y-auto p-4 mt-0">
          <LiveFeed onLoadToSim={triggerEvent} isLoadingEvent={isLoading} />
        </TabsContent>

        {/* ── Active tab ── */}
        <TabsContent value="active" className="flex-1 overflow-y-auto p-4 mt-0">
          {activeEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: "rgba(43,168,162,0.10)", border: "1px solid rgba(43,168,162,0.15)" }}
              >
                <Activity className="w-6 h-6" style={{ color: "#2BA8A2", opacity: 0.5 }} />
              </div>
              <p className="text-sm font-semibold text-foreground/80">No active events</p>
              <p className="text-xs text-muted-foreground mt-1">Trigger an event to see cascade effects.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeEvents.map((ev) => {
                const info = EVENT_TYPES.find((e) => e.value === ev.kind)
                const c = info ? COLOR_CLASSES[info.color] : COLOR_CLASSES.orange
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-xl border ${c.border} ${c.soft} p-3.5`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      {info && (
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.iconBg}`}>
                          <info.Icon className={`w-3.5 h-3.5 ${c.text}`} />
                        </span>
                      )}
                      <span className={`text-xs font-bold ${c.text}`}>{info?.label ?? ev.kind}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      {ev.params?.airport             && <div>Airport: <span className="font-mono">{ev.params.airport}</span></div>}
                      {ev.params?.destination_airport && <div>Dest: <span className="font-mono">{ev.params.destination_airport}</span></div>}
                      {ev.params?.aircraft_tail       && <div>Tail: <span className="font-mono">{ev.params.aircraft_tail}</span></div>}
                      {ev.params?.base                && <div>Base: <span className="font-mono">{ev.params.base}</span></div>}
                      {ev.params?.facility_id         && <div>ARTCC: <span className="font-mono">{ev.params.facility_id}</span></div>}
                      {ev.params?.duration_hours      && <div>Duration: <span className="font-mono">{ev.params.duration_hours}h</span></div>}
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
