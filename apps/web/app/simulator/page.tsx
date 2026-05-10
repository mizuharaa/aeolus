"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Maximize2, Minimize2, AlertTriangle, Activity, Plane, Clock, X } from "lucide-react"
import { useSimulationStore, type ScheduledFlight, type FleetAircraft } from "@/stores/simulation"
import { useWebSocket } from "@/lib/websocket"
import { EventPanel } from "@/components/simulator/event-panel"
import { CascadeTimeline } from "@/components/simulator/cascade-timeline"
import { RecoveryPlans } from "@/components/simulator/recovery-plans"
import { SimulatorNav } from "@/components/simulator/nav"
import { FlightSearch } from "@/components/simulator/flight-search"
import { MyFlights } from "@/components/simulator/my-flights"
import { PlanCompare } from "@/components/simulator/plan-compare"
import { CrewOverbooking } from "@/components/simulator/crew-overbooking"
import { PassengerSolutions } from "@/components/simulator/passenger-solutions"
import { apiClient } from "@/lib/api"

const FlightMap = dynamic(() => import("@/components/simulator/flight-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#F0FDFA" }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#0D9488", boxShadow: "0 4px 16px rgba(13,148,136,0.35)" }}
        >
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
        <span className="text-sm font-semibold" style={{ color: "#0D9488", fontFamily: "'DM Sans', sans-serif" }}>
          Loading map…
        </span>
      </div>
    </div>
  ),
})

const NAV_H   = 48   // slim nav height
const RAIL_L  = 308  // left control rail width
const RAIL_R  = 340  // right decision rail width
const STRIP_H = 192  // docked timeline height

// Smooth motion preset shared by every collapse-driven element so the rails,
// timeline, and overlay card all glide in unison rather than racing each other.
const FOCUS_TRANSITION = { duration: 0.42, ease: [0.22, 0.9, 0.28, 1] as const }

const belowCard = {
  background: "#FFFFFF",
  border: "1px solid #DDDDDD",
  borderRadius: 12,
  overflow: "hidden" as const,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
} as const

