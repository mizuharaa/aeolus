"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users2, Clock, Hotel, RefreshCw, ArrowRightLeft,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Plane, Car, ShieldCheck, ShieldAlert, Star,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { c, ff, r, sp, type } from "@/lib/design-tokens"
import { ButtonSecondary, CreamCallout, Eyebrow, Type } from "@/components/ds/primitives"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfidenceInterval { low_min: number; high_min: number }
interface Compensation {
  is_airline_fault: boolean
  event_category: string
  legal_basis: string
  meal_voucher_usd: number
  hotel_required: boolean
  hotel_transport_usd: number
  travel_credit_usd: number
  dot261_cash_usd: number
  rebooking: string
  estimated_total_usd: number
  actions: string[]
  goodwill_notes: string[]
}
interface GroundAlt { mode: string; note: string; estimated_drive_hrs: number }
interface FlightImpact {
  flight_id: string
  origin: string
  destination: string
  status: string
  cascade_order: number
  delay_minutes: number
  p_delayed: number
  confidence_interval: ConfidenceInterval
  new_departure: string
  passengers: number
  compensation: Compensation
  ground_transport_alternative: GroundAlt | null
}
interface ImpactResponse {
  event_kind: string
  is_airline_fault: boolean
  total_affected: number
  flights: FlightImpact[]
}
interface HotelInfo {
  name: string; distance_mi: number; shuttle: boolean
  price_usd: number; stars: number; phone: string
}
interface AltFlight {
  flight_id: string; departure: string; arrival: string
  aircraft_id: string; seats_avail: number; delay_vs_original_hrs: number
}
interface RebookingOption {
  disrupted_flight_id: string; origin: string; destination: string
  original_departure: string; alternatives: AltFlight[]; has_options: boolean
}
interface RebookingResponse { disrupted_count: number; rebooking_options: RebookingOption[] }

// ── Helpers ────────────────────────────────────────────────────────────────────

const TABS = ["Delay Estimates", "Nearest Hotels", "Rebooking"] as const
type Tab = typeof TABS[number]

// Semantic palette per flight status. Same colors as cascade-timeline + my-flights.
function statusPalette(status: string) {
  if (status === "cancelled") return c.statusCancelled
  if (status === "delayed")   return c.statusDelayed
  return c.statusOnTime
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  } catch { return iso }
}

function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={10}
          fill={i < n ? c.signatureMustard : "none"}
          style={{ color: c.signatureMustard }}
        />
      ))}
    </span>
  )
}

// Fault banner — coral surface for airline fault, peach surface for force majeure.
// Mirrors the semantic split used in CompensationStrategy at the bottom.
function FaultBanner({ isAirlineFault, eventKind, totalAffected }: {
  isAirlineFault: boolean
  eventKind: string
  totalAffected: number
}) {
  const palette = isAirlineFault ? c.statusCancelled : c.statusDelayed
  return (
    <div
      style={{
        borderRadius: r.md,
        padding: `${sp.sm}px ${sp.md}px`,
        display: "flex",
        alignItems: "center",
        gap: sp.sm,
        background: palette.bg,
        border: `1px solid ${palette.dot}`,
      }}
    >
      {isAirlineFault
        ? <ShieldAlert size={16} style={{ color: palette.ink, flexShrink: 0 }} />
        : <ShieldCheck size={16} style={{ color: palette.ink, flexShrink: 0 }} />}
      <div>
        <Eyebrow color={palette.ink}>
          {isAirlineFault ? "Airline Operational Fault" : "Force Majeure"}
        </Eyebrow>
        <p style={{ ...type("bodyMd", c.muted), fontSize: 12, marginTop: 2 }}>
          Event: <span style={{ fontWeight: 500, color: c.ink }}>{eventKind.replace(/_/g, " ")}</span>
          {" · "}{totalAffected} flights affected
        </p>
      </div>
    </div>
  )
}

// ── Delay Estimates tab ───────────────────────────────────────────────────────

