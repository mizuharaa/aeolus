"use client"
/**
 * Playtest — mission-control sandbox, rebuilt map-first.
 *
 * The map IS the page: full viewport, edge to edge. Everything else floats
 * over it in the same HUD language as the main dashboard:
 *
 *   top-left      — mission chip (mode, flight count, clear/reset)
 *   top-center    — build hint (click-to-build state)
 *   left panel    — FLEET: route builder + rotation list (collapses to tab)
 *   right panel   — DISRUPTION: event injector + run (collapses to tab)
 *   bottom-center — IMPACT HUD: cascade KPIs stagger in after a run
 *
 * Click two airports to draw a route; inject an event; read the damage.
 * Stateless — nothing touches the Nimbus Air schedule.
 */
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Trash2, PlayCircle, Loader2, Plane,
  ArrowRight, RotateCcw, Zap, Route as RouteIcon,
} from "lucide-react"
import { NIMBUS_AIRPORTS } from "@/components/simulator/airports"
import { usePlaytestStore } from "@/stores/playtest"
import { apiClient } from "@/lib/api"
import { c, ff, r } from "@/lib/design-tokens"
import { FloatingPanel } from "@/components/simulator/workspace-chrome"

const AIRCRAFT_TYPES = [
  { id: "B737", label: "Boeing 737-800", seats: 162, min_turn: 45 },
  { id: "A320", label: "Airbus A320",    seats: 150, min_turn: 45 },
  { id: "E175", label: "Embraer E175",   seats:  76, min_turn: 25 },
  { id: "B757", label: "Boeing 757-200", seats: 200, min_turn: 60 },
]

const EVENT_KINDS = [
  { id: "weather_closure", label: "Weather closure" },
  { id: "ground_stop",     label: "Ground stop" },
  { id: "mechanical_aog",  label: "Mechanical AOG" },
  { id: "crew_sickout",    label: "Crew sickout" },
  { id: "atc_staffing",    label: "ATC staffing shortage" },
  { id: "runway_closure",  label: "Runway closure" },
]

const SEVERITIES = ["mild", "moderate", "severe", "extreme"] as const

const FLEET_ACCENT = "#5B3FA8"   // plum — building
const EVENT_ACCENT = "#C13A6B"   // rose — disruption
const EASE = [0.22, 0.9, 0.28, 1] as const

// Map is dynamically imported so SSR doesn't try to evaluate Leaflet.
const PlaytestMap = dynamic(() => import("./playtest-map").then((m) => m.PlaytestMap), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", background: c.surfaceSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 style={{ width: 18, height: 18, color: c.muted }} className="animate-spin" />
    </div>
  ),
})

const AIRPORTS = Object.entries(NIMBUS_AIRPORTS).map(([icao, info]) => ({
  icao,
  label: `${info.iata} — ${info.city}`,
}))