export default function SimulatorPage() {
  const {
    flightStates, schedule, setSchedule, setFleet, setSelectedLiveFlight,
    appliedPlanId, recoveryPlans, cascadeSummary, activeEvents,
  } = useSimulationStore()
  const { isConnected } = useWebSocket()
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null)
  const [mapFocused, setMapFocused] = useState(false)

  // Persist the focus preference so users who like the wide-map view keep it
  // across page reloads and across the inevitable disruption demo.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aeolus-map-focused")
      if (saved === "1") setMapFocused(true)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem("aeolus-map-focused", mapFocused ? "1" : "0") } catch {}
  }, [mapFocused])

  // Keyboard shortcut: F toggles focus mode. Ignored when typing in inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      e.preventDefault()
      setMapFocused((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Nudge any embedded Leaflet/canvas to recompute. The map already watches
  // its parent via ResizeObserver, but firing a window resize nails the case
  // where the rails finish their animation slightly after Leaflet's first tick.
  useEffect(() => {
    const t1 = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 220)
    const t2 = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 480)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [mapFocused])

  const handleFlightSelect = (id: string | null) => {
    setSelectedFlight(id)
    if (id) setSelectedLiveFlight(null)
  }

  const stateValues = Object.values(flightStates)
  const affectedCount = stateValues.filter((f) => f.cascade_order >= 0).length
  const directHitCount = stateValues.filter((f) => f.cascade_order === 0).length
  const cancelledCount = stateValues.filter((f) => f.status === "cancelled").length
  const delayedCount = stateValues.filter(
    (f) => f.status !== "cancelled" && f.delay_minutes > 0,
  ).length
  const totalDelayMin = stateValues.reduce((s, f) => s + (f.delay_minutes || 0), 0)
  const onTimeCount = Math.max(0, (schedule.length || stateValues.length) - cancelledCount - delayedCount)
  const appliedPlan = recoveryPlans.find((p) => p.plan_id === appliedPlanId) || null

  useEffect(() => {
    apiClient
      .get<{ flights?: ScheduledFlight[] } | ScheduledFlight[]>("/simulator/schedule")
      .then((res) => {
        const d = res.data
        const list = Array.isArray(d) ? d : d?.flights
        setSchedule(list ?? [])
      })
      .catch(() => {})

    apiClient
      .get<{ aircraft?: FleetAircraft[] }>("/network/aircraft")
      .then((res) => setFleet(res.data?.aircraft ?? []))
      .catch(() => {})
  }, [setSchedule, setFleet])

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>

      {/* ── Slim sticky nav ── */}
      <div className="sticky top-0 z-50">
        <SimulatorNav isConnected={isConnected} affectedCount={affectedCount} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN 3-ZONE WORKSPACE
          Left control rail | Center map hero | Right decision rail
          When mapFocused is true the rails + timeline animate to 0 so the map
          gets the full canvas — overlays surface the key info.
          ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          height: `calc(100vh - ${NAV_H}px)`,
          display: "flex",
          overflow: "hidden",
          borderBottom: "1px solid #DDDDDD",
        }}
      >

        {/* LEFT: compact event control rail */}
        <motion.aside
          initial={false}
          animate={{ width: mapFocused ? 0 : RAIL_L }}
          transition={FOCUS_TRANSITION}
          style={{
            flexShrink: 0,
            borderRight: mapFocused ? "0px" : "1px solid #DDDDDD",
            overflowY: "auto",
            overflowX: "hidden",
            background: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ width: RAIL_L }}>
            <EventPanel />
          </div>
        </motion.aside>

        {/* CENTER: map + docked timeline */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "#F0EDE8" }}>

          {/* Map — fills all available height above timeline */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>

            {/* Compact search overlaid on map — hides when focus mode hides
                the rails so the operator gets a totally clean canvas. */}
            <AnimatePresence>
              {!mapFocused && (
                <motion.div
                  key="search-overlay"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: "absolute",
                    top: appliedPlanId ? 76 : 12,
                    left: 12,
                    width: "min(420px, calc(100% - 200px))",
                    zIndex: 500,
                  }}
                >
                  <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Focus toggle — top-right of the map, always visible */}
            <motion.button
              type="button"
              onClick={() => setMapFocused((v) => !v)}
              title={mapFocused ? "Exit focus (F)" : "Focus map (F)"}
              aria-label={mapFocused ? "Exit map focus mode" : "Enter map focus mode"}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 600,
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0D9488",
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #DDDDDD",
                boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mapFocused ? "min" : "max"}
                  initial={{ opacity: 0, rotate: -45, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 45, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: "inline-flex" }}
                >
                  {mapFocused ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Floating overlay summary — only shown in focus mode. Surfaces the
                stats the operator otherwise reads off the rails (impact totals,
                applied plan, active disruptions). */}
            <AnimatePresence>
              {mapFocused && (
                <FocusOverlay
                  key="focus-overlay"
                  total={schedule.length || stateValues.length}
                  onTime={onTimeCount}
                  delayed={delayedCount}
                  cancelled={cancelledCount}
                  affected={affectedCount}
                  directHit={directHitCount}
                  totalDelayMin={totalDelayMin}
                  appliedPlan={appliedPlan}
                  activeEventCount={activeEvents.length}
                  cascadeTotal={cascadeSummary?.total_affected ?? null}
                />
              )}
            </AnimatePresence>

            <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>

          {/* Docked cascade timeline strip — collapses to 0 in focus mode */}
          <motion.div
            initial={false}
            animate={{ height: mapFocused ? 0 : STRIP_H }}
            transition={FOCUS_TRANSITION}
            style={{
              flexShrink: 0,
              borderTop: mapFocused ? "0px" : "1px solid #DDDDDD",
              background: "#FFFFFF",
              overflow: "hidden",
            }}
          >
            <div style={{ height: STRIP_H }}>
              <CascadeTimeline selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
            </div>
          </motion.div>
        </div>

        {/* RIGHT: recovery decision rail */}
        <motion.aside
          initial={false}
          animate={{ width: mapFocused ? 0 : RAIL_R }}
          transition={FOCUS_TRANSITION}
          style={{
            flexShrink: 0,
            borderLeft: mapFocused ? "0px" : "1px solid #DDDDDD",
            overflowY: "auto",
            overflowX: "hidden",
            background: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ width: RAIL_R }}>
            <RecoveryPlans selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>
        </motion.aside>

      </div>

      {/* ══════════════════════════════════════════════════════════
          BELOW FOLD — secondary analysis panels
          ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 1760,
          margin: "0 auto",
        }}
      >
        {/* ── Below-fold section label ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "#DDDDDD" }} />
          <span style={{
            fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "#A0AEC0", whiteSpace: "nowrap",
          }}>
            Analysis Panels
          </span>
          <div style={{ flex: 1, height: 1, background: "#DDDDDD" }} />
        </div>

        <MyFlights onFlightSelect={handleFlightSelect} />
        <PlanCompare />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1.6fr)",
            gap: 20,
          }}
        >
          <div style={belowCard}><CrewOverbooking /></div>
          <div style={belowCard}><PassengerSolutions /></div>
        </div>
      </div>

    </div>
  )
}

// ─── Focus-mode overlay ─────────────────────────────────────────────────────
// When the rails and timeline are collapsed away, the operator still needs
// to see fleet status and any active disruption / applied plan at a glance.
// This compact card lives top-center of the map and animates in/out smoothly.

function FocusOverlay({
  total, onTime, delayed, cancelled, affected, directHit, totalDelayMin,
  appliedPlan, activeEventCount, cascadeTotal,
}: {
  total: number
  onTime: number
  delayed: number
  cancelled: number
  affected: number
  directHit: number
  totalDelayMin: number
  appliedPlan: ReturnType<typeof useSimulationStore.getState>["recoveryPlans"][number] | null
  activeEventCount: number
  cascadeTotal: number | null
}) {
  const PILL_W = "min(720px, calc(100% - 160px))"
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.94 }}
      transition={{ duration: 0.32, ease: [0.22, 0.9, 0.28, 1] }}
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: PILL_W,
        zIndex: 550,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.96)",
          border: "1px solid #DDDDDD",
          borderRadius: 16,
          boxShadow: "0 12px 36px rgba(2,15,14,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          backdropFilter: "blur(14px)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Mode label */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#0D9488", boxShadow: "0 0 0 3px rgba(13,148,136,0.25)" }}
          />
          <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "#0D9488" }}>
            Focus Mode
          </span>
        </div>

        <span className="hidden md:block w-px h-7" style={{ background: "#E5E7EB" }} />

        {/* Fleet status pills */}
        <FocusStat label="On time" value={onTime} color="#10B981" />
        <FocusStat label="Delayed" value={delayed} color="#F59E0B" />
        <FocusStat label="Cancelled" value={cancelled} color="#EF4444" />

        {affected > 0 && (
          <>
            <span className="hidden md:block w-px h-7" style={{ background: "#E5E7EB" }} />
            <div className="flex items-center gap-2 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#F97316" }} />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Cascade</span>
                <span className="text-[12px] font-mono font-bold text-foreground">
                  {directHit} direct
                  {cascadeTotal != null && cascadeTotal !== directHit && (
                    <span className="text-muted-foreground"> · {cascadeTotal} total</span>
                  )}
                </span>
              </div>
            </div>
            {totalDelayMin > 0 && (
              <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono font-bold" style={{ color: "#EA580C" }}>
                <Clock className="w-3 h-3" />
                +{totalDelayMin >= 60 ? `${(totalDelayMin / 60).toFixed(1)}h` : `${totalDelayMin}m`}
              </div>
            )}
          </>
        )}

        {/* Applied recovery plan badge */}
        {appliedPlan && (
          <>
            <span className="hidden md:block w-px h-7" style={{ background: "#E5E7EB" }} />
            <div
              className="flex items-center gap-2 shrink-0 px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(13,148,136,0.10)",
                border: "1px solid rgba(13,148,136,0.30)",
              }}
            >
              <Activity className="w-3 h-3" style={{ color: "#0D9488" }} />
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "#0F766E" }}>
                Plan {appliedPlan.plan_id} applied
              </span>
              {appliedPlan.cancelled_flights?.length > 0 && (
                <span className="text-[10px] font-bold text-red-600 inline-flex items-center gap-0.5">
                  <X className="w-2.5 h-2.5" /> {appliedPlan.cancelled_flights.length}
                </span>
              )}
              {appliedPlan.delayed_flights?.length > 0 && (
                <span className="text-[10px] font-bold text-orange-600 inline-flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> {appliedPlan.delayed_flights.length}
                </span>
              )}
              {appliedPlan.aircraft_swaps?.length > 0 && (
                <span className="text-[10px] font-bold text-sky-600 inline-flex items-center gap-0.5">
                  <Plane className="w-2.5 h-2.5" /> {appliedPlan.aircraft_swaps.length}
                </span>
              )}
            </div>
          </>
        )}

        {/* Active disruption count when no plan is applied yet */}
        {!appliedPlan && activeEventCount > 0 && (
          <>
            <span className="hidden md:block w-px h-7" style={{ background: "#E5E7EB" }} />
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
              style={{
                background: "rgba(249,115,22,0.10)",
                border: "1px solid rgba(249,115,22,0.30)",
              }}
            >
              <AlertTriangle className="w-3 h-3" style={{ color: "#EA580C" }} />
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "#9A3412" }}>
                {activeEventCount} disruption{activeEventCount !== 1 ? "s" : ""} active
              </span>
            </div>
          </>
        )}

        {/* Total schedule context — pushed to the right */}
        <div className="ml-auto text-[10px] text-muted-foreground/80 shrink-0 hidden lg:block">
          {total.toLocaleString()} scheduled · press <kbd className="px-1 py-0.5 rounded border text-[9px] font-mono bg-white/60">F</kbd> to toggle
        </div>
      </div>
    </motion.div>
  )
}

function FocusStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 0 3px ${color}26` }}
      />
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[12px] font-mono font-bold text-foreground tabular-nums">{value}</span>
      </div>
    </div>
  )
}
