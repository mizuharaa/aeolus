"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2, AlertTriangle, PanelBottomClose, PanelBottomOpen, Layers } from "lucide-react"
import { useSimulationStore, type ScheduledFlight, type FleetAircraft } from "@/stores/simulation"
import { useWebSocket } from "@/lib/websocket"
import { EventPanel } from "@/components/simulator/event-panel"
import { CascadeTimeline } from "@/components/simulator/cascade-timeline"
import { RecoveryPlans } from "@/components/simulator/recovery-plans"
import { SimulatorNav } from "@/components/simulator/nav"
import { DashboardLoader } from "@/components/simulator/dashboard-loader"
import { FlightSearch } from "@/components/simulator/flight-search"
import { FlightDetailPanel } from "@/components/simulator/flight-detail"
import { ContextColumn, AnnouncementCard, type ContextTab } from "@/components/simulator/context-column"
import { apiClient } from "@/lib/api"
import { hydrateAirportTiers } from "@/components/simulator/airports"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { useResizable, ResizeHandle } from "@/components/simulator/workspace-chrome"

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

// ── Layout constants ─────────────────────────────────────────────────────
//
// THE MAP IS THE DOMINANT REGION AND THE TIMELINE IS THE SIZED ONE — the
// inverse of the 2026-08-05 arrangement, and a deliberate reversal recorded in
// design.md. That decision made the Gantt the hero because it was showing 1.96
// of 18 rows while the basemap took every spare pixel. The cause was the map
// being FULL-WIDTH-MINUS-TWO-PANELS and 62% covered, not the map being large:
// with the panels collapsed into one 360px column the map finally has a shape
// worth giving space to, and the timeline gets a real, resizable, persisted
// height instead of the remainder of a fight it kept losing.
const COL_W     = 364
const COL_W_MIN = 300
const COL_W_MAX = 560

const TL_H     = 236
const TL_H_MIN = 150
const TL_H_MAX = 620

const TL_COLLAPSED = 34

