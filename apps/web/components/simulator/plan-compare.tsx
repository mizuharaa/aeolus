"use client"
import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart3, TrendingDown, TrendingUp, Minus,
  DollarSign, Users, Plane, Clock, ChevronDown,
  CheckCircle2, AlertTriangle, Repeat2,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import type { RecoveryPlan } from "@/stores/simulation"
import { c, ff, r, sp, sh, type } from "@/lib/design-tokens"
import { Eyebrow, Type } from "@/components/ds/primitives"

// ─── Plan signature colors — matches recovery-plans.tsx ───────────────────
// Each plan keeps its identity (mustard / mint / peach / forest) so a Plan A
// chip on this comparison view matches the Plan A card on the right rail.
const PLAN_META: Record<string, { label: string; surface: string; ink: string; accent: string }> = {
  A: { label: "Minimize Cost",    accent: c.signatureMustard, surface: c.signatureCream,    ink: "#5C3D0F" },
  B: { label: "Min. Pax Impact",  accent: c.signatureMint,    surface: c.statusRecovered.bg, ink: c.signatureForest },
  C: { label: "Protect Tomorrow", accent: c.signaturePeach,   surface: c.statusDelayed.bg,  ink: c.statusDelayed.ink },
  D: { label: "Green Recovery",   accent: c.signatureForest,  surface: c.statusOnTime.bg,   ink: c.signatureForest },
}

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}
function fmtMin(n: number) {
  const h = Math.floor(n / 60), m = n % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─── Comparison Row ───────────────────────────────────────────────────────────

function CompareRow({
  label, Icon, aVal, bVal, fmt, lowerIsBetter = true,
}: {
  label: string; Icon: typeof DollarSign; aVal: number; bVal: number
  fmt: (n: number) => string; lowerIsBetter?: boolean
}) {
  const tied  = aVal === bVal
  const aWins = !tied && (lowerIsBetter ? aVal < bVal : aVal > bVal)
  const bWins = !tied && (lowerIsBetter ? bVal < aVal : bVal > aVal)
  const diff  = aVal - bVal
  const diffPct = bVal !== 0 ? Math.round(Math.abs(diff / bVal) * 100) : 0

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: sp.xs }}>
      <CompareCell value={fmt(aVal)} winner={aWins} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 88 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icon style={{ width: 12, height: 12, color: c.muted, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: c.muted, whiteSpace: "nowrap" }}>{label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: c.muted }}>
          {tied ? (
            <Minus style={{ width: 12, height: 12 }} />
          ) : aWins ? (
            <TrendingDown style={{ width: 12, height: 12, color: c.statusOnTime.ink }} />
          ) : (
            <TrendingUp style={{ width: 12, height: 12, color: c.signatureCoral }} />
          )}
          {!tied && diffPct > 0 && <span>{diffPct}%</span>}
        </div>
      </div>

      <CompareCell value={fmt(bVal)} winner={bWins} />
    </div>
  )
}

