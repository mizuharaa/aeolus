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
import { hydrateAirportTiers } from "@/components/simulator/airports"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { Eyebrow, Hairline } from "@/components/ds/primitives"
import { useResizable, ResizeHandle, FloatingPanel } from "@/components/simulator/workspace-chrome"
import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Leaf, Users as UsersIcon, UserRound, Gauge, GitCompareArrows, CloudLightning, Waypoints, PanelBottomClose, type LucideIcon } from "lucide-react"

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
    // "/aircraft", not "/network/aircraft" — the latter 404s on every load,
    // so the fleet silently never arrived. The API mounts this router without
    // a prefix (apps/api/src/routes/network.py).
    apiClient
      .get<{ aircraft?: FleetAircraft[] }>("/aircraft")
      .then((res) => { const a = res.data?.aircraft; if (a && a.length) setFleet(a) })
      .catch(() => {})
    // Airport tiers come from the network itself, so adding an airport to the
    // YAML is enough — nothing here needs editing. Falls back to the bundled
    // tiers if the call fails, which is why nothing is awaited on it.
    apiClient
      .get<{ airports?: { id: string; hub_type?: string }[] }>("/airports")
      .then((res) => hydrateAirportTiers(res.data?.airports))
      .catch(() => {})
  }, [setSchedule, setFleet, hydrateStaticFromCache])

  return (
    <div style={{ background: "var(--ae-bg)", minHeight: "100vh" }}>
      <DashboardLoader />

      {/* z-[700], not z-50. The floating panels are absolutely positioned
          INSIDE the workspace at z-640, and the workspace scrolls, so at
          ~60px of scroll a panel rode up over the sticky nav and hid LIVE,
          the ops-feed bell, the fleet counters and Reset — while putting the
          panel's Commit button within ~14px of where Reset had been. Two
          opposite-meaning controls at one coordinate, at the highest-stakes
          moment in the product. The nav now always wins. */}
      <div className="sticky top-0 z-[700]">
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
            /* CloudLightning, not Zap: Zap reads "energy/instant", and the
               event vocabulary this panel triggers is weather, ATC, crew and
               mechanical disruption. */
            icon={<CloudLightning style={{ width: 15, height: 15 }} strokeWidth={2} />}
            onOpen={() => setLeftOpen(true)} onClose={() => setLeftOpen(false)}
          >
            <EventPanel />
          </FloatingPanel>

          {/* Recovery — floating overlay, right */}
          <FloatingPanel
            side="right" open={rightOpen} accent={RECOVERY_ACCENT} width={392}
            title="Recovery"
            /* Waypoints, not LineChart: recovery is aircraft swaps, crew
               reassignment and passenger rebooking — routing, not analytics. */
            icon={<Waypoints style={{ width: 15, height: 15 }} strokeWidth={2} />}
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
  // Icons MUST match the rail's glyph for the same route (rail.tsx:47-64).
  // They didn't: crew was ShieldCheck here and Users there, passengers was
  // Users here and UserRound there, stress-test was Network here and Gauge
  // there. So the rail's icon for Crew was this strip's icon for Passengers —
  // on the same screen, which is actively misleading rather than merely
  // inconsistent. The rail is the persistent nav, so it is canonical.
  const tiles: { href: string; Icon: LucideIcon; label: string; sub: string }[] = [
    { href: "/simulator/plans/compare", Icon: GitCompareArrows, label: "Compare plans", sub: "Side-by-side cost / pax / FAR 117 / carbon" },
    { href: "/simulator/crew", Icon: UsersIcon, label: "Crew shortage", sub: "FAR 117 legality + max-coverage MILP" },
    { href: "/simulator/passengers", Icon: UserRound, label: "Passenger solutions", sub: "Rebooking · hotel · DOT 261 vouchers" },
    { href: "/simulator/carbon", Icon: Leaf, label: "Carbon dashboard", sub: "Net CO₂ ledger priced under EU ETS" },
    { href: "/simulator/stress-test", Icon: Gauge, label: "Stress test", sub: "Monte-Carlo network vulnerability sweep" },
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
