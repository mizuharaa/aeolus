"use client"
import "leaflet/dist/leaflet.css"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  MapContainer, TileLayer, Marker, Polyline, Circle,
  Tooltip, ZoomControl, useMap, useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import {
  useSimulationStore,
  type ScheduledFlight,
  type LiveFlight,
} from "@/stores/simulation"
import { NIMBUS_AIRPORTS, HUB_AIRPORTS } from "./airports"
import { apiClient } from "@/lib/api"

// ── Dead reckoning ─────────────────────────────────────────────────────────────
function deadReckon(lat: number, lon: number, hdgDeg: number, velKt: number, sec: number): [number, number] {
  const s = Math.min(Math.max(sec, 0), 120)
  const distNm = velKt * (s / 3600)
  if (distNm < 0.0001) return [lat, lon]
  const R = 3440.065, d = distNm / R
  const hdg = (hdgDeg * Math.PI) / 180
  const φ1 = (lat * Math.PI) / 180, λ1 = (lon * Math.PI) / 180
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(hdg))
  const λ2 = λ1 + Math.atan2(Math.sin(hdg) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2))
  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI]
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  return (((Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * 180) / Math.PI) + 360) % 360
}

function interp(lat1: number, lon1: number, lat2: number, lon2: number, t: number): [number, number] {
  return [lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t]
}

function isoToHour(iso: string): number {
  try { const d = new Date(iso); return d.getUTCHours() + d.getUTCMinutes() / 60 } catch { return 12 }
}

// ── Icon cache: avoid recreating identical DivIcons every 2s tick ──────────────
const _cache = new Map<string, L.DivIcon>()
function icon(key: string, factory: () => L.DivIcon): L.DivIcon {
  if (!_cache.has(key)) _cache.set(key, factory())
  return _cache.get(key)!
}

function liveIcon(heading: number | null, sel: boolean, velKt: number | null): L.DivIcon {
  const hdg = Math.round((heading ?? 0) / 5) * 5
  const slow = (velKt ?? 0) < 50
  const key = `lv|${hdg}|${sel}|${slow}`
  return icon(key, () => {
    const sz = sel ? 28 : 18
    const fill = sel ? "#F87156" : "#38BDF8"
    const op = slow ? 0.45 : 1
    return L.divIcon({
      className: "",
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2],
      html: `<div style="width:${sz}px;height:${sz}px;transform:rotate(${hdg}deg);transform-origin:center;opacity:${op}"><svg viewBox="0 0 24 24" width="${sz}" height="${sz}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="${fill}" stroke="rgba(255,255,255,0.9)" stroke-width="0.6"/></svg></div>`,
    })
  })
}

function simIcon(color: string, rot: number, sel: boolean): L.DivIcon {
  const r = Math.round(rot / 5) * 5
  const sz = sel ? 24 : 16
  const key = `sim|${r}|${color}|${sel}`
  return icon(key, () =>
    L.divIcon({
      className: "",
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2],
      html: `<div style="width:${sz}px;height:${sz}px;transform:rotate(${r}deg);transform-origin:center"><svg viewBox="0 0 24 24" width="${sz}" height="${sz}"><path d="M12 2L13.6 9.5L22 12L13.6 14.5L12 22L10.4 14.5L2 12L10.4 9.5Z" fill="${color}" stroke="#fff" stroke-width="0.8"/></svg></div>`,
    })
  )
}

function apBadge(bg: string, text: string, bottom = false): string {
  const pos = bottom ? "bottom:-9px" : "top:-9px"
  return `<span style="position:absolute;${pos};left:50%;transform:translateX(-50%);background:${bg};color:#fff;font-size:7px;font-weight:800;padding:1px 4px;border-radius:3px;white-space:nowrap;font-family:ui-monospace,monospace">${text}</span>`
}

type FAAStatus = { type: "ground_stop" | "ground_delay_program" | "departure_delay"; delay_minutes: number; reason: string }

