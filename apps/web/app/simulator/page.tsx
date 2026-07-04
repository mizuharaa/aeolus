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
import { apiClient } from "@/lib/api"
import { c, ff, r, sp, sh } from "@/lib/design-tokens"
import { Eyebrow, Hairline } from "@/components/ds/primitives"
import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Leaf, Network as NetworkIcon, Users as UsersIcon, GitCompareArrows, ShieldCheck } from "lucide-react"

const FlightMap = dynamic(() => import("@/components/simulator/flight-map"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: c.surfaceSoft }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: r.lg,
            background: c.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: c.onPrimary }} />
        </div>
        <span style={{ fontFamily: ff.body, fontSize: 14, fontWeight: 500, color: c.body }}>
          Loading map…
        </span>
      </div>
    </div>
  ),
})

const NAV_H   = 60   // top-bar height (see components/simulator/nav.tsx)
const RAIL_L  = 308  // left control rail width
const RAIL_R  = 340  // right decision rail width
const STRIP_H = 192  // docked timeline height

// Smooth motion preset shared by every collapse-driven element so the rails,
// timeline, and overlay card all glide in unison rather than racing each other.
const FOCUS_TRANSITION = { duration: 0.42, ease: [0.22, 0.9, 0.28, 1] as const }

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
    // Light register — the simulator runs on the paper/teal/matcha palette.
    <div style={{ background: "var(--ae-bg)", minHeight: "100vh" }}>

      {/* ── Sticky top nav (see components/simulator/nav.tsx) ── */}
      <div className="sticky top-0 z-50">
        <SimulatorNav isConnected={isConnected} affectedCount={affectedCount} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN 3-ZONE WORKSPACE
          Left control rail | Center map hero | Right decision rail
          ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          height: `calc(100vh - ${NAV_H}px)`,
          display: "flex",
          overflow: "hidden",
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >

        {/* LEFT: compact event control rail */}
        <motion.aside
          initial={false}
          animate={{ width: mapFocused ? 0 : RAIL_L }}
          transition={FOCUS_TRANSITION}
          style={{
            flexShrink: 0,
            borderRight: mapFocused ? "0px" : `1px solid ${c.hairline}`,
            overflowY: "auto",
            overflowX: "hidden",
            background: c.canvas,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ width: RAIL_L }}>
            <EventPanel />
          </div>
        </motion.aside>

        {/* CENTER: map + docked timeline */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: c.surfaceSoft }}>

          {/* Map — fills all available height above timeline */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>

            {/* Compact search overlaid on map */}
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

            {/* Focus toggle — top-right of map. Near-black, white canvas, hairline. */}
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
                width: 38,
                height: 38,
                borderRadius: r.md,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: c.ink,
                background: "rgba(250,250,246,0.92)",
                border: `1px solid ${c.hairline}`,
                boxShadow: sh.cardElev,
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

            {/* Floating overlay summary — only shown in focus mode. */}
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
              borderTop: mapFocused ? "0px" : `1px solid ${c.hairline}`,
              background: c.canvas,
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
            borderLeft: mapFocused ? "0px" : `1px solid ${c.hairline}`,
            overflowY: "auto",
            overflowX: "hidden",
            background: c.canvas,
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
          BELOW FOLD — operator's continuing-context summary.
          Slice 3 moved heavyweight analysis panels (Crew, Passengers,
          PlanCompare, Carbon, Stress test) into their own dedicated
          routes. The simulator surface now keeps only the always-on
          "my flights" tracker plus a deep-link strip into those routes.
          ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          padding: sp.lg,
          display: "flex",
          flexDirection: "column",
          gap: sp.lg,
          maxWidth: 1760,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: sp.sm }}>
          <Hairline style={{ flex: 1 }} />
          <Eyebrow>Continuing Context</Eyebrow>
          <Hairline style={{ flex: 1 }} />
        </div>

        <MyFlights onFlightSelect={handleFlightSelect} />

        <DeepLinkStrip />
      </div>

    </div>
  )
}

// ─── Deep-link strip ─────────────────────────────────────────────────────
// Surfaces every secondary analysis route the user might need next, with
// the same surface tokens as the rest of the dashboard. This replaces the
// embedded heavy panels that used to live below the fold.

