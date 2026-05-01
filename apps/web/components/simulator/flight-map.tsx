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
  type ActiveEvent,
  type CascadeSummary,
  type RecoveryPlan,
  type FlightState,
} from "@/stores/simulation"
import { NIMBUS_AIRPORTS, HUB_AIRPORTS } from "./airports"
import { apiClient } from "@/lib/api"

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

function liveIcon(heading: number | null, sel: boolean, velKt: number | null): L.DivIcon {
  const hdg = Math.round((heading ?? 0) / 10) * 10
  const slow = (velKt ?? 0) < 50
  const key = `lv|${hdg}|${sel}|${slow}`
  return icon(key, () => {
    const sz = sel ? 30 : 16
    const fill = sel ? "#EF6C4A" : "#38BDF8"
    const op = slow ? 0.4 : 1
    return L.divIcon({
      className: "",
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2],
      html: `<div style="width:${sz}px;height:${sz}px;transform:rotate(${hdg}deg);transform-origin:center;opacity:${op}"><svg viewBox="0 0 24 24" width="${sz}" height="${sz}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="${fill}" stroke="rgba(255,255,255,0.85)" stroke-width="0.8"/></svg></div>`,
    })
  })
}

function simIcon(color: string, rot: number, sel: boolean, cascOrder: number): L.DivIcon {
  const r   = Math.round(rot / 10) * 10
  // Larger base sizes — colored circle is the primary visual so everything needs to be readable
  const sz  = sel ? 34 : cascOrder === 0 ? 28 : cascOrder >= 1 ? 22 : 18
  const key = `sim3|${r}|${color}|${sel}|${cascOrder}`
  return icon(key, () => {
    const planeSz = Math.round(sz * 0.52)
    // Outer ring: white halo + colored outer ring for selection / direct-hit emphasis
    const ring = sel
      ? `box-shadow:0 0 0 2.5px #fff,0 0 0 5px ${color},0 4px 12px ${color}80;`
      : cascOrder === 0
        ? `box-shadow:0 0 0 2px #fff,0 0 0 4px ${color}CC;`
        : `box-shadow:0 1px 4px rgba(0,0,0,0.35);`
    return L.divIcon({
      className: "",
      iconSize:  [sz, sz],
      iconAnchor:[sz / 2, sz / 2],
      // Colored circle background with white plane silhouette on top.
      // Rotation is applied to the inner plane only so the circle stays round.
      html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;${ring}"><div style="transform:rotate(${r}deg);line-height:0;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${planeSz}" height="${planeSz}" style="display:block;"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="white" stroke="rgba(255,255,255,0.15)" stroke-width="0.4"/></svg></div></div>`,
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
    let fill = isHub ? "#EF6C4A" : "#374151"
    let ring = "", top = "", bot = ""
    if (faa?.type === "ground_stop") {
      fill = "#DC2626"
      ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #DC2626;opacity:0.55"></span>`
      top = apBadge("#DC2626", "GS")
    } else if (faa?.type === "ground_delay_program") {
      fill = "#EA580C"
      ring = `<span style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #EA580C;opacity:0.5"></span>`
      top = apBadge("#EA580C", faa.delay_minutes > 0 ? `+${faa.delay_minutes}m` : "GDP")
    } else if (faa?.type === "departure_delay") {
      fill = "#CA8A04"
      if (faa.delay_minutes > 0) top = apBadge("#CA8A04", `+${faa.delay_minutes}m`)
    } else if (isEvt) {
      fill = "#EF6C4A"
      ring = `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid #EF6C4A;opacity:0.6"></span>`
    }
    if (hasWx) bot = apBadge("#7C3AED", "⚡WX", true)
    const sel = isSel ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2.5px solid #EF6C4A"></span>` : ""
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
const EVENT_ICONS: Record<string, string> = {
  weather_closure: "🌩️", ground_stop: "🛑", airspace_closure: "🚫",
  security_event: "🛡️", mechanical_aog: "🔧", crew_sickout: "💊",
  runway_closure: "⚠️", atc_staffing: "📻", volcanic_ash: "🌋",
  cyber_incident: "💻",
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
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(12,8,6,0.88)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(239,108,74,0.50)",
          boxShadow: "0 6px 24px rgba(239,108,74,0.22)",
        }}
      >
        {/* Header strip */}
        <div
          className="px-3.5 py-2.5 flex items-center gap-2"
          style={{ background: "rgba(239,108,74,0.28)", borderBottom: "1px solid rgba(239,108,74,0.28)" }}
        >
          <span className="text-sm leading-none shrink-0">⚡</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-orange-200 flex-1">
            Disruption Active
          </span>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
            style={{ background: "rgba(239,108,74,0.50)", color: "#FCA5A5" }}
          >
            {events.length}
          </span>
        </div>

        {/* Events list */}
        <div className="px-3.5 py-2.5 space-y-2.5">
          {events.slice(0, 3).map((ev) => (
            <div key={ev.id} className="flex items-start gap-2.5">
              <span className="text-base shrink-0 mt-0.5 leading-none">{EVENT_ICONS[ev.kind] ?? "⚠️"}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-orange-100 leading-tight">
                  {EVENT_LABELS[ev.kind] ?? ev.kind.replace(/_/g, " ")}
                </div>
                {(ev.params?.airport || ev.params?.aircraft_tail || ev.params?.base || ev.params?.destination_airport) && (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-orange-300">
                      {ev.params.airport || ev.params.aircraft_tail || ev.params.base || ev.params.destination_airport}
                    </span>
                    {ev.params.severity && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(239,108,74,0.30)", color: "#FDBA74" }}>
                        {ev.params.severity}
                      </span>
                    )}
                    {ev.params.duration_hours && (
                      <span className="text-[9px] text-orange-400/70">{ev.params.duration_hours}h</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {events.length > 3 && (
            <div className="text-[10px] text-orange-400/60 pl-7">+{events.length - 3} more</div>
          )}
        </div>

        {/* Impact row */}
        {(summary || impactCount > 0) && (
          <div
            className="px-3.5 py-2 flex items-center gap-2 flex-wrap"
            style={{ background: "rgba(0,0,0,0.30)", borderTop: "1px solid rgba(239,108,74,0.18)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#EF6C4A" }} />
            {summary ? (
              <span className="text-[10px] font-semibold text-orange-300">
                <span className="font-black text-orange-100">{summary.total_affected}</span> affected ·{" "}
                <span className="text-orange-400/80">{summary.directly_affected} direct</span> ·{" "}
                <span className="text-orange-400/70">{(summary.cascade_1 || 0) + (summary.cascade_2 || 0)} cascade</span>
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-orange-300">{impactCount} routes impacted</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const PLAN_META_MAP = {
  A: { label: "Minimize Cost",    color: "#FFD23F", colorDim: "rgba(255,210,63,0.20)", border: "rgba(255,210,63,0.55)" },
  B: { label: "Min. Pax Impact",  color: "#2BA8A2", colorDim: "rgba(43,168,162,0.20)", border: "rgba(43,168,162,0.55)" },
  C: { label: "Protect Tomorrow", color: "#5DADE2", colorDim: "rgba(93,173,226,0.20)", border: "rgba(93,173,226,0.55)" },
}

function RecoveryBanner({ plan, onUnapply }: { plan: RecoveryPlan; onUnapply: () => void }) {
  const meta = PLAN_META_MAP[plan.plan_id as keyof typeof PLAN_META_MAP] ?? PLAN_META_MAP.A
  const cost = plan.cost_breakdown?.grand_total_usd
    ? `$${(plan.cost_breakdown.grand_total_usd / 1_000_000).toFixed(2)}M`
    : `$${(plan.total_cost_usd / 1000).toFixed(0)}K`

  return (
    <div className="absolute top-0 left-0 right-0 z-[450] px-3 pt-3">
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{
          background: "rgba(8,25,22,0.92)",
          backdropFilter: "blur(16px)",
          border: `1.5px solid ${meta.border}`,
          boxShadow: `0 6px 28px ${meta.colorDim}, 0 2px 8px rgba(0,0,0,0.30)`,
        }}
      >
        {/* Animated checkmark + plan badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-base font-black shrink-0"
            style={{ background: meta.colorDim, border: `1.5px solid ${meta.border}`, color: meta.color }}
          >
            ✓
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>
              Plan {plan.plan_id} Applied
            </div>
            <div className="text-xs font-bold text-white leading-tight">{meta.label}</div>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden sm:block w-px h-8 shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

        {/* Metrics row */}
        <div className="flex items-center gap-4 flex-wrap flex-1 min-w-0">
          <MetricChip icon="💵" label="Est. cost" value={cost} color="#FCD34D" />
          {(plan.cancelled_flights?.length ?? 0) > 0 && (
            <MetricChip icon="✕" label="Cancelled" value={String(plan.cancelled_flights.length)} color="#F87171" />
          )}
          {(plan.delayed_flights?.length ?? 0) > 0 && (
            <MetricChip icon="⏱" label="Delayed" value={String(plan.delayed_flights.length)} color="#FB923C" />
          )}
          {(plan.aircraft_swaps?.length ?? 0) > 0 && (
            <MetricChip icon="↕" label="Swapped" value={String(plan.aircraft_swaps.length)} color={meta.color} />
          )}
          <MetricChip
            icon={plan.crew_violations > 0 ? "⚠" : "✓"}
            label="FAR 117"
            value={plan.crew_violations > 0 ? `${plan.crew_violations} viol.` : "OK"}
            color={plan.crew_violations > 0 ? "#FB923C" : "#4ADE80"}
          />
        </div>

        {/* Unapply */}
        <button
          onClick={onUnapply}
          className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-75"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          × Unapply
        </button>
      </div>
    </div>
  )
}

function MetricChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color, fontSize: 12 }}>{icon}</span>
      <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span className="text-[11px] font-black" style={{ color }}>{value}</span>
    </div>
  )
}

function FlightDetailCard({
  flight, state, appliedPlan, applied, onClose,
}: {
  flight: ScheduledFlight
  state: FlightState | undefined
  appliedPlan: RecoveryPlan | null
  applied: { cancelled: Set<string>; swap: Set<string>; delayed: Map<string, number> }
  onClose: () => void
}) {
  const isCancelled = applied.cancelled.has(flight.id) || state?.status === "cancelled"
  const isSwapped   = applied.swap.has(flight.id)
  const planDelay   = applied.delayed.get(flight.id)
  const delayMin    = planDelay ?? state?.delay_minutes ?? 0
  const cascOrder   = state?.cascade_order ?? -1
  const pDelay      = state?.p_delayed ?? 0

  const oAp = NIMBUS_AIRPORTS[flight.origin]
  const dAp = NIMBUS_AIRPORTS[flight.destination]

  let actionLabel = "", actionColor = "#2BA8A2", actionIcon = ""
  if (isCancelled)         { actionLabel = "Cancelled by recovery plan"; actionColor = "#EF4444"; actionIcon = "✕" }
  else if (isSwapped)      { actionLabel = "Aircraft swapped by plan";   actionColor = "#2BA8A2"; actionIcon = "↕" }
  else if (planDelay)      { actionLabel = `Delayed +${planDelay} min by plan`; actionColor = "#F59E0B"; actionIcon = "⏱" }
  else if (cascOrder === 0){ actionLabel = "Direct impact — epicenter"; actionColor = "#EF6C4A"; actionIcon = "⚡" }
  else if (cascOrder > 0)  { actionLabel = `Cascade order ${cascOrder}`; actionColor = "#FBBF24"; actionIcon = "↗" }

  return (
    <div
      className="absolute z-[450] w-72"
      style={{ top: appliedPlan ? 88 : 12, right: 12 }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(16px)",
          border: "1.5px solid rgba(43,168,162,0.24)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(43,168,162,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #E8F6F5 0%, #FFFFFF 100%)", borderBottom: "1px solid rgba(43,168,162,0.14)" }}
        >
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: "rgba(239,108,74,0.12)", color: "#D45233" }}
              >SIM</span>
              <span className="font-mono font-black text-sm" style={{ color: "#1F2937" }}>{flight.id}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {flight.aircraft_id} · {flight.passengers ?? "—"} pax
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >×</button>
        </div>

        <div className="px-4 py-4">
          {/* Route arc display */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-center shrink-0">
              <div className="font-mono font-black text-2xl leading-none" style={{ color: "#1F2937" }}>
                {flight.origin.replace("K", "")}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{oAp?.city ?? ""}</div>
            </div>

            <div className="flex-1 flex items-center relative">
              <div
                className="flex-1 h-px"
                style={{
                  background: isCancelled
                    ? "repeating-linear-gradient(90deg,#EF4444 0,#EF4444 5px,transparent 5px,transparent 10px)"
                    : "rgba(43,168,162,0.30)",
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full text-sm"
                style={{
                  background: isCancelled ? "#EF4444" : isSwapped ? "#2BA8A2" : delayMin > 0 ? "#F59E0B" : "#2BA8A2",
                  boxShadow: `0 2px 10px ${isCancelled ? "rgba(239,68,68,0.40)" : "rgba(43,168,162,0.40)"}`,
                  color: "white",
                }}
              >
                {isCancelled ? "✕" : "✈"}
              </div>
              <div
                className="flex-1 h-px"
                style={{
                  background: isCancelled
                    ? "repeating-linear-gradient(90deg,#EF4444 0,#EF4444 5px,transparent 5px,transparent 10px)"
                    : "rgba(43,168,162,0.30)",
                }}
              />
            </div>

            <div className="text-center shrink-0">
              <div className="font-mono font-black text-2xl leading-none" style={{ color: "#1F2937" }}>
                {flight.destination.replace("K", "")}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{dAp?.city ?? ""}</div>
            </div>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            {[
              {
                label: "Status",
                value: isCancelled ? "Cancelled" : delayMin > 0 ? `+${delayMin}m delay` : state?.status ?? "On time",
                color: isCancelled ? "#EF4444" : delayMin > 0 ? "#F59E0B" : "#22C55E",
                bg: isCancelled ? "rgba(239,68,68,0.07)" : delayMin > 0 ? "rgba(245,158,11,0.07)" : "rgba(34,197,94,0.07)",
                border: isCancelled ? "rgba(239,68,68,0.20)" : delayMin > 0 ? "rgba(245,158,11,0.20)" : "rgba(34,197,94,0.20)",
              },
              {
                label: "Cascade",
                value: cascOrder < 0 ? "None" : cascOrder === 0 ? "Direct" : `Order ${cascOrder}`,
                color: cascOrder === 0 ? "#EF6C4A" : cascOrder > 0 ? "#FBBF24" : "#22C55E",
                bg: "rgba(43,168,162,0.05)",
                border: "rgba(43,168,162,0.14)",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-2.5"
                style={{ background: item.bg, border: `1px solid ${item.border}` }}
              >
                <div className="text-[10px] text-muted-foreground mb-0.5">{item.label}</div>
                <div className="text-[12px] font-black" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* P(delay) bar */}
          <div
            className="rounded-xl p-2.5 mb-2.5"
            style={{ background: "rgba(43,168,162,0.05)", border: "1px solid rgba(43,168,162,0.12)" }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] text-muted-foreground">Delay probability</div>
              <div className="text-[11px] font-black font-mono" style={{ color: pDelay > 0.6 ? "#EF6C4A" : "#2BA8A2" }}>
                {(pDelay * 100).toFixed(0)}%
              </div>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "rgba(43,168,162,0.15)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pDelay * 100}%`, background: pDelay > 0.6 ? "#EF6C4A" : "#2BA8A2" }}
              />
            </div>
          </div>

          {/* Recovery action tag */}
          {actionLabel && (
            <div
              className="rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] font-bold"
              style={{
                background: `${actionColor}12`,
                border: `1px solid ${actionColor}30`,
                color: actionColor,
              }}
            >
              <span className="text-sm shrink-0">{actionIcon}</span>
              {actionLabel}
            </div>
          )}

          {state?.reason && (
            <div className="mt-2 text-[10px] text-muted-foreground italic px-0.5 leading-relaxed">
              {state.reason}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LivePanel({ flight, onClose }: { flight: LiveFlight; onClose: () => void }) {
  const alt = flight.altitude_ft != null ? `${flight.altitude_ft.toLocaleString()} ft` : "—"
  const spd = flight.velocity_kt  != null ? `${flight.velocity_kt} kt` : "—"
  const vs  = flight.vertical_fpm != null
    ? `${flight.vertical_fpm > 100 ? "▲" : flight.vertical_fpm < -100 ? "▼" : "→"} ${Math.abs(flight.vertical_fpm).toLocaleString()} fpm`
    : "—"
  const hdg = flight.heading != null ? `${Math.round(flight.heading)}°` : "—"
  return (
    <div
      className="absolute top-12 right-3 left-3 sm:left-auto z-[450] w-72 rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(16px)",
        border: "1.5px solid rgba(93,173,226,0.30)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(93,173,226,0.14)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #EFF8FF 0%, #FFFFFF 100%)", borderBottom: "1px solid rgba(93,173,226,0.15)" }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
            <span className="font-mono font-black text-sm">{flight.flight_icao}</span>
            {flight.flight_iata && flight.flight_iata !== flight.flight_icao && (
              <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{flight.flight_iata}</span>
            )}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 border border-sky-200 text-sky-700 font-bold">LIVE</span>
          </div>
          <div className="text-[10px] text-muted-foreground">{flight.airline_name}</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">×</button>
      </div>
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([["Alt", alt], ["Speed", spd], ["V/S", vs], ["Hdg", hdg]] as [string, string][]).map(([label, val]) => (
            <div key={label} className="rounded-xl p-2.5" style={{ background: "rgba(93,173,226,0.06)", border: "1px solid rgba(93,173,226,0.14)" }}>
              <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
              <div className="font-mono font-bold text-xs">{val}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {flight.tracking.flightaware && (
            <a href={flight.tracking.flightaware} target="_blank" rel="noopener noreferrer"
              className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-semibold">FA ↗</a>
          )}
          <a href={flight.tracking.flightradar24} target="_blank" rel="noopener noreferrer"
            className="text-[10px] px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 font-semibold">FR24 ↗</a>
          <a href={flight.tracking.adsbexchange} target="_blank" rel="noopener noreferrer"
            className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-semibold">ADS-B ↗</a>
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
      className="absolute bottom-20 left-3 z-[450] w-64 rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(16px)",
        border: "1.5px solid rgba(43,168,162,0.22)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #E8F6F5 0%, #FFFFFF 100%)", borderBottom: "1px solid rgba(43,168,162,0.14)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-base">{ap.iata}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{icao}</span>
            {HUB_AIRPORTS.has(icao) && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black" style={{ background: "rgba(239,108,74,0.12)", color: "#D45233", border: "1px solid rgba(239,108,74,0.20)" }}>HUB</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{ap.name}, {ap.city}</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-lg text-muted-foreground hover:bg-secondary transition-all">×</button>
      </div>
      <div className="px-4 py-3 space-y-2">
        {!faa && !hasWx && !simAffected && (
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />Normal operations
          </div>
        )}
        {faa?.type === "ground_stop" && (
          <div className="rounded-xl p-2.5" style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.20)" }}>
            <div className="font-black text-red-700 text-xs">🛑 GROUND STOP</div>
            {faa.reason && <div className="text-red-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
          </div>
        )}
        {faa?.type === "ground_delay_program" && (
          <div className="rounded-xl p-2.5" style={{ background: "rgba(234,88,12,0.07)", border: "1px solid rgba(234,88,12,0.20)" }}>
            <div className="font-black text-orange-700 text-xs">🟠 GDP{faa.delay_minutes > 0 && ` avg +${faa.delay_minutes} min`}</div>
            {faa.reason && <div className="text-orange-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
          </div>
        )}
        {faa?.type === "departure_delay" && (
          <div className="rounded-xl p-2.5" style={{ background: "rgba(202,138,4,0.07)", border: "1px solid rgba(202,138,4,0.20)" }}>
            <div className="font-black text-amber-700 text-xs">⏱ Dep delay{faa.delay_minutes > 0 && ` +${faa.delay_minutes} min`}</div>
            {faa.reason && <div className="text-amber-600/80 text-[10px] mt-0.5">{faa.reason}</div>}
          </div>
        )}
        {hasWx && (
          <div className="rounded-xl p-2.5" style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.20)" }}>
            <div className="font-black text-purple-700 text-xs">⚡ NWS Weather Alert</div>
            {wxText && <div className="text-purple-600/80 text-[10px] mt-0.5 line-clamp-2">{wxText}</div>}
          </div>
        )}
        {simAffected && (
          <div className="rounded-xl p-2.5" style={{ background: "rgba(239,108,74,0.08)", border: "1px solid rgba(239,108,74,0.22)" }}>
            <div className="text-orange-700 text-[10px] font-bold">⚠ Simulation disruption active at this airport</div>
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

  const mapRef = useRef<L.Map | null>(null)
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null }, [])

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

  // Applied recovery plan sets
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

  // Color by cascade/plan state
  function cascColor(fid: string, state: any): string {
    if (applied.cancelled.has(fid) || state?.status === "cancelled") return "#EF4444"
    if (applied.swap.has(fid)) return "#2BA8A2"
    if (applied.delayed.has(fid)) return "#F59E0B"
    if (!state) return "#22C55E"
    if (state.cascade_order === 0) return "#F97316"
    if (state.cascade_order === 1) return "#FBBF24"
    if (state.cascade_order >= 2) return "#FDE68A"
    return "#22C55E"
  }

  // Impact routes
  const { impactRoutes, impactIds } = useMemo(() => {
    const routes: Array<{ id: string; from: [number, number]; to: [number, number]; color: string; weight: number; opacity: number; dashed: boolean }> = []
    const ids = new Set<string>()
    for (const f of schedule) {
      const state = flightStates[f.id]
      const isCancelled = applied.cancelled.has(f.id)
      const isAffected = state && (state.cascade_order >= 0 || state.status === "cancelled" || isCancelled || applied.delayed.has(f.id) || applied.swap.has(f.id))
      if (!isAffected) continue
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) continue
      const sel = selectedFlight === f.id
      const color = cascColor(f.id, state)
      routes.push({
        id: f.id,
        from: [o.lat, o.lon],
        to: [d.lat, d.lon],
        color,
        weight: sel ? 4 : state?.cascade_order === 0 ? 2.5 : 2,
        opacity: sel ? 1 : state?.cascade_order === 0 ? 0.85 : 0.60,
        dashed: isCancelled || state?.status === "cancelled",
      })
      ids.add(f.id)
    }
    return { impactRoutes: routes, impactIds: ids }
  }, [flightStates, schedule, selectedFlight, applied]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Simulated Nimbus aircraft
  // When events are active, ALL affected flights are pinned at their best position
  // so the user always sees every colored plane, not just the ones "airborne" in the time cycle.
  const simPlanes = useMemo(() => {
    if (!showSimulation) return []
    const cycle = 60 * 6, phase = ((nowMs / 1000) % cycle) / cycle, hr = 6 + phase * 18
    return schedule.flatMap((f) => {
      const o = NIMBUS_AIRPORTS[f.origin], d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) return []
      const state = flightStates[f.id]
      const isAffected = state && state.cascade_order >= 0
      const dep = isoToHour(f.scheduled_departure), arr = isoToHour(f.scheduled_arrival)
      const inWindow = arr > dep && hr >= dep && hr <= arr

      let t: number
      if (inWindow) {
        t = (hr - dep) / (arr - dep)
      } else if (isAffected && hasActiveEvents) {
        // Force affected flight to appear at midpoint so user can see it colored
        t = 0.5
      } else {
        return []
      }

      const [lat, lon] = interp(o.lat, o.lon, d.lat, d.lon, Math.max(0.02, Math.min(0.98, t)))
      return [{ id: f.id, f, lat, lon, brg: bearing(o.lat, o.lon, d.lat, d.lon) }]
    })
  }, [schedule, nowMs, showSimulation, flightStates, hasActiveEvents])

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
    ? applied.cancelled.has(selectedSched.id) || selState?.status === "cancelled" ? "#EF4444"
    : applied.swap.has(selectedSched.id) ? "#2BA8A2"
    : applied.delayed.has(selectedSched.id) ? "#F59E0B"
    : selState?.cascade_order === 0 ? "#F97316"
    : "#2BA8A2"
    : "#2BA8A2"

  const selTrail = useMemo(() => {
    const lf = selectedLiveFlight
    if (!lf || mapZoom < 6 || !lf.heading || (lf.velocity_kt ?? 0) < 80) return null
    const nowSec = nowMs / 1000
    const elapsed = nowSec - lf.last_contact
    const [cLat, cLon] = elapsed > 0 && elapsed < 300 ? deadReckon(lf.lat, lf.lon, lf.heading, lf.velocity_kt!, elapsed) : [lf.lat, lf.lon]
    const [tLat, tLon] = deadReckon(cLat, cLon, (lf.heading + 180) % 360, lf.velocity_kt!, 90)
    return { from: [tLat, tLon] as [number, number], to: [cLat, cLon] as [number, number] }
  }, [selectedLiveFlight, nowMs, mapZoom])

  const focusTarget: ScheduledFlight | LiveFlight | null = selectedSched || selectedLiveFlight
  const ageSec = lastFetch ? Math.round((nowMs - lastFetch) / 1000) : null

  return (
    <div className="simulator-map-shell w-full h-full min-h-0 relative overflow-hidden isolate">
      <MapContainer
        ref={mapRef}
        center={[39.5, -98.0]} zoom={4} minZoom={2} maxZoom={14}
        zoomControl={false} scrollWheelZoom worldCopyJump={false}
        preferCanvas
        className="w-full h-full z-0"
      >
        <MapResizeFix />
        <ZoomControl position="topright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
              pathOptions={{ color: "#EF6C4A", weight: 2.5, opacity: 0.70, fillColor: "#EF6C4A", fillOpacity: 0.10 }} />,
            <Circle key={`ep1-${icao}`} center={c} radius={160_000}
              pathOptions={{ color: "#EF6C4A", weight: 1.5, opacity: 0.40, fillColor: "#EF6C4A", fillOpacity: 0.05, dashArray: "6 5" }} />,
            <Circle key={`ep2-${icao}`} center={c} radius={300_000}
              pathOptions={{ color: "#EF6C4A", weight: 1, opacity: 0.18, fillColor: "#EF6C4A", fillOpacity: 0.02, dashArray: "3 9" }} />,
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
              pathOptions={{ color: "#94A3B8", weight: sel ? 2 : 1, opacity: sel ? 0.45 : 0.12, dashArray: sel ? undefined : "2 6" }}
              eventHandlers={{ click: () => onFlightSelect(sel ? null : f.id) }}
            />
          )
        })}

        {/* Impact routes */}
        {impactRoutes.map((r) => (
          <Polyline key={`imp-${r.id}`}
            positions={[r.from, r.to]}
            pathOptions={{ color: r.color, weight: r.weight, opacity: r.opacity, dashArray: r.dashed ? "10 6" : undefined }}
            eventHandlers={{ click: () => onFlightSelect(selectedFlight === r.id ? null : r.id) }}
          />
        ))}

        {/* Selected flight — bezier arc overlay */}
        {selectedArc && (
          <>
            {/* Glow underlayer */}
            <Polyline
              positions={selectedArc}
              pathOptions={{ color: selArcColor, weight: 10, opacity: 0.12 }}
            />
            {/* Main arc */}
            <Polyline
              positions={selectedArc}
              pathOptions={{
                color: selArcColor, weight: 3.5, opacity: 0.95,
                dashArray: applied.cancelled.has(selectedSched!.id) || selState?.status === "cancelled" ? "12 7" : undefined,
              }}
            />
          </>
        )}

        {/* Live trail for selected live flight */}
        {selTrail && (
          <Polyline positions={[selTrail.from, selTrail.to]}
            pathOptions={{ color: "#EF6C4A", weight: 2.5, opacity: 0.60 }} />
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
                  <div className="text-[10px] font-semibold mt-0.5" style={{ color: airportFAA[id].type === "ground_stop" ? "#DC2626" : "#EA580C" }}>
                    {airportFAA[id].type === "ground_stop" ? "🛑 Ground Stop"
                      : airportFAA[id].type === "ground_delay_program" ? `🟠 GDP +${airportFAA[id].delay_minutes}m`
                      : `⏱ +${airportFAA[id].delay_minutes}m dep delay`}
                  </div>
                )}
                {id in wxAirports && <div className="text-[10px] text-purple-600">⚡ WX Alert</div>}
                {simEvtAirports.has(id) && <div className="text-[10px] text-orange-600 font-semibold">⚠ Disruption epicenter</div>}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Simulated Nimbus aircraft */}
        {simPlanes.map(({ id, f, lat, lon, brg }) => {
          const state = flightStates[id]
          const sel = selectedFlight === id
          const cascOrder = applied.cancelled.has(id) || state?.status === "cancelled" ? 0
            : state?.cascade_order ?? -1
          return (
            <Marker key={`sim-${id}`} position={[lat, lon]}
              icon={simIcon(cascColor(id, state), brg, sel, cascOrder)}
              zIndexOffset={sel ? 2000 : cascOrder === 0 ? 800 : cascOrder >= 1 ? 500 : 200}
              eventHandlers={{ click: () => onFlightSelect(sel ? null : id) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div>
                  <div className="font-mono font-bold text-xs">{id} <span className="text-[9px] text-orange-500 font-bold">[SIM]</span></div>
                  <div className="text-[10px] text-muted-foreground">{f.aircraft_id} · {f.origin} → {f.destination}</div>
                  {state?.delay_minutes > 0 && <div className="text-[10px] text-orange-600 font-semibold">+{state.delay_minutes} min delay</div>}
                  {state?.cascade_order === 0 && <div className="text-[10px] text-red-600 font-semibold">⚡ Direct impact</div>}
                  {applied.cancelled.has(id) && <div className="text-[10px] text-red-600 font-black">✕ Cancelled by plan</div>}
                  {applied.swap.has(id) && <div className="text-[10px] font-bold" style={{ color: "#2BA8A2" }}>↕ Aircraft swapped</div>}
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

      {/* ── Overlay panels ── */}

      {/* Recovery plan banner — top of map when plan applied */}
      {activePlan && <RecoveryBanner plan={activePlan} onUnapply={() => applyPlan(null)} />}

      {/* Disruption banner — top-left */}
      {!activePlan && (
        <DisruptionBanner events={dedupEvents} impactCount={impactRoutes.length} summary={cascadeSummary} />
      )}

      {/* When plan is active, show compact event list at top-left */}
      {activePlan && hasActiveEvents && (
        <div className="absolute top-20 left-3 z-[450]" style={{ maxWidth: 240 }}>
          <div
            className="rounded-xl px-3 py-2"
            style={{
              background: "rgba(12,8,6,0.82)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(239,108,74,0.40)",
            }}
          >
            <div className="text-[9px] font-black uppercase tracking-widest text-orange-300 mb-1.5">
              ⚡ {dedupEvents.length} disruption{dedupEvents.length !== 1 ? "s" : ""} active
            </div>
            {dedupEvents.slice(0, 2).map((ev) => (
              <div key={ev.id} className="flex items-center gap-1.5 text-[10px] text-orange-200/80 mb-0.5">
                <span>{EVENT_ICONS[ev.kind] ?? "⚠️"}</span>
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
        />
      )}

      {/* Airport panel */}
      {selAirport && !selectedLiveFlight && !selectedSched && (
        <AirportPanel
          icao={selAirport} faa={airportFAA[selAirport]}
          hasWx={selAirport in wxAirports} wxText={wxAirports[selAirport] || ""}
          simAffected={simEvtAirports.has(selAirport)} onClose={() => setSelAirport(null)}
        />
      )}

      {/* Connection status — bottom-right above layer toggles */}
      <div className="absolute bottom-3 right-3 z-[400] flex flex-col gap-2 items-end">
        <div
          className="rounded-xl px-3 py-2 flex flex-col gap-1.5 text-[11px]"
          style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", border: "1px solid rgba(43,168,162,0.18)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <button
            onClick={() => setShowLiveFlights(!showLiveFlights)}
            className={`flex items-center gap-2 font-semibold transition-colors ${showLiveFlights ? "text-sky-600" : "text-muted-foreground"}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${showLiveFlights ? "bg-sky-400 animate-pulse" : "bg-muted-foreground/30"}`} />
            <span>Real flights (ADS-B)</span>
            {showLiveFlights && liveFlights.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(56,189,248,0.15)", color: "#0284C7" }}>
                {liveFlights.length.toLocaleString()}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className={`flex items-center gap-2 font-semibold transition-colors ${showSimulation ? "text-orange-500" : "text-muted-foreground"}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${showSimulation ? "bg-orange-400 animate-pulse" : "bg-muted-foreground/30"}`} />
            <span>Nimbus Air sim</span>
            {showSimulation && simPlanes.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.15)", color: "#EA580C" }}>
                {simPlanes.length}
              </span>
            )}
          </button>
        </div>

        {/* ADS-B age */}
        {ageSec != null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-semibold"
            style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(43,168,162,0.14)", color: ageSec > 30 ? "#EA580C" : "#6B7280" }}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${loading ? "bg-amber-400 animate-pulse" : liveFlights.length > 0 ? "bg-emerald-400" : "bg-red-400"}`} />
            {loading ? "Fetching…" : `ADS-B · ${ageSec}s ago`}
          </div>
        )}
      </div>

      {/* Legend — bottom-left */}
      <div className="absolute bottom-3 left-3 z-[400]">
        <div
          className="px-3 py-2 rounded-xl text-[10px]"
          style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", border: "1px solid rgba(43,168,162,0.16)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
        >
          {/* Always-visible: live layer */}
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-sky-400" />
              <span className="text-muted-foreground">Live ADS-B</span>
            </div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /><span className="text-muted-foreground">GS</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-muted-foreground">GDP</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-600" /><span className="text-muted-foreground">WX</span></div>
          </div>
          {/* Disruption/plan legend — shown when events active */}
          {(hasActiveEvents || appliedPlanId) && (
            <>
              <div className="border-t border-border/40 pt-1.5 mt-0.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Nimbus fleet status</div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: "#22C55E" }} />
                    <span className="text-muted-foreground">On-time</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full shrink-0 ring-2 ring-orange-400/50" style={{ background: "#F97316" }} />
                    <span className="font-semibold text-orange-600">Direct hit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: "#FBBF24" }} />
                    <span className="text-muted-foreground">Cascade</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: "#EF4444" }} />
                    <span className="text-muted-foreground">Cancelled</span>
                  </div>
                  {appliedPlanId && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: "#2BA8A2" }} />
                        <span className="text-muted-foreground">Swapped</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: "#F59E0B" }} />
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