export default function PlaytestPage() {
  const {
    flights, flightStates, cascadeSummary, cost, carbon,
    isSolving, lastError,
    addFlight, removeFlight, clearFlights,
    applyResult, setEvent, setSolving, setError,
  } = usePlaytestStore()

  // ── Flight builder form state ──────────────────────────────────────────
  const [origin, setOrigin]           = useState<string>("KORD")
  const [destination, setDestination] = useState<string>("KATL")
  const [acType, setAcType]           = useState<string>("B737")
  const [dep, setDep]                 = useState<string>("08:00")

  // ── Event builder state ────────────────────────────────────────────────
  const [eventKind, setEventKind]         = useState<string>("weather_closure")
  const [eventAirport, setEventAirport]   = useState<string>("KORD")
  const [eventSeverity, setEventSeverity] = useState<typeof SEVERITIES[number]>("severe")
  const [eventDuration, setEventDuration] = useState<number>(180)

  // ── HUD panel state ────────────────────────────────────────────────────
  const [fleetOpen, setFleetOpen] = useState(true)
  const [eventOpen, setEventOpen] = useState(false)

  const nextFlightId = useMemo(() => {
    const max = flights.reduce((m, f) => {
      const n = parseInt(f.id.replace(/[^0-9]/g, ""), 10)
      return Number.isFinite(n) && n > m ? n : m
    }, 1000)
    return `PT${max + 1}`
  }, [flights])

  const nextAircraftId = useMemo(() => {
    // Reuse a tail if there's a free one (so multiple legs share a rotation),
    // otherwise mint a new one. This is what makes the cascade actually
    // CASCADE — without rotation reuse, every flight is independent.
    const used = new Set(flights.map((f) => f.aircraft_id))
    for (let i = 1; i <= 99; i++) {
      const candidate = `T${String(i).padStart(2, "0")}`
      if (!used.has(candidate)) return candidate
    }
    return `T${flights.length + 1}`
  }, [flights])

  const addFlightFromTo = (o: string, d: string) => {
    if (o === d) {
      setError("Origin and destination must differ.")
      return
    }
    setError(null)
    const dur = estimateBlockHours(o, d)
    const today = new Date()
    today.setUTCHours(parseInt(dep.split(":")[0], 10), parseInt(dep.split(":")[1], 10), 0, 0)
    const depISO = today.toISOString()
    const arr = new Date(today.getTime() + dur * 3600 * 1000)
    addFlight({
      id:                  nextFlightId,
      aircraft_id:         nextAircraftId,
      origin:              o,
      destination:         d,
      scheduled_departure: depISO,
      scheduled_arrival:   arr.toISOString(),
      passengers:          AIRCRAFT_TYPES.find((a) => a.id === acType)?.seats ?? 150,
    })
    // Auto-advance the departure slot so consecutive adds chain into a
    // plausible rotation instead of stacking at the same minute.
    const next = new Date(today.getTime() + 45 * 60 * 1000)
    setDep(`${String(next.getUTCHours()).padStart(2, "0")}:${String(next.getUTCMinutes()).padStart(2, "0")}`)
  }

  // ── Click-to-build: click one airport to arm the origin, click a second
  //    to draw the flight. Esc (or re-clicking the armed airport) cancels. ──
  const [armedOrigin, setArmedOrigin] = useState<string | null>(null)
  const handleAirportPick = (icao: string) => {
    if (!armedOrigin) { setArmedOrigin(icao); setError(null); return }
    if (armedOrigin === icao) { setArmedOrigin(null); return }
    addFlightFromTo(armedOrigin, icao)
    setArmedOrigin(null)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setArmedOrigin(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // First flight drawn → surface the disruption panel (the next step).
  useEffect(() => {
    if (flights.length === 1) setEventOpen(true)
  }, [flights.length])

  const handleRun = async () => {
    if (flights.length === 0) return
    setSolving(true)
    try {
      const payload = {
        flights,
        aircraft: aircraftRosterFor(flights),
        event: {
          kind:   eventKind,
          params: {
            airport:             eventAirport,
            destination_airport: eventAirport, // ground_stop variant
            severity:            eventSeverity,
            duration_hours:      eventDuration / 60,
          },
        },
      }
      const res = await apiClient.post<{
        flight_states:   any
        cascade_summary: any
        cost:            any
        carbon:          any
        event:           any
      }>("/playtest/cascade", payload)
      applyResult(res.data)
      setEvent(payload.event)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cascade run failed.")
    }
  }

  const hasResult = !!cascadeSummary && Object.keys(flightStates).length > 0

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden", background: c.surfaceSoft }}>

      {/* ── THE MAP — full bleed, nothing docks against it ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <PlaytestMap
          flights={flights}
          flightStates={flightStates}
          onAirportPick={handleAirportPick}
          armedOrigin={armedOrigin}
        />
      </div>

      {/* ── Mission chip — top-left ── */}
      <div
        style={{
          position: "absolute", top: 14, left: 14, zIndex: 620,
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 14px", borderRadius: 12,
          background: "rgba(255,254,249,0.94)", backdropFilter: "blur(10px)",
          border: `1px solid ${c.hairline}`, boxShadow: "var(--ae-shadow-card-elev)",
          fontFamily: ff.body,
        }}
      >
        <span style={{ fontFamily: ff.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ae-teal-ink)" }}>
          Playtest
        </span>
        <span style={{ width: 1, height: 14, background: c.hairline }} />
        <span style={{ fontSize: 12, color: c.body, fontVariantNumeric: "tabular-nums" }}>
          <strong style={{ fontFamily: ff.mono, color: c.ink }}>{flights.length}</strong> flight{flights.length !== 1 ? "s" : ""}
        </span>
        {flights.length > 0 && (
          <button
            type="button"
            onClick={() => { clearFlights(); setArmedOrigin(null) }}
            title="Clear all flights"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              border: "none", background: "transparent", cursor: "pointer",
              fontFamily: ff.body, fontSize: 11.5, fontWeight: 600, color: c.muted, padding: "2px 4px",
            }}
          >
            <RotateCcw style={{ width: 12, height: 12 }} strokeWidth={2} />
            Reset
          </button>
        )}
      </div>

      {/* ── Build hint — top-center, reads the click-to-build state ── */}
      <div
        style={{
          position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
          zIndex: 610, padding: "7px 14px", borderRadius: 999,
          background: armedOrigin ? "var(--ae-amber-bg)" : "rgba(255,254,249,0.92)",
          border: `1px solid ${armedOrigin ? "var(--ae-amber)" : c.hairline}`,
          backdropFilter: "blur(8px)",
          fontFamily: ff.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
          color: armedOrigin ? "var(--ae-amber-ink)" : c.muted,
          whiteSpace: "nowrap", pointerEvents: "none",
          transition: "background 200ms ease, border-color 200ms ease",
        }}
      >
        {armedOrigin
          ? `${NIMBUS_AIRPORTS[armedOrigin]?.iata ?? armedOrigin} armed — click a destination · Esc cancels`
          : "Click two airports to draw a route"}
      </div>

      {/* ── FLEET — left HUD panel ── */}
      <FloatingPanel
        side="left" open={fleetOpen} accent={FLEET_ACCENT} width={330}
        title="Fleet"
        icon={<RouteIcon style={{ width: 15, height: 15 }} strokeWidth={2} />}
        onOpen={() => setFleetOpen(true)} onClose={() => setFleetOpen(false)}
        badge={flights.length || undefined}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: ff.body }}>
          <PanelHead
            icon={<RouteIcon style={{ width: 14, height: 14 }} strokeWidth={2} />}
            title="Fleet builder"
            sub="Draw on the map, or set it precisely"
          />

          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, borderBottom: `1px solid ${c.hairline}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FieldRow label="Origin">
                <Select value={origin} onChange={setOrigin} options={AIRPORTS} />
              </FieldRow>
              <FieldRow label="Destination">
                <Select value={destination} onChange={setDestination} options={AIRPORTS} />
              </FieldRow>
              <FieldRow label="Aircraft">
                <Select
                  value={acType}
                  onChange={setAcType}
                  options={AIRCRAFT_TYPES.map((a) => ({ icao: a.id, label: a.label }))}
                />
              </FieldRow>
              <FieldRow label="Departure (UTC)">
                <input type="time" value={dep} onChange={(e) => setDep(e.target.value)} style={inputStyle} />
              </FieldRow>
            </div>
            <button type="button" onClick={() => addFlightFromTo(origin, destination)} className="pt-btn pt-btn--plum">
              <Plus style={{ width: 14, height: 14 }} strokeWidth={2.25} />
              Add flight
            </button>
            {lastError && (
              <span role="alert" style={{ fontSize: 11.5, color: "var(--ae-rose-ink)" }}>{lastError}</span>
            )}
          </div>

          {/* rotation list */}
          <div className="ae-scroll-smooth" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10 }}>
            {flights.length === 0 ? (
              <p style={{ margin: 0, padding: 16, textAlign: "center", fontSize: 12.5, lineHeight: 1.6, color: c.muted }}>
                No flights yet. Click two airports on the map — the first arms
                the origin, the second draws the leg.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <AnimatePresence initial={false}>
                  {flights.map((f) => (
                    <motion.div
                      key={f.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2, ease: EASE }}
                    >
                      <FlightChip flight={f} state={flightStates[f.id]} onRemove={() => removeFlight(f.id)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </FloatingPanel>

      {/* ── DISRUPTION — right HUD panel ── */}
      <FloatingPanel
        side="right" open={eventOpen} accent={EVENT_ACCENT} width={340}
        title="Disrupt"
        icon={<Zap style={{ width: 15, height: 15 }} strokeWidth={2} />}
        onOpen={() => setEventOpen(true)} onClose={() => setEventOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: ff.body }}>
          <PanelHead
            icon={<Zap style={{ width: 14, height: 14 }} strokeWidth={2} />}
            title="Disruption injector"
            sub="Break your network, watch it cascade"
          />

          <div className="ae-scroll-smooth" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="Event">
              <Select
                value={eventKind}
                onChange={setEventKind}
                options={EVENT_KINDS.map((e) => ({ icao: e.id, label: e.label }))}
              />
            </FieldRow>
            <FieldRow label="Airport">
              <Select value={eventAirport} onChange={setEventAirport} options={AIRPORTS} />
            </FieldRow>

            {/* severity — four chips, not a dropdown */}
            <FieldRow label="Severity">
              <div role="radiogroup" aria-label="Severity" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                {SEVERITIES.map((s) => {
                  const active = eventSeverity === s
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setEventSeverity(s)}
                      style={{
                        padding: "9px 2px",
                        borderRadius: 8,
                        border: `1.5px solid ${active ? EVENT_ACCENT : c.hairline}`,
                        background: active ? "var(--ae-rose-bg)" : "transparent",
                        color: active ? "var(--ae-rose-ink)" : c.body,
                        fontFamily: ff.mono, fontSize: 10, fontWeight: 650,
                        letterSpacing: "0.04em", textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "border-color 150ms ease, background 150ms ease, color 150ms ease",
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </FieldRow>

            {/* duration — slider with a live mono readout */}
            <FieldRow label={`Duration — ${eventDuration >= 60 ? `${(eventDuration / 60).toFixed(eventDuration % 60 ? 1 : 0)}h` : `${eventDuration}m`}`}>
              <input
                type="range"
                min={15} max={720} step={15}
                value={eventDuration}
                onChange={(e) => setEventDuration(parseInt(e.target.value, 10) || 60)}
                aria-label="Event duration in minutes"
                style={{ width: "100%", accentColor: EVENT_ACCENT, cursor: "pointer" }}
              />
            </FieldRow>

            <button
              type="button"
              onClick={handleRun}
              disabled={flights.length === 0 || isSolving}
              className="pt-btn pt-btn--rose"
            >
              {isSolving
                ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                : <PlayCircle style={{ width: 14, height: 14 }} strokeWidth={2.25} />}
              {isSolving ? "Running cascade…" : "Run cascade"}
            </button>
            {flights.length === 0 && (
              <span style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.5 }}>
                Draw at least one flight first — the cascade needs a network to break.
              </span>
            )}
          </div>
        </div>
      </FloatingPanel>

      {/* ── IMPACT HUD — bottom-center, stagger-reveals after a run ── */}
      <AnimatePresence>
        {hasResult && (
          <motion.div
            key="impact"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: EASE }}
            style={{
              position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 630, display: "flex", gap: 8, padding: 10,
              borderRadius: 16,
              background: "rgba(255,254,249,0.95)", backdropFilter: "blur(12px)",
              border: `1px solid ${c.hairline}`, boxShadow: "var(--ae-shadow-overlay)",
              maxWidth: "calc(100vw - 160px)", overflowX: "auto",
            }}
          >
            <HudStat label="Direct hits" value={String(cascadeSummary!.directly_affected)} tone="var(--ae-rose-ink)" delay={0} />
            <HudStat label="Knock-ons" value={String(cascadeSummary!.cascade_1 + cascadeSummary!.cascade_2)} tone="var(--ae-amber-ink)" delay={0.06} />
            <HudStat label="Affected" value={String(cascadeSummary!.total_affected)} tone={c.ink} delay={0.12} />
            <HudStat
              label="System delay"
              value={cascadeSummary!.total_delay_minutes >= 60
                ? `${(cascadeSummary!.total_delay_minutes / 60).toFixed(1)}h`
                : `${cascadeSummary!.total_delay_minutes}m`}
              tone="var(--ae-amber-ink)" delay={0.18}
            />
            {cost && (
              <HudStat label="Est. impact" value={`$${(cost.grand_total_usd / 1000).toFixed(1)}k`} tone={c.ink} delay={0.24} />
            )}
            {carbon && carbon.total_co2_tonnes !== 0 && (
              <HudStat
                label="Net CO₂"
                value={`${carbon.total_co2_tonnes > 0 ? "+" : ""}${carbon.total_co2_tonnes.toFixed(1)}t`}
                tone="var(--ae-teal-ink)" delay={0.3}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .pt-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 42px;
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          font-family: var(--ae-font-body);
          font-size: 13.5px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: filter 150ms ease, transform 120ms ease;
        }
        .pt-btn:hover:not(:disabled) { filter: brightness(1.12); }
        .pt-btn:active:not(:disabled) { transform: scale(0.985); }
        .pt-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .pt-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ae-focus); }
        .pt-btn--plum { background: ${FLEET_ACCENT}; }
        .pt-btn--rose { background: ${EVENT_ACCENT}; }
      `}</style>
    </div>
  )
}

