"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, CheckCircle2, XCircle, RefreshCw,
  ChevronDown, ChevronUp, Clock, Plane, ShieldAlert, DollarSign,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { c, ff, r, sp, sh, type } from "@/lib/design-tokens"
import { ButtonSecondary, CreamCallout, Eyebrow, Type } from "@/components/ds/primitives"

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

// Solver status → semantic palette. Same tokens as the recovery-plans
// SolverStatus pill so a feasible result looks the same in both panels.
const SOLVER_PALETTE: Record<string, { ink: string; bg: string }> = {
  optimal:    { ink: c.statusOnTime.ink,    bg: c.statusOnTime.bg },
  feasible:   { ink: c.statusRecovered.ink, bg: c.statusRecovered.bg },
  heuristic:  { ink: c.statusDelayed.ink,   bg: c.statusDelayed.bg },
  infeasible: { ink: c.statusCancelled.ink, bg: c.statusCancelled.bg },
}

function CoverageMeter({ pct }: { pct: number }) {
  // Coverage health: green ≥80%, peach 50-79%, coral <50%.
  const palette =
    pct >= 80 ? c.statusOnTime    :
    pct >= 50 ? c.statusDelayed   :
                c.statusCancelled
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.muted }}>
        <span>Coverage</span>
        <span style={{ color: palette.ink, fontWeight: 600, fontFamily: ff.mono, fontVariantNumeric: "tabular-nums" }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div style={{ height: 8, borderRadius: r.pill, background: c.surfaceStrong }}>
        <motion.div
          style={{ height: 8, borderRadius: r.pill, background: palette.dot }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function CompCard({ ob, expanded }: { ob: CompensationObligation; expanded: boolean }) {
  const palette = ob.is_airline_fault ? c.statusCancelled : c.statusDelayed
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
          style={{
            borderRadius: r.md,
            padding: sp.sm,
            marginTop: sp.xs,
            background: palette.bg,
            border: `1px solid ${palette.dot}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <ShieldAlert style={{ width: 13, height: 13, color: palette.ink }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: palette.ink }}>{faultLabel}</span>
            <span style={{ fontSize: 12, color: c.muted, marginLeft: "auto" }}>{ob.pax} pax</span>
          </div>
          <p style={{ fontSize: 12, color: c.muted, marginBottom: 6 }}>{ob.legal_basis}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {ob.notes.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: c.body }}>
                <span style={{ color: palette.ink, flexShrink: 0 }}>•</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
          {totalEst > 0 && (
            <div style={{ marginTop: sp.xs, paddingTop: sp.xs, borderTop: `1px solid ${c.hairline}`, display: "flex", alignItems: "center", gap: 6 }}>
              <DollarSign style={{ width: 11, height: 11, color: c.muted }} />
              <span style={{ fontSize: 12, color: c.muted }}>
                Est. obligation:{" "}
                <span style={{ fontFamily: ff.mono, fontWeight: 600, color: palette.ink, fontVariantNumeric: "tabular-nums" }}>
                  ${totalEst.toLocaleString()}
                </span>
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CrewOverbooking() {
  const { activeEvents } = useSimulationStore()
  const [result, setResult]           = useState<OverbookingResult | null>(null)
  const [loading, setLoading]         = useState(false)
  const [expandedComp, setExpandedComp] = useState<string | null>(null)
  const [showAssignments, setShowAssignments] = useState(false)

  const hasDisruption = activeEvents.length > 0

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

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%", fontFamily: ff.body }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: sp.sm,
          padding: `${sp.md}px ${sp.lg}px`,
          borderBottom: `1px solid ${c.hairline}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: r.md,
            background: c.surfaceSoft,
            border: `1px solid ${c.hairline}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Users size={16} style={{ color: c.ink }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ ...type("titleMd", c.ink), fontSize: 16 }}>Crew Coverage Optimizer</h2>
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.06em",
                padding: "2px 8px",
                borderRadius: r.pill,
                background: c.statusOnTime.bg,
                color: c.statusOnTime.ink,
              }}
            >
              CP-SAT MILP
            </span>
          </div>
          <p style={{ ...type("caption", c.muted), fontSize: 11, marginTop: 2 }}>
            Maximize legal crew assignment under disruption
          </p>
        </div>
        <ButtonSecondary
          size="sm"
          onClick={runSolver}
          disabled={loading || !hasDisruption}
          leadingIcon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />}
        >
          {loading ? "Solving…" : "Re-solve"}
        </ButtonSecondary>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: `${sp.md}px ${sp.lg}px`, display: "flex", flexDirection: "column", gap: sp.md }}>
        {/* ── No disruption state — cream callout per Complaint 2 ── */}
        {!hasDisruption && (
          <CreamCallout style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
            <Eyebrow color={c.signatureForest}>Awaiting Disruption</Eyebrow>
            <Type as="div" role="titleSm" color={c.ink}>
              All crew assignments holding FAR 117 compliance.
            </Type>
            <Type as="p" role="bodyMd" color={c.muted}>
              Trigger an event to analyze crew coverage. The CP-SAT solver maximizes legal pairings against the
              disrupted schedule and surfaces compensation obligations under DOT 14 CFR §250.
            </Type>
          </CreamCallout>
        )}

        {/* ── Summary stats ── */}
        {hasDisruption && result && (
          <>
            {/* Solver badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(() => {
                const p = SOLVER_PALETTE[result.solver_status] ?? SOLVER_PALETTE.heuristic
                return (
                  <>
                    <div style={{ width: 8, height: 8, borderRadius: r.full, background: p.ink }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: p.ink, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      {result.solver_status} — {result.solve_time_ms}ms
                    </span>
                  </>
                )
              })()}
              <span style={{ fontSize: 12, color: c.muted, marginLeft: "auto" }}>{result.summary}</span>
            </div>

            {/* Coverage meter */}
            <CoverageMeter pct={result.coverage_pct} />

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: sp.sm }}>
              <StatCell label="Open Flights" value={result.total_open_flights} palette={c.statusDelayed} />
              <StatCell label="Staffed"      value={result.total_covered}      palette={c.statusOnTime} />
              <StatCell label="Uncovered"    value={result.total_uncovered}    palette={c.statusCancelled} />
            </div>

            {/* Pax impact */}
            <div
              style={{
                borderRadius: r.md,
                padding: sp.sm,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: c.statusOnTime.bg,
                border: `1px solid ${c.statusOnTime.dot}`,
              }}
            >
              <div style={{ fontSize: 12, color: c.statusOnTime.ink }}>
                <span style={{ fontFamily: ff.mono, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {result.pax_covered.toLocaleString()}
                </span>{" "}
                pax covered
              </div>
              {result.pax_uncovered > 0 && (
                <div style={{ fontSize: 12, color: c.statusCancelled.ink }}>
                  <span style={{ fontFamily: ff.mono, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {result.pax_uncovered.toLocaleString()}
                  </span>{" "}
                  pax impacted
                </div>
              )}
            </div>

            {/* Cancelled recommended */}
            {result.cancelled_recommended.length > 0 && (
              <div
                style={{
                  borderRadius: r.md,
                  padding: sp.sm,
                  background: c.statusCancelled.bg,
                  border: `1px solid ${c.statusCancelled.dot}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <XCircle size={14} style={{ color: c.statusCancelled.ink }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: c.statusCancelled.ink }}>
                    Recommended Cancellations ({result.cancelled_recommended.length})
                  </span>
                </div>
                <p style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>
                  No legal crew available for these flights — cancellation advised.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.cancelled_recommended.map(fid => (
                    <span
                      key={fid}
                      style={{
                        padding: "2px 8px",
                        borderRadius: r.sm,
                        fontSize: 11,
                        fontFamily: ff.mono,
                        fontWeight: 500,
                        background: c.canvas,
                        color: c.statusCancelled.ink,
                        border: `1px solid ${c.statusCancelled.dot}`,
                      }}
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    width: "100%",
                    color: c.ink,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <CheckCircle2 size={13} style={{ color: c.statusOnTime.ink }} />
                  Crew Assignments ({result.covered_assignments.length})
                  {showAssignments
                    ? <ChevronUp size={13} style={{ marginLeft: "auto", color: c.muted }} />
                    : <ChevronDown size={13} style={{ marginLeft: "auto", color: c.muted }} />}
                </button>

                <AnimatePresence>
                  {showAssignments && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ marginTop: sp.xs, display: "flex", flexDirection: "column", gap: sp.xs }}
                    >
                      {result.covered_assignments.map(a => (
                        <div
                          key={a.flight_id}
                          style={{
                            borderRadius: r.md,
                            padding: sp.sm,
                            background: c.statusOnTime.bg,
                            border: `1px solid ${c.statusOnTime.dot}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <Plane size={12} style={{ color: c.statusOnTime.ink }} />
                            <span style={{ fontSize: 12, fontFamily: ff.mono, fontWeight: 600, color: c.ink }}>
                              {a.flight_id}
                            </span>
                            {a.is_reassigned && (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 6px",
                                  borderRadius: r.sm,
                                  fontWeight: 500,
                                  background: c.signatureCream,
                                  color: "#5C3D0F",
                                }}
                              >
                                Reassigned
                              </span>
                            )}
                            <span style={{ fontSize: 12, marginLeft: "auto", color: c.statusOnTime.ink, fontWeight: 500 }}>
                              FAR 117 ✓
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: c.body }}>
                            CPT: {a.captain_name} ({a.captain_id})
                            {a.fo_name && <span style={{ marginLeft: 12 }}>F/O: {a.fo_name}</span>}
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: sp.xs,
                    paddingTop: sp.xs,
                    borderTop: `1px solid ${c.hairline}`,
                  }}
                >
                  <DollarSign size={14} style={{ color: c.muted }} />
                  <Eyebrow>Passenger Compensation</Eyebrow>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
                  {result.compensation_obligations.map(ob => (
                    <div key={ob.flight_id}>
                      <button
                        onClick={() => setExpandedComp(expandedComp === ob.flight_id ? null : ob.flight_id)}
                        style={{
                          width: "100%",
                          borderRadius: r.md,
                          padding: sp.sm,
                          display: "flex",
                          alignItems: "center",
                          gap: sp.sm,
                          textAlign: "left",
                          background: c.surfaceSoft,
                          border: `1px solid ${ob.is_airline_fault ? c.statusCancelled.dot : c.statusDelayed.dot}`,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 12, fontFamily: ff.mono, fontWeight: 600, color: c.ink }}>
                          {ob.flight_id}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: r.sm,
                            fontWeight: 500,
                            background: ob.is_airline_fault ? c.statusCancelled.bg : c.statusDelayed.bg,
                            color: ob.is_airline_fault ? c.statusCancelled.ink : c.statusDelayed.ink,
                          }}
                        >
                          {ob.is_airline_fault ? "Airline Fault" : "Force Majeure"}
                        </span>
                        <span style={{ fontSize: 12, marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: c.muted }}>
                          <Clock size={10} /> {ob.delay_minutes}min
                        </span>
                        {expandedComp === ob.flight_id
                          ? <ChevronUp size={12} style={{ color: c.muted }} />
                          : <ChevronDown size={12} style={{ color: c.muted }} />}
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: sp.sm }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: r.full,
                background: c.surfaceSoft,
                border: `1px solid ${c.hairline}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RefreshCw size={20} className="animate-spin" style={{ color: c.ink }} />
            </div>
            <p style={{ ...type("bodyMd", c.body), fontWeight: 500 }}>Running CP-SAT solver…</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCell({
  label,
  value,
  palette,
}: {
  label: string
  value: number
  palette: { ink: string; bg: string; dot: string }
}) {
  return (
    <div
      style={{
        borderRadius: r.md,
        padding: sp.sm,
        textAlign: "center",
        background: palette.bg,
        border: `1px solid ${palette.dot}`,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
          fontFamily: ff.display,
          color: palette.ink,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}
