"use client"
/**
 * CrewLegalityLedger — the FAR 117 countdown board.
 *
 * One row per crew pairing (proxied by aircraft rotation — the crew that
 * flies a tail's affected legs today), ranked by how soon they time out:
 *
 *   duty start   = first affected leg's scheduled departure − 60 min report
 *   FDP limit    = duty start + 13h  (FAR 117 Table B, mid-band)
 *   proj release = last leg's scheduled arrival + current delay + 15 min
 *   margin       = FDP limit − projected release
 *
 * The countdown ("times out in …") runs against the wall clock live. The
 * plan chips show how many crews each recovery plan pushes past their FDP
 * limit — the optimizer's crew_violations, made legible as a countdown.
 * The model is a frontend derivation from the schedule; it is labeled as
 * such and mirrors the constants used by the backend legality checker.
 */
import { useEffect, useMemo, useState } from "react"
import { useSimulationStore } from "@/stores/simulation"
import { c, ff, r, sp } from "@/lib/design-tokens"

const REPORT_MIN = 60
const FDP_LIMIT_MIN = 13 * 60
const RELEASE_PAD_MIN = 15

interface Rotation {
  tail: string
  legs: string[]
  dutyStartMs: number
  limitMs: number
  releaseMs: number // projected, with current delays
  marginMin: number
}

function fmtHM(min: number): string {
  const sign = min < 0 ? "−" : ""
  const a = Math.abs(Math.round(min))
  return `${sign}${Math.floor(a / 60)}h ${String(a % 60).padStart(2, "0")}m`
}
function fmtZ(ms: number) {
  return new Date(ms).toISOString().slice(11, 16) + "Z"
}

