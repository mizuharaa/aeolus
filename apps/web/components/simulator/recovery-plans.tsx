"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, AlertCircle, CheckCircle2, Clock,
  Plane, Play, X, Sparkles, ShieldCheck, Activity,
  Repeat2, UserCheck, AlertTriangle,
  Leaf, ArrowRight,
} from "lucide-react"
import { useSimulationStore, useHasActiveDisruption } from "@/stores/simulation"
import { airportLabel, aircraftLabel } from "@/lib/labels"
import { c, ff, r, sp, type } from "@/lib/design-tokens"
import { CreamCallout, Eyebrow, Type } from "@/components/ds/primitives"
import { LiveCostDisplay } from "@/components/ds/live-cost"

// ─── Plan metadata ────────────────────────────────────────────────────────
const PLAN_META = {
  A: { label: "Minimize Cost",    short: "Cost", sublabel: "Lowest financial exposure" },
  B: { label: "Min. Pax Impact",  short: "Pax",  sublabel: "Best passenger experience" },
  C: { label: "Protect Tomorrow", short: "Tmrw", sublabel: "Minimizes next-day cascades" },
  D: { label: "Green Recovery",   short: "CO₂",  sublabel: "Lowest carbon footprint" },
} as const

const APPLIED_ACCENT = "var(--ae-teal)"

// ─── Solver-status pill ───────────────────────────────────────────────────
// Every MILP solve reports "optimal" for ITS OWN objective — stamping
// OPTIMAL on every plan is noise. Render only when the solve is abnormal.
function SolverStatus({ status }: { status: string }) {
  if (status === "optimal" || status === "feasible") return null
  const map: Record<string, { Icon: typeof CheckCircle2; ink: string; bg: string }> = {
    heuristic:  { Icon: Clock,       ink: c.statusDelayed.ink, bg: c.statusDelayed.bg },
    infeasible: { Icon: AlertCircle, ink: c.statusDelayed.ink, bg: c.statusDelayed.bg },
  }
  const s = map[status] || map.heuristic
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
        padding: "2px 8px", borderRadius: r.pill, background: s.bg, color: s.ink, fontFamily: ff.body,
      }}
    >
      <s.Icon style={{ width: 10, height: 10 }} />
      {status}
    </span>
  )
}