// ─── HUD pieces ───────────────────────────────────────────────────────────────

function PanelHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 44px 13px 16px", borderBottom: `1px solid ${c.hairline}`, flexShrink: 0 }}>
      <span style={{ display: "inline-flex", color: c.ink }}>{icon}</span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 650, color: c.ink, lineHeight: 1.15 }}>{title}</span>
        <span style={{ fontSize: 11, color: c.muted }}>{sub}</span>
      </span>
    </div>
  )
}

function HudStat({ label, value, tone, delay }: { label: string; value: string; tone: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, delay, ease: EASE }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        padding: "8px 16px", borderRadius: 10, background: "var(--ae-neutral-bg)",
        minWidth: 86, flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: ff.mono, fontSize: 18, fontWeight: 700, color: tone, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      <span style={{ fontFamily: ff.mono, fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: c.muted, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </motion.div>
  )
}

// ─── Form pieces ──────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontFamily: ff.mono, fontSize: 9.5, fontWeight: 600, color: c.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({
  value, onChange, options,
}: {
  value:    string
  onChange: (v: string) => void
  options:  { icao: string; label: string }[]
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((o) => (
        <option key={o.icao} value={o.icao}>{o.label}</option>
      ))}
    </select>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: ff.body,
  fontSize: 13,
  fontWeight: 400,
  padding: "9px 10px",
  minHeight: 40,
  borderRadius: r.sm,
  border: `1px solid ${c.hairline}`,
  background: c.canvas,
  color: c.ink,
  outline: "none",
  width: "100%",
}

