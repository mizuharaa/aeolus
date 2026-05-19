"use client"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Activity, ArrowRight, CheckCircle2, AlertCircle, Clock, Leaf,
  DollarSign, Users, ShieldCheck, Repeat2, X, Plane,
} from "lucide-react"
import { useSimulationStore, useHasActiveDisruption, type RecoveryPlan } from "@/stores/simulation"
import { c, ff, r, sp, sh, type as typeStyle } from "@/lib/design-tokens"
import { Eyebrow, ButtonSecondary, ButtonPrimary, ContentCard } from "@/components/ds/primitives"
import { SimulatorPageShell, NoActiveDisruptionState } from "@/components/simulator/page-shell"

// Plan signature colors — same palette used in recovery-plans.tsx so a card on
// this index page reads as "the same plan" as on the right-rail.
const PLAN_META: Record<string, { label: string; sublabel: string; accent: string; surface: string; ink: string; Icon: typeof Leaf }> = {
  A: { label: "Minimize Cost",         sublabel: "Lowest financial exposure",       accent: c.signatureMustard, surface: c.signatureCream,    ink: "#5C3D0F",         Icon: DollarSign },
  B: { label: "Min. Pax Impact",       sublabel: "Best passenger experience",       accent: c.signatureMint,    surface: c.statusRecovered.bg, ink: c.signatureForest, Icon: Users },
  C: { label: "Protect Tomorrow",      sublabel: "Minimizes next-day cascades",     accent: c.signaturePeach,   surface: c.statusDelayed.bg,  ink: c.statusDelayed.ink, Icon: ShieldCheck },
  D: { label: "Green Recovery",        sublabel: "Lowest CO\u2082 footprint (EU ETS)", accent: c.signatureForest,  surface: c.statusOnTime.bg,    ink: c.signatureForest, Icon: Leaf },
}

const STATUS_TONE: Record<string, { ink: string; bg: string }> = {
  optimal:    { ink: c.statusOnTime.ink,    bg: c.statusOnTime.bg },
  feasible:   { ink: c.statusRecovered.ink, bg: c.statusRecovered.bg },
  heuristic:  { ink: c.statusDelayed.ink,   bg: c.statusDelayed.bg },
  infeasible: { ink: c.statusCancelled.ink, bg: c.statusCancelled.bg },
}

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtTons(co2_kg: number | undefined) {
  if (!co2_kg && co2_kg !== 0) return "—"
  const t = co2_kg / 1000
  return `${t >= 0 ? "+" : ""}${t.toFixed(1)} tCO\u2082e`
}

export default function PlansIndexPage() {
  const { recoveryPlans, appliedPlanId, applyPlan, cascadeSummary } = useSimulationStore()
  const hasDisruption = useHasActiveDisruption()

  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Recovery plans" },
      ]}
      title="Recovery plans"
      subtitle={
        cascadeSummary
          ? `${cascadeSummary.total_affected} flights affected · ${cascadeSummary.directly_affected} direct hits · ${(cascadeSummary.cascade_1 || 0) + (cascadeSummary.cascade_2 || 0)} downstream cascade`
          : "Four differentiated strategies — minimize cost, minimize pax impact, protect tomorrow, minimize CO\u2082."
      }
      actions={
        recoveryPlans.length >= 2 ? (
          <Link href="/simulator/plans/compare" style={{ textDecoration: "none" }}>
            <ButtonSecondary>Compare plans</ButtonSecondary>
          </Link>
        ) : null
      }
    >
      {!hasDisruption ? (
        <NoActiveDisruptionState
          title="No recovery plans yet."
          description="Trigger a disruption from the simulator to receive four ranked plans, each with full cost decomposition, FAR 117 flags, and a CO\u2082 ledger."
        />
      ) : recoveryPlans.length === 0 ? (
        // Disruption active, plans still resolving \u2014 keep the empty state from
        // flashing while the snapshot lands.
        <ContentCard padding={sp.xl} style={{ textAlign: "center" }}>
          <Eyebrow color={c.signatureForest}>Solving</Eyebrow>
          <div style={{ marginTop: 8, fontFamily: ff.body, fontSize: 14, color: c.body }}>
            Generating recovery plans for the active disruption&hellip;
          </div>
        </ContentCard>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: sp.md,
          }}
        >
          {recoveryPlans.map((plan, i) => (
            <PlanCard
              key={plan.plan_id}
              plan={plan}
              isApplied={appliedPlanId === plan.plan_id}
              onApply={() => applyPlan(appliedPlanId === plan.plan_id ? null : plan.plan_id)}
              index={i}
            />
          ))}
        </div>
      )}
    </SimulatorPageShell>
  )
}