export default function SimulatorPage() {
  const {
    flightStates, schedule, setSchedule, setFleet, setSelectedLiveFlight,
    appliedPlanId, recoveryPlans, activeEvents, selectedLiveFlight,
    hydrateStaticFromCache,
  } = useSimulationStore()
  const { isConnected } = useWebSocket()
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null)

  const [tab, setTab] = useState<ContextTab>("events")
  const [colOpen, setColOpen] = useState(true)
  const [tlOpen, setTlOpen] = useState(true)
  const [announce, setAnnounce] = useState(true)

  const colW = useResizable("aeolus-col-w", COL_W, COL_W_MIN, COL_W_MAX, "left")
  const tlH  = useResizable("aeolus-tl-h",  TL_H,  TL_H_MIN,  TL_H_MAX,  "bottom")

  // One breakpoint, one behaviour change. The old shell had three (1500 / 900
  // / plus an overlay fallback) interacting with a mutual-exclusion rule, and
  // the combinations were where the 58-collision mobile layout came from.
  // Below `narrow` the column becomes an overlay sheet because a 300px docked
  // column plus a 68px rail leaves a 22px map at 390px.
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
  useEffect(() => { try { localStorage.setItem("aeolus-tl-open",  tlOpen  ? "1" : "0") } catch {} }, [tlOpen])

  const dismissAnnounce = useCallback(() => {
    setAnnounce(false)
    try { localStorage.setItem("aeolus-announce", "0") } catch {}
  }, [])

  const selectedSched = useMemo(
    () => schedule.find((f) => f.id === selectedFlight) ?? null,
    [schedule, selectedFlight],
  )
  const flightEnabled = !!selectedSched || !!selectedLiveFlight

  // Selecting a flight IS a request to inspect it, so the column switches to
  // the Flight tab and opens if collapsed. It does not close the other tabs'
  // content — they are one click away and their counts stay visible.
  useEffect(() => {
    if (selectedSched || selectedLiveFlight) {
      setTab("flight")
      setColOpen(true)
    }
  }, [selectedSched, selectedLiveFlight])

  // Leaving the flight tab with nothing selected would strand an empty panel.
  useEffect(() => {
    if (tab === "flight" && !flightEnabled) setTab("events")
  }, [tab, flightEnabled])

  const closeFlight = useCallback(() => {
    setSelectedFlight(null)
    setSelectedLiveFlight(null)
    setTab("events")
  }, [setSelectedLiveFlight])

  // Keyboard: [ toggles the column, ] toggles the timeline.
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

  // Boot failures are SURFACED, not swallowed. Every one of these three calls
  // used to end in `.catch(() => {})`, which is how `/network/aircraft` 404'd
  // on every single load for an unknown length of time without anyone noticing
  // — and, worse, why a dispatcher looking at an empty map could not tell "no
  // disruptions" from "the API is down". Both render identically when the
  // failure is silent.
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

    // "/aircraft", not "/network/aircraft" — the latter 404s. The API mounts
    // this router without a prefix (apps/api/src/routes/network.py).
    const fleet = apiClient
      .get<{ aircraft?: FleetAircraft[] }>("/aircraft")
      .then((res) => { const a = res.data?.aircraft; if (a && a.length) setFleet(a) })
      .catch(note("Fleet"))

    const airports = apiClient
      .get<{ airports?: { id: string; hub_type?: string }[] }>("/airports")
      .then((res) => hydrateAirportTiers(res.data?.airports))
      .catch(note("Airports"))

    void Promise.allSettled([schedulePromise, fleet, airports]).then(() => {
      if (!cancelled) setFeedErrors(failed)
    })
    return () => { cancelled = true }
  }, [setSchedule, setFleet, hydrateStaticFromCache, bootNonce])

  const columnBody = (
    <ContextColumn
      tab={tab}
      onTab={setTab}
      flightEnabled={flightEnabled}
      // Only as a sheet. Docked, the column's dismiss is the chevron on its
      // map-facing edge; a second one in the tab bar would be two controls for
      // one job at the width where there is room for neither.
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
        <div style={{ flex: 1, minHeight: 0 }}>
          <RecoveryPlans selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
        </div>
      )}
      {tab === "flight" && (
        <FlightDetailPanel
          live={selectedLiveFlight}
          scheduled={selectedSched}
          onClose={closeFlight}
        />
      )}
    </ContextColumn>
  )

  return (
    // overflow:hidden + fixed height. An ops console must not be able to scroll
    // away mid-incident, so the shell is exactly one viewport and every region
    // scrolls internally.
    <div style={{ background: "var(--ae-bg)", height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <DashboardLoader />

      <a
        href="#ae-workspace"
        style={{
          position: "absolute", left: sp.sm, top: -200, zIndex: 5000,
          padding: `${sp.xs}px ${sp.md}px`, borderRadius: r.sm,
          background: "var(--ae-surface)", color: c.ink,
          border: `1px solid ${c.hairline}`, boxShadow: "0 0 0 3px var(--ae-focus)",
          fontFamily: ff.body, fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}
        onFocus={(e) => { e.currentTarget.style.top = `${sp.sm}px` }}
        onBlur={(e) => { e.currentTarget.style.top = "-200px" }}
      >
        Skip to workspace
      </a>

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

      {/* <main>, not <div>. The console had NO main landmark and zero headings
          across 78 tab stops, so a screen-reader user had no document outline
          to navigate and "skip to main content" had nowhere to go. */}
      <main
        id="ae-workspace"
        tabIndex={-1}
        style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", overflow: "hidden" }}
      >
        {/* ── Context column ── */}
        {colOpen && !narrow && (
          <>
            <div style={{ width: colW.size, flexShrink: 0, minWidth: 0, height: "100%" }}>
              {columnBody}
            </div>
            <ResizeHandle
              side="left"
              onPointerDown={colW.onPointerDown}
              label="Resize the working panel"
              value={colW.size}
              min={COL_W_MIN}
              max={COL_W_MAX}
              onValue={colW.setSize}
            />
          </>
        )}

        {/* Overlay sheet at narrow widths. It is a real sibling of the map, not
            a floating card over it, so it still cannot overlap the map's own
            controls — it replaces the map's width rather than covering it. */}
        {colOpen && narrow && (
          <div
            style={{
              position: "absolute", inset: 0, zIndex: 800,
              background: c.canvas,
            }}
          >
            {columnBody}
          </div>
        )}

        {/* ── Map over the cascade timeline ──
            `inert` while the narrow overlay column is up. The map mounts ~530
            ADS-B markers and every Nimbus airport as focusable DOM nodes; with
            the sheet open over them they are invisible but still in the tab
            order, so a keyboard or screen-reader user landed in several hundred
            unreachable controls behind a panel. inert removes them from
            focus, hit-testing and the accessibility tree in one attribute. */}
        <div
          // `inert={true}`, not `inert=""`. The empty-string form is the HTML
          // spelling of a boolean attribute, but React reads it as the STRING
          // "" and coerces that to false — so the attribute was emitted and did
          // nothing, and React said so in a console warning that the audit
          // caught. React 19 supports `inert` as a real boolean prop.
          inert={colOpen && narrow}
          aria-hidden={colOpen && narrow ? true : undefined}
          style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
        >
          <div style={{ flex: 1, minHeight: 120, position: "relative", background: c.surfaceSoft }}>
            <div style={{ position: "absolute", inset: 0 }}>
              <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
            </div>

            {/* Search owns the TOP-CENTRE lane and nothing else is allowed in
                it (design.md). Its width is clamped against the map's own box
                rather than the viewport, so the instrument column on the right
                and the panel launcher on the left both stay clear. */}
            <div
              className="ae-map-search-lane"
              style={{
                position: "absolute",
                top: sp.sm,
                left: "50%",
                transform: "translateX(-50%)",
                // 210px is the instrument column's real footprint (projection
                // switch 139 + the 64px clearance design.md requires beside it).
                // Below ~700px of map that subtraction leaves the search too
                // narrow to clear the switch anyway, so the lane STACKS instead
                // — see .ae-map-search-lane in globals.css.
                width: "min(420px, calc(100% - 210px))",
                zIndex: 520,
              }}
            >
              <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
            </div>

            {/* Column launcher — bottom-left lane, which no other overlay owns.
                Visible whenever the column is closed, at every width. */}
            {!colOpen && (
              <button
                type="button"
                onClick={() => setColOpen(true)}
                className="ae-map-launcher"
                style={{
                  position: "absolute", left: sp.sm, top: sp.sm, zIndex: 530,
                  display: "inline-flex", alignItems: "center", gap: 8,
                  height: 38, padding: "0 13px", borderRadius: r.md,
                  border: `1px solid ${c.hairline}`,
                  background: "var(--ae-surface)", color: c.ink,
                  fontFamily: ff.body, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  boxShadow: "var(--ae-shadow-card-elev)",
                }}
              >
                <Layers style={{ width: 15, height: 15 }} strokeWidth={2} />
                Panel
                {activeEvents.length > 0 && (
                  <span
                    style={{
                      fontFamily: ff.mono, fontSize: 10, fontWeight: 700,
                      padding: "2px 5px", borderRadius: 999,
                      background: "var(--ae-amber-bg)", color: "var(--ae-amber-ink)",
                    }}
                  >
                    {activeEvents.length}
                  </span>
                )}
              </button>
            )}

            {/* Close control for the column, docked to the column's own edge so
                it never lands in a map overlay lane. */}
            {colOpen && !narrow && (
              <button
                type="button"
                onClick={() => setColOpen(false)}
                aria-label="Collapse the working panel"
                title="Collapse panel  ["
                className="ae-map-launcher"
                style={{
                  // 26px wide, over the 24px WCAG 2.5.8 floor. It reads as a
                  // half-tab because its left edge is flush to the column, but
                  // the target itself still has to be a real one.
                  position: "absolute", left: 0, top: sp.sm, zIndex: 530,
                  width: 26, height: 36, borderRadius: "0 8px 8px 0",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${c.hairline}`, borderLeft: "none",
                  background: "var(--ae-surface)", color: c.muted, cursor: "pointer",
                }}
              >
                <PanelBottomClose style={{ width: 13, height: 13, transform: "rotate(90deg)" }} strokeWidth={2} />
              </button>
            )}
          </div>

          {tlOpen && (
            <ResizeHandle
              side="bottom"
              onPointerDown={tlH.onPointerDown}
              label="Resize the cascade timeline"
              value={tlH.size}
              min={TL_H_MIN}
              max={TL_H_MAX}
              onValue={tlH.setSize}
            />
          )}

          <div
            style={{
              // The timeline is the SIZED region now; the map is greedy. Height
              // is clamped to 62% so a dragged-tall timeline can never reduce
              // the map to a strip.
              height: tlOpen ? Math.min(tlH.size, 620) : TL_COLLAPSED,
              maxHeight: tlOpen ? "62%" : undefined,
              flexShrink: 0,
              borderTop: `1px solid ${c.hairline}`,
              background: c.canvas,
              overflow: "hidden",
            }}
          >
            {tlOpen ? (
              <div style={{ height: "100%", position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setTlOpen(false)}
                  aria-label="Collapse the cascade timeline"
                  title="Collapse timeline  ]"
                  className="ae-map-launcher"
                  style={{
                    position: "absolute", top: sp.xs, right: sp.sm, zIndex: 30,
                    width: 32, height: 32, borderRadius: r.sm,
                    border: `1px solid ${c.hairline}`, background: "var(--ae-surface-2)",
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
                onClick={() => setTlOpen(true)}
                className="ae-map-launcher"
                style={{
                  width: "100%", height: TL_COLLAPSED, display: "flex", alignItems: "center", gap: sp.xs,
                  padding: `0 ${sp.md}px`, border: "none", background: "transparent",
                  color: c.body, cursor: "pointer", fontFamily: ff.mono, fontSize: 10.5,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                }}
              >
                <PanelBottomOpen style={{ width: 13, height: 13 }} strokeWidth={2} />
                Cascade timeline — expand
              </button>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        .ae-map-launcher:hover { background: var(--ae-surface-3) !important; color: var(--ae-text) !important; }
        .ae-map-launcher:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ae-focus); }
      `}</style>
    </div>
  )
}
