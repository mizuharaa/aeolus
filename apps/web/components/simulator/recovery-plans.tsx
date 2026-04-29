"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DollarSign, Users, AlertCircle, CheckCircle2, Clock, ChevronRight,
  Plane, Play, X, Sparkles, ShieldCheck, Activity, TrendingDown,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"

/* Plan card visual config — gold / teal / sky per slot */
const PLAN_META = {
  A: {
    label:      "Minimize Cost",
    accent:     "#FFD23F",
    accentBg:   "rgba(255,210,63,0.10)",
    accentText: "#B8860B",
    borderCls:  "border-yellow-200",
    softCls:    "bg-yellow-50",
  },
  B: {
    label:      "Min. Pax Impact",
    accent:     "#2BA8A2",
    accentBg:   "rgba(43,168,162,0.10)",
    accentText: "#1E8C86",
    borderCls:  "border-teal/30",
    softCls:    "bg-teal-bg",
  },
  C: {
    label:      "Protect Tomorrow",
    accent:     "#5DADE2",
    accentBg:   "rgba(93,173,226,0.10)",
    accentText: "#2471A3",
    borderCls:  "border-sky-200",
    softCls:    "bg-sky-50",
  },
} as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { Icon: any; cls: string }> = {
    optimal:    { Icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    feasible:   { Icon: CheckCircle2, cls: "text-teal-700 bg-teal-bg border-teal/30" },
    heuristic:  { Icon: Clock,        cls: "text-amber-700 bg-amber-50 border-amber-200" },
    infeasible: { Icon: AlertCircle,  cls: "text-red-700 bg-red-50 border-red-200" },
  }
  const s = map[status] || map.heuristic
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full border ${s.cls}`}>
      <s.Icon className="w-2.5 h-2.5" />
      {status}
    </span>
  )
}

function PlanCard({
  plan, isSelected, isApplied, onClick, onApply, index,
}: {
  plan: any
  isSelected: boolean
  isApplied: boolean
  onClick: () => void
  onApply: (e: React.MouseEvent) => void
  index: number
}) {
  const meta = PLAN_META[plan.plan_id as keyof typeof PLAN_META] || PLAN_META.A

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-2xl border cursor-pointer transition-all overflow-hidden ${
        isApplied
          ? `${meta.borderCls} ring-2 ring-offset-1 shadow-md`
          : isSelected
          ? `${meta.borderCls} shadow-sm`
          : "border-border/50 bg-white hover:bg-secondary/30"
      }`}
      style={
        isApplied || isSelected
          ? { background: meta.accentBg }
          : {}
      }
    >
      {/* Colored left accent bar */}
      <div className="flex h-full">
        <div
          className="w-1 shrink-0 rounded-l-2xl"
          style={{ background: meta.accent }}
        />
        <div className="flex-1 p-3">
          {/* Plan header */}
          <div className="flex items-start justify-between mb-2.5 gap-1">
            <div>
              <div
                className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                style={{ color: meta.accent }}
              >
                Plan {plan.plan_id}
              </div>
              <div className="text-[12px] font-bold leading-tight text-foreground">
                {meta.label}
              </div>
            </div>
            <StatusBadge status={plan.status} />
          </div>

          {/* Metrics */}
          <div className="space-y-1.5">
            {[
              { Icon: DollarSign, label: "Cost",      value: `$${(plan.total_cost_usd / 1000).toFixed(0)}K`,                                   color: "" },
              { Icon: Users,      label: "Pax·min",   value: `${((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K`,               color: "" },
              {
                Icon: Plane, label: "Cancelled",
                value: String(plan.cancelled_flights?.length || 0),
                color: plan.cancelled_flights?.length > 0 ? "text-red-600" : "text-emerald-600",
              },
              {
                Icon: Clock, label: "Delayed",
                value: String(plan.delayed_flights?.length || 0),
                color: plan.delayed_flights?.length > 0 ? "text-orange-600" : "text-emerald-600",
              },
              { Icon: ChevronRight, label: "Swaps",   value: String(plan.aircraft_swaps?.length || 0), color: "" },
              {
                Icon: ShieldCheck, label: "FAR 117",
                value: plan.crew_violations > 0 ? `${plan.crew_violations} viol` : "OK",
                color: plan.crew_violations > 0 ? "text-red-600" : "text-emerald-600",
              },
            ].map(({ Icon, label, value, color }) => (
              <div key={label} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
                <span className={`font-mono font-semibold ${color || "text-foreground"}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {plan.solve_time_ms > 0 && (
            <div className="mt-2 text-[9px] text-muted-foreground/60 font-mono">
              {plan.solve_time_ms}ms · Heuristic optimizer
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={onApply}
            className="mt-3 w-full h-9 flex items-center justify-center gap-1.5 text-xs font-bold rounded-full transition-all"
            style={
              isApplied
                ? { background: "#EF6C4A", color: "white", boxShadow: "0 4px 16px rgba(239,108,74,0.30)" }
                : { background: meta.accent, color: isApplied ? "white" : meta.accentText, boxShadow: `0 2px 10px ${meta.accent}40` }
            }
          >
            {isApplied ? (
              <><X className="w-3.5 h-3.5" /> Unapply</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Apply</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function RecoveryPlans({
  selectedFlight, onFlightSelect,
}: {
  selectedFlight: string | null
  onFlightSelect: (id: string | null) => void
}) {
  const { recoveryPlans, cascadeSummary, appliedPlanId, applyPlan } = useSimulationStore()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  if (recoveryPlans.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="panel-header">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(43,168,162,0.12)" }}
          >
            <Activity className="w-3.5 h-3.5" style={{ color: "#2BA8A2" }} />
          </div>
          <div>
            <div className="section-title">Recovery Plans</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">3 differentiated strategies</div>
          </div>
        </div>
        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #E8F6F5 0%, #FFF8E7 100%)", border: "1px solid rgba(43,168,162,0.15)" }}
          >
            <Sparkles className="w-7 h-7" style={{ color: "#2BA8A2" }} />
          </div>
          <p className="text-sm font-bold text-foreground mb-1.5">Awaiting disruption</p>
          <p className="text-xs text-muted-foreground/80 max-w-[200px]">
            Trigger an event to receive 3 ranked recovery plans
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-2 font-mono">
            solved in &lt;5ms
          </p>
        </div>
      </div>
    )
  }

  const activePlan = recoveryPlans.find((p: any) => p.plan_id === selectedPlan)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(43,168,162,0.12)" }}
        >
          <Activity className="w-3.5 h-3.5" style={{ color: "#2BA8A2" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="section-title">Recovery Plans</div>
          {cascadeSummary && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
              <span className="font-bold" style={{ color: "#EF6C4A" }}>{cascadeSummary.total_affected}</span>
              <span>affected ·</span>
              <span>{cascadeSummary.directly_affected} direct ·</span>
              <span>{(cascadeSummary.cascade_1 || 0) + (cascadeSummary.cascade_2 || 0)} cascade</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Plan cards row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {recoveryPlans.map((plan: any, i: number) => (
            <PlanCard
              key={plan.plan_id}
              plan={plan}
              index={i}
              isSelected={selectedPlan === plan.plan_id}
              isApplied={appliedPlanId === plan.plan_id}
              onClick={() => setSelectedPlan(selectedPlan === plan.plan_id ? null : plan.plan_id)}
              onApply={(e) => {
                e.stopPropagation()
                applyPlan(appliedPlanId === plan.plan_id ? null : plan.plan_id)
              }}
            />
          ))}
        </div>

        {/* Expanded plan details */}
        <AnimatePresence>
          {activePlan && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="rounded-2xl border p-4 space-y-3.5"
                style={{ borderColor: "rgba(43,168,162,0.18)", background: "rgba(232,246,245,0.40)" }}
              >
                <div className="section-title">Plan {activePlan.plan_id} — Actions</div>

                {activePlan.cancelled_flights?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                      Cancellations ({activePlan.cancelled_flights.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activePlan.cancelled_flights.map((f: string) => (
                        <span
                          key={f}
                          onClick={() => onFlightSelect(f)}
                          className="text-[10px] px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-mono cursor-pointer hover:bg-red-100 transition-colors"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activePlan.delayed_flights?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                      Delays ({activePlan.delayed_flights.length})
                    </div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                      {activePlan.delayed_flights.slice(0, 30).map((d: any) => (
                        <div
                          key={d.flight_id}
                          className="flex items-center justify-between text-[11px] cursor-pointer rounded-lg px-2 py-1 hover:bg-secondary transition-colors"
                          onClick={() => onFlightSelect(d.flight_id)}
                        >
                          <span className="font-mono text-foreground/80">{d.flight_id}</span>
                          <span className="text-orange-600 font-mono font-semibold">+{d.delay_minutes}m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePlan.aircraft_swaps?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                      Aircraft Swaps ({activePlan.aircraft_swaps.length})
                    </div>
                    <div className="space-y-1">
                      {activePlan.aircraft_swaps.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-mono text-foreground/80">{s.flight_id}</span>
                          <span className="text-border">·</span>
                          <span className="text-red-600 font-mono">{s.old_aircraft}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-emerald-600 font-mono">{s.new_aircraft}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!activePlan.cancelled_flights?.length &&
                 !activePlan.delayed_flights?.length &&
                 !activePlan.aircraft_swaps?.length && (
                  <p className="text-xs text-muted-foreground italic">No actions required — schedule intact.</p>
                )}

                {activePlan.cost_breakdown && activePlan.cost_breakdown.grand_total_usd > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Cost Breakdown (DOT/BTS Rates)
                    </div>
                    <div className="rounded-xl border border-border/50 bg-white/70 divide-y divide-border/40 text-[11px] overflow-hidden">
                      {activePlan.cost_breakdown.cancellation_total_usd > 0 && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-muted-foreground">Cancellations (rev loss + rebook + DOT 261)</span>
                          <span className="font-mono text-red-600 font-semibold">
                            ${(activePlan.cost_breakdown.cancellation_total_usd / 1000).toFixed(0)}K
                          </span>
                        </div>
                      )}
                      {activePlan.cost_breakdown.delay_total_usd > 0 && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-muted-foreground">Delay costs (ops + pax VOT + crew OT)</span>
                          <span className="font-mono text-orange-600 font-semibold">
                            ${(activePlan.cost_breakdown.delay_total_usd / 1000).toFixed(0)}K
                          </span>
                        </div>
                      )}
                      {activePlan.cost_breakdown.reposition_cost_usd > 0 && (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-muted-foreground">Aircraft repositioning</span>
                          <span className="font-mono text-foreground font-semibold">
                            ${(activePlan.cost_breakdown.reposition_cost_usd / 1000).toFixed(0)}K
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between px-3 py-2" style={{ background: "rgba(43,168,162,0.06)" }}>
                        <span className="font-bold text-foreground">Total estimated impact</span>
                        <span className="font-mono font-bold" style={{ color: "#1E8C86" }}>
                          ${(activePlan.cost_breakdown.grand_total_usd / 1_000_000).toFixed(2)}M
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1.5">
                      DOT BTS 2023 · $82.50/pax-hr delay · DOT Form 41 block-hour ops costs
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