// Build a plain-English explanation of what this plan does and why
function buildNarrative(plan: any): string {
  const cancelled  = plan.cancelled_flights?.length  || 0
  const delayed    = plan.delayed_flights?.length    || 0
  const swaps      = plan.aircraft_swaps?.length     || 0
  const violations = plan.crew_violations            || 0
  const oops       = plan.aircraft_out_of_position   || 0
  const paxMin     = plan.total_passenger_delay_minutes || 0

  const crew117 = violations > 0
    ? `⚠️ ${violations} FAR 117 duty-time ${violations === 1 ? "flag" : "flags"} require manual crew scheduling review before dispatch.`
    : "All crew duty periods stay within FAR 117 compliance — no manual override needed."

  if (plan.plan_id === "A") {
    const cancelNote = cancelled > 0
      ? `${cancelled} flight${cancelled !== 1 ? "s" : ""} are cancelled where the all-in cancellation cost (revenue loss + rebooking + DOT Part 261 vouchers) is lower than running the flight late with overtime crew and gate holds.`
      : "No cancellations are needed — the disruption can be fully absorbed through delays."
    const delayNote = delayed > 0
      ? `${delayed} flight${delayed !== 1 ? "s" : ""} receive targeted delays to shed crew overtime and reduce ground-hold gate costs.`
      : ""
    const swapNote = swaps > 0
      ? `${swaps} aircraft swap${swaps !== 1 ? "s" : ""} reposition tail numbers to avoid deadhead repositioning ferry flights.`
      : ""
    return `${cancelNote} ${delayNote} ${swapNote} ${crew117}`
  }

  if (plan.plan_id === "B") {
    const paxNote = `Total passenger impact is ${(paxMin / 1000).toFixed(1)}K delay-minutes across the network — the lowest of the three plans.`
    const cancelNote = cancelled > 0
      ? `${cancelled} cancellation${cancelled !== 1 ? "s" : ""} occur only where delay would exceed 4 hours, at which point rebooking on the next departure creates less total inconvenience.`
      : "No cancellations are required — all passengers reach their destinations via delay rather than rebooking."
    const delayNote = delayed > 0
      ? `${delayed} flight${delayed !== 1 ? "s" : ""} are delayed to preserve route connectivity and protect passengers from missing connections.`
      : ""
    const swapNote = swaps > 0
      ? `${swaps} aircraft swap${swaps !== 1 ? "s" : ""} redistribute capacity to protect high-load routes where stranding passengers would be most damaging.`
      : ""
    return `${paxNote} ${cancelNote} ${delayNote} ${swapNote} This approach carries higher operational cost than Plan A but limits DOT Part 261 compensation exposure and protects Nimbus's on-time performance metrics. ${crew117}`
  }

  if (plan.plan_id === "C") {
    const oopsNote = oops > 0
      ? `Without intervention, ${oops} tail number${oops !== 1 ? "s" : ""} would end the day out-of-position — creating a guaranteed next-morning cascade. This plan eliminates that risk entirely.`
      : "All aircraft end the day at their scheduled home bases, ready for tomorrow's departures."
    const cancelNote = cancelled > 0
      ? `${cancelled} flight${cancelled !== 1 ? "s" : ""} are sacrificed today to free aircraft for home-base repositioning.`
      : ""
    const delayNote = delayed > 0
      ? `${delayed} flight${delayed !== 1 ? "s" : ""} are delayed to give repositioning aircraft enough gate-turn time without requiring empty ferry flights.`
      : ""
    return `${oopsNote} ${cancelNote} ${delayNote} This plan accepts the highest crew scheduling complexity and may carry a higher cost today, but pays dividends in next-day on-time performance and avoids compounding the disruption across the following 48-hour window. ${crew117}`
  }

  return plan.summary || "Recovery strategy generated by the Aeolus heuristic optimizer."
}