function PlanCard({
  plan, isApplied, onApply, index,
}: {
  plan: RecoveryPlan
  isApplied: boolean
  onApply: () => void
  index: number
}) {
  const meta = PLAN_META[plan.plan_id] || PLAN_META.A
  const cancelled = plan.cancelled_flights?.length || 0
  const delayed   = plan.delayed_flights?.length   || 0
  const swaps     = plan.aircraft_swaps?.length    || 0
  const totalCost = plan.cost_breakdown?.grand_total_usd || plan.total_cost_usd || 0
  const tone = STATUS_TONE[plan.status] || STATUS_TONE.heuristic

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <ContentCard
        padding={0}
        style={{
          background: isApplied ? meta.surface : c.canvas,
          border: `1px solid ${isApplied ? meta.accent : c.hairline}`,
          boxShadow: isApplied ? sh.cardElev : sh.cardSoft,
          overflow: "hidden",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Accent strip + header */}
        <div style={{ display: "flex" }}>
          <div style={{ width: 4, background: meta.accent, flexShrink: 0 }} />
          <div style={{ flex: 1, padding: sp.lg }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.xs }}>
              <div>
                <Eyebrow color={meta.ink}>Plan {plan.plan_id}</Eyebrow>
                <div style={{ ...typeStyle("titleMd", c.ink), marginTop: 6, fontWeight: 500 }}>{meta.label}</div>
                <div style={{ ...typeStyle("bodyMd", c.muted), fontSize: 13, marginTop: 2 }}>{meta.sublabel}</div>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "3px 9px",
                  borderRadius: r.pill,
                  background: tone.bg,
                  color: tone.ink,
                  fontFamily: ff.body,
                }}
              >
                {plan.status === "optimal" ? <CheckCircle2 style={{ width: 11, height: 11 }} /> :
                 plan.status === "infeasible" ? <AlertCircle style={{ width: 11, height: 11 }} /> :
                 <Clock style={{ width: 11, height: 11 }} />}
                {plan.status}
              </span>
            </div>

            {/* Total cost — signature surface */}
            <div
              style={{
                marginTop: sp.md,
                borderRadius: r.md,
                padding: "12px 14px",
                background: meta.surface,
                color: meta.ink,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.8 }}>
                <DollarSign style={{ width: 14, height: 14 }} /> Estimated impact
              </span>
              <span style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
                {fmt$(totalCost)}
              </span>
            </div>

            {/* Metrics row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: sp.xs, marginTop: sp.sm }}>
              <Metric Icon={Users}      label="Pax-min"  value={`${((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K`} />
              <Metric Icon={ShieldCheck} label="FAR 117" value={plan.crew_violations > 0 ? `${plan.crew_violations} viol.` : "OK"} ok={plan.crew_violations === 0} />
              <Metric Icon={Leaf}        label="Carbon" value={fmtTons(plan.total_co2_kg)} subtitle={plan.eu_ets_cost_usd ? `${fmt$(plan.eu_ets_cost_usd)} ETS` : undefined} />
              <Metric Icon={Clock}       label="Solve"   value={plan.solve_time_ms > 0 ? `${plan.solve_time_ms}ms` : "—"} mono />
            </div>

            {/* Action chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: sp.md }}>
              {cancelled > 0 && <Chip Icon={X}      kind="cancelled" label={`${cancelled} cancelled`} />}
              {delayed   > 0 && <Chip Icon={Clock}  kind="delayed"   label={`${delayed} delayed`} />}
              {swaps     > 0 && <Chip Icon={Repeat2} kind="recovered" label={`${swaps} swaps`} />}
              {cancelled === 0 && delayed === 0 && swaps === 0 && (
                <span style={{ fontSize: 12, color: c.statusOnTime.ink, fontWeight: 500 }}>
                  No actions — schedule intact
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            marginTop: "auto",
            padding: `${sp.sm}px ${sp.lg}px ${sp.md}px`,
            borderTop: `1px solid ${c.hairline}`,
            display: "flex",
            alignItems: "center",
            gap: sp.xs,
          }}
        >
          <Link
            href={`/simulator/plans/${plan.plan_id}`}
            style={{ flex: 1, textDecoration: "none" }}
          >
            <ButtonSecondary
              size="sm"
              trailingIcon={<ArrowRight style={{ width: 13, height: 13 }} />}
              style={{ width: "100%" }}
            >
              Open plan detail
            </ButtonSecondary>
          </Link>
          <ButtonPrimary size="sm" onClick={onApply}>
            {isApplied ? "Unapply" : "Apply"}
          </ButtonPrimary>
        </div>
      </ContentCard>
    </motion.div>
  )
}

function Metric({
  Icon,
  label,
  value,
  subtitle,
  ok,
  mono = false,
}: {
  Icon: typeof DollarSign
  label: string
  value: string
  subtitle?: string
  ok?: boolean
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
          fontSize: 13,
          fontWeight: 500,
          color: ok === false ? c.statusCancelled.ink : ok === true ? c.statusOnTime.ink : c.ink,
          fontFamily: mono ? ff.mono : ff.body,
          fontVariantNumeric: mono ? "tabular-nums" : undefined,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: c.muted, marginTop: 2, fontFamily: ff.mono }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function Chip({
  Icon,
  kind,
  label,
}: {
  Icon: typeof X
  kind: "cancelled" | "delayed" | "recovered"
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
        padding: "3px 9px",
        borderRadius: r.pill,
        background: palette.bg,
        color: palette.ink,
        fontFamily: ff.body,
      }}
    >
      <Icon style={{ width: 12, height: 12 }} /> {label}
    </span>
  )
}
