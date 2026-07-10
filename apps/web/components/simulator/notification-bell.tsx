"use client"
/**
 * NotificationBell — a live ops feed in the top bar.
 *
 * Opens a panel with two live sections:
 *   • Arriving soon — real ADS-B flights whose track points at a Nimbus
 *     airport, sorted by estimated time-to-arrival (derived from position,
 *     ground speed, and heading — no invented data).
 *   • Live disruptions — active simulator events (delays / weather / etc.).
 *
 * The bell badge counts imminent arrivals (ETA < 30 min) plus active
 * disruptions. When an inbound flight's ETA crosses zero while you're
 * watching, a toast pops ("SWA2409 arrived at DFW").
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Bell, PlaneLanding, TriangleAlert, X, Radio, BellRing, BellOff } from "lucide-react"
import { toast } from "sonner"
import { useSimulationStore, type LiveFlight } from "@/stores/simulation"
import { NIMBUS_AIRPORTS } from "./airports"
import { c, ff, r } from "@/lib/design-tokens"

const CARDINALS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  return (((Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * 180) / Math.PI) + 360) % 360
}

type Arrival = { key: string; flight: LiveFlight; icao: string; iata: string; city: string; etaMin: number; nm: number }

function computeArrivals(flights: LiveFlight[]): Arrival[] {
  const out: Arrival[] = []
  for (const f of flights) {
    if (f.on_ground || !f.heading || (f.velocity_kt ?? 0) < 100) continue
    let best: Arrival | null = null
    for (const icao in NIMBUS_AIRPORTS) {
      const ap = NIMBUS_AIRPORTS[icao]
      const nm = distanceNm(f.lat, f.lon, ap.lat, ap.lon)
      if (nm > 600) continue
      const brg = bearing(f.lat, f.lon, ap.lat, ap.lon)
      const diff = Math.abs(((brg - f.heading + 540) % 360) - 180)
      if (diff > 35) continue // must be tracking toward the field
      const etaMin = (nm / (f.velocity_kt ?? 1)) * 60
      if (!best || nm < best.nm) best = { key: f.icao24, flight: f, icao, iata: ap.iata, city: ap.city, etaMin, nm }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => a.etaMin - b.etaMin).slice(0, 12)
}

type LiveDisruption = { id: string; kind: string; label: string; detail: string; sev: "critical" | "high" | "moderate"; nimbus: boolean }

export function NotificationBell() {
  const { liveFlights, activeEvents, setSelectedLiveFlight } = useSimulationStore()
  const [open, setOpen] = useState(false)
  const [popups, setPopups] = useState(true) // arrival toasts on/off
  const [live, setLive] = useState<LiveDisruption[]>([]) // real FAA + NWS feed
  const prevEta = useRef<Map<string, number>>(new Map())

  // Poll the Vercel-native live status route (FAA delays + NWS weather) so the
  // operator can see real delays / weather here without the backend running.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch("/api/live-status")
        if (!res.ok) return
        const snap = await res.json()
        const out: LiveDisruption[] = []
        for (const p of snap?.faa?.programs ?? []) {
          out.push({
            id: `faa-${p.airport_iata}-${p.type}`,
            kind: p.type === "ground_stop" ? "Ground stop" : p.type === "ground_delay_program" ? "Ground delay program" : "Departure delay",
            label: `${p.airport_iata || p.airport_icao}`,
            detail: [p.reason, p.avg_delay_minutes ? `avg +${p.avg_delay_minutes}m` : ""].filter(Boolean).join(" · "),
            sev: p.type === "ground_stop" ? "critical" : p.type === "ground_delay_program" ? "high" : "moderate",
            nimbus: !!p.in_nimbus_network,
          })
        }
        for (const a of snap?.nws?.alerts ?? []) {
          if (a.severity !== "Severe" && a.severity !== "Extreme") continue
          out.push({
            id: `nws-${a.id}`,
            kind: a.event,
            label: a.affected_nimbus_airports?.[0] || a.area?.split(",")[0] || "US",
            detail: a.area || a.headline || "",
            sev: a.severity === "Extreme" ? "critical" : "high",
            nimbus: (a.affected_nimbus_airports?.length ?? 0) > 0,
          })
        }
        // Collapse exact duplicates (NWS often issues several overlapping
        // warnings for the same field), then Nimbus-affecting first by severity.
        const seen = new Set<string>()
        const deduped = out.filter((d) => {
          const k = `${d.kind}|${d.label}|${d.detail}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        deduped.sort((x, y) => (Number(y.nimbus) - Number(x.nimbus)) || ({ critical: 3, high: 2, moderate: 1 }[y.sev] - { critical: 3, high: 2, moderate: 1 }[x.sev]))
        if (alive) setLive(deduped.slice(0, 14))
      } catch {}
    }
    load()
    const t = setInterval(load, 180_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    try { if (localStorage.getItem("aeolus-arrival-popups") === "0") setPopups(false) } catch {}
  }, [])
  const togglePopups = () => setPopups((v) => {
    const next = !v
    try { localStorage.setItem("aeolus-arrival-popups", next ? "1" : "0") } catch {}
    return next
  })

  const arrivals = useMemo(() => computeArrivals(liveFlights), [liveFlights])
  const imminent = arrivals.filter((a) => a.etaMin < 30)
  const liveNimbus = live.filter((d) => d.nimbus).length
  const badge = imminent.length + activeEvents.length + liveNimbus

  // Arrival popup — when a tracked inbound crosses the touchdown threshold.
  useEffect(() => {
    const now = new Map<string, number>()
    for (const a of arrivals) now.set(a.key, a.etaMin)
    if (popups) {
      for (const [key, wasEta] of prevEta.current) {
        const nowEta = now.get(key)
        // was inbound & close, now gone from the list or ~landed
        if (wasEta > 1.5 && wasEta < 25 && (nowEta === undefined || nowEta <= 1.5)) {
          const a = arrivals.find((x) => x.key === key)
          const prev = liveFlights.find((f) => f.icao24 === key)
          const label = a?.iata ?? prev?.flight_iata ?? "a Nimbus airport"
          const fl = prev?.flight_iata || prev?.flight_icao || "Inbound flight"
          toast.success(`${fl} arrived`, { description: `Touched down at ${label}.`, icon: "🛬" })
        }
      }
    }
    prevEta.current = now
  }, [arrivals, liveFlights, popups])

  // close on outside click
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [open])

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Live ops feed"
        title="Live ops feed"
        style={{
          position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: 9, cursor: "pointer",
          border: `1px solid ${open ? "var(--ae-teal)" : c.borderStrong}`,
          background: open ? "var(--ae-teal-bg)" : "transparent",
          color: open ? "var(--ae-teal-ink)" : c.ink,
          transition: "background 150ms ease, border-color 150ms ease",
        }}
      >
        <Bell style={{ width: 16, height: 16 }} strokeWidth={1.9} />
        {badge > 0 && (
          <span
            style={{
              position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, padding: "0 4px",
              borderRadius: 99, background: imminent.length > 0 ? "var(--ae-teal)" : "var(--ae-amber)",
              color: imminent.length > 0 ? "#fff" : "#141019", fontSize: 9.5, fontWeight: 700, fontFamily: ff.mono,
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
              boxShadow: "0 0 0 2px var(--ae-bg)",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="ae-scroll-smooth"
          style={{
            position: "absolute", top: 42, right: 0, zIndex: 1000,
            width: 340, maxHeight: "min(70vh, 560px)", overflowY: "auto",
            background: "var(--ae-surface)", border: `1px solid ${c.hairline}`,
            borderRadius: 16, boxShadow: "var(--ae-shadow-overlay)", fontFamily: ff.body,
          }}
        >
          {/* header */}
          <div
            style={{
              position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", gap: 8,
              padding: "12px 14px", borderBottom: `1px solid ${c.hairline}`,
              background: "linear-gradient(180deg, var(--ae-teal-bg), var(--ae-surface) 90%)",
            }}
          >
            <Radio style={{ width: 15, height: 15, color: "var(--ae-teal-ink)" }} strokeWidth={2} />
            <span style={{ fontFamily: ff.display, fontWeight: 650, fontSize: 14, color: c.ink }}>Live ops feed</span>
            <span style={{ marginLeft: "auto", fontFamily: ff.mono, fontSize: 10, color: c.muted }}>
              {liveFlights.length.toLocaleString()} tracked
            </span>
            {/* popup mute toggle */}
            <button
              onClick={togglePopups}
              aria-label={popups ? "Mute arrival pop-ups" : "Enable arrival pop-ups"}
              title={popups ? "Arrival pop-ups on — click to mute" : "Arrival pop-ups muted — click to enable"}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26,
                borderRadius: 7, cursor: "pointer",
                border: `1px solid ${popups ? "var(--ae-teal)" : c.hairline}`,
                background: popups ? "var(--ae-teal-bg)" : "transparent",
                color: popups ? "var(--ae-teal-ink)" : c.muted,
              }}
            >
              {popups ? <BellRing style={{ width: 13, height: 13 }} strokeWidth={2} /> : <BellOff style={{ width: 13, height: 13 }} strokeWidth={2} />}
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ border: "none", background: "transparent", color: c.muted, cursor: "pointer", display: "inline-flex" }}>
              <X style={{ width: 15, height: 15 }} strokeWidth={2} />
            </button>
          </div>

          {/* arriving soon */}
          <div style={{ padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <PlaneLanding style={{ width: 13, height: 13, color: "var(--ae-teal-ink)" }} strokeWidth={2} />
              <span style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.ink }}>Arriving soon</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: c.muted }}>{arrivals.length}</span>
            </div>
            {arrivals.length === 0 ? (
              <div style={{ fontSize: 11.5, color: c.muted, padding: "8px 2px" }}>No inbound flights tracking toward the Nimbus network right now.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {arrivals.map((a) => {
                  const soon = a.etaMin < 15
                  return (
                    <button
                      key={a.key}
                      onClick={() => { setSelectedLiveFlight(a.flight); setOpen(false) }}
                      className="ae-event-tile"
                      style={{ ["--tile-accent" as string]: "#2C49E0", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", textAlign: "left" }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "var(--ae-teal-bg)", color: "var(--ae-teal-ink)", flexShrink: 0 }}>
                        <PlaneLanding style={{ width: 15, height: 15 }} strokeWidth={2} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontFamily: ff.mono, fontWeight: 700, fontSize: 12.5, color: c.ink }}>{a.flight.flight_iata || a.flight.flight_icao}</span>
                          <span style={{ fontSize: 10, color: c.muted }}>→ {a.iata}</span>
                        </span>
                        <span style={{ display: "block", fontSize: 10, color: c.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {a.flight.airline_name} · {a.city}
                        </span>
                      </span>
                      <span style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ display: "block", fontFamily: ff.mono, fontWeight: 700, fontSize: 12.5, color: soon ? "var(--ae-teal-ink)" : c.ink }}>
                          {a.etaMin < 60 ? `${Math.round(a.etaMin)}m` : `${(a.etaMin / 60).toFixed(1)}h`}
                        </span>
                        <span style={{ display: "block", fontFamily: ff.mono, fontSize: 9, color: c.muted }}>{Math.round(a.nm)} nm</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* live disruptions — real FAA delays + NWS weather + sim events */}
          <div style={{ padding: "4px 12px 14px", borderTop: `1px solid ${c.hairline}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "10px 0 8px" }}>
              <TriangleAlert style={{ width: 13, height: 13, color: "var(--ae-amber-ink)" }} strokeWidth={2} />
              <span style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.ink }}>Live disruptions</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: c.muted }}>{live.length + activeEvents.length}</span>
            </div>

            {/* simulated events (triggered in the app) */}
            {activeEvents.length > 0 && (
              <div style={{ display: "grid", gap: 6, marginBottom: live.length ? 10 : 0 }}>
                {activeEvents.map((ev) => (
                  <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: "var(--ae-rose-bg, var(--ae-amber-bg))", border: "1px solid var(--ae-amber)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--ae-amber)", flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 650, color: c.ink }}>{ev.kind.replace(/_/g, " ")} <span style={{ fontSize: 9, fontWeight: 600, color: "var(--ae-teal-ink)" }}>· SIM</span></span>
                      <span style={{ display: "block", fontSize: 10, color: c.muted }}>
                        {(ev.params?.airport || ev.params?.destination_airport || ev.params?.base || ev.params?.facility_id || "network") as string}
                        {ev.params?.severity ? ` · ${ev.params.severity}` : ""}
                        {ev.params?.duration_hours ? ` · ${ev.params.duration_hours}h` : ""}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* real national feed (FAA ground programs + NWS weather) */}
            {live.length > 0 ? (
              <div style={{ display: "grid", gap: 6 }}>
                {live.map((d) => {
                  const tone = d.sev === "critical" ? "var(--ae-rust-ink)" : d.sev === "high" ? "var(--ae-amber-ink)" : c.muted
                  const dot = d.sev === "critical" ? "var(--ae-rust)" : d.sev === "high" ? "var(--ae-amber)" : "var(--ae-line-strong)"
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 10px", borderRadius: 10, background: "var(--ae-surface)", border: `1px solid ${c.hairline}`, borderLeft: d.nimbus ? "2px solid var(--ae-teal)" : `1px solid ${c.hairline}` }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: dot, flexShrink: 0, marginTop: 3 }} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 650, color: c.ink }}>{d.kind}</span>
                          <span style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 600, color: tone }}>{d.label}</span>
                          {d.nimbus && <span style={{ fontSize: 9, fontWeight: 600, color: "var(--ae-teal-ink)" }}>Nimbus</span>}
                        </span>
                        {d.detail && <span style={{ display: "block", fontSize: 10, color: c.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.detail}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : activeEvents.length === 0 ? (
              <div style={{ fontSize: 11.5, color: c.muted, padding: "2px 2px 4px" }}>
                National airspace nominal — no FAA ground programs or severe weather right now. Full feed under Events → Live.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
