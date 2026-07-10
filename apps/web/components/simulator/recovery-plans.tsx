"use client"
import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  DollarSign, Users, AlertCircle, CheckCircle2, Clock,
  Plane, Play, X, Sparkles, ShieldCheck, Activity,
  ChevronDown, ChevronUp, TrendingDown, Repeat2, UserCheck, AlertTriangle,
  Leaf, ArrowRight,
} from "lucide-react"
import { useSimulationStore, useHasActiveDisruption } from "@/stores/simulation"
import { airportLabel, aircraftLabel } from "@/lib/labels"
import { c, ff, r, sp, sh, type } from "@/lib/design-tokens"
import { ButtonSecondary, CreamCallout, Eyebrow, Type } from "@/components/ds/primitives"
import { LiveCostDisplay } from "@/components/ds/live-cost"

// ─── Plan metadata ────────────────────────────────────────────────────────
// Plans are differentiated by their DATA (objective, cost, actions), not by
// per-plan pastel identities. Every card is neutral; the applied plan — and
// only the applied plan — carries the teal accent.
const PLAN_META = {
  A: { label: "Minimize Cost",   sublabel: "Lowest financial exposure" },
  B: { label: "Min. Pax Impact", sublabel: "Best passenger experience" },
  C: { label: "Protect Tomorrow", sublabel: "Minimizes next-day cascades" },
  D: { label: "Green Recovery",  sublabel: "Lowest carbon footprint" },
} as const

const APPLIED_ACCENT = "var(--ae-teal)"