function FlightChip({
  flight, state, onRemove,
}: {
  flight: ReturnType<typeof usePlaytestStore.getState>["flights"][number]
  state?: ReturnType<typeof usePlaytestStore.getState>["flightStates"][string]
  onRemove: () => void
}) {
  const o = NIMBUS_AIRPORTS[flight.origin]
  const d = NIMBUS_AIRPORTS[flight.destination]
  const accent =
    state?.status === "cancelled" ? "var(--ae-rose)" :
    state?.cascade_order === 0     ? "var(--ae-rose)" :
    state?.cascade_order === 1     ? "var(--ae-amber)" :
    state?.cascade_order === 2     ? "var(--ae-amber-soft)" :
    state?.delay_minutes && state.delay_minutes > 0 ? "var(--ae-amber-soft2)" :
    c.hairline
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        background: c.canvas,
        border: `1px solid ${c.hairline}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: r.sm,
      }}
    >
      <Plane style={{ width: 12, height: 12, color: c.muted, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: ff.mono, fontSize: 11, color: c.ink }}>
          <span style={{ fontWeight: 500 }}>{flight.id}</span>
          <span style={{ color: c.muted }}>·</span>
          <span>{o?.iata || flight.origin}</span>
          <ArrowRight style={{ width: 10, height: 10, color: c.muted }} />
          <span>{d?.iata || flight.destination}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: ff.body, fontSize: 10, color: c.muted, marginTop: 2 }}>
          <span>{flight.aircraft_id}</span>
          <span>·</span>
          <span>{flight.scheduled_departure.slice(11, 16)}</span>
          {state?.delay_minutes && state.delay_minutes > 0 ? (
            <>
              <span>·</span>
              <span style={{ color: "var(--ae-rose-ink)", fontWeight: 500 }}>+{state.delay_minutes}m</span>
            </>
          ) : null}
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove flight ${flight.id}`}
        style={{
          padding: 6,
          borderRadius: r.sm,
          border: "none",
          background: "transparent",
          color: c.muted,
          cursor: "pointer",
        }}
      >
        <Trash2 style={{ width: 12, height: 12 }} />
      </button>
    </div>
  )
}