function DeepLinkStrip() {
  const tiles = [
    {
      href: "/simulator/plans/compare",
      Icon: GitCompareArrows,
      label: "Compare plans",
      sub: "Side-by-side cost / pax / FAR 117 / carbon",
    },
    {
      href: "/simulator/crew",
      Icon: ShieldCheck,
      label: "Crew shortage",
      sub: "FAR 117 legality + max-coverage MILP",
    },
    {
      href: "/simulator/passengers",
      Icon: UsersIcon,
      label: "Passenger solutions",
      sub: "Rebooking · hotel · DOT 261 vouchers",
    },
    {
      href: "/simulator/carbon",
      Icon: Leaf,
      label: "Carbon dashboard",
      sub: "Net CO\u2082 ledger priced under EU ETS",
    },
    {
      href: "/simulator/stress-test",
      Icon: NetworkIcon,
      label: "Stress test",
      sub: "Monte-Carlo network vulnerability sweep",
    },
  ]
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: sp.md,
      }}
    >
      {tiles.map((t) => (
        <Link
          key={t.href}
          href={t.href as Route}
          style={{
            textDecoration: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: sp.md,
            borderRadius: r.md,
            background: c.canvas,
            border: `1px solid ${c.hairline}`,
            color: c.ink,
            transition: "border-color 150ms ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <t.Icon style={{ width: 16, height: 16, color: c.muted }} strokeWidth={1.75} />
            <ArrowRight style={{ width: 13, height: 13, color: c.muted }} strokeWidth={1.75} />
          </div>
          <div style={{ fontFamily: ff.body, fontSize: 14, fontWeight: 550, color: c.ink, lineHeight: 1.3 }}>
            {t.label}
          </div>
          <div style={{ fontFamily: ff.body, fontSize: 11.5, color: c.muted, lineHeight: 1.5 }}>
            {t.sub}
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Focus-mode overlay ─────────────────────────────────────────────────────
// Compact glass card that surfaces fleet status when the rails collapse.
// Lives top-center of the map in focus mode.

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
          background: "rgba(250,250,246,0.94)",
          border: `1px solid ${c.hairline}`,
          borderRadius: r.lg,
          boxShadow: sh.overlay,
          backdropFilter: "blur(14px)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          fontFamily: ff.body,
        }}
      >
        {/* Mode label */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--ae-teal)" }}
          />
          <Eyebrow color={c.ink}>Focus mode</Eyebrow>
        </div>

        <span className="hidden md:block w-px h-7" style={{ background: c.hairline }} />

        {/* Fleet status pills — semantic palette: forest / peach / coral */}
        <FocusStat label="On time"   value={onTime}    palette={c.statusOnTime} />
        <FocusStat label="Delayed"   value={delayed}   palette={c.statusDelayed} />
        <FocusStat label="Cancelled" value={cancelled} palette={c.statusCancelled} />

        {affected > 0 && (
          <>
            <span className="hidden md:block w-px h-7" style={{ background: c.hairline }} />
            <div className="flex items-center gap-2 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: c.cascadeDirect }} />
              <div className="flex flex-col leading-tight">
                <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: c.muted }}>
                  Cascade
                </span>
                <span style={{ fontSize: 12, fontFamily: ff.mono, fontWeight: 600, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
                  {directHit} direct
                  {cascadeTotal != null && cascadeTotal !== directHit && (
                    <span style={{ color: c.muted }}> · {cascadeTotal} total</span>
                  )}
                </span>
              </div>
            </div>
            {totalDelayMin > 0 && (
              <div
                className="flex items-center gap-1.5 shrink-0"
                style={{ fontSize: 11, fontFamily: ff.mono, fontWeight: 600, color: c.statusDelayed.ink }}
              >
                <Clock className="w-3 h-3" />
                +{totalDelayMin >= 60 ? `${(totalDelayMin / 60).toFixed(1)}h` : `${totalDelayMin}m`}
              </div>
            )}
          </>
        )}

        {/* Applied recovery plan badge */}
        {appliedPlan && (
          <>
            <span className="hidden md:block w-px h-7" style={{ background: c.hairline }} />
            <div
              className="flex items-center gap-2 shrink-0"
              style={{
                padding: "5px 10px",
                borderRadius: r.pill,
                background: c.statusRecovered.bg,
                color: c.statusRecovered.ink,
              }}
            >
              <Activity className="w-3 h-3" />
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Plan {appliedPlan.plan_id} applied
              </span>
              {appliedPlan.cancelled_flights?.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: c.signatureCoral, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <X className="w-2.5 h-2.5" /> {appliedPlan.cancelled_flights.length}
                </span>
              )}
              {appliedPlan.delayed_flights?.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: c.statusDelayed.ink, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <Clock className="w-2.5 h-2.5" /> {appliedPlan.delayed_flights.length}
                </span>
              )}
              {appliedPlan.aircraft_swaps?.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: c.link, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <Plane className="w-2.5 h-2.5" /> {appliedPlan.aircraft_swaps.length}
                </span>
              )}
            </div>
          </>
        )}

        {/* Active disruption count when no plan is applied yet */}
        {!appliedPlan && activeEventCount > 0 && (
          <>
            <span className="hidden md:block w-px h-7" style={{ background: c.hairline }} />
            <div
              className="flex items-center gap-1.5 shrink-0"
              style={{
                padding: "5px 10px",
                borderRadius: r.pill,
                background: c.statusDelayed.bg,
                color: c.statusDelayed.ink,
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {activeEventCount} disruption{activeEventCount !== 1 ? "s" : ""} active
              </span>
            </div>
          </>
        )}

        {/* Total schedule context — pushed to the right */}
        <div
          className="ml-auto shrink-0 hidden lg:block"
          style={{ fontSize: 11, color: c.muted }}
        >
          {total.toLocaleString()} scheduled · press{" "}
          <kbd
            style={{
              padding: "1px 4px",
              borderRadius: r.xs,
              border: `1px solid ${c.hairline}`,
              fontSize: 9,
              fontFamily: ff.mono,
              background: "var(--ae-surface-2)",
              color: c.ink,
            }}
          >
            F
          </kbd>{" "}
          to toggle
        </div>
      </div>
    </motion.div>
  )
}

function FocusStat({
  label,
  value,
  palette,
}: {
  label: string
  value: number
  palette: { ink: string; bg: string; dot: string }
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: palette.dot }}
      />
      <div className="flex flex-col leading-tight">
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: c.muted,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontFamily: ff.mono,
            fontWeight: 600,
            color: c.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  )
}