function airportIcon(isHub: boolean, faa: FAAStatus | undefined, hasWx: boolean, isEvt: boolean, isSel: boolean): L.DivIcon {
  const fk = faa ? `${faa.type}:${faa.delay_minutes}` : "none"
  const key = `ap|${isHub}|${fk}|${hasWx}|${isEvt}|${isSel}`
  return icon(key, () => {
    const r = isHub ? 9 : 6
    let fill = isHub ? "#F87156" : "#374151"
    let ring = "", top = "", bot = ""
    if (faa?.type === "ground_stop") {
      fill = "#DC2626"
      ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #DC2626;opacity:0.55;animation:ping 1.1s cubic-bezier(0,0,0.2,1) infinite"></span>`
      top = apBadge("#DC2626", "GS")
    } else if (faa?.type === "ground_delay_program") {
      fill = "#EA580C"
      ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #EA580C;opacity:0.5;animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite"></span>`
      top = apBadge("#EA580C", faa.delay_minutes > 0 ? `+${faa.delay_minutes}m` : "GDP")
    } else if (faa?.type === "departure_delay") {
      fill = "#CA8A04"
      if (faa.delay_minutes > 0) top = apBadge("#CA8A04", `+${faa.delay_minutes}m`)
    } else if (isEvt) {
      fill = "#F87156"
      ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #F87156;opacity:0.5;animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite"></span>`
    }
    if (hasWx) bot = apBadge("#7C3AED", "⚡WX", true)
    const sel = isSel ? `<span style="position:absolute;inset:-5px;border-radius:9999px;border:2.5px solid #F87156"></span>` : ""
    const s = r * 2 + 28
    return L.divIcon({
      className: "",
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
      html: `<div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center">${sel}${ring}${top}${bot}<span style="position:relative;width:${r*2}px;height:${r*2}px;background:${fill};border:2.5px solid #fff;border-radius:9999px;box-shadow:0 2px 8px rgba(0,0,0,.2);display:block"></span></div>`,
    })
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) })
  return null
}

function FitBounds({ flights }: { flights: ScheduledFlight[] }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !flights.length) return
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

