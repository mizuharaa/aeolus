"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, X } from "lucide-react"
import { useSimulationStore, type ScheduledFlight, type FleetAircraft } from "@/stores/simulation"
import { useWebSocket } from "@/lib/websocket"
import { EventPanel } from "@/components/simulator/event-panel"
import { CascadeTimeline } from "@/components/simulator/cascade-timeline"
import { RecoveryPlans } from "@/components/simulator/recovery-plans"
import { SimulatorNav } from "@/components/simulator/nav"
import { AgentBubble } from "@/components/simulator/agent-bubble"
import { DashboardLoader } from "@/components/simulator/dashboard-loader"
import { FlightSearch } from "@/components/simulator/flight-search"
import { MyFlights } from "@/components/simulator/my-flights"
import { apiClient } from "@/lib/api"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { Eyebrow, Hairline } from "@/components/ds/primitives"
import { useResizable, ResizeHandle, FloatingPanel } from "@/components/simulator/workspace-chrome"
import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Leaf, Network as NetworkIcon, Users as UsersIcon, GitCompareArrows, ShieldCheck, Zap, LineChart, PanelBottomClose, type LucideIcon } from "lucide-react"

const FlightMap = dynamic(() => import("@/components/simulator/flight-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: c.surfaceSoft }}>
      <div className="flex flex-col items-center gap-3">
        <div style={{ width: 40, height: 40, borderRadius: r.lg, background: c.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: c.onPrimary }} />
        </div>
        <span style={{ fontFamily: ff.body, fontSize: 14, fontWeight: 500, color: c.body }}>Loading map…</span>
      </div>
    </div>
  ),
})

const NAV_H   = 60   // top-bar height (see components/simulator/nav.tsx)
const STRIP_H = 192  // docked timeline height

// Panel pigments — Events = gold (disruption), Recovery = plum (identity).
const EVENT_ACCENT = "#B8863C"
const RECOVERY_ACCENT = "#5B3FA8"
const EASE = [0.22, 0.9, 0.28, 1] as const

