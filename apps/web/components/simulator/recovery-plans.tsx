"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DollarSign, Users, AlertCircle, CheckCircle2, Clock, ChevronRight,
  Plane, Play, X, Sparkles, ShieldCheck, Activity, TrendingDown,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"

const PLAN_STYLES = {
  A: { soft: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  iconBg: "bg-orange-100",  label: "Minimize Cost" },
  B: { soft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", iconBg: "bg-emerald-100", label: "Min. Pax Impact" },
  C: { soft: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     iconBg: "bg-sky-100",     label: "Protect Tomorrow" },
} as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { Icon: any; color: string }> = {
    optimal:    { Icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    feasible:   { Icon: CheckCircle2, color: "text-sky-700 bg-sky-50 border-sky-200" },
    heuristic:  { Icon: Clock,        color: "text-amber-700 bg-amber-50 border-amber-200" },
    infeasible: { Icon: AlertCircle,  color: "text-red-700 bg-red-50 border-red-200" },
  }
  const s = map[status] || map.heuristic
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] uppercase font-medium px-1.5 py-0.5 rounded-full border ${s.color}`}>
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
  const style = PLAN_STYLES[plan.plan_id as keyof typeof PLAN_STYLES] || PLAN_STYLES.A

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-xl border p-3 cursor-pointer transition-all ${
        isApplied
          ? `${style.border} ${style.soft} ring-2 ring-primary/30 shadow-md`
          : isSelected
          ? `${style.border} ${style.soft}`
          : "border-border bg-card hover:bg-secondary"
      }`}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <div className={`text-[10px] font-mono font-bold ${style.text} tracking-wider`}>PLAN {plan.plan_id}</div>
          <div className="text-[12px] font-display font-semibold leading-tight text-foreground">{style.label}</div>
        </div>
        <StatusBadge status={plan.status} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground"><DollarSign className="w-3 h-3" />Cost</span>
          <span className="font-mono font-semibold text-foreground">${(plan.total_cost_usd / 1000).toFixed(0)}K</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-3 h-3" />Pax·min</span>
          <span className="font-mono font-semibold text-foreground">{((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground"><Plane className="w-3 h-3" />Cancelled</span>
          <span className={`font-mono font-semibold ${plan.cancelled_flights?.length > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {plan.cancelled_flights?.length || 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" />Delayed</span>
          <span className={`font-mono font-semibold ${plan.delayed_flights?.length > 0 ? "text-orange-700" : "text-emerald-700"}`}>
            {plan.delayed_flights?.length || 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground"><ChevronRight className="w-3 h-3" />Swaps</span>
          <span className="font-mono font-semibold text-foreground">{plan.aircraft_swaps?.length || 0}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground"><ShieldCheck className="w-3 h-3" />FAR 117</span>
          <span className={`font-mono font-semibold ${plan.crew_violations > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {plan.crew_violations > 0 ? `${plan.crew_violations} viol` : "OK"}
          </span>
        </div>
      </div>

      {plan.solve_time_ms > 0 && (
        <div className="mt-2 text-[9px] text-muted-foreground/70 font-mono">
          {plan.solve_time_ms}ms · Heuristic optimizer
        </div>
      )}

      <button
        onClick={onApply}
        className={`mt-2.5 w-full flex items-center justify-center gap-1 text-[11px] font-semibold rounded-lg px-2 py-2 transition-all ${
          isApplied
            ? "bg-primary text-primary-foreground hover:bg-red-600"
            : "bg-foreground text-background hover:bg-primary"
        }`}
      >
        {isApplied ? (<><X className="w-3 h-3" />Unapply</>) : (<><Play className="w-3 h-3" />Apply to Map</>)}
      </button>
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
        <div className="border-b border-border px-4 py-2.5 shrink-0">
          <h3 className="text-[11px] font-display font-semibold uppercase tracking-wide text-muted-foreground">Recovery Plans</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-foreground font-semibold mb-1">Awaiting disruption</p>
          <p className="text-xs text-muted-foreground/80">Trigger an event to receive 3 ranked recovery plans</p>
          <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">3 differentiated strategies · solved in &lt;5ms</p>
        </div>
      </div>
    )
  }

  const activePlan = recoveryPlans.find((p: any) => p.plan_id === selectedPlan)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-display font-semibold uppercase tracking-wide text-muted-foreground">Recovery Plans</h3>
          {cascadeSummary && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Activity className="w-3 h-3 text-orange-600" />
              <span className="text-orange-700 font-semibold">{cascadeSummary.total_affected}</span>
              <span>affected</span>
              <span className="text-border">·</span>
              <span>{cascadeSummary.directly_affected} direct</span>
              <span className="text-border">·</span>
              <span>{(cascadeSummary.cascade_1 || 0) + (cascadeSummary.cascade_2 || 0)} cascade</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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

        <AnimatePresence>
          {activePlan && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-[11px] font-display font-semibold uppercase tracking-wide text-muted-foreground">
                  Plan {activePlan.plan_id} — Actions
                </h4>

                {activePlan.cancelled_flights?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5 tracking-wider">
                      Cancellations ({activePlan.cancelled_flights.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activePlan.cancelled_flights.map((f: string) => (
                        <span
                          key={f}
                          onClick={() => onFlightSelect(f)}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 font-mono cursor-pointer hover:bg-red-100 transition-colors"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activePlan.delayed_flights?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5 tracking-wider">
                      Delays ({activePlan.delayed_flights.length})
                    </div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                      {activePlan.delayed_flights.slice(0, 30).map((d: any) => (
                        <div
                          key={d.flight_id}
                          className="flex items-center justify-between text-[11px] cursor-pointer rounded px-1 py-0.5 hover:bg-secondary transition-colors"
                          onClick={() => onFlightSelect(d.flight_id)}
                        >
                          <span className="font-mono text-foreground/80">{d.flight_id}</span>
                          <span className="text-orange-700 font-mono font-medium">+{d.delay_minutes}m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePlan.aircraft_swaps?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5 tracking-wider">
                      Aircraft Swaps ({activePlan.aircraft_swaps.length})
                    </div>
                    <div className="space-y-0.5">
                      {activePlan.aircraft_swaps.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-mono text-foreground/80">{s.flight_id}</span>
                          <span className="text-border">·</span>
                          <span className="text-red-700 font-mono">{s.old_aircraft}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-emerald-700 font-mono">{s.new_aircraft}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!activePlan.cancelled_flights?.length && !activePlan.delayed_flights?.length && !activePlan.aircraft_swaps?.length && (
                  <p className="text-xs text-muted-foreground italic">No actions required — schedule intact.</p>
                )}

                {activePlan.cost_breakdown && activePlan.cost_breakdown.grand_total_usd > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5 tracking-wider flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Cost Breakdown (DOT/BTS Rates)
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/40 divide-y divide-border text-[11px]">
                      {activePlan.cost_breakdown.cancellation_total_usd > 0 && (
                        <div className="flex justify-between px-2.5 py-1.5">
                          <span className="text-muted-foreground">Cancellations (rev loss + rebook + DOT 261)</span>
                          <span className="font-mono text-red-700 font-semibold">
                            ${(activePlan.cost_breakdown.cancellation_total_usd / 1000).toFixed(0)}K
                          </span>
                        </div>
                      )}
                      {activePlan.cost_breakdown.delay_total_usd > 0 && (
                        <div className="flex justify-between px-2.5 py-1.5">
                          <span className="text-muted-foreground">Delay costs (ops + pax VOT + crew OT)</span>
                          <span className="font-mono text-orange-700 font-semibold">
                            ${(activePlan.cost_breakdown.delay_total_usd / 1000).toFixed(0)}K
                          </span>
                        </div>
                      )}
                      {activePlan.cost_breakdown.reposition_cost_usd > 0 && (
                        <div className="flex justify-between px-2.5 py-1.5">
                          <span className="text-muted-foreground">Aircraft repositioning</span>
                          <span className="font-mono text-foreground font-semibold">
                            ${(activePlan.cost_breakdown.reposition_cost_usd / 1000).toFixed(0)}K
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between px-2.5 py-1.5 bg-card">
                        <span className="font-semibold text-foreground">Total estimated impact</span>
                        <span className="font-mono font-bold text-primary">
                          ${(activePlan.cost_breakdown.grand_total_usd / 1_000_000).toFixed(2)}M
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">
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
