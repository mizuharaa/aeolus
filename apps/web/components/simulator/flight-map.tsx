"use client"
import "leaflet/dist/leaflet.css"
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react"
import {
  MapContainer, TileLayer, Marker, Polyline, Circle, Pane,
  Tooltip, ZoomControl, useMap, useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import { AircraftDetail } from "./aircraft-detail"
import {
  useSimulationStore,
  type ScheduledFlight,
  type LiveFlight,
  type ActiveEvent,
  type CascadeSummary,
  type RecoveryPlan,
  type FlightState,
} from "@/stores/simulation"
import { NIMBUS_AIRPORTS, HUB_AIRPORTS } from "./airports"
import { apiClient } from "@/lib/api"
import {
  CloudLightning as CloudLightningIcon, OctagonAlert as OctagonAlertIcon,
  Ban as BanIcon, ShieldAlert as ShieldAlertIcon, Wrench as WrenchIcon,
  HeartPulse as HeartPulseIcon, AlertTriangle as AlertTriangleIcon,
  Radio as RadioIcon, Mountain as MountainIcon, ServerCrash as ServerCrashIcon,
} from "lucide-react"

// ── Map colors — the five-pigment vocabulary as LITERAL hex.
//    The map runs Leaflet's canvas renderer (preferCanvas), which resolves
//    colors in JS — CSS variables can't reach it, so these are the same
//    pigments as globals.css, inlined. Keep them in sync by hand.
//
//    teal  = recovery / reroute / brand    amber = the ONE status color
//    gray  = cancelled / nominal / live    (severity = amber opacity steps)
const MAP_COLORS = {
  // Plan-applied actions. GREY = "no longer operating" (always paired with
  // the ✕ badge + dashed stroke — never color-alone), TEAL = "re-routed /
  // re-assigned", AMBER = "operating late".
  // LIGHT REGISTER: the map runs on Carto voyager tiles; darker = stronger.
  planCancelled: "#98A29B",
  planCancelledInk: "#6A716D",
  planSwap:      "#2C49E0",
  planSwapFlow:  "#2C49E0",
  planDelayed:   "#EFAF1B",

  // Cascade severity: one amber family; on the light floor the DIRECT hit
  // is the darkest step and later generations lighten.
  cascadeDirect: "#9A6420",
  cascadeOrder1: "#EFAF1B",
  cascadeOrder2: "#CFA96A",
  unaffected:    "#8CA096",

  // Live ADS-B — quiet sage traffic beneath the sim layer
  live:          "#93A29A",
  liveSelected:  "#2C49E0",

  // Airport state
  airportHub:    "#0B7065",
  airportNormal: "#7B8A80",
  groundStop:    "#9A6420",
  gdp:           "#EFAF1B",
  depDelay:      "#EFAF1B",
  eventEpicenter: "#9A6420",
  weather:       "#EFAF1B",
} as const

// Overlay glass — light register (paper at high alpha over the map).
const GLASS        = "rgba(250,250,246,0.92)"
const GLASS_STRONG = "rgba(252,252,249,0.96)"

// ── Pure helpers ───────────────────────────────────────────────────────────────

function deadReckon(lat: number, lon: number, hdgDeg: number, velKt: number, sec: number): [number, number] {
  const s = Math.min(Math.max(sec, 0), 180)
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

/** Great-circle distance in nautical miles. */
function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
function cardinal(deg: number): string {
  return CARDINALS[Math.round(((deg % 360) / 22.5)) % 16]
}

/** Approximate speed of sound (kt) at a given pressure altitude (ft). */
function machFor(gsKt: number, altFt: number): number | null {
  if (!gsKt || gsKt <= 0) return null
  const h = Math.min(altFt, 36089)
  const a = 661.5 * Math.sqrt(Math.max(0.55, 1 - 6.8756e-6 * h))
  return gsKt / a
}

/**
 * Rich derived state for a live ADS-B contact: phase of flight, nearest
 * Nimbus airport (behind = likely origin, ahead-in-track = likely arrival with
 * a rough ETA), signal age. Everything here is computed from the ADS-B fields
 * we actually have — no invented route/pax data.
 */
function deriveLive(f: LiveFlight) {
  const alt = f.altitude_ft ?? 0
  const vs = f.vertical_fpm ?? 0
  const gs = f.velocity_kt ?? 0
  const phase = f.on_ground
    ? { label: "On ground", tone: "#8A8270", pct: 0 }
    : vs > 350
      ? { label: "Climbing", tone: "#4C28A8", pct: Math.min(1, alt / 38000) }
      : vs < -400
        ? { label: alt < 10000 ? "Approach" : "Descending", tone: "#EFAF1B", pct: Math.min(1, alt / 38000) }
        : alt > 18000
          ? { label: "Cruise", tone: "#2C49E0", pct: Math.min(1, alt / 38000) }
          : { label: "Level", tone: "#2C49E0", pct: Math.min(1, alt / 38000) }

  // nearest airport overall, and nearest airport within ±55° of the track
  let nearest: { icao: string; nm: number } | null = null
  let ahead: { icao: string; nm: number; etaMin: number } | null = null
  const hdg = f.heading ?? 0
  for (const icao in NIMBUS_AIRPORTS) {
    const ap = NIMBUS_AIRPORTS[icao]
    const nm = distanceNm(f.lat, f.lon, ap.lat, ap.lon)
    if (!nearest || nm < nearest.nm) nearest = { icao, nm }
    const brg = bearing(f.lat, f.lon, ap.lat, ap.lon)
    let diff = Math.abs(((brg - hdg + 540) % 360) - 180)
    if (diff < 55 && gs > 60) {
      const etaMin = (nm / gs) * 60
      if (!ahead || nm < ahead.nm) ahead = { icao, nm, etaMin }
    }
  }
  const ageSec = Math.max(0, Math.round(Date.now() / 1000 - f.last_contact))
  const mach = machFor(gs, alt)
  return { phase, nearest, ahead, ageSec, mach, alt, vs, gs, hdg }
}

function interp(lat1: number, lon1: number, lat2: number, lon2: number, t: number): [number, number] {
  return [lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t]
}

function isoToHour(iso: string): number {
  try { const d = new Date(iso); return d.getUTCHours() + d.getUTCMinutes() / 60 } catch { return 12 }
}

// Quadratic bezier arc — creates a natural-looking curved path between two points
function arcPoints(lat1: number, lon1: number, lat2: number, lon2: number, n = 28): [number, number][] {
  const midLat = (lat1 + lat2) / 2 + Math.abs(lat2 - lat1) * 0.18
  const midLon = (lon1 + lon2) / 2
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [
      (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2,
      (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * midLon + t * t * lon2,
    ] as [number, number]
  })
}

// ── Icon cache ────────────────────────────────────────────────────────────────
const _cache = new Map<string, L.DivIcon>()
function icon(key: string, factory: () => L.DivIcon): L.DivIcon {
  if (!_cache.has(key)) _cache.set(key, factory())
  return _cache.get(key)!
}

/** Selected live flight — teal plane with an expanding radar ring + blink,
 *  rendered crisp in the focus pane while the rest of the map dims. */
function liveSelIcon(heading: number | null): L.DivIcon {
  const hdg = Math.round((heading ?? 0) / 10) * 10
  return icon(`lvsel|${hdg}`, () =>
    L.divIcon({
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<div class="ae-livesel" style="width:34px;height:34px;display:flex;align-items:center;justify-content:center">
        <span class="ae-livesel-ring"></span>
        <span class="ae-livesel-ring delay"></span>
        <span style="width:22px;height:22px;transform:rotate(${hdg}deg);transform-origin:center;filter:drop-shadow(0 1px 4px rgba(44,73,224,0.6))"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#2C49E0" stroke="#FFFFFF" stroke-width="1"/></svg></span>
      </div>`,
    })
  )
}

function liveIcon(heading: number | null, sel: boolean, velKt: number | null): L.DivIcon {
  const hdg = Math.round((heading ?? 0) / 10) * 10
  const slow = (velKt ?? 0) < 50
  const key = `lv|${hdg}|${sel}|${slow}`
  return icon(key, () => {
    const sz = sel ? 30 : 16
    const fill = sel ? MAP_COLORS.liveSelected : MAP_COLORS.live
    const op = slow ? 0.4 : 1
    return L.divIcon({
      className: "",
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2],
      html: `<div style="width:${sz}px;height:${sz}px;transform:rotate(${hdg}deg);transform-origin:center;opacity:${op}"><svg viewBox="0 0 24 24" width="${sz}" height="${sz}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="${fill}" stroke="rgba(255,255,255,0.85)" stroke-width="0.8"/></svg></div>`,
    })
  })
}

/**
 * Aircraft marker icon. Visual treatment varies by applied-plan action:
 *
 *   isCancelled = true → grey 18px disc + small white ✕ badge, low opacity.
 *                        Stays clickable so the operator can inspect why a
 *                        leg was cut, but recedes visually so live re-routes
 *                        dominate the canvas.
 *   isSwap      = true → green disc with a subtle ring, communicating "this
 *                        aircraft has been re-assigned by the plan".
 *   else                → standard cascade-coloured disc, sized by severity.
 */
function simIcon(
  color: string,
  rot: number,
  sel: boolean,
  cascOrder: number,
  isCancelled: boolean = false,
  isSwap:      boolean = false,
): L.DivIcon {
  const r = Math.round(rot / 10) * 10

  // Cancelled markers are intentionally small + faded so the live-operating
  // network dominates. We still draw them — clickable, tooltipped — but they
  // should never out-shout an active reroute.
  const sz = isCancelled
    ? (sel ? 24 : 18)
    : (sel ? 34 : cascOrder === 0 ? 28 : cascOrder >= 1 ? 22 : 18)

  const key = `sim4|${r}|${color}|${sel}|${cascOrder}|${isCancelled ? "x" : isSwap ? "s" : "_"}`
  return icon(key, () => {
    const planeSz = Math.round(sz * 0.52)

    // Outer ring vocabulary:
    //   cancelled → no ring, dashed white border, 55% opacity
    //   swap      → green ring confirming new assignment
    //   selected  → bright halo
    //   direct    → matched-colour halo
    //   default   → flat soft drop shadow
    const ring =
      isCancelled
        ? `box-shadow:0 1px 3px rgba(0,0,0,0.25);opacity:0.55;`
        : isSwap
        ? `box-shadow:0 0 0 2px #fff,0 0 0 4px ${color}CC,0 4px 10px ${color}55;`
        : sel
        ? `box-shadow:0 0 0 2.5px #fff,0 0 0 5px ${color},0 4px 12px ${color}80;`
        : cascOrder === 0
        ? `box-shadow:0 0 0 2px #fff,0 0 0 4px ${color}CC;`
        : `box-shadow:0 1px 4px rgba(0,0,0,0.35);`

    const borderStyle = isCancelled
      ? "border:1.5px dashed rgba(255,255,255,0.9);"
      : "border:2px solid rgba(255,255,255,0.95);"

    // Cancelled marker overlays a small white ✕ on the disc so the
    // semantic is unmistakable at a glance, even before reading the tooltip.
    const cancelBadge = isCancelled
      ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font:700 ${Math.round(sz * 0.55)}px/1 ui-monospace,monospace;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.45);">✕</div>`
      : ""

    return L.divIcon({
      className: "",
      iconSize:  [sz, sz],
      iconAnchor:[sz / 2, sz / 2],
      // Colored circle background with white plane silhouette on top.
      // Rotation is applied to the inner plane only so the circle stays round.
      // The cancel badge sits on top of the silhouette.
      html: `<div style="position:relative;width:${sz}px;height:${sz}px;border-radius:50%;background:${color};${borderStyle}display:flex;align-items:center;justify-content:center;${ring}">${
        isCancelled
          ? cancelBadge
          : `<div style="transform:rotate(${r}deg);line-height:0;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${planeSz}" height="${planeSz}" style="display:block;"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="white" stroke="rgba(255,255,255,0.15)" stroke-width="0.4"/></svg></div>`
      }</div>`,
    })
  })
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
    let fill: string = isHub ? MAP_COLORS.airportHub : MAP_COLORS.airportNormal
    let ring = "", top = "", bot = ""
    if (faa?.type === "ground_stop") {
      fill = MAP_COLORS.groundStop
      ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid ${MAP_COLORS.groundStop};opacity:0.55"></span>`
      top = apBadge(MAP_COLORS.groundStop, "GS")
    } else if (faa?.type === "ground_delay_program") {
      fill = MAP_COLORS.gdp
      ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid ${MAP_COLORS.gdp};opacity:0.5"></span>`
      top = apBadge(MAP_COLORS.gdp, faa.delay_minutes > 0 ? `+${faa.delay_minutes}m` : "GDP")
    } else if (faa?.type === "departure_delay") {
      fill = MAP_COLORS.depDelay
      if (faa.delay_minutes > 0) top = apBadge(MAP_COLORS.depDelay, `+${faa.delay_minutes}m`)
    } else if (isEvt) {
      fill = MAP_COLORS.eventEpicenter
      ring = `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid ${MAP_COLORS.eventEpicenter};opacity:0.6"></span>`
    }
    if (hasWx) bot = apBadge(MAP_COLORS.weather, "⚡WX", true)
    const sel = isSel ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2.5px solid ${MAP_COLORS.liveSelected}"></span>` : ""
    const s = r * 2 + 28
    return L.divIcon({
      className: "",
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
      html: `<div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center">${sel}${ring}${top}${bot}<span style="position:relative;width:${r * 2}px;height:${r * 2}px;background:${fill};border:2.5px solid #fff;border-radius:9999px;box-shadow:0 2px 10px rgba(0,0,0,.25);display:block"></span></div>`,
    })
  })
}

