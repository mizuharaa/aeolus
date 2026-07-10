"use client"
/**
 * useLiveCost — animated cost ticker for recovery plans.
 *
 * Why this exists
 * ───────────────
 * Static cost numbers on a "live" OCC dashboard read as a screenshot. Real
 * disruptions accrue cost every minute they run: passenger value-of-time,
 * crew overtime. A motionless `$23K` next to a triggered event breaks the
 * illusion that the system is alive.
 *
 * Burn-rate model — straight from the backend cost calculator
 * ───────────────────────────────────────────────────────────
 * Every per-minute constant below is sourced from
 * `apps/api/src/costs/calculator.py`. No invented heuristics:
 *
 *   PAX_TOTAL_DELAY_COST_PER_MIN_USD = 82.50 / 60 = $1.375 per pax-minute
 *     (DOT BTS 2023 "Cost of Airline Delays" — passenger value of time,
 *      missed connections, hotel/meal, ground transport)
 *
 *   CREW_OVERTIME_PER_HOUR_USD = $480/hr = $8.00 per minute
 *     (Pilot collective bargaining average, 2023 contracts)
 *
 *   VARIABLE_COST_FRACTION = 0.62
 *     (Variable portion of block-hour cost — APU fuel, maintenance labour
 *      prorated, NOT fixed gate fees. From DOT Form 41.)
 *
 * Per delayed flight, the per-minute burn is:
 *
 *   rate_f = pax_f × $1.375
 *          + ($480 / 60) × applicable    where applicable = 1 if delay ≥ 60 min
 *          + (block_hour_$ × 0.62 / 60)   ≈ $35/min for narrow-body, ~$50/min for wide-body
 *
 * For ticker honesty we omit the variable_ops term (block-hour data is not
 * carried on the plan payload) and the DOT-261 step charges (one-shot, not
 * continuous — they shouldn't drive a smooth tick). The displayed rate is
 * therefore a CONSERVATIVE lower bound on real airline burn.
 *
 * Pax counts come from the Zustand `schedule` — actual per-flight pax, not
 * a 160-average. A Nimbus E175 leg burns at 76 × $1.375 = $104/min; a B757
 * burns at 200 × $1.375 = $275/min. The difference matters.
 *
 * Return value
 * ────────────
 *   - `cost`        — interpolated dollar total, recomputed each animation frame
 *   - `ratePerMin`  — per-minute burn (display beside the total)
 *   - `elapsedSec`  — seconds since the anchor; useful for diagnostics
 *
 * The anchor resets whenever the underlying plan identity or its dollar
 * total changes — i.e. only on real plan refreshes, not on every render.
 */
import { useEffect, useRef, useState } from "react"
import type { RecoveryPlan, ScheduledFlight } from "@/stores/simulation"
import { useSimulationStore } from "@/stores/simulation"

// Sourced from apps/api/src/costs/calculator.py
const PAX_DELAY_COST_PER_MIN_USD = 82.5 / 60        // = 1.375
const CREW_OT_PER_MIN_USD        = 480 / 60         // = 8.00
const CREW_OT_TRIGGER_MIN        = 60               // OT only kicks in once a flight's delay exceeds 60 min
const PAX_FALLBACK               = 150              // narrow-body average if schedule lookup misses

interface LiveCost {
  cost:       number
  ratePerMin: number
  elapsedSec: number
}

/**
 * Compute the per-minute burn rate for the plan's currently-delayed flights.
 * Reads ACTUAL pax counts from the supplied schedule. No invented constants.
 */
function computeRatePerMin(plan: RecoveryPlan, schedule: ScheduledFlight[]): number {
  if (!plan.delayed_flights || plan.delayed_flights.length === 0) return 0

  // Build a flight-id → pax lookup once. Schedule is small (~200 entries),
  // so a Map keeps the cost negligible across re-anchors.
  const paxByFlight = new Map<string, number>()
  for (const f of schedule) {
    paxByFlight.set(f.id, f.passengers ?? PAX_FALLBACK)
  }

  let rate = 0
  for (const d of plan.delayed_flights) {
    const pax = paxByFlight.get(d.flight_id) ?? PAX_FALLBACK
    rate += pax * PAX_DELAY_COST_PER_MIN_USD
    // Crew overtime only accrues once the leg has been delayed past
    // the FAR-overtime trigger. Approximate "is this flight currently
    // accruing OT?" by checking whether the planned delay exceeds 60 min.
    if (d.delay_minutes >= CREW_OT_TRIGGER_MIN) {
      rate += CREW_OT_PER_MIN_USD
    }
  }
  return rate
}

