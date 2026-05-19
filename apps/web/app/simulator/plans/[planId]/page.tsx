"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowRight, DollarSign, Users, ShieldCheck, Leaf, Clock, Repeat2,
  X, Plane, GitBranch, Sparkles, AlertTriangle, RotateCcw, TrendingUp, TrendingDown,
} from "lucide-react"
import { useSimulationStore, useHasActiveDisruption, type RecoveryPlan } from "@/stores/simulation"
import { airportLabel, aircraftLabel } from "@/lib/labels"
import { apiClient } from "@/lib/api"
import { c, ff, r, sp, sh, type as typeStyle } from "@/lib/design-tokens"
import {
  ButtonSecondary, ButtonPrimary, ContentCard, Eyebrow, Type, CreamCallout,
} from "@/components/ds/primitives"
import { SimulatorPageShell, NoActiveDisruptionState } from "@/components/simulator/page-shell"

const PLAN_META: Record<string, { label: string; sublabel: string; accent: string; surface: string; ink: string }> = {
  A: { label: "Minimize Cost",    sublabel: "Lowest financial exposure",   accent: c.signatureMustard, surface: c.signatureCream,    ink: "#5C3D0F" },
  B: { label: "Min. Pax Impact",  sublabel: "Best passenger experience",   accent: c.signatureMint,    surface: c.statusRecovered.bg, ink: c.signatureForest },
  C: { label: "Protect Tomorrow", sublabel: "Minimizes next-day cascades", accent: c.signaturePeach,   surface: c.statusDelayed.bg,  ink: c.statusDelayed.ink },
  D: { label: "Green Recovery",   sublabel: "Lowest CO\u2082 footprint (EU ETS)", accent: c.signatureForest, surface: c.statusOnTime.bg, ink: c.signatureForest },
}

interface Counterfactual {
  flight_id: string
  flip: "cancel→keep" | "keep→cancel"
  delta_cost_usd: number
  delta_pax_delay_min: number
  delta_co2_kg: number
  delta_eu_ets_usd: number
  summary: string
}

interface ExplainResponse {
  plan_id: string
  base_cost_usd: number
  base_pax_delay_min: number
  base_co2_kg: number
  base_eu_ets_usd: number
  counterfactuals: Counterfactual[]
  rationale: string
}

