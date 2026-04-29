"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DollarSign, Users, AlertCircle, CheckCircle2, Clock,
  Plane, Play, X, Sparkles, ShieldCheck, Activity,
  ChevronDown, ChevronUp, TrendingDown, Repeat2, UserCheck, AlertTriangle,
} from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"

const PLAN_META = {
  A: {
    label:      "Minimize Cost",
    sublabel:   "Lowest financial exposure",
    accent:     "#FFD23F",
    accentDim:  "rgba(255,210,63,0.12)",
    accentText: "#92700A",
    border:     "rgba(255,210,63,0.40)",
    ring:       "rgba(255,210,63,0.55)",
  },
  B: {
    label:      "Min. Pax Impact",
    sublabel:   "Best passenger experience",
    accent:     "#2BA8A2",
    accentDim:  "rgba(43,168,162,0.10)",
    accentText: "#1E8C86",
    border:     "rgba(43,168,162,0.35)",
    ring:       "rgba(43,168,162,0.55)",
  },
  C: {
    label:      "Protect Tomorrow",
    sublabel:   "Minimizes next-day cascades",
    accent:     "#5DADE2",
    accentDim:  "rgba(93,173,226,0.10)",
    accentText: "#1A6FA0",
    border:     "rgba(93,173,226,0.35)",
    ring:       "rgba(93,173,226,0.55)",
  },
} as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { Icon: any; cls: string }> = {
    optimal:    { Icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    feasible:   { Icon: CheckCircle2, cls: "text-teal-700 bg-teal-50 border-teal-200" },
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

// Visual cost bar — proportional fill
function CostBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  if (!value || value <= 0) return null
  const pct = Math.min(100, Math.round((value / total) * 100))
  const fmt = value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(2)}M`
    : `$${(value / 1000).toFixed(0)}K`
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{fmt}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.07)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function PlanCard({
  plan, isSelected, isApplied, onClick, onApply, onFlightSelect, index,
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl border overflow-hidden transition-all"
      style={{
        borderColor: isApplied || isSelected ? meta.border : "rgba(0,0,0,0.10)",
        background: isApplied ? meta.accentDim : "#ffffff",
        boxShadow: isApplied
          ? `0 0 0 2px ${meta.ring}, 0 4px 16px rgba(0,0,0,0.06)`
          : isSelected
          ? "0 2px 12px rgba(0,0,0,0.08)"
          : "none",
      }}
    >
      {/* ── Card header — always visible, click to select ── */}
      <div
        className="flex gap-0 cursor-pointer"
        onClick={onClick}
      >
        {/* Left accent strip */}
        <div className="w-1.5 shrink-0 rounded-l-2xl" style={{ background: meta.accent }} />

        <div className="flex-1 p-3.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: meta.accent }}>
                Plan {plan.plan_id}
              </div>
              <div className="text-[13px] font-bold leading-tight text-foreground">{meta.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{meta.sublabel}</div>
            </div>
            <StatusBadge status={plan.status} />
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Total cost — prominent */}
            <div
              className="col-span-2 rounded-xl px-3 py-2 flex items-center justify-between"
              style={{ background: meta.accentDim, border: `1px solid ${meta.border}` }}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Est. total cost</span>
              </div>
              <span className="font-mono font-black text-base" style={{ color: meta.accentText }}>{fmtTotal}</span>
            </div>

            {/* Pax delay */}
            <div className="rounded-xl px-2.5 py-2 border border-border/50 bg-secondary/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Users className="w-3 h-3" /> Pax·min
              </div>
              <div className="font-mono font-bold text-xs">
                {((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K
              </div>
            </div>

            {/* FAR 117 */}
            <div className="rounded-xl px-2.5 py-2 border border-border/50 bg-secondary/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <ShieldCheck className="w-3 h-3" /> FAR 117
              </div>
              <div className={`font-bold text-xs ${plan.crew_violations > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {plan.crew_violations > 0 ? `${plan.crew_violations} viol.` : "OK"}
              </div>
            </div>
          </div>

          {/* Action counts row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {cancelled > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                <X className="w-3 h-3" /> {cancelled} cancelled
              </span>
            )}
            {delayed > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700">
                <Clock className="w-3 h-3" /> {delayed} delayed
              </span>
            )}
            {swaps > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                <Repeat2 className="w-3 h-3" /> {swaps} swaps
              </span>
            )}
            {cancelled === 0 && delayed === 0 && swaps === 0 && (
              <span className="text-[10px] text-emerald-600 font-semibold">No actions — schedule intact</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onApply}
              className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-bold rounded-full transition-all"
              style={
                isApplied
                  ? { background: "#EF4444", color: "white", boxShadow: "0 3px 10px rgba(239,68,68,0.30)" }
                  : { background: meta.accent, color: meta.accentText, boxShadow: `0 2px 8px ${meta.accent}50` }
              }
            >
              {isApplied ? <><X className="w-3 h-3" /> Unapply</> : <><Play className="w-3 h-3" /> Apply</>}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
              className="flex items-center gap-1 text-[10px] font-semibold px-3 h-8 rounded-full border border-border/50 hover:bg-secondary/50 transition-colors"
              style={{ color: meta.accentText }}
            >
              {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Less</> : <><ChevronDown className="w-3.5 h-3.5" /> Read more</>}
            </button>
          </div>
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
            className="overflow-hidden"
          >
            <div
              className="mx-2 mb-2 rounded-xl p-3.5 space-y-4"
              style={{ background: "rgba(249,250,251,0.85)", border: "1px solid rgba(0,0,0,0.07)" }}
            >

              {/* Narrative */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: meta.accentDim }}
                  >
                    <span className="text-[9px]" style={{ color: meta.accentText }}>✦</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Strategy</span>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{narrative}</p>
              </div>

              {/* Cost breakdown bars */}
              {cb && cb.grand_total_usd > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cost breakdown</span>
                  </div>
                  <div className="space-y-2.5">
                    <CostBar label="Cancellation costs (rev. loss + rebook + DOT 261)" value={cb.cancellation_total_usd} total={cb.grand_total_usd} color="#EF4444" />
                    <CostBar label="Delay costs (ops + crew OT + pax value-of-time)" value={cb.delay_total_usd} total={cb.grand_total_usd} color="#F97316" />
                    <CostBar label="Aircraft repositioning" value={cb.reposition_cost_usd} total={cb.grand_total_usd} color="#6366F1" />
                  </div>
                  <div
                    className="flex items-center justify-between mt-3 rounded-lg px-3 py-2"
                    style={{ background: meta.accentDim, border: `1px solid ${meta.border}` }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: meta.accentText }}>Total estimated impact</span>
                    <span className="font-mono font-black text-sm" style={{ color: meta.accentText }}>{fmtTotal}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 mt-1.5">
                    DOT BTS 2023 rates · $82.50/pax-hr delay · DOT Form 41 block-hour ops
                  </p>
                </div>
              )}

              {/* Operational impact summary */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operational impact</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-2.5 border border-border/50 bg-white/70">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <UserCheck className="w-3 h-3" /> Crew
                    </div>
                    <div className={`text-xs font-bold ${plan.crew_violations > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {plan.crew_violations > 0 ? `${plan.crew_violations} FAR117 flag${plan.crew_violations !== 1 ? "s" : ""}` : "Fully compliant"}
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5 border border-border/50 bg-white/70">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Plane className="w-3 h-3" /> Aircraft pos.
                    </div>
                    <div className={`text-xs font-bold ${(plan.aircraft_out_of_position || 0) > 0 ? "text-orange-600" : "text-emerald-600"}`}>
                      {plan.aircraft_out_of_position > 0 ? `${plan.aircraft_out_of_position} out-of-pos.` : "All in-position"}
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5 border border-border/50 bg-white/70">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Users className="w-3 h-3" /> Passengers
                    </div>
                    <div className="text-xs font-bold text-foreground">
                      {((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K pax·min
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5 border border-border/50 bg-white/70">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Clock className="w-3 h-3" /> Solve time
                    </div>
                    <div className="text-xs font-bold font-mono text-foreground">
                      {plan.solve_time_ms > 0 ? `${plan.solve_time_ms}ms` : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cancelled flights list */}
              {cancelled > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <X className="w-3 h-3 text-red-500" /> Cancellations ({cancelled})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.cancelled_flights.map((fid: string) => (
                      <button
                        key={fid}
                        onClick={() => onFlightSelect(fid)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 font-mono hover:bg-red-100 transition-colors"
                      >
                        {fid}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Delayed flights list */}
              {delayed > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-500" /> Delays ({delayed})
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-0.5 pr-0.5">
                    {plan.delayed_flights.slice(0, 30).map((d: any) => (
                      <div
                        key={d.flight_id}
                        className="flex items-center justify-between text-[10px] rounded-md px-2 py-1 hover:bg-white/80 cursor-pointer transition-colors"
                        onClick={() => onFlightSelect(d.flight_id)}
                      >
                        <span className="font-mono text-foreground/80">{d.flight_id}</span>
                        <span className="font-mono font-bold text-orange-600">+{d.delay_minutes}m</span>
                      </div>
                    ))}
                    {delayed > 30 && (
                      <p className="text-[9px] text-muted-foreground/60 px-2 pt-0.5">+{delayed - 30} more…</p>
                    )}
                  </div>
                </div>
              )}

              {/* Aircraft swaps list */}
              {swaps > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Repeat2 className="w-3 h-3 text-sky-500" /> Aircraft swaps ({swaps})
                  </div>
                  <div className="space-y-1">
                    {plan.aircraft_swaps.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] bg-white/70 rounded-md px-2 py-1">
                        <span className="font-mono text-foreground/80 flex-1">{s.flight_id}</span>
                        <span className="font-mono text-red-600">{s.old_aircraft}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono text-emerald-600">{s.new_aircraft}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cancelled === 0 && delayed === 0 && swaps === 0 && (
                <p className="text-xs text-muted-foreground italic">No flight actions required — the schedule remains intact.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  if (recoveryPlans.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="panel-header">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(43,168,162,0.12)" }}>
            <Activity className="w-3.5 h-3.5" style={{ color: "#2BA8A2" }} />
          </div>
          <div>
            <div className="section-title">Recovery Plans</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">3 differentiated strategies</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #E8F6F5 0%, #FFF8E7 100%)", border: "1px solid rgba(43,168,162,0.15)" }}
          >
            <Sparkles className="w-7 h-7" style={{ color: "#2BA8A2" }} />
          </div>
          <p className="text-sm font-bold text-foreground mb-1.5">Awaiting disruption</p>
          <p className="text-xs text-muted-foreground/80 max-w-[200px]">
            Trigger an event to receive 3 ranked recovery plans with cost breakdowns
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-2 font-mono">solved in &lt;5ms</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(43,168,162,0.12)" }}>
          <Activity className="w-3.5 h-3.5" style={{ color: "#2BA8A2" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="section-title">Recovery Plans</div>
          {cascadeSummary && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
              <span className="font-bold" style={{ color: "#EF6C4A" }}>{cascadeSummary.total_affected}</span>
              <span>flights affected ·</span>
              <span>{cascadeSummary.directly_affected} direct ·</span>
              <span>{(cascadeSummary.cascade_1 || 0) + (cascadeSummary.cascade_2 || 0)} cascade</span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable plan list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {recoveryPlans.map((plan: any, i: number) => (
          <PlanCard
            key={plan.plan_id}
            plan={plan}
            index={i}
            isSelected={false}
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