// ─── Money formatting ─────────────────────────────────────────────────────
const fmtUsd = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${(v / 1000).toFixed(0)}K`

const planCost = (p: any) => p.cost_breakdown?.grand_total_usd || p.total_cost_usd || 0

// ═══ THE DECISION MATRIX ═══════════════════════════════════════════════════
// All four plans side by side, one metric per row, the BEST value per row
// underlined in teal. Clicking a column selects that plan for the detail
// ledger below. This is where "which plan?" gets answered — the detail
// panel is for "what exactly does it do?".

function DecisionMatrix({
  plans, selectedId, appliedId, onSelect,
}: {
  plans: any[]
  selectedId: string
  appliedId: string | null
  onSelect: (id: string) => void
}) {
  // metric rows: label + accessor + formatter (lower is better for all)
  const rows: { label: string; get: (p: any) => number; fmt: (v: number) => string }[] = [
    { label: "Cost",    get: planCost,                                        fmt: fmtUsd },
    { label: "Pax·min", get: (p) => p.total_passenger_delay_minutes || 0,     fmt: (v) => `${(v / 1000).toFixed(1)}K` },
    { label: "tCO₂e",   get: (p) => p.total_co2_kg ?? 0,                      fmt: (v) => `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}` },
    { label: "FAR 117", get: (p) => p.crew_violations || 0,                   fmt: (v) => (v === 0 ? "OK" : String(v)) },
    { label: "Cancels", get: (p) => p.cancelled_flights?.length || 0,         fmt: (v) => String(v) },
  ]

  const cellW = `${Math.floor(100 / (plans.length + 1))}%`

  return (
    <div style={{ padding: `${sp.sm}px ${sp.sm}px 0` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: ff.mono, fontSize: 11.5 }}>
        <thead>
          <tr>
            <th style={{ width: cellW }} />
            {plans.map((p) => {
              const meta = PLAN_META[p.plan_id as keyof typeof PLAN_META] || PLAN_META.A
              const sel = p.plan_id === selectedId
              const applied = p.plan_id === appliedId
              return (
                <th key={p.plan_id} style={{ width: cellW, padding: 0 }}>
                  {/* Plan tab — the selected tab is PUNCHED OUT: ink slab,
                      paper text, full contrast. Applied carries teal. */}
                  <button
                    onClick={() => onSelect(p.plan_id)}
                    aria-pressed={sel}
                    title={`${meta.label} — inspect`}
                    style={{
                      width: "100%",
                      padding: "12px 2px 10px",
                      border: "none",
                      borderBottom: `3px solid ${applied ? "var(--ae-teal)" : sel ? "var(--ae-text)" : "var(--ae-line)"}`,
                      background: sel ? "var(--ae-text)" : "transparent",
                      borderRadius: "10px 10px 0 0",
                      cursor: "pointer",
                      transition: "background 140ms ease, border-color 140ms ease",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontFamily: ff.display,
                        fontWeight: 800,
                        fontSize: 22,
                        lineHeight: 1,
                        letterSpacing: "-0.01em",
                        color: sel ? "var(--ae-bg)" : c.ink,
                      }}
                    >
                      {p.plan_id}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: ff.mono,
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginTop: 4,
                        color: sel
                          ? (applied ? "var(--ae-teal)" : "var(--ae-bg)")
                          : applied ? "var(--ae-teal-ink)" : c.muted,
                      }}
                    >
                      {applied ? "Applied" : meta.short}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = plans.map(row.get)
            const best = Math.min(...values)
            return (
              <tr key={row.label}>
                <td style={{ padding: "6px 4px", fontFamily: ff.body, fontSize: 10.5, color: c.muted, borderBottom: `1px solid ${c.hairline}` }}>
                  {row.label}
                </td>
                {plans.map((p, i) => {
                  const isBest = values[i] === best
                  const sel = p.plan_id === selectedId
                  return (
                    <td
                      key={p.plan_id}
                      onClick={() => onSelect(p.plan_id)}
                      style={{
                        padding: "6px 2px",
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: isBest ? 700 : 500,
                        color: isBest ? "var(--ae-teal-ink)" : c.body,
                        background: sel ? "var(--ae-surface-2)" : "transparent",
                        borderBottom: `1px solid ${c.hairline}`,
                        cursor: "pointer",
                      }}
                    >
                      <span style={isBest ? { borderBottom: "2px solid var(--ae-teal)", paddingBottom: 1 } : undefined}>
                        {row.fmt(values[i])}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p style={{ margin: "6px 2px 0", fontFamily: ff.mono, fontSize: 9, letterSpacing: "0.04em", color: c.muted }}>
        Teal = best of the four · click a column to inspect
      </p>
    </div>
  )
}

// ═══ THE PLAN LEDGER — full detail for the selected plan ═══════════════════

function PlanLedger({
  plan, isApplied, cheapestCost, onApply, onFlightSelect,
}: {
  plan: any
  isApplied: boolean
  cheapestCost: number
  onApply: () => void
  onFlightSelect: (id: string) => void
}) {
  const meta = PLAN_META[plan.plan_id as keyof typeof PLAN_META] || PLAN_META.A
  const { schedule, fleet } = useSimulationStore()

  const flightRoute = (fid: string): { codes: string; cities: string } => {
    const f = schedule.find((x) => x.id === fid)
    if (!f) return { codes: "", cities: "" }
    const o = airportLabel(f.origin)
    const d = airportLabel(f.destination)
    return {
      codes: `${o.iata || f.origin} → ${d.iata || f.destination}`,
      cities: o.city && d.city ? `${o.city} → ${d.city}` : "",
    }
  }

  const cancelled = plan.cancelled_flights?.length || 0
  const delayed   = plan.delayed_flights?.length   || 0
  const swaps     = plan.aircraft_swaps?.length    || 0
  const cb        = plan.cost_breakdown
  const totalCostUsd = planCost(plan)

  return (
    <motion.div
      key={plan.plan_id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      style={{ padding: sp.sm, display: "flex", flexDirection: "column", gap: sp.sm, fontFamily: ff.body }}
    >
      {/* ── identity + apply ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.sm }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eyebrow color={isApplied ? c.statusRecovered.ink : c.muted}>Plan {plan.plan_id}</Eyebrow>
            {isApplied && (
              <span style={{ fontSize: 10, fontWeight: 550, padding: "2px 7px", borderRadius: r.pill, background: c.statusRecovered.bg, color: c.statusRecovered.ink }}>
                Applied
              </span>
            )}
            <SolverStatus status={plan.status} />
          </div>
          <div style={{ ...type("titleLg", c.ink), marginTop: 3 }}>{meta.label}</div>
          <div style={{ ...type("bodyMd", c.muted), fontSize: 12.5, marginTop: 2 }}>{meta.sublabel}</div>
        </div>
        <button
          onClick={onApply}
          style={{
            flexShrink: 0,
            height: 38,
            padding: "0 16px",
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 13.5, fontWeight: 550, fontFamily: ff.body,
            borderRadius: r.md,
            border: isApplied ? `1px solid ${c.borderStrong}` : `1px solid ${c.primary}`,
            background: isApplied ? "transparent" : c.primary,
            color: isApplied ? c.ink : c.onPrimary,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
        >
          {isApplied
            ? <><X style={{ width: 14, height: 14 }} strokeWidth={1.75} /> Unapply</>
            : <><Play style={{ width: 14, height: 14 }} strokeWidth={1.75} /> Apply</>}
        </button>
      </div>

      {/* ── the financial ledger ── */}
      <div
        style={{
          borderRadius: r.sm,
          padding: "12px 12px 10px",
          background: c.canvas,
          border: `1px solid ${c.hairline}`,
          borderLeft: `3px solid ${isApplied ? APPLIED_ACCENT : c.borderStrong}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: c.muted }}>Est. total cost</span>
          <LiveCostDisplay plan={plan} size="md" />
        </div>

        {cb && cb.grand_total_usd > 0 && (
          <>
            {/* segmented composition bar — one bar, three cost classes */}
            <div aria-hidden style={{ display: "flex", height: 6, borderRadius: r.pill, overflow: "hidden", background: c.surfaceStrong, margin: "10px 0 8px" }}>
              {[
                { v: cb.cancellation_total_usd, color: c.borderStrong },
                { v: cb.delay_total_usd, color: c.amber },
                { v: cb.reposition_cost_usd, color: c.teal },
              ].map((seg, si) =>
                seg.v > 0 ? <span key={si} style={{ width: `${(seg.v / cb.grand_total_usd) * 100}%`, background: seg.color }} /> : null,
              )}
            </div>
            {[
              { v: cb.cancellation_total_usd, color: c.borderStrong, label: "Cancellations (rev. loss + rebook + DOT 261)" },
              { v: cb.delay_total_usd, color: c.amber, label: "Delays (ops + crew OT + pax time)" },
              { v: cb.reposition_cost_usd, color: c.teal, label: "Aircraft repositioning" },
            ].map((row) =>
              row.v > 0 ? (
                <div key={row.label} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 11, color: c.muted, marginTop: 3 }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: row.color, flexShrink: 0, alignSelf: "center" }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                  <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.body, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {fmtUsd(row.v)}
                  </span>
                </div>
              ) : null,
            )}
          </>
        )}

        {Number.isFinite(cheapestCost) && cheapestCost > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.hairline}`, fontSize: 11 }}>
            {totalCostUsd <= cheapestCost ? (
              <span style={{ color: c.statusRecovered.ink, fontWeight: 600 }}>Lowest-cost plan</span>
            ) : (
              <>
                <span style={{ color: c.muted }}>vs cheapest plan</span>
                <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.statusDelayed.ink, fontVariantNumeric: "tabular-nums" }}>
                  +{fmtUsd(totalCostUsd - cheapestCost)}
                </span>
              </>
            )}
          </div>
        )}

        <p style={{ fontSize: 9.5, color: c.muted, margin: "7px 0 0", fontFamily: ff.mono, letterSpacing: "0.02em" }}>
          DOT BTS 2023 · $82.50/pax-hr · Form 41 block-hour ops
        </p>
      </div>

      {/* ── actions summary + carbon ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {cancelled > 0 && <CountChip kind="cancelled" Icon={X}       count={cancelled} label="cancelled" />}
        {delayed   > 0 && <CountChip kind="delayed"   Icon={Clock}   count={delayed}   label="delayed" />}
        {swaps     > 0 && <CountChip kind="recovered" Icon={Repeat2} count={swaps}     label="swaps" />}
        {cancelled === 0 && delayed === 0 && swaps === 0 && (
          <span style={{ fontSize: 11, color: c.statusOnTime.ink, fontWeight: 500 }}>No actions — schedule intact</span>
        )}
        {plan.total_co2_kg !== undefined && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: c.muted, fontFamily: ff.mono, marginLeft: "auto" }}>
            <Leaf style={{ width: 11, height: 11, color: c.signatureForest }} />
            <span style={{ color: plan.total_co2_kg < 0 ? c.statusRecovered.ink : c.statusDelayed.ink, fontWeight: 600 }}>
              {plan.total_co2_kg >= 0 ? "+" : ""}{(plan.total_co2_kg / 1000).toFixed(2)} tCO₂e
            </span>
          </span>
        )}
      </div>

      {/* ── strategy narrative — always visible, this IS the explanation ── */}
      <div>
        <Eyebrow>Strategy</Eyebrow>
        <p style={{ ...type("bodyMd", c.body), marginTop: 6, fontSize: 12, lineHeight: 1.55 }}>
          {buildNarrative(plan)}
        </p>
      </div>

      {/* ── operational impact ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: sp.xs }}>
        <ImpactCell
          Icon={UserCheck}
          label="Crew"
          valueOk={plan.crew_violations === 0}
          valueText={plan.crew_violations > 0 ? `${plan.crew_violations} FAR117 flag${plan.crew_violations !== 1 ? "s" : ""}` : "Fully compliant"}
        />
        <ImpactCell
          Icon={Plane}
          label="Aircraft pos."
          valueOk={(plan.aircraft_out_of_position || 0) === 0}
          valueText={plan.aircraft_out_of_position > 0 ? `${plan.aircraft_out_of_position} out-of-pos.` : "All in-position"}
        />
        <ImpactCell
          Icon={Users}
          label="Passengers"
          valueOk
          valueText={`${((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K pax·min`}
        />
        <ImpactCell
          Icon={Clock}
          label="Solve time"
          valueOk
          valueText={plan.solve_time_ms > 0 ? `${plan.solve_time_ms}ms` : "—"}
          mono
        />
      </div>

      {/* ── flight lists ── */}
      {cancelled > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <X style={{ width: 12, height: 12, color: c.muted }} strokeWidth={1.75} />
            <Eyebrow>Cancellations ({cancelled})</Eyebrow>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {plan.cancelled_flights.map((fid: string) => {
              const route = flightRoute(fid)
              return (
                <button
                  key={fid}
                  onClick={() => onFlightSelect(fid)}
                  title={route.cities || route.codes || fid}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 11, padding: "3px 8px", borderRadius: r.sm,
                    background: c.statusCancelled.bg, color: c.statusCancelled.ink,
                    border: "none", cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: ff.mono, fontWeight: 500 }}>{fid}</span>
                  {route.codes && <span style={{ fontFamily: ff.mono, opacity: 0.75 }}>{route.codes}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {delayed > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <Clock style={{ width: 12, height: 12, color: c.statusDelayed.ink }} />
            <Eyebrow>Delays ({delayed})</Eyebrow>
          </div>
          <div style={{ maxHeight: 132, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {plan.delayed_flights.slice(0, 30).map((d: any) => {
              const route = flightRoute(d.flight_id)
              return (
                <div
                  key={d.flight_id}
                  title={route.cities || route.codes || d.flight_id}
                  onClick={() => onFlightSelect(d.flight_id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: sp.xs, fontSize: 11, borderRadius: r.sm, padding: "4px 8px", cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: ff.mono, fontWeight: 500, color: c.body, flexShrink: 0 }}>{d.flight_id}</span>
                    {route.codes && (
                      <span style={{ fontFamily: ff.mono, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {route.codes}
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.statusDelayed.ink, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    +{d.delay_minutes}m
                  </span>
                </div>
              )
            })}
            {delayed > 30 && <p style={{ fontSize: 10, color: c.muted, padding: "2px 8px" }}>+{delayed - 30} more…</p>}
          </div>
        </div>
      )}

      {swaps > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <Repeat2 style={{ width: 12, height: 12, color: c.link }} />
            <Eyebrow>Aircraft swaps ({swaps})</Eyebrow>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {plan.aircraft_swaps.map((s: any, i: number) => {
              const oldAc = aircraftLabel(s.old_aircraft, fleet)
              const newAc = aircraftLabel(s.new_aircraft, fleet)
              const route = flightRoute(s.flight_id)
              return (
                <div
                  key={i}
                  title={route.cities || route.codes || s.flight_id}
                  style={{
                    display: "flex", flexDirection: "column", gap: 2, fontSize: 11,
                    background: c.canvas, border: `1px solid ${c.hairline}`, borderRadius: r.sm, padding: "6px 8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: ff.mono, fontWeight: 500, color: c.body, flexShrink: 0 }}>{s.flight_id}</span>
                    {route.codes && <span style={{ fontFamily: ff.mono, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.codes}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: ff.mono, color: c.muted, textDecoration: "line-through" }}>{oldAc.tail || s.old_aircraft}</span>
                    {oldAc.typeLabel && <span style={{ fontSize: 10, color: c.muted, opacity: 0.75 }}>({oldAc.typeLabel})</span>}
                    <span style={{ color: c.muted }}>→</span>
                    <span style={{ fontFamily: ff.mono, color: c.statusRecovered.ink }}>{newAc.tail || s.new_aircraft}</span>
                    {newAc.typeLabel && <span style={{ fontSize: 10, color: c.statusRecovered.ink, opacity: 0.75 }}>({newAc.typeLabel})</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* deep-link to the full counterfactual explainer */}
      <Link
        href={`/simulator/plans/${plan.plan_id}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: c.link, textDecoration: "none", fontWeight: 500 }}
      >
        Open full plan detail <ArrowRight style={{ width: 12, height: 12 }} />
      </Link>
    </motion.div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function CountChip({
  kind, Icon, count, label,
}: {
  kind: "cancelled" | "delayed" | "recovered"
  Icon: typeof X
  count: number
  label: string
}) {
  const palette =
    kind === "cancelled" ? c.statusCancelled :
    kind === "delayed"   ? c.statusDelayed   :
                            c.statusRecovered
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11, fontWeight: 500, padding: "2px 8px",
        borderRadius: r.pill, background: palette.bg, color: palette.ink, fontFamily: ff.body,
      }}
    >
      <Icon style={{ width: 12, height: 12 }} /> {count} {label}
    </span>
  )
}

