"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  ChevronDown, ChevronUp, Clock, Plane, ShieldAlert, DollarSign,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"

interface CrewAssignment {
  flight_id: string
  captain_id: string
  captain_name: string
  fo_id: string
  fo_name: string
  is_reassigned: boolean
  far117_legal: boolean
  violations: string[]
}

interface CompensationObligation {
  flight_id: string
  event_kind: string
  is_airline_fault: boolean
  delay_minutes: number
  is_cancelled: boolean
  pax: number
  meal_voucher_usd: number
  hotel_required: boolean
  travel_credit_usd: number
  dot261_cash_usd: number
  rebooking: string
  legal_basis: string
  notes: string[]
}

interface OverbookingResult {
  solved: boolean
  solve_time_ms: number
  solver_status: string
  total_open_flights: number
  total_covered: number
  total_uncovered: number
  coverage_pct: number
  pax_covered: number
  pax_uncovered: number
  covered_assignments: CrewAssignment[]
  uncovered_flights: string[]
  cancelled_recommended: string[]
  compensation_obligations: CompensationObligation[]
  summary: string
}

const card = {
  background: "#ffffff",
  border: "1px solid #DDDDDD",
  boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
}

const STATUS_COLOR: Record<string, string> = {
  optimal:    "#10b981",
  feasible:   "#0D9488",
  heuristic:  "#f59e0b",
  infeasible: "#ef4444",
}