function fmt$(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${n < 0 ? "-" : ""}$${Math.abs(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000)     return `${n < 0 ? "-" : ""}$${Math.abs(n / 1000).toFixed(1)}K`
  return `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`
}

export default function PlanDetailPage() {
  const params = useParams()
  const rawId = (params?.planId as string | undefined) ?? "A"
  const planId = rawId.toUpperCase()
  const { recoveryPlans, schedule, fleet, applyPlan, appliedPlanId } = useSimulationStore()
  const plan = recoveryPlans.find((p) => p.plan_id === planId) || null
  const meta = PLAN_META[planId] || PLAN_META.A
  const hasDisruption = useHasActiveDisruption()

  const [explain, setExplain] = useState<ExplainResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchExplain = async () => {
    if (!plan) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.post<ExplainResponse>("/recovery/explain", {
        plan_id: plan.plan_id,
        top_n: 6,
      })
      setExplain(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load counterfactuals.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (plan) {
      fetchExplain()
    }
  }, [plan?.plan_id])  // eslint-disable-line react-hooks/exhaustive-deps

  const flightRoute = useMemo(() => {
    return (fid: string) => {
      const f = schedule.find((x) => x.id === fid)
      if (!f) return { codes: "", cities: "" }
      const o = airportLabel(f.origin)
      const d = airportLabel(f.destination)
      return {
        codes: `${o.iata || f.origin} \u2192 ${d.iata || f.destination}`,
        cities: o.city && d.city ? `${o.city} \u2192 ${d.city}` : "",
      }
    }
  }, [schedule])

  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Recovery plans", href: "/simulator/plans" },
        { label: `Plan ${planId}` },
      ]}
      title={`Plan ${planId} — ${meta.label}`}
      subtitle={meta.sublabel}
      actions={
        plan ? (
          <>
            <ButtonSecondary
              onClick={fetchExplain}
              size="sm"
              leadingIcon={<RotateCcw style={{ width: 13, height: 13 }} />}
              disabled={loading}
            >
              {loading ? "Re-running…" : "Re-run counterfactuals"}
            </ButtonSecondary>
            <ButtonPrimary
              size="sm"
              onClick={() => applyPlan(appliedPlanId === plan.plan_id ? null : plan.plan_id)}
            >
              {appliedPlanId === plan.plan_id ? "Unapply" : "Apply this plan"}
            </ButtonPrimary>
          </>
        ) : null
      }
    >
      {!plan && !hasDisruption ? (
        <NoActiveDisruptionState
          title={`Plan ${planId} is not available yet.`}
          description="Trigger a disruption from the simulator first. Once the optimizer runs you can deep-link to any plan detail page."
        />
      ) : !plan ? (
        // Disruption is active but THIS plan ID isn't in the current solve.
        // Could be a stale deep link or a plan letter the optimizer didn't
        // emit. Surface that distinction instead of pretending no event ran.
        <CreamCallout>
          <Eyebrow color={c.signatureForest}>Plan {planId} not in current solve</Eyebrow>
          <Type as="p" role="bodyMd" color={c.body} style={{ marginTop: 8, marginBottom: 12 }}>
            A disruption is active and {recoveryPlans.length} plan{recoveryPlans.length === 1 ? "" : "s"} {recoveryPlans.length === 1 ? "is" : "are"} available — but
            Plan {planId} isn&rsquo;t one of them. Re-trigger the event if you expected this plan letter,
            or jump to one of the available plans below.
          </Type>
          <div style={{ display: "flex", gap: sp.xs, flexWrap: "wrap" }}>
            {recoveryPlans.map((p) => (
              <Link key={p.plan_id} href={`/simulator/plans/${p.plan_id}`} style={{ textDecoration: "none" }}>
                <ButtonSecondary size="sm">Plan {p.plan_id}</ButtonSecondary>
              </Link>
            ))}
          </div>
        </CreamCallout>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: sp.lg }}>

          {/* ── Header ledger card ──────────────────────────────────── */}
          <ContentCard
            padding={0}
            style={{
              background: meta.surface,
              border: `1px solid ${meta.accent}`,
              boxShadow: sh.cardSoft,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex" }}>
              <div style={{ width: 6, background: meta.accent, flexShrink: 0 }} />
              <div
                style={{
                  flex: 1,
                  padding: sp.lg,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: sp.lg,
                }}
              >
                <Ledger label="Estimated cost"  value={fmt$(plan.cost_breakdown?.grand_total_usd || plan.total_cost_usd || 0)} ink={meta.ink} />
                <Ledger label="Pax-minutes"     value={`${((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K`} ink={meta.ink} />
                <Ledger label="Net CO\u2082"     value={`${((plan.total_co2_kg || 0) / 1000).toFixed(1)} t`} ink={meta.ink} sub={plan.eu_ets_cost_usd ? `${fmt$(plan.eu_ets_cost_usd)} EU ETS` : undefined} />
                <Ledger label="FAR 117"         value={plan.crew_violations > 0 ? `${plan.crew_violations} flags` : "Compliant"} ink={meta.ink} ok={plan.crew_violations === 0} />
                <Ledger label="Solve time"      value={plan.solve_time_ms > 0 ? `${plan.solve_time_ms} ms` : "—"} ink={meta.ink} mono />
              </div>
            </div>
          </ContentCard>

          {/* ── Two-column layout: counterfactuals (left) + actions list (right) ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
              gap: sp.lg,
            }}
          >
            {/* LEFT — counterfactual explainer */}
            <div style={{ display: "flex", flexDirection: "column", gap: sp.md }}>

              {/* Rationale callout */}
              {explain?.rationale && (
                <CreamCallout>
                  <Eyebrow color={c.signatureForest}>Why this plan?</Eyebrow>
                  <Type as="p" role="bodyMd" color={c.body} style={{ marginTop: 8, lineHeight: 1.6, fontSize: 14 }}>
                    {explain.rationale}
                  </Type>
                </CreamCallout>
              )}

              {/* Counterfactual list */}
              <ContentCard padding={sp.lg}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sp.md }}>
                  <GitBranch style={{ width: 16, height: 16, color: c.muted }} />
                  <Type as="h2" role="titleSm" color={c.ink}>What if we flipped a single decision?</Type>
                </div>
                <Type as="p" role="bodyMd" color={c.muted} style={{ marginTop: -8, marginBottom: sp.md, fontSize: 13, lineHeight: 1.55 }}>
                  Each row re-runs the cost and carbon engines with one decision inverted, so you can see the marginal trade-off shape behind every plan choice.
                </Type>

                {error && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: r.sm,
                      background: c.statusCancelled.bg,
                      color: c.statusCancelled.ink,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <AlertTriangle style={{ width: 14, height: 14 }} /> {error}
                  </div>
                )}

                {loading && !explain && (
                  <div style={{ padding: sp.lg, fontSize: 13, color: c.muted, fontFamily: ff.mono }}>
                    Running counterfactuals…
                  </div>
                )}

                {explain && explain.counterfactuals.length === 0 && (
                  <div style={{ padding: sp.md, fontSize: 13, color: c.muted }}>
                    No flips evaluated — this plan has no actionable decisions to invert.
                  </div>
                )}

                {explain && explain.counterfactuals.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {explain.counterfactuals.map((cf, i) => (
                      <CounterfactualRow
                        key={`${cf.flight_id}-${i}`}
                        cf={cf}
                        route={flightRoute(cf.flight_id)}
                      />
                    ))}
                  </div>
                )}
              </ContentCard>
            </div>

            {/* RIGHT — actions list */}
            <div style={{ display: "flex", flexDirection: "column", gap: sp.md }}>
              <ActionsCard
                title="Cancellations"
                Icon={X}
                accent={c.signatureCoral}
                count={plan.cancelled_flights?.length || 0}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(plan.cancelled_flights || []).slice(0, 30).map((fid) => {
                    const route = flightRoute(fid)
                    return (
                      <div
                        key={fid}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          borderRadius: r.sm,
                          background: c.statusCancelled.bg,
                          color: c.statusCancelled.ink,
                          fontSize: 12,
                          fontFamily: ff.mono,
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{fid}</span>
                        <span style={{ opacity: 0.75 }}>{route.codes}</span>
                      </div>
                    )
                  })}
                </div>
              </ActionsCard>

              <ActionsCard
                title="Delays"
                Icon={Clock}
                accent={c.signaturePeach}
                count={plan.delayed_flights?.length || 0}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                  {(plan.delayed_flights || []).slice(0, 50).map((d) => {
                    const route = flightRoute(d.flight_id)
                    return (
                      <div
                        key={d.flight_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: sp.xs,
                          padding: "5px 8px",
                          fontSize: 12,
                          fontFamily: ff.mono,
                        }}
                      >
                        <span style={{ minWidth: 0, flex: 1, color: c.body }}>
                          {d.flight_id} <span style={{ color: c.muted }}>{route.codes}</span>
                        </span>
                        <span style={{ color: c.statusDelayed.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          +{d.delay_minutes}m
                        </span>
                      </div>
                    )
                  })}
                </div>
              </ActionsCard>

              <ActionsCard
                title="Aircraft swaps"
                Icon={Repeat2}
                accent={c.link}
                count={plan.aircraft_swaps?.length || 0}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(plan.aircraft_swaps || []).map((s, i) => {
                    const oldAc = aircraftLabel(s.old_aircraft, fleet)
                    const newAc = aircraftLabel(s.new_aircraft, fleet)
                    const route = flightRoute(s.flight_id)
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "8px 10px",
                          borderRadius: r.sm,
                          border: `1px solid ${c.hairline}`,
                          fontSize: 12,
                          fontFamily: ff.mono,
                          background: c.canvas,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", color: c.body }}>
                          <span style={{ fontWeight: 500 }}>{s.flight_id}</span>
                          <span style={{ color: c.muted }}>{route.codes}</span>
                        </div>
                        <div style={{ marginTop: 4, color: c.muted }}>
                          <span style={{ color: c.statusCancelled.ink }}>{oldAc.tail || s.old_aircraft}</span>
                          {" \u2192 "}
                          <span style={{ color: c.statusOnTime.ink }}>{newAc.tail || s.new_aircraft}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ActionsCard>
            </div>
          </div>
        </div>
      )}
    </SimulatorPageShell>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Ledger({
  label, value, sub, ink, ok, mono = false,
}: { label: string; value: string; sub?: string; ink: string; ok?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: ink, opacity: 0.65 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? ff.mono : ff.display,
          fontWeight: mono ? 500 : 400,
          fontSize: 28,
          lineHeight: 1.15,
          color: ok === false ? c.signatureCoral : ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: ink, opacity: 0.7, fontFamily: ff.mono }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function ActionsCard({
  title, Icon, accent, count, children,
}: {
  title: string
  Icon: typeof X
  accent: string
  count: number
  children: React.ReactNode
}) {
  return (
    <ContentCard padding={sp.md}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sp.sm }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: r.sm,
            background: c.surfaceSoft,
            border: `1px solid ${c.hairline}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: accent,
          }}
        >
          <Icon style={{ width: 13, height: 13 }} />
        </span>
        <div style={{ flex: 1 }}>
          <Type as="h3" role="titleSm" color={c.ink} style={{ fontSize: 14 }}>
            {title}
          </Type>
          <span style={{ fontSize: 11, color: c.muted, fontFamily: ff.mono }}>{count} action{count !== 1 ? "s" : ""}</span>
        </div>
      </div>
      {count > 0 ? children : (
        <div style={{ fontSize: 12, color: c.muted, fontStyle: "italic" }}>
          No {title.toLowerCase()} required.
        </div>
      )}
    </ContentCard>
  )
}

function CounterfactualRow({
  cf, route,
}: {
  cf: Counterfactual
  route: { codes: string; cities: string }
}) {
  const isSavings = cf.delta_cost_usd < 0
  const flipLabel = cf.flip === "cancel→keep" ? "Keep this flight" : "Cancel this flight"
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.5fr) repeat(3, minmax(0, 1fr))",
        gap: sp.sm,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: r.sm,
        border: `1px solid ${c.hairline}`,
        background: c.canvas,
        fontFamily: ff.body,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: ff.mono, fontWeight: 500, fontSize: 13, color: c.ink }}>{cf.flight_id}</span>
          {route.codes && <span style={{ fontFamily: ff.mono, fontSize: 11, color: c.muted }}>{route.codes}</span>}
        </div>
        <span
          style={{
            fontSize: 11,
            color: c.muted,
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {flipLabel}
        </span>
      </div>
      <Delta label="Cost"        value={fmt$(cf.delta_cost_usd)}                    positive={cf.delta_cost_usd < 0} />
      <Delta label="Pax-min"     value={`${cf.delta_pax_delay_min >= 0 ? "+" : ""}${cf.delta_pax_delay_min.toLocaleString()}`} positive={cf.delta_pax_delay_min < 0} />
      <Delta label="CO\u2082"     value={`${cf.delta_co2_kg >= 0 ? "+" : ""}${(cf.delta_co2_kg / 1000).toFixed(1)} t`}            positive={cf.delta_co2_kg < 0} />
    </motion.div>
  )
}

function Delta({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  const Icon = positive ? TrendingDown : TrendingUp
  const ink  = positive ? c.statusOnTime.ink : c.statusCancelled.ink
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: c.muted }}>
        {label}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: ff.mono,
          fontWeight: 600,
          fontSize: 13,
          color: ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <Icon style={{ width: 12, height: 12 }} /> {value}
      </span>
    </div>
  )
}
