"use client"
import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plane, Search, X, Clock,
  Bookmark, BookmarkCheck, ChevronDown, ArrowRight,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import type { ScheduledFlight, FlightState } from "@/stores/simulation"

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

function getStatusMeta(state: FlightState | undefined): {
  label: string
  color: string
  bg: string
  border: string
  dot: string
  priority: number
} {
  if (!state || state.cascade_order < 0) {
    return { label: "On Time", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", priority: 0 }
  }
  if (state.status === "cancelled") {
    return { label: "Cancelled", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", priority: 3 }
  }
  if (state.status === "diverted") {
    return { label: "Diverted", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500", priority: 3 }
  }
  if (state.cascade_order === 0) {
    return { label: "Direct Hit", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-orange-500", priority: 3 }
  }
  if (state.delay_minutes > 120) {
    return { label: `+${state.delay_minutes}m`, color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", priority: 2 }
  }
  if (state.delay_minutes > 0) {
    return { label: `+${state.delay_minutes}m`, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", priority: 1 }
  }
  return { label: "On Time", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", priority: 0 }
}

// ─── Flight Card ──────────────────────────────────────────────────────────────

function FlightCard({
  flight,
  state,
  onRemove,
  onSelect,
}: {
  flight: ScheduledFlight
  state: FlightState | undefined
  onRemove: () => void
  onSelect: (id: string) => void
}) {
  const status = getStatusMeta(state)
  const isAffected = state && state.cascade_order >= 0
  const reason = state?.reason

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`relative rounded-2xl border bg-white p-4 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow group ${
        isAffected ? `${status.border}` : "border-border/50"
      }`}
      style={isAffected ? { background: `${status.bg.replace("bg-", "")}` } : {}}
      onClick={() => onSelect(flight.id)}
    >
      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white border border-border/50 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </button>

      {/* Top row: flight ID + status */}
      <div className="flex items-start justify-between gap-2 pr-4">
        <div>
          <div className="font-mono font-bold text-sm text-foreground">{flight.id}</div>
          {flight.flight_number && (
            <div className="text-[10px] text-muted-foreground font-mono">{flight.flight_number}</div>
          )}
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${status.color} ${status.bg} ${status.border}`}>
          {status.label}
        </span>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold text-base text-foreground">{flight.origin}</span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono font-bold text-base text-foreground">{flight.destination}</span>
      </div>

      {/* Times */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{fmtTime(flight.scheduled_departure)}</span>
          {state?.new_departure && (
            <span className="text-orange-600 font-semibold ml-1">→ {fmtTime(state.new_departure)}</span>
          )}
        </div>
        <span className="text-border">·</span>
        <span>{fmtDate(flight.scheduled_departure)}</span>
        {flight.tail_number && (
          <>
            <span className="text-border">·</span>
            <span className="font-mono">{flight.tail_number}</span>
          </>
        )}
      </div>

      {/* Reason if affected */}
      {reason && (
        <div className={`text-[10px] font-medium ${status.color} leading-snug`}>
          {reason}
        </div>
      )}

      {/* Cascade indicator */}
      {state && state.cascade_order >= 0 && (
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className="text-[10px] text-muted-foreground">
            {state.cascade_order === 0 ? "Directly disrupted" : `Cascade level ${state.cascade_order}`}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MyFlights({ onFlightSelect }: { onFlightSelect?: (id: string | null) => void }) {
  const { schedule, flightStates } = useSimulationStore()
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
    <div className="rounded-2xl overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1.5px solid rgba(43,168,162,0.20)",
        boxShadow: "0 2px 16px rgba(43,168,162,0.07), 0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(43,168,162,0.12)", border: "1px solid rgba(43,168,162,0.20)" }}
          >
            <BookmarkCheck className="w-3.5 h-3.5" style={{ color: "#2BA8A2" }} />
          </div>
          <div>
            <div className="section-title">My Flights</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {watchedFlights.length === 0
                ? "Track flights from the Nimbus schedule"
                : `${watchedFlights.length} tracked${affectedCount > 0 ? ` · ${affectedCount} affected` : ""}`}
            </div>
          </div>
          {affectedCount > 0 && (
            <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
              {affectedCount} alert{affectedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSearch((s) => !s); setQuery("") }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: "rgba(43,168,162,0.10)", color: "#2BA8A2" }}
          >
            <Search className="w-3.5 h-3.5" />
            Add flight
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary"
          >
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
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
            className="overflow-hidden"
          >
            {/* Search bar */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-b border-border/40"
                >
                  <div className="p-4 relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by flight ID, tail, or route (e.g. N001NB, KORD)…"
                        className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border/60 rounded-xl outline-none"
                        style={{ boxShadow: "none" }}
                        onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 3px rgba(43,168,162,0.18)"}
                        onBlur={(e) => e.currentTarget.style.boxShadow = "none"}
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="absolute left-4 right-4 top-[calc(100%-8px)] rounded-xl border border-border bg-white shadow-lg z-20 overflow-hidden">
                        {searchResults.map((f) => {
                          const alreadyWatched = watchedIds.includes(f.id)
                          const st = flightStates[f.id]
                          const sm = getStatusMeta(st)
                          return (
                            <button
                              key={f.id}
                              onClick={() => addFlight(f.id)}
                              disabled={alreadyWatched}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/60 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plane className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-mono font-bold">{f.id}</span>
                                <span className="text-muted-foreground ml-2">{f.origin} → {f.destination}</span>
                                {f.flight_number && (
                                  <span className="text-muted-foreground/60 ml-2 text-xs">{f.flight_number}</span>
                                )}
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${sm.color} ${sm.bg} ${sm.border}`}>
                                {sm.label}
                              </span>
                              {alreadyWatched && <Bookmark className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
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
            <div className="p-4">
              {watchedFlights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: "rgba(43,168,162,0.08)", border: "1px solid rgba(43,168,162,0.15)" }}
                  >
                    <Plane className="w-6 h-6" style={{ color: "#2BA8A2", opacity: 0.4 }} />
                  </div>
                  <p className="text-sm font-semibold text-foreground/70">No flights tracked yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Add flight" to watch Nimbus flights and get real-time disruption alerts.</p>
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  <AnimatePresence>
                    {watchedFlights.map(({ id, flight, state }) => (
                      <FlightCard
                        key={id}
                        flight={flight}
                        state={state}
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
