"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, AlertCircle, CheckCircle2, Clock,
  Plane, Play, X, Sparkles, ShieldCheck, Activity,
  Repeat2, UserCheck, AlertTriangle,
  Leaf, ArrowRight,
} from "lucide-react"
import { useSimulationStore, useHasActiveDisruption } from "@/stores/simulation"
import { airportLabel, aircraftLabel } from "@/lib/labels"
import { c, ff, r, sp, sh, type } from "@/lib/design-tokens"
import { CreamCallout, Eyebrow, Type } from "@/components/ds/primitives"
import { LiveCostDisplay } from "@/components/ds/live-cost"

// ─── Plan metadata ────────────────────────────────────────────────────────
const PLAN_META = {
  A: { label: "Minimize Cost",    short: "Cost", sublabel: "Lowest financial exposure" },
  B: { label: "Min. Pax Impact",  short: "Pax",  sublabel: "Best passenger experience" },
  C: { label: "Protect Tomorrow", short: "Tmrw", sublabel: "Minimizes next-day cascades" },
  D: { label: "Green Recovery",   short: "CO₂",  sublabel: "Lowest carbon footprint" },
} as const

const APPLIED_ACCENT = "var(--ae-teal)"

// ─── Solver-status pill ───────────────────────────────────────────────────
// Every MILP solve reports "optimal" for ITS OWN objective — stamping
// OPTIMAL on every plan is noise. Render only when the solve is abnormal.
function SolverStatus({ status }: { status: string }) {
  if (status === "optimal" || status === "feasible") return null
  const map: Record<string, { Icon: typeof CheckCircle2; ink: string; bg: string }> = {
    heuristic:  { Icon: Clock,       ink: c.statusDelayed.ink, bg: c.statusDelayed.bg },
    infeasible: { Icon: AlertCircle, ink: c.statusDelayed.ink, bg: c.statusDelayed.bg },
  }
  const s = map[status] || map.heuristic
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
        padding: "2px 8px", borderRadius: r.pill, background: s.bg, color: s.ink, fontFamily: ff.body,
      }}
    >
      <s.Icon style={{ width: 10, height: 10 }} />
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