// ── Map sub-components ─────────────────────────────────────────────────────────

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) })
  return null
}

function BoundsTracker({ onBounds }: { onBounds: (b: L.LatLngBounds) => void }) {
  const map = useMap()
  useMapEvents({
    moveend: () => onBounds(map.getBounds()),
    zoomend: () => onBounds(map.getBounds()),
  })
  useEffect(() => { onBounds(map.getBounds()) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Recompute tile layout when the map column is resized or the page scrolls (avoids Leaflet “breaking out” visually). */
function MapResizeFix() {
  const map = useMap()
  useEffect(() => {
    const fix = () => {
      map.invalidateSize({ animate: false })
    }
    fix()
    const ro = new ResizeObserver(fix)
    const el = map.getContainer().parentElement
    if (el) ro.observe(el)
    window.addEventListener("orientationchange", fix)
    return () => {
      ro.disconnect()
      window.removeEventListener("orientationchange", fix)
    }
  }, [map])
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
    if ("icao24" in target) { map.flyTo([target.lat, target.lon], 9, { duration: 0.8 }); return }
    const o = NIMBUS_AIRPORTS[(target as ScheduledFlight).origin]
    const d = NIMBUS_AIRPORTS[(target as ScheduledFlight).destination]
    if (o && d) map.flyToBounds(L.latLngBounds([[o.lat, o.lon], [d.lat, d.lon]]).pad(0.45), { duration: 0.8 })
  }, [target, map])
  return null
}

// ── Event helpers ──────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  weather_closure: "Weather Closure", ground_stop: "Ground Stop",
  airspace_closure: "Airspace Closure", security_event: "Security Event",
  mechanical_aog: "Mechanical AOG", crew_sickout: "Crew Sick-out",
  runway_closure: "Runway Closure", atc_staffing: "ATC Shortage",
  volcanic_ash: "Volcanic Ash", cyber_incident: "Cyber Incident",
}
// One icon family (lucide), one stroke weight — no emoji in UI chrome.
const EVENT_ICONS: Record<string, typeof CloudLightningIcon> = {
  weather_closure: CloudLightningIcon, ground_stop: OctagonAlertIcon,
  airspace_closure: BanIcon, security_event: ShieldAlertIcon,
  mechanical_aog: WrenchIcon, crew_sickout: HeartPulseIcon,
  runway_closure: AlertTriangleIcon, atc_staffing: RadioIcon,
  volcanic_ash: MountainIcon, cyber_incident: ServerCrashIcon,
}

function EventIcon({ kind, className, style }: { kind: string; className?: string; style?: CSSProperties }) {
  const Icon = EVENT_ICONS[kind] ?? AlertTriangleIcon
  return <Icon className={className} style={style} strokeWidth={1.75} />
}

// ── Overlay components ─────────────────────────────────────────────────────────