export function useLiveCost(plan: RecoveryPlan | null | undefined): LiveCost {
  const schedule = useSimulationStore((s) => s.schedule)
  const [tick, setTick] = useState(0)
  const anchorRef = useRef<{
    baseCost:   number
    anchorMs:   number
    ratePerMin: number
    key:        string
  } | null>(null)
  const timerRef = useRef<number | null>(null)

  // Re-anchor when the plan identity or its cost changes. We deliberately
  // do NOT include `plan` itself in the deps — only the derived fields —
  // so re-renders that produce a new object reference but identical numbers
  // don't restart the integrator and cause a visible jitter.
  useEffect(() => {
    if (!plan) {
      anchorRef.current = null
      setTick((t) => t + 1)
      return
    }
    const baseCost   = plan.cost_breakdown?.grand_total_usd ?? plan.total_cost_usd ?? 0
    const ratePerMin = computeRatePerMin(plan, schedule)
    anchorRef.current = {
      baseCost,
      anchorMs:   Date.now(),
      ratePerMin,
      key:        `${plan.plan_id}:${baseCost}:${plan.delayed_flights?.length ?? 0}`,
    }
    setTick((t) => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plan?.plan_id,
    plan?.cost_breakdown?.grand_total_usd,
    plan?.total_cost_usd,
    plan?.delayed_flights?.length,
    plan?.cancelled_flights?.length,
    schedule.length,
  ])

  // 30fps animation loop — recompute tick so React re-renders. Cheap because
  // the actual displayed value is computed below from the anchor; we don't
  // store an integrator in React state.
  useEffect(() => {
    if (!anchorRef.current) return
    const loop = () => {
      setTick((t) => t + 1)
      timerRef.current = window.setTimeout(loop, 33)
    }
    timerRef.current = window.setTimeout(loop, 33)
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [anchorRef.current?.key])

  void tick
  if (!anchorRef.current) {
    return { cost: 0, ratePerMin: 0, elapsedSec: 0 }
  }
  const { baseCost, anchorMs, ratePerMin } = anchorRef.current
  const elapsedMs  = Date.now() - anchorMs
  const elapsedMin = elapsedMs / 60_000
  return {
    cost:       baseCost + ratePerMin * elapsedMin,
    ratePerMin,
    elapsedSec: Math.floor(elapsedMs / 1000),
  }
}

/**
 * useIndecisionCost — "every minute you don't commit a plan costs $X".
 *
 * While a disruption is active and NO recovery plan has been applied, the
 * network's currently-delayed flights burn cost at the same per-minute rates
 * as useLiveCost (pax value-of-time + crew OT past 60 min — same constants,
 * same conservative lower bound). Accrual is anchored to the event's
 * `triggered_at`, so the number is derived, not integrated: reloading the
 * page shows the same total.
 */
export function useIndecisionCost(): { active: boolean; ratePerMin: number; accrued: number } {
  const { activeEvents, appliedPlanId, flightStates, schedule } = useSimulationStore()
  const [, setTick] = useState(0)

  const hasEvent = activeEvents.length > 0
  const active = hasEvent && !appliedPlanId

  // 1 Hz re-render while the meter is live — per-second precision is plenty.
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [active])

  if (!active) return { active: false, ratePerMin: 0, accrued: 0 }

  const paxByFlight = new Map<string, number>()
  for (const f of schedule) paxByFlight.set(f.id, f.passengers ?? PAX_FALLBACK)

  let rate = 0
  for (const s of Object.values(flightStates)) {
    if (s.status === "cancelled" || !(s.delay_minutes > 0)) continue
    rate += (paxByFlight.get(s.flight_id) ?? PAX_FALLBACK) * PAX_DELAY_COST_PER_MIN_USD
    if (s.delay_minutes >= CREW_OT_TRIGGER_MIN) rate += CREW_OT_PER_MIN_USD
  }
  if (rate === 0) return { active: false, ratePerMin: 0, accrued: 0 }

  const triggeredMs = activeEvents
    .map((e) => (e.triggered_at ? Date.parse(e.triggered_at) : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0]
  const elapsedMin = Number.isFinite(triggeredMs) ? Math.max(0, (Date.now() - (triggeredMs as number)) / 60_000) : 0

  return { active: true, ratePerMin: rate, accrued: rate * elapsedMin }
}

/** Format a dollar amount in the same idiom used across the dashboard. */
export function fmtUsdShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}