export function CrewLegalityLedger() {
  const { schedule, flightStates, recoveryPlans, appliedPlanId } = useSimulationStore()
  const [, setTick] = useState(0)

  // live countdown, 30s resolution is plenty
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const rotations = useMemo<Rotation[]>(() => {
    const byTail = new Map<string, { dep: number; arr: number; delay: number; id: string }[]>()
    for (const f of schedule) {
      const st = flightStates[f.id]
      if (!st || st.cascade_order < 0) continue
      const tail = f.aircraft_id ?? f.tail_number
      if (!tail) continue
      const dep = Date.parse(f.scheduled_departure)
      const arr = Date.parse(f.scheduled_arrival)
      if (!Number.isFinite(dep) || !Number.isFinite(arr)) continue
      const delay = st.status === "cancelled" ? 0 : st.delay_minutes || 0
      const list = byTail.get(tail) ?? []
      list.push({ dep, arr, delay, id: f.id })
      byTail.set(tail, list)
    }
    const out: Rotation[] = []
    for (const [tail, legs] of byTail) {
      legs.sort((a, b) => a.dep - b.dep)
      const dutyStartMs = legs[0].dep - REPORT_MIN * 60_000
      const limitMs = dutyStartMs + FDP_LIMIT_MIN * 60_000
      const last = legs[legs.length - 1]
      const releaseMs = last.arr + (Math.max(...legs.map((l) => l.delay)) + RELEASE_PAD_MIN) * 60_000
      out.push({
        tail,
        legs: legs.map((l) => l.id),
        dutyStartMs,
        limitMs,
        releaseMs,
        marginMin: (limitMs - releaseMs) / 60_000,
      })
    }
    return out.sort((a, b) => a.marginMin - b.marginMin)
  }, [schedule, flightStates])

  // per-plan: how many rotations go illegal under the plan's own delays
  const planTimeouts = useMemo(() => {
    const res = new Map<string, number>()
    for (const p of recoveryPlans) {
      const delayByFlight = new Map(p.delayed_flights?.map((d) => [d.flight_id, d.delay_minutes]) ?? [])
      const cancelled = new Set(p.cancelled_flights ?? [])
      let n = 0
      for (const rot of rotations) {
        const active = rot.legs.filter((l) => !cancelled.has(l))
        if (active.length === 0) continue
        const planDelay = Math.max(0, ...active.map((l) => delayByFlight.get(l) ?? 0))
        // residual model: the plan's delay REPLACES the cascade delay
        const baseArrMs = rot.releaseMs - (RELEASE_PAD_MIN + maxBaselineDelay(rot, flightStates)) * 60_000
        const releaseMs = baseArrMs + (planDelay + RELEASE_PAD_MIN) * 60_000
        if (rot.limitMs - releaseMs < 0) n++
      }
      res.set(p.plan_id, n)
    }
    return res
  }, [recoveryPlans, rotations, flightStates])

  if (rotations.length === 0) {
    return (
      <div style={{ padding: sp.md, fontFamily: ff.body, display: "flex", alignItems: "center", gap: sp.sm }}>
        <span className="ae-punch">FAR 117 countdown</span>
        <span style={{ fontSize: 12.5, color: c.muted }}>
          No affected rotations — trigger a disruption and every impacted crew pairing appears here with its duty-timeout clock.
        </span>
      </div>
    )
  }
  const now = Date.now()
  const worst = rotations.filter((rot) => rot.marginMin < 60).length

  return (
    <div style={{ padding: sp.md, fontFamily: ff.body }}>
      <div style={{ display: "flex", alignItems: "center", gap: sp.sm, flexWrap: "wrap", marginBottom: sp.sm }}>
        <span className="ae-punch">FAR 117 countdown</span>
        <span style={{ fontSize: 12.5, color: c.muted }}>
          {rotations.length} crew pairing{rotations.length !== 1 ? "s" : ""} on affected rotations
          {worst > 0 && <strong style={{ color: "var(--ae-rose-ink)" }}> · {worst} inside the final hour</strong>}
        </span>
        <div style={{ flex: 1 }} />
        {recoveryPlans.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: c.muted, fontFamily: ff.mono, letterSpacing: "0.08em" }}>TIMEOUTS BY PLAN</span>
            {recoveryPlans.map((p) => {
              const n = planTimeouts.get(p.plan_id) ?? 0
              const applied = appliedPlanId === p.plan_id
              return (
                <span
                  key={p.plan_id}
                  title={`${n} crew pairing${n !== 1 ? "s" : ""} would exceed FDP under Plan ${p.plan_id}`}
                  style={{
                    fontFamily: ff.mono, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                    background: n === 0 ? "var(--ae-teal-bg)" : "var(--ae-rose-bg)",
                    color: n === 0 ? "var(--ae-teal-ink)" : "var(--ae-rose-ink)",
                    border: `1px solid ${applied ? c.ink : "transparent"}`,
                  }}
                >
                  {p.plan_id}·{n}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${c.hairline}` }}>
        {rotations.slice(0, 8).map((rot) => {
          const untilTimeoutMin = (rot.limitMs - now) / 60_000
          const tone =
            rot.marginMin < 0 ? { ink: "var(--ae-rose-ink)", label: "TIMEOUT" } :
            rot.marginMin < 60 ? { ink: "var(--ae-amber-ink)", label: "CRITICAL" } :
            rot.marginMin < 180 ? { ink: "var(--ae-amber-ink)", label: "WATCH" } :
            { ink: "var(--ae-teal-ink)", label: "LEGAL" }
          const pct = Math.max(0, Math.min(1, rot.marginMin / FDP_LIMIT_MIN))
          return (
            <div
              key={rot.tail}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 84px minmax(120px, 1fr) 150px 150px",
                gap: sp.sm,
                alignItems: "center",
                padding: "9px 4px",
                borderBottom: `1px solid ${c.hairline}`,
              }}
            >
              <span style={{ fontFamily: ff.mono, fontSize: 13, fontWeight: 600, color: c.ink }}>{rot.tail}</span>
              <span style={{ fontFamily: ff.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: tone.ink }}>{tone.label}</span>
              <span title={`Duty margin: ${fmtHM(rot.marginMin)} of ${fmtHM(FDP_LIMIT_MIN)} FDP`} style={{ display: "block", height: 6, borderRadius: r.pill, background: c.surfaceStrong, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${pct * 100}%`, borderRadius: r.pill, background: rot.marginMin < 0 ? "var(--ae-rose)" : rot.marginMin < 60 ? "var(--ae-amber)" : "var(--ae-teal)" }} />
              </span>
              <span style={{ fontFamily: ff.mono, fontSize: 12, color: c.body, fontVariantNumeric: "tabular-nums" }}>
                {untilTimeoutMin > 0 ? `times out in ${fmtHM(untilTimeoutMin)}` : `FDP ended ${fmtZ(rot.limitMs)}`}
              </span>
              <span style={{ fontFamily: ff.mono, fontSize: 12, color: rot.marginMin < 0 ? "var(--ae-rose-ink)" : c.body, fontVariantNumeric: "tabular-nums" }}>
                release {fmtZ(rot.releaseMs)} · {fmtHM(rot.marginMin)}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: sp.xs, fontSize: 10.5, color: c.muted, fontStyle: "italic" }}>
        Derived on the client: crew ≈ aircraft rotation; report −60 min, 13h FDP (Table B mid-band), release +15 min. The solver&apos;s own crew_violations remain authoritative.
      </div>
    </div>
  )
}

function maxBaselineDelay(rot: Rotation, flightStates: Record<string, { delay_minutes: number; status: string }>): number {
  return Math.max(0, ...rot.legs.map((l) => {
    const st = flightStates[l]
    return st && st.status !== "cancelled" ? st.delay_minutes || 0 : 0
  }))
}