function DisruptionBanner({
  events, impactCount, summary,
}: {
  events: ActiveEvent[]
  impactCount: number
  summary: CascadeSummary | null
}) {
  if (events.length === 0) return null
  return (
    <div className="absolute top-3 left-3 z-[450] flex flex-col gap-2" style={{ maxWidth: 268 }}>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: GLASS,
          backdropFilter: "blur(14px)",
          border: "1px solid var(--ae-line)",
          borderLeft: "2px solid var(--ae-rust)",
          boxShadow: "var(--ae-shadow-card-elev)",
        }}
      >
        {/* Header strip */}
        <div
          className="px-3.5 py-2.5 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--ae-line)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--ae-rust)" }} />
          <span className="text-[11px] font-semibold flex-1" style={{ color: "var(--ae-text)" }}>
            Disruption active
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: "var(--ae-rust-bg)", color: "var(--ae-rust-ink)" }}
          >
            {events.length}
          </span>
        </div>

        {/* Events list */}
        <div className="px-3.5 py-2.5 space-y-2.5">
          {events.slice(0, 3).map((ev) => (
            <div key={ev.id} className="flex items-start gap-2.5">
              <EventIcon kind={ev.kind} className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--ae-rust-ink)" }} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold leading-tight" style={{ color: "var(--ae-text)" }}>
                  {EVENT_LABELS[ev.kind] ?? ev.kind.replace(/_/g, " ")}
                </div>
                {(ev.params?.airport || ev.params?.aircraft_tail || ev.params?.base || ev.params?.destination_airport) && (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold" style={{ color: "var(--ae-text-2)" }}>
                      {ev.params.airport || ev.params.aircraft_tail || ev.params.base || ev.params.destination_airport}
                    </span>
                    {ev.params.severity && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "var(--ae-amber-bg)", color: "var(--ae-amber-ink)" }}>
                        {ev.params.severity}
                      </span>
                    )}
                    {ev.params.duration_hours && (
                      <span className="text-[9px]" style={{ color: "var(--ae-text-3)" }}>{ev.params.duration_hours}h</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {events.length > 3 && (
            <div className="text-[10px] pl-6" style={{ color: "var(--ae-text-3)" }}>+{events.length - 3} more</div>
          )}
        </div>

        {/* Impact row */}
        {(summary || impactCount > 0) && (
          <div
            className="px-3.5 py-2 flex items-center gap-2 flex-wrap"
            style={{ background: "rgba(15,20,18,0.04)", borderTop: "1px solid var(--ae-line)" }}
          >
            {summary ? (
              <span className="text-[10px] font-medium" style={{ color: "var(--ae-text-2)" }}>
                <span className="font-semibold font-mono" style={{ color: "var(--ae-text)" }}>{summary.total_affected}</span> affected ·{" "}
                {summary.directly_affected} direct ·{" "}
                {(summary.cascade_1 || 0) + (summary.cascade_2 || 0)} cascade
              </span>
            ) : (
              <span className="text-[10px] font-medium" style={{ color: "var(--ae-text-2)" }}>{impactCount} routes impacted</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const PLAN_META_MAP = {
  A: { label: "Minimize Cost" },
  B: { label: "Min. Pax Impact" },
  C: { label: "Protect Tomorrow" },
  D: { label: "Green Recovery" },
}

function RecoveryBanner({ plan, onUnapply }: { plan: RecoveryPlan; onUnapply: () => void }) {
  const meta = PLAN_META_MAP[plan.plan_id as keyof typeof PLAN_META_MAP] ?? PLAN_META_MAP.A
  const cost = plan.cost_breakdown?.grand_total_usd
    ? `$${(plan.cost_breakdown.grand_total_usd / 1_000_000).toFixed(2)}M`
    : `$${(plan.total_cost_usd / 1000).toFixed(0)}K`

  return (
    // Banner anchored to top-right — leaves the left where FlightSearch lives
    <div className="absolute top-3 right-3 z-[450]" style={{ maxWidth: 560, left: "min(460px, calc(50% - 40px))" }}>
      <div
        className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 flex-wrap"
        style={{
          background: GLASS,
          backdropFilter: "blur(16px)",
          border: "1px solid var(--ae-line)",
          borderLeft: "2px solid var(--ae-teal)",
          boxShadow: "var(--ae-shadow-card-elev)",
        }}
      >
        {/* Plan badge — teal marks the applied plan; the letter carries identity */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
            style={{ background: "var(--ae-teal-bg)", border: "1px solid var(--ae-teal)", color: "var(--ae-teal-ink)" }}
          >
            {plan.plan_id}
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-widest leading-none" style={{ color: "var(--ae-teal-ink)" }}>
              Plan applied
            </div>
            <div className="text-[11px] font-semibold leading-tight mt-0.5" style={{ color: "var(--ae-text)" }}>{meta.label}</div>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden sm:block w-px h-7 shrink-0" style={{ background: "var(--ae-line)" }} />

        {/* Metrics row */}
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <MetricChip label="Cost" value={cost} />
          {(plan.cancelled_flights?.length ?? 0) > 0 && (
            <MetricChip label="Canc." value={String(plan.cancelled_flights.length)} dot="var(--ae-rust)" />
          )}
          {(plan.delayed_flights?.length ?? 0) > 0 && (
            <MetricChip label="Delay" value={String(plan.delayed_flights.length)} dot="var(--ae-amber)" />
          )}
          {(plan.aircraft_swaps?.length ?? 0) > 0 && (
            <MetricChip label="Swap" value={String(plan.aircraft_swaps.length)} dot="var(--ae-teal)" />
          )}
          <MetricChip
            label="FAR 117"
            value={plan.crew_violations > 0 ? `${plan.crew_violations} flags` : "OK"}
            dot={plan.crew_violations > 0 ? "var(--ae-amber)" : "var(--ae-teal)"}
          />
        </div>

        {/* Unapply */}
        <button
          onClick={onUnapply}
          className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-md transition-all whitespace-nowrap"
          style={{
            background: "transparent",
            border: "1px solid var(--ae-line-strong)",
            color: "var(--ae-text)",
            cursor: "pointer",
          }}
        >
          Unapply
        </button>
      </div>
    </div>
  )
}

/** Label + value pair; an optional pigment dot carries state, text stays neutral. */
function MetricChip({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />}
      <span className="text-[10px] font-medium" style={{ color: "var(--ae-text-3)" }}>{label}</span>
      <span className="text-[11px] font-semibold font-mono tabular-nums" style={{ color: "var(--ae-text)" }}>{value}</span>
    </div>
  )
}

function fmtZ(iso: string): string {
  try { return new Date(iso).toISOString().slice(11, 16) + "Z" } catch { return "—" }
}

function FlightDetailCard({
  flight, state, appliedPlan, applied, onClose, onOpenAircraft,
}: {
  flight: ScheduledFlight
  state: FlightState | undefined
  appliedPlan: RecoveryPlan | null
  applied: { cancelled: Set<string>; swap: Set<string>; delayed: Map<string, number> }
  onClose: () => void
  onOpenAircraft: () => void
}) {
  const isPlanCancelled    = applied.cancelled.has(flight.id)
  const isCascadeCancelled = !isPlanCancelled && state?.status === "cancelled"
  const isCancelled        = isPlanCancelled || isCascadeCancelled
  const isSwapped   = applied.swap.has(flight.id)
  const planDelay   = applied.delayed.get(flight.id)
  const delayMin    = isCancelled ? 0 : (planDelay ?? state?.delay_minutes ?? 0)
  const cascOrder   = state?.cascade_order ?? -1
  const pDelay      = state?.p_delayed ?? 0

  const oAp = NIMBUS_AIRPORTS[flight.origin]
  const dAp = NIMBUS_AIRPORTS[flight.destination]

  let actionLabel = "", actionColor = "#2C49E0", actionIcon = ""
  // Colours mirror the map's MAP_COLORS palette so the inspector card and the
  // line/marker on the map read as the same semantic state at a glance.
  if (isPlanCancelled)     { actionLabel = "Cancelled by recovery plan"; actionColor = MAP_COLORS.planCancelledInk; actionIcon = "✕" }
  else if (isCascadeCancelled){ actionLabel = "Grounded by disruption"; actionColor = MAP_COLORS.cascadeDirect; actionIcon = "✕" }
  else if (isSwapped)      { actionLabel = "Re-routed · new aircraft assigned"; actionColor = MAP_COLORS.planSwap; actionIcon = "↕" }
  else if (planDelay)      { actionLabel = `Delayed +${planDelay} min by plan`; actionColor = MAP_COLORS.planDelayed; actionIcon = "⏱" }
  else if (cascOrder === 0){ actionLabel = "Direct impact — epicenter"; actionColor = MAP_COLORS.cascadeDirect; actionIcon = "⚡" }
  else if (cascOrder > 0)  { actionLabel = `Cascade order ${cascOrder}`; actionColor = MAP_COLORS.cascadeOrder1; actionIcon = "↗" }

  return (
    <div
      className="absolute z-[450] w-[19.5rem]"
      style={{ top: appliedPlan ? 72 : 12, right: 56, maxHeight: "calc(100% - 202px)", display: "flex", flexDirection: "column" }}
    >
      <div className="ae-ticket ae-scroll-smooth" style={{ overflowY: "auto" }}>
        {/* header — flight number, aircraft, SIM chip */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono font-bold text-[18px] leading-none mb-1" style={{ color: "#141019" }}>{flight.id}</div>
            <div className="text-[11px] font-medium" style={{ color: "#55503F" }}>
              {flight.aircraft_id} · {flight.passengers ?? "—"} pax
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] font-mono font-bold px-2 py-1 rounded-full tracking-widest" style={{ background: "rgba(20,16,25,0.08)", color: "#141019" }}>SIM</span>
            <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center text-lg transition-all" style={{ color: "#55503F" }}>×</button>
          </div>
        </div>

        {/* FROM ── ✈ ── TO */}
        <div className="px-5 pb-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.16em] font-semibold mb-1" style={{ color: "#55503F" }}>From</div>
              <div className="font-mono font-bold leading-none" style={{ color: "#141019", fontSize: 34 }}>{flight.origin.replace("K", "")}</div>
              <div className="text-[10px] mt-1 truncate font-medium" style={{ color: "#55503F" }}>{oAp?.city ?? ""}</div>
            </div>
            <div className="flex-1 flex flex-col items-center pb-4 px-1">
              <div className="text-[10px] font-mono font-semibold mb-1" style={{ color: isCancelled ? "#9D174D" : "#141019" }}>
                {isCancelled ? "CANCELLED" : delayMin > 0 ? `+${delayMin} min` : "on time"}
              </div>
              <div className="w-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ border: "1.5px solid #141019" }} />
                <span className="flex-1" style={{ borderTop: "2px dashed rgba(20,16,25,0.3)" }} />
                {isCancelled ? (
                  <span className="text-[13px] font-bold leading-none" style={{ color: "#141019" }}>✕</span>
                ) : (
                  <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden style={{ color: "#141019", transform: "rotate(90deg)" }}>
                    <path fill="currentColor" d="M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13.5 19v-6z" />
                  </svg>
                )}
                <span className="flex-1" style={{ borderTop: "2px dashed rgba(20,16,25,0.3)" }} />
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#141019" }} />
              </div>
              <div className="text-[9px] font-mono font-medium mt-1" style={{ color: "#55503F" }}>
                {fmtZ(flight.scheduled_departure)} → {fmtZ(flight.scheduled_arrival)}
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[9px] uppercase tracking-[0.16em] font-semibold mb-1" style={{ color: "#55503F" }}>To</div>
              <div className="font-mono font-bold leading-none" style={{ color: "#141019", fontSize: 34 }}>{flight.destination.replace("K", "")}</div>
              <div className="text-[10px] mt-1 truncate font-medium" style={{ color: "#55503F" }}>{dAp?.city ?? ""}</div>
            </div>
          </div>
        </div>

        <div className="ae-ticket-perf" />

        {/* operational stats */}
        <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <TicketStat
            label="Status"
            value={isCancelled ? "Cancelled" : delayMin > 0 ? `+${delayMin} min` : state?.status ?? "On time"}
          />
          <TicketStat
            label="Cascade"
            value={cascOrder < 0 ? "None" : cascOrder === 0 ? "Direct hit" : `Order ${cascOrder}`}
          />
          {!isCancelled && (
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[9px] uppercase tracking-[0.14em] font-semibold" style={{ color: "#55503F" }}>Impact probability</div>
                <div className="text-[12px] font-semibold font-mono" style={{ color: "#141019" }}>{(pDelay * 100).toFixed(0)}%</div>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "rgba(20,16,25,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pDelay * 100}%`, background: pDelay > 0.6 ? "var(--ae-amber)" : "var(--ae-teal)" }}
                />
              </div>
            </div>
          )}
          {actionLabel && (
            <div
              className="col-span-2 rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] font-bold"
              style={{ background: `${actionColor}14`, border: `1px solid ${actionColor}55`, color: "#141019" }}
            >
              <span className="text-sm shrink-0">{actionIcon}</span>
              {actionLabel}
            </div>
          )}
          {state?.reason && (
            <div className="col-span-2 text-[10px] italic leading-relaxed" style={{ color: "#55503F" }}>
              {state.reason}
            </div>
          )}
        </div>

        <div className="ae-ticket-perf" />

        {/* stub — flight id barcode + seat-map action */}
        <div className="px-5 py-4">
          <div className="ae-ticket-barcode mb-1" aria-hidden />
          <div className="font-mono text-[9px] mb-3 tracking-[0.3em]" style={{ color: "#55503F" }}>{flight.id} · {flight.aircraft_id}</div>
          <button
            onClick={onOpenAircraft}
            className="w-full text-[12px] font-semibold px-3 py-2.5 rounded-full transition-colors"
            style={{ background: "#141019", color: "#FFFFFF", border: "none", cursor: "pointer" }}
          >
            Aircraft &amp; seating →
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: "var(--ae-surface)", border: "1px solid var(--ae-line)" }}>
      <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--ae-text-3)", fontWeight: 600 }}>{label}</div>
      <div className="font-mono font-semibold text-[15px] leading-none" style={{ color: tone ?? "var(--ae-text)" }}>{value}</div>
      {sub && <div className="text-[9px] mt-0.5" style={{ color: "var(--ae-text-3)" }}>{sub}</div>}
    </div>
  )
}

/** Boarding-pass ticket: label row + big mono value. All ink-on-white. */
function TicketStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] font-semibold mb-0.5" style={{ color: "#55503F" }}>{label}</div>
      <div className="font-mono font-semibold text-[15px] leading-none" style={{ color: "#141019" }}>{value}</div>
      {sub && <div className="text-[9.5px] mt-0.5 font-medium" style={{ color: "#55503F" }}>{sub}</div>}
    </div>
  )
}

function LivePanel({ flight, onClose }: { flight: LiveFlight; onClose: () => void }) {
  const d = deriveLive(flight)
  const emergency = flight.squawk === "7500" || flight.squawk === "7600" || flight.squawk === "7700"
  const nearAp = d.nearest ? NIMBUS_AIRPORTS[d.nearest.icao] : null
  const aheadAp = d.ahead ? NIMBUS_AIRPORTS[d.ahead.icao] : null
  const fl = flight.altitude_ft != null ? `FL${String(Math.round(flight.altitude_ft / 100)).padStart(3, "0")}` : "—"
  const eta = d.ahead
    ? d.ahead.etaMin < 60 ? `${Math.round(d.ahead.etaMin)} min` : `${(d.ahead.etaMin / 60).toFixed(1)} h`
    : "—"

  return (
    <div
      className="ae-ticket absolute top-12 right-14 left-3 sm:left-auto z-[450] w-[19.5rem] flex flex-col"
      style={{ maxHeight: "calc(100% - 202px)" }}
    >
      {/* header — callsign, airline, LIVE chip */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-[18px] leading-none" style={{ color: "#141019" }}>{flight.flight_icao}</span>
            {flight.flight_iata && flight.flight_iata !== flight.flight_icao && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(20,16,25,0.06)", color: "#55503F" }}>{flight.flight_iata}</span>
            )}
          </div>
          <div className="text-[11px] font-medium truncate" style={{ color: "#55503F" }}>{flight.airline_name}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono font-bold px-2 py-1 rounded-full tracking-widest" style={{ background: "#141019", color: "#FFFFFF" }}>LIVE</span>
          <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center text-lg transition-all" style={{ color: "#55503F" }}>×</button>
        </div>
      </div>
      {emergency && (
        <div className="mx-5 mb-2 text-[10px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(190,24,93,0.10)", color: "#9D174D", border: "1px solid rgba(190,24,93,0.4)" }}>
          EMERGENCY · SQUAWK {flight.squawk}
        </div>
      )}

      <div className="ae-scroll-smooth flex-1 min-h-0" style={{ overflowY: "auto" }}>
        {/* FROM ── ✈ ── TO, boarding-pass style */}
        <div className="px-5 pb-4 pt-1">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.16em] font-semibold mb-1" style={{ color: "#55503F" }}>Nearest</div>
              <div className="font-mono font-bold leading-none" style={{ color: "#141019", fontSize: 34 }}>{nearAp?.iata ?? "———"}</div>
              <div className="text-[10px] mt-1 truncate font-medium" style={{ color: "#55503F" }}>{nearAp?.city ?? "en route"}</div>
            </div>
            <div className="flex-1 flex flex-col items-center pb-4 px-1">
              <div className="text-[10px] font-mono font-semibold mb-1" style={{ color: "#141019" }}>{eta}</div>
              <div className="w-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ border: "1.5px solid #141019" }} />
                <span className="flex-1" style={{ borderTop: "2px dashed rgba(20,16,25,0.3)" }} />
                <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden style={{ color: "#141019", transform: "rotate(90deg)" }}>
                  <path fill="currentColor" d="M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13.5 19v-6z" />
                </svg>
                <span className="flex-1" style={{ borderTop: "2px dashed rgba(20,16,25,0.3)" }} />
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#141019" }} />
              </div>
              <div className="text-[9px] font-medium mt-1" style={{ color: "#55503F" }}>{d.ahead ? `${Math.round(d.ahead.nm)} nm` : d.phase.label}</div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[9px] uppercase tracking-[0.16em] font-semibold mb-1" style={{ color: "#55503F" }}>Heading to</div>
              <div className="font-mono font-bold leading-none" style={{ color: "#141019", fontSize: 34 }}>{aheadAp?.iata ?? "———"}</div>
              <div className="text-[10px] mt-1 truncate font-medium" style={{ color: "#55503F" }}>{aheadAp?.city ?? "no hub in track"}</div>
            </div>
          </div>
        </div>

        <div className="ae-ticket-perf" />

        {/* telemetry — the numbers an operator actually reads */}
        <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <TicketStat label="Altitude" value={flight.altitude_ft != null ? `${flight.altitude_ft.toLocaleString()} ft` : "—"} sub={fl} />
          <TicketStat label="Ground speed" value={d.gs ? `${d.gs} kt` : "—"} sub={d.gs ? `${Math.round(d.gs * 1.15078)} mph` : undefined} />
          <TicketStat label="Vertical rate" value={d.vs ? `${d.vs > 0 ? "▲" : "▼"} ${Math.abs(d.vs).toLocaleString()}` : "level"} sub="fpm" />
          <TicketStat label="Heading" value={`${Math.round(d.hdg)}°`} sub={cardinal(d.hdg)} />
          <TicketStat label="Mach" value={d.mach ? `M ${d.mach.toFixed(2)}` : "—"} />
          <TicketStat label="Dist. to hub" value={d.nearest ? `${Math.round(d.nearest.nm)} nm` : "—"} sub={nearAp ? `${cardinal(bearing(flight.lat, flight.lon, nearAp.lat, nearAp.lon))} of ${nearAp.iata}` : undefined} />
        </div>

        <div className="ae-ticket-perf" />

        {/* stub — transponder hex as the "ticket number" + barcode */}
        <div className="px-5 py-4">
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] font-semibold mb-1" style={{ color: "#55503F" }}>Transponder · ADS-B</div>
              <div className="font-mono text-[13px] font-semibold tracking-wider" style={{ color: "#141019" }}>{flight.icao24.toUpperCase()}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.14em] font-semibold mb-1" style={{ color: "#55503F" }}>Signal</div>
              <div className="font-mono text-[12px] font-semibold" style={{ color: d.ageSec > 60 ? "#8A6410" : "#141019" }}>{d.ageSec}s ago</div>
            </div>
          </div>
          <div className="ae-ticket-barcode mb-1" aria-hidden />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px]" style={{ color: "#55503F" }}>{flight.lat.toFixed(3)}, {flight.lon.toFixed(3)}</span>
            <span className="flex gap-2">
              {flight.tracking.flightaware && (
                <a href={flight.tracking.flightaware} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold underline" style={{ color: "#1E33A8" }}>FlightAware</a>
              )}
              <a href={flight.tracking.flightradar24} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold underline" style={{ color: "#1E33A8" }}>FR24</a>
              <a href={flight.tracking.adsbexchange} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold underline" style={{ color: "#1E33A8" }}>ADS-B</a>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AirportPanel({ icao, faa, hasWx, wxText, simAffected, onClose }: {
  icao: string; faa: FAAStatus | undefined; hasWx: boolean; wxText: string; simAffected: boolean; onClose: () => void
}) {
  const ap = NIMBUS_AIRPORTS[icao]
  if (!ap) return null
  return (
    <div
      className="absolute top-12 right-14 z-[450] w-64 rounded-xl overflow-hidden"
      style={{
        background: GLASS_STRONG,
        backdropFilter: "blur(16px)",
        border: "1px solid var(--ae-line)",
        boxShadow: "var(--ae-shadow-overlay)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: "var(--ae-surface-2)", borderBottom: "1px solid var(--ae-line)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-base" style={{ color: "var(--ae-text)" }}>{ap.iata}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{icao}</span>
            {HUB_AIRPORTS.has(icao) && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "var(--ae-teal-bg)", color: "var(--ae-teal-ink)" }}
              >HUB</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{ap.name}, {ap.city}</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-lg text-muted-foreground hover:bg-secondary transition-all">×</button>
      </div>
      <div className="px-4 py-3 space-y-2">
        {!faa && !hasWx && !simAffected && (
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--ae-text-2)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--ae-teal)" }} />Normal operations
          </div>
        )}
        {faa?.type === "ground_stop" && (
          <div className="rounded-lg p-2.5" style={{ background: "var(--ae-rust-bg)", border: "1px solid var(--ae-line)" }}>
            <div className="font-semibold text-xs" style={{ color: "var(--ae-rust-ink)" }}>Ground stop</div>
            {faa.reason && <div className="text-[10px] mt-0.5" style={{ color: "var(--ae-text-2)" }}>{faa.reason}</div>}
          </div>
        )}
        {faa?.type === "ground_delay_program" && (
          <div className="rounded-lg p-2.5" style={{ background: "var(--ae-amber-bg)", border: "1px solid var(--ae-line)" }}>
            <div className="font-semibold text-xs" style={{ color: "var(--ae-amber-ink)" }}>GDP{faa.delay_minutes > 0 && ` — avg +${faa.delay_minutes} min`}</div>
            {faa.reason && <div className="text-[10px] mt-0.5" style={{ color: "var(--ae-text-2)" }}>{faa.reason}</div>}
          </div>
        )}
        {faa?.type === "departure_delay" && (
          <div className="rounded-lg p-2.5" style={{ background: "var(--ae-amber-bg)", border: "1px solid var(--ae-line)" }}>
            <div className="font-semibold text-xs" style={{ color: "var(--ae-amber-ink)" }}>Departure delay{faa.delay_minutes > 0 && ` +${faa.delay_minutes} min`}</div>
            {faa.reason && <div className="text-[10px] mt-0.5" style={{ color: "var(--ae-text-2)" }}>{faa.reason}</div>}
          </div>
        )}
        {hasWx && (
          <div className="rounded-lg p-2.5" style={{ background: "var(--ae-amber-bg)", border: "1px solid var(--ae-line)" }}>
            <div className="font-semibold text-xs" style={{ color: "var(--ae-amber-ink)" }}>NWS weather alert</div>
            {wxText && <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: "var(--ae-text-2)" }}>{wxText}</div>}
          </div>
        )}
        {simAffected && (
          <div className="rounded-lg p-2.5" style={{ background: "var(--ae-rust-bg)", border: "1px solid var(--ae-line)" }}>
            <div className="text-[10px] font-semibold" style={{ color: "var(--ae-rust-ink)" }}>Simulation disruption active at this airport</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { selectedFlight: string | null; onFlightSelect: (id: string | null) => void }

export default function FlightMap({ selectedFlight, onFlightSelect }: Props) {
  const {
    schedule, flightStates, activeEvents, recoveryPlans, appliedPlanId, applyPlan,
    cascadeSummary, liveFlights, showLiveFlights, showSimulation,
    selectedLiveFlight, setSelectedLiveFlight,
    setLiveFlights, setShowLiveFlights, setShowSimulation,
  } = useSimulationStore()

  const [nowMs, setNowMs]         = useState(() => Date.now())
  const [loading, setLoading]     = useState(false)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const [selAirport, setSelAirport]   = useState<string | null>(null)
  const [airportFAA, setAirportFAA]   = useState<Record<string, FAAStatus>>({})
  const [wxAirports, setWxAirports]   = useState<Record<string, string>>({})
  const [mapZoom, setMapZoom]         = useState(4)
  const [mapBounds, setMapBounds]     = useState<L.LatLngBounds | null>(null)

  // 5s tick — smooth enough for dead reckoning, far fewer re-renders
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 5_000)
    return () => clearInterval(t)
  }, [])

  const fetchLive = useCallback(async () => {
    setLoading(true)
    try {
      // Use the Vercel-native endpoint — Railway's IPs are blocked by OpenSky,
      // so /api/v1/flights/live (proxied to Railway) always times out in prod.
      // /api/flights-live fetches via the /api/osky relay on Vercel's network.
      const res = await fetch("/api/flights-live").then((r) => r.json()) as { flights?: LiveFlight[] }
      const all: LiveFlight[] = res.flights || []
      setLiveFlights(all.filter((f) => f.airline_iata && f.airline_name !== "Unknown"), Date.now())
      setLastFetch(Date.now())
    } catch { /* degrade */ } finally { setLoading(false) }
  }, [setLiveFlights])

  useEffect(() => {
    // Paint cached planes immediately (if fresh) so the map isn't empty while
    // the first live fetch runs, then refresh + poll.
    useSimulationStore.getState().hydrateLiveFromCache()
    fetchLive()
    const t = setInterval(fetchLive, 15_000)
    return () => clearInterval(t)
  }, [fetchLive])

  const fetchFAA = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        programs?: Array<{ airport_icao?: string; type: "ground_stop" | "ground_delay_program" | "departure_delay"; avg_delay_minutes?: number; reason?: string }>
      }>("/live/faa-status")
      const map: Record<string, FAAStatus> = {}
      for (const p of res.data.programs || []) {
        const icao = p.airport_icao; if (!icao) continue
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


  // Deduplicated active events (fixes duplicate key warning)
  const dedupEvents = useMemo(
    () => [...new Map(activeEvents.map((e) => [e.id, e])).values()],
    [activeEvents]
  )

  // Applied recovery plan sets — strictly derived from the plan dict so the
  // inspector card can keep its distinction between "cancelled by plan" and
  // "grounded by cascade".
  const applied = useMemo(() => {
    const plan = appliedPlanId ? recoveryPlans.find((p) => p.plan_id === appliedPlanId) : null
    const delayed = new Map<string, number>()
    for (const d of plan?.delayed_flights || []) delayed.set(d.flight_id, d.delay_minutes)
    return {
      cancelled: new Set<string>(plan?.cancelled_flights || []),
      swap:      new Set<string>((plan?.aircraft_swaps || []).map((s: any) => s.flight_id)),
      delayed,
    }
  }, [appliedPlanId, recoveryPlans])

  // Visual cancellation set — union of:
  //
  //   (a) `applied.cancelled` — the currently-selected plan's own list (fast
  //        optimistic update when the operator switches plans);
  //
  //   (b) every flight backend-marked status="cancelled" THAT IS NOT STAMPED
  //        WITH A DIFFERENT PLAN'S applied_plan_id.
  //
  // Clause (b) is the critical filter. After applying Plan A, flight_states
  // entries for A's cancelled flights carry `status="cancelled"` AND
  // `applied_plan_id="A"`. When the operator clicks Plan B, the FRONTEND
  // optimistically flips appliedPlanId to "B" before the WS broadcast
  // arrives. Without the filter, those Plan-A-stamped flights stay in the
  // visuallyCancelled set during the gap — the map shows Plan A's grey
  // lines PLUS Plan B's grey lines, so the switch reads as "nothing
  // changed". With the filter, anything stamped by Plan A is excluded the
  // instant appliedPlanId moves to "B" (it'll be restored by the snapshot
  // revert on the backend anyway, so we're just front-running that revert).
  //
  // Cascade-cancelled flights (no `applied_plan_id` at all) are always
  // included — they're genuinely not operating regardless of plan choice.
  const visuallyCancelled = useMemo(() => {
    const set = new Set<string>(applied.cancelled)
    for (const fid in flightStates) {
      const s = flightStates[fid]
      if (s?.status !== "cancelled") continue
      const stampedBy = s.applied_plan_id ?? null
      // Include if: cascade-cancelled (no stamp) OR stamped by the plan we
      // currently have selected. Exclude if stamped by a stale plan.
      if (stampedBy == null || stampedBy === appliedPlanId) {
        set.add(fid)
      }
    }
    return set
  }, [applied.cancelled, flightStates, appliedPlanId])

  const activePlan = appliedPlanId ? recoveryPlans.find((p: RecoveryPlan) => p.plan_id === appliedPlanId) ?? null : null

  // Sim event epicenter airports
  const simEvtAirports = useMemo(() => {
    const s = new Set<string>()
    for (const e of dedupEvents) {
      const p = e.params || {}
      if (p.airport)             s.add(p.airport)
      if (p.base)                s.add(p.base)
      if (p.destination_airport) s.add(p.destination_airport)
    }
    return s
  }, [dedupEvents])

  const hasActiveEvents = dedupEvents.length > 0

  // Auto-enable Nimbus sim overlay the first time an event fires
  useEffect(() => {
    if (hasActiveEvents) setShowSimulation(true)
  }, [hasActiveEvents, setShowSimulation])

  // Color by cascade/plan state.
  //
  // Cancellation is checked FIRST against the visual union set — any flight
  // marked status="cancelled" by the backend (whether from the cascade
  // predictor or from an applied plan) reads grey. Swap and delayed only
  // fire after the operator explicitly applies a plan.
  function cascColor(fid: string, state: any): string {
    if (visuallyCancelled.has(fid))        return MAP_COLORS.planCancelled
    if (applied.swap.has(fid))             return MAP_COLORS.planSwap
    if (applied.delayed.has(fid))          return MAP_COLORS.planDelayed
    if (!state || state.cascade_order < 0) return MAP_COLORS.unaffected
    if (state.cascade_order === 0)         return MAP_COLORS.cascadeDirect
    if (state.cascade_order === 1)         return MAP_COLORS.cascadeOrder1
    if (state.cascade_order >= 2)          return MAP_COLORS.cascadeOrder2
    return MAP_COLORS.unaffected
  }

  // Impact routes
  //
  // `kind` drives both the visual treatment AND the click affordance:
  //   "cancelled" → grey + dashed + low opacity, still clickable so users can
  //                 inspect why the flight was cut.
  //   "swap"      → green + animated flowing-dash CSS class (.ae-route-flow)
  //                 to signal "active reroute / new assignment".
  //   "delayed"   → peach, solid.
  //   "cascade"   → coral/mustard/yellow per cascade order — no plan applied yet.
  type RouteKind = "cancelled" | "swap" | "delayed" | "cascade"
  type ImpactRoute = {
    id: string
    from: [number, number]
    to:   [number, number]
    color: string
    weight: number
    opacity: number
    dashed: boolean
    kind:  RouteKind
  }
  const { impactRoutes, impactIds } = useMemo(() => {
    const routes: ImpactRoute[] = []
    const ids = new Set<string>()
    for (const f of schedule) {
      const state = flightStates[f.id]
      // Use the visual union set (plan-cancellations + status="cancelled"
      // from the backend) so cascade-cancelled flights also render grey.
      const isCancelled = visuallyCancelled.has(f.id)
      const isSwap      = applied.swap.has(f.id)
      const isDelayed   = applied.delayed.has(f.id)
      const isAffected  = state && (state.cascade_order >= 0 || isCancelled || isDelayed || isSwap)
      if (!isAffected) continue
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) continue

      const sel = selectedFlight === f.id

      // Pick the kind in priority order: cancelled > swap > delayed > cascade.
      const kind: RouteKind =
        isCancelled ? "cancelled" :
        isSwap      ? "swap"      :
        isDelayed   ? "delayed"   :
                      "cascade"

      const color =
        kind === "cancelled" ? MAP_COLORS.planCancelled :
        kind === "swap"      ? MAP_COLORS.planSwap :
        kind === "delayed"   ? MAP_COLORS.planDelayed :
                                cascColor(f.id, state)

      // Cancelled flights deliberately read as MUTED — same line geometry so
      // they remain clickable, but lower weight + opacity so live re-routes
      // visually dominate.
      const weight =
        kind === "cancelled" ? (sel ? 3 : 1.6) :
        kind === "swap"      ? (sel ? 4 : 3.2) :   // a touch heavier so the new route reads as primary
        sel                  ? 4 :
        state?.cascade_order === 0 ? 2.5 : 2

      const opacity =
        kind === "cancelled" ? (sel ? 0.65 : 0.35) :
        kind === "swap"      ? (sel ? 1.0  : 0.92) :
        sel                  ? 1 :
        state?.cascade_order === 0 ? 0.85 : 0.60

      routes.push({
        id: f.id,
        from: [o.lat, o.lon],
        to:   [d.lat, d.lon],
        color,
        weight,
        opacity,
        // Swap routes get a dash too, but a SHORT one — combined with the
        // CSS animation that walks `stroke-dashoffset` it reads as a
        // flowing beam, not a static dashed line.
        dashed: kind === "cancelled" || kind === "swap",
        kind,
      })
      ids.add(f.id)
    }
    return { impactRoutes: routes, impactIds: ids }
  }, [flightStates, schedule, selectedFlight, applied]) // eslint-disable-line react-hooks/exhaustive-deps

  // `applyEpoch` increments every time the applied-action sets change OR
  // the visual cancellation set grows (cascade-cancelled flights arriving
  // from the backend). Used as a React key on the Polyline layer below so
  // changes force a remount, triggering the fade-in / draw-on animation.
  const applyEpoch = useMemo(
    () => `${appliedPlanId ?? "none"}:${visuallyCancelled.size}:${applied.delayed.size}:${applied.swap.size}`,
    [appliedPlanId, applied, visuallyCancelled],
  )

  // Dead-reckoned live positions — viewport culled for performance
  const livePlanes = useMemo(() => {
    const nowSec = nowMs / 1000
    return liveFlights
      .filter((lf) => !mapBounds || mapBounds.contains([lf.lat, lf.lon]))
      .slice(0, 450)
      .map((lf) => {
        if (!lf.on_ground && lf.heading != null && (lf.velocity_kt ?? 0) > 80 && lf.last_contact > 0) {
          const elapsed = nowSec - lf.last_contact
          if (elapsed >= 0 && elapsed < 300) {
            const [lat, lon] = deadReckon(lf.lat, lf.lon, lf.heading, lf.velocity_kt!, elapsed)
            return { lf, lat, lon }
          }
        }
        return { lf, lat: lf.lat, lon: lf.lon }
      })
  }, [liveFlights, nowMs, mapBounds])

  // Simulated Nimbus aircraft.
  //
  // Every scheduled flight is ALWAYS visible, looping continuously along
  // its leg (progress wraps modulo 1). The previous time-window gating hid
  // most of the fleet for most of the 6-minute day cycle, which read as
  // "the planes disappeared" until you zoomed into the few survivors.
  const simPlanes = useMemo(() => {
    if (!showSimulation) return []
    const cycle = 60 * 6, phase = ((nowMs / 1000) % cycle) / cycle, hr = 6 + phase * 18
    return schedule.flatMap((f) => {
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) return []
      const dep = isoToHour(f.scheduled_departure), arr = isoToHour(f.scheduled_arrival)
      const dur = arr > dep ? arr - dep : 1.5
      let t = ((hr - dep) / dur) % 1
      if (t < 0) t += 1
      const [lat, lon] = interp(o.lat, o.lon, d.lat, d.lon, Math.max(0.02, Math.min(0.98, t)))
      return [{ id: f.id, f, lat, lon, brg: bearing(o.lat, o.lon, d.lat, d.lon) }]
    })
  }, [schedule, nowMs, showSimulation])

  // Selected flight arc
  const selectedSched = selectedFlight ? schedule.find((f) => f.id === selectedFlight) ?? null : null
  const selectedArc = useMemo(() => {
    if (!selectedSched) return null
    const o = NIMBUS_AIRPORTS[selectedSched.origin], d = NIMBUS_AIRPORTS[selectedSched.destination]
    if (!o || !d) return null
    return arcPoints(o.lat, o.lon, d.lat, d.lon)
  }, [selectedSched])

  const selState = selectedSched ? flightStates[selectedSched.id] : undefined
  const selArcColor = selectedSched
    ? visuallyCancelled.has(selectedSched.id) ? MAP_COLORS.planCancelled
    : applied.swap.has(selectedSched.id)      ? MAP_COLORS.planSwap
    : applied.delayed.has(selectedSched.id)   ? MAP_COLORS.planDelayed
    : selState?.cascade_order === 0 ? MAP_COLORS.cascadeDirect
    : selState?.cascade_order != null && selState.cascade_order >= 1 ? MAP_COLORS.cascadeOrder1
    : MAP_COLORS.liveSelected
    : MAP_COLORS.liveSelected

  // Projected path for the selected live flight: a curved leg from the
  // nearest airport behind it (likely origin) through its current position,
  // and a forward leg to the airport it is tracking toward (likely arrival).
  // Both endpoints + the dead-reckoned position are computed from ADS-B only.
  const selLivePath = useMemo(() => {
    const lf = selectedLiveFlight
    if (!lf) return null
    const nowSec = nowMs / 1000
    const elapsed = nowSec - lf.last_contact
    const [cLat, cLon] =
      lf.heading != null && (lf.velocity_kt ?? 0) > 40 && elapsed > 0 && elapsed < 300
        ? deadReckon(lf.lat, lf.lon, lf.heading, lf.velocity_kt!, elapsed)
        : [lf.lat, lf.lon]

    const d = deriveLive(lf)
    const originAp = d.nearest ? NIMBUS_AIRPORTS[d.nearest.icao] : null
    const arrAp = d.ahead ? NIMBUS_AIRPORTS[d.ahead.icao] : null
    // only draw the "behind" leg when the plane has actually left that airport
    const behind =
      originAp && (d.nearest?.nm ?? 0) > 12
        ? arcPoints(originAp.lat, originAp.lon, cLat, cLon, 24)
        : null
    const ahead = arrAp ? arcPoints(cLat, cLon, arrAp.lat, arrAp.lon, 24) : null
    return { pos: [cLat, cLon] as [number, number], originAp, arrAp, behind, ahead, hdg: lf.heading }
  }, [selectedLiveFlight, nowMs])

  const focusTarget: ScheduledFlight | LiveFlight | null = selectedSched || selectedLiveFlight
  const ageSec = lastFetch ? Math.round((nowMs - lastFetch) / 1000) : null

  // Focus mode — selecting a scheduled OR live flight blurs the basemap and
  // dims every other layer; the selected route + endpoints re-render into the
  // ae-focus panes so they stay crisp. Reverts on deselect.
  const focusMode = !!selectedSched || !!selectedLiveFlight
  const selPlane = selectedSched ? simPlanes.find((p) => p.id === selectedSched.id) ?? null : null
  const [showAircraft, setShowAircraft] = useState(false)
  useEffect(() => { setShowAircraft(false) }, [selectedFlight])

  // Live selection gets the LIGHT focus (no basemap blur, others just recede);
  // a scheduled-flight selection keeps the fuller blur-focus treatment.
  const focusClass = selectedLiveFlight ? " map-focus-live" : selectedSched ? " map-focus" : ""

  return (
    <div className={`simulator-map-shell w-full h-full min-h-0 relative overflow-hidden isolate${focusClass}`}>
      <MapContainer
        center={[39.5, -98.0]} zoom={4} minZoom={2} maxZoom={14}
        zoomControl={false} scrollWheelZoom worldCopyJump={false}
        preferCanvas
        className="w-full h-full z-0"
      >
        <MapResizeFix />
        <ZoomControl position="topright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd" maxZoom={19}
        />
        <ZoomTracker onZoom={setMapZoom} />
        <BoundsTracker onBounds={setMapBounds} />
        <FitBounds flights={schedule} />
        <FocusFlight target={focusTarget} />

        {/* Event epicenter — 3 concentric rings for visual depth */}
        {hasActiveEvents && Array.from(simEvtAirports).flatMap((icao) => {
          const ap = NIMBUS_AIRPORTS[icao]
          if (!ap) return []
          const c: [number, number] = [ap.lat, ap.lon]
          return [
            <Circle key={`ep0-${icao}`} center={c} radius={70_000}
              pathOptions={{ color: MAP_COLORS.eventEpicenter, weight: 2.5, opacity: 0.70, fillColor: MAP_COLORS.eventEpicenter, fillOpacity: 0.10 }} />,
            <Circle key={`ep1-${icao}`} center={c} radius={160_000}
              pathOptions={{ color: MAP_COLORS.eventEpicenter, weight: 1.5, opacity: 0.40, fillColor: MAP_COLORS.eventEpicenter, fillOpacity: 0.05, dashArray: "6 5" }} />,
            <Circle key={`ep2-${icao}`} center={c} radius={300_000}
              pathOptions={{ color: MAP_COLORS.eventEpicenter, weight: 1, opacity: 0.18, fillColor: MAP_COLORS.eventEpicenter, fillOpacity: 0.02, dashArray: "3 9" }} />,
          ]
        })}

        {/* Background Nimbus routes (unaffected) */}
        {showSimulation && schedule.map((f) => {
          if (impactIds.has(f.id)) return null
          const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
          if (!o || !d) return null
          const sel = selectedFlight === f.id
          return (
            <Polyline key={`bg-${f.id}`}
              positions={[[o.lat, o.lon], [d.lat, d.lon]]}
              pathOptions={{ color: "#9FAEA5", weight: sel ? 2 : 1, opacity: sel ? 0.7 : 0.3, dashArray: sel ? undefined : "2 6" }}
              eventHandlers={{ click: () => onFlightSelect(sel ? null : f.id) }}
            />
          )
        })}

        {/*
          Impact routes — one Polyline per affected flight.

          The `applyEpoch` is folded into the key so applying or unapplying a
          plan remounts the entire layer, triggering a CSS fade-in (declared
          in globals.css). Without this every Leaflet redraw is in-place and
          users perceive the apply as "nothing happened".

          Swap routes are tagged with the `ae-route-flow` class so the SVG
          path animates its stroke-dashoffset — reads as a flowing beam,
          communicating "active reroute" rather than a static dashed line.

          Cancelled routes stay on the layer (low opacity + dashed) and
          remain CLICKABLE so the user can still drill into a cancelled
          flight. The cursor stays pointer per Leaflet defaults.
        */}
        {impactRoutes.map((r) => {
          const className =
            r.kind === "swap"      ? "ae-route ae-route-flow" :
            r.kind === "cancelled" ? "ae-route ae-route-cancelled" :
                                     "ae-route"
          // Swap routes get a tighter dash so the animation reads like a
          // moving beam, not a long-segment crawl.
          const dashArray =
            r.kind === "swap"      ? "8 6" :
            r.kind === "cancelled" ? "10 6" :
                                     undefined
          return (
            <Polyline
              key={`imp-${applyEpoch}-${r.id}`}
              positions={[r.from, r.to]}
              pathOptions={{
                color:     r.color,
                weight:    r.weight,
                opacity:   r.opacity,
                dashArray,
                className,
              }}
              eventHandlers={{ click: () => onFlightSelect(selectedFlight === r.id ? null : r.id) }}
            />
          )
        })}

        {/* Focus panes — siblings of the dimmed overlay/marker panes, so
            everything rendered here stays crisp while the rest recedes. */}
        <Pane name="ae-focus-line" style={{ zIndex: 460 }} />
        <Pane name="ae-focus-marker" style={{ zIndex: 640 }} />

        {/* Selected flight — highlighted bezier arc in the focus pane */}
        {selectedArc && (
          <>
            {/* Soft underlayer */}
            <Polyline
              pane="ae-focus-line"
              positions={selectedArc}
              pathOptions={{ color: selArcColor, weight: 10, opacity: 0.14 }}
            />
            {/* Main arc — dashed if the selected flight is cancelled (by
                plan or by cascade), preserving the "non-operating" semantic. */}
            <Polyline
              pane="ae-focus-line"
              positions={selectedArc}
              pathOptions={{
                color: selArcColor, weight: 3.5, opacity: 0.95,
                dashArray: visuallyCancelled.has(selectedSched!.id) ? "12 7" : undefined,
              }}
            />
          </>
        )}

        {/* Selected flight — endpoints + aircraft re-rendered crisp above
            the dimmed layers while focus mode is active */}
        {focusMode && selectedSched && [selectedSched.origin, selectedSched.destination].map((icao) => {
          const ap = NIMBUS_AIRPORTS[icao]
          if (!ap) return null
          return (
            <Marker
              key={`focus-ap-${icao}`}
              pane="ae-focus-marker"
              position={[ap.lat, ap.lon]}
              icon={airportIcon(HUB_AIRPORTS.has(icao), airportFAA[icao], icao in wxAirports, simEvtAirports.has(icao), false)}
              interactive={false}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={1} permanent>
                <span className="font-mono font-bold text-[10px]">
                  {icao === selectedSched.origin ? `${ap.iata} · departs` : `${ap.iata} · arrives`}
                </span>
              </Tooltip>
            </Marker>
          )
        })}
        {focusMode && selPlane && (
          <Marker
            pane="ae-focus-marker"
            position={[selPlane.lat, selPlane.lon]}
            icon={simIcon(
              cascColor(selPlane.id, flightStates[selPlane.id]),
              selPlane.brg, true,
              flightStates[selPlane.id]?.cascade_order ?? -1,
              visuallyCancelled.has(selPlane.id),
              applied.swap.has(selPlane.id),
            )}
            eventHandlers={{ click: () => onFlightSelect(null) }}
          />
        )}

        {/* Selected live flight — colorful projected path + crisp blinking
            marker in the focus panes, above the dimmed map. */}
        {selLivePath && (
          <>
            {/* behind leg (origin → position): dashed teal, glow underlay */}
            {selLivePath.behind && (
              <>
                <Polyline pane="ae-focus-line" positions={selLivePath.behind}
                  pathOptions={{ color: MAP_COLORS.liveSelected, weight: 8, opacity: 0.10 }} />
                <Polyline pane="ae-focus-line" positions={selLivePath.behind}
                  pathOptions={{ color: MAP_COLORS.liveSelected, weight: 2, opacity: 0.55, dashArray: "3 7" }} />
              </>
            )}
            {/* forward leg (position → arrival): solid glowing teal beam */}
            {selLivePath.ahead && (
              <>
                <Polyline pane="ae-focus-line" positions={selLivePath.ahead}
                  pathOptions={{ color: MAP_COLORS.liveSelected, weight: 10, opacity: 0.16 }} />
                <Polyline pane="ae-focus-line" positions={selLivePath.ahead}
                  pathOptions={{ color: MAP_COLORS.liveSelected, weight: 3.5, opacity: 0.95, className: "ae-route-flow", dashArray: "10 7" }} />
              </>
            )}
            {/* origin + arrival airports, crisp with labels */}
            {selLivePath.originAp && (
              <Marker pane="ae-focus-marker" position={[selLivePath.originAp.lat, selLivePath.originAp.lon]}
                icon={airportIcon(HUB_AIRPORTS.has(`K${selLivePath.originAp.iata}`), undefined, false, false, false)} interactive={false}>
                <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent>
                  <span className="font-mono font-bold text-[10px]">{selLivePath.originAp.iata} · nearest</span>
                </Tooltip>
              </Marker>
            )}
            {selLivePath.arrAp && (
              <Marker pane="ae-focus-marker" position={[selLivePath.arrAp.lat, selLivePath.arrAp.lon]}
                icon={airportIcon(HUB_AIRPORTS.has(`K${selLivePath.arrAp.iata}`), undefined, false, false, true)} interactive={false}>
                <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent>
                  <span className="font-mono font-bold text-[10px]">{selLivePath.arrAp.iata} · heading to</span>
                </Tooltip>
              </Marker>
            )}
            {/* the selected plane — blinking radar marker */}
            <Marker pane="ae-focus-marker" position={selLivePath.pos}
              icon={liveSelIcon(selLivePath.hdg)}
              eventHandlers={{ click: () => setSelectedLiveFlight(null) }} />
          </>
        )}

        {/* Airport nodes */}
        {Object.entries(NIMBUS_AIRPORTS).map(([id, ap]) => (
          <Marker key={id} position={[ap.lat, ap.lon]}
            icon={airportIcon(HUB_AIRPORTS.has(id), airportFAA[id], id in wxAirports, simEvtAirports.has(id), selAirport === id)}
            zIndexOffset={airportFAA[id] ? 1200 : HUB_AIRPORTS.has(id) ? 600 : 100}
            eventHandlers={{ click: () => { setSelAirport(selAirport === id ? null : id); onFlightSelect(null); setSelectedLiveFlight(null) } }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={1}>
              <div>
                <div className="font-mono font-bold text-xs">{ap.iata} · {id}</div>
                <div className="text-[10px] text-muted-foreground">{ap.name}, {ap.city}</div>
                {airportFAA[id] && (
                  <div className="text-[10px] font-semibold mt-0.5" style={{ color: airportFAA[id].type === "ground_stop" ? "var(--ae-rust-ink)" : "var(--ae-amber-ink)" }}>
                    {airportFAA[id].type === "ground_stop" ? "Ground stop"
                      : airportFAA[id].type === "ground_delay_program" ? `GDP +${airportFAA[id].delay_minutes}m`
                      : `+${airportFAA[id].delay_minutes}m dep delay`}
                  </div>
                )}
                {id in wxAirports && <div className="text-[10px]" style={{ color: "var(--ae-amber-ink)" }}>WX alert</div>}
                {simEvtAirports.has(id) && <div className="text-[10px] font-semibold" style={{ color: "var(--ae-rust-ink)" }}>Disruption epicenter</div>}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Simulated Nimbus aircraft — the markers along the route lines.
            Cancelled aircraft are drawn muted (grey, ✕ badge, low z-index)
            but stay clickable so users can inspect why a leg was cut.
            Swapped aircraft are drawn in the green reroute palette so the
            "new assignment" reads at a glance. */}
        {simPlanes.map(({ id, f, lat, lon, brg }) => {
          const state = flightStates[id]
          const sel = selectedFlight === id
          // Use the visual union: any flight with status="cancelled" reads
          // grey + ✕ on the marker too, not just plan-cancelled ones.
          const isCancelled = visuallyCancelled.has(id)
          const isSwap      = applied.swap.has(id)
          const cascOrder = state?.cascade_order ?? -1
          return (
            <Marker
              key={`sim-${applyEpoch}-${id}`}
              position={[lat, lon]}
              icon={simIcon(cascColor(id, state), brg, sel, cascOrder, isCancelled, isSwap)}
              // Cancelled markers sink to the bottom of the z-stack so live
              // operating planes always render on top.
              zIndexOffset={
                isCancelled ? 50 :
                sel         ? 2000 :
                isSwap      ? 900 :
                cascOrder === 0 ? 800 :
                cascOrder >= 1  ? 500 :
                                  200
              }
              eventHandlers={{ click: () => onFlightSelect(sel ? null : id) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div>
                  <div className="font-mono font-bold text-xs">{id} <span className="text-[9px] font-semibold" style={{ color: "var(--ae-text-3)" }}>[SIM]</span></div>
                  <div className="text-[10px] text-muted-foreground">{f.aircraft_id} · {f.origin} → {f.destination}</div>
                  {state?.delay_minutes > 0 && <div className="text-[10px] font-semibold" style={{ color: "var(--ae-amber-ink)" }}>+{state.delay_minutes} min delay</div>}
                  {state?.cascade_order === 0 && !isCancelled && <div className="text-[10px] font-semibold" style={{ color: "var(--ae-rust-ink)" }}>Direct impact</div>}
                  {isCancelled && (
                    <div className="text-[10px] font-bold" style={{ color: MAP_COLORS.planCancelledInk }}>
                      ✕ Cancelled by plan — click to inspect
                    </div>
                  )}
                  {isSwap && (
                    <div className="text-[10px] font-bold" style={{ color: MAP_COLORS.planSwap }}>
                      ↕ Re-routed · new aircraft assigned
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          )
        })}

        {/* Live airline aircraft — viewport culled */}
        {showLiveFlights && livePlanes.map(({ lf, lat, lon }) => {
          const sel = selectedLiveFlight?.icao24 === lf.icao24
          return (
            <Marker key={`lv-${lf.icao24}`} position={[lat, lon]}
              icon={liveIcon(lf.heading, sel, lf.velocity_kt)}
              zIndexOffset={sel ? 1900 : 400}
              eventHandlers={{ click: () => { setSelectedLiveFlight(sel ? null : lf); onFlightSelect(null); setSelAirport(null) } }}
            >
              {(sel || mapZoom >= 7) && (
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div>
                    <div className="font-mono font-bold text-xs">
                      {lf.flight_iata || lf.flight_icao}
                      <span
                        className="ml-1.5 text-[8px] px-1 py-0.5 rounded font-semibold"
                        style={{ background: "var(--ae-neutral-bg)", border: "1px solid var(--ae-line)", color: "var(--ae-text-3)" }}
                      >ADS-B</span>
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

      {/* ── Overlay panels ── */}

      {/* Recovery plan banner — top of map when plan applied */}
      {activePlan && <RecoveryBanner plan={activePlan} onUnapply={() => applyPlan(null)} />}

      {/* Disruption banner — top-left */}
      {!activePlan && (
        <DisruptionBanner events={dedupEvents} impactCount={impactRoutes.length} summary={cascadeSummary} />
      )}

      {/* When plan is active, show compact event list at top-left */}
      {activePlan && hasActiveEvents && (
        <div className="absolute top-3 left-3 z-[450]" style={{ maxWidth: 240 }}>
          <div
            className="rounded-lg px-3 py-2"
            style={{
              background: GLASS, backdropFilter: "blur(12px)",
              border: "1px solid var(--ae-line)",
              borderLeft: "2px solid var(--ae-rust)",
            }}
          >
            <div className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--ae-rust-ink)" }}>
              {dedupEvents.length} disruption{dedupEvents.length !== 1 ? "s" : ""} active
            </div>
            {dedupEvents.slice(0, 2).map((ev) => (
              <div key={ev.id} className="flex items-center gap-1.5 text-[10px] mb-0.5" style={{ color: "var(--ae-text-2)" }}>
                <EventIcon kind={ev.kind} className="w-3 h-3 shrink-0" style={{ color: "var(--ae-text-3)" }} />
                <span className="truncate">{EVENT_LABELS[ev.kind] ?? ev.kind.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live flight detail */}
      {selectedLiveFlight && <LivePanel flight={selectedLiveFlight} onClose={() => setSelectedLiveFlight(null)} />}

      {/* Sim flight detail */}
      {selectedSched && !selectedLiveFlight && (
        <FlightDetailCard
          flight={selectedSched}
          state={flightStates[selectedSched.id]}
          appliedPlan={activePlan}
          applied={applied}
          onClose={() => onFlightSelect(null)}
          onOpenAircraft={() => setShowAircraft(true)}
        />
      )}

      {/* Aircraft seat-map modal */}
      {showAircraft && selectedSched && (
        <AircraftDetail flight={selectedSched} onClose={() => setShowAircraft(false)} />
      )}

      {/* Airport panel */}
      {selAirport && !selectedLiveFlight && !selectedSched && (
        <AirportPanel
          icao={selAirport} faa={airportFAA[selAirport]}
          hasWx={selAirport in wxAirports} wxText={wxAirports[selAirport] || ""}
          simAffected={simEvtAirports.has(selAirport)} onClose={() => setSelAirport(null)}
        />
      )}

      {/* Layer toggles — bottom-LEFT (the bottom-right is owned by the fixed
          Ask-Aeolus bubble; keeping them apart avoids the overlap). */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-col gap-2 items-start">
        <div
          className="rounded-lg px-3 py-2 flex flex-col gap-1.5 text-[11px]"
          style={{ background: GLASS, backdropFilter: "blur(12px)", border: "1px solid var(--ae-line)" }}
        >
          <button
            onClick={() => setShowLiveFlights(!showLiveFlights)}
            className="flex items-center gap-2 font-medium transition-colors"
            style={{ color: showLiveFlights ? "var(--ae-text)" : "var(--ae-text-3)" }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: showLiveFlights ? MAP_COLORS.live : "var(--ae-line-strong)" }}
            />
            <span>Real flights (ADS-B)</span>
            {showLiveFlights && liveFlights.length > 0 && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full font-mono tabular-nums" style={{ background: "var(--ae-neutral-bg)", color: "var(--ae-text-2)" }}>
                {liveFlights.length.toLocaleString()}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className="flex items-center gap-2 font-medium transition-colors"
            style={{ color: showSimulation ? "var(--ae-text)" : "var(--ae-text-3)" }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: showSimulation ? "var(--ae-teal)" : "var(--ae-line-strong)" }}
            />
            <span>Nimbus Air sim</span>
            {showSimulation && simPlanes.length > 0 && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full font-mono tabular-nums" style={{ background: "var(--ae-teal-bg)", color: "var(--ae-teal-ink)" }}>
                {simPlanes.length}
              </span>
            )}
          </button>
        </div>

        {/* ADS-B age */}
        {ageSec != null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-medium"
            style={{
              background: GLASS,
              backdropFilter: "blur(8px)",
              border: "1px solid var(--ae-line)",
              color: ageSec > 30 ? "var(--ae-amber-ink)" : "var(--ae-text-3)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: loading ? "var(--ae-amber)" : liveFlights.length > 0 ? "var(--ae-teal)" : "var(--ae-rust)" }}
            />
            {loading ? "Fetching…" : `ADS-B · ${ageSec}s ago`}
          </div>
        )}
      </div>

      {/* Legend — bottom-left, stacked ABOVE the layer toggles */}
      <div className="absolute left-3 z-[400]" style={{ bottom: 104 }}>
        <div
          className="px-3 py-2 rounded-lg text-[10px]"
          style={{ background: GLASS, backdropFilter: "blur(12px)", border: "1px solid var(--ae-line)" }}
        >
          {/* Always-visible: live layer */}
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full" style={{ background: MAP_COLORS.live }} />
              <span className="text-muted-foreground">Live ADS-B</span>
            </div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: MAP_COLORS.groundStop }} /><span className="text-muted-foreground">GS</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: MAP_COLORS.gdp }} /><span className="text-muted-foreground">GDP</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: MAP_COLORS.weather, opacity: 0.6 }} /><span className="text-muted-foreground">WX</span></div>
          </div>
          {/* Disruption/plan legend — keyed off the canonical MAP_COLORS so
              the legend swatches always match the actual lines/markers on
              the canvas. Previously the swatches were inlined hex values
              (orange-400, #6366F1) that had drifted from the live palette. */}
          {(hasActiveEvents || appliedPlanId) && (
            <>
              <div className="border-t border-border/40 pt-1.5 mt-0.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Nimbus fleet status</div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: MAP_COLORS.unaffected }} />
                    <span className="text-muted-foreground">On-time</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: MAP_COLORS.cascadeDirect }} />
                    <span className="text-muted-foreground">Direct hit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: MAP_COLORS.cascadeOrder1 }} />
                    <span className="text-muted-foreground">Cascade</span>
                  </div>
                  {appliedPlanId && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[8px] text-white font-bold"
                          style={{ background: MAP_COLORS.planCancelled, border: "1px dashed rgba(255,255,255,0.9)" }}
                        >✕</span>
                        <span className="text-muted-foreground">Cancelled</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: MAP_COLORS.planSwap, boxShadow: `0 0 0 2px ${MAP_COLORS.planSwap}40` }} />
                        <span className="text-muted-foreground">Re-routed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: MAP_COLORS.planDelayed }} />
                        <span className="text-muted-foreground">Delayed</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