// ── Live flight panel ──────────────────────────────────────────────────────────
function LivePanel({ flight, onClose }: { flight: LiveFlight; onClose: () => void }) {
  const alt = flight.altitude_ft != null ? `${flight.altitude_ft.toLocaleString()} ft` : "—"
  const spd = flight.velocity_kt != null ? `${flight.velocity_kt} kt` : "—"
  const vs  = flight.vertical_fpm != null
    ? `${flight.vertical_fpm > 100 ? "▲" : flight.vertical_fpm < -100 ? "▼" : "→"} ${Math.abs(flight.vertical_fpm).toLocaleString()} fpm`
    : "—"
  const hdg = flight.heading != null ? `${Math.round(flight.heading)}°` : "—"
  return (
    <div className="absolute top-3 right-3 left-3 sm:left-auto z-[450] surface-floating p-3.5 max-w-sm shadow-xl border border-sky-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
            <span className="font-mono font-bold">{flight.flight_icao}</span>
            {flight.flight_iata && flight.flight_iata !== flight.flight_icao && (
              <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{flight.flight_iata}</span>
            )}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 border border-sky-200 text-sky-700 font-bold">LIVE ADS-B</span>
          </div>
          <div className="text-xs text-muted-foreground mb-2.5">{flight.airline_name}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mb-2.5 bg-secondary/40 rounded-lg p-2.5">
            {([["Alt", alt], ["Speed", spd], ["V/S", vs], ["Hdg", hdg], ...(flight.squawk ? [["Squawk", flight.squawk]] : []), ["ICAO24", flight.icao24]] as [string, string][]).map(([label, val]) => (
              <div key={label}>
                <div className="text-muted-foreground text-[10px]">{label}</div>
                <div className="font-mono font-semibold text-xs">{val}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {flight.tracking.flightaware && (
              <a href={flight.tracking.flightaware} target="_blank" rel="noopener noreferrer"
                className="text-[10px] px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-semibold">FlightAware ↗</a>
            )}
            <a href={flight.tracking.flightradar24} target="_blank" rel="noopener noreferrer"
              className="text-[10px] px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 font-semibold">FR24 ↗</a>
            <a href={flight.tracking.adsbexchange} target="_blank" rel="noopener noreferrer"
              className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold">ADS-B Exchange ↗</a>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-secondary">×</button>
      </div>
    </div>
  )
}

// ── Airport panel ──────────────────────────────────────────────────────────────
function AirportPanel({ icao, faa, hasWx, wxText, simAffected, onClose }: {
  icao: string; faa: FAAStatus | undefined; hasWx: boolean; wxText: string; simAffected: boolean; onClose: () => void
}) {
  const ap = NIMBUS_AIRPORTS[icao]
  if (!ap) return null
  return (
    <div className="absolute bottom-16 left-3 z-[450] surface-floating p-3.5 max-w-xs shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono font-bold text-sm">{ap.iata}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{icao}</span>
            {HUB_AIRPORTS.has(icao) && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-ink/10 border border-ink/15 text-ink font-bold">HUB</span>}
          </div>
          <div className="text-xs text-muted-foreground mb-2.5">{ap.name} · {ap.city}</div>
          <div className="space-y-1.5 text-[11px]">
            {!faa && !hasWx && !simAffected && (
              <div className="flex items-center gap-2 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Normal ops
              </div>
            )}
            {faa?.type === "ground_stop" && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-2">
                <div className="font-bold text-red-700 text-xs">🔴 GROUND STOP</div>
                {faa.reason && <div className="text-red-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
              </div>
            )}
            {faa?.type === "ground_delay_program" && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-2">
                <div className="font-bold text-orange-700 text-xs">🟠 GDP{faa.delay_minutes > 0 && ` avg +${faa.delay_minutes} min`}</div>
                {faa.reason && <div className="text-orange-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
              </div>
            )}
            {faa?.type === "departure_delay" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                <div className="font-bold text-amber-700 text-xs">⏱ Dep delay{faa.delay_minutes > 0 && ` +${faa.delay_minutes} min`}</div>
                {faa.reason && <div className="text-amber-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
              </div>
            )}
            {hasWx && (
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-2">
                <div className="font-bold text-purple-700 text-xs">⚡ NWS Alert</div>
                {wxText && <div className="text-purple-600/80 text-[10px] mt-0.5 line-clamp-2">{wxText}</div>}
              </div>
            )}
            {simAffected && (
              <div className="rounded-lg bg-ink/5 border border-ink/15 p-2">
                <div className="text-ink text-[10px] font-semibold">⚠ Sim disruption active here</div>
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-secondary">×</button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props { selectedFlight: string | null; onFlightSelect: (id: string | null) => void }

export default function FlightMap({ selectedFlight, onFlightSelect }: Props) {
  const {
    schedule, flightStates, activeEvents, recoveryPlans, appliedPlanId,
    liveFlights, showLiveFlights, showSimulation,
    selectedLiveFlight, setSelectedLiveFlight,
    setLiveFlights, setShowLiveFlights, setShowSimulation,
  } = useSimulationStore()

  const mapRef = useRef<L.Map | null>(null)

  // Destroy the Leaflet instance on unmount so hot-reloads don't hit
  // "Map container is already initialized".
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  const [nowMs, setNowMs]         = useState<number>(() => Date.now())
  const [loading, setLoading]     = useState(false)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const [selAirport, setSelAirport] = useState<string | null>(null)
  const [airportFAA, setAirportFAA] = useState<Record<string, FAAStatus>>({})
  const [wxAirports, setWxAirports] = useState<Record<string, string>>({})
  const [mapZoom, setMapZoom]     = useState(4)

  // 2s tick — dead reckoning still smooth, half the renders vs 1s
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 2_000)
    return () => clearInterval(t)
  }, [])

  const fetchLive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ flights?: LiveFlight[] }>("/flights/live?limit=1200&on_ground=false")
      const all: LiveFlight[] = res.data.flights || []
      setLiveFlights(all.filter((f) => f.airline_iata && f.airline_name !== "Unknown"), Date.now())
      setLastFetch(Date.now())
    } catch { /* degrade */ } finally { setLoading(false) }
  }, [setLiveFlights])

  useEffect(() => {
    fetchLive()
    const t = setInterval(fetchLive, 15_000)
    return () => clearInterval(t)
  }, [fetchLive])

  const fetchFAA = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        programs?: Array<{
          airport_icao?: string
          type: "ground_stop" | "ground_delay_program" | "departure_delay"
          avg_delay_minutes?: number
          reason?: string
        }>
      }>("/live/faa-status")
      const map: Record<string, FAAStatus> = {}
      for (const p of res.data.programs || []) {
        const icao = p.airport_icao
        if (!icao) continue
        const rank = (t: string) => t === "ground_stop" ? 3 : t === "ground_delay_program" ? 2 : 1
        const cur = map[icao]
        if (!cur || rank(p.type) > rank(cur.type))
          map[icao] = { type: p.type, delay_minutes: p.avg_delay_minutes ?? 0, reason: p.reason ?? "" }
      }
      setAirportFAA(map)
    } catch { /* noop */ }
  }, [])

  const fetchWx = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        alerts?: Array<{ event: string; headline?: string; affected_nimbus_airports?: string[] }>
      }>("/live/weather-alerts")
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

  // Applied recovery plan sets
  const applied = useMemo(() => {
    const plan = appliedPlanId ? recoveryPlans.find((p) => p.plan_id === appliedPlanId) : null
    return {
      cancelled: new Set<string>(plan?.cancelled_flights || []),
      swap:      new Set<string>((plan?.aircraft_swaps || []).map((s: any) => s.flight_id)),
    }
  }, [appliedPlanId, recoveryPlans])

  // Airports hit by sim events
  const simEvtAirports = useMemo(() => {
    const s = new Set<string>()
    for (const e of activeEvents) {
      const p = e.params || {}
      if (p.airport)             s.add(p.airport)
      if (p.base)                s.add(p.base)
      if (p.destination_airport) s.add(p.destination_airport)
    }
    return s
  }, [activeEvents])

  const hasActiveEvents = activeEvents.length > 0

  // Cascade color
  function cascColor(fid: string, state: any): string {
    if (applied.cancelled.has(fid) || state?.status === "cancelled") return "#DC2626"
    if (applied.swap.has(fid)) return "#F87156"
    if (!state) return "#2DA56F"
    if (state.cascade_order === 0) return "#F97316"
    if (state.cascade_order === 1) return "#FBBF24"
    if (state.cascade_order >= 2) return "#FDE68A"
    return "#2DA56F"
  }

  // Impact routes — ALWAYS visible when there are disrupted flights (not behind sim toggle)
  const { impactRoutes, impactIds } = useMemo(() => {
    const routes: Array<{ id: string; from: [number, number]; to: [number, number]; color: string; weight: number; opacity: number; dashed: boolean }> = []
    const ids = new Set<string>()
    for (const f of schedule) {
      const state = flightStates[f.id]
      const cancelled = applied.cancelled.has(f.id)
      const isAffected = state && (state.cascade_order >= 0 || state.status === "cancelled" || cancelled)
      if (!isAffected) continue
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) continue
      const sel = selectedFlight === f.id
      const color = cascColor(f.id, state)
      routes.push({
        id: f.id,
        from: [o.lat, o.lon] as [number, number],
        to: [d.lat, d.lon] as [number, number],
        color,
        weight: sel ? 3.5 : state?.cascade_order === 0 ? 2.5 : 1.8,
        opacity: sel ? 1 : state?.cascade_order === 0 ? 0.82 : 0.55,
        dashed: cancelled || state?.status === "cancelled",
      })
      ids.add(f.id)
    }
    return { impactRoutes: routes, impactIds: ids }
  }, [flightStates, schedule, selectedFlight, applied]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dead-reckoned live positions (2s tick)
  const livePlanes = useMemo(() => {
    const nowSec = nowMs / 1000
    return liveFlights.map((lf) => {
      if (!lf.on_ground && lf.heading != null && (lf.velocity_kt ?? 0) > 80 && lf.last_contact > 0) {
        const elapsed = nowSec - lf.last_contact
        if (elapsed >= 0 && elapsed < 300) {
          const [lat, lon] = deadReckon(lf.lat, lf.lon, lf.heading, lf.velocity_kt!, elapsed)
          return { lf, lat, lon }
        }
      }
      return { lf, lat: lf.lat, lon: lf.lon }
    })
  }, [liveFlights, nowMs])

  // Simulated Nimbus planes (only computed when layer on)
  const simPlanes = useMemo(() => {
    if (!showSimulation) return []
    const cycle = 60 * 6, phase = ((nowMs / 1000) % cycle) / cycle, hr = 6 + phase * 18
    return schedule.flatMap((f) => {
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) return []
      const dep = isoToHour(f.scheduled_departure), arr = isoToHour(f.scheduled_arrival)
      if (arr <= dep || hr < dep || hr > arr) return []
      const t = (hr - dep) / (arr - dep)
      const [lat, lon] = interp(o.lat, o.lon, d.lat, d.lon, Math.max(0.02, Math.min(0.98, t)))
      return [{ id: f.id, f, lat, lon, brg: bearing(o.lat, o.lon, d.lat, d.lon) }]
    })
  }, [schedule, nowMs, showSimulation])

  // Trail only for the one selected live flight
  const selTrail = useMemo(() => {
    const lf = selectedLiveFlight
    if (!lf || mapZoom < 6 || !lf.heading || (lf.velocity_kt ?? 0) < 80) return null
    const nowSec = nowMs / 1000
    const elapsed = nowSec - lf.last_contact
    const [cLat, cLon] = elapsed > 0 && elapsed < 300 ? deadReckon(lf.lat, lf.lon, lf.heading, lf.velocity_kt!, elapsed) : [lf.lat, lf.lon]
    const [tLat, tLon] = deadReckon(cLat, cLon, (lf.heading + 180) % 360, lf.velocity_kt!, 60)
    return { from: [tLat, tLon] as [number, number], to: [cLat, cLon] as [number, number] }
  }, [selectedLiveFlight, nowMs, mapZoom])

  const selectedSched = selectedFlight ? schedule.find((f) => f.id === selectedFlight) ?? null : null
  const focusTarget: ScheduledFlight | LiveFlight | null = selectedSched || selectedLiveFlight
  const ageSec = lastFetch ? Math.round((nowMs - lastFetch) / 1000) : null

  return (
    <div className="w-full h-full relative">
      <MapContainer
        ref={mapRef}
        center={[39.5, -98.0]} zoom={4} minZoom={2} maxZoom={14}
        zoomControl={false} scrollWheelZoom worldCopyJump={false}
        preferCanvas
        className="w-full h-full" style={{ background: "#EBE5D8" }}
      >
        <ZoomControl position="topright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd" maxZoom={19}
        />
        <ZoomTracker onZoom={setMapZoom} />
        <FitBounds flights={schedule} />
        <FocusFlight target={focusTarget} />

        {/* ── Event epicenter circles ── */}
        {hasActiveEvents && Array.from(simEvtAirports).map((icao) => {
          const ap = NIMBUS_AIRPORTS[icao]
          if (!ap) return null
          return (
            <Circle key={`epic-${icao}`} center={[ap.lat, ap.lon]} radius={220_000}
              pathOptions={{ color: "#F97316", weight: 1.5, opacity: 0.45, fillColor: "#F97316", fillOpacity: 0.05, dashArray: "6 5" }} />
          )
        })}

        {/* ── Background Nimbus routes (sim layer on, unaffected flights only) ── */}
        {showSimulation && schedule.map((f) => {
          if (impactIds.has(f.id)) return null
          const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
          if (!o || !d) return null
          const sel = selectedFlight === f.id
          return (
            <Polyline key={`bg-${f.id}`}
              positions={[[o.lat, o.lon], [d.lat, d.lon]]}
              pathOptions={{ color: "#94A3B8", weight: sel ? 2 : 1, opacity: sel ? 0.45 : 0.13, dashArray: sel ? undefined : "3 6" }}
              eventHandlers={{ click: () => onFlightSelect(sel ? null : f.id) }}
            />
          )
        })}

        {/* ── Impact routes: ALWAYS shown when flights are disrupted ── */}
        {impactRoutes.map((r) => (
          <Polyline key={`imp-${r.id}`}
            positions={[r.from, r.to]}
            pathOptions={{ color: r.color, weight: r.weight, opacity: r.opacity, dashArray: r.dashed ? "8 5" : undefined }}
            eventHandlers={{ click: () => onFlightSelect(selectedFlight === r.id ? null : r.id) }}
          />
        ))}

        {/* ── Selected live trail ── */}
        {selTrail && (
          <Polyline positions={[selTrail.from, selTrail.to]}
            pathOptions={{ color: "#F87156", weight: 2, opacity: 0.65 }} />
        )}

        {/* ── Airport nodes ── */}
        {Object.entries(NIMBUS_AIRPORTS).map(([id, ap]) => (
          <Marker key={id} position={[ap.lat, ap.lon]}
            icon={airportIcon(HUB_AIRPORTS.has(id), airportFAA[id], id in wxAirports, simEvtAirports.has(id), selAirport === id)}
            zIndexOffset={airportFAA[id] ? 1200 : HUB_AIRPORTS.has(id) ? 600 : 100}
            eventHandlers={{ click: () => { setSelAirport(selAirport === id ? null : id); onFlightSelect(null); setSelectedLiveFlight(null) } }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={1}>
              <div className="text-xs">
                <div className="font-mono font-bold">{ap.iata} · {id}</div>
                <div className="text-[10px] text-muted-foreground">{ap.name}, {ap.city}</div>
                {airportFAA[id] && (
                  <div className="text-[10px] font-semibold mt-0.5" style={{ color: airportFAA[id].type === "ground_stop" ? "#DC2626" : "#EA580C" }}>
                    {airportFAA[id].type === "ground_stop" ? "🔴 Ground Stop"
                      : airportFAA[id].type === "ground_delay_program" ? `🟠 GDP +${airportFAA[id].delay_minutes}m`
                      : `🟡 +${airportFAA[id].delay_minutes}m dep delay`}
                  </div>
                )}
                {id in wxAirports && <div className="text-[10px] text-purple-600">⚡ WX Alert</div>}
                {simEvtAirports.has(id) && <div className="text-[10px] text-orange-600 font-semibold">⚠ Disruption epicenter</div>}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* ── Simulated aircraft ── */}
        {simPlanes.map(({ id, f, lat, lon, brg }) => {
          const state = flightStates[id]
          const sel = selectedFlight === id
          return (
            <Marker key={`sim-${id}`} position={[lat, lon]}
              icon={simIcon(cascColor(id, state), brg, sel)}
              zIndexOffset={sel ? 2000 : 300}
              eventHandlers={{ click: () => onFlightSelect(sel ? null : id) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="text-xs">
                  <div className="font-mono font-bold">{id} <span className="text-[9px] text-orange-500">[SIM]</span></div>
                  <div className="text-[10px] text-muted-foreground">{f.aircraft_id} · {f.origin} → {f.destination}</div>
                  {state?.delay_minutes > 0 && <div className="text-[10px] text-orange-600">+{state.delay_minutes} min</div>}
                  {state?.cascade_order === 0 && <div className="text-[10px] text-red-600 font-semibold">⚠ Direct impact</div>}
                </div>
              </Tooltip>
            </Marker>
          )
        })}

        {/* ── Live airline aircraft ── */}
        {showLiveFlights && livePlanes.map(({ lf, lat, lon }) => {
          const sel = selectedLiveFlight?.icao24 === lf.icao24
          return (
            <Marker key={`lv-${lf.icao24}`} position={[lat, lon]}
              icon={liveIcon(lf.heading, sel, lf.velocity_kt)}
              zIndexOffset={sel ? 1900 : 400}
              eventHandlers={{ click: () => { setSelectedLiveFlight(sel ? null : lf); onFlightSelect(null); setSelAirport(null) } }}
            >
              {(sel || mapZoom >= 6) && (
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="text-xs">
                    <div className="font-mono font-bold">
                      {lf.flight_iata || lf.flight_icao}
                      <span className="ml-1.5 text-[8px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200 font-bold">LIVE</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{lf.airline_name}</div>
                    {lf.altitude_ft != null && <div className="text-[10px] font-mono">{lf.altitude_ft.toLocaleString()} ft · {lf.velocity_kt} kt</div>}
                  </div>
                </Tooltip>
              )}
            </Marker>
          )
        })}
      </MapContainer>

      {/* ── Panels ── */}
      {selectedLiveFlight && <LivePanel flight={selectedLiveFlight} onClose={() => setSelectedLiveFlight(null)} />}

      {selectedSched && !selectedLiveFlight && (() => {
        const state = flightStates[selectedSched.id]
        return (
          <div className="absolute top-3 right-3 left-3 sm:left-auto z-[450] surface-floating p-3 max-w-xs shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="font-mono font-bold text-sm">{selectedSched.id}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 font-bold">SIM</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">
                  <span className="font-mono font-medium text-foreground">{selectedSched.origin}</span>
                  <span>→</span>
                  <span className="font-mono font-medium text-foreground">{selectedSched.destination}</span>
                </div>
                {state && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-secondary/40 rounded-lg p-2">
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
              <button onClick={() => onFlightSelect(null)} className="text-muted-foreground hover:text-foreground text-xl w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-secondary">×</button>
            </div>
          </div>
        )
      })()}

      {selAirport && !selectedLiveFlight && !selectedSched && (
        <AirportPanel
          icao={selAirport} faa={airportFAA[selAirport]}
          hasWx={selAirport in wxAirports} wxText={wxAirports[selAirport] || ""}
          simAffected={simEvtAirports.has(selAirport)} onClose={() => setSelAirport(null)}
        />
      )}

      {/* ── Top-left: status + active events ── */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5 max-w-[220px]">
        <div className="surface-floating px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${loading ? "bg-amber-400 animate-pulse" : liveFlights.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span className="font-bold truncate">{liveFlights.length > 0 ? `${liveFlights.length.toLocaleString()} airline flights` : "Connecting…"}</span>
          {ageSec != null && <span className="text-muted-foreground/60 font-mono text-[9px] shrink-0">· {ageSec}s</span>}
        </div>

        {hasActiveEvents && (
          <div className="surface-floating px-2.5 py-2 border-l-2 border-orange-500">
            <div className="text-[9px] uppercase tracking-wider font-bold text-orange-600 mb-1">⚠ Active Disruptions</div>
            {activeEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-1.5 text-[10px] text-foreground/80 mb-0.5">
                <span className="w-1 h-1 rounded-full bg-orange-500 shrink-0 mt-1" />
                <span className="truncate">{ev.kind?.replace(/_/g, " ")} {ev.params?.airport || ev.params?.aircraft_tail || ev.params?.base ? `— ${ev.params.airport || ev.params.aircraft_tail || ev.params.base}` : ""}</span>
              </div>
            ))}
            {impactRoutes.length > 0 && (
              <div className="text-[9px] text-muted-foreground mt-1 pt-1 border-t border-border">
                {impactRoutes.length} route{impactRoutes.length !== 1 ? "s" : ""} affected
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom-right: layer toggles ── */}
      <div className="absolute bottom-3 right-3 z-[400]">
        <div className="surface-floating px-3 py-2 flex flex-col gap-1.5 text-[11px]">
          <button onClick={() => setShowLiveFlights(!showLiveFlights)}
            className={`flex items-center gap-2 font-semibold transition-colors ${showLiveFlights ? "text-sky-600" : "text-muted-foreground"}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${showLiveFlights ? "bg-sky-400 animate-pulse" : "bg-muted-foreground/40"}`} />
            Real flights (ADS-B)
          </button>
          <button onClick={() => setShowSimulation(!showSimulation)}
            className={`flex items-center gap-2 font-semibold transition-colors ${showSimulation ? "text-orange-500" : "text-muted-foreground"}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${showSimulation ? "bg-orange-400" : "bg-muted-foreground/40"}`} />
            Nimbus Air sim
          </button>
        </div>
      </div>

      {/* ── Bottom-left: compact legend ── */}
      <div className="absolute bottom-3 left-3 z-[400] surface-floating px-2.5 py-2 text-[10px]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-sky-400" />
            <span className="text-muted-foreground">Live</span>
          </div>
          <div className="border-l border-border h-3" />
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /><span className="text-muted-foreground">GS</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-muted-foreground">GDP</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-600" /><span className="text-muted-foreground">WX</span></div>
          {impactRoutes.length > 0 && (
            <>
              <div className="border-l border-border h-3" />
              <div className="flex items-center gap-1"><span className="w-3 h-1 rounded-full bg-orange-500" /><span className="text-orange-600 font-semibold">Direct</span></div>
              <div className="flex items-center gap-1"><span className="w-3 h-1 rounded-full bg-amber-400" /><span className="text-muted-foreground">Cascade</span></div>
              <div className="flex items-center gap-1"><span className="w-3 h-1 rounded-full bg-red-600" /><span className="text-muted-foreground">Cancelled</span></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