function ImpactCell({
  Icon, label, valueOk, valueText, mono = false,
}: {
  Icon: typeof UserCheck
  label: string
  valueOk: boolean
  valueText: string
  mono?: boolean
}) {
  return (
    <div style={{ borderRadius: r.sm, padding: "8px 10px", border: `1px solid ${c.hairline}`, background: c.canvas }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.muted, marginBottom: 2 }}>
        <Icon style={{ width: 12, height: 12 }} /> {label}
      </div>
      <div
        style={{
          fontSize: 12, fontWeight: 500,
          color: valueOk ? c.statusOnTime.ink : c.statusDelayed.ink,
          fontFamily: mono ? ff.mono : ff.body,
          fontVariantNumeric: mono ? "tabular-nums" : undefined,
        }}
      >
        {valueText}
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────

export function RecoveryPlans({
  selectedFlight, onFlightSelect,
}: {
  selectedFlight: string | null
  onFlightSelect: (id: string | null) => void
}) {
  const { recoveryPlans, cascadeSummary, appliedPlanId, applyPlan } = useSimulationStore()
  const hasDisruption = useHasActiveDisruption()
  const [inspectedId, setInspectedId] = useState<string>("A")

  // Applying a plan pulls the inspector to it — the operator is always
  // looking at what's committed unless they deliberately click away.
  useEffect(() => {
    if (appliedPlanId) setInspectedId(appliedPlanId)
  }, [appliedPlanId])

  // True empty-state: no disruption at all.
  if (!hasDisruption && recoveryPlans.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader
          Icon={Activity}
          title="Recovery Plans"
          subtitle="Plans A–D · cost / pax / tomorrow / carbon"
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: sp.md }}>
          <CreamCallout style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 8 }}>
            <Eyebrow color={c.statusRecovered.ink}>Awaiting disruption</Eyebrow>
            <Type as="div" role="titleSm" color={c.ink}>
              All flights operating nominally.
            </Type>
            <Type as="p" role="bodyMd" color={c.muted}>
              Trigger an event from the left rail to receive ranked recovery plans with cost breakdowns and counterfactual rationale.
            </Type>
            <span style={{ fontFamily: ff.mono, fontSize: 11, color: c.muted, marginTop: 4 }}>
              CP-SAT solve typically &lt; 10 ms · cost engine deterministic
            </span>
          </CreamCallout>
        </div>
      </div>
    )
  }

  const inspected =
    recoveryPlans.find((p: any) => p.plan_id === inspectedId) || recoveryPlans[0]
  const cheapestCost = Math.min(...recoveryPlans.map(planCost).filter((v: number) => v > 0))

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PanelHeader
        Icon={Activity}
        title="Recovery Plans"
        subtitle={
          cascadeSummary
            ? `${cascadeSummary.total_affected} affected · ${cascadeSummary.directly_affected} direct · ${(cascadeSummary.cascade_1 || 0) + (cascadeSummary.cascade_2 || 0)} cascade`
            : `${recoveryPlans.length} plans ready`
        }
      />

      {/* paddingBottom clears the fixed Ask-Aeolus pill */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 96 }} className="ae-scroll-smooth">
        <DecisionMatrix
          plans={recoveryPlans}
          selectedId={inspected?.plan_id ?? "A"}
          appliedId={appliedPlanId}
          onSelect={setInspectedId}
        />
        <AnimatePresence mode="wait">
          {inspected && (
            <PlanLedger
              key={inspected.plan_id}
              plan={inspected}
              isApplied={appliedPlanId === inspected.plan_id}
              cheapestCost={cheapestCost}
              onApply={() => applyPlan(appliedPlanId === inspected.plan_id ? null : inspected.plan_id)}
              onFlightSelect={(id) => onFlightSelect(id)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Panel header — used by every right-rail panel ────────────────────────

function PanelHeader({
  Icon, title, subtitle,
}: {
  Icon: typeof Activity
  title: string
  subtitle: string
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: sp.sm,
        padding: `${sp.sm}px ${sp.md}px`,
        background: c.canvas,
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: r.sm,
          background: c.surfaceSoft, border: `1px solid ${c.hairline}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <Icon style={{ width: 14, height: 14, color: c.ink }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...type("titleMd", c.ink), fontSize: 16 }}>{title}</div>
        <div style={{ ...type("caption", c.muted), fontSize: 11, marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  )
}

// Re-export so other simulator panels can reuse the canonical header.
export { PanelHeader }

// Kept available so existing imports in other files don't break.
export { Sparkles }
