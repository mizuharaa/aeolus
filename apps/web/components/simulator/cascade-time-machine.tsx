"use client"
/**
 * CascadeTimeMachine — scrub the disruption hour by hour and watch the
 * counterfactual diverge.
 *
 * The scrubber replays the cascade in departure order: a flight "enters"
 * the disruption at its scheduled departure. At any time T the strip shows
 *   · rose bars   — flights hit per hour under NO ACTION
 *   · teal bars   — flights still impacted per hour under the selected plan
 * and the ledger beneath compares cumulative delay / pax / burn at T.
 *
 * Counterfactual model (stated, not hidden): under a plan, a flight's
 * residual delay is the plan's own delay entry; plan-cancelled flights are
 * counted separately; flights the plan doesn't touch are treated as
 * recovered by upstream fixes. This mirrors how the optimizer's
 * cost_breakdown accounts for pax-delay minutes.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { useSimulationStore, type RecoveryPlan } from "@/stores/simulation"
import { c, ff, r, sp } from "@/lib/design-tokens"

const HOUR = 3_600_000
const PAX_FALLBACK = 150
const PAX_DELAY_COST_PER_MIN_USD = 82.5 / 60 // same constant as use-live-cost

function fmtZ(ms: number) {
  return new Date(ms).toISOString().slice(11, 16) + "Z"
}
function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

export function CascadeTimeMachine() {
  const { schedule, flightStates, recoveryPlans, appliedPlanId } = useSimulationStore()
  const [planId, setPlanId] = useState<string | null>(appliedPlanId)
  const [tMs, setTMs] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const playRef = useRef<number | null>(null)

  // affected flights, keyed with baseline state + departure time
  const affected = useMemo(
    () =>
      schedule
        .map((f) => ({ f, st: flightStates[f.id] }))
        .filter((x) => x.st && x.st.cascade_order >= 0)
        .map((x) => ({
          id: x.f.id,
          depMs: Date.parse(x.f.scheduled_departure),
          pax: x.f.passengers ?? PAX_FALLBACK,
          delayMin: x.st.status === "cancelled" ? 0 : x.st.delay_minutes || 0,
          cancelled: x.st.status === "cancelled",
        }))
        .filter((x) => Number.isFinite(x.depMs))
        .sort((a, b) => a.depMs - b.depMs),
    [schedule, flightStates],
  )

  const window_ = useMemo(() => {
    if (affected.length === 0) return null
    const start = Math.floor(affected[0].depMs / HOUR) * HOUR
    const end = Math.ceil((affected[affected.length - 1].depMs + 1) / HOUR) * HOUR
    return { start, end, hours: Math.max(1, Math.round((end - start) / HOUR)) }
  }, [affected])

  // default the playhead to the end (full cascade visible)
  useEffect(() => {
    if (window_ && tMs === null) setTMs(window_.end)
  }, [window_, tMs])

  // play: advance 20 min of sim time per tick until the end
  useEffect(() => {
    if (!playing || !window_) return
    playRef.current = window.setInterval(() => {
      setTMs((t) => {
        const next = (t ?? window_.start) + 20 * 60_000
        if (next >= window_.end) {
          setPlaying(false)
          return window_.end
        }
        return next
      })
    }, 120)
    return () => {
      if (playRef.current != null) window.clearInterval(playRef.current)
    }
  }, [playing, window_])

  const plan: RecoveryPlan | null = recoveryPlans.find((p) => p.plan_id === planId) ?? null
  const planDelay = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of plan?.delayed_flights ?? []) m.set(d.flight_id, d.delay_minutes)
    return m
  }, [plan])
  const planCancelled = useMemo(() => new Set(plan?.cancelled_flights ?? []), [plan])

  if (!window_ || affected.length === 0 || tMs === null) {
    return (
      <div style={{ padding: sp.md, fontFamily: ff.body, display: "flex", alignItems: "center", gap: sp.sm }}>
        <span className="ae-punch">Time machine</span>
        <span style={{ fontSize: 12.5, color: c.muted }}>
          Waiting for the cascade — once flights are affected you can scrub the disruption hour by hour and compare plans.
        </span>
      </div>
    )
  }
  const T = Math.min(Math.max(tMs, window_.start), window_.end)

  // per-hour histogram: baseline hits vs plan-residual hits
  const bars = Array.from({ length: window_.hours }, (_, h) => ({ base: 0, residual: 0 }))
  let cum = { flights: 0, delayMin: 0, pax: 0, planResidualMin: 0, planCancelled: 0, savedMin: 0 }
  for (const a of affected) {
    const h = Math.min(window_.hours - 1, Math.floor((a.depMs - window_.start) / HOUR))
    bars[h].base++
    const residual = planCancelled.has(a.id) ? 0 : planDelay.get(a.id) ?? 0
    if (plan && (residual > 0 || planCancelled.has(a.id))) bars[h].residual++
    if (a.depMs <= T) {
      cum.flights++
      cum.delayMin += a.delayMin
      cum.pax += a.pax
      if (plan) {
        cum.planResidualMin += residual
        if (planCancelled.has(a.id)) cum.planCancelled++
        else cum.savedMin += Math.max(0, a.delayMin - residual)
      }
    }
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.base))
  const burn = cum.delayMin * (cum.flights ? cum.pax / cum.flights : PAX_FALLBACK) * PAX_DELAY_COST_PER_MIN_USD / 60
  const frac = (T - window_.start) / (window_.end - window_.start)

  return (
    <div style={{ padding: sp.md, fontFamily: ff.body }}>
      {/* header row: title, plan chips, play */}
      <div style={{ display: "flex", alignItems: "center", gap: sp.sm, flexWrap: "wrap", marginBottom: sp.sm }}>
        <span className="ae-punch">Time machine</span>
        <span style={{ fontFamily: ff.mono, fontSize: 13, fontWeight: 600, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
          {fmtZ(T)}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "inline-flex", borderRadius: r.sm, border: `1px solid ${c.hairline}`, overflow: "hidden" }}>
          {[{ id: null as string | null, label: "No action" }, ...recoveryPlans.map((p) => ({ id: p.plan_id as string | null, label: `Plan ${p.plan_id}` }))].map((o) => {
            const active = planId === o.id
            return (
              <button
                key={o.label}
                onClick={() => setPlanId(o.id)}
                style={{
                  border: "none", fontSize: 12, fontWeight: 550, padding: "6px 10px", fontFamily: ff.body,
                  background: active ? c.ink : c.canvas, color: active ? c.onPrimary : c.body, cursor: "pointer",
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => {
            if (!playing && T >= window_.end) setTMs(window_.start)
            setPlaying((p) => !p)
          }}
          aria-label={playing ? "Pause replay" : "Replay cascade"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${c.borderStrong}`,
            background: "transparent", color: c.ink, borderRadius: 999, padding: "6px 14px",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff.body,
          }}
        >
          {playing ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
          {playing ? "Pause" : "Replay"}
        </button>
      </div>

      {/* hour histogram + playhead */}
      <div style={{ position: "relative", height: 72, display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 6 }}>
        {bars.map((b, i) => {
          const hourStart = window_.start + i * HOUR
          const past = hourStart < T
          return (
            <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
              <div
                title={`${fmtZ(hourStart)} — ${b.base} flight${b.base !== 1 ? "s" : ""} hit`}
                style={{
                  flex: 1, borderRadius: "3px 3px 0 0",
                  height: `${(b.base / maxBar) * 100}%`,
                  minHeight: b.base > 0 ? 3 : 0,
                  background: "var(--ae-rose)",
                  opacity: past ? 0.85 : 0.22,
                  transition: "opacity 160ms ease",
                }}
              />
              {plan && (
                <div
                  title={`${fmtZ(hourStart)} — ${b.residual} still impacted under Plan ${plan.plan_id}`}
                  style={{
                    flex: 1, borderRadius: "3px 3px 0 0",
                    height: `${(b.residual / maxBar) * 100}%`,
                    minHeight: b.residual > 0 ? 3 : 0,
                    background: "var(--ae-teal)",
                    opacity: past ? 0.85 : 0.22,
                    transition: "opacity 160ms ease",
                  }}
                />
              )}
            </div>
          )
        })}
        <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${frac * 100}%`, width: 2, background: c.ink, borderRadius: 2 }} />
      </div>

      {/* scrubber */}
      <input
        type="range"
        aria-label="Scrub cascade time"
        min={window_.start}
        max={window_.end}
        step={5 * 60_000}
        value={T}
        onChange={(e) => {
          setPlaying(false)
          setTMs(Number(e.target.value))
        }}
        style={{ width: "100%", accentColor: "var(--ae-teal)", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ff.mono, fontSize: 10, color: c.muted, marginBottom: sp.sm }}>
        <span>{fmtZ(window_.start)}</span>
        <span>{fmtZ(window_.end)}</span>
      </div>

      {/* cumulative ledger at T — baseline vs plan */}
      <div style={{ display: "flex", gap: sp.lg, flexWrap: "wrap", fontVariantNumeric: "tabular-nums" }}>
        <Ledger
          title="No action"
          tone="var(--ae-rose-ink)"
          rows={[
            [`${cum.flights}`, "flights hit"],
            [`${cum.delayMin.toLocaleString()} min`, "cumulative delay"],
            [`${cum.pax.toLocaleString()}`, "pax exposed"],
            [fmtUsd(burn), "delay burn (est.)"],
          ]}
        />
        {plan && (
          <Ledger
            title={`Plan ${plan.plan_id} — ${plan.objective_label ?? "recovery"}`}
            tone="var(--ae-teal-ink)"
            rows={[
              [`${cum.savedMin.toLocaleString()} min`, "delay avoided by now"],
              [`${cum.planResidualMin.toLocaleString()} min`, "residual delay"],
              [`${cum.planCancelled}`, "flights cancelled"],
              [fmtUsd(cum.savedMin * PAX_FALLBACK * PAX_DELAY_COST_PER_MIN_USD / 60), "burn avoided (est.)"],
            ]}
          />
        )}
      </div>
      <div style={{ marginTop: sp.xs, fontSize: 10.5, color: c.muted, fontStyle: "italic" }}>
        Model: flights enter at scheduled departure; plan residuals from the optimizer&apos;s own delay/cancel lists; untouched flights treated as recovered upstream.
      </div>
    </div>
  )
}

function Ledger({ title, tone, rows }: { title: string; tone: string; rows: [string, string][] }) {
  return (
    <div style={{ minWidth: 220, flex: "1 1 220px" }}>
      <div style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.1em", color: tone, marginBottom: 6, fontFamily: ff.mono }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 10, rowGap: 3 }}>
        {rows.map(([v, label]) => (
          <span key={label} style={{ display: "contents" }}>
            <span style={{ fontFamily: ff.mono, fontSize: 13, fontWeight: 600, color: c.ink, textAlign: "right" }}>{v}</span>
            <span style={{ fontSize: 12, color: c.muted }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
