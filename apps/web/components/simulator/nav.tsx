"use client"
import { RotateCcw, Plane } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { useEffect, useMemo, useState } from "react"
import { c, ff } from "@/lib/design-tokens"
import { NotificationBell } from "@/components/simulator/notification-bell"
import { AgentBubble } from "@/components/simulator/agent-bubble"
import { useIndecisionCost, fmtUsdShort } from "@/lib/use-live-cost"

/**
 * Cost-of-indecision meter — visible only while a disruption is running and
 * no recovery plan has been committed. Burn rate + accrued total, derived
 * from the same per-minute constants as the live cost ticker.
 */
function IndecisionMeter() {
  const { active, ratePerMin, accrued } = useIndecisionCost()
  if (!active) return null
  return (
    <span
      title="Cost accruing while no recovery plan is committed (pax value-of-time + crew overtime)"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        fontFamily: ff.mono, fontSize: 11, fontWeight: 700,
        lineHeight: 1, padding: "6px 12px", borderRadius: 999,
        background: "var(--ae-rose-bg)",
        border: "1px solid var(--ae-rose)",
        color: "var(--ae-rose-ink)",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span className="ae-hide-below-1450" style={{ letterSpacing: "0.1em" }}>UNCOMMITTED</span>
      <span style={{ color: "var(--ae-text)" }}>−{fmtUsdShort(ratePerMin)}/min</span>
      <span className="ae-hide-below-1450">{fmtUsdShort(accrued)} burned</span>
    </span>
  )
}

/**
 * Simulator top bar — daylight register.
 *
 * Section navigation now lives in the collapsible left rail (see rail.tsx);
 * this bar carries only context (Nimbus Air OCC), live fleet status, the
 * connection state, and reset. Flat paper surface, hairline bottom border.
 * The connection indicator is plain text (teal Live / amber Offline) — no
 * status dot, no pulse.
 */
interface SimulatorNavProps {
  isConnected: boolean
  affectedCount: number
}