// ─── Solver-status pill ───────────────────────────────────────────────────
// Glass-box solver report — uses the semantic palette so a green tick here
// means the same thing as a green tick on an on-time flight.
function SolverStatus({ status }: { status: string }) {
  const map: Record<string, { Icon: typeof CheckCircle2; ink: string; bg: string }> = {
    optimal:    { Icon: CheckCircle2, ink: c.statusRecovered.ink, bg: c.statusRecovered.bg },
    feasible:   { Icon: CheckCircle2, ink: c.statusRecovered.ink, bg: c.statusRecovered.bg },
    heuristic:  { Icon: Clock,        ink: c.statusDelayed.ink,   bg: c.statusDelayed.bg },
    infeasible: { Icon: AlertCircle,  ink: c.statusDelayed.ink,   bg: c.statusDelayed.bg },
  }
  const s = map[status] || map.heuristic
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: r.pill,
        background: s.bg,
        color: s.ink,
        fontFamily: ff.body,
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

// Visual cost bar — proportional fill driven by the same status palette as
// the rest of the dashboard. Cancellation uses coral, delay uses peach,
// repositioning uses link blue.
function CostBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  if (!value || value <= 0) return null
  const pct = Math.min(100, Math.round((value / total) * 100))
  const fmt = value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(2)}M`
    : `$${(value / 1000).toFixed(0)}K`
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
        <span style={{ color: c.muted }}>{label}</span>
        <span style={{ fontFamily: ff.mono, fontWeight: 600, color }}>{fmt}</span>
      </div>
      <div style={{ height: 6, borderRadius: r.pill, background: c.surfaceStrong }}>
        <motion.div
          style={{ height: "100%", borderRadius: r.pill, background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function PlanCard({
  plan, isApplied, onApply, onFlightSelect, index,
}: {
  plan: any
  isSelected: boolean
  isApplied: boolean
  onClick: () => void
  onApply: (e: React.MouseEvent) => void
  onFlightSelect: (id: string) => void
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = PLAN_META[plan.plan_id as keyof typeof PLAN_META] || PLAN_META.A
  const { schedule, fleet } = useSimulationStore()
  // Build flight_id → "ORG → DST (City → City)" lookup once per render.
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

  const cancelled = plan.cancelled_flights?.length  || 0
  const delayed   = plan.delayed_flights?.length    || 0
  const swaps     = plan.aircraft_swaps?.length     || 0
  const cb        = plan.cost_breakdown

  const totalCostUsd = cb?.grand_total_usd || plan.total_cost_usd || 0
  const fmtTotal = totalCostUsd >= 1_000_000
    ? `$${(totalCostUsd / 1_000_000).toFixed(2)}M`
    : `$${(totalCostUsd / 1000).toFixed(0)}K`

  const narrative = buildNarrative(plan)

  return (
    <motion.div
      className="ae-maestro-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        background: c.canvas,
        border: `1px solid ${isApplied ? APPLIED_ACCENT : c.hairline}`,
        boxShadow: isApplied ? sh.cardElev : sh.cardSoft,
        fontFamily: ff.body,
      }}
    >
      {/* ── Card header — always visible ── */}
      <div style={{ display: "flex", gap: 0 }}>
        {/* Left accent strip — teal only when applied */}
        <div style={{ width: 3, flexShrink: 0, background: isApplied ? APPLIED_ACCENT : "transparent" }} />

        <div style={{ flex: 1, padding: sp.md }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.xs, marginBottom: sp.sm }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Eyebrow color={isApplied ? c.statusRecovered.ink : c.muted}>Plan {plan.plan_id}</Eyebrow>
                {isApplied && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 550,
                      padding: "2px 7px",
                      borderRadius: r.pill,
                      background: c.statusRecovered.bg,
                      color: c.statusRecovered.ink,
                    }}
                  >
                    Applied
                  </span>
                )}
              </div>
              <div style={{ ...type("titleSm", c.ink), marginTop: 2 }}>{meta.label}</div>
              <div style={{ ...type("bodyMd", c.muted), fontSize: 12, marginTop: 2 }}>{meta.sublabel}</div>
            </div>
            <SolverStatus status={plan.status} />
          </div>

          {/* Key metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: sp.xs, marginBottom: sp.sm }}>
            {/* Total cost — prominent signature surface */}
            {/* Inline cost strip — chromatic restraint: plain canvas + 3px
                accent stripe on the left, NOT a full pastel tint. Reads as
                an OCC ledger row, not a marketing chip. */}
            <div
              style={{
                gridColumn: "1 / -1",
                borderRadius: r.sm,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: c.canvas,
                color: c.ink,
                border: `1px solid ${c.hairline}`,
                borderLeft: `3px solid ${isApplied ? APPLIED_ACCENT : c.borderStrong}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.muted }}>
                <DollarSign style={{ width: 14, height: 14 }} />
                <span>Est. total cost</span>
              </div>
              {/* Live ticker — see lib/use-live-cost.ts. Replaces the static
                  fmtTotal with an integrator that interpolates forward from
                  the solve anchor at ~$230/min per delayed flight. */}
              <LiveCostDisplay plan={plan} size="md" />
            </div>

            {/* Pax delay */}
            <div style={{ borderRadius: r.md, padding: "8px 10px", border: `1px solid ${c.hairline}`, background: c.canvas }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.muted, marginBottom: 2 }}>
                <Users style={{ width: 12, height: 12 }} /> Pax·min
              </div>
              <div style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 13, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
                {((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K
              </div>
            </div>

            {/* FAR 117 */}
            <div style={{ borderRadius: r.md, padding: "8px 10px", border: `1px solid ${c.hairline}`, background: c.canvas }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.muted, marginBottom: 2 }}>
                <ShieldCheck style={{ width: 12, height: 12 }} /> FAR 117
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: plan.crew_violations > 0 ? c.statusDelayed.ink : c.statusOnTime.ink,
                }}
              >
                {plan.crew_violations > 0 ? `${plan.crew_violations} viol.` : "OK"}
              </div>
            </div>
          </div>

          {/* Action counts row — semantic palette pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: sp.sm, flexWrap: "wrap" }}>
            {cancelled > 0 && <CountChip kind="cancelled" Icon={X}      count={cancelled} label="cancelled" />}
            {delayed   > 0 && <CountChip kind="delayed"   Icon={Clock}  count={delayed}   label="delayed" />}
            {swaps     > 0 && <CountChip kind="recovered" Icon={Repeat2} count={swaps}    label="swaps" />}
            {cancelled === 0 && delayed === 0 && swaps === 0 && (
              <span style={{ fontSize: 11, color: c.statusOnTime.ink, fontWeight: 500 }}>
                No actions — schedule intact
              </span>
            )}
          </div>

          {/* Carbon mini-row — shows tCO₂e for every plan, regardless of objective.
              The Carbon dashboard route handles the deep analysis; this is just
              a glanceable line so the operator sees it on every card. */}
          {plan.total_co2_kg !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: sp.sm, fontSize: 11, color: c.muted, fontFamily: ff.mono }}>
              <Leaf style={{ width: 11, height: 11, color: c.signatureForest }} />
              <span style={{ color: plan.total_co2_kg < 0 ? c.statusRecovered.ink : c.statusDelayed.ink, fontWeight: 600 }}>
                {plan.total_co2_kg >= 0 ? "+" : ""}{(plan.total_co2_kg / 1000).toFixed(2)} tCO₂e
              </span>
              {plan.eu_ets_cost_usd ? (
                <span>· ${(plan.eu_ets_cost_usd / 1000).toFixed(1)}K EU ETS</span>
              ) : null}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: sp.xs }}>
            <button
              onClick={onApply}
              style={{
                flex: 1,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: ff.body,
                borderRadius: r.md,
                border: isApplied ? `1px solid ${c.borderStrong}` : `1px solid ${c.primary}`,
                background: isApplied ? "transparent" : c.primary,
                color: isApplied ? c.ink : c.onPrimary,
                cursor: "pointer",
                transition: "background 150ms ease",
              }}
            >
              {isApplied ? <><X style={{ width: 13, height: 13 }} strokeWidth={1.75} /> Unapply</> : <><Play style={{ width: 13, height: 13 }} strokeWidth={1.75} /> Apply</>}
            </button>
            <ButtonSecondary
              size="sm"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
              leadingIcon={expanded ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
            >
              {expanded ? "Less" : "More"}
            </ButtonSecondary>
          </div>

          {/* Deep-link to the dedicated plan-detail page where the user gets
              the full counterfactual explainer + per-flight ledgers. */}
          <Link
            href={`/simulator/plans/${plan.plan_id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 8,
              fontSize: 11,
              color: c.link,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Open plan detail <ArrowRight style={{ width: 11, height: 11 }} />
          </Link>
        </div>
      </div>

      {/* ── Expanded detail panel ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                margin: `0 ${sp.xs}px ${sp.xs}px`,
                borderRadius: r.md,
                padding: sp.md,
                display: "flex",
                flexDirection: "column",
                gap: sp.md,
                background: c.surfaceSoft,
                border: `1px solid ${c.hairline}`,
              }}
            >

              {/* Narrative — strategy summary */}
              <div>
                <Eyebrow>Strategy</Eyebrow>
                <p style={{ ...type("bodyMd", c.body), marginTop: 6, fontSize: 12, lineHeight: 1.55 }}>
                  {narrative}
                </p>
              </div>

              {/* Cost breakdown bars */}
              {cb && cb.grand_total_usd > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <TrendingDown style={{ width: 14, height: 14, color: c.muted }} />
                    <Eyebrow>Cost breakdown</Eyebrow>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
                    <CostBar label="Cancellation costs (rev. loss + rebook + DOT 261)" value={cb.cancellation_total_usd} total={cb.grand_total_usd} color={c.borderStrong} />
                    <CostBar label="Delay costs (ops + crew OT + pax value-of-time)"     value={cb.delay_total_usd}        total={cb.grand_total_usd} color={c.amber} />
                    <CostBar label="Aircraft repositioning"                                value={cb.reposition_cost_usd}    total={cb.grand_total_usd} color={c.teal} />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: sp.sm,
                      borderRadius: r.md,
                      padding: "8px 12px",
                      background: c.surfaceSoft,
                      color: c.ink,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Total estimated impact</span>
                    <span style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                      {fmtTotal}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: c.muted, marginTop: 6 }}>
                    DOT BTS 2023 rates · $82.50/pax-hr delay · DOT Form 41 block-hour ops
                  </p>
                </div>
              )}

              {/* Operational impact summary */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <AlertTriangle style={{ width: 14, height: 14, color: c.muted }} />
                  <Eyebrow>Operational impact</Eyebrow>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: sp.xs }}>
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
              </div>

              {/* Cancelled flights list */}
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
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: r.sm,
                            background: c.statusCancelled.bg,
                            color: c.statusCancelled.ink,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontFamily: ff.mono, fontWeight: 500 }}>{fid}</span>
                          {route.codes && (
                            <span style={{ fontFamily: ff.mono, opacity: 0.75 }}>{route.codes}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Delayed flights list */}
              {delayed > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    <Clock style={{ width: 12, height: 12, color: c.statusDelayed.ink }} />
                    <Eyebrow>Delays ({delayed})</Eyebrow>
                  </div>
                  <div style={{ maxHeight: 112, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                    {plan.delayed_flights.slice(0, 30).map((d: any) => {
                      const route = flightRoute(d.flight_id)
                      return (
                        <div
                          key={d.flight_id}
                          title={route.cities || route.codes || d.flight_id}
                          onClick={() => onFlightSelect(d.flight_id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: sp.xs,
                            fontSize: 11,
                            borderRadius: r.sm,
                            padding: "4px 8px",
                            cursor: "pointer",
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
                    {delayed > 30 && (
                      <p style={{ fontSize: 10, color: c.muted, padding: "2px 8px" }}>+{delayed - 30} more…</p>
                    )}
                  </div>
                </div>
              )}

              {/* Aircraft swaps list — annotate every tail with its type */}
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
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            fontSize: 11,
                            background: c.canvas,
                            border: `1px solid ${c.hairline}`,
                            borderRadius: r.sm,
                            padding: "6px 8px",
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

              {cancelled === 0 && delayed === 0 && swaps === 0 && (
                <p style={{ ...type("bodyMd", c.muted), fontStyle: "italic" }}>
                  No flight actions required — the schedule remains intact.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function CountChip({
  kind,
  Icon,
  count,
  label,
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
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: r.pill,
        background: palette.bg,
        color: palette.ink,
        fontFamily: ff.body,
      }}
    >
      <Icon style={{ width: 12, height: 12 }} /> {count} {label}
    </span>
  )
}

function ImpactCell({
  Icon,
  label,
  valueOk,
  valueText,
  mono = false,
}: {
  Icon: typeof UserCheck
  label: string
  valueOk: boolean
  valueText: string
  mono?: boolean
}) {
  return (
    <div
      style={{
        borderRadius: r.sm,
        padding: "8px 10px",
        border: `1px solid ${c.hairline}`,
        background: c.canvas,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.muted, marginBottom: 2 }}>
        <Icon style={{ width: 12, height: 12 }} /> {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
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

  // True empty-state: no disruption at all. Avoids flashing "Awaiting"
  // during the brief window between page mount and WS snapshot arrival.
  if (!hasDisruption && recoveryPlans.length === 0) {
    // ─── Empty state — Complaint 2 fix: cream-callout band, not decorative sparkle ───
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

      <div style={{ flex: 1, overflowY: "auto", padding: sp.sm, display: "flex", flexDirection: "column", gap: sp.sm }}>
        {recoveryPlans.map((plan: any, i: number) => (
          <PlanCard
            key={plan.plan_id}
            plan={plan}
            index={i}
            isSelected={selectedFlight === plan.plan_id}
            isApplied={appliedPlanId === plan.plan_id}
            onClick={() => {}}
            onApply={(e) => {
              e.stopPropagation()
              applyPlan(appliedPlanId === plan.plan_id ? null : plan.plan_id)
            }}
            onFlightSelect={(id) => onFlightSelect(id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Panel header — used by every right-rail panel ────────────────────────
// Replaces the old `panel-header` + `section-title` pair with token-driven
// typography. White canvas, hairline bottom border, ink wordmark.

function PanelHeader({
  Icon,
  title,
  subtitle,
}: {
  Icon: typeof Activity
  title: string
  subtitle: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: sp.sm,
        padding: `${sp.sm}px ${sp.md}px`,
        background: c.canvas,
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: r.sm,
          background: c.surfaceSoft,
          border: `1px solid ${c.hairline}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
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

// Public re-export of the unused `Sparkles` import dropped from the original
// empty state — kept available so existing imports in other files don't break.
// (Sparkles was only referenced inside the previous empty state.)
export { Sparkles }
