"use client"
import "leaflet/dist/leaflet.css"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  MapContainer, TileLayer, Marker, Polyline,
  Tooltip, ZoomControl, useMap,
} from "react-leaflet"
import L from "leaflet"
import {
  useSimulationStore,
  type ScheduledFlight,
  type LiveFlight,
} from "@/stores/simulation"
import { NIMBUS_AIRPORTS, HUB_AIRPORTS } from "./airports"
import { apiClient } from "@/lib/api"

// ── Dead reckoning ────────────────────────────────────────────────────────────
// Smoothly move ADS-B planes every second between 15s API refreshes.
// Uses last known velocity + heading (great-circle projection).
function deadReckon(
  lat: number, lon: number,
  headingDeg: number, velKt: number,
  elapsedSec: number,
): [number, number] {
  const sec = Math.min(Math.max(elapsedSec, 0), 120)
  const distNm = velKt * (sec / 3600)
  if (distNm < 0.00005) return [lat, lon]
  const R   = 3440.065
  const d   = distNm / R
  const hdg = (headingDeg * Math.PI) / 180
  const φ1  = (lat * Math.PI) / 180
  const λ1  = (lon * Math.PI) / 180
  const φ2  = Math.asin(
    Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(hdg),
  )
  const λ2  = λ1 + Math.atan2(
    Math.sin(hdg) * Math.sin(d) * Math.cos(φ1),
    Math.cos(d) - Math.sin(φ1) * Math.sin(φ2),
  )
  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  return (
    ((Math.atan2(
      Math.sin(Δλ) * Math.cos(φ2),
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ),
    ) * 180) / Math.PI + 360) % 360
  )
}

function interp(lat1: number, lon1: number, lat2: number, lon2: number, t: number): [number, number] {
  return [lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t]
}

function isoToHour(iso: string): number {
  try { const d = new Date(iso); return d.getUTCHours() + d.getUTCMinutes() / 60 } catch { return 12 }
}

// ── Types ─────────────────────────────────────────────────────────────────────
type FAAStatus = {
  type: "ground_stop" | "ground_delay_program" | "departure_delay"
  delay_minutes: number
  reason: string
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function liveIcon(heading: number | null, isSelected: boolean, velKt: number | null) {
  const rot  = heading ?? 0
  const size = isSelected ? 30 : 22
  const fill = isSelected ? "#F87156" : "#38BDF8"
  const opacity = (velKt ?? 0) < 50 ? 0.5 : 1  // dim ground / slow aircraft
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${rot}deg);transform-origin:center;opacity:${opacity};">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
              fill="${fill}" stroke="rgba(255,255,255,0.9)" stroke-width="0.6"
              style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.35))"/>
      </svg>
    </div>`,
  })
}

function simIcon(color: string, rot: number, size = 22, pulse = false) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${rot}deg);transform-origin:center;${pulse ? "animation:pulse 1.4s infinite;" : ""}">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}">
        <path d="M12 2 L13.6 9.5 L22 12 L13.6 14.5 L12 22 L10.4 14.5 L2 12 L10.4 9.5 Z"
              fill="${color}" stroke="#fff" stroke-width="0.8" stroke-linejoin="round"
              style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.2))"/>
      </svg>
    </div>`,
  })
}