export function SimulatorNav({ isConnected }: SimulatorNavProps) {
  const { reset, flightStates, schedule } = useSimulationStore()

  const stats = useMemo(() => {
    const states = Object.values(flightStates)
    const total     = schedule.length || states.length
    const cancelled = states.filter((f) => f.status === "cancelled").length
    const delayed   = states.filter(
      (f) => f.status === "delayed" || (f.status !== "cancelled" && f.delay_minutes > 0),
    ).length
    return { total, onTime: Math.max(0, total - cancelled - delayed), delayed, cancelled }
  }, [flightStates, schedule.length])

  // Reset discards the whole scenario. Same arming pattern as the plan commit
  // in recovery-plans.tsx, for the same reason: it was a single click on a
  // control that looks like an ordinary secondary button.
  const [resetArmed, setResetArmed] = useState(false)
  useEffect(() => {
    if (!resetArmed) return
    const t = setTimeout(() => setResetArmed(false), 4000)
    return () => clearTimeout(t)
  }, [resetArmed])

  const handleReset = async () => {
    if (!resetArmed) { setResetArmed(true); return }
    setResetArmed(false)
    try {
      await apiClient.post("/simulator/reset")
      reset()
      toast.success("Simulation reset", { description: "All flights restored to scheduled state." })
    } catch {
      reset()
      toast.info("Local state reset")
    }
  }

  return (
    <nav
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        gap: 20,
        paddingLeft: 22,
        paddingRight: 20,
        // flat paper — the bar carries status, not decoration
        background: "var(--ae-surface)",
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
        zIndex: 50,
        fontFamily: ff.body,
        minWidth: 0,
      }}
    >
      {/* ── Context label (brand lives in the left rail) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
        <Plane aria-hidden style={{ width: 16, height: 16, color: c.ink }} strokeWidth={2} />
        <span
          style={{
            fontFamily: ff.display,
            fontWeight: 700,
            fontSize: 15.5,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            color: c.ink,
          }}
        >
          Nimbus Air OCC
        </span>
        <span
          className="ae-nav-subtitle"
          style={{
            fontFamily: ff.mono,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ae-teal-ink)",
            padding: "3px 8px",
            borderRadius: 999,
            background: "var(--ae-teal-bg)",
            whiteSpace: "nowrap",
          }}
        >
          Operations control
        </span>
      </div>

      {/* flexible gutter — section nav is now in the left rail */}
      <div style={{ flex: 1, minWidth: 0 }} />

      {/* ── Right cluster ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <IndecisionMeter />
        {/* Fleet status — plain text, pigment dots */}
        {stats.total > 0 && (
          <div
            className="ae-nav-stats"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 12,
              color: c.muted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {/* Status is text with a pigment underline — the landing's
                LIVE/OFFLINE convention. Status dots are banned (design.md). */}
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontFamily: ff.mono, fontWeight: 550, color: c.ink, borderBottom: "2px solid var(--ae-teal)", paddingBottom: 1 }}>{stats.onTime}</span>
              on time
            </span>
            {stats.delayed > 0 && (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontFamily: ff.mono, fontWeight: 550, color: c.ink, borderBottom: "2px solid var(--ae-amber)", paddingBottom: 1 }}>{stats.delayed}</span>
                delayed
              </span>
            )}
            {stats.cancelled > 0 && (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontFamily: ff.mono, fontWeight: 550, color: c.ink, borderBottom: "2px solid var(--ae-line-strong)", paddingBottom: 1, textDecoration: "line-through" }}>{stats.cancelled}</span>
                cancelled
              </span>
            )}
          </div>
        )}

        <div className="ae-nav-stats" style={{ width: 1, height: 18, background: c.hairline }} />

        {/* Live ops feed — imminent arrivals + active disruptions */}
        <NotificationBell />

        {/* Ask Aeolus — moved out of the workspace, where it floated over the
            cascade timeline in every state. See agent-bubble.tsx. */}
        <AgentBubble />

        {/* Connection state — punched-out text pill, no pulsing dot */}
        <span
          style={{
            display: "inline-flex", alignItems: "center",
            fontFamily: ff.mono,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            lineHeight: 1,
            padding: "6px 12px",
            borderRadius: 999,
            color: isConnected ? "var(--ae-bg)" : "var(--ae-amber-ink)",
            background: isConnected ? "var(--ae-text)" : "var(--ae-amber-bg)",
            border: `1px solid ${isConnected ? "var(--ae-text)" : "var(--ae-amber)"}`,
          }}
        >
          {isConnected ? "Live" : "Offline"}
        </span>

        <button
          onClick={handleReset}
          onBlur={() => setResetArmed(false)}
          aria-label={resetArmed ? "Confirm reset — discards the current scenario" : "Reset simulation — asks for confirmation first"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            minHeight: 36,
            padding: "0 12px",
            borderRadius: 8,
            background: resetArmed ? "var(--ae-amber-bg)" : "transparent",
            border: `1px solid ${resetArmed ? "var(--ae-amber-ink)" : c.borderStrong}`,
            color: c.ink,
            fontFamily: ff.body,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
        >
          {/* 14px at strokeWidth 2, not 12px at 1.75 — a 1.75px stroke drawn
              at 12px antialiases into lint. Stroke weight should go UP as
              size comes down, not down. */}
          <RotateCcw style={{ width: 14, height: 14 }} strokeWidth={2} />
          <span className="ae-nav-reset-label">{resetArmed ? "Confirm reset" : "Reset"}</span>
        </button>
      </div>

      <style jsx>{`
        .ae-nav-routes::-webkit-scrollbar { display: none; }

        /* The fleet counters are the only operational numbers in the top bar,
           and they were display:none below 1400px — i.e. hidden on the most
           common laptop width, to relieve a space pressure that did not exist:
           the nav's flexible gutter measured 615px of EMPTY space at 1280.
           Decoration now yields before information. The context pill goes at
           1240 and the wordmark subtitle at 1100; the numbers stay until 860,
           where they finally wrap out. */
        /* The context pill is decoration; it goes first. Measured: with the
           fleet counters restored and Ask Aeolus moved into this bar, the right
           cluster overflowed by 36px at 1280 and clipped Reset. Dropping the
           pill reclaims 141px, which is the whole deficit and then some. */
        @media (max-width: 1400px) {
          .ae-nav-subtitle { display: none; }
        }
        @media (max-width: 860px) {
          .ae-nav-stats { display: none !important; }
        }
        @media (max-width: 900px) {
          .ae-nav-reset-label { display: none; }
        }
      `}</style>
    </nav>
  )
}