function CompareCell({ value, winner }: { value: string; winner: boolean }) {
  return (
    <div
      style={{
        borderRadius: r.md,
        padding: "10px 12px",
        textAlign: "center",
        border: `1px solid ${winner ? c.statusOnTime.dot : c.hairline}`,
        background: winner ? c.statusOnTime.bg : c.canvas,
      }}
    >
      <div
        style={{
          fontFamily: ff.mono,
          fontWeight: 600,
          fontSize: 14,
          color: c.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {winner && (
        <div style={{ fontSize: 9, color: c.statusOnTime.ink, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
          Best
        </div>
      )}
    </div>
  )
}

// ─── Plan Pill Selector ───────────────────────────────────────────────────────

function PlanPills({
  plans, selected, disabledId, onSelect, colLabel,
}: {
  plans: RecoveryPlan[]; selected: string; disabledId: string
  onSelect: (id: string) => void; colLabel: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: sp.xs }}>
      <Eyebrow>{colLabel}</Eyebrow>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {plans.map((p) => {
          const meta = PLAN_META[p.plan_id]
          const isSel = selected === p.plan_id
          const isDisabled = p.plan_id === disabledId
          if (!meta) return null
          return (
            <button
              key={p.plan_id}
              onClick={() => !isDisabled && onSelect(p.plan_id)}
              disabled={isDisabled}
              title={isDisabled ? "Already selected on the other side" : `Compare Plan ${p.plan_id}`}
              style={{
                padding: "6px 12px",
                borderRadius: r.md,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: ff.body,
                border: `1px solid ${isSel ? meta.accent : c.hairline}`,
                background: isSel ? meta.surface : c.canvas,
                color: isSel ? meta.ink : c.muted,
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.3 : 1,
                transition: "all 150ms ease",
              }}
            >
              {p.plan_id} — {meta.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlanCompare() {
  const { recoveryPlans } = useSimulationStore()
  const [collapsed, setCollapsed] = useState(false)
  const [selA, setSelA] = useState<string | null>(null)
  const [selB, setSelB] = useState<string | null>(null)

  // Sync selections whenever plans arrive or change
  useEffect(() => {
    if (recoveryPlans.length >= 2) {
      setSelA((prev) => {
        const valid = recoveryPlans.some((p) => p.plan_id === prev)
        return valid ? prev : recoveryPlans[0].plan_id
      })
      setSelB((prev) => {
        const valid = recoveryPlans.some((p) => p.plan_id === prev)
        return valid ? prev : recoveryPlans[1].plan_id
      })
    }
  }, [recoveryPlans])

  const planA = useMemo(
    () => (selA ? recoveryPlans.find((p) => p.plan_id === selA) ?? null : null),
    [recoveryPlans, selA]
  )
  const planB = useMemo(
    () => (selB ? recoveryPlans.find((p) => p.plan_id === selB) ?? null : null),
    [recoveryPlans, selB]
  )

  const scoreA = useMemo(() => {
    if (!planA || !planB) return 0
    return [
      planA.total_cost_usd <= planB.total_cost_usd,
      planA.cancelled_flights.length <= planB.cancelled_flights.length,
      planA.total_passenger_delay_minutes <= planB.total_passenger_delay_minutes,
      planA.crew_violations <= planB.crew_violations,
    ].filter(Boolean).length
  }, [planA, planB])

  // All hooks above — early return is safe here
  if (recoveryPlans.length < 2 || !selA || !selB) return null

  const metaA  = PLAN_META[selA]
  const metaB  = PLAN_META[selB]
  const scoreB = 4 - scoreA

  const handleSelA = (id: string) => {
    setSelA(id)
    if (id === selB) setSelB(selA ?? recoveryPlans.find((p) => p.plan_id !== id)?.plan_id ?? null)
  }
  const handleSelB = (id: string) => {
    setSelB(id)
    if (id === selA) setSelA(selB ?? recoveryPlans.find((p) => p.plan_id !== id)?.plan_id ?? null)
  }

  return (
    <div
      style={{
        background: c.canvas,
        border: `1px solid ${c.hairline}`,
        borderRadius: r.lg,
        overflow: "hidden",
        boxShadow: sh.cardSoft,
        fontFamily: ff.body,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${sp.sm}px ${sp.lg}px`,
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: sp.sm }}>
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
            <BarChart3 style={{ width: 14, height: 14, color: c.ink }} />
          </div>
          <div>
            <div style={{ ...type("titleMd", c.ink), fontSize: 16 }}>Plan Comparison</div>
            <div style={{ ...type("caption", c.muted), fontSize: 11, marginTop: 1 }}>Side-by-side recovery plan diff</div>
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            width: 28,
            height: 28,
            borderRadius: r.sm,
            border: `1px solid ${c.hairline}`,
            background: c.canvas,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ChevronDown
            style={{
              width: 14,
              height: 14,
              color: c.muted,
              transform: collapsed ? "rotate(180deg)" : undefined,
              transition: "transform 200ms ease",
            }}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: sp.lg, display: "flex", flexDirection: "column", gap: sp.lg }}>

              {/* Plan selectors side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr", alignItems: "flex-start", gap: sp.xs }}>
                <PlanPills
                  plans={recoveryPlans}
                  selected={selA}
                  disabledId={selB}
                  onSelect={handleSelA}
                  colLabel="Left"
                />
                <div style={{ textAlign: "center", color: c.muted, fontSize: 12, fontWeight: 500, marginTop: 24 }}>vs</div>
                <PlanPills
                  plans={recoveryPlans}
                  selected={selB}
                  disabledId={selA}
                  onSelect={handleSelB}
                  colLabel="Right"
                />
              </div>

              {/* Plan name banners */}
              {planA && planB && metaA && metaB && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr", gap: sp.xs, alignItems: "center" }}>
                    <PlanBanner meta={metaA} planId={selA} />
                    <div />
                    <PlanBanner meta={metaB} planId={selB} />
                  </div>

                  {/* Comparison rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: sp.xs }}>
                    <CompareRow label="Total cost"      Icon={DollarSign}    aVal={planA.total_cost_usd}                bVal={planB.total_cost_usd}                fmt={fmt$}                                            lowerIsBetter />
                    <CompareRow label="Cancellations"   Icon={Plane}         aVal={planA.cancelled_flights.length}      bVal={planB.cancelled_flights.length}      fmt={(n) => `${n} flight${n !== 1 ? "s" : ""}`}      lowerIsBetter />
                    <CompareRow label="Pax delay"       Icon={Users}         aVal={planA.total_passenger_delay_minutes} bVal={planB.total_passenger_delay_minutes} fmt={(n) => fmtMin(Math.round(n))}                    lowerIsBetter />
                    <CompareRow label="Delayed flights" Icon={Clock}         aVal={planA.delayed_flights.length}        bVal={planB.delayed_flights.length}        fmt={(n) => `${n} flight${n !== 1 ? "s" : ""}`}      lowerIsBetter />
                    <CompareRow label="Aircraft swaps"  Icon={Repeat2}       aVal={planA.aircraft_swaps.length}         bVal={planB.aircraft_swaps.length}         fmt={(n) => `${n} swap${n !== 1 ? "s" : ""}`}         lowerIsBetter={false} />
                    <CompareRow label="Crew flags"      Icon={AlertTriangle} aVal={planA.crew_violations}               bVal={planB.crew_violations}               fmt={(n) => n === 0 ? "None" : `${n} flag${n !== 1 ? "s" : ""}`} lowerIsBetter />
                  </div>

                  {/* Verdict — neutral surface, semantic green for the recommended side */}
                  <div
                    style={{
                      borderRadius: r.lg,
                      border: `1px solid ${c.hairline}`,
                      background: c.surfaceSoft,
                      padding: sp.md,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: sp.sm }}>
                      <Eyebrow>Overall Verdict</Eyebrow>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: sp.sm, alignItems: "center" }}>
                      <VerdictColumn score={scoreA} ink={metaA.ink} winning={scoreA > scoreB} />
                      <div style={{ textAlign: "center", color: c.muted, fontSize: 14, fontWeight: 500, padding: "0 8px" }}>vs</div>
                      <VerdictColumn score={scoreB} ink={metaB.ink} winning={scoreB > scoreA} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PlanBanner({ meta, planId }: { meta: typeof PLAN_META[string]; planId: string }) {
  return (
    <div
      style={{
        borderRadius: r.md,
        padding: "8px 12px",
        textAlign: "center",
        background: meta.surface,
        border: `1px solid ${meta.accent}`,
        color: meta.ink,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500 }}>{meta.label}</div>
      <div style={{ fontSize: 10, color: meta.ink, opacity: 0.7, marginTop: 2 }}>Plan {planId}</div>
    </div>
  )
}

function VerdictColumn({ score, ink, winning }: { score: number; ink: string; winning: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: ff.display,
          fontWeight: 500,
          fontSize: 32,
          color: ink,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {score}
      </div>
      <div style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>metrics better</div>
      {winning && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 6 }}>
          <CheckCircle2 style={{ width: 13, height: 13, color: c.statusOnTime.ink }} />
          <span style={{ fontSize: 11, color: c.statusOnTime.ink, fontWeight: 500 }}>Recommended</span>
        </div>
      )}
    </div>
  )
}
