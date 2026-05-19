"use client"
import { useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Leaf, ArrowRight, TrendingDown, TrendingUp, Plane } from "lucide-react"
import { useSimulationStore, useHasActiveDisruption, type RecoveryPlan } from "@/stores/simulation"
import { c, ff, r, sp, type as typeStyle } from "@/lib/design-tokens"
import { ContentCard, Eyebrow, Type, ButtonSecondary } from "@/components/ds/primitives"
import { SimulatorPageShell, NoActiveDisruptionState } from "@/components/simulator/page-shell"

// Plan presentation now reads from the canonical shared module so the
// carbon page, plans page, recovery-plans rail, and plan-compare all stay
// in lockstep on label/accent/surface decisions.
import { planMeta } from "@/lib/plan-meta"

function fmtTonnes(co2_kg: number) {
  const t = co2_kg / 1000
  return `${t >= 0 ? "+" : ""}${t.toFixed(2)} t`
}

function fmt$(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}

export default function CarbonPage() {
  const { recoveryPlans, appliedPlanId } = useSimulationStore()
  // `hasActiveDisruption` is the canonical predicate — it stays true even
  // during the brief window between page mount and WS snapshot arrival
  // (whereas `recoveryPlans.length === 0` flashed "Awaiting Disruption").
  const hasDisruption = useHasActiveDisruption()

  // Determine the greenest plan in the set so we can highlight it.
  const greenest = useMemo(() => {
    if (recoveryPlans.length === 0) return null
    return [...recoveryPlans].sort((a, b) =>
      (a.total_co2_kg ?? Infinity) - (b.total_co2_kg ?? Infinity),
    )[0]
  }, [recoveryPlans])

  const maxAbsCo2 = useMemo(() => {
    return Math.max(
      1,
      ...recoveryPlans.map((p) => Math.abs(p.total_co2_kg ?? 0)),
    )
  }, [recoveryPlans])

  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Carbon" },
      ]}
      title="Carbon dashboard"
      subtitle="Net CO\u2082 emissions and EU-ETS-priced cost for every recovery plan. Cancellations save fuel; ferries and delays burn it. Plan D explicitly minimises carbon."
      actions={
        recoveryPlans.length > 0 ? (
          <Link href="/simulator/plans" style={{ textDecoration: "none" }}>
            <ButtonSecondary trailingIcon={<ArrowRight style={{ width: 13, height: 13 }} />}>
              All recovery plans
            </ButtonSecondary>
          </Link>
        ) : null
      }
    >
      {!hasDisruption ? (
        <NoActiveDisruptionState
          title="No carbon ledger yet."
          description="Trigger a disruption from the simulator to receive four recovery plans, each with a full CO\u2082 ledger priced under EU ETS."
        />
      ) : recoveryPlans.length === 0 ? (
        // Edge case: event triggered but plans haven't arrived yet (sub-5ms
        // solve, but the WS message may not have landed). Show a tight
        // loading state instead of flashing the empty card.
        <ContentCard padding={sp.xl} style={{ textAlign: "center" }}>
          <Eyebrow color={c.signatureForest}>Solving</Eyebrow>
          <Type as="p" role="bodyMd" color={c.body} style={{ marginTop: 8 }}>
            Computing CO{"\u2082"} ledger for the active disruption&hellip;
          </Type>
        </ContentCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: sp.lg }}>

          {/* ── Hero summary band ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: sp.md,
            }}
          >
            <SummaryCard
              label="Greenest plan"
              value={greenest ? `Plan ${greenest.plan_id}` : "—"}
              sub={greenest?.total_co2_kg !== undefined ? fmtTonnes(greenest.total_co2_kg) : undefined}
              accent={c.statusOnTime.ink}
              Icon={Leaf}
            />
            <SummaryCard
              label="Range across plans"
              value={`${(maxAbsCo2 / 1000).toFixed(1)} tCO\u2082e`}
              sub="largest absolute net delta"
              accent={c.signatureMustard}
              Icon={TrendingUp}
            />
            <SummaryCard
              label="EU ETS price"
              value={
                recoveryPlans[0].carbon_breakdown?.ets_price_usd_per_tonne
                  ? `$${recoveryPlans[0].carbon_breakdown.ets_price_usd_per_tonne}/t`
                  : "—"
              }
              sub="per tonne CO\u2082e"
              accent={c.link}
              Icon={Plane}
            />
            <SummaryCard
              label="Plans evaluated"
              value={`${recoveryPlans.length}`}
              sub="from the latest solve"
              accent={c.signatureCoral}
              Icon={Plane}
            />
          </div>

          {/* ── Comparison cards ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: sp.md,
            }}
          >
            {recoveryPlans.map((plan) => (
              <CarbonPlanCard
                key={plan.plan_id}
                plan={plan}
                isApplied={appliedPlanId === plan.plan_id}
                isGreenest={greenest?.plan_id === plan.plan_id}
                maxAbs={maxAbsCo2}
              />
            ))}
          </div>

          {/* ── Methodology footer ── */}
          <ContentCard padding={sp.lg}>
            <Eyebrow color={c.signatureForest}>Methodology</Eyebrow>
            <Type as="p" role="bodyMd" color={c.body} style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
              Carbon emissions are computed as Jet-A burn × 3.16 kg CO{"\u2082"}/kg (ICAO ECCM v13).
              Cancellations save the full block-hour burn for the segment (~2.0h average stage).
              Delays burn 65% airborne / 35% APU at gate. Aircraft ferries are pure overhead at
              ~1.6h block. Net positive emissions are billed at the current EU-ETS spot price
              (~€85/t = $95/t at 1.10 EUR/USD).
            </Type>
          </ContentCard>
        </div>
      )}
    </SimulatorPageShell>
  )
}

