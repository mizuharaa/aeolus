"use client"
import { useCallback, useEffect, useState } from "react"
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
import { apiClient } from "@/lib/api"
import { hydrateAirportTiers } from "@/components/simulator/airports"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { useResizable, ResizeHandle, FloatingPanel } from "@/components/simulator/workspace-chrome"
import { CloudLightning, Waypoints, PanelBottomClose, AlertTriangle } from "lucide-react"

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

const NAV_H  = 60   // top-bar height (see components/simulator/nav.tsx)

// The MAP is now the sized region and the CASCADE TIMELINE takes the remaining
// height — the inversion this layout pass turns on. Measured before: the
// timeline's row viewport was 94px of 871px of content, i.e. 1.96 of 18 rows
// (10.9%), identical at 1280/1440/1920 and at 200% zoom, because every extra
// pixel of viewport went to the basemap. The basemap answers "where", once per
// incident; the Gantt is where cause, propagation and time are simultaneously
// legible, and it is the surface an operator actually reads. So the timeline
// gets flex:1 and the map gets a resizable fixed height.
const MAP_H     = 300 // default map height; drag to taste, persisted
const MAP_H_MIN = 200
const MAP_H_MAX = 720

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
  const [bottomOpen, setBottomOpen] = useState(true)   // cascade timeline
  // Drag the divider to resize the MAP; the timeline absorbs the remainder.
  const mapH = useResizable("aeolus-map-h", MAP_H, MAP_H_MIN, MAP_H_MAX, "bottom")

  // Docked panels take real width, so below this the two of them plus the rail
  // would starve the map (measured: 466px of map at 1280 with both open). Above
  // it there is room for both. Opening one closes the other below the
  // threshold — a structural adaptation, not a hidden element.
  const [narrow, setNarrow] = useState(false)
  // Below this the workspace is too tight for a panel to take width at all —
  // at a 720px viewport (what 200% zoom on a 1440 screen produces) a docked
  // 392px panel plus the rail left the map 227px. Under it the panels go back
  // to being overlays, which is the right trade at that size: covering part of
  // a small map beats shrinking it to nothing.
  const [tight, setTight] = useState(false)
  useEffect(() => {
    const wide = window.matchMedia("(max-width: 1500px)")
    const small = window.matchMedia("(max-width: 900px)")
    const sync = () => { setNarrow(wide.matches); setTight(small.matches) }
    sync()
    wide.addEventListener("change", sync)
    small.addEventListener("change", sync)
    return () => { wide.removeEventListener("change", sync); small.removeEventListener("change", sync) }
  }, [])
  const openLeft = useCallback((v: boolean) => {
    setLeftOpen(v)
    if (v && narrow) setRightOpen(false)
  }, [narrow])
  const openRight = useCallback((v: boolean) => {
    setRightOpen(v)
    if (v && narrow) setLeftOpen(false)
  }, [narrow])

  // Restore prefs.
  useEffect(() => {
    try {
      const wantLeft  = localStorage.getItem("aeolus-left-open") === "1"
      const wantRight = localStorage.getItem("aeolus-right-open") === "1"
      // Restore must obey the same mutual exclusion as openLeft/openRight.
      // It did not, so a reload could put BOTH panels up in overlay mode and
      // they overlapped each other by 122x362 at 720x450 — each is capped
      // against the container and never against its sibling (356 + 392 = 748
      // into 654px). Same class of defect as the docked branch's 128px overlap,
      // reachable by reload rather than resize, which is why fixing the toggle
      // handlers alone did not retire it.
      const tightNow = window.matchMedia("(max-width: 1500px)").matches
      if (localStorage.getItem("aeolus-left-open") !== null) setLeftOpen(wantLeft)
      if (wantRight && !(tightNow && wantLeft)) setRightOpen(true)
      if (localStorage.getItem("aeolus-bottom-open") === "0") setBottomOpen(false)
    } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem("aeolus-left-open",   leftOpen   ? "1" : "0") } catch {} }, [leftOpen])
  useEffect(() => { try { localStorage.setItem("aeolus-right-open",  rightOpen  ? "1" : "0") } catch {} }, [rightOpen])
  useEffect(() => { try { localStorage.setItem("aeolus-bottom-open", bottomOpen ? "1" : "0") } catch {} }, [bottomOpen])

  // Recovery plans arrive for a new disruption → float the Recovery panel out
  // once per event wave (the user can close it; it won't nag again for the
  // same wave). Committing a plan leaves it to the user.
  // The Recovery panel does NOT auto-open. It used to, and combined with the
  // panel defaulting to inspect plan A, that made a full plan analysis appear
  // unbidden with one plan visually dominant — read, reasonably, as "a plan was
  // auto-applied on load". Nothing should look decided until someone decides.
  // The launcher tab carries a count badge instead: discoverable, unmissable,
  // and it asserts nothing about the outcome.

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
  }, [bottomOpen, mapH.size, leftOpen, rightOpen])

  const handleFlightSelect = (id: string | null) => {
    setSelectedFlight(id)
    if (id) setSelectedLiveFlight(null)
  }

  // Boot failures are SURFACED, not swallowed. Every one of these three calls
  // used to end in `.catch(() => {})`, which is how `/network/aircraft` 404'd
  // on every single load for an unknown length of time without anyone noticing
  // — and, worse, why a dispatcher looking at an empty map could not tell "no
  // disruptions" from "the API is down". Both render identically when the
  // failure is silent. Degrading gracefully is right; degrading invisibly is
  // not. `feedErrors` names the feeds that actually failed so the banner can
  // say which, and `bootNonce` lets Retry re-run them.
  const [feedErrors, setFeedErrors] = useState<string[]>([])
  const [bootNonce, setBootNonce] = useState(0)

  useEffect(() => {
    hydrateStaticFromCache()
    let cancelled = false
    const failed: string[] = []
    const note = (feed: string) => (err: unknown) => {
      if (cancelled) return
      failed.push(feed)
      // Kept in the console too: the banner tells the operator something is
      // wrong, the console tells an engineer what.
      console.error(`[aeolus] ${feed} feed failed:`, err)
    }

    const schedule = apiClient
      .get<{ flights?: ScheduledFlight[] } | ScheduledFlight[]>("/simulator/schedule")
      .then((res) => {
        const d = res.data
        const list = Array.isArray(d) ? d : d?.flights
        if (list && list.length) setSchedule(list)
      })
      .catch(note("Schedule"))

    // "/aircraft", not "/network/aircraft" — the latter 404s. The API mounts
    // this router without a prefix (apps/api/src/routes/network.py).
    const fleet = apiClient
      .get<{ aircraft?: FleetAircraft[] }>("/aircraft")
      .then((res) => { const a = res.data?.aircraft; if (a && a.length) setFleet(a) })
      .catch(note("Fleet"))

    // Airport tiers come from the network itself, so adding an airport to the
    // YAML is enough. The bundled tiers are a genuine fallback, so this one
    // degrades quietly in the UI — but it is still reported to the console.
    const airports = apiClient
      .get<{ airports?: { id: string; hub_type?: string }[] }>("/airports")
      .then((res) => hydrateAirportTiers(res.data?.airports))
      .catch(note("Airports"))

    void Promise.allSettled([schedule, fleet, airports]).then(() => {
      if (!cancelled) setFeedErrors(failed)
    })
    return () => { cancelled = true }
  }, [setSchedule, setFleet, hydrateStaticFromCache, bootNonce])

  return (
    // overflow:hidden + fixed height. Measured before: 552px of a 1352px
    // document (40.8%) sat below the fold at 1280x800, and scrolling to reach
    // it took BOTH the map and the cascade timeline entirely off screen. An ops
    // console must not be able to scroll away mid-incident, so the shell is now
    // exactly one viewport and every region scrolls internally. The two things
    // that lived down there moved out: the watchlist to its own route, and the
    // 5-tile deep-link strip was deleted outright (4 of its 5 tiles were second
    // copies of rail entries that are already permanently on screen).
    <div style={{ background: "var(--ae-bg)", height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <DashboardLoader />

      {/* Plain flex child, no sticky and no z-index. The nav needed z-[700] to
          win against panels that could ride up over it once the page scrolled;
          the shell no longer scrolls and the panels are docked tracks, so the
          collision it was defending against cannot happen. */}
      <div style={{ flexShrink: 0 }}>
        <SimulatorNav isConnected={isConnected} affectedCount={activeEvents.length} />
      </div>

      {/* Degraded-feed banner. role="status" not "alert": the console is still
          usable on cached data, so this informs without seizing focus mid-task.
          It names WHICH feed failed, because "something went wrong" leaves the
          operator unable to judge whether what they are looking at is
          trustworthy — and it offers the retry rather than requiring a reload
          that would also discard their panel layout and map viewport. */}
      {feedErrors.length > 0 && (
        <div
          role="status"
          style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: sp.sm,
            padding: `${sp.xs}px ${sp.md}px`,
            background: "var(--ae-amber-bg)",
            borderBottom: `1px solid var(--ae-amber)`,
            color: c.ink, fontFamily: ff.body, fontSize: 13,
          }}
        >
          <AlertTriangle style={{ width: 15, height: 15, color: "var(--ae-amber-ink)", flexShrink: 0 }} strokeWidth={2} />
          <span>
            <strong style={{ fontWeight: 650 }}>
              {feedErrors.join(" and ")} {feedErrors.length > 1 ? "feeds are" : "feed is"} unavailable.
            </strong>{" "}
            Showing the last known data — figures may be stale.
          </span>
          <button
            type="button"
            onClick={() => { setFeedErrors([]); setBootNonce((n) => n + 1) }}
            style={{
              marginLeft: "auto", minHeight: 32, padding: `0 ${sp.sm}px`,
              fontSize: 12.5, fontWeight: 600, fontFamily: ff.body,
              borderRadius: r.sm, border: `1px solid var(--ae-amber-ink)`,
              background: "transparent", color: "var(--ae-amber-ink)", cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Workspace ────────────────────────────────────────────────────
          A fixed three-track row: Events | (map over timeline) | Recovery.

          Two inversions from the previous shell, both driven by measurement.

          1. The panels are DOCKED TRACKS, not floating overlays. As overlays
             at z-640 they covered 62.4% of the map at 1280 with both open (the
             steady state during a live disruption), 75.8% at 200% zoom, and at
             200% they overlapped EACH OTHER by 128px because each was capped
             against the viewport but never against its sibling. Docked, they
             cannot overlap anything, the map keeps every pixel it is given,
             and the z-index arbitration disappears.
          2. The CASCADE TIMELINE takes the remaining height and the MAP is the
             sized region. Before, the timeline showed 94px of 871px of content
             — 1.96 of 18 rows, 89.2% hidden — identically at 1280/1440/1920,
             because all extra viewport went to the basemap. The Gantt is where
             cause, propagation and time are legible at once; the map answers
             "where", once per incident. Drag the divider to rebalance. */}
      {/* <main>, not <div>. The console had NO main landmark and zero headings
          across 78 tab stops, so a screen-reader user had no document outline
          to navigate and "skip to main content" had nowhere to go. */}
      <main
        style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", overflow: "hidden" }}
      >
        {/* Events — docked track, left */}
        <FloatingPanel
          side="left" open={leftOpen} accent={EVENT_ACCENT} docked={!tight}
          title="Events"
          /* CloudLightning, not Zap: Zap reads "energy/instant", and the
             event vocabulary this panel triggers is weather, ATC, crew and
             mechanical disruption. */
          icon={<CloudLightning style={{ width: 15, height: 15 }} strokeWidth={2} />}
          onOpen={() => openLeft(true)} onClose={() => openLeft(false)}
        >
          <EventPanel />
        </FloatingPanel>

        {/* Centre column — map over timeline */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {/* MAP — sized when the timeline is open, greedy when it is collapsed */}
          <div
            style={{
              position: "relative",
              // flexShrink 1 + maxHeight, not a rigid basis: at a 450px-tall
              // viewport (200% zoom) a fixed 300px map left the timeline 12px
              // of scroller. The map now yields to the timeline's minHeight
              // instead of starving it, so the hero stays usable at any height.
              flex: bottomOpen ? `0 1 ${mapH.size}px` : "1 1 auto",
              maxHeight: bottomOpen ? "62%" : undefined,
              minHeight: bottomOpen ? 140 : 0,
              background: c.surfaceSoft,
            }}
          >
            <div style={{ position: "absolute", inset: 0 }}>
              <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
            </div>

            {/* Search — centred in the map, which no panel covers any more, so
                its width no longer has to be computed around the panel edges.
                The old `clamp(190px, calc(100% - 810px), 430px)` collapsed to
                its 190px floor below ~1200px of map width and then sat 41%
                underneath the two panels. */}
            <div
              style={{
                position: "absolute",
                top: appliedPlanId ? 70 : sp.sm,
                left: "50%",
                transform: "translateX(-50%)",
                width: "min(430px, calc(100% - 120px))",
                zIndex: 520,
                transition: "top 240ms ease",
              }}
            >
              <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
            </div>
          </div>

          {/* Divider — drags the MAP's height; the timeline absorbs the rest */}
          {bottomOpen && <ResizeHandle side="bottom" onPointerDown={mapH.onPointerDown} />}

          {/* CASCADE TIMELINE — the hero surface */}
          <div
            style={{
              // basis 0, not auto: with `auto` the timeline claimed its full
              // CONTENT height (871px of rows) as its flex basis, which put the
              // row into overflow and shrank the map to its 140px floor at
              // every viewport. Basis 0 makes it take exactly the remainder.
              flex: bottomOpen ? "1 1 0%" : "0 0 30px",
              // ~4 rows of Gantt after its own 98px of header+axis chrome.
              minHeight: bottomOpen ? 190 : 30,
              borderTop: `1px solid ${c.hairline}`,
              background: c.canvas,
              overflow: "hidden",
            }}
          >
            {bottomOpen ? (
              <div style={{ height: "100%", position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setBottomOpen(false)}
                  aria-label="Collapse timeline"
                  title="Collapse timeline"
                  style={{
                    position: "absolute", top: sp.xs, right: sp.sm, zIndex: 30,
                    width: 36, height: 36, borderRadius: r.sm,
                    border: `1px solid ${c.hairline}`, background: "var(--ae-surface)",
                    color: c.muted, cursor: "pointer", display: "inline-flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <PanelBottomClose style={{ width: 14, height: 14 }} strokeWidth={2} />
                </button>
                <CascadeTimeline selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBottomOpen(true)}
                style={{
                  width: "100%", height: 30, display: "flex", alignItems: "center", gap: sp.xs,
                  padding: `0 ${sp.md}px`, border: "none", background: "transparent",
                  color: c.body, cursor: "pointer", fontFamily: ff.mono, fontSize: 10.5,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                }}
              >
                <PanelBottomClose style={{ width: 13, height: 13, transform: "rotate(180deg)" }} strokeWidth={2} />
                Cascade timeline — expand
              </button>
            )}
          </div>
        </div>

        {/* Recovery — docked track, right */}
        <FloatingPanel
          side="right" open={rightOpen} accent={RECOVERY_ACCENT} width={392} docked={!tight}
          title="Recovery"
          /* Waypoints, not LineChart: recovery is aircraft swaps, crew
             reassignment and passenger rebooking — routing, not analytics. */
          icon={<Waypoints style={{ width: 15, height: 15 }} strokeWidth={2} />}
          onOpen={() => openRight(true)} onClose={() => openRight(false)}
          badge={recoveryPlans.length > 0 && !appliedPlanId ? recoveryPlans.length : undefined}
        >
          <RecoveryPlans selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
        </FloatingPanel>
      </main>

    </div>
  )
}
