"use client"
/**
 * Playtest mode — free flight sandbox (Slice 7 / REVAMP_PLAN_v2.md Ask 3).
 *
 * Lets users build their own flight set (origin → destination, aircraft
 * type, departure) and inject disruption events to see the cascade — no
 * Nimbus Air schedule required. Stateless; nothing persists.
 *
 * Three zones:
 *   Left rail   — flight builder form + list of added flights
 *   Center      — Leaflet map preview of the user-built routes
 *   Right rail  — disruption injector + cascade results + cost ledger
 */
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Trash2, PlayCircle, Loader2, Plane,
  ArrowRight, AlertTriangle, RotateCcw,
} from "lucide-react"
import { NIMBUS_AIRPORTS } from "@/components/simulator/airports"
import { usePlaytestStore } from "@/stores/playtest"
import { apiClient } from "@/lib/api"
import { c, ff, r, sp } from "@/lib/design-tokens"
import {
  ButtonPrimary, ButtonSecondary, ContentCard, CreamCallout,
  Eyebrow, Type, StatusBadge, Stat, Hairline,
} from "@/components/ds/primitives"
import { SimulatorPageShell } from "@/components/simulator/page-shell"

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

// Map is dynamically imported so SSR doesn't try to evaluate Leaflet.
const PlaytestMap = dynamic(() => import("./playtest-map").then((m) => m.PlaytestMap), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: c.surfaceSoft,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
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
    flights, flightStates, cascadeSummary, cost, carbon, event,
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
  const [eventKind, setEventKind]   = useState<string>("weather_closure")
  const [eventAirport, setEventAirport] = useState<string>("KORD")
  const [eventSeverity, setEventSeverity] = useState<typeof SEVERITIES[number]>("severe")
  const [eventDuration, setEventDuration] = useState<number>(180)

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

  const handleAddFlight = () => {
    if (origin === destination) {
      setError("Origin and destination must differ.")
      return
    }
    setError(null)
    const dur = estimateBlockHours(origin, destination)
    // Compose ISO strings on today at the chosen departure HH:MM. The
    // predictor is timezone-agnostic; we use UTC for stability.
    const today = new Date()
    today.setUTCHours(parseInt(dep.split(":")[0], 10), parseInt(dep.split(":")[1], 10), 0, 0)
    const depISO = today.toISOString()
    const arr = new Date(today.getTime() + dur * 3600 * 1000)
    const arrISO = arr.toISOString()
    addFlight({
      id:                  nextFlightId,
      aircraft_id:         nextAircraftId,
      origin,
      destination,
      scheduled_departure: depISO,
      scheduled_arrival:   arrISO,
      passengers:          AIRCRAFT_TYPES.find((a) => a.id === acType)?.seats ?? 150,
    })
  }

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
            airport:        eventAirport,
            destination_airport: eventAirport,    // ground_stop variant
            severity:       eventSeverity,
            duration_hours: eventDuration / 60,
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
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Playtest sandbox" },
      ]}
      title="Playtest sandbox"
      subtitle="Build your own flight set, inject disruptions, watch the cascade. Stateless and self-contained — nothing here touches the Nimbus Air schedule."
      actions={
        flights.length > 0 ? (
          <ButtonSecondary
            size="sm"
            onClick={clearFlights}
            leadingIcon={<RotateCcw style={{ width: 13, height: 13 }} />}
          >
            Clear all
          </ButtonSecondary>
        ) : null
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 320px) minmax(0, 1fr) minmax(280px, 360px)",
          gap: sp.md,
          alignItems: "stretch",
          minHeight: 640,
        }}
      >
        {/* ── LEFT RAIL: flight builder ─────────────────────────────────── */}
        <ContentCard padding={0} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: sp.md, borderBottom: `1px solid ${c.hairline}` }}>
            <Eyebrow color={c.muted}>Step 1 · Build flights</Eyebrow>
            <Type as="h3" role="titleSm" color={c.ink} style={{ marginTop: 4 }}>
              Origin → destination
            </Type>
          </div>

          <div style={{ padding: sp.md, display: "flex", flexDirection: "column", gap: sp.sm }}>
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
              <input
                type="time"
                value={dep}
                onChange={(e) => setDep(e.target.value)}
                style={inputStyle}
              />
            </FieldRow>
            <ButtonPrimary
              size="sm"
              onClick={handleAddFlight}
              leadingIcon={<Plus style={{ width: 13, height: 13 }} />}
            >
              Add flight
            </ButtonPrimary>
            {lastError && (
              <span style={{ fontSize: 11, color: c.signatureCoral, fontFamily: ff.body }}>
                {lastError}
              </span>
            )}
          </div>

          <Hairline />

          {/* Flight list */}
          <div style={{ flex: 1, overflowY: "auto", padding: sp.sm, minHeight: 0 }}>
            {flights.length === 0 ? (
              <Type as="p" role="bodyMd" color={c.muted} style={{ textAlign: "center", padding: sp.md, fontSize: 12 }}>
                Add at least one flight to begin.
              </Type>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {flights.map((f) => (
                  <FlightChip
                    key={f.id}
                    flight={f}
                    state={flightStates[f.id]}
                    onRemove={() => removeFlight(f.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </ContentCard>

        {/* ── CENTER: map preview ──────────────────────────────────────── */}
        <ContentCard padding={0} style={{ overflow: "hidden", minHeight: 540 }}>
          <div style={{ height: "100%", minHeight: 540 }}>
            <PlaytestMap flights={flights} flightStates={flightStates} />
          </div>
        </ContentCard>

        {/* ── RIGHT RAIL: event injector + result ───────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: sp.md }}>
          <ContentCard padding={0}>
            <div style={{ padding: sp.md, borderBottom: `1px solid ${c.hairline}` }}>
              <Eyebrow color={c.muted}>Step 2 · Inject event</Eyebrow>
              <Type as="h3" role="titleSm" color={c.ink} style={{ marginTop: 4 }}>
                Disrupt the sandbox
              </Type>
            </div>
            <div style={{ padding: sp.md, display: "flex", flexDirection: "column", gap: sp.sm }}>
              <FieldRow label="Event kind">
                <Select
                  value={eventKind}
                  onChange={setEventKind}
                  options={EVENT_KINDS.map((e) => ({ icao: e.id, label: e.label }))}
                />
              </FieldRow>
              <FieldRow label="Airport">
                <Select value={eventAirport} onChange={setEventAirport} options={AIRPORTS} />
              </FieldRow>
              <FieldRow label="Severity">
                <Select
                  value={eventSeverity}
                  onChange={(v) => setEventSeverity(v as typeof SEVERITIES[number])}
                  options={SEVERITIES.map((s) => ({ icao: s, label: s }))}
                />
              </FieldRow>
              <FieldRow label="Duration (min)">
                <input
                  type="number"
                  min={15}
                  max={720}
                  step={15}
                  value={eventDuration}
                  onChange={(e) => setEventDuration(parseInt(e.target.value, 10) || 60)}
                  style={inputStyle}
                />
              </FieldRow>
              <ButtonPrimary
                size="sm"
                onClick={handleRun}
                disabled={flights.length === 0 || isSolving}
                leadingIcon={
                  isSolving
                    ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                    : <PlayCircle style={{ width: 13, height: 13 }} />
                }
              >
                {isSolving ? "Solving…" : "Run cascade"}
              </ButtonPrimary>
            </div>
          </ContentCard>

          {/* Result panel */}
          <AnimatePresence mode="wait">
            {hasResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <ContentCard padding={sp.md}>
                  <Eyebrow color={c.signatureCoral}>Cascade impact</Eyebrow>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: sp.md, marginTop: sp.sm }}>
                    <Stat label="Direct hits"  value={cascadeSummary!.directly_affected} />
                    <Stat label="Order 1+2"    value={cascadeSummary!.cascade_1 + cascadeSummary!.cascade_2} />
                    <Stat label="Total"        value={cascadeSummary!.total_affected} />
                    <Stat
                      label="Total delay"
                      value={`${cascadeSummary!.total_delay_minutes}m`}
                      hint={`${(cascadeSummary!.total_delay_minutes / 60).toFixed(1)} hours`}
                    />
                  </div>
                  {cost && (
                    <>
                      <Hairline style={{ marginTop: sp.md, marginBottom: sp.sm }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontFamily: ff.body, fontSize: 12, color: c.muted }}>Est. impact</span>
                        <span style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 18, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
                          ${(cost.grand_total_usd / 1000).toFixed(1)}K
                        </span>
                      </div>
                      {carbon && carbon.total_co2_tonnes !== 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                          <span style={{ fontFamily: ff.body, fontSize: 11, color: c.muted }}>Net CO₂</span>
                          <span style={{ fontFamily: ff.mono, fontWeight: 500, fontSize: 12, color: c.signatureForest, fontVariantNumeric: "tabular-nums" }}>
                            {carbon.total_co2_tonnes > 0 ? "+" : ""}{carbon.total_co2_tonnes.toFixed(2)} t
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </ContentCard>
              </motion.div>
            ) : (
              <CreamCallout>
                <Eyebrow color={c.signatureForest}>Sandbox idle</Eyebrow>
                <Type as="p" role="bodyMd" color={c.body} style={{ marginTop: 6, fontSize: 13 }}>
                  Add flights on the left, configure an event above, then run
                  the cascade. The same physics module that powers the canonical
                  simulator scores your synthetic schedule.
                </Type>
              </CreamCallout>
            )}
          </AnimatePresence>
        </div>
      </div>
    </SimulatorPageShell>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: ff.body, fontSize: 11, fontWeight: 500, color: c.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>
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
  padding: "8px 10px",
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
    state?.status === "cancelled" ? c.signatureCoral :
    state?.cascade_order === 0     ? c.signatureCoral :
    state?.cascade_order === 1     ? c.signatureMustard :
    state?.cascade_order === 2     ? c.signatureYellow :
    state?.delay_minutes && state.delay_minutes > 0 ? c.signaturePeach :
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
          {state?.delay_minutes && state.delay_minutes > 0 && (
            <>
              <span>·</span>
              <span style={{ color: c.signatureCoral, fontWeight: 500 }}>+{state.delay_minutes}m</span>
            </>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove flight"
        style={{
          padding: 4,
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
  // Haversine distance in nautical miles.
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