// ─── Money formatting ─────────────────────────────────────────────────────
const fmtUsd = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${(v / 1000).toFixed(0)}K`

const planCost = (p: any) => p.cost_breakdown?.grand_total_usd || p.total_cost_usd || 0

// ═══ THE DECISION MATRIX ═══════════════════════════════════════════════════
// All four plans side by side, one metric per row, the BEST value per row
// underlined in teal. Clicking a column selects that plan for the detail
// ledger below. This is where "which plan?" gets answered — the detail
// panel is for "what exactly does it do?".

function DecisionMatrix({
  plans, selectedId, appliedId, onSelect,
}: {
  plans: any[]
  selectedId: string
  appliedId: string | null
  onSelect: (id: string) => void
}) {
  // When the disruption's duration is unknown, a point cost is a half-truth:
  // show what the plan costs in EXPECTATION and how much worse it gets if the
  // closure runs long. Rows only appear when the backend priced a distribution.
  const uncertain = plans.some((p) => p.uncertainty)

  /**
   * Metric rows: label + accessor + formatter (lower is better for all).
   *
   * `rankable: false` means the row is REPORTED but never crowned.
   *
   * Pax·min and tCO₂e are both metrics that CANCELLING A FLIGHT ZEROES OUT: a
   * cancelled passenger accrues no delay minutes and a cancelled flight burns
   * no fuel. Ranking them naively meant the matrix awarded "best" to whichever
   * plan destroyed the most — measured live, Plan D cancelled 39 of 39 flights
   * and was crowned best on Pax·min with `0.0K` while also taking tCO₂e. A
   * comparison table that recommends the most destructive option because
   * destruction minimises the metric is not a rounding error, it is the table
   * giving the wrong answer to the only question it exists to answer.
   *
   * The honest fix is not a smarter formula — pricing a cancelled passenger's
   * full disruption belongs in the optimizer, not in a table cell. It is to
   * stop asserting a winner on a metric whose scale the plan itself moves, and
   * say so in the footnote. Cost, E[cost], Regret and FAR 117 are unaffected
   * by this and stay rankable; Cancels is the count doing the distorting, so it
   * is reported plainly rather than ranked as a virtue.
   */
  const rows: { label: string; get: (p: any) => number; fmt: (v: number) => string; rankable?: boolean }[] = [
    { label: "Cost",    get: planCost,                                        fmt: fmtUsd },
    ...(uncertain
      ? [
          { label: "E[cost]", get: (p: any) => p.uncertainty?.expected_cost_usd ?? planCost(p), fmt: fmtUsd },
          { label: "Regret",  get: (p: any) => p.uncertainty?.max_regret_usd ?? 0,              fmt: fmtUsd },
        ]
      : []),
    { label: "Pax·min", get: (p) => p.total_passenger_delay_minutes || 0,     fmt: (v) => `${(v / 1000).toFixed(1)}K`, rankable: false },
    { label: "tCO₂e",   get: (p) => p.total_co2_kg ?? 0,                      fmt: (v) => `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}`, rankable: false },
    { label: "FAR 117", get: (p) => p.crew_violations || 0,                   fmt: (v) => (v === 0 ? "OK" : String(v)) },
    { label: "Cancels", get: (p) => p.cancelled_flights?.length || 0,         fmt: (v) => String(v), rankable: false },
  ]

  const cellW = `${Math.floor(100 / (plans.length + 1))}%`

  /**
   * ROVING TABINDEX over the plan columns.
   *
   * The four headers were four separate tab stops and the value cells were
   * `<td onClick>` with no role, no tabIndex and no key handler — so the
   * matrix that answers "which plan?" was entirely dead to the keyboard, on a
   * console where every other segmented control (the context column's tabs)
   * already implements this pattern. A dispatcher on keyboard could reach the
   * commit button but could not choose what it would commit.
   *
   * Arrow keys move between plans, Home/End jump to the ends, and only the
   * selected column is in the tab order — so Tab crosses the whole matrix in
   * one stop instead of four, which is the point of the pattern.
   */
  const headRef = useRef<HTMLTableRowElement>(null)
  const onHeadKeyDown = (e: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"]
    if (!keys.includes(e.key)) return
    const i = plans.findIndex((p) => p.plan_id === selectedId)
    if (i < 0) return
    e.preventDefault()
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? plans.length - 1
      : e.key === "ArrowRight" ? (i + 1) % plans.length
      : (i - 1 + plans.length) % plans.length
    const id = plans[next].plan_id
    onSelect(id)
    requestAnimationFrame(() => {
      headRef.current?.querySelector<HTMLButtonElement>(`[data-plan="${id}"]`)?.focus()
    })
  }

  return (
    <div style={{ padding: `${sp.sm}px ${sp.sm}px 0` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: ff.mono, fontSize: 11.5 }}>
        {/* A real caption, visually hidden. The table had none, so a screen
            reader announced an unlabelled grid of numbers. */}
        <caption className="ae-sr-only">
          Recovery plan comparison. {plans.length} plans, {rows.length} metrics.
          Use the left and right arrow keys on the plan headers to change which
          plan is inspected.
        </caption>
        <thead>
          <tr ref={headRef} onKeyDown={onHeadKeyDown}>
            <th style={{ width: cellW }} />
            {plans.map((p) => {
              const meta = PLAN_META[p.plan_id as keyof typeof PLAN_META] || PLAN_META.A
              const sel = p.plan_id === selectedId
              const applied = p.plan_id === appliedId
              return (
                <th key={p.plan_id} scope="col" style={{ width: cellW, padding: 0 }}>
                  {/* Visual weight follows CONSEQUENCE, not curiosity.
                      This was inverted: the INSPECTED tab was a punched-out ink
                      slab — the heaviest treatment in the panel — while the
                      APPLIED plan got a 3px border. Since inspection defaults
                      to the first plan, merely opening this panel made plan A
                      look committed, and it was read as "a plan auto-applied on
                      load". Applied now owns the filled slab; inspecting is an
                      outline, which is what a reversible act should look like. */}
                  <button
                    onClick={() => onSelect(p.plan_id)}
                    data-plan={p.plan_id}
                    tabIndex={sel ? 0 : -1}
                    aria-pressed={sel}
                    aria-current={applied ? "true" : undefined}
                    // The visible label is just the letter, so the accessible
                    // name has to carry what the letter means and what state
                    // it is in — "A" alone tells a screen-reader user nothing.
                    aria-label={
                      `Plan ${p.plan_id}, ${meta.label}` +
                      (applied ? ", currently applied" : sel ? ", inspecting" : "")
                    }
                    title={applied ? `${meta.label} — applied` : `${meta.label} — inspect`}
                    style={{
                      width: "100%",
                      padding: "12px 2px 10px",
                      border: "none",
                      borderBottom: `3px solid ${applied ? "var(--ae-teal)" : sel ? "var(--ae-text)" : "var(--ae-line)"}`,
                      background: applied ? "var(--ae-teal)" : "transparent",
                      boxShadow: !applied && sel ? "inset 0 0 0 1.5px var(--ae-text)" : undefined,
                      borderRadius: "10px 10px 0 0",
                      cursor: "pointer",
                      transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontFamily: ff.display,
                        fontWeight: 800,
                        fontSize: 22,
                        lineHeight: 1,
                        letterSpacing: "-0.01em",
                        // Follows the FILL, which is now `applied`, not `sel`.
                        color: applied ? "var(--ae-on-primary)" : c.ink,
                      }}
                    >
                      {p.plan_id}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: ff.mono,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginTop: 4,
                        color: applied ? "var(--ae-on-primary)" : sel ? c.ink : c.muted,
                      }}
                    >
                      {applied ? "Applied" : meta.short}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = plans.map(row.get)
            // NaN is never === a value, so an unrankable row crowns nothing.
            const best = row.rankable === false ? NaN : Math.min(...values)
            return (
              <tr key={row.label}>
                {/* scope="row": without it a screen reader cannot associate a
                    value with the metric it measures, so the table reads as a
                    bare grid of numbers. */}
                <th
                  scope="row"
                  style={{
                    padding: "6px 4px", textAlign: "left", fontWeight: 400,
                    fontFamily: ff.body, fontSize: 10.5, color: c.muted,
                    borderBottom: `1px solid ${c.hairline}`,
                  }}
                >
                  {row.label}
                </th>
                {plans.map((p, i) => {
                  const isBest = values[i] === best
                  const sel = p.plan_id === selectedId
                  return (
                    <td
                      key={p.plan_id}
                      // Click-to-select stays, but it is now a SHORTCUT rather
                      // than the only route: the column header is the real
                      // control and is keyboard-operable, so these cells do not
                      // need to be focus stops of their own — 4 plans × 6 rows
                      // would be 24 extra tab stops for one decision. Marked
                      // aria-hidden from interaction, not from reading: the
                      // value still announces as table data.
                      onClick={() => onSelect(p.plan_id)}
                      // Best is stated in TEXT for assistive tech, because the
                      // encoding is an underline and a brightness step — both
                      // invisible to a screen reader.
                      aria-label={isBest ? `${row.fmt(values[i])}, best in row` : undefined}
                      style={{
                        padding: "6px 2px",
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        // EMPHASIS FOLLOWS THE ANSWER, and it was inverted.
                        //
                        // The best value rendered `--ae-teal-ink` #B9A3EE
                        // (luminance 0.427) while ordinary values rendered
                        // `--ae-text-2` #C3C8D6 (luminance 0.578) — so the
                        // winner in every row was DARKER than the losers, at
                        // 1.24:1 between them. In a table whose entire purpose
                        // is answering "which plan", the answer was the least
                        // visible ink on screen and only a 2px underline
                        // carried it. Best is now the brightest thing in the
                        // row and the rest step back; the underline stays as
                        // the redundant, colour-independent channel.
                        fontWeight: isBest ? 700 : 450,
                        color: isBest ? c.ink : c.muted,
                        background: sel ? "var(--ae-surface-3)" : "transparent",
                        borderBottom: `1px solid ${c.hairline}`,
                        cursor: "pointer",
                      }}
                    >
                      <span style={isBest ? { borderBottom: "2px solid var(--ae-teal)", paddingBottom: 2 } : undefined}>
                        {row.fmt(values[i])}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p style={{ margin: "6px 2px 0", fontFamily: ff.mono, fontSize: 11, letterSpacing: "0.04em", color: c.muted }}>
        {/* Was "Teal = best of the four". There is no teal on screen — the
            mark renders plum, because `--ae-teal` is a token name kept for
            call-site stability whose VALUE was re-inked long ago. An internal
            token name had leaked into operator-facing copy and was naming a
            colour that does not exist. Describing the SHAPE instead of the
            hue also survives the light register and colour blindness. */}
        Underlined = best in row · click a column to inspect
        <br />
        Pax·min, tCO₂e and Cancels are reported, not ranked — cancelling a
        flight drives all three down.
      </p>
    </div>
  )
}

// ═══ THE PLAN LEDGER — full detail for the selected plan ═══════════════════

function PlanLedger({
  plan, isApplied, cheapestCost, onApply, onFlightSelect,
}: {
  plan: any
  isApplied: boolean
  cheapestCost: number
  onApply: () => void
  onFlightSelect: (id: string) => void
}) {
  const meta = PLAN_META[plan.plan_id as keyof typeof PLAN_META] || PLAN_META.A
  const { schedule, fleet } = useSimulationStore()

  const flightRoute = (fid: string): { codes: string; cities: string } => {
    const f = schedule.find((x) => x.id === fid)
    if (!f) return { codes: "", cities: "" }
    const o = airportLabel(f.origin)
    const d = airportLabel(f.destination)
    return {
      codes: `${o.iata || f.origin} → ${d.iata || f.destination}`,
      cities: o.city && d.city ? `${o.city} → ${d.city}` : "",
    }
  }

  const cancelled = plan.cancelled_flights?.length || 0
  const delayed   = plan.delayed_flights?.length   || 0
  const swaps     = plan.aircraft_swaps?.length    || 0
  const cb        = plan.cost_breakdown
  const totalCostUsd = planCost(plan)
  const violations = plan.crew_violations || 0

  // Committing a plan is irreversible in the operational sense — it dispatches
  // aircraft swaps, delays and cancellations across the network. It used to
  // fire from a single click on a 38px button carrying a media-transport ▶,
  // i.e. the same weight and gesture as dismissing a toast. Arming the button
  // first states the consequence in the operator's own units, then commits.
  // Inline rather than a modal: DESIGN.md treats modals as a last resort and a
  // dispatcher should not lose sight of the map to confirm.
  const [armed, setArmed] = useState(false)
  const confirmRef = useRef<HTMLDivElement>(null)
  const commitRef = useRef<HTMLButtonElement>(null)
  // Reset when the inspected plan changes — "show all" is a property of the
  // list you are looking at, not a preference that should follow you to D.
  const [showAllDelays, setShowAllDelays] = useState(false)
  useEffect(() => { setShowAllDelays(false) }, [plan.plan_id])

  // Mouse users get the old dismiss-on-look-away behaviour without keyboard
  // users losing focus: disarm only when the pointer goes down somewhere that
  // is neither the button nor the confirmation banner.
  useEffect(() => {
    if (!armed) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (confirmRef.current?.contains(t) || commitRef.current?.contains(t)) return
      setArmed(false)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [armed])
  // Disarm whenever the inspected plan changes, so an arm on plan B can never
  // be spent on plan C.
  useEffect(() => setArmed(false), [plan.plan_id, isApplied])

  return (
    <motion.div
      key={plan.plan_id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      style={{ padding: sp.sm, display: "flex", flexDirection: "column", gap: sp.sm, fontFamily: ff.body }}
    >
      {/* ── identity + apply ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.sm }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eyebrow color={isApplied ? c.statusRecovered.ink : c.muted}>Plan {plan.plan_id}</Eyebrow>
            {isApplied && (
              <span style={{ fontSize: 10, fontWeight: 550, padding: "2px 7px", borderRadius: r.pill, background: c.statusRecovered.bg, color: c.statusRecovered.ink }}>
                Applied
              </span>
            )}
            <SolverStatus status={plan.status} />
          </div>
          <div style={{ ...type("titleLg", c.ink), marginTop: 3 }}>{meta.label}</div>
          <div style={{ ...type("bodyMd", c.muted), fontSize: 12.5, marginTop: 2 }}>{meta.sublabel}</div>
        </div>
        <button
          ref={commitRef}
          onClick={() => {
            if (isApplied || armed) { setArmed(false); onApply(); return }
            setArmed(true)
          }}
          // NO onBlur disarm. It was here to keep the armed state from lingering,
          // but Tab from the armed button then removed the role="alert" banner
          // AND dropped focus to <body> — so a keyboard or screen-reader operator
          // could never read the consequence statement before confirming, and
          // could never reach the banner's own Cancel button. Focus loss on an
          // irreversible action is worse than a lingering armed state. Escape
          // still disarms, the banner's Cancel disarms, and the effect on
          // [plan.plan_id, isApplied] already prevents an arm leaking to another
          // plan; a pointerdown outside handles the mouse case.
          onKeyDown={(e) => { if (e.key === "Escape" && armed) { e.stopPropagation(); setArmed(false) } }}
          aria-label={
            isApplied
              ? `Unapply plan ${plan.plan_id}`
              : armed
                ? `Confirm plan ${plan.plan_id}: ${delayed} delayed, ${cancelled} cancelled${violations ? `, ${violations} FAR 117 flags` : ""}, ${fmtUsd(totalCostUsd)}`
                : `Apply plan ${plan.plan_id} — asks for confirmation first`
          }
          style={{
            flexShrink: 0,
            minHeight: 44, // was 38 — WCAG 2.5.8 target minimum
            padding: "0 16px",
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 13.5, fontWeight: 550, fontFamily: ff.body,
            borderRadius: r.md,
            border: `1px solid ${isApplied ? c.borderStrong : armed ? c.cascadeDirect : c.primary}`,
            background: isApplied ? "transparent" : armed ? c.cascadeDirect : c.primary,
            color: isApplied ? c.ink : c.onPrimary,
            cursor: "pointer",
            transition: "background 150ms ease, border-color 150ms ease",
          }}
        >
          {isApplied
            ? <><X style={{ width: 14, height: 14 }} strokeWidth={2} /> Unapply</>
            : armed
              ? <><AlertTriangle style={{ width: 14, height: 14 }} strokeWidth={2} /> Confirm commit</>
              /* ShieldCheck, not Play: this dispatches a plan, it does not
                 preview one. */
              : <><ShieldCheck style={{ width: 14, height: 14 }} strokeWidth={2} /> Commit plan</>}
        </button>
      </div>

      {/* The consequence, in the operator's own units, stated BEFORE the
          commit rather than in prose below it. role=alert so a screen reader
          announces the stakes at the moment the button arms. */}
      <AnimatePresence>
        {armed && !isApplied && (
          <motion.div
            ref={confirmRef}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
                padding: "9px 11px",
                borderRadius: r.sm,
                background: "var(--ae-amber-bg)",
                border: `1px solid ${c.cascadeDirect}`,
                fontSize: 12.5, color: c.ink, lineHeight: 1.45,
              }}
            >
              <span style={{ fontWeight: 600 }}>Dispatching plan {plan.plan_id} commits:</span>
              <span style={{ fontFamily: ff.mono }}>{delayed} delayed</span>
              <span style={{ fontFamily: ff.mono }}>{cancelled} cancelled</span>
              {swaps > 0 && <span style={{ fontFamily: ff.mono }}>{swaps} swaps</span>}
              <span style={{ fontFamily: ff.mono }}>{fmtUsd(totalCostUsd)}</span>
              {violations > 0 && (
                <span style={{ fontWeight: 600, color: c.cascadeDirect }}>
                  {violations} FAR 117 {violations === 1 ? "flag needs" : "flags need"} crew review
                </span>
              )}
              <button
                onClick={() => setArmed(false)}
                style={{
                  marginLeft: "auto", minHeight: 30, padding: "0 10px",
                  fontSize: 12, fontWeight: 550, fontFamily: ff.body,
                  borderRadius: r.sm, border: `1px solid ${c.borderStrong}`,
                  background: "transparent", color: c.ink, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── the financial ledger ──
          A RAISED surface, not an outlined void. This card was `c.canvas` on a
          `c.canvas` panel — 1.00:1 — so a 1px hairline was the only thing
          describing it, which is what reads as a die-cut outline rather than an
          object. `c.raised` steps it up the elevation ladder and `sh.edge` puts
          a lit top edge on it, which is what actually sells "raised" on a
          near-black surface where a cast shadow does nothing. The 3px side rule
          is gone: with a real surface it was a second, redundant edge — and the
          detector flags exactly this construction (`side-tab`) six times across
          the app. The applied state now colours the whole border instead. */}
      <div
        style={{
          borderRadius: r.sm,
          padding: "12px 12px 10px",
          background: c.raised,
          border: `1px solid ${isApplied ? APPLIED_ACCENT : c.hairline}`,
          boxShadow: sh.edge,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: c.muted }}>Est. total cost</span>
          {/* Frozen while armed so it agrees with the confirmation banner to
              the dollar — see the note on `frozenCost`. */}
          <LiveCostDisplay plan={plan} size="md" frozenCost={armed ? totalCostUsd : null} />
        </div>

        {cb && cb.grand_total_usd > 0 && (
          <>
            {/* segmented composition bar — one bar, three cost classes */}
            <div aria-hidden style={{ display: "flex", height: 6, borderRadius: r.pill, overflow: "hidden", background: c.surfaceStrong, margin: "10px 0 8px" }}>
              {[
                { v: cb.cancellation_total_usd, color: c.borderStrong },
                { v: cb.delay_total_usd, color: c.amber },
                { v: cb.reposition_cost_usd, color: c.teal },
              ].map((seg, si) =>
                seg.v > 0 ? <span key={si} style={{ width: `${(seg.v / cb.grand_total_usd) * 100}%`, background: seg.color }} /> : null,
              )}
            </div>
            {[
              { v: cb.cancellation_total_usd, color: c.borderStrong, label: "Cancellations (rev. loss + rebook + DOT 261)" },
              { v: cb.delay_total_usd, color: c.amber, label: "Delays (ops + crew OT + pax time)" },
              { v: cb.reposition_cost_usd, color: c.teal, label: "Aircraft repositioning" },
            ].map((row) =>
              row.v > 0 ? (
                <div key={row.label} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 11, color: c.muted, marginTop: 3 }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: row.color, flexShrink: 0, alignSelf: "center" }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                  <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.body, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {fmtUsd(row.v)}
                  </span>
                </div>
              ) : null,
            )}
          </>
        )}

        {Number.isFinite(cheapestCost) && cheapestCost > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.hairline}`, fontSize: 11 }}>
            {totalCostUsd <= cheapestCost ? (
              <span style={{ color: c.statusRecovered.ink, fontWeight: 600 }}>Lowest-cost plan</span>
            ) : (
              <>
                <span style={{ color: c.muted }}>vs cheapest plan</span>
                <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.statusDelayed.ink, fontVariantNumeric: "tabular-nums" }}>
                  +{fmtUsd(totalCostUsd - cheapestCost)}
                </span>
              </>
            )}
          </div>
        )}

        <p style={{ fontSize: 11, color: c.muted, margin: "7px 0 0", fontFamily: ff.mono, letterSpacing: "0.02em" }}>
          DOT BTS 2023 · $82.50/pax-hr · Form 41 block-hour ops
        </p>
      </div>

      {/* ── uncertain horizon ── */}
      <UncertainHorizon plan={plan} />

      {/* ── actions summary + carbon ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {cancelled > 0 && <CountChip kind="cancelled" Icon={X}       count={cancelled} label="cancelled" />}
        {delayed   > 0 && <CountChip kind="delayed"   Icon={Clock}   count={delayed}   label="delayed" />}
        {swaps     > 0 && <CountChip kind="recovered" Icon={Repeat2} count={swaps}     label="swaps" />}
        {cancelled === 0 && delayed === 0 && swaps === 0 && (
          <span style={{ fontSize: 11, color: c.statusOnTime.ink, fontWeight: 500 }}>No actions — schedule intact</span>
        )}
        {plan.total_co2_kg !== undefined && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: c.muted, fontFamily: ff.mono, marginLeft: "auto" }}>
            <Leaf style={{ width: 11, height: 11, color: c.signatureForest }} />
            <span style={{ color: plan.total_co2_kg < 0 ? c.statusRecovered.ink : c.statusDelayed.ink, fontWeight: 600 }}>
              {plan.total_co2_kg >= 0 ? "+" : ""}{(plan.total_co2_kg / 1000).toFixed(2)} tCO₂e
            </span>
          </span>
        )}
      </div>

      {/* ── strategy narrative — always visible, this IS the explanation ── */}
      <div>
        <Eyebrow>Strategy</Eyebrow>
        <p style={{ ...type("bodyMd", c.body), marginTop: 6, fontSize: 12, lineHeight: 1.55 }}>
          {buildNarrative(plan)}
        </p>
      </div>

      {/* ── operational impact ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: sp.xs }}>
        <ImpactCell
          Icon={UserCheck}
          label="Crew"
          valueOk={plan.crew_violations === 0}
          valueText={plan.crew_violations > 0 ? `${plan.crew_violations} FAR117 flag${plan.crew_violations !== 1 ? "s" : ""}` : "Fully compliant"}
        />
        <ImpactCell
          Icon={Plane}
          label="Aircraft pos."
          valueOk={(plan.aircraft_out_of_position || 0) === 0}
          valueText={plan.aircraft_out_of_position > 0 ? `${plan.aircraft_out_of_position} out-of-pos.` : "All in-position"}
        />
        <ImpactCell
          Icon={Users}
          label="Passengers"
          valueOk
          valueText={`${((plan.total_passenger_delay_minutes || 0) / 1000).toFixed(1)}K pax·min`}
        />
        <ImpactCell
          Icon={Clock}
          label="Solve time"
          valueOk
          valueText={plan.solve_time_ms > 0 ? `${plan.solve_time_ms}ms` : "—"}
          mono
        />
      </div>

      {/* ── flight lists ── */}
      {cancelled > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <X style={{ width: 12, height: 12, color: c.muted }} strokeWidth={1.75} />
            <Eyebrow>Cancellations ({cancelled})</Eyebrow>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {plan.cancelled_flights.map((fid: string) => {
              const route = flightRoute(fid)
              return (
                <button
                  key={fid}
                  onClick={() => onFlightSelect(fid)}
                  title={route.cities || route.codes || fid}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 11, padding: "3px 8px", borderRadius: r.sm,
                    background: c.statusCancelled.bg, color: c.statusCancelled.ink,
                    border: "none", cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: ff.mono, fontWeight: 500 }}>{fid}</span>
                  {route.codes && <span style={{ fontFamily: ff.mono, opacity: 0.75 }}>{route.codes}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {delayed > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <Clock style={{ width: 12, height: 12, color: c.statusDelayed.ink }} />
            <Eyebrow>Delays ({delayed})</Eyebrow>
          </div>
          {/* 260px, not 132. At 132 the box showed ~4 of up to 30 rows, so the
              list was 87% hidden behind a scroll a dispatcher had no reason to
              suspect. It is the second-largest list in the panel. */}
          <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {plan.delayed_flights.slice(0, showAllDelays ? undefined : 30).map((d: any) => {
              const route = flightRoute(d.flight_id)
              return (
                /* A BUTTON, not a div with a click handler.
                   These 30 rows were `<div onClick>` — no role, no tabIndex,
                   no key handler, no accessible name — so the delay list was
                   readable but not operable by keyboard or screen reader, and
                   its rows announced as plain text with no hint they do
                   anything. The cancellation chips above are already real
                   buttons; this list simply never got the same treatment. */
                <button
                  key={d.flight_id}
                  type="button"
                  title={route.cities || route.codes || d.flight_id}
                  onClick={() => onFlightSelect(d.flight_id)}
                  aria-label={`Flight ${d.flight_id}${route.codes ? `, ${route.codes}` : ""}, delayed ${d.delay_minutes} minutes. Inspect.`}
                  className="ae-plan-row"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: sp.xs, fontSize: 11, borderRadius: r.sm, padding: "5px 8px",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    border: "1px solid transparent", background: "transparent",
                    fontFamily: ff.body,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: ff.mono, fontWeight: 500, color: c.body, flexShrink: 0 }}>{d.flight_id}</span>
                    {route.codes && (
                      <span style={{ fontFamily: ff.mono, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {route.codes}
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.statusDelayed.ink, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    +{d.delay_minutes}m
                  </span>
                </button>
              )
            })}
            {/* "+N more…" was static text — the remaining flights were simply
                unreachable, with no control and no explanation. A truncation
                the operator cannot undo is data loss wearing an ellipsis. */}
            {delayed > 30 && !showAllDelays && (
              <button
                type="button"
                onClick={() => setShowAllDelays(true)}
                className="ae-plan-row"
                style={{
                  fontSize: 10.5, color: c.link, padding: "5px 8px", textAlign: "left",
                  border: "1px solid transparent", background: "transparent",
                  cursor: "pointer", fontFamily: ff.body, fontWeight: 550, width: "100%",
                }}
              >
                Show {delayed - 30} more delayed flights
              </button>
            )}
          </div>
        </div>
      )}

      {swaps > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <Repeat2 style={{ width: 12, height: 12, color: c.link }} />
            <Eyebrow>Aircraft swaps ({swaps})</Eyebrow>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {plan.aircraft_swaps.map((s: any, i: number) => {
              const oldAc = aircraftLabel(s.old_aircraft, fleet)
              const newAc = aircraftLabel(s.new_aircraft, fleet)
              const route = flightRoute(s.flight_id)
              return (
                <div
                  key={i}
                  title={route.cities || route.codes || s.flight_id}
                  style={{
                    display: "flex", flexDirection: "column", gap: 2, fontSize: 11,
                    background: c.raised, border: `1px solid ${c.hairline}`, borderRadius: r.sm,
                    padding: "6px 8px", boxShadow: sh.edge,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: ff.mono, fontWeight: 500, color: c.body, flexShrink: 0 }}>{s.flight_id}</span>
                    {route.codes && <span style={{ fontFamily: ff.mono, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.codes}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: ff.mono, color: c.muted, textDecoration: "line-through" }}>{oldAc.tail || s.old_aircraft}</span>
                    {oldAc.typeLabel && <span style={{ fontSize: 10, color: c.muted, opacity: 0.75 }}>({oldAc.typeLabel})</span>}
                    <span style={{ color: c.muted }}>→</span>
                    <span style={{ fontFamily: ff.mono, color: c.statusRecovered.ink }}>{newAc.tail || s.new_aircraft}</span>
                    {newAc.typeLabel && <span style={{ fontSize: 10, color: c.statusRecovered.ink, opacity: 0.75 }}>({newAc.typeLabel})</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* deep-link to the full counterfactual explainer */}
      <Link
        href={`/simulator/plans/${plan.plan_id}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 2px", fontSize: 12.5, color: c.link, textDecoration: "none", fontWeight: 550 }}
      >
        Open full plan detail <ArrowRight style={{ width: 13, height: 13 }} strokeWidth={2} />
      </Link>
    </motion.div>
  )
}

// ─── Uncertain horizon — expected cost + regret band ──────────────────────
// A drone incursion has no published end time, so the single "est. total cost"
// above is only the median case. This states the two numbers the operator
// actually decides on: what the plan costs in expectation across the sampled
// closure lengths, and how much worse it is than the best recovery available
// with hindsight. Renders nothing for every other event type, which still has
// a known duration and a single honest cost.

function UncertainHorizon({ plan }: { plan: any }) {
  const u = plan.uncertainty
  if (!u) return null

  const span = Math.max(1, u.cost_high_usd - u.cost_low_usd)
  const markerPct = Math.min(100, Math.max(0, ((u.expected_cost_usd - u.cost_low_usd) / span) * 100))

  return (
    <div
      style={{
        borderRadius: r.sm,
        padding: "12px 12px 10px",
        background: c.raised,
        border: `1px solid ${c.hairline}`,
        boxShadow: sh.edge,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Eyebrow color="var(--ae-teal-ink)">Uncertain horizon</Eyebrow>
        <span style={{ fontFamily: ff.mono, fontSize: 11, color: c.muted }}>
          median {Math.round(u.median_minutes)}m · p95 {Math.round(u.p95_minutes)}m
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 12, color: c.muted }}>Expected cost</span>
        <span style={{ fontFamily: ff.mono, fontSize: 15, fontWeight: 650, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
          {fmtUsd(u.expected_cost_usd)}
        </span>
      </div>

      {/* Cost band across the sampled closure lengths, with the expectation
          marked. A bar, not a sparkline: the shape of the distribution is not
          the decision — the spread is. */}
      <div aria-hidden style={{ position: "relative", height: 6, borderRadius: r.pill, background: c.surfaceStrong, margin: "8px 0 4px" }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: r.pill, background: "var(--ae-teal-bg)" }} />
        <span style={{ position: "absolute", top: -2, bottom: -2, left: `calc(${markerPct}% - 1px)`, width: 2, background: "var(--ae-teal)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ff.mono, fontSize: 11, color: c.muted, fontVariantNumeric: "tabular-nums" }}>
        <span>{fmtUsd(u.cost_low_usd)}</span>
        <span>{fmtUsd(u.cost_high_usd)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.hairline}`, fontSize: 11 }}>
        <span style={{ color: c.muted }}>Regret if the duration is wrong</span>
        <span style={{ fontFamily: ff.mono, fontWeight: 600, color: u.max_regret_usd > 0 ? c.statusDelayed.ink : c.statusOnTime.ink, fontVariantNumeric: "tabular-nums" }}>
          {fmtUsd(u.expected_regret_usd)} avg · {fmtUsd(u.max_regret_usd)} worst
        </span>
      </div>

      <p style={{ fontSize: 9.5, color: c.muted, margin: "7px 0 0", fontFamily: ff.mono, letterSpacing: "0.02em" }}>
        {u.scenarios.length} sampled closures ({u.distribution}) · regret vs. best plan with hindsight
      </p>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function CountChip({
  kind, Icon, count, label,
}: {
  kind: "cancelled" | "delayed" | "recovered"
  Icon: typeof X
  count: number
  label: string
}) {
  const palette =
    kind === "cancelled" ? c.statusCancelled :
    kind === "delayed"   ? c.statusDelayed   :
                            c.statusRecovered
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11, fontWeight: 500, padding: "2px 8px",
        borderRadius: r.pill, background: palette.bg, color: palette.ink, fontFamily: ff.body,
      }}
    >
      <Icon style={{ width: 12, height: 12 }} /> {count} {label}
    </span>
  )
}

function ImpactCell({
  Icon, label, valueOk, valueText, mono = false,
}: {
  Icon: typeof UserCheck
  label: string
  valueOk: boolean
  valueText: string
  mono?: boolean
}) {
  return (
    <div style={{ borderRadius: r.sm, padding: "8px 10px", border: `1px solid ${c.hairline}`, background: c.raised, boxShadow: sh.edge }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.muted, marginBottom: 2 }}>
        <Icon style={{ width: 12, height: 12 }} /> {label}
      </div>
      <div
        style={{
          fontSize: 12, fontWeight: 500,
          color: valueOk ? c.statusOnTime.ink : c.statusDelayed.ink,
          fontFamily: mono ? ff.mono : ff.body,
          fontVariantNumeric: mono ? "tabular-nums" : undefined,
        }}
      >
        {valueText}
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────

export function RecoveryPlans({
  selectedFlight, onFlightSelect,
}: {
  selectedFlight: string | null
  onFlightSelect: (id: string | null) => void
}) {
  const { recoveryPlans, cascadeSummary, appliedPlanId, applyPlan } = useSimulationStore()
  const hasDisruption = useHasActiveDisruption()
  const [inspectedId, setInspectedId] = useState<string>("A")

  // Applying a plan pulls the inspector to it — the operator is always
  // looking at what's committed unless they deliberately click away.
  useEffect(() => {
    if (appliedPlanId) setInspectedId(appliedPlanId)
  }, [appliedPlanId])

  // True empty-state: no disruption at all.
  if (!hasDisruption && recoveryPlans.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader
          Icon={Activity}
          title="Recovery Plans"
          subtitle="Plans A–D · cost / pax / tomorrow / carbon"
        />
        {/* overflowY:auto — the empty state was the ONE branch of this panel
            with no scroll container, so at 200% zoom 150px of its content was
            clipped with no way to reach it (measured: clientHeight 161,
            scrollHeight 311). */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", padding: sp.md }} className="ae-scroll-smooth">
          <CreamCallout style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: sp.xs }}>
            <Eyebrow color={c.statusRecovered.ink}>Awaiting disruption</Eyebrow>
            <Type as="div" role="titleSm" color={c.ink}>
              All flights operating nominally.
            </Type>
            {/* Named the wrong region: this said "from the left rail", and the
                left rail has no event trigger — it is route navigation. The
                trigger is the Events panel. */}
            <Type as="p" role="bodyMd" color={c.muted}>
              Trigger an event from the Events panel to receive ranked recovery plans with cost breakdowns and counterfactual rationale.
            </Type>
            <span style={{ fontFamily: ff.mono, fontSize: 11, color: c.muted, marginTop: 4 }}>
              CP-SAT solve typically &lt; 10 ms · cost engine deterministic
            </span>
          </CreamCallout>
        </div>
      </div>
    )
  }

  const inspected =
    recoveryPlans.find((p: any) => p.plan_id === inspectedId) || recoveryPlans[0]
  const cheapestCost = Math.min(...recoveryPlans.map(planCost).filter((v: number) => v > 0))

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PanelHeader
        Icon={Activity}
        title="Recovery Plans"
        subtitle={
          cascadeSummary
            ? `${cascadeSummary.total_affected} affected · ${cascadeSummary.directly_affected} direct · ${(cascadeSummary.cascade_1 || 0) + (cascadeSummary.cascade_2 || 0)} cascade`
            : `${recoveryPlans.length} plans ready`
        }
      />

      {/* paddingBottom clears the fixed Ask-Aeolus pill */}
      {/* paddingBottom was 96 to dodge the fixed Ask-Aeolus pill — 96 x 392 =
          37,632px of dead space reserved inside the panel that hosts Commit.
          The pill now sits in the rail's footer instead of floating over the
          workspace, so the reservation is gone. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: sp.md }} className="ae-scroll-smooth">
        <DecisionMatrix
          plans={recoveryPlans}
          selectedId={inspected?.plan_id ?? "A"}
          appliedId={appliedPlanId}
          onSelect={setInspectedId}
        />
        <AnimatePresence mode="wait">
          {inspected && (
            <PlanLedger
              key={inspected.plan_id}
              plan={inspected}
              isApplied={appliedPlanId === inspected.plan_id}
              cheapestCost={cheapestCost}
              onApply={() => applyPlan(appliedPlanId === inspected.plan_id ? null : inspected.plan_id)}
              onFlightSelect={(id) => onFlightSelect(id)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Panel header — used by every right-rail panel ────────────────────────

function PanelHeader({
  Icon, title, subtitle,
}: {
  Icon: typeof Activity
  title: string
  subtitle: string
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: sp.sm,
        padding: `${sp.sm}px ${sp.md}px`,
        background: c.canvas,
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: r.sm,
          background: c.surfaceSoft, border: `1px solid ${c.hairline}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <Icon style={{ width: 14, height: 14, color: c.ink }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...type("titleMd", c.ink), fontSize: 16 }}>{title}</div>
        <div style={{ ...type("caption", c.muted), fontSize: 11, marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  )
}

// Re-export so other simulator panels can reuse the canonical header.
export { PanelHeader }

// Kept available so existing imports in other files don't break.
export { Sparkles }