function airportIcon(
  isHub: boolean,
  faa: FAAStatus | undefined,
  hasWx: boolean,
  isSimEvt: boolean,
  isSelected: boolean,
) {
  const r = isHub ? 9 : 6
  let fill = isHub ? "#F87156" : "#374151"
  let ring = ""
  let topBadge = ""
  let botBadge = ""

  if (faa?.type === "ground_stop") {
    fill = "#DC2626"
    ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #DC2626;opacity:0.55;animation:ping 1.1s cubic-bezier(0,0,0.2,1) infinite;"></span>`
    topBadge = badge("#DC2626", "#fff", "GS")
  } else if (faa?.type === "ground_delay_program") {
    fill = "#EA580C"
    ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #EA580C;opacity:0.5;animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></span>`
    topBadge = badge("#EA580C", "#fff", faa.delay_minutes > 0 ? `+${faa.delay_minutes}m` : "GDP")
  } else if (faa?.type === "departure_delay") {
    fill = "#CA8A04"
    if (faa.delay_minutes > 0) topBadge = badge("#CA8A04", "#fff", `+${faa.delay_minutes}m`)
  } else if (isSimEvt) {
    fill = "#F87156"
    ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #F87156;opacity:0.45;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>`
  }

  if (hasWx) botBadge = badge("#7C3AED", "#fff", "⚡WX", true)

  const sel = isSelected
    ? `<span style="position:absolute;inset:-5px;border-radius:9999px;border:2.5px solid #F87156;"></span>`
    : ""

  const s = r * 2 + 28
  return L.divIcon({
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;">
      ${sel}${ring}${topBadge}${botBadge}
      <span style="position:relative;width:${r*2}px;height:${r*2}px;background:${fill};border:2.5px solid #fff;border-radius:9999px;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:block;"></span>
    </div>`,
  })
}

function badge(bg: string, color: string, text: string, bottom = false) {
  const pos = bottom ? "bottom:-9px" : "top:-9px"
  return `<span style="position:absolute;${pos};left:50%;transform:translateX(-50%);background:${bg};color:${color};font-size:7px;font-weight:800;padding:1px 4px;border-radius:3px;white-space:nowrap;font-family:ui-monospace,monospace;letter-spacing:.3px;">${text}</span>`
}

// ── Map sub-components ────────────────────────────────────────────────────────
function FitBounds({ flights }: { flights: ScheduledFlight[] }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || flights.length === 0) return
    const pts = flights.flatMap((f) => {
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      return [o, d].filter(Boolean) as { lat: number; lon: number }[]
    })
    if (!pts.length) return
    map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon])).pad(0.15), { animate: false })
    done.current = true
  }, [flights, map])
  return null
}

function FocusFlight({ target }: { target: ScheduledFlight | LiveFlight | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    if ("icao24" in target) { map.flyTo([target.lat, target.lon], 9, { duration: 0.7 }); return }
    const o = NIMBUS_AIRPORTS[(target as ScheduledFlight).origin]
    const d = NIMBUS_AIRPORTS[(target as ScheduledFlight).destination]
    if (o && d) map.flyToBounds(L.latLngBounds([[o.lat, o.lon], [d.lat, d.lon]]).pad(0.5), { duration: 0.6 })
  }, [target, map])
  return null
}

// ── Live flight panel ─────────────────────────────────────────────────────────
function LivePanel({ flight, onClose }: { flight: LiveFlight; onClose: () => void }) {
  const alt  = flight.altitude_ft != null ? `${flight.altitude_ft.toLocaleString()} ft` : "—"
  const spd  = flight.velocity_kt != null ? `${flight.velocity_kt} kt` : "—"
  const vs   = flight.vertical_fpm != null
    ? `${flight.vertical_fpm > 100 ? "▲" : flight.vertical_fpm < -100 ? "▼" : "→"} ${Math.abs(flight.vertical_fpm).toLocaleString()} fpm`
    : "—"
  const hdg  = flight.heading != null ? `${Math.round(flight.heading)}°` : "—"

  return (
    <div className="absolute top-3 right-3 left-3 sm:left-auto z-[450] surface-floating p-4 max-w-sm shadow-xl border border-sky-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Callsign + badges */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
            <span className="font-mono font-bold text-base">{flight.flight_icao}</span>
            {flight.flight_iata && flight.flight_iata !== flight.flight_icao && (
              <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{flight.flight_iata}</span>
            )}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 border border-sky-200 text-sky-700 font-bold tracking-wider">LIVE ADS-B</span>
          </div>

          <div className="text-xs text-muted-foreground font-medium mb-3">
            {flight.airline_name}
            {flight.origin_country && flight.origin_country !== "United States" && ` · ${flight.origin_country}`}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] mb-3 bg-secondary/40 rounded-lg p-2.5">
            {[
              ["Altitude", alt, ""],
              ["Groundspeed", spd, ""],
              ["Vert speed", vs, (flight.vertical_fpm ?? 0) > 200 ? "text-emerald-600" : (flight.vertical_fpm ?? 0) < -200 ? "text-orange-600" : ""],
              ["Heading", hdg, ""],
              ...(flight.squawk ? [["Squawk", flight.squawk, ""]] : []),
              ["ICAO24", flight.icao24, "text-[10px] text-muted-foreground"],
            ].map(([label, val, cls]) => (
              <div key={label as string}>
                <div className="text-muted-foreground text-[10px]">{label}</div>
                <div className={`font-mono font-semibold ${cls}`}>{val}</div>
              </div>
            ))}
          </div>

          {/* Tracking links */}
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Verify on</div>
          <div className="flex flex-wrap gap-1.5">
            {flight.tracking.flightaware && (
              <a href={flight.tracking.flightaware} target="_blank" rel="noopener noreferrer"
                className="text-[10px] px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-semibold transition-colors">
                FlightAware ↗
              </a>
            )}
            <a href={flight.tracking.flightradar24} target="_blank" rel="noopener noreferrer"
              className="text-[10px] px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 font-semibold transition-colors">
              Flightradar24 ↗
            </a>
            <a href={flight.tracking.adsbexchange} target="_blank" rel="noopener noreferrer"
              className="text-[10px] px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold transition-colors">
              ADS-B Exchange ↗
            </a>
          </div>
        </div>

        <button onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xl w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-secondary transition-colors">×</button>
      </div>
    </div>
  )
}

// ── Airport panel ─────────────────────────────────────────────────────────────
function AirportPanel({
  icao, faa, hasWx, wxText, simAffected, onClose,
}: {
  icao: string; faa: FAAStatus | undefined; hasWx: boolean
  wxText: string; simAffected: boolean; onClose: () => void
}) {
  const ap = NIMBUS_AIRPORTS[icao]
  if (!ap) return null

  return (
    <div className="absolute bottom-16 left-3 z-[450] surface-floating p-4 max-w-xs shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono font-bold text-sm">{ap.iata}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{icao}</span>
            {HUB_AIRPORTS.has(icao) && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">HUB</span>}
          </div>
          <div className="text-xs text-muted-foreground mb-3">{ap.name} · {ap.city}</div>

          <div className="space-y-2 text-[11px]">
            {!faa && !hasWx && !simAffected && (
              <div className="flex items-center gap-2 text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                No active FAA programs — normal operations
              </div>
            )}
            {faa?.type === "ground_stop" && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
                <div className="font-bold text-red-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  GROUND STOP
                </div>
                {faa.reason && <div className="text-red-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
              </div>
            )}
            {faa?.type === "ground_delay_program" && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5">
                <div className="font-bold text-orange-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  GROUND DELAY PROGRAM{faa.delay_minutes > 0 && <span className="font-mono ml-1">avg +{faa.delay_minutes} min</span>}
                </div>
                {faa.reason && <div className="text-orange-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
              </div>
            )}
            {faa?.type === "departure_delay" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                <div className="font-bold text-amber-700">
                  ⏱ Departure delay{faa.delay_minutes > 0 && <span className="font-mono ml-1">+{faa.delay_minutes} min</span>}
                </div>
                {faa.reason && <div className="text-amber-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
              </div>
            )}
            {hasWx && (
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-2.5">
                <div className="font-bold text-purple-700">⚡ NWS Weather Alert</div>
                {wxText && <div className="text-purple-600/80 text-[10px] mt-0.5 line-clamp-2">{wxText}</div>}
              </div>
            )}
            {simAffected && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                <div className="text-primary text-[10px] font-semibold">⚠ Nimbus Air sim event active at this airport</div>
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xl w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-secondary">×</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  selectedFlight: string | null
  onFlightSelect: (id: string | null) => void
}

export default function FlightMap({ selectedFlight, onFlightSelect }: Props) {
  const {
    schedule, flightStates, activeEvents, recoveryPlans, appliedPlanId,
    liveFlights, showLiveFlights, showSimulation,
    selectedLiveFlight, setSelectedLiveFlight,
    setLiveFlights, setShowLiveFlights, setShowSimulation,
  } = useSimulationStore()

  const [nowMs, setNowMs]   = useState<number>(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null)
  const [airportFAA, setAirportFAA] = useState<Record<string, FAAStatus>>({})
  const [wxAirports, setWxAirports] = useState<Record<string, string>>({})

  // 1-second tick drives dead reckoning
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [])

  // Live ADS-B — 15s refresh, filter to airline flights only
  const fetchLive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get("/flights/live?limit=1500&on_ground=false")
      const all: LiveFlight[] = res.data.flights || []
      // Keep only flights that have a known airline (IATA code set)
      const airline = all.filter((f) => f.airline_iata && f.airline_name !== "Unknown")
      setLiveFlights(airline, Date.now())
      setLastFetch(Date.now())
    } catch { /* degrade silently */ } finally {
      setLoading(false)
    }
  }, [setLiveFlights])

  useEffect(() => {
    fetchLive()
    const t = setInterval(fetchLive, 15_000)
    return () => clearInterval(t)
  }, [fetchLive])

  // FAA status — 90s refresh
  const fetchFAA = useCallback(async () => {
    try {
      const res = await apiClient.get("/live/faa-status")
      const map: Record<string, FAAStatus> = {}
      for (const p of res.data.programs || []) {
        const icao: string = p.airport_icao
        if (!icao) continue
        const rank = (t: string) => t === "ground_stop" ? 3 : t === "ground_delay_program" ? 2 : 1
        const cur = map[icao]
        if (!cur || rank(p.type) > rank(cur.type)) {
          map[icao] = { type: p.type, delay_minutes: p.avg_delay_minutes ?? 0, reason: p.reason ?? "" }
        }
      }
      setAirportFAA(map)
    } catch { /* noop */ }
  }, [])

  // NWS weather — 2 min refresh
  const fetchWx = useCallback(async () => {
    try {
      const res = await apiClient.get("/live/weather-alerts")
      const map: Record<string, string> = {}
      for (const a of res.data.alerts || []) {
        for (const icao of (a.affected_nimbus_airports || [])) {
          if (!map[icao]) map[icao] = `${a.event}${a.headline ? " — " + a.headline : ""}`
        }
      }
      setWxAirports(map)
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    fetchFAA(); fetchWx()
    const t1 = setInterval(fetchFAA, 90_000)
    const t2 = setInterval(fetchWx, 120_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchFAA, fetchWx])

  // Applied plan sets
  const applied = useMemo(() => {
    const plan = appliedPlanId ? recoveryPlans.find((p) => p.plan_id === appliedPlanId) : null
    return {
      cancelled: new Set<string>(plan?.cancelled_flights || []),
      swap:      new Set<string>((plan?.aircraft_swaps || []).map((s: any) => s.flight_id)),
    }
  }, [appliedPlanId, recoveryPlans])

  // Airports with active sim events
  const simEvtAirports = useMemo(() => {
    const s = new Set<string>()
    for (const e of activeEvents) {
      const p = e.params || {}
      if (p.airport) s.add(p.airport)
      if (p.base)    s.add(p.base)
      if (p.destination_airport) s.add(p.destination_airport)
    }
    return s
  }, [activeEvents])

  // Dead-reckoned live positions (recomputed every second)
  const livePlanes = useMemo(() => {
    const nowSec = nowMs / 1000
    return liveFlights.map((lf) => {
      if (
        !lf.on_ground &&
        lf.heading != null &&
        lf.velocity_kt != null &&
        lf.velocity_kt > 80 &&
        lf.last_contact > 0
      ) {
        const elapsed = nowSec - lf.last_contact
        if (elapsed >= 0 && elapsed < 300) {
          const [lat, lon] = deadReckon(lf.lat, lf.lon, lf.heading, lf.velocity_kt, elapsed)
          return { lf, lat, lon }
        }
      }
      return { lf, lat: lf.lat, lon: lf.lon }
    })
  }, [liveFlights, nowMs])

  // Simulated Nimbus planes
  const simPlanes = useMemo(() => {
    if (!showSimulation) return []
    const cycle = 60 * 6
    const phase = ((nowMs / 1000) % cycle) / cycle
    const hr    = 6 + phase * 18
    return schedule.map((f) => {
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) return null
      const dep = isoToHour(f.scheduled_departure), arr = isoToHour(f.scheduled_arrival)
      if (arr <= dep || hr < dep || hr > arr) return null
      const t = (hr - dep) / (arr - dep)
      const [lat, lon] = interp(o.lat, o.lon, d.lat, d.lon, Math.max(0.02, Math.min(0.98, t)))
      return { id: f.id, f, lat, lon, brg: bearing(o.lat, o.lon, d.lat, d.lon) }
    }).filter(Boolean) as { id: string; f: ScheduledFlight; lat: number; lon: number; brg: number }[]
  }, [schedule, nowMs, showSimulation])

  const selectedSched  = selectedFlight ? schedule.find((f) => f.id === selectedFlight) || null : null
  const focusTarget: ScheduledFlight | LiveFlight | null = selectedSched || selectedLiveFlight
  const ageSec = lastFetch ? Math.round((nowMs - lastFetch) / 1000) : null

  function simColor(fid: string, state: any) {
    if (applied.cancelled.has(fid)) return "#E84545"
    if (applied.swap.has(fid))      return "#F87156"
    if (!state) return "#2DA56F"
    if (state.status === "cancelled") return "#E84545"
    if (state.cascade_order === 0) return "#F97316"
    if (state.cascade_order === 1) return "#FB923C"
    if (state.cascade_order === 2) return "#FCA5A5"
    return "#2DA56F"
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[39.5, -98.0]} zoom={4} minZoom={2} maxZoom={14}
        zoomControl={false} scrollWheelZoom worldCopyJump={false}
        className="w-full h-full" style={{ background: "#EBE5D8" }}
      >
        <ZoomControl position="topright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd" maxZoom={19}
        />
        <FitBounds flights={schedule} />
        <FocusFlight target={focusTarget} />

        {/* ── Simulated routes (only when sim layer on) ── */}
        {showSimulation && schedule.map((f) => {
          const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
          if (!o || !d) return null
          const state  = flightStates[f.id]
          const color  = simColor(f.id, state)
          const sel    = selectedFlight === f.id
          const casc   = state?.cascade_order ?? -1
          return (
            <Polyline key={f.id}
              positions={[[o.lat, o.lon], [d.lat, d.lon]]}
              pathOptions={{
                color, weight: sel ? 3 : casc >= 0 ? 2 : 1,
                opacity: sel ? 0.9 : casc >= 0 ? 0.65 : 0.18,
                dashArray: applied.cancelled.has(f.id) ? "8 6" : casc < 0 && !sel ? "3 6" : undefined,
              }}
              eventHandlers={{ click: () => onFlightSelect(sel ? null : f.id) }}
            />
          )
        })}

        {/* ── Live ADS-B trails ── */}
        {showLiveFlights && livePlanes.map(({ lf, lat, lon }) => {
          if (!lf.heading || (lf.velocity_kt ?? 0) < 80) return null
          const [tLat, tLon] = deadReckon(lat, lon, (lf.heading + 180) % 360, lf.velocity_kt!, 50)
          const sel = selectedLiveFlight?.icao24 === lf.icao24
          return (
            <Polyline key={`trail-${lf.icao24}`}
              positions={[[tLat, tLon], [lat, lon]]}
              pathOptions={{ color: sel ? "#F87156" : "#38BDF8", weight: sel ? 2.5 : 1.5, opacity: sel ? 0.85 : 0.4 }}
            />
          )
        })}

        {/* ── Airport nodes ── */}
        {Object.entries(NIMBUS_AIRPORTS).map(([id, ap]) => (
          <Marker key={id}
            position={[ap.lat, ap.lon]}
            icon={airportIcon(HUB_AIRPORTS.has(id), airportFAA[id], id in wxAirports, simEvtAirports.has(id), selectedAirport === id)}
            zIndexOffset={airportFAA[id] ? 1200 : HUB_AIRPORTS.has(id) ? 600 : 100}
            eventHandlers={{ click: () => {
              setSelectedAirport(selectedAirport === id ? null : id)
              onFlightSelect(null); setSelectedLiveFlight(null)
            }}}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={1}>
              <div className="text-xs">
                <div className="font-mono font-bold">{ap.iata} · {id}</div>
                <div className="text-[10px] text-muted-foreground">{ap.name}, {ap.city}</div>
                {airportFAA[id] && (
                  <div className="text-[10px] font-semibold mt-0.5" style={{
                    color: airportFAA[id].type === "ground_stop" ? "#DC2626" : "#EA580C"
                  }}>
                    {airportFAA[id].type === "ground_stop" ? "🔴 Ground Stop" :
                     airportFAA[id].type === "ground_delay_program"
                       ? `🟠 GDP +${airportFAA[id].delay_minutes}m` : `🟡 +${airportFAA[id].delay_minutes}m dep delay`}
                  </div>
                )}
                {id in wxAirports && <div className="text-[10px] text-purple-600">⚡ WX Alert</div>}
                <div className="text-[9px] text-muted-foreground/60 mt-0.5">Click for details</div>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* ── Simulated aircraft (only when sim layer on) ── */}
        {simPlanes.map(({ id, f, lat, lon, brg }) => {
          const state = flightStates[id]
          const color = simColor(id, state)
          const sel   = selectedFlight === id
          return (
            <Marker key={`sim-${id}`} position={[lat, lon]}
              icon={simIcon(color, brg, sel ? 30 : 20, (state?.cascade_order ?? -1) === 0)}
              zIndexOffset={sel ? 2000 : 300}
              eventHandlers={{ click: () => onFlightSelect(sel ? null : id) }}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                <div className="text-xs">
                  <div className="font-mono font-bold">{id} <span className="text-[9px] text-orange-500 font-normal">[SIM]</span></div>
                  <div className="text-[10px] text-muted-foreground">{f.aircraft_id} · {f.origin} → {f.destination}</div>
                  {state?.delay_minutes > 0 && <div className="text-[10px] text-orange-600">+{state.delay_minutes} min delay</div>}
                  {state?.cascade_order === 0 && <div className="text-[10px] text-red-600 font-semibold">⚠ Direct impact</div>}
                </div>
              </Tooltip>
            </Marker>
          )
        })}

        {/* ── Real live airline aircraft ── */}
        {showLiveFlights && livePlanes.map(({ lf, lat, lon }) => {
          const sel = selectedLiveFlight?.icao24 === lf.icao24
          return (
            <Marker key={`live-${lf.icao24}`} position={[lat, lon]}
              icon={liveIcon(lf.heading, sel, lf.velocity_kt)}
              zIndexOffset={sel ? 1900 : 400}
              eventHandlers={{ click: () => {
                setSelectedLiveFlight(sel ? null : lf)
                onFlightSelect(null); setSelectedAirport(null)
              }}}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                <div className="text-xs">
                  <div className="font-mono font-bold">
                    {lf.flight_iata || lf.flight_icao}
                    {lf.flight_iata && lf.flight_icao !== lf.flight_iata &&
                      <span className="text-[9px] text-muted-foreground ml-1">({lf.flight_icao})</span>}
                    <span className="ml-1.5 text-[8px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200 font-bold">LIVE</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{lf.airline_name}</div>
                  {lf.altitude_ft != null && (
                    <div className="text-[10px] font-mono">{lf.altitude_ft.toLocaleString()} ft · {lf.velocity_kt} kt</div>
                  )}
                  <div className="text-[9px] text-sky-500 mt-0.5">Click for details + tracking links</div>
                </div>
              </Tooltip>
            </Marker>
          )
        })}
      </MapContainer>

      {/* ── Live flight panel ── */}
      {selectedLiveFlight && (
        <LivePanel flight={selectedLiveFlight} onClose={() => setSelectedLiveFlight(null)} />
      )}

      {/* ── Sim flight panel ── */}
      {selectedSched && !selectedLiveFlight && (() => {
        const state = flightStates[selectedSched.id]
        return (
          <div className="absolute top-3 right-3 left-3 sm:left-auto z-[450] surface-floating p-3.5 max-w-xs sm:max-w-sm shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="font-mono font-bold">{selectedSched.id}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{selectedSched.aircraft_id}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 font-bold">SIMULATION</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2.5">
                  <span className="font-mono font-medium text-foreground">{selectedSched.origin}</span>
                  <span>→</span>
                  <span className="font-mono font-medium text-foreground">{selectedSched.destination}</span>
                </div>
                {state && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] bg-secondary/40 rounded-lg p-2.5">
                    <div>
                      <div className="text-muted-foreground text-[10px]">Status</div>
                      <div className={`font-semibold ${state.status === "cancelled" ? "text-red-600" : state.delay_minutes > 0 ? "text-orange-600" : "text-emerald-600"}`}>{state.status}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px]">Cascade</div>
                      <div className="font-semibold">{state.cascade_order < 0 ? "None" : state.cascade_order === 0 ? "Direct" : `Order ${state.cascade_order}`}</div>
                    </div>
                    {state.delay_minutes > 0 && (
                      <div>
                        <div className="text-muted-foreground text-[10px]">Delay</div>
                        <div className="font-semibold text-orange-600">+{state.delay_minutes} min</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground text-[10px]">P(delay)</div>
                      <div className="font-semibold">{(state.p_delayed * 100).toFixed(0)}%</div>
                    </div>
                    {state.reason && <div className="col-span-2 text-[10px] text-muted-foreground italic">{state.reason}</div>}
                  </div>
                )}
              </div>
              <button onClick={() => onFlightSelect(null)}
                className="text-muted-foreground hover:text-foreground text-xl w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-secondary">×</button>
            </div>
          </div>
        )
      })()}

      {/* ── Airport panel ── */}
      {selectedAirport && !selectedLiveFlight && !selectedSched && (
        <AirportPanel
          icao={selectedAirport}
          faa={airportFAA[selectedAirport]}
          hasWx={selectedAirport in wxAirports}
          wxText={wxAirports[selectedAirport] || ""}
          simAffected={simEvtAirports.has(selectedAirport)}
          onClose={() => setSelectedAirport(null)}
        />
      )}

      {/* ── Top bar: data source + counters ── */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        {/* Live data badge */}
        <div className="surface-floating px-3 py-2 flex items-center gap-2 text-[11px]">
          <span className={`w-2 h-2 rounded-full shrink-0 ${loading ? "bg-amber-400 animate-pulse" : liveFlights.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span className="font-bold text-foreground">
            {liveFlights.length > 0 ? `${liveFlights.length.toLocaleString()} airline flights` : "Connecting…"}
          </span>
          {ageSec != null && <span className="text-muted-foreground/70 font-mono text-[9px]">· {ageSec}s ago</span>}
          <span className="text-[9px] text-muted-foreground/50 ml-1">OpenSky ADS-B</span>
        </div>

        {/* Active sim events */}
        {activeEvents.map((ev) => (
          <div key={ev.id} className="surface-floating px-3 py-1.5 text-[11px] border-l-2 border-primary">
            <div className="text-[9px] uppercase tracking-wider font-bold text-primary">{ev.kind?.replace(/_/g, " ")}</div>
            <div className="text-foreground/80 text-[10px]">{ev.params?.airport || ev.params?.aircraft_tail || ev.params?.base || "Network-wide"}</div>
          </div>
        ))}
      </div>

      {/* ── Bottom controls ── */}
      <div className="absolute bottom-3 right-3 z-[400] flex flex-col items-end gap-2">
        {/* Layer toggles */}
        <div className="surface-floating px-3 py-2 flex flex-col gap-2 text-[11px]">
          <button
            onClick={() => setShowLiveFlights(!showLiveFlights)}
            className={`flex items-center gap-2 font-semibold transition-colors ${showLiveFlights ? "text-sky-600" : "text-muted-foreground"}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${showLiveFlights ? "bg-sky-400 animate-pulse" : "bg-muted-foreground"}`} />
            Real flights (ADS-B)
          </button>
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className={`flex items-center gap-2 font-semibold transition-colors ${showSimulation ? "text-orange-600" : "text-muted-foreground"}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${showSimulation ? "bg-orange-400" : "bg-muted-foreground"}`} />
            Nimbus Air simulation
          </button>
        </div>
      </div>

      {/* ── Legend (bottom left) ── */}
      <div className="absolute bottom-3 left-3 z-[400] surface-floating px-3 py-2.5 text-[10px] space-y-1">
        <div className="font-bold text-muted-foreground uppercase tracking-wider text-[8px] mb-1.5">Live ADS-B</div>
        <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-full bg-sky-400 shrink-0" /><span className="text-muted-foreground">Airline flight (real)</span></div>
        <div className="border-t border-border pt-1.5 mt-1.5">
          <div className="font-bold text-muted-foreground uppercase tracking-wider text-[8px] mb-1.5">Airports</div>
          {[["#DC2626","Ground Stop"],["#EA580C","Ground Delay"],["#CA8A04","Dep delay"],["#7C3AED","WX Alert"]].map(([c,l]) => (
            <div key={l} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{background:c}} />
              <span className="text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>
        {showSimulation && (
          <div className="border-t border-border pt-1.5 mt-1.5">
            <div className="font-bold text-muted-foreground uppercase tracking-wider text-[8px] mb-1.5">Simulation</div>
            {[["#2DA56F","On-time"],["#F97316","Direct impact"],["#E84545","Cancelled"]].map(([c,l]) => (
              <div key={l} className="flex items-center gap-2">
                <span className="w-3 h-1.5 rounded-full shrink-0" style={{background:c}} />
                <span className="text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