export default function SimulatorPage() {
  const {
    flightStates, schedule, setSchedule, setFleet, setSelectedLiveFlight,
    appliedPlanId, recoveryPlans, activeEvents, selectedLiveFlight,
    hydrateStaticFromCache,
  } = useSimulationStore()
  const { isConnected } = useWebSocket()
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null)

  // Events + Recovery are now floating OVERLAY panels over a full-bleed map —
  // not docked columns that shrink it. Open = the panel floats; closed = a
  // slim launcher tab on that edge. The map never reflows, so there's no
  // panel-vs-overlay collision and the map paints once and stays put.
  const [leftOpen, setLeftOpen]     = useState(true)   // Events
  const [rightOpen, setRightOpen]   = useState(false)  // Recovery (auto-opens on plans)
  const [bottomOpen, setBottomOpen] = useState(true)   // cascade timeline (still docked)
  const bottom = useResizable("aeolus-strip-h", STRIP_H, 120, 340, "bottom")

  // Restore prefs.
  useEffect(() => {
    try {
      if (localStorage.getItem("aeolus-left-open")   === "0") setLeftOpen(false)
      if (localStorage.getItem("aeolus-left-open")   === "1") setLeftOpen(true)
      if (localStorage.getItem("aeolus-right-open")  === "1") setRightOpen(true)
      if (localStorage.getItem("aeolus-bottom-open") === "0") setBottomOpen(false)
    } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem("aeolus-left-open",   leftOpen   ? "1" : "0") } catch {} }, [leftOpen])
  useEffect(() => { try { localStorage.setItem("aeolus-right-open",  rightOpen  ? "1" : "0") } catch {} }, [rightOpen])
  useEffect(() => { try { localStorage.setItem("aeolus-bottom-open", bottomOpen ? "1" : "0") } catch {} }, [bottomOpen])

  // Recovery plans arrive for a new disruption → float the Recovery panel out
  // once per event wave (the user can close it; it won't nag again for the
  // same wave). Committing a plan leaves it to the user.
  const autoOpenedFor = useRef("")
  useEffect(() => {
    const sig = activeEvents.map((e) => e.id).sort().join("|")
    if (sig && recoveryPlans.length > 0 && !appliedPlanId && sig !== autoOpenedFor.current) {
      autoOpenedFor.current = sig
      setRightOpen(true)
    }
    if (!sig) autoOpenedFor.current = ""
  }, [activeEvents, recoveryPlans.length, appliedPlanId])

  // Inspecting a flight (sim or live) closes the drawers so the detail card
  // owns the map edge with no overlap.
  useEffect(() => {
    if (selectedFlight || selectedLiveFlight) { setLeftOpen(false); setRightOpen(false) }
  }, [selectedFlight, selectedLiveFlight])

  // F toggles both drawers (quick "clear the map").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      e.preventDefault()
      const anyOpen = leftOpen || rightOpen
      setLeftOpen(!anyOpen); setRightOpen(!anyOpen)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [leftOpen, rightOpen])

  // Nudge Leaflet only when the timeline dock resizes (drawers overlay, so
  // they never change the map's box).
  useEffect(() => {
    const t1 = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 220)
    const t2 = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 480)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [bottomOpen, bottom.size])

  const handleFlightSelect = (id: string | null) => {
    setSelectedFlight(id)
    if (id) setSelectedLiveFlight(null)
  }

  // Paint instantly from cache, then refresh from the API — kills the long
  // cold boot where the map sat empty waiting on the schedule roundtrip.
  useEffect(() => {
    hydrateStaticFromCache()
    apiClient
      .get<{ flights?: ScheduledFlight[] } | ScheduledFlight[]>("/simulator/schedule")
      .then((res) => {
        const d = res.data
        const list = Array.isArray(d) ? d : d?.flights
        if (list && list.length) setSchedule(list)
      })
      .catch(() => {})
    apiClient
      .get<{ aircraft?: FleetAircraft[] }>("/network/aircraft")
      .then((res) => { const a = res.data?.aircraft; if (a && a.length) setFleet(a) })
      .catch(() => {})
  }, [setSchedule, setFleet, hydrateStaticFromCache])

  return (
    <div style={{ background: "var(--ae-bg)", minHeight: "100vh" }}>
      <DashboardLoader />

      <div className="sticky top-0 z-50">
        <SimulatorNav isConnected={isConnected} affectedCount={activeEvents.length} />
      </div>

      <AgentBubble />

      {/* ── Workspace: full-bleed map with floating panels + a docked timeline ── */}
      <div
        style={{
          height: `calc(100vh - ${NAV_H}px)`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        {/* MAP AREA — the map fills it; every panel floats above as its own layer */}
        <div style={{ flex: 1, position: "relative", minHeight: 0, background: c.surfaceSoft }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>

          {/* Search — top centre, sized to the lane BETWEEN the two edge
              panels so an open Events/Recovery panel never covers it */}
          <div
            style={{
              position: "absolute",
              top: appliedPlanId ? 70 : 14,
              left: "50%",
              transform: "translateX(-50%)",
              width: "clamp(190px, calc(100% - 810px), 430px)",
              zIndex: 520,
              transition: "top 240ms ease",
            }}
          >
            <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
          </div>

          {/* Events — floating overlay, left */}
          <FloatingPanel
            side="left" open={leftOpen} accent={EVENT_ACCENT}
            title="Events"
            icon={<Zap style={{ width: 15, height: 15 }} strokeWidth={2} />}
            onOpen={() => setLeftOpen(true)} onClose={() => setLeftOpen(false)}
          >
            <EventPanel />
          </FloatingPanel>

          {/* Recovery — floating overlay, right */}
          <FloatingPanel
            side="right" open={rightOpen} accent={RECOVERY_ACCENT} width={392}
            title="Recovery"
            icon={<LineChart style={{ width: 15, height: 15 }} strokeWidth={2} />}
            onOpen={() => setRightOpen(true)} onClose={() => setRightOpen(false)}
            badge={recoveryPlans.length > 0 && !appliedPlanId ? recoveryPlans.length : undefined}
          >
            <RecoveryPlans selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </FloatingPanel>
        </div>

        {/* Docked cascade timeline — resizable height + collapsible */}
        {bottomOpen && <ResizeHandle side="bottom" onPointerDown={bottom.onPointerDown} />}
        <div
          style={{
            flexShrink: 0,
            height: bottomOpen ? bottom.size : 30,
            borderTop: `1px solid ${c.hairline}`,
            background: c.canvas,
            overflow: "hidden",
            transition: bottom.dragging ? "none" : "height 240ms cubic-bezier(0.22,0.9,0.28,1)",
          }}
        >
          {bottomOpen ? (
            <div style={{ height: bottom.size, position: "relative" }}>
              <button
                type="button"
                onClick={() => setBottomOpen(false)}
                aria-label="Collapse timeline"
                title="Collapse timeline"
                style={{
                  position: "absolute", top: 8, right: 12, zIndex: 30,
                  width: 26, height: 26, borderRadius: 7,
                  border: `1px solid ${c.hairline}`, background: "var(--ae-surface)",
                  color: c.muted, cursor: "pointer", display: "inline-flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <PanelBottomClose style={{ width: 14, height: 14 }} strokeWidth={1.9} />
              </button>
              <CascadeTimeline selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBottomOpen(true)}
              style={{
                width: "100%", height: 30, display: "flex", alignItems: "center", gap: 8,
                padding: "0 16px", border: "none", background: "transparent",
                color: c.muted, cursor: "pointer", fontFamily: ff.mono, fontSize: 10.5,
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 99, background: EVENT_ACCENT }} />
              Cascade timeline — click to expand
            </button>
          )}
        </div>
      </div>

      {/* ── Below fold — continuing context ── */}
      <div style={{ padding: sp.lg, display: "flex", flexDirection: "column", gap: sp.lg, maxWidth: 1760, margin: "0 auto" }}>
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
function DeepLinkStrip() {
  const tiles: { href: string; Icon: LucideIcon; label: string; sub: string }[] = [
    { href: "/simulator/plans/compare", Icon: GitCompareArrows, label: "Compare plans", sub: "Side-by-side cost / pax / FAR 117 / carbon" },
    { href: "/simulator/crew", Icon: ShieldCheck, label: "Crew shortage", sub: "FAR 117 legality + max-coverage MILP" },
    { href: "/simulator/passengers", Icon: UsersIcon, label: "Passenger solutions", sub: "Rebooking · hotel · DOT 261 vouchers" },
    { href: "/simulator/carbon", Icon: Leaf, label: "Carbon dashboard", sub: "Net CO₂ ledger priced under EU ETS" },
    { href: "/simulator/stress-test", Icon: NetworkIcon, label: "Stress test", sub: "Monte-Carlo network vulnerability sweep" },
  ]
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: sp.md }}>
      {tiles.map((t) => (
        <Link
          key={t.href}
          href={t.href as Route}
          style={{
            textDecoration: "none", display: "flex", flexDirection: "column", gap: 8,
            padding: sp.md, borderRadius: r.md, background: c.canvas,
            border: `1px solid ${c.hairline}`, color: c.ink, transition: "border-color 150ms ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <t.Icon style={{ width: 16, height: 16, color: c.muted }} strokeWidth={1.75} />
            <ArrowRight style={{ width: 13, height: 13, color: c.muted }} strokeWidth={1.75} />
          </div>
          <div style={{ fontFamily: ff.body, fontSize: 14, fontWeight: 550, color: c.ink, lineHeight: 1.3 }}>{t.label}</div>
          <div style={{ fontFamily: ff.body, fontSize: 11.5, color: c.muted, lineHeight: 1.5 }}>{t.sub}</div>
        </Link>
      ))}
    </div>
  )
}
