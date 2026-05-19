"use client"
import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plane, Search, X, Clock,
  Bookmark, BookmarkCheck, ChevronDown, ArrowRight,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import type { ScheduledFlight, FlightState, FleetAircraft } from "@/stores/simulation"
import { airportLabel, aircraftLabel } from "@/lib/labels"
import { AirportCode } from "./airport-code"
import { c, ff, r, sp, sh, type } from "@/lib/design-tokens"
import {
  ButtonSecondary,
  CreamCallout,
  Eyebrow,
  Type,
} from "@/components/ds/primitives"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  } catch {
    return iso?.slice(11, 16) ?? "—"
  }
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
  } catch {
    return "—"
  }
}

// ─── Status meta — single semantic palette across the whole app ───────────
// Maps a `FlightState` to a label + the canonical token-driven palette so
// flight cards, search rows, and the map all share one color language.
function getStatusMeta(state: FlightState | undefined): {
  label: string
  palette: { ink: string; bg: string; dot: string }
  priority: number
} {
  if (!state || state.cascade_order < 0) {
    return { label: "On Time", palette: c.statusOnTime, priority: 0 }
  }
  if (state.status === "cancelled") {
    return { label: "Cancelled", palette: c.statusCancelled, priority: 3 }
  }
  if (state.status === "diverted") {
    return { label: "Diverted", palette: c.statusCancelled, priority: 3 }
  }
  if (state.cascade_order === 0) {
    return { label: "Direct Hit", palette: c.statusCancelled, priority: 3 }
  }
  if (state.delay_minutes > 0) {
    return { label: `+${state.delay_minutes}m`, palette: c.statusDelayed, priority: state.delay_minutes > 120 ? 2 : 1 }
  }
  return { label: "On Time", palette: c.statusOnTime, priority: 0 }
}

// ─── Flight Card ──────────────────────────────────────────────────────────────

