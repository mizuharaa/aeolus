"use client"
/**
 * RECOVERY PLANS — /simulator/plans.
 *
 * Rebuilt 2026-08-17. Direction contract: the HTML comment at the top of
 * `app/layout.tsx` (seed 688f3053).
 *
 * ── What was here ────────────────────────────────────────────────────────
 *
 * A responsive grid of four cards. Each card held a bordered "Estimated
 * impact" strip, a 2×2 grid of four MORE bordered metric boxes, a row of
 * filled pills, and a footer with a black Apply button. Three levels of
 * nesting, four coloured left-borders, and — because all four objectives
 * frequently converge — four visually identical objects side by side.
 *
 * Two things were wrong with it, and only one is taste:
 *
 *   1. It is a COMPARISON page whose layout forbids comparing. Reading
 *      "which of these costs least" meant finding the cost figure at four
 *      different vertical positions inside four different boxes. The metric
 *      the operator came for was never on a shared baseline.
 *   2. Nested cards. A card containing cards containing figures, each box
 *      drawing a border that encodes nothing.
 *
 * ── What replaced it ─────────────────────────────────────────────────────
 *
 * The same ruled grid the console uses in its compare region: plans are
 * COLUMNS, metrics are ROWS, figures share a baseline. This page and the
 * in-console surface are now one idea at two widths, rather than two designs
 * for the same decision.
 *
 * The live cost ticker was dropped here on purpose. It interpolates a rising
 * dollar figure, which is a second, animated cost vocabulary competing with
 * the static one in the same cell — and the burn rate it conveys is already
 * on the board bar, permanently, where an uncommitted disruption belongs.
 */

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { useSimulationStore, useHasActiveDisruption, type RecoveryPlan } from "@/stores/simulation"
import { planMeta } from "@/lib/plan-meta"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { SimulatorPageShell, NoActiveDisruptionState } from "@/components/simulator/page-shell"
import { RULE, Module, Figure, Mark, Chip } from "@/components/simulator/board"

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${Math.round(n)}`

type Row = {
  key: string
  label: string
  render: (p: RecoveryPlan) => string
  value: (p: RecoveryPlan) => number
  rank: "lower" | null
  note?: string
  anchor?: boolean
}

/** Identical editorial rule to the in-console grid: only Cost and FAR 117 are
 *  ranked, because cancelling a flight drives Pax·min, tCO₂e and Cancels all
 *  down at once and ranking them crowns the most destructive plan. */
const ROWS: Row[] = [
  {
    key: "cost", label: "Cost", anchor: true, rank: "lower",
    value: (p) => p.cost_breakdown?.grand_total_usd ?? p.total_cost_usd,
    render: (p) => usd(p.cost_breakdown?.grand_total_usd ?? p.total_cost_usd),
  },
  {
    key: "pax", label: "Pax·min", rank: null,
    note: "Reported, not ranked — cancelling a flight drives passenger-delay minutes down.",
    value: (p) => p.total_passenger_delay_minutes,
    render: (p) => `${(p.total_passenger_delay_minutes / 1000).toFixed(1)}K`,
  },
  {
    key: "far117", label: "FAR 117", rank: "lower",
    value: (p) => p.crew_violations,
    render: (p) => String(p.crew_violations),
  },
  {
    key: "co2", label: "tCO₂e", rank: null,
    note: "Reported, not ranked — a cancelled flight burns no fuel.",
    value: (p) => (p.total_co2_kg ?? 0) / 1000,
    render: (p) => {
      const t = (p.total_co2_kg ?? 0) / 1000
      return `${t >= 0 ? "+" : ""}${t.toFixed(1)}`
    },
  },
  {
    key: "ets", label: "EU ETS", rank: null,
    value: (p) => p.eu_ets_cost_usd ?? 0,
    render: (p) => (p.eu_ets_cost_usd ? usd(p.eu_ets_cost_usd) : "—"),
  },
  {
    key: "cancels", label: "Cancels", rank: null,
    note: "Reported, not ranked — fewer cancellations is not automatically the better recovery.",
    value: (p) => p.cancelled_flights.length,
    render: (p) => String(p.cancelled_flights.length),
  },
  {
    key: "delays", label: "Delays", rank: null,
    value: (p) => p.delayed_flights.length,
    render: (p) => String(p.delayed_flights.length),
  },
  {
    key: "swaps", label: "Swaps", rank: null,
    value: (p) => p.aircraft_swaps.length,
    render: (p) => String(p.aircraft_swaps.length),
  },
]

export default function PlansIndexPage() {
  const { recoveryPlans, appliedPlanId, applyPlan, cascadeSummary } = useSimulationStore()
  const hasDisruption = useHasActiveDisruption()
  const reduce = useReducedMotion()
  // Which plan's Apply is armed. One at a time — arming a second disarms the
  // first, so there is never more than one pending irreversible action.
  const [armedId, setArmedId] = useState<string | null>(null)

  const plans = recoveryPlans
  const converged =
    plans.length > 1 && ROWS.every((row) => {
      const first = row.value(plans[0])
      return plans.every((p) => Math.abs(row.value(p) - first) < 0.005)
    })

  const bestByRow: Record<string, number | null> = {}
  for (const row of ROWS) {
    if (row.rank !== "lower" || converged || plans.length === 0) { bestByRow[row.key] = null; continue }
    const values = plans.map(row.value)
    const min = Math.min(...values)
    bestByRow[row.key] = values.filter((v) => v === min).length === values.length ? null : min
  }

  const cols = `128px repeat(${Math.max(plans.length, 1)}, minmax(150px, 1fr))`

  return (
    <SimulatorPageShell
      breadcrumbs={[{ label: "Simulator", href: "/simulator" }, { label: "Recovery plans" }]}
      title="Recovery plans"
      subtitle={
        cascadeSummary
          ? `${cascadeSummary.total_affected} flights affected · ${cascadeSummary.directly_affected} direct · ${(cascadeSummary.cascade_1 || 0) + (cascadeSummary.cascade_2 || 0)} downstream cascade`
          : "Four objectives solved against the same disruption — cost, passenger impact, tomorrow's schedule, carbon."
      }
      maxWidth={1180}
    >
      {!hasDisruption ? (
        <NoActiveDisruptionState
          title="No recovery plans yet."
          description="Trigger a disruption from the Events tab in the simulator. Four objectives are solved against it — cost, passenger impact, tomorrow's schedule and carbon — each with a full cost decomposition, FAR 117 flags and a CO₂ ledger."
        />
      ) : plans.length === 0 ? (
        <Module title="Solving" style={{ border: RULE, borderRadius: r.sm }} bodyStyle={{ overflow: "visible" }}>
          <p style={{ margin: 0, padding: sp.md, fontFamily: ff.body, fontSize: 13, color: c.body }}>
            Generating recovery plans for the active disruption…
          </p>
        </Module>
      ) : (
        <Module
          title="Plans compared"
          fringe="spectral"
          style={{ border: RULE, borderRadius: r.sm }}
          bodyStyle={{ overflow: "auto" }}
          action={
            <span style={{ fontFamily: ff.mono, fontSize: 10.5, color: c.muted }}>
              {plans.length} objectives
            </span>
          }
        >
          {converged && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: sp.xs, flexWrap: "wrap",
                padding: `${sp.xs}px ${sp.sm}px`, borderBottom: RULE, background: c.surfaceSoft,
              }}
            >
              <Chip tone="amber">CONVERGED</Chip>
              <span style={{ fontFamily: ff.body, fontSize: 12.5, color: c.amberInk }}>
                All {plans.length} objectives return the same plan — there is no trade-off to make here.
              </span>
            </div>
          )}

          <div role="table" aria-label="Recovery plans compared across metrics" style={{ minWidth: 680 }}>
            {/* Plan heads */}
            <div role="row" style={{ display: "grid", gridTemplateColumns: cols, borderBottom: RULE, background: c.surfaceSoft }}>
              <div role="columnheader" style={{ borderRight: RULE }} />
              {plans.map((p) => {
                const meta = planMeta(p.plan_id)
                const applied = appliedPlanId === p.plan_id
                return (
                  <div role="columnheader" key={p.plan_id} style={{ padding: `${sp.xs}px ${sp.sm}px`, borderRight: RULE }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: ff.mono, fontSize: 15, fontWeight: 700, color: c.ink, lineHeight: 1 }}>
                        {p.plan_id}
                      </span>
                      <span style={{ fontFamily: ff.body, fontSize: 12.5, fontWeight: 650, color: c.ink }}>
                        {p.objective_label}
                      </span>
                      {applied && <span style={{ marginLeft: "auto" }}><Mark kind="applied" /></span>}
                    </div>
                    <div style={{ marginTop: 2, fontFamily: ff.body, fontSize: 11, color: c.muted }}>
                      {meta.sublabel}
                    </div>
                    {p.status !== "optimal" && (
                      <div style={{ marginTop: 4 }}><Chip tone="amber">{p.status.toUpperCase()}</Chip></div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Metric rows */}
            {ROWS.map((row, i) => {
              const best = bestByRow[row.key]
              const anchor = !!row.anchor
              return (
                <motion.div
                  role="row"
                  key={row.key}
                  {...(reduce
                    ? {}
                    : {
                        initial: { opacity: 0, y: -4 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.22, delay: 0.04 + i * 0.03, ease: [0.22, 0.9, 0.28, 1] as const },
                      })}
                  style={{
                    display: "grid",
                    gridTemplateColumns: cols,
                    borderBottom: anchor ? `1px solid ${c.borderStrong}` : RULE,
                  }}
                >
                  <div
                    role="rowheader"
                    title={row.note}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: `0 ${sp.sm}px`, height: anchor ? 42 : 32, borderRight: RULE,
                      background: c.surfaceSoft,
                      fontFamily: ff.mono, fontSize: 10.5,
                      fontWeight: anchor ? 700 : 600,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: anchor ? c.ink : c.muted,
                    }}
                  >
                    {row.label}
                    {row.rank === null && row.note && (
                      <abbr title={row.note} style={{ textDecoration: "none", color: c.borderStrong, cursor: "help" }}>*</abbr>
                    )}
                  </div>
                  {plans.map((p) => {
                    const isBest = best != null && row.value(p) === best
                    return (
                      <div
                        role="cell"
                        key={p.plan_id}
                        style={{
                          display: "flex", alignItems: "center",
                          height: anchor ? 42 : 32, padding: `0 ${sp.sm}px`, borderRight: RULE,
                          background: appliedPlanId === p.plan_id ? c.canvas : c.raised,
                        }}
                      >
                        <span
                          style={{
                            borderBottom: isBest ? `2px solid ${c.fringeMint}` : "2px solid transparent",
                            paddingBottom: 1,
                          }}
                        >
                          <Figure value={row.render(p)} size={anchor ? 18 : 13} tone={anchor ? "ink" : "muted"} />
                        </span>
                      </div>
                    )
                  })}
                </motion.div>
              )
            })}

            {/* Actions — one row, so the buttons line up like everything else */}
            <div role="row" style={{ display: "grid", gridTemplateColumns: cols }}>
              <div
                role="rowheader"
                style={{
                  display: "flex", alignItems: "center", padding: `0 ${sp.sm}px`,
                  minHeight: 48, borderRight: RULE, background: c.surfaceSoft,
                  fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase", color: c.muted,
                }}
              >
                Act
              </div>
              {plans.map((p) => {
                const applied = appliedPlanId === p.plan_id
                const isArmed = armedId === p.plan_id
                return (
                  <div
                    role="cell"
                    key={p.plan_id}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                      minHeight: 48, padding: `0 ${sp.sm}px`, borderRight: RULE,
                    }}
                  >
                    <Link
                      href={`/simulator/plans/${p.plan_id}` as Route}
                      className="ae-bar-btn"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        height: 30, padding: `0 ${sp.xs}px`, borderRadius: r.xs,
                        border: RULE, color: c.body, textDecoration: "none",
                        fontFamily: ff.body, fontSize: 12, fontWeight: 500,
                      }}
                    >
                      Detail
                      <ArrowRight aria-hidden style={{ width: 12, height: 12 }} strokeWidth={2} />
                    </Link>
                    {/* Apply is a HAIRLINE control, not a filled slab.
                        Four filled buttons in a row was the loudest thing on
                        the page and it made four equal options look like four
                        recommendations — and only ONE of them can be applied,
                        so three of those slabs were arguing for something the
                        operator cannot do twice.
                        It also ARMS before it fires: this mutates the live
                        schedule, and it was a single click on a control that
                        looks like an ordinary secondary button. The armed
                        state states the consequence rather than just changing
                        colour. */}
                    <button
                      type="button"
                      onClick={() => {
                        if (applied) { applyPlan(null); setArmedId(null); return }
                        if (!isArmed) { setArmedId(p.plan_id); return }
                        applyPlan(p.plan_id)
                        setArmedId(null)
                      }}
                      onKeyDown={(e) => { if (e.key === "Escape" && isArmed) { e.stopPropagation(); setArmedId(null) } }}
                      className="ae-bar-btn"
                      aria-label={
                        applied
                          ? `Unapply plan ${p.plan_id}`
                          : isArmed
                            ? `Confirm — apply plan ${p.plan_id}: ${p.delayed_flights.length} delays, ${p.cancelled_flights.length} cancellations, ${p.crew_violations} FAR 117 flags`
                            : `Apply plan ${p.plan_id} — asks for confirmation first`
                      }
                      style={{
                        height: 30, padding: `0 ${sp.xs}px`, borderRadius: r.xs,
                        border: `1px solid ${isArmed ? c.rose : c.borderStrong}`,
                        background: isArmed ? "var(--ae-rose-bg)" : "transparent",
                        color: isArmed ? c.roseInk : c.body,
                        fontFamily: ff.body, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {applied ? "Unapply" : isArmed ? "Confirm" : "Apply"}
                    </button>
                    {isArmed && !applied && (
                      <span role="alert" style={{ fontFamily: ff.body, fontSize: 11, color: c.roseInk, flexBasis: "100%" }}>
                        {p.delayed_flights.length} delays · {p.cancelled_flights.length} cancels ·{" "}
                        {p.crew_violations} FAR 117
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <p
            style={{
              margin: 0, padding: `${sp.xs}px ${sp.sm}px`, borderTop: RULE,
              fontFamily: ff.body, fontSize: 11.5, lineHeight: 1.5, color: c.muted, maxWidth: 780,
            }}
          >
            <strong style={{ color: c.body, fontWeight: 600 }}>Underline = best in row.</strong>{" "}
            Only Cost and FAR 117 are ranked. Rows marked{" "}
            <abbr title="Reported, not ranked" style={{ textDecoration: "none", color: c.borderStrong }}>*</abbr>{" "}
            are reported without a winner, because cancelling a flight drives all of them down at once.
          </p>
        </Module>
      )}
    </SimulatorPageShell>
  )
}
