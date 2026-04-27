"use client"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Search, Plane, X, MapPin, Radio, ExternalLink, Loader2 } from "lucide-react"
import { useSimulationStore, type ScheduledFlight, type LiveFlight } from "@/stores/simulation"
import { NIMBUS_AIRPORTS } from "./airports"
import { apiClient } from "@/lib/api"

interface Props {
  selectedFlight: string | null
  onSelect: (id: string | null) => void
}

type ResultItem =
  | { kind: "scheduled"; flight: ScheduledFlight }
  | { kind: "live";      flight: LiveFlight }

export function FlightSearch({ selectedFlight, onSelect }: Props) {
  const { schedule, flightStates, liveFlights, setSelectedLiveFlight, selectedLiveFlight } = useSimulationStore()
  const [q, setQ]           = useState("")
  const [open, setOpen]     = useState(false)
  const [liveResults, setLiveResults] = useState<LiveFlight[]>([])
  const [searching, setSearching]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Scheduled matches (local)
  const scheduledMatches = useMemo(() => {
    const needle = q.trim().toUpperCase()
    if (!needle) return schedule.slice(0, 8)
    return schedule
      .filter((f) =>
        f.id.toUpperCase().includes(needle) ||
        (f.aircraft_id ?? "").toUpperCase().includes(needle) ||
        f.origin.toUpperCase().includes(needle) ||
        f.destination.toUpperCase().includes(needle) ||
        (NIMBUS_AIRPORTS[f.origin]?.iata ?? "").includes(needle) ||
        (NIMBUS_AIRPORTS[f.destination]?.iata ?? "").includes(needle),
      )
      .slice(0, 10)
  }, [q, schedule])

  // Live search (debounced, hits API)
  const doLiveSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setLiveResults([])
      return
    }
    setSearching(true)
    try {
      const res = await apiClient.get(`/flights/search?q=${encodeURIComponent(query)}`)
      setLiveResults(res.data.results || [])
    } catch {
      setLiveResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  // Also filter liveFlights locally for quick results
  const localLiveMatches = useMemo(() => {
    const needle = q.trim().toUpperCase()
    if (!needle || needle.length < 2) return []
    return liveFlights
      .filter((f) =>
        f.callsign.includes(needle) ||
        (f.flight_iata ?? "").includes(needle) ||
        f.flight_icao.includes(needle),
      )
      .slice(0, 8)
  }, [q, liveFlights])

  useEffect(() => {
    clearTimeout(debounce.current)
    if (q.trim().length >= 2) {
      debounce.current = setTimeout(() => doLiveSearch(q.trim()), 400)
    } else {
      setLiveResults([])
    }
    return () => clearTimeout(debounce.current)
  }, [q, doLiveSearch])

  // Merge live results (API results take priority, then local cache matches)
  const mergedLive: LiveFlight[] = useMemo(() => {
    const seen = new Set<string>()
    const merged: LiveFlight[] = []
    for (const f of [...liveResults, ...localLiveMatches]) {
      if (!seen.has(f.icao24)) {
        seen.add(f.icao24)
        merged.push(f)
      }
    }
    return merged.slice(0, 10)
  }, [liveResults, localLiveMatches])

  const selectedSchedFlight = selectedFlight
    ? schedule.find((f) => f.id === selectedFlight)
    : null

  const activeLabel = selectedLiveFlight
    ? selectedLiveFlight.flight_icao
    : selectedSchedFlight
    ? selectedSchedFlight.id
    : null

  const handleSelectScheduled = (id: string) => {
    onSelect(id)
    setSelectedLiveFlight(null)
    setOpen(false)
    setQ("")
  }

  const handleSelectLive = (lf: LiveFlight) => {
    setSelectedLiveFlight(lf)
    onSelect(null) // deselect simulated flight
    setOpen(false)
    setQ("")
  }

  const handleClear = () => {
    onSelect(null)
    setSelectedLiveFlight(null)
    setQ("")
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className={`flex items-center gap-2 surface-card px-3 h-10 transition-shadow ${open ? "ring-2 ring-primary/30" : ""}`}>
        {searching ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        ) : (
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={activeLabel
            ? `Selected: ${activeLabel} — search another…`
            : "Search any flight (AA123, UAL456, N12345, ORD)…"
          }
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        {activeLabel && (
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-[1000] left-0 right-0 mt-1 surface-floating overflow-hidden shadow-lg">
          <div className="max-h-[70vh] overflow-y-auto">

            {/* ── Live real flights section ── */}
            {(mergedLive.length > 0 || searching) && (
              <div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50/80 border-b border-sky-100 sticky top-0 z-10">
                  <Radio className="w-3 h-3 text-sky-600" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                    Live ADS-B Aircraft
                  </span>
                  {searching && <Loader2 className="w-3 h-3 text-sky-500 animate-spin ml-auto" />}
                </div>
                {mergedLive.map((lf) => {
                  const isSelected = selectedLiveFlight?.icao24 === lf.icao24
                  const altStr = lf.altitude_ft != null ? `${lf.altitude_ft.toLocaleString()} ft` : ""
                  const spdStr = lf.velocity_kt != null ? `${lf.velocity_kt} kt` : ""
                  return (
                    <div
                      key={lf.icao24}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-sky-50 transition-colors ${isSelected ? "bg-sky-50" : ""}`}
                    >
                      {/* Select button */}
                      <button
                        onClick={() => handleSelectLive(lf)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 animate-pulse" />
                        <Plane className="w-4 h-4 text-sky-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-foreground text-sm">{lf.flight_icao}</span>
                            {lf.flight_iata && lf.flight_iata !== lf.flight_icao && (
                              <span className="text-[10px] font-mono text-muted-foreground">{lf.flight_iata}</span>
                            )}
                            <span className="text-[9px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200 font-semibold">LIVE</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {lf.airline_name} {altStr && `· ${altStr}`} {spdStr && `· ${spdStr}`}
                          </div>
                        </div>
                      </button>

                      {/* Direct tracking link */}
                      {lf.tracking.flightaware && (
                        <a
                          href={lf.tracking.flightaware}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-muted-foreground hover:text-sky-600 transition-colors"
                          title="Open in FlightAware"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Simulated schedule section ── */}
            {scheduledMatches.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50/80 border-b border-orange-100 sticky top-0 z-10">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">
                    Nimbus Air Simulation
                  </span>
                </div>
                {scheduledMatches.map((f) => {
                  const state = flightStates[f.id]
                  const status = state?.status || "scheduled"
                  const delay = state?.delay_minutes || 0
                  const cascadeOrder = state?.cascade_order ?? -1
                  const isSel = selectedFlight === f.id
                  const o = NIMBUS_AIRPORTS[f.origin]
                  const d = NIMBUS_AIRPORTS[f.destination]
                  const dot =
                    status === "cancelled"   ? "bg-red-500" :
                    cascadeOrder === 0       ? "bg-orange-500" :
                    cascadeOrder >= 1        ? "bg-orange-300" :
                    delay > 0                ? "bg-amber-500" :
                                               "bg-emerald-500"
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectScheduled(f.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary transition-colors ${isSel ? "bg-primary/5" : ""}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                      <Plane className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-foreground">{f.id}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{f.aircraft_id}</span>
                          {delay > 0 && status !== "cancelled" && (
                            <span className="text-[10px] text-orange-600 font-medium">+{delay}m</span>
                          )}
                          {status === "cancelled" && (
                            <span className="text-[10px] text-red-600 font-semibold uppercase">cancelled</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {o?.iata || f.origin} {o?.city ? `(${o.city})` : ""} → {d?.iata || f.destination} {d?.city ? `(${d.city})` : ""}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Empty state ── */}
            {q.trim().length >= 2 && mergedLive.length === 0 && scheduledMatches.length === 0 && !searching && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <p>No flights matching "{q}".</p>
                <p className="text-xs mt-1 text-muted-foreground/70">Try a flight code like AA123, UAL456, or an airport like ORD.</p>
              </div>
            )}

            {/* ── Airport quick-jump (only when no query) ── */}
            {!q.trim() && (
              <div className="border-t border-border px-3 py-2 bg-secondary/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Jump to airport</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(NIMBUS_AIRPORTS).map(([icao, ap]) => (
                    <button
                      key={icao}
                      onClick={() => { setQ(icao); inputRef.current?.focus() }}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-card border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      {ap.iata}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Hint when showing limited results ── */}
            {q.trim().length < 2 && liveFlights.length > 0 && (
              <div className="px-3 py-1.5 border-t border-border bg-secondary/40 text-[10px] text-muted-foreground">
                {liveFlights.length.toLocaleString()} live aircraft tracked · type a flight code to search all of them
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
