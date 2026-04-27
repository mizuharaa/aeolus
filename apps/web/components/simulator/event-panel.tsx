"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Cloud, OctagonAlert, Ban, ShieldAlert, Wrench,
  HeartPulse, AlertTriangle, Radio, Mountain, ServerCrash,
  Zap, Activity, Loader2, RefreshCw, CloudLightning, Wind,
  TriangleAlert,
} from "lucide-react"
import { apiClient } from "@/lib/api"
import { useSimulationStore } from "@/stores/simulation"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

// ─── Constants ────────────────────────────────────────────────────────────────

const AIRPORTS = ["KORD", "KATL", "KDFW", "KLAX", "KDEN", "KJFK", "KSEA", "KMIA", "KPHX", "KLAS", "KBOS", "KSFO", "KIAH", "KDTW", "KMSP"]
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
      { key: "severity",       label: "Severity",       type: "select", options: ["mild", "moderate", "severe", "extreme"] },
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
      { key: "airport",        label: "Anchor airport",  type: "select", options: AIRPORTS },
      { key: "duration_hours", label: "Duration (hrs)",  type: "number", min: 1, max: 48, step: 1 },
    ],
    defaults: { airport: "KDEN", duration_hours: "6" },
  },
  security_event: {
    fields: [
      { key: "airport",        label: "Airport",        type: "select", options: AIRPORTS },
      { key: "severity",       label: "Severity",       type: "select", options: ["moderate", "severe", "extreme"] },
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
      { key: "facility_id",   label: "ARTCC facility",    type: "select", options: ["ZAU", "ZTL", "ZFW", "ZLA", "ZDV", "ZNY", "ZSE", "ZMA", "ZAB", "ZMP"] },
      { key: "staffing_pct",  label: "Staffing %",        type: "number", min: 30, max: 95, step: 5 },
      { key: "duration_hours",label: "Duration (hrs)",    type: "number", min: 1, max: 12, step: 1 },
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

// ─── Live data types ───────────────────────────────────────────────────────────

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

// ─── Live Feed component ───────────────────────────────────────────────────────

function LiveFeed({
  onLoadToSim,
  isLoadingEvent,
}: {
  onLoadToSim: (kind: string, params: Record<string, any>) => Promise<void>
  isLoadingEvent: boolean
}) {
  const [faaData, setFaaData]       = useState<{ programs: FAAProgram[]; nimbus_affected?: number; source?: string; error?: string } | null>(null)
  const [alertsData, setAlertsData] = useState<{ alerts: NWSAlert[]; nimbus_affected?: number; source?: string; error?: string } | null>(null)
  const [fetching, setFetching]     = useState(false)
  const [lastFetch, setLastFetch]   = useState<Date | null>(null)

  const fetchAll = useCallback(async () => {
    setFetching(true)
    const [faaRes, alertsRes] = await Promise.allSettled([
      apiClient.get("/live/faa-status"),
      apiClient.get("/live/weather-alerts"),
    ])
    if (faaRes.status === "fulfilled")    setFaaData(faaRes.value.data)
    if (alertsRes.status === "fulfilled") setAlertsData(alertsRes.value.data)
    setLastFetch(new Date())
    setFetching(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchAll])

  const programs    = faaData?.programs    ?? []
  const allAlerts   = alertsData?.alerts   ?? []
  const nimbusAlerts = allAlerts.filter((a) => a.affected_nimbus_airports.length > 0)
  const shownAlerts  = nimbusAlerts.length > 0 ? nimbusAlerts : allAlerts.slice(0, 6)

  const minutesAgo = lastFetch
    ? Math.floor((Date.now() - lastFetch.getTime()) / 60_000)
    : null

  const hasFaaError    = !!faaData?.error
  const hasAlertsError = !!alertsData?.error

  return (
    <div className="space-y-4 pb-2">
      {/* Header row */}
      <div className="flex items-center justify-between sticky top-0 bg-card pt-0.5 pb-1 z-10">
        <div className="text-[10px] text-muted-foreground">
          {minutesAgo === null
            ? "Fetching live data…"
            : minutesAgo === 0
            ? "Updated just now · FAA + NWS"
            : `Updated ${minutesAgo}m ago · FAA + NWS`}
        </div>
        <button
          onClick={fetchAll}
          disabled={fetching}
          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/70 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── FAA Programs ── */}
      <section>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            FAA Traffic Programs
          </span>
          {programs.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
              {programs.length} active
            </span>
          )}
        </div>

        {fetching && !faaData && (
          <div className="py-4 text-center text-[11px] text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
            Checking FAA…
          </div>
        )}

        {hasFaaError && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] text-orange-700">
            FAA status temporarily unavailable. Check nasstatus.faa.gov directly.
          </div>
        )}

        {!fetching && !hasFaaError && programs.length === 0 && faaData && (
          <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-center text-[11px] text-muted-foreground">
            ✓ No active FAA ground stops or delays
          </div>
        )}

        {programs.length > 0 && (
          <div className="space-y-1.5">
            {programs.map((prog, i) => (
              <div
                key={i}
                className={`rounded-lg border p-2.5 transition-colors ${
                  prog.in_nimbus_network
                    ? "border-red-200 bg-red-50"
                    : "border-border bg-secondary/40"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[12px] font-mono font-bold ${prog.in_nimbus_network ? "text-red-700" : "text-foreground"}`}>
                        {prog.airport_iata}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase border ${
                        prog.type === "ground_stop"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : prog.type === "ground_delay_program"
                          ? "bg-orange-100 text-orange-700 border-orange-200"
                          : "bg-amber-100 text-amber-700 border-amber-200"
                      }`}>
                        {prog.type === "ground_stop" ? "GS" : prog.type === "ground_delay_program" ? "GDP" : "DEP DLY"}
                      </span>
                      {prog.in_nimbus_network && (
                        <span className="text-[9px] font-bold text-primary">● Nimbus</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {prog.reason}
                      {prog.avg_delay_minutes ? ` · avg ${prog.avg_delay_minutes}m` : ""}
                    </div>
                    {(prog.recheck || prog.start) && (
                      <div className="text-[9px] text-muted-foreground/70 mt-0.5">
                        {prog.start && `Start: ${prog.start}`}
                        {prog.recheck && ` · Recheck: ${prog.recheck}`}
                      </div>
                    )}
                  </div>
                  {prog.in_nimbus_network && (
                    <button
                      disabled={isLoadingEvent}
                      onClick={() => onLoadToSim(prog.sim_event.kind, prog.sim_event.params)}
                      className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
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

      {/* ── NWS Weather Alerts ── */}
      <section>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            NWS Aviation Alerts
          </span>
          {nimbusAlerts.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">
              {nimbusAlerts.length} affect Nimbus
            </span>
          )}
        </div>

        {fetching && !alertsData && (
          <div className="py-4 text-center text-[11px] text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
            Checking NWS…
          </div>
        )}

        {hasAlertsError && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] text-orange-700">
            NWS alerts temporarily unavailable.
          </div>
        )}

        {!fetching && !hasAlertsError && shownAlerts.length === 0 && alertsData && (
          <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-center text-[11px] text-muted-foreground">
            ✓ No active aviation weather alerts
          </div>
        )}

        {shownAlerts.length > 0 && (
          <div className="space-y-1.5">
            {shownAlerts.map((alert) => {
              const isNimbus = alert.affected_nimbus_airports.length > 0
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
                  className={`rounded-lg border p-2.5 ${
                    isNimbus ? "border-sky-200 bg-sky-50" : "border-border bg-secondary/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {alert.event.toLowerCase().includes("thunder") || alert.event.toLowerCase().includes("tornado")
                          ? <CloudLightning className={`w-3 h-3 shrink-0 ${sevColor}`} />
                          : alert.event.toLowerCase().includes("wind")
                          ? <Wind className={`w-3 h-3 shrink-0 ${sevColor}`} />
                          : <TriangleAlert className={`w-3 h-3 shrink-0 ${sevColor}`} />
                        }
                        <span className={`text-[10px] font-semibold ${sevColor} leading-tight`}>
                          {alert.event}
                        </span>
                        <span className={`text-[9px] px-1 py-0.5 rounded font-semibold border ${sevBg}`}>
                          {alert.severity}
                        </span>
                      </div>

                      {isNimbus && (
                        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                          <span className="text-[9px] text-sky-600 font-medium">Affects:</span>
                          {alert.affected_nimbus_airports.map((ap) => (
                            <span key={ap} className="text-[9px] font-mono px-1 py-0.5 bg-sky-100 text-sky-700 rounded border border-sky-200">
                              {ap.replace(/^K/, "")}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground line-clamp-2">
                        {alert.area}
                      </div>
                    </div>

                    {isNimbus && alert.sim_event && (
                      <button
                        disabled={isLoadingEvent}
                        onClick={() => onLoadToSim(alert.sim_event!.kind, alert.sim_event!.params)}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        <Zap className="w-3 h-3" /> Sim
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Main EventPanel ───────────────────────────────────────────────────────────

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
        <div className="px-4 pt-3 pb-0 shrink-0 border-b border-border">
          <TabsList className="bg-secondary h-8 mb-3">
            <TabsTrigger value="trigger" className="text-xs h-6 px-3">
              Trigger Event
            </TabsTrigger>
            <TabsTrigger value="live" className="text-xs h-6 px-3 relative">
              Live Feed
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs h-6 px-3 relative">
              Active
              {activeEvents.length > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full w-4 h-4 inline-flex items-center justify-center">
                  {activeEvents.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Trigger tab ── */}
        <TabsContent value="trigger" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          {/* Event type grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {EVENT_TYPES.map((et) => {
              const isSel = selectedKind === et.value
              const c = COLOR_CLASSES[et.color]
              return (
                <button
                  key={et.value}
                  onClick={() => selectKind(et.value)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-medium text-left transition-all ${
                    isSel
                      ? `${c.soft} ${c.text} border-transparent ring-2 ${c.ring} shadow-sm`
                      : "bg-card text-foreground/80 border-border hover:border-primary/40 hover:bg-secondary"
                  }`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSel ? c.iconBg : "bg-secondary"}`}>
                    <et.Icon className={`w-3.5 h-3.5 ${isSel ? c.text : "text-muted-foreground"}`} />
                  </span>
                  <span className="leading-tight">{et.label}</span>
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
              className={`rounded-xl border ${palette.border} ${palette.soft} p-3 space-y-2.5`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${palette.iconBg}`}>
                  <selectedInfo.Icon className={`w-4 h-4 ${palette.text}`} />
                </span>
                <div className={`text-sm font-display font-semibold ${palette.text}`}>{selectedInfo.label}</div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {schema.fields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {f.label}
                    </label>
                    {f.type === "select" ? (
                      <select
                        value={values[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className="w-full h-8 text-xs bg-card border border-border rounded-md px-2 outline-none focus:ring-2 focus:ring-primary/30 transition"
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
                        className="w-full h-8 text-xs bg-card border border-border rounded-md px-2 outline-none focus:ring-2 focus:ring-primary/30 transition"
                      />
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleTrigger}
                disabled={isLoading}
                size="sm"
                className="w-full gradient-peach text-white glow-peach hover:opacity-95 h-9 mt-1 font-semibold"
              >
                {isLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Solving…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5 mr-1.5" /> Trigger {selectedInfo.label}</>
                )}
              </Button>
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
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Activity className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">No active events</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Trigger an event to see cascade effects.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeEvents.map((ev) => {
                const info = EVENT_TYPES.find((e) => e.value === ev.kind)
                const c = info ? COLOR_CLASSES[info.color] : COLOR_CLASSES.orange
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-lg border ${c.border} ${c.soft} p-3`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {info && (
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center ${c.iconBg}`}>
                          <info.Icon className={`w-3.5 h-3.5 ${c.text}`} />
                        </span>
                      )}
                      <span className={`text-xs font-semibold ${c.text}`}>{info?.label ?? ev.kind}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      {ev.params?.airport              && <div>Airport: <span className="font-mono">{ev.params.airport}</span></div>}
                      {ev.params?.destination_airport  && <div>Dest: <span className="font-mono">{ev.params.destination_airport}</span></div>}
                      {ev.params?.aircraft_tail        && <div>Tail: <span className="font-mono">{ev.params.aircraft_tail}</span></div>}
                      {ev.params?.base                 && <div>Base: <span className="font-mono">{ev.params.base}</span></div>}
                      {ev.params?.facility_id          && <div>ARTCC: <span className="font-mono">{ev.params.facility_id}</span></div>}
                      {ev.params?.duration_hours       && <div>Duration: <span className="font-mono">{ev.params.duration_hours}h</span></div>}
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