/**
 * Rough block-hour estimate for ICAO pair. Uses straight-line distance ÷
 * 460 kt cruise + 0.5h taxi/climb/descent buffer. Good enough for the
 * sandbox; the cascade predictor doesn't need exact arrival times to do
 * its rotation walk.
 */
function estimateBlockHours(origin: string, destination: string): number {
  const o = NIMBUS_AIRPORTS[origin]
  const d = NIMBUS_AIRPORTS[destination]
  if (!o || !d) return 2.0
  const R = 3440
  const toRad = (x: number) => (x * Math.PI) / 180
  const dlat = toRad(d.lat - o.lat)
  const dlon = toRad(d.lon - o.lon)
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toRad(o.lat)) * Math.cos(toRad(d.lat)) * Math.sin(dlon / 2) ** 2
  const nm = 2 * R * Math.asin(Math.sqrt(a))
  return Math.max(0.75, nm / 460 + 0.5)
}

function aircraftRosterFor(flights: ReturnType<typeof usePlaytestStore.getState>["flights"]) {
  const seen: Record<string, { id: string; type: string; seats: number; base_airport_id: string; min_turn_minutes: number }> = {}
  for (const f of flights) {
    if (seen[f.aircraft_id]) continue
    seen[f.aircraft_id] = {
      id:               f.aircraft_id,
      type:             "B737-800",
      seats:            f.passengers || 162,
      base_airport_id:  f.origin,
      min_turn_minutes: 45,
    }
  }
  return Object.values(seen)
}
