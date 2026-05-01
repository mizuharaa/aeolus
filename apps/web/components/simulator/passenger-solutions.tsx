"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users2, Clock, Hotel, RefreshCw, ArrowRightLeft,
  CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp,
  Plane, Car, ShieldCheck, ShieldAlert, Star,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"

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

const card = {
  background: "#ffffff",
  border: "1.5px solid rgba(43,168,162,0.18)",
  boxShadow: "0 2px 16px rgba(43,168,162,0.07), 0 1px 3px rgba(0,0,0,0.04)",
}

function statusColor(status: string): string {
  if (status === "cancelled") return "#ef4444"
  if (status === "delayed")   return "#f59e0b"
  return "#10b981"
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  } catch { return iso }
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={10} fill={i < n ? "#f59e0b" : "none"} style={{ color: "#f59e0b" }} />
      ))}
    </span>
  )
}

// ── Delay Estimates tab ───────────────────────────────────────────────────────

function DelayTab({ data }: { data: ImpactResponse | null }) {
  const [expandedFlight, setExpandedFlight] = useState<string | null>(null)

  if (!data || data.flights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Clock size={32} style={{ color: "#cbd5e1" }} />
        <p className="text-sm" style={{ color: "#94a3b8" }}>No disrupted flights yet</p>
      </div>
    )
  }

  const faultLabel = data.is_airline_fault ? "Airline Operational Fault" : "Force Majeure"
  const faultColor = data.is_airline_fault ? "#ef4444" : "#f59e0b"

  return (
    <div className="space-y-3">
      {/* Event fault banner */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{
          background: data.is_airline_fault ? "#fef2f2" : "#fffbeb",
          border: `1px solid ${faultColor}40`,
        }}
      >
        {data.is_airline_fault
          ? <ShieldAlert size={16} style={{ color: faultColor }} />
          : <ShieldCheck size={16} style={{ color: faultColor }} />
        }
        <div>
          <p className="text-xs font-bold" style={{ color: faultColor }}>{faultLabel}</p>
          <p className="text-xs" style={{ color: "#64748b" }}>
            Event: <span className="font-semibold">{data.event_kind.replace(/_/g, " ")}</span>
            {" · "}{data.total_affected} flights affected
          </p>
        </div>
      </div>

      {/* Flight cards */}
      {data.flights.map((f, i) => {
        const sc = statusColor(f.status)
        const isExpanded = expandedFlight === f.flight_id
        const ci = f.confidence_interval
        const confRange = `${ci.low_min}–${ci.high_min} min`

        return (
          <motion.div
            key={f.flight_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${sc}30`, background: "#fafafa" }}
          >
            {/* Row header */}
            <button
              className="w-full px-4 py-3 flex items-center gap-3 text-left"
              onClick={() => setExpandedFlight(isExpanded ? null : f.flight_id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Plane size={12} style={{ color: sc }} />
                  <span className="text-xs font-mono font-bold" style={{ color: "#0f172a" }}>
                    {f.flight_id}
                  </span>
                  <span className="text-xs" style={{ color: "#64748b" }}>
                    {f.origin} → {f.destination}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-semibold ml-auto"
                    style={{ background: `${sc}20`, color: sc }}
                  >
                    {f.status}
                  </span>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={12} style={{ color: "#94a3b8" }} /> : <ChevronDown size={12} style={{ color: "#94a3b8" }} />}
            </button>

            {/* Delay estimate bar */}
            <div className="px-4 pb-3">
              <div className="flex items-end gap-3">
                {/* Delay number */}
                <div>
                  <span className="text-2xl font-black" style={{ color: sc }}>
                    {f.delay_minutes}
                  </span>
                  <span className="text-xs ml-1" style={{ color: "#64748b" }}>min</span>
                </div>

                {/* Confidence band visualization */}
                <div className="flex-1 min-w-0">
                  <div className="relative h-3 rounded-full" style={{ background: "#e2e8f0" }}>
                    <motion.div
                      className="absolute h-3 rounded-full"
                      style={{
                        background: `${sc}40`,
                        left: `${Math.min(100, (ci.low_min / 480) * 100)}%`,
                        width: `${Math.min(100, ((ci.high_min - ci.low_min) / 480) * 100)}%`,
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                    />
                    <motion.div
                      className="absolute top-0.5 w-2 h-2 rounded-full"
                      style={{
                        background: sc,
                        left: `calc(${Math.min(98, (f.delay_minutes / 480) * 100)}% - 4px)`,
                      }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                    <span>{confRange}</span>
                    <span>{Math.round(f.p_delayed * 100)}% p(delay)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded detail: compensation */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-4"
                  style={{ borderTop: "1px solid #e2e8f0" }}
                >
                  <div className="pt-3 space-y-2">
                    <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                      New departure: {fmtTime(f.new_departure)}
                      {" · "}{f.passengers} pax
                    </p>

                    {/* Compensation actions */}
                    {f.compensation.actions.length > 0 && (
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
                      >
                        <p className="text-xs font-semibold mb-1.5" style={{ color: "#ef4444" }}>
                          Required actions (airline fault)
                        </p>
                        {f.compensation.actions.map((a, j) => (
                          <p key={j} className="text-xs" style={{ color: "#374151" }}>• {a}</p>
                        ))}
                        <p className="text-xs mt-1.5 font-semibold" style={{ color: "#64748b" }}>
                          Est. obligation: ${f.compensation.estimated_total_usd.toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Goodwill notes */}
                    {f.compensation.goodwill_notes.length > 0 && (
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
                      >
                        <p className="text-xs font-semibold mb-1.5" style={{ color: "#f59e0b" }}>
                          Goodwill actions (force majeure)
                        </p>
                        {f.compensation.goodwill_notes.map((n, j) => (
                          <p key={j} className="text-xs" style={{ color: "#374151" }}>• {n}</p>
                        ))}
                      </div>
                    )}

                    {/* Ground transport alt */}
                    {f.ground_transport_alternative && (
                      <div
                        className="rounded-lg p-2.5 flex gap-2"
                        style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
                      >
                        <Car size={14} style={{ color: "#0284c7", flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#0284c7" }}>
                            Ground Transport Option
                          </p>
                          <p className="text-xs" style={{ color: "#374151" }}>
                            {f.ground_transport_alternative.note}
                          </p>
                          <p className="text-xs" style={{ color: "#64748b" }}>
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

function HotelsTab({ activeEvents, schedule, flightStates }: {
  activeEvents: any[]; schedule: any[]; flightStates: Record<string, any>
}) {
  const [hotels, setHotels]       = useState<HotelInfo[]>([])
  const [airport, setAirport]     = useState<string>("")
  const [loading, setLoading]     = useState(false)

  // Pick the most impacted airport from active events
  useEffect(() => {
    if (activeEvents.length === 0) return
    const params = activeEvents[0]?.params ?? {}
    const airport = params.airport ?? params.origin ?? ""
    if (airport) setAirport(airport)
    else {
      // Fall back to most disrupted flight's destination
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
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Hotel size={32} style={{ color: "#cbd5e1" }} />
        <p className="text-sm" style={{ color: "#94a3b8" }}>Trigger a disruption to see hotels</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Hotel size={14} style={{ color: "#2BA8A2" }} />
        <span className="text-sm font-bold" style={{ color: "#0f172a" }}>
          Hotels near {airport}
        </span>
        <span className="text-xs ml-auto" style={{ color: "#64748b" }}>
          Nimbus covers costs for airline-fault delays
        </span>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <RefreshCw size={20} className="animate-spin" style={{ color: "#2BA8A2" }} />
        </div>
      )}

      {!loading && hotels.map((h, i) => (
        <motion.div
          key={h.name}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-xl p-4"
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-black"
              style={{
                background: i === 0 ? "#2BA8A2" : i === 1 ? "#4ade80" : "#e2e8f0",
                color: i < 2 ? "#fff" : "#64748b",
              }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold" style={{ color: "#0f172a" }}>{h.name}</p>
                <Stars n={h.stars} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs" style={{ color: "#64748b" }}>
                  {h.distance_mi < 1 ? `${(h.distance_mi * 5280).toFixed(0)} ft` : `${h.distance_mi} mi`}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    background: h.shuttle ? "#f0fdf4" : "#f8fafc",
                    color: h.shuttle ? "#059669" : "#94a3b8",
                  }}
                >
                  {h.shuttle ? "✓ Shuttle" : "No shuttle"}
                </span>
                <span className="text-xs font-bold ml-auto" style={{ color: "#0f172a" }}>
                  ${h.price_usd}/night
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>{h.phone}</p>
            </div>
          </div>
        </motion.div>
      ))}

      {!loading && hotels.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: "#94a3b8" }}>
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
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <ArrowRightLeft size={32} style={{ color: "#cbd5e1" }} />
        <p className="text-sm" style={{ color: "#94a3b8" }}>No disrupted flights yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: "#64748b" }}>
        Next available Nimbus Air flights on each disrupted city-pair.
      </p>
      {data.rebooking_options.map((opt, i) => (
        <motion.div
          key={opt.disrupted_flight_id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid #e2e8f0" }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2" style={{ background: "#f8fafc" }}>
            <Plane size={12} style={{ color: "#2BA8A2" }} />
            <span className="text-xs font-mono font-bold" style={{ color: "#0f172a" }}>
              {opt.disrupted_flight_id}
            </span>
            <span className="text-xs" style={{ color: "#64748b" }}>
              {opt.origin} → {opt.destination}
            </span>
            {!opt.has_options && (
              <span className="text-xs ml-auto px-1.5 py-0.5 rounded font-semibold"
                style={{ background: "#fef2f2", color: "#ef4444" }}>
                No options
              </span>
            )}
          </div>

          {/* Alternatives */}
          {opt.alternatives.map((alt, j) => (
            <div
              key={alt.flight_id}
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderTop: "1px solid #e2e8f0" }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "#ecfdf5", color: "#059669" }}
              >
                {j + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold" style={{ color: "#0f172a" }}>
                    {alt.flight_id}
                  </span>
                  <span className="text-xs" style={{ color: "#64748b" }}>
                    {fmtTime(alt.departure)} → {fmtTime(alt.arrival)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "#94a3b8" }}>
                  <span>{alt.seats_avail} seats avail</span>
                  <span>+{alt.delay_vs_original_hrs}h vs. original</span>
                  <span className="ml-auto font-semibold" style={{ color: "#2BA8A2" }}>
                    No change fee
                  </span>
                </div>
              </div>
              <CheckCircle2 size={16} style={{ color: "#10b981" }} />
            </div>
          ))}

          {opt.has_options === false && (
            <div className="px-4 py-3 text-xs" style={{ color: "#94a3b8", borderTop: "1px solid #e2e8f0" }}>
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

  const headerColor = isAirlineFault ? "#ef4444" : "#f59e0b"
  const headerBg    = isAirlineFault ? "#fef2f2" : "#fffbeb"

  return (
    <div
      className="rounded-xl overflow-hidden mt-4"
      style={{ border: `1px solid ${headerColor}30` }}
    >
      <button
        className="w-full px-4 py-3 flex items-center gap-2 text-left"
        style={{ background: headerBg }}
        onClick={() => setOpen(v => !v)}
      >
        {isAirlineFault
          ? <ShieldAlert size={14} style={{ color: headerColor }} />
          : <ShieldCheck size={14} style={{ color: headerColor }} />
        }
        <span className="text-xs font-bold" style={{ color: headerColor }}>
          Airline Compensation Strategy
        </span>
        <span className="text-xs ml-2" style={{ color: "#64748b" }}>
          {isAirlineFault ? "Airline fault — DOT 14 CFR §250 obligations" : "Force majeure — goodwill only"}
        </span>
        {open ? <ChevronUp size={12} className="ml-auto" style={{ color: "#94a3b8" }} /> : <ChevronDown size={12} className="ml-auto" style={{ color: "#94a3b8" }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th className="text-left px-4 py-2" style={{ color: "#64748b", fontWeight: 600 }}>Trigger</th>
                  <th className="text-left px-4 py-2" style={{ color: "#64748b", fontWeight: 600 }}>Action</th>
                  <th className="text-center px-4 py-2" style={{ color: "#64748b", fontWeight: 600 }}>DOT Required</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td className="px-4 py-2.5" style={{ color: "#374151" }}>{r.trigger}</td>
                    <td className="px-4 py-2.5" style={{ color: "#374151" }}>{r.action}</td>
                    <td className="px-4 py-2.5 text-center">
                      {r.required
                        ? <CheckCircle2 size={13} style={{ color: "#10b981", margin: "0 auto" }} />
                        : <AlertCircle size={13} style={{ color: "#94a3b8", margin: "0 auto" }} />
                      }
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
  const { activeEvents, flightStates, schedule } = useSimulationStore()
  const [activeTab, setActiveTab] = useState<Tab>("Delay Estimates")
  const [impactData, setImpactData]     = useState<ImpactResponse | null>(null)
  const [rebookData, setRebookData]     = useState<RebookingResponse | null>(null)
  const [loading, setLoading]           = useState(false)

  const hasDisruption = activeEvents.length > 0

  const fetchAll = useCallback(async () => {
    if (!hasDisruption) return
    setLoading(true)
    try {
      const [impact, rebook] = await Promise.all([
        apiClient.get<ImpactResponse>("/passengers/impact"),
        apiClient.get<RebookingResponse>("/passengers/rebooking"),
      ])
      setImpactData(impact.data)
      setRebookData(rebook.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [hasDisruption])

  useEffect(() => {
    if (hasDisruption) fetchAll()
  }, [activeEvents.length, hasDisruption, fetchAll])

  const isAirlineFault = impactData?.is_airline_fault ?? false

  return (
    <div className="rounded-2xl flex flex-col min-h-0" style={card}>
      {/* ── Header ── */}
      <div
        className="px-5 py-4 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(43,168,162,0.14)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(43,168,162,0.12)" }}
        >
          <Users2 size={18} style={{ color: "#2BA8A2" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold" style={{ color: "#0f172a" }}>Passenger Solutions</h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            Delay estimates · Hotel recommendations · Rebooking
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading || !hasDisruption}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{
            background: hasDisruption ? "#2BA8A2" : "#e2e8f0",
            color: hasDisruption ? "#fff" : "#94a3b8",
            cursor: hasDisruption ? "pointer" : "not-allowed",
          }}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex px-5 pt-3 gap-1 flex-shrink-0"
        style={{ borderBottom: "1px solid #e2e8f0" }}
      >
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3 py-2 text-xs font-semibold rounded-t-lg transition-all"
            style={{
              background: activeTab === tab ? "#fff" : "transparent",
              color: activeTab === tab ? "#2BA8A2" : "#94a3b8",
              borderBottom: activeTab === tab ? "2px solid #2BA8A2" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab === "Delay Estimates" && <Clock size={11} className="inline mr-1" />}
            {tab === "Nearest Hotels"  && <Hotel size={11} className="inline mr-1" />}
            {tab === "Rebooking"       && <ArrowRightLeft size={11} className="inline mr-1" />}
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="overflow-y-auto flex-1 px-5 py-4">
        {!hasDisruption ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Info size={32} style={{ color: "#cbd5e1" }} />
            <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>Awaiting disruption</p>
            <p className="text-xs" style={{ color: "#cbd5e1" }}>
              Trigger an event to generate passenger solutions
            </p>
          </div>
        ) : (
          <>
            {activeTab === "Delay Estimates" && <DelayTab data={impactData} />}
            {activeTab === "Nearest Hotels"  && (
              <HotelsTab
                activeEvents={activeEvents}
                schedule={schedule}
                flightStates={flightStates}
              />
            )}
            {activeTab === "Rebooking"       && <RebookingTab data={rebookData} />}

            {/* Compensation strategy table — shown on all tabs */}
            {impactData && (
              <CompensationStrategy isAirlineFault={isAirlineFault} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
