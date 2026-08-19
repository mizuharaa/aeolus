"use client"
/**
 * THE BOARD — /simulator, rebuilt 2026-08-17 as the Hairline Mosaic.
 *
 * Direction contract: the HTML comment at the top of `app/layout.tsx`
 * (seed 688f3053). Primitives: `components/simulator/board.tsx`.
 *
 * ── What changed, and what deliberately did not ───────────────────────────
 *
 * The TOPOLOGY is inherited, not reinvented: rail · context column · (map over
 * cascade rail). That arrangement was arrived at by measurement — 16 colliding
 * pairs at 1440 and 58 at 390 under the old two-opposing-docks shell, 3 after —
 * and a visual rebuild is not a reason to relitigate a result that was earned
 * with numbers. What changed is the MATERIAL: modules instead of floating
 * cards, hairlines instead of shadows, a white board instead of a near-black
 * one, and colour demoted from fills to edges and marks.
 *
 * Regions are packed EDGE TO EDGE and each drops the rule on the side a
 * neighbour already supplies. A dense grid that draws both sides of every seam
 * renders 2px double-rules throughout, and that doubling is the difference
 * between a board that reads as dense and one that reads as a cage.
 *
 * ── The resize fix ────────────────────────────────────────────────────────
 *
 * The timeline handle is `side="top"`, not `side="bottom"`. The sized region
 * is BELOW the handle, so dragging down must shrink it and keep the divider
 * under the pointer. It had been `bottom` since the 2026-08-16 reversal moved
 * the sized region across the handle without changing the sign, which is the
 * "inverted axis" the divider has been reported for. See `deltaFor` in
 * workspace-chrome.tsx.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2, AlertTriangle, PanelBottomOpen, PanelLeftClose, Layers } from "lucide-react"
import { useSimulationStore, type ScheduledFlight, type FleetAircraft } from "@/stores/simulation"
import { useWebSocket } from "@/lib/websocket"
import { EventPanel } from "@/components/simulator/event-panel"
import { CascadeTimeline } from "@/components/simulator/cascade-timeline"
import { RecoveryDetail } from "@/components/simulator/recovery-detail"
import { BoardBar } from "@/components/simulator/top-bar"
import { DashboardLoader } from "@/components/simulator/dashboard-loader"
import { FlightSearch } from "@/components/simulator/flight-search"
import { FlightDetailPanel } from "@/components/simulator/flight-detail"
import { ContextColumn, AnnouncementCard, type ContextTab } from "@/components/simulator/context-column"
import { apiClient } from "@/lib/api"
import { hydrateAirportTiers } from "@/components/simulator/airports"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { useResizable, ResizeHandle } from "@/components/simulator/workspace-chrome"
import { RULE, Module, Fringe, Chip } from "@/components/simulator/board"
import { PlanCompareBoard } from "@/components/simulator/plan-compare-board"

const FlightMap = dynamic(() => import("@/components/simulator/flight-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: c.surfaceSoft }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: sp.xs }}>
        <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: c.muted }} />
        <span style={{ fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: c.muted }}>
          Loading map
        </span>
      </div>
    </div>
  ),
})

const COL_W = 360
const COL_W_MIN = 300
const COL_W_MAX = 560

const TL_H = 236
const TL_H_MIN = 150
const TL_H_MAX = 620

const TL_COLLAPSED = 30

export default function SimulatorPage() {
  const {
    flightStates, schedule, setSchedule, setFleet, setSelectedLiveFlight,
    appliedPlanId, recoveryPlans, activeEvents, selectedLiveFlight,
    hydrateStaticFromCache, applyPlan,
  } = useSimulationStore()
  const { isConnected } = useWebSocket()
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null)

  const [tab, setTab] = useState<ContextTab>("events")
  const [colOpen, setColOpen] = useState(true)
  const [tlOpen, setTlOpen] = useState(true)
  const [announce, setAnnounce] = useState(true)

  const colW = useResizable("aeolus-col-w", COL_W, COL_W_MIN, COL_W_MAX, "left")
  // "top": the timeline is BELOW this handle. See the header note.
  const tlH = useResizable("aeolus-tl-h", TL_H, TL_H_MIN, TL_H_MAX, "top")

  // One breakpoint, one behaviour change. Below `narrow` the column becomes a
  // full-width sheet, because a 300px docked column plus a 56px rail leaves a
  // 34px map at 390px.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 880px)")
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem("aeolus-col-open") === "0") setColOpen(false)
      if (localStorage.getItem("aeolus-tl-open") === "0") setTlOpen(false)
      if (localStorage.getItem("aeolus-announce") === "0") setAnnounce(false)
    } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem("aeolus-col-open", colOpen ? "1" : "0") } catch {} }, [colOpen])
  useEffect(() => { try { localStorage.setItem("aeolus-tl-open", tlOpen ? "1" : "0") } catch {} }, [tlOpen])

  const dismissAnnounce = useCallback(() => {
    setAnnounce(false)
    try { localStorage.setItem("aeolus-announce", "0") } catch {}
  }, [])

  const selectedSched = useMemo(
    () => schedule.find((f) => f.id === selectedFlight) ?? null,
    [schedule, selectedFlight],
  )
  const flightEnabled = !!selectedSched || !!selectedLiveFlight

  useEffect(() => {
    if (selectedSched || selectedLiveFlight) {
      setTab("flight")
      setColOpen(true)
    }
  }, [selectedSched, selectedLiveFlight])

  useEffect(() => {
    if (tab === "flight" && !flightEnabled) setTab("events")
  }, [tab, flightEnabled])

  /**
   * Recovery plans arrive → show them. Switching a tab in a panel that is
   * already open is not the "nothing auto-opens" rule's target: nothing is
   * covered, the column does not resize, and no plan is committed. Guarded by
   * a ref keyed on the plan wave so it fires once per solve rather than on
   * every websocket rebroadcast, and never while a flight is being inspected.
   */
  const announcedWave = useRef<string | null>(null)
  useEffect(() => {
    if (recoveryPlans.length === 0) { announcedWave.current = null; return }
    const wave = recoveryPlans.map((p) => p.plan_id).join("|")
    if (announcedWave.current === wave) return
    announcedWave.current = wave
    if (tab === "flight") return
    setTab("recovery")
    setColOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryPlans])

  const closeFlight = useCallback(() => {
    setSelectedFlight(null)
    setSelectedLiveFlight(null)
    setTab("events")
  }, [setSelectedLiveFlight])

  /**
   * THE COMPARE REGION.
   *
   * Comparing four plans across six metrics is a DECISION moment, not a
   * monitoring one, and it cannot be done in a 360px column: at ~60px per
   * plan the figures stop being comparable, which is the only reason the
   * comparison exists. So choosing Recovery lifts the comparison over the map
   * for as long as the decision is open, then hands the map straight back.
   *
   * The map is covered, not UNMOUNTED. design.md unmounts the inactive
   * PROJECTION because map and globe are two answers to two questions and
   * keeping both alive doubles the marker cost forever; this is a transient
   * overlay on the same answer, and tearing down ~500 Leaflet markers to show
   * a table — then rebuilding them seconds later — would make committing a
   * plan feel like a page load. It goes `inert` instead, so nothing behind it
   * is reachable by pointer, focus or a screen reader.
   */
  const [compareDismissed, setCompareDismissed] = useState(false)
  // Arriving at Recovery is a fresh request to decide, so the region reopens.
  useEffect(() => { setCompareDismissed(false) }, [tab])
  const [inspectedPlan, setInspectedPlan] = useState<string>("A")
  useEffect(() => { if (appliedPlanId) setInspectedPlan(appliedPlanId) }, [appliedPlanId])

  const showCompare = tab === "recovery" && recoveryPlans.length > 0 && !compareDismissed && !narrow

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" && e.key !== "]") return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      e.preventDefault()
      if (e.key === "[") setColOpen((v) => !v)
      else setTlOpen((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleFlightSelect = (id: string | null) => {
    setSelectedFlight(id)
    if (id) setSelectedLiveFlight(null)
  }

  // Boot failures are SURFACED, not swallowed — a dispatcher looking at an
  // empty map must be able to tell "no disruptions" from "the API is down".
  const [feedErrors, setFeedErrors] = useState<string[]>([])
  const [bootNonce, setBootNonce] = useState(0)

  useEffect(() => {
    hydrateStaticFromCache()
    let cancelled = false
    const failed: string[] = []
    const note = (feed: string) => (err: unknown) => {
      if (cancelled) return
      failed.push(feed)
      console.error(`[aeolus] ${feed} feed failed:`, err)
    }

    const schedulePromise = apiClient
      .get<{ flights?: ScheduledFlight[] } | ScheduledFlight[]>("/simulator/schedule")
      .then((res) => {
        const d = res.data
        const list = Array.isArray(d) ? d : d?.flights
        if (list && list.length) setSchedule(list)
      })
      .catch(note("Schedule"))

    // "/aircraft", not "/network/aircraft" — the latter 404s.
    const fleet = apiClient
      .get<{ aircraft?: FleetAircraft[] }>("/aircraft")
      .then((res) => { const a = res.data?.aircraft; if (a && a.length) setFleet(a) })
      .catch(note("Fleet"))

    const airports = apiClient
      .get<{ airports?: { id: string; hub_type?: string }[] }>("/airports")
      .then((res) => hydrateAirportTiers(res.data?.airports))
      .catch(note("Airports"))

    /**
     * DISRUPTION STATE over REST, not only over the socket.
     *
     * This boot sequence loaded the static network — schedule, fleet, airport
     * tiers — and left active events, recovery plans and flight states
     * entirely to the WebSocket. So a console opened while the socket is
     * still handshaking, blocked by a proxy, or simply slow renders the
     * NOMINAL state during a live disruption: "142 legs, no cascades" with a
     * ground stop running and four plans solved.
     *
     * That is worse than a spinner. The empty state is a claim, and the whole
     * point of the degraded-feed banner beside it is that the operator must
     * always be able to tell "nothing is wrong" from "I cannot see". This
     * closed the last path where those two rendered identically.
     *
     * `setUpdate` merges it through the same guarded path the socket uses, so
     * the socket's own snapshot supersedes it a moment later without a fight.
     */
    const simState = apiClient
      .get<Record<string, unknown>>("/simulator/state")
      .then((res) => { if (res.data) useSimulationStore.getState().setUpdate(res.data) })
      .catch(note("Simulator state"))

    void Promise.allSettled([schedulePromise, fleet, airports, simState]).then(() => {
      if (!cancelled) setFeedErrors(failed)
    })
    return () => { cancelled = true }
  }, [setSchedule, setFleet, hydrateStaticFromCache, bootNonce])

  const columnBody = (
    <ContextColumn
      tab={tab}
      onTab={setTab}
      flightEnabled={flightEnabled}
      onClose={narrow ? () => setColOpen(false) : undefined}
      counts={{
        events: activeEvents.length,
        recovery: recoveryPlans.length > 0 && !appliedPlanId ? recoveryPlans.length : undefined,
      }}
    >
      {tab === "events" && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          {announce && <AnnouncementCard onDismiss={dismissAnnounce} />}
          <div style={{ flex: 1, minHeight: 0 }}>
            <EventPanel />
          </div>
        </div>
      )}
      {tab === "recovery" && (
        <RecoveryDetail
          inspectedId={inspectedPlan}
          onOpenCompare={() => setCompareDismissed(false)}
        />
      )}
      {tab === "flight" && (
        <FlightDetailPanel live={selectedLiveFlight} scheduled={selectedSched} onClose={closeFlight} />
      )}
    </ContextColumn>
  )

  return (
    <div style={{ background: "var(--ae-bg)", height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column", width: "100%" }}>
      <DashboardLoader />

      <a
        href="#ae-workspace"
        className="ae-skip"
        style={{
          position: "absolute", left: sp.xs, top: -200, zIndex: 5000,
          padding: `${sp.xxs}px ${sp.sm}px`, borderRadius: r.xs,
          background: c.canvas, color: c.ink, border: RULE,
          boxShadow: "0 0 0 3px var(--ae-focus)",
          fontFamily: ff.body, fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}
        onFocus={(e) => { e.currentTarget.style.top = `${sp.xs}px` }}
        onBlur={(e) => { e.currentTarget.style.top = "-200px" }}
      >
        Skip to workspace
      </a>

      <BoardBar isConnected={isConnected} />

      {/* Degraded-feed banner. role="status", not "alert": the console is still
          usable on cached data, so this informs without seizing focus. It names
          WHICH feed failed, because "something went wrong" leaves the operator
          unable to judge whether what they see is trustworthy. */}
      {feedErrors.length > 0 && (
        <div
          role="status"
          style={{
            position: "relative",
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: sp.xs,
            padding: `${sp.xxs}px ${sp.sm}px`,
            background: "var(--ae-amber-bg)",
            borderBottom: RULE,
            color: c.ink, fontFamily: ff.body, fontSize: 12.5,
          }}
        >
          <Fringe tone="rose" side="top" />
          <AlertTriangle style={{ width: 14, height: 14, color: c.amberInk, flexShrink: 0 }} strokeWidth={2} />
          <span>
            <strong style={{ fontWeight: 650 }}>
              {feedErrors.join(" and ")} {feedErrors.length > 1 ? "feeds are" : "feed is"} unavailable.
            </strong>{" "}
            Showing the last known data — figures may be stale.
          </span>
          <button
            type="button"
            onClick={() => { setFeedErrors([]); setBootNonce((n) => n + 1) }}
            className="ae-bar-btn"
            style={{
              marginLeft: "auto", height: 26, padding: `0 ${sp.xs}px`,
              fontSize: 12, fontWeight: 600, fontFamily: ff.body,
              borderRadius: r.xs, border: `1px solid ${c.amberInk}`,
              background: "transparent", color: c.amberInk, cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      <main
        id="ae-workspace"
        tabIndex={-1}
        style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", overflow: "hidden" }}
      >
        {colOpen && !narrow && (
          <>
            <div style={{ width: colW.size, flexShrink: 0, minWidth: 0, height: "100%" }}>
              {columnBody}
            </div>
            <ResizeHandle
              side="left"
              onPointerDown={colW.onPointerDown}
              label="Resize the working column"
              value={colW.size}
              min={COL_W_MIN}
              max={COL_W_MAX}
              onValue={colW.setSize}
            />
          </>
        )}

        {colOpen && narrow && (
          <div style={{ position: "absolute", inset: 0, zIndex: 800, background: c.canvas }}>
            {columnBody}
          </div>
        )}

        {/* `inert` while the narrow sheet is up: the map mounts several hundred
            focusable marks that are invisible but still in the tab order
            behind it. `inert={true}`, never `inert=""` — React coerces the
            empty string to false and silently drops the attribute. */}
        <div
          inert={colOpen && narrow}
          aria-hidden={colOpen && narrow ? true : undefined}
          style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
        >
          {/* ── The map region. Holds the map, and the compare board when a
                 recovery decision is open. ── */}
          <div style={{ flex: 1, minHeight: 120, position: "relative", display: "flex", flexDirection: "column" }}>
          {showCompare && (
            <div style={{ position: "absolute", inset: 0, zIndex: 600 }}>
              <PlanCompareBoard
                inspectedId={inspectedPlan}
                onInspect={setInspectedPlan}
                onCommit={(id) => { applyPlan(id); setCompareDismissed(true) }}
                onClose={() => setCompareDismissed(true)}
              />
            </div>
          )}
          <Module
            flush={["top", "left", "right"]}
            aria-label="Network map"
            inert={showCompare}
            aria-hidden={showCompare ? true : undefined}
            style={{ flex: 1, minHeight: 120 }}
            bodyStyle={{ overflow: "hidden", position: "relative", background: c.surfaceSoft }}
          >
            <div style={{ position: "absolute", inset: 0 }}>
              <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
            </div>

            {/* Search owns the top-centre lane; nothing else may enter it.
                Width is clamped against the MAP's box, not the viewport, so
                the instrument column on the right stays clear. */}
            <div
              className="ae-map-search-lane"
              style={{
                position: "absolute", top: sp.xs, left: "50%", transform: "translateX(-50%)",
                width: "min(420px, calc(100% - 210px))", zIndex: 520,
              }}
            >
              <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
            </div>

            {/* Column launcher — bottom-left lane, owned by nothing else. */}
            {!colOpen && (
              <button
                type="button"
                onClick={() => setColOpen(true)}
                className="ae-map-launcher"
                style={{
                  position: "absolute", left: sp.xs, top: sp.xs, zIndex: 530,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 30, padding: `0 ${sp.xs}px`, borderRadius: r.xs,
                  border: `1px solid ${c.glassLine}`,
                  background: c.glass,
                  WebkitBackdropFilter: "var(--ae-glass-blur)",
                  backdropFilter: "var(--ae-glass-blur)",
                  color: c.ink, fontFamily: ff.body, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Layers style={{ width: 14, height: 14 }} strokeWidth={2} />
                Panel
                {activeEvents.length > 0 && <Chip tone="amber">{activeEvents.length}</Chip>}
              </button>
            )}

            {colOpen && !narrow && (
              <button
                type="button"
                onClick={() => setColOpen(false)}
                aria-label="Collapse the working column"
                title="Collapse column  ["
                className="ae-map-launcher"
                style={{
                  position: "absolute", left: 0, top: sp.xs, zIndex: 530,
                  width: 26, height: 34, borderRadius: `0 ${r.xs}px ${r.xs}px 0`,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${c.glassLine}`, borderLeft: "none",
                  background: c.glass,
                  WebkitBackdropFilter: "var(--ae-glass-blur)",
                  backdropFilter: "var(--ae-glass-blur)",
                  color: c.body, cursor: "pointer",
                }}
              >
                <PanelLeftClose style={{ width: 13, height: 13 }} strokeWidth={2} />
              </button>
            )}
          </Module>
          </div>

          {tlOpen && (
            <ResizeHandle
              side="top"
              onPointerDown={tlH.onPointerDown}
              label="Resize the cascade rail"
              value={tlH.size}
              min={TL_H_MIN}
              max={TL_H_MAX}
              onValue={tlH.setSize}
            />
          )}

          {/* ── The cascade rail. Sized region; clamped to 62% so a dragged-tall
                 rail can never reduce the map to a strip. ── */}
          <div
            style={{
              height: tlOpen ? Math.min(tlH.size, TL_H_MAX) : TL_COLLAPSED,
              maxHeight: tlOpen ? "62%" : undefined,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {tlOpen ? (
              <Module
                flush={["left", "right", "bottom"]}
                title="Cascade rail"
                aria-label="Cascade timeline"
                action={
                  <button
                    type="button"
                    onClick={() => setTlOpen(false)}
                    aria-label="Collapse the cascade rail"
                    title="Collapse rail  ]"
                    className="ae-bar-btn"
                    style={{
                      // 24, not 22 — WCAG 2.5.8's floor, and `ui-audit`
                      // reported it as the console's only sub-24px control
                      // that was not Leaflet's own attribution markup.
                      width: 24, height: 24, borderRadius: r.xs, border: RULE,
                      background: "transparent", color: c.muted, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <PanelBottomOpen style={{ width: 12, height: 12, transform: "rotate(180deg)" }} strokeWidth={2} />
                  </button>
                }
                style={{ height: "100%" }}
                bodyStyle={{ overflow: "hidden" }}
              >
                <CascadeTimeline selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
              </Module>
            ) : (
              <button
                type="button"
                onClick={() => setTlOpen(true)}
                className="ae-bar-btn"
                style={{
                  width: "100%", height: TL_COLLAPSED, display: "flex", alignItems: "center", gap: 6,
                  padding: `0 ${sp.sm}px`, border: "none", borderTop: RULE,
                  background: c.surfaceSoft, color: c.body, cursor: "pointer",
                  fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                }}
              >
                <PanelBottomOpen style={{ width: 12, height: 12 }} strokeWidth={2} />
                Cascade rail — expand
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