function SummaryCard({
  label, value, sub, accent, Icon,
}: {
  label: string
  value: string
  sub?: string
  accent: string
  Icon: typeof Leaf
}) {
  return (
    <ContentCard
      padding={sp.md}
      style={{
        borderLeft: `4px solid ${accent}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon style={{ width: 14, height: 14, color: c.muted }} />
        <Eyebrow>{label}</Eyebrow>
      </div>
      <div style={{ fontFamily: ff.display, fontSize: 28, fontWeight: 400, color: c.ink, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && (
        <span style={{ fontFamily: ff.body, fontSize: 12, color: c.muted }}>
          {sub}
        </span>
      )}
    </ContentCard>
  )
}

function CarbonPlanCard({
  plan, isApplied, isGreenest, maxAbs,
}: {
  plan: RecoveryPlan
  isApplied: boolean
  isGreenest: boolean
  maxAbs: number
}) {
  const meta = planMeta(plan.plan_id)
  const co2 = plan.total_co2_kg ?? 0
  const fillPct = Math.min(100, Math.round((Math.abs(co2) / Math.max(1, maxAbs)) * 100))
  const isNegative = co2 < 0
  const burnedKg = plan.carbon_breakdown?.burned_co2_kg ?? 0
  const savedKg  = plan.carbon_breakdown?.saved_co2_kg ?? 0
  // True "no carbon data" state — plan was scored before Slice 4 wired in,
  // or this plan literally had no cancellations/delays/ferries. We render
  // a "within budget" badge instead of a blank card.
  const noCarbonData = !plan.carbon_breakdown
  const isZeroDelta  = !noCarbonData && burnedKg === 0 && savedKg === 0 && co2 === 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <ContentCard
        padding={0}
        style={{
          // Chromatic restraint: only the GREENEST plan gets the signature
          // surface as voltage. Applied (but not greenest) plans get a
          // muted accent ring; the rest stay on white canvas.
          background: isGreenest ? meta.surface : c.canvas,
          border: `1px solid ${isGreenest ? c.signatureForest : isApplied ? meta.accent : c.hairline}`,
          boxShadow: isApplied && !isGreenest ? `0 0 0 1px ${meta.accent}` : undefined,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex" }}>
          <div style={{ width: 4, background: meta.accent, flexShrink: 0 }} />
          <div style={{ flex: 1, padding: sp.lg }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <Eyebrow color={meta.ink}>Plan {plan.plan_id}</Eyebrow>
                <div style={{ ...typeStyle("titleSm", c.ink), marginTop: 4 }}>{meta.label}</div>
              </div>
              {isGreenest && (
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
                    background: c.statusOnTime.bg,
                    color: c.statusOnTime.ink,
                  }}
                >
                  <Leaf style={{ width: 11, height: 11 }} /> Greenest
                </span>
              )}
            </div>

            {/* Net CO2 — large numeric. If the ledger is empty or a true
                zero-delta plan, fall back to "within budget" instead of an
                ambiguous 0.00 number that reads as missing data. */}
            <div style={{ marginTop: sp.md, display: "flex", alignItems: "baseline", gap: 8 }}>
              {noCarbonData ? (
                <span style={{ fontFamily: ff.body, fontSize: 13, color: c.muted }}>
                  Carbon ledger not available for this plan.
                </span>
              ) : isZeroDelta ? (
                <>
                  <Leaf style={{ width: 18, height: 18, color: c.statusOnTime.ink }} />
                  <span style={{ fontFamily: ff.display, fontSize: 22, fontWeight: 400, color: c.statusOnTime.ink }}>
                    Within budget
                  </span>
                  <span style={{ fontSize: 11, color: c.muted, fontFamily: ff.mono }}>
                    no net delta vs baseline
                  </span>
                </>
              ) : (
                <>
                  {isNegative ? (
                    <TrendingDown style={{ width: 20, height: 20, color: c.statusOnTime.ink }} />
                  ) : (
                    <TrendingUp style={{ width: 20, height: 20, color: c.statusCancelled.ink }} />
                  )}
                  <span style={{ fontFamily: ff.display, fontSize: 32, fontWeight: 400, color: isNegative ? c.statusOnTime.ink : c.statusCancelled.ink, fontVariantNumeric: "tabular-nums" }}>
                    {fmtTonnes(co2)}
                  </span>
                  <span style={{ fontSize: 12, color: c.muted }}>net</span>
                </>
              )}
            </div>

            {/* Burn vs saved bar — only rendered when the ledger actually
                has data. Hiding these for plans without carbon stats keeps
                the card from showing four "0.00 t" cells side by side. */}
            {!noCarbonData && !isZeroDelta && (
              <>
                <div style={{ marginTop: sp.sm }}>
                  <div
                    style={{
                      position: "relative",
                      height: 10,
                      borderRadius: r.pill,
                      background: c.surfaceStrong,
                      overflow: "hidden",
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${fillPct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${fillPct}%`,
                        background: isNegative ? c.signatureMint : c.signatureCoral,
                        borderRadius: r.pill,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: sp.xs, marginTop: sp.sm }}>
                  <div style={{ background: c.canvas, border: `1px solid ${c.hairline}`, borderRadius: r.sm, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, color: c.muted, marginBottom: 2 }}>Burned</div>
                    <div style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 13, color: c.statusCancelled.ink, fontVariantNumeric: "tabular-nums" }}>
                      +{(burnedKg / 1000).toFixed(2)} t
                    </div>
                  </div>
                  <div style={{ background: c.canvas, border: `1px solid ${c.hairline}`, borderRadius: r.sm, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, color: c.muted, marginBottom: 2 }}>Saved</div>
                    <div style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 13, color: c.statusOnTime.ink, fontVariantNumeric: "tabular-nums" }}>
                      -{(savedKg / 1000).toFixed(2)} t
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ETS cost + drilldown link */}
            <div
              style={{
                marginTop: sp.md,
                paddingTop: sp.sm,
                borderTop: `1px solid ${c.hairline}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 11, color: c.muted, letterSpacing: "0.06em" }}>EU ETS cost</span>
                <span style={{ fontFamily: ff.mono, fontWeight: 600, fontSize: 14, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
                  {fmt$(plan.eu_ets_cost_usd ?? 0)}
                </span>
              </div>
              <Link href={`/simulator/plans/${plan.plan_id}`} style={{ textDecoration: "none" }}>
                <ButtonSecondary size="sm" trailingIcon={<ArrowRight style={{ width: 12, height: 12 }} />}>
                  Plan detail
                </ButtonSecondary>
              </Link>
            </div>
          </div>
        </div>
      </ContentCard>
    </motion.div>
  )
}