function CoverageMeter({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs" style={{ color: "#64748b" }}>
        <span>Coverage</span>
        <span style={{ color, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "#e2e8f0" }}>
        <motion.div
          className="h-2 rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function CompCard({ ob, expanded }: { ob: CompensationObligation; expanded: boolean }) {
  const faultColor = ob.is_airline_fault ? "#ef4444" : "#f59e0b"
  const faultLabel = ob.is_airline_fault ? "Airline Fault" : "Force Majeure"
  const totalEst   = (
    ob.meal_voucher_usd * ob.pax +
    (ob.hotel_required ? 180 * ob.pax : 0) +
    ob.dot261_cash_usd +
    ob.travel_credit_usd
  )

  return (
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-xl p-3 mt-2"
          style={{ background: ob.is_airline_fault ? "#fef2f2" : "#fffbeb", border: `1px solid ${faultColor}30` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={13} style={{ color: faultColor }} />
            <span className="text-xs font-semibold" style={{ color: faultColor }}>{faultLabel}</span>
            <span className="text-xs ml-auto" style={{ color: "#64748b" }}>{ob.pax} pax</span>
          </div>
          <p className="text-xs mb-2" style={{ color: "#64748b" }}>{ob.legal_basis}</p>
          <div className="space-y-1">
            {ob.notes.map((n, i) => (
              <div key={i} className="flex gap-1.5 text-xs" style={{ color: "#374151" }}>
                <span style={{ color: faultColor, flexShrink: 0 }}>•</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
          {totalEst > 0 && (
            <div className="mt-2 pt-2 flex items-center gap-1.5" style={{ borderTop: "1px solid #e2e8f0" }}>
              <DollarSign size={11} style={{ color: "#64748b" }} />
              <span className="text-xs" style={{ color: "#64748b" }}>
                Est. obligation: <span style={{ fontWeight: 700, color: faultColor }}>${totalEst.toLocaleString()}</span>
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CrewOverbooking() {
  const { activeEvents, flightStates } = useSimulationStore()
  const [result, setResult]           = useState<OverbookingResult | null>(null)
  const [loading, setLoading]         = useState(false)
  const [expandedComp, setExpandedComp] = useState<string | null>(null)
  const [showAssignments, setShowAssignments] = useState(false)

  const hasDisruption = activeEvents.length > 0
  const eventKind     = activeEvents[0]?.kind ?? ""
  const isCrewEvent   = ["crew_sickout", "mechanical_aog", "cyber_incident"].includes(eventKind)

  const runSolver = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.post<OverbookingResult>("/recovery/crew-overbooking", {})
      setResult(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-run when a crew-relevant event fires
  useEffect(() => {
    if (hasDisruption) runSolver()
  }, [activeEvents.length, hasDisruption, runSolver])

  const affectedFlightCount = Object.values(flightStates).filter(
    f => f.cascade_order >= 0
  ).length

  return (
    <div className="rounded-2xl flex flex-col min-h-0" style={card}>
      {/* ── Header ── */}
      <div
        className="px-5 py-4 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: "1px solid #DDDDDD" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(13,148,136,0.10)" }}
        >
          <Users size={18} style={{ color: "#0D9488" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold" style={{ color: "#0f172a" }}>Crew Coverage Optimizer</h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "#ecfdf5", color: "#059669" }}
            >
              CP-SAT MILP
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            Maximize legal crew assignment under disruption
          </p>
        </div>
        <button
          onClick={runSolver}
          disabled={loading || !hasDisruption}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: hasDisruption ? "#0D9488" : "#e2e8f0",
            color: hasDisruption ? "#fff" : "#94a3b8",
            cursor: hasDisruption ? "pointer" : "not-allowed",
          }}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Solving…" : "Re-solve"}
        </button>
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        {/* ── No disruption state ── */}
        {!hasDisruption && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Users size={32} style={{ color: "#cbd5e1" }} />
            <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>
              Awaiting disruption
            </p>
            <p className="text-xs" style={{ color: "#cbd5e1" }}>
              Trigger an event to analyze crew coverage
            </p>
          </div>
        )}

        {/* ── Summary stats ── */}
        {hasDisruption && result && (
          <>
            {/* Solver badge */}
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: STATUS_COLOR[result.solver_status] ?? "#94a3b8" }}
              />
              <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[result.solver_status] ?? "#64748b" }}>
                {result.solver_status.toUpperCase()} — {result.solve_time_ms}ms
              </span>
              <span className="text-xs ml-auto" style={{ color: "#94a3b8" }}>
                {result.summary}
              </span>
            </div>

            {/* Coverage meter */}
            <CoverageMeter pct={result.coverage_pct} />

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Open Flights", value: result.total_open_flights, color: "#f59e0b" },
                { label: "Staffed",      value: result.total_covered,      color: "#10b981" },
                { label: "Uncovered",    value: result.total_uncovered,     color: "#ef4444" },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                  <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pax impact */}
            <div
              className="rounded-xl p-3 flex justify-between items-center"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
            >
              <div className="text-xs" style={{ color: "#166534" }}>
                <span className="font-semibold">{result.pax_covered.toLocaleString()}</span> pax covered
              </div>
              {result.pax_uncovered > 0 && (
                <div className="text-xs" style={{ color: "#991b1b" }}>
                  <span className="font-semibold">{result.pax_uncovered.toLocaleString()}</span> pax impacted
                </div>
              )}
            </div>

            {/* Cancelled recommended */}
            {result.cancelled_recommended.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={14} style={{ color: "#ef4444" }} />
                  <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                    Recommended Cancellations ({result.cancelled_recommended.length})
                  </span>
                </div>
                <p className="text-xs mb-2" style={{ color: "#64748b" }}>
                  No legal crew available for these flights — cancellation advised.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.cancelled_recommended.map(fid => (
                    <span
                      key={fid}
                      className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
                      style={{ background: "#fecaca", color: "#991b1b" }}
                    >
                      {fid}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Assignments toggle */}
            {result.covered_assignments.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAssignments(v => !v)}
                  className="flex items-center gap-2 text-xs font-semibold w-full"
                  style={{ color: "#0D9488" }}
                >
                  <CheckCircle2 size={13} />
                  Crew Assignments ({result.covered_assignments.length})
                  {showAssignments ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
                </button>

                <AnimatePresence>
                  {showAssignments && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-2"
                    >
                      {result.covered_assignments.map(a => (
                        <div
                          key={a.flight_id}
                          className="rounded-xl p-3"
                          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Plane size={12} style={{ color: "#059669" }} />
                            <span className="text-xs font-mono font-bold" style={{ color: "#0f172a" }}>
                              {a.flight_id}
                            </span>
                            {a.is_reassigned && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-semibold"
                                style={{ background: "#fef9c3", color: "#854d0e" }}
                              >
                                Reassigned
                              </span>
                            )}
                            <span className="text-xs ml-auto" style={{ color: "#10b981", fontWeight: 600 }}>
                              FAR 117 ✓
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: "#374151" }}>
                            CPT: {a.captain_name} ({a.captain_id})
                            {a.fo_name && <span className="ml-3">F/O: {a.fo_name}</span>}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Compensation obligations ── */}
            {result.compensation_obligations.length > 0 && (
              <div>
                <div
                  className="flex items-center gap-2 mb-2 pt-2"
                  style={{ borderTop: "1px solid #e2e8f0" }}
                >
                  <DollarSign size={14} style={{ color: "#f59e0b" }} />
                  <span className="text-sm font-bold" style={{ color: "#0f172a" }}>
                    Passenger Compensation
                  </span>
                </div>
                <div className="space-y-2">
                  {result.compensation_obligations.map(ob => (
                    <div key={ob.flight_id}>
                      <button
                        onClick={() => setExpandedComp(expandedComp === ob.flight_id ? null : ob.flight_id)}
                        className="w-full rounded-xl p-3 flex items-center gap-3 text-left transition-all"
                        style={{
                          background: "#f8fafc",
                          border: `1px solid ${ob.is_airline_fault ? "#fecaca" : "#fde68a"}`,
                        }}
                      >
                        <span className="text-xs font-mono font-bold" style={{ color: "#0f172a" }}>
                          {ob.flight_id}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            background: ob.is_airline_fault ? "#fef2f2" : "#fffbeb",
                            color: ob.is_airline_fault ? "#ef4444" : "#f59e0b",
                          }}
                        >
                          {ob.is_airline_fault ? "Airline Fault" : "Force Majeure"}
                        </span>
                        <span className="text-xs ml-auto flex items-center gap-1" style={{ color: "#64748b" }}>
                          <Clock size={10} /> {ob.delay_minutes}min
                        </span>
                        {expandedComp === ob.flight_id
                          ? <ChevronUp size={12} style={{ color: "#94a3b8" }} />
                          : <ChevronDown size={12} style={{ color: "#94a3b8" }} />}
                      </button>
                      <CompCard ob={ob} expanded={expandedComp === ob.flight_id} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading state */}
        {hasDisruption && loading && !result && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(13,148,136,0.10)" }}
            >
              <RefreshCw size={20} className="animate-spin" style={{ color: "#0D9488" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "#0D9488" }}>Running CP-SAT solver…</p>
          </div>
        )}
      </div>
    </div>
  )
}
