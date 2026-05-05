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

export function FlightSearch({ selectedFlight, onSelect }: Props) {
  const { schedule, flightStates, liveFlights, setSelectedLiveFlight, selectedLiveFlight } =
    useSimulationStore()
  const [q, setQ]             = useState("")
  const [open, setOpen]       = useState(false)
  const [liveResults, setLiveResults]   = useState<LiveFlight[]>([])
  const [searching, setSearching]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

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

  const doLiveSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setLiveResults([]); return }
    setSearching(true)
    try {
      const res = await apiClient.get<{ results?: LiveFlight[] }>(
        `/flights/search?q=${encodeURIComponent(query)}`
      )
      setLiveResults(res.data.results || [])
    } catch {
      setLiveResults([])
    } finally {
      setSearching(false)
    }
  }, [])

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

  const mergedLive: LiveFlight[] = useMemo(() => {
    const seen = new Set<string>()
    const merged: LiveFlight[] = []
    for (const f of [...liveResults, ...localLiveMatches]) {
      if (!seen.has(f.icao24)) { seen.add(f.icao24); merged.push(f) }
    }
    return merged.slice(0, 10)
  }, [liveResults, localLiveMatches])

  const selectedSchedFlight = selectedFlight ? schedule.find((f) => f.id === selectedFlight) : null
  const activeLabel = selectedLiveFlight
    ? selectedLiveFlight.flight_icao
    : selectedSchedFlight
    ? selectedSchedFlight.id
    : null

  const handleSelectScheduled = (id: string) => {
    onSelect(id); setSelectedLiveFlight(null); setOpen(false); setQ("")
  }
  const handleSelectLive = (lf: LiveFlight) => {
    setSelectedLiveFlight(lf); onSelect(null); setOpen(false); setQ("")
  }
  const handleClear = () => {
    onSelect(null); setSelectedLiveFlight(null); setQ(""); inputRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Search input */}
      <div
        className={`flex items-center gap-3 rounded-2xl bg-white px-4 h-12 transition-all ${
          open ? "" : ""
        }`}
        style={{
          border: "1px solid #DDDDDD",
          boxShadow: open
            ? "0 0 0 3px rgba(13,148,136,0.15), 0 4px 16px rgba(0,0,0,0.10)"
            : "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        {searching ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: "#0D9488" }} />
        ) : (
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={
            activeLabel
              ? `Selected: ${activeLabel} — search another…`
              : "Search any flight — AA123, UAL456, N12345, or airport code…"
          }
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/70"
        />
        {activeLabel && (
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-[1000] left-0 right-0 mt-2 bg-white rounded-2xl overflow-hidden"
          style={{
            border: "1px solid #DDDDDD",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div className="max-h-[70vh] overflow-y-auto">

            {/* Live ADS-B section */}
            {(mergedLive.length > 0 || searching) && (
              <div>
                <div
                  className="flex items-center gap-2 px-4 py-2 sticky top-0 z-10 border-b"
                  style={{ background: "rgba(93,173,226,0.08)", borderColor: "rgba(93,173,226,0.20)" }}
                >
                  <Radio className="w-3.5 h-3.5" style={{ color: "#5DADE2" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#2471A3" }}>
                    Live ADS-B Aircraft
                  </span>
                  {searching && <Loader2 className="w-3 h-3 animate-spin ml-auto" style={{ color: "#5DADE2" }} />}
                </div>
                {mergedLive.map((lf) => {
                  const isSelected = selectedLiveFlight?.icao24 === lf.icao24
                  const altStr = lf.altitude_ft != null ? `${lf.altitude_ft.toLocaleString()} ft` : ""
                  const spdStr = lf.velocity_kt != null ? `${lf.velocity_kt} kt` : ""
                  return (
                    <div
                      key={lf.icao24}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                        isSelected ? "bg-sky-50" : "hover:bg-sky-50/60"
                      }`}
                    >
                      <button
                        onClick={() => handleSelectLive(lf)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 animate-pulse" />
                        <Plane className="w-4 h-4 text-sky-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-foreground text-sm">{lf.flight_icao}</span>
                            {lf.flight_iata && lf.flight_iata !== lf.flight_icao && (
                              <span className="text-[10px] font-mono text-muted-foreground">{lf.flight_iata}</span>
                            )}
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 font-bold">
                              LIVE
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {lf.airline_name}{altStr && ` · ${altStr}`}{spdStr && ` · ${spdStr}`}
                          </div>
                        </div>
                      </button>
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

            {/* Nimbus simulation section */}
            {scheduledMatches.length > 0 && (
              <div>
                <div
                  className="flex items-center gap-2 px-4 py-2 sticky top-0 z-10 border-b"
                  style={{ background: "rgba(255,210,63,0.08)", borderColor: "rgba(255,210,63,0.25)" }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#FFD23F" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#B8860B" }}>
                    Nimbus Air Simulation
                  </span>
                </div>
                {scheduledMatches.map((f) => {
                  const state = flightStates[f.id]
                  const status = state?.status || "scheduled"
                  const delay  = state?.delay_minutes || 0
                  const cascadeOrder = state?.cascade_order ?? -1
                  const isSel  = selectedFlight === f.id
                  const o = NIMBUS_AIRPORTS[f.origin]
                  const d = NIMBUS_AIRPORTS[f.destination]
                  const dotColor =
                    status === "cancelled" ? "#DC2626"
                    : cascadeOrder === 0   ? "#F97316"
                    : cascadeOrder >= 1    ? "#FCA5A5"
                    : delay > 0            ? "#F59E0B"
                    :                        "#0D9488"
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectScheduled(f.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-orange-50/40 ${
                        isSel ? "bg-orange-50/60" : ""
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                      <Plane className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-foreground">{f.id}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{f.aircraft_id}</span>
                          {delay > 0 && status !== "cancelled" && (
                            <span className="text-[10px] text-orange-600 font-semibold">+{delay}m</span>
                          )}
                          {status === "cancelled" && (
                            <span className="text-[10px] text-red-600 font-bold uppercase">cancelled</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {o?.iata || f.origin}{o?.city ? ` (${o.city})` : ""} → {d?.iata || f.destination}{d?.city ? ` (${d.city})` : ""}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Empty state */}
            {q.trim().length >= 2 && mergedLive.length === 0 && scheduledMatches.length === 0 && !searching && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <p>No flights matching &ldquo;{q}&rdquo;.</p>
                <p className="text-xs mt-1 text-muted-foreground/60">
                  Try a flight code like AA123, UAL456, or an airport like ORD.
                </p>
              </div>
            )}

            {/* Airport quick-jump */}
            {!q.trim() && (
              <div
                className="border-t px-4 py-3"
                style={{ borderColor: "#DDDDDD", background: "#F7F7F7" }}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#0D9488" }}>
                  Jump to Airport
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(NIMBUS_AIRPORTS).map(([icao, ap]) => (
                    <button
                      key={icao}
                      onClick={() => { setQ(icao); inputRef.current?.focus() }}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all hover:scale-105"
                      style={{
                        background: "white",
                        borderColor: "#DDDDDD",
                        color: "#717171",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#0D9488"
                        e.currentTarget.style.color = "white"
                        e.currentTarget.style.borderColor = "#0D9488"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "white"
                        e.currentTarget.style.color = "#717171"
                        e.currentTarget.style.borderColor = "#DDDDDD"
                      }}
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      {ap.iata}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live flight count hint */}
            {q.trim().length < 2 && liveFlights.length > 0 && (
              <div
                className="px-4 py-2 border-t text-[10px] text-muted-foreground"
                style={{ borderColor: "#DDDDDD" }}
              >
                {liveFlights.length.toLocaleString()} live aircraft tracked · type a flight code to search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
