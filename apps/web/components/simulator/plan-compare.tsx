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

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_META: Record<string, { label: string; accentText: string; bg: string; border: string; accent: string }> = {
  A: { label: "Minimize Cost",    accent: "#FFD23F", accentText: "#92700A", bg: "bg-yellow-50",  border: "border-yellow-300"  },
  B: { label: "Min. Pax Impact",  accent: "#6366F1", accentText: "#4338CA", bg: "bg-indigo-50", border: "border-indigo-300"  },
  C: { label: "Protect Tomorrow", accent: "#5DADE2", accentText: "#1A6FA0", bg: "bg-sky-50",    border: "border-sky-300"     },
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
  label: string; Icon: any; aVal: number; bVal: number
  fmt: (n: number) => string; lowerIsBetter?: boolean
}) {
  const tied  = aVal === bVal
  const aWins = !tied && (lowerIsBetter ? aVal < bVal : aVal > bVal)
  const bWins = !tied && (lowerIsBetter ? bVal < aVal : bVal > aVal)
  const diff  = aVal - bVal
  const diffPct = bVal !== 0 ? Math.round(Math.abs(diff / bVal) * 100) : 0

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className={`rounded-xl px-3 py-2.5 text-center transition-all border ${aWins ? "ring-2 ring-emerald-400/60 bg-emerald-50 border-emerald-200" : "bg-secondary/30 border-border/40"}`}>
        <div className="font-mono font-bold text-sm text-foreground">{fmt(aVal)}</div>
        {aWins && <div className="text-[9px] text-emerald-700 font-bold uppercase mt-0.5">Best</div>}
      </div>

      <div className="flex flex-col items-center gap-1 min-w-[88px]">
        <div className="flex items-center gap-1">
          <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{label}</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          {tied ? <Minus className="w-3 h-3" /> : aWins
            ? <TrendingDown className="w-3 h-3 text-emerald-600" />
            : <TrendingUp className="w-3 h-3 text-red-500" />
          }
          {!tied && diffPct > 0 && <span>{diffPct}%</span>}
        </div>
      </div>

      <div className={`rounded-xl px-3 py-2.5 text-center transition-all border ${bWins ? "ring-2 ring-emerald-400/60 bg-emerald-50 border-emerald-200" : "bg-secondary/30 border-border/40"}`}>
        <div className="font-mono font-bold text-sm text-foreground">{fmt(bVal)}</div>
        {bWins && <div className="text-[9px] text-emerald-700 font-bold uppercase mt-0.5">Best</div>}
      </div>
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
    <div className="flex flex-col items-center gap-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{colLabel}</div>
      <div className="flex gap-1.5 flex-wrap justify-center">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                isSel
                  ? `${meta.bg} ${meta.border} shadow-sm`
                  : "bg-white border-border/50 text-muted-foreground hover:border-border hover:bg-secondary/50"
              }`}
              style={isSel ? { color: meta.accentText } : {}}
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
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1px solid #DDDDDD",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(13,148,136,0.10)", border: "1px solid rgba(13,148,136,0.15)" }}
          >
            <BarChart3 className="w-3.5 h-3.5" style={{ color: "#0D9488" }} />
          </div>
          <div>
            <div className="section-title">Plan Comparison</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Side-by-side recovery plan diff</div>
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary"
        >
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-5">

              {/* Plan selectors side by side */}
              <div className="grid grid-cols-[1fr_28px_1fr] items-start gap-2">
                <PlanPills
                  plans={recoveryPlans}
                  selected={selA}
                  disabledId={selB}
                  onSelect={handleSelA}
                  colLabel="Left"
                />
                <div className="text-center text-muted-foreground text-xs font-bold mt-6">vs</div>
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
                  <div className="grid grid-cols-[1fr_28px_1fr] gap-2 items-center">
                    <div className={`rounded-xl px-3 py-2 text-center ${metaA.bg} border ${metaA.border}`}>
                      <div className="text-xs font-bold" style={{ color: metaA.accentText }}>{metaA.label}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">Plan {selA}</div>
                    </div>
                    <div />
                    <div className={`rounded-xl px-3 py-2 text-center ${metaB.bg} border ${metaB.border}`}>
                      <div className="text-xs font-bold" style={{ color: metaB.accentText }}>{metaB.label}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">Plan {selB}</div>
                    </div>
                  </div>

                  {/* Comparison rows */}
                  <div className="space-y-2">
                    <CompareRow label="Total cost"      Icon={DollarSign}   aVal={planA.total_cost_usd}                    bVal={planB.total_cost_usd}                    fmt={fmt$}                                            lowerIsBetter />
                    <CompareRow label="Cancellations"   Icon={Plane}        aVal={planA.cancelled_flights.length}           bVal={planB.cancelled_flights.length}           fmt={(n) => `${n} flight${n !== 1 ? "s" : ""}`}      lowerIsBetter />
                    <CompareRow label="Pax delay"        Icon={Users}        aVal={planA.total_passenger_delay_minutes}      bVal={planB.total_passenger_delay_minutes}      fmt={(n) => fmtMin(Math.round(n))}                    lowerIsBetter />
                    <CompareRow label="Delayed flights"  Icon={Clock}        aVal={planA.delayed_flights.length}             bVal={planB.delayed_flights.length}             fmt={(n) => `${n} flight${n !== 1 ? "s" : ""}`}      lowerIsBetter />
                    <CompareRow label="Aircraft swaps"   Icon={Repeat2}      aVal={planA.aircraft_swaps.length}              bVal={planB.aircraft_swaps.length}              fmt={(n) => `${n} swap${n !== 1 ? "s" : ""}`}         lowerIsBetter={false} />
                    <CompareRow label="Crew flags"       Icon={AlertTriangle} aVal={planA.crew_violations}                  bVal={planB.crew_violations}                    fmt={(n) => n === 0 ? "None" : `${n} flag${n !== 1 ? "s" : ""}`} lowerIsBetter />
                  </div>

                  {/* Verdict */}
                  <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">Overall Verdict</div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <div className="text-center">
                        <div className="text-2xl font-black font-mono" style={{ color: metaA.accentText }}>{scoreA}</div>
                        <div className="text-[10px] text-muted-foreground">metrics better</div>
                        {scoreA > scoreB && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] text-emerald-700 font-bold">Recommended</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center text-muted-foreground text-sm font-bold px-2">vs</div>
                      <div className="text-center">
                        <div className="text-2xl font-black font-mono" style={{ color: metaB.accentText }}>{scoreB}</div>
                        <div className="text-[10px] text-muted-foreground">metrics better</div>
                        {scoreB > scoreA && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] text-emerald-700 font-bold">Recommended</span>
                          </div>
                        )}
                      </div>
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