function FlightCard({
  flight,
  state,
  fleet,
  onRemove,
  onSelect,
}: {
  flight: ScheduledFlight
  state: FlightState | undefined
  fleet: FleetAircraft[]
  onRemove: () => void
  onSelect: (id: string) => void
}) {
  const status = getStatusMeta(state)
  const isAffected = !!(state && state.cascade_order >= 0)
  const reason = state?.reason
  const origin = airportLabel(flight.origin)
  const dest = airportLabel(flight.destination)
  const tailRef = flight.tail_number ?? flight.aircraft_id ?? ""
  const ac = aircraftLabel(tailRef, fleet)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onClick={() => onSelect(flight.id)}
      className="group"
      style={{
        position: "relative",
        background: isAffected ? status.palette.bg : c.canvas,
        border: `1px solid ${isAffected ? status.palette.dot : c.hairline}`,
        borderRadius: r.lg,
        padding: sp.md,
        display: "flex",
        flexDirection: "column",
        gap: sp.sm,
        cursor: "pointer",
        boxShadow: sh.cardSoft,
        fontFamily: ff.body,
        transition: "box-shadow 200ms ease",
      }}
    >
      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="opacity-0 group-hover:opacity-100"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 24,
          height: 24,
          borderRadius: r.full,
          background: c.canvas,
          border: `1px solid ${c.hairline}`,
          boxShadow: sh.cardSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          cursor: "pointer",
          transition: "opacity 150ms ease",
        }}
      >
        <X style={{ width: 12, height: 12, color: c.muted }} />
      </button>

      {/* Top row: flight ID + status */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.xs, paddingRight: 16 }}>
        <div>
          <div style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 14, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
            {flight.id}
          </div>
          {flight.flight_number && (
            <div style={{ fontFamily: ff.mono, fontSize: 11, color: c.muted, marginTop: 1 }}>{flight.flight_number}</div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.04em",
            padding: "2px 8px",
            borderRadius: r.pill,
            background: status.palette.bg,
            color: status.palette.ink,
            flexShrink: 0,
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Route — codes on top, city subtitle underneath */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 500, color: c.ink, fontFamily: ff.body }}>
          <AirportCode code={flight.origin} />
          <ArrowRight style={{ width: 14, height: 14, color: c.muted, flexShrink: 0 }} />
          <AirportCode code={flight.destination} />
        </div>
        {(origin.city || dest.city) && (
          <div style={{ fontSize: 11, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {origin.city || origin.icao}
            <span style={{ margin: "0 4px", color: c.hairline }}>→</span>
            {dest.city || dest.icao}
          </div>
        )}
      </div>

      {/* Times + tail */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: c.muted, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span style={{ fontFamily: ff.mono, fontVariantNumeric: "tabular-nums" }}>
            {fmtTime(flight.scheduled_departure)}
          </span>
          {state?.new_departure && (
            <span style={{ color: c.statusDelayed.ink, fontWeight: 500, marginLeft: 4 }}>
              → {fmtTime(state.new_departure)}
            </span>
          )}
        </div>
        <span style={{ color: c.hairline }}>·</span>
        <span>{fmtDate(flight.scheduled_departure)}</span>
      </div>

      {/* Aircraft line */}
      {ac.tail && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.muted }}>
          <Plane style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span style={{ fontFamily: ff.mono, fontWeight: 500, color: c.body }}>{ac.tail}</span>
          {ac.typeLabel && (
            <>
              <span style={{ color: c.hairline }}>·</span>
              <span>{ac.typeLabel}</span>
            </>
          )}
          {ac.seats != null && ac.seats > 0 && (
            <>
              <span style={{ color: c.hairline }}>·</span>
              <span>{ac.seats} seats</span>
            </>
          )}
        </div>
      )}

      {/* Reason if affected */}
      {reason && (
        <div style={{ fontSize: 11, fontWeight: 500, color: status.palette.ink, lineHeight: 1.4 }}>
          {reason}
        </div>
      )}

      {/* Cascade indicator */}
      {state && state.cascade_order >= 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: r.full, background: status.palette.dot }} />
          <span style={{ fontSize: 11, color: c.muted }}>
            {state.cascade_order === 0 ? "Directly disrupted" : `Cascade level ${state.cascade_order}`}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MyFlights({ onFlightSelect }: { onFlightSelect?: (id: string | null) => void }) {
  const { schedule, flightStates, fleet } = useSimulationStore()
  const [watchedIds, setWatchedIds]   = useState<string[]>([])
  const [query, setQuery]             = useState("")
  const [showSearch, setShowSearch]   = useState(false)
  const [collapsed, setCollapsed]     = useState(false)

  // Persist watchlist
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aeolus-watched-flights")
      if (saved) setWatchedIds(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem("aeolus-watched-flights", JSON.stringify(watchedIds)) } catch {}
  }, [watchedIds])

  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.trim().toLowerCase()
    return schedule
      .filter((f) =>
        f.id.toLowerCase().includes(q) ||
        f.flight_number?.toLowerCase().includes(q) ||
        f.origin?.toLowerCase().includes(q) ||
        f.destination?.toLowerCase().includes(q) ||
        f.tail_number?.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [query, schedule])

  const watchedFlights = useMemo(() =>
    watchedIds
      .map((id) => ({
        id,
        flight: schedule.find((f) => f.id === id),
        state: flightStates[id],
      }))
      .filter((w) => w.flight) as { id: string; flight: ScheduledFlight; state: FlightState | undefined }[],
    [watchedIds, schedule, flightStates]
  )

  const affectedCount = watchedFlights.filter((w) => w.state && w.state.cascade_order >= 0).length

  const addFlight = (id: string) => {
    if (!watchedIds.includes(id)) setWatchedIds((prev) => [...prev, id])
    setQuery("")
    setShowSearch(false)
  }

  const removeFlight = (id: string) => setWatchedIds((prev) => prev.filter((w) => w !== id))

  return (
    <div
      style={{
        background: c.canvas,
        border: `1px solid ${c.hairline}`,
        borderRadius: r.lg,
        overflow: "hidden",
        boxShadow: sh.cardSoft,
        fontFamily: ff.body,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${sp.sm}px ${sp.lg}px`,
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: sp.sm }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: r.sm,
              background: c.surfaceSoft,
              border: `1px solid ${c.hairline}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <BookmarkCheck style={{ width: 14, height: 14, color: c.ink }} />
          </div>
          <div>
            <div style={{ ...type("titleMd", c.ink), fontSize: 16 }}>My Flights</div>
            <div style={{ ...type("caption", c.muted), fontSize: 11, marginTop: 1 }}>
              {watchedFlights.length === 0
                ? "Track flights from the Nimbus schedule"
                : `${watchedFlights.length} tracked${affectedCount > 0 ? ` · ${affectedCount} affected` : ""}`}
            </div>
          </div>
          {affectedCount > 0 && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: r.pill,
                background: c.statusDelayed.bg,
                color: c.statusDelayed.ink,
              }}
            >
              {affectedCount} alert{affectedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: sp.xs }}>
          <ButtonSecondary
            size="sm"
            onClick={() => { setShowSearch((s) => !s); setQuery("") }}
            leadingIcon={<Search style={{ width: 13, height: 13 }} />}
          >
            Add flight
          </ButtonSecondary>
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              width: 28,
              height: 28,
              borderRadius: r.sm,
              border: `1px solid ${c.hairline}`,
              background: c.canvas,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronDown
              style={{
                width: 14,
                height: 14,
                color: c.muted,
                transform: collapsed ? "rotate(180deg)" : undefined,
                transition: "transform 200ms ease",
              }}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            {/* Search bar */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: "hidden", borderBottom: `1px solid ${c.hairline}` }}
                >
                  <div style={{ padding: sp.md, position: "relative" }}>
                    <div style={{ position: "relative" }}>
                      <Search
                        style={{
                          position: "absolute",
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 16,
                          height: 16,
                          color: c.muted,
                        }}
                      />
                      <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by flight ID, tail, or route (e.g. N001NB, KORD)…"
                        style={{
                          width: "100%",
                          height: 40,
                          paddingLeft: 36,
                          paddingRight: 12,
                          fontSize: 14,
                          fontFamily: ff.body,
                          background: c.canvas,
                          border: `1px solid ${c.hairline}`,
                          borderRadius: r.md,
                          outline: "none",
                          color: c.ink,
                          boxShadow: "none",
                        }}
                        onFocus={(e) => (e.currentTarget.style.boxShadow = sh.buttonFocus)}
                        onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: sp.md,
                          right: sp.md,
                          top: "calc(100% - 8px)",
                          borderRadius: r.md,
                          border: `1px solid ${c.hairline}`,
                          background: c.canvas,
                          boxShadow: sh.overlay,
                          zIndex: 20,
                          overflow: "hidden",
                        }}
                      >
                        {searchResults.map((f) => {
                          const alreadyWatched = watchedIds.includes(f.id)
                          const st = flightStates[f.id]
                          const sm = getStatusMeta(st)
                          return (
                            <button
                              key={f.id}
                              onClick={() => addFlight(f.id)}
                              disabled={alreadyWatched}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: sp.sm,
                                padding: "10px 16px",
                                fontSize: 14,
                                fontFamily: ff.body,
                                background: "transparent",
                                border: "none",
                                textAlign: "left",
                                cursor: alreadyWatched ? "not-allowed" : "pointer",
                                opacity: alreadyWatched ? 0.5 : 1,
                                color: c.ink,
                              }}
                            >
                              <Plane style={{ width: 16, height: 16, color: c.muted, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontFamily: ff.mono, fontWeight: 600 }}>{f.id}</span>
                                <span style={{ color: c.muted, marginLeft: 8 }}>{f.origin} → {f.destination}</span>
                                {f.flight_number && (
                                  <span style={{ color: c.muted, opacity: 0.7, marginLeft: 8, fontSize: 12 }}>{f.flight_number}</span>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  padding: "2px 8px",
                                  borderRadius: r.pill,
                                  background: sm.palette.bg,
                                  color: sm.palette.ink,
                                  flexShrink: 0,
                                }}
                              >
                                {sm.label}
                              </span>
                              {alreadyWatched && <Bookmark style={{ width: 13, height: 13, color: c.muted, flexShrink: 0 }} />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Flight grid */}
            <div style={{ padding: sp.md }}>
              {watchedFlights.length === 0 ? (
                // Complaint 2 fix: cream-callout, not decorative empty state.
                <CreamCallout style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
                  <Eyebrow color={c.signatureForest}>No Flights Tracked</Eyebrow>
                  <Type as="div" role="titleSm" color={c.ink}>
                    Pin Nimbus flights to monitor in real time.
                  </Type>
                  <Type as="p" role="bodyMd" color={c.muted}>
                    Click <span style={{ fontWeight: 500, color: c.ink }}>Add flight</span> to watch any tail in the Nimbus schedule and receive disruption alerts the moment cascade order changes.
                  </Type>
                </CreamCallout>
              ) : (
                <div style={{ display: "grid", gap: sp.sm, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  <AnimatePresence>
                    {watchedFlights.map(({ id, flight, state }) => (
                      <FlightCard
                        key={id}
                        flight={flight}
                        state={state}
                        fleet={fleet}
                        onRemove={() => removeFlight(id)}
                        onSelect={(fid) => onFlightSelect?.(fid)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