function DelayTab({ data }: { data: ImpactResponse | null }) {
  const [expandedFlight, setExpandedFlight] = useState<string | null>(null)

  if (!data || data.flights.length === 0) {
    return (
      <CreamCallout style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
        <Eyebrow>No Disruptions</Eyebrow>
        <Type as="p" role="bodyMd" color={c.muted}>
          No disrupted flights yet. Trigger an event from the simulator controls to populate
          delay estimates with confidence intervals.
        </Type>
      </CreamCallout>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: sp.sm }}>
      <FaultBanner
        isAirlineFault={data.is_airline_fault}
        eventKind={data.event_kind}
        totalAffected={data.total_affected}
      />

      {data.flights.map((f, i) => {
        const palette = statusPalette(f.status)
        const isExpanded = expandedFlight === f.flight_id
        const ci = f.confidence_interval
        const confRange = `${ci.low_min}–${ci.high_min} min`

        return (
          <motion.div
            key={f.flight_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              borderRadius: r.md,
              overflow: "hidden",
              border: `1px solid ${palette.dot}`,
              background: c.surfaceSoft,
            }}
          >
            <button
              onClick={() => setExpandedFlight(isExpanded ? null : f.flight_id)}
              style={{
                width: "100%",
                padding: `${sp.sm}px ${sp.md}px`,
                display: "flex",
                alignItems: "center",
                gap: sp.sm,
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plane size={12} style={{ color: palette.ink }} />
                  <span style={{ fontFamily: ff.mono, fontSize: 12, fontWeight: 600, color: c.ink }}>
                    {f.flight_id}
                  </span>
                  <span style={{ fontSize: 12, color: c.muted }}>
                    {f.origin} → {f.destination}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: r.sm,
                      fontWeight: 500,
                      marginLeft: "auto",
                      background: palette.bg,
                      color: palette.ink,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {f.status}
                  </span>
                </div>
              </div>
              {isExpanded
                ? <ChevronUp size={12} style={{ color: c.muted }} />
                : <ChevronDown size={12} style={{ color: c.muted }} />}
            </button>

            {/* Delay estimate bar */}
            <div style={{ padding: `0 ${sp.md}px ${sp.sm}px ${sp.md}px` }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: sp.sm }}>
                <div>
                  <span
                    style={{
                      fontFamily: ff.display,
                      fontSize: 28,
                      fontWeight: 500,
                      color: palette.ink,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                    }}
                  >
                    {f.delay_minutes}
                  </span>
                  <span style={{ fontSize: 12, color: c.muted, marginLeft: 4 }}>min</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ position: "relative", height: 8, borderRadius: r.pill, background: c.surfaceStrong }}>
                    <motion.div
                      style={{
                        position: "absolute",
                        height: 8,
                        borderRadius: r.pill,
                        background: palette.dot,
                        opacity: 0.35,
                        left: `${Math.min(100, (ci.low_min / 480) * 100)}%`,
                        width: `${Math.min(100, ((ci.high_min - ci.low_min) / 480) * 100)}%`,
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                    />
                    <motion.div
                      style={{
                        position: "absolute",
                        top: 1,
                        width: 6,
                        height: 6,
                        borderRadius: r.full,
                        background: palette.dot,
                        left: `calc(${Math.min(98, (f.delay_minutes / 480) * 100)}% - 3px)`,
                      }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2, color: c.muted, fontFamily: ff.mono }}>
                    <span>{confRange}</span>
                    <span>{Math.round(f.p_delayed * 100)}% p(delay)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded compensation */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    padding: `0 ${sp.md}px ${sp.md}px ${sp.md}px`,
                    borderTop: `1px solid ${c.hairline}`,
                  }}
                >
                  <div style={{ paddingTop: sp.sm, display: "flex", flexDirection: "column", gap: sp.xs }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: c.body }}>
                      New departure: {fmtTime(f.new_departure)} · {f.passengers} pax
                    </p>

                    {f.compensation.actions.length > 0 && (
                      <div
                        style={{
                          borderRadius: r.sm,
                          padding: sp.xs,
                          background: c.statusCancelled.bg,
                          border: `1px solid ${c.statusCancelled.dot}`,
                        }}
                      >
                        <Eyebrow color={c.statusCancelled.ink}>
                          Required actions (airline fault)
                        </Eyebrow>
                        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                          {f.compensation.actions.map((a, j) => (
                            <p key={j} style={{ fontSize: 12, color: c.body }}>• {a}</p>
                          ))}
                        </div>
                        <p style={{ fontSize: 12, marginTop: 6, fontWeight: 500, color: c.muted }}>
                          Est. obligation:{" "}
                          <span style={{ fontFamily: ff.mono, color: c.statusCancelled.ink, fontVariantNumeric: "tabular-nums" }}>
                            ${f.compensation.estimated_total_usd.toLocaleString()}
                          </span>
                        </p>
                      </div>
                    )}

                    {f.compensation.goodwill_notes.length > 0 && (
                      <div
                        style={{
                          borderRadius: r.sm,
                          padding: sp.xs,
                          background: c.statusDelayed.bg,
                          border: `1px solid ${c.statusDelayed.dot}`,
                        }}
                      >
                        <Eyebrow color={c.statusDelayed.ink}>
                          Goodwill actions (force majeure)
                        </Eyebrow>
                        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                          {f.compensation.goodwill_notes.map((n, j) => (
                            <p key={j} style={{ fontSize: 12, color: c.body }}>• {n}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {f.ground_transport_alternative && (
                      <div
                        style={{
                          borderRadius: r.sm,
                          padding: sp.xs,
                          display: "flex",
                          gap: 8,
                          background: c.surfaceSoft,
                          border: `1px solid ${c.link}`,
                        }}
                      >
                        <Car size={14} style={{ color: c.link, flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <Eyebrow color={c.link}>Ground Transport Option</Eyebrow>
                          <p style={{ fontSize: 12, color: c.body, marginTop: 2 }}>
                            {f.ground_transport_alternative.note}
                          </p>
                          <p style={{ fontSize: 12, color: c.muted }}>
                            Est. drive: {f.ground_transport_alternative.estimated_drive_hrs}h
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Hotels tab ────────────────────────────────────────────────────────────────

function HotelsTab({ activeEvents, flightStates }: {
  activeEvents: any[]
  flightStates: Record<string, any>
}) {
  const [hotels, setHotels] = useState<HotelInfo[]>([])
  const [airport, setAirport] = useState<string>("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (activeEvents.length === 0) return
    const params = activeEvents[0]?.params ?? {}
    const ap = params.airport ?? params.origin ?? ""
    if (ap) setAirport(ap)
    else {
      const disrupted = Object.values(flightStates)
        .filter((f: any) => f.cascade_order === 0)
        .sort((a: any, b: any) => b.delay_minutes - a.delay_minutes)[0]
      const dest = (disrupted as any)?.destination ?? ""
      if (dest) setAirport(dest)
    }
  }, [activeEvents, flightStates])

  useEffect(() => {
    if (!airport) return
    setLoading(true)
    apiClient.get<{ hotels: HotelInfo[] }>(`/passengers/hotels/${airport}`)
      .then(r => setHotels(r.data.hotels ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [airport])

  if (!airport) {
    return (
      <CreamCallout style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
        <Eyebrow>Awaiting Disruption</Eyebrow>
        <Type as="p" role="bodyMd" color={c.muted}>
          Trigger a disruption to surface the closest hotels with shuttle availability.
        </Type>
      </CreamCallout>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: sp.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Hotel size={14} style={{ color: c.ink }} />
        <Eyebrow color={c.ink}>Hotels near {airport}</Eyebrow>
        <span style={{ fontSize: 11, marginLeft: "auto", color: c.muted }}>
          Nimbus covers costs for airline-fault delays
        </span>
      </div>

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: `${sp.lg}px 0` }}>
          <RefreshCw size={20} className="animate-spin" style={{ color: c.ink }} />
        </div>
      )}

      {!loading && hotels.map((h, i) => (
        <motion.div
          key={h.name}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          style={{
            borderRadius: r.md,
            padding: sp.md,
            background: c.surfaceSoft,
            border: `1px solid ${c.hairline}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: sp.sm }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: r.md,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontFamily: ff.display,
                fontSize: 16,
                fontWeight: 500,
                background:
                  i === 0 ? c.signatureForest :
                  i === 1 ? c.signatureMint   :
                            c.surfaceStrong,
                color: i === 0 ? c.onPrimary : c.ink,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: c.ink }}>{h.name}</p>
                <Stars n={h.stars} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: sp.sm, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: c.muted, fontFamily: ff.mono }}>
                  {h.distance_mi < 1 ? `${(h.distance_mi * 5280).toFixed(0)} ft` : `${h.distance_mi} mi`}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: r.sm,
                    fontWeight: 500,
                    background: h.shuttle ? c.statusOnTime.bg : c.surfaceSoft,
                    color:      h.shuttle ? c.statusOnTime.ink : c.muted,
                    border: h.shuttle ? "none" : `1px solid ${c.hairline}`,
                  }}
                >
                  {h.shuttle ? "Shuttle" : "No shuttle"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, marginLeft: "auto", color: c.ink, fontFamily: ff.mono, fontVariantNumeric: "tabular-nums" }}>
                  ${h.price_usd}/night
                </span>
              </div>
              <p style={{ fontSize: 11, marginTop: 4, color: c.muted, fontFamily: ff.mono }}>{h.phone}</p>
            </div>
          </div>
        </motion.div>
      ))}

      {!loading && hotels.length === 0 && (
        <p style={{ fontSize: 13, textAlign: "center", padding: `${sp.md}px 0`, color: c.muted }}>
          No hotel data for {airport}
        </p>
      )}
    </div>
  )
}

// ── Rebooking tab ─────────────────────────────────────────────────────────────

function RebookingTab({ data }: { data: RebookingResponse | null }) {
  if (!data || data.rebooking_options.length === 0) {
    return (
      <CreamCallout style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
        <Eyebrow>No Rebookings</Eyebrow>
        <Type as="p" role="bodyMd" color={c.muted}>
          No disrupted flights yet. Rebooking options will appear once a disruption is in flight.
        </Type>
      </CreamCallout>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: sp.md }}>
      <p style={{ fontSize: 12, color: c.muted }}>
        Next available Nimbus Air flights on each disrupted city-pair.
      </p>
      {data.rebooking_options.map((opt, i) => (
        <motion.div
          key={opt.disrupted_flight_id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          style={{
            borderRadius: r.md,
            overflow: "hidden",
            border: `1px solid ${c.hairline}`,
          }}
        >
          <div
            style={{
              padding: `${sp.sm}px ${sp.md}px`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: c.surfaceSoft,
            }}
          >
            <Plane size={12} style={{ color: c.ink }} />
            <span style={{ fontFamily: ff.mono, fontSize: 12, fontWeight: 600, color: c.ink }}>
              {opt.disrupted_flight_id}
            </span>
            <span style={{ fontSize: 12, color: c.muted }}>
              {opt.origin} → {opt.destination}
            </span>
            {!opt.has_options && (
              <span
                style={{
                  fontSize: 11,
                  marginLeft: "auto",
                  padding: "2px 8px",
                  borderRadius: r.sm,
                  fontWeight: 500,
                  background: c.statusCancelled.bg,
                  color: c.statusCancelled.ink,
                }}
              >
                No options
              </span>
            )}
          </div>

          {opt.alternatives.map((alt, j) => (
            <div
              key={alt.flight_id}
              style={{
                padding: `${sp.sm}px ${sp.md}px`,
                display: "flex",
                alignItems: "center",
                gap: sp.sm,
                borderTop: `1px solid ${c.hairline}`,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: r.full,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                  background: c.statusOnTime.bg,
                  color: c.statusOnTime.ink,
                  fontFamily: ff.mono,
                }}
              >
                {j + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: ff.mono, fontSize: 12, fontWeight: 500, color: c.ink }}>
                    {alt.flight_id}
                  </span>
                  <span style={{ fontSize: 12, color: c.muted, fontFamily: ff.mono }}>
                    {fmtTime(alt.departure)} → {fmtTime(alt.arrival)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: sp.sm, marginTop: 2, fontSize: 11, color: c.muted, fontFamily: ff.mono }}>
                  <span>{alt.seats_avail} seats avail</span>
                  <span>+{alt.delay_vs_original_hrs}h vs. original</span>
                  <span style={{ marginLeft: "auto", fontWeight: 500, color: c.statusOnTime.ink, fontFamily: ff.body }}>
                    No change fee
                  </span>
                </div>
              </div>
              <CheckCircle2 size={16} style={{ color: c.statusOnTime.ink }} />
            </div>
          ))}

          {opt.has_options === false && (
            <div style={{ padding: `${sp.sm}px ${sp.md}px`, fontSize: 12, color: c.muted, borderTop: `1px solid ${c.hairline}` }}>
              No same-carrier alternatives found — consider partner airline rebooking.
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// ── Compensation Strategy footer ──────────────────────────────────────────────

function CompensationStrategy({ isAirlineFault }: { isAirlineFault: boolean }) {
  const [open, setOpen] = useState(false)

  const rows: Array<{ trigger: string; action: string; required: boolean }> = isAirlineFault
    ? [
        { trigger: "2h+ departure delay",    action: "$15 meal voucher per person",              required: true },
        { trigger: "4h+ departure delay",    action: "Hotel + $30 ground transport",             required: true },
        { trigger: "Flight cancelled",       action: "$1,400 cash OR refund + $200 credit",      required: true },
        { trigger: "Involuntary bump",       action: "400% one-way fare, max $1,550",            required: true },
        { trigger: "Any disruption",         action: "Rebooking on next available flight",        required: true },
      ]
    : [
        { trigger: "3h+ gate delay",         action: "$10 goodwill meal voucher",                required: false },
        { trigger: "Overnight cancellation", action: "Hotel at Nimbus discretion (goodwill)",    required: false },
        { trigger: "Any cancellation",       action: "Rebook — no change fee (goodwill)",        required: false },
        { trigger: "Cash compensation",      action: "Not required by DOT for force majeure",    required: false },
      ]

  const palette = isAirlineFault ? c.statusCancelled : c.statusDelayed

  return (
    <div
      style={{
        marginTop: sp.md,
        borderRadius: r.md,
        overflow: "hidden",
        border: `1px solid ${palette.dot}`,
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          padding: `${sp.sm}px ${sp.md}px`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          textAlign: "left",
          background: palette.bg,
          border: "none",
          cursor: "pointer",
        }}
      >
        {isAirlineFault
          ? <ShieldAlert size={14} style={{ color: palette.ink }} />
          : <ShieldCheck size={14} style={{ color: palette.ink }} />}
        <Eyebrow color={palette.ink}>Airline Compensation Strategy</Eyebrow>
        <span style={{ fontSize: 11, marginLeft: 8, color: c.muted }}>
          {isAirlineFault ? "Airline fault — DOT 14 CFR §250 obligations" : "Force majeure — goodwill only"}
        </span>
        {open
          ? <ChevronUp size={12} style={{ marginLeft: "auto", color: c.muted }} />
          : <ChevronDown size={12} style={{ marginLeft: "auto", color: c.muted }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", fontFamily: ff.body }}>
              <thead>
                <tr style={{ background: c.surfaceSoft }}>
                  <th style={{ textAlign: "left", padding: `${sp.xs}px ${sp.md}px`, color: c.muted, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 11 }}>
                    Trigger
                  </th>
                  <th style={{ textAlign: "left", padding: `${sp.xs}px ${sp.md}px`, color: c.muted, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 11 }}>
                    Action
                  </th>
                  <th style={{ textAlign: "center", padding: `${sp.xs}px ${sp.md}px`, color: c.muted, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 11 }}>
                    DOT Required
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${c.hairline}` }}>
                    <td style={{ padding: `${sp.xs + 2}px ${sp.md}px`, color: c.body }}>{row.trigger}</td>
                    <td style={{ padding: `${sp.xs + 2}px ${sp.md}px`, color: c.body }}>{row.action}</td>
                    <td style={{ padding: `${sp.xs + 2}px ${sp.md}px`, textAlign: "center" }}>
                      {row.required
                        ? <CheckCircle2 size={13} style={{ color: c.statusOnTime.ink, margin: "0 auto" }} />
                        : <AlertCircle size={13} style={{ color: c.muted, margin: "0 auto" }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PassengerSolutions() {
  const { activeEvents, flightStates } = useSimulationStore()
  const [activeTab, setActiveTab] = useState<Tab>("Delay Estimates")
  const [impactData, setImpactData] = useState<ImpactResponse | null>(null)
  const [rebookData, setRebookData] = useState<RebookingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const hasDisruption = activeEvents.length > 0

  const fetchAll = useCallback(async () => {
    if (!hasDisruption) return
    setLoading(true)
    setFetchError(null)
    try {
      const [impact, rebook] = await Promise.all([
        apiClient.get<ImpactResponse>("/passengers/impact"),
        apiClient.get<RebookingResponse>("/passengers/rebooking"),
      ])
      setImpactData(impact.data)
      setRebookData(rebook.data)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load passenger data")
    } finally {
      setLoading(false)
    }
  }, [hasDisruption])

  useEffect(() => {
    if (hasDisruption) fetchAll()
  }, [activeEvents.length, hasDisruption, fetchAll])

  const isAirlineFault = impactData?.is_airline_fault ?? false

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%", fontFamily: ff.body }}>
      {/* Header */}
      <div
        style={{
          padding: `${sp.md}px ${sp.lg}px`,
          display: "flex",
          alignItems: "center",
          gap: sp.sm,
          flexShrink: 0,
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: r.md,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: c.surfaceSoft,
            border: `1px solid ${c.hairline}`,
          }}
        >
          <Users2 size={16} style={{ color: c.ink }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ ...type("titleMd", c.ink), fontSize: 16 }}>Passenger Solutions</h2>
          <p style={{ ...type("caption", c.muted), fontSize: 11, marginTop: 2 }}>
            Delay estimates · Hotel recommendations · Rebooking
          </p>
        </div>
        <ButtonSecondary
          size="sm"
          onClick={fetchAll}
          disabled={loading || !hasDisruption}
          leadingIcon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />}
        >
          {loading ? "Loading…" : "Refresh"}
        </ButtonSecondary>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          padding: `${sp.xs}px ${sp.lg}px 0 ${sp.lg}px`,
          gap: 4,
          flexShrink: 0,
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: `${sp.xs}px ${sp.sm}px`,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.04em",
                background: "transparent",
                color: isActive ? c.ink : c.muted,
                border: "none",
                borderBottom: isActive ? `2px solid ${c.ink}` : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                fontFamily: ff.body,
              }}
            >
              {tab === "Delay Estimates" && <Clock size={11} style={{ display: "inline", marginRight: 4 }} />}
              {tab === "Nearest Hotels"  && <Hotel size={11} style={{ display: "inline", marginRight: 4 }} />}
              {tab === "Rebooking"       && <ArrowRightLeft size={11} style={{ display: "inline", marginRight: 4 }} />}
              {tab}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ overflowY: "auto", flex: 1, padding: `${sp.md}px ${sp.lg}px` }}>
        {!hasDisruption ? (
          <CreamCallout style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
            <Eyebrow>Awaiting Disruption</Eyebrow>
            <Type as="div" role="titleSm" color={c.ink}>
              Trigger an event to generate passenger solutions.
            </Type>
            <Type as="p" role="bodyMd" color={c.muted}>
              We'll surface delay estimates with confidence intervals, nearby hotels with shuttle data,
              and Nimbus rebooking alternatives — plus the DOT 14 CFR §250 obligations on the table.
            </Type>
          </CreamCallout>
        ) : fetchError ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: sp.xs }}>
            <AlertCircle size={28} style={{ color: c.statusCancelled.ink }} />
            <Type as="p" role="titleSm" color={c.statusCancelled.ink}>Failed to load data</Type>
            <Type as="p" role="bodyMd" color={c.muted}>{fetchError}</Type>
            <ButtonSecondary size="sm" onClick={fetchAll} style={{ marginTop: sp.xs }}>
              Retry
            </ButtonSecondary>
          </div>
        ) : (
          <>
            {activeTab === "Delay Estimates" && <DelayTab data={impactData} />}
            {activeTab === "Nearest Hotels"  && (
              <HotelsTab activeEvents={activeEvents} flightStates={flightStates} />
            )}
            {activeTab === "Rebooking"       && <RebookingTab data={rebookData} />}

            {impactData && <CompensationStrategy isAirlineFault={isAirlineFault} />}
          </>
        )}
      </div>
    </div>
  )
}
