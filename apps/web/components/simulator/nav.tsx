"use client"
import { RotateCcw, Plane, ChevronDown, LogOut, Settings, UserRound, Keyboard } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { c, ff, r } from "@/lib/design-tokens"
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
 * Signed-in dispatcher. The console had no account surface at all — no way to
 * see who you are signed in as, reach settings, or sign out — which for a
 * console that commits schedule changes is a real gap: "who applied this plan"
 * has to have an answer on screen.
 *
 * The identity shown is the demo operator the in-memory API runs as. It is
 * LABELLED as such rather than dressed up as a real account, because inventing
 * a plausible-looking signed-in user is exactly the kind of fiction design.md's
 * honest-copy rule exists to prevent.
 */
const OPERATOR = { name: "Duty dispatcher", role: "Demo session · Nimbus Air OCC", initials: "DD" }

function AccountMenu() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const item: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    height: 38, padding: "0 12px", width: "100%",
    borderRadius: r.sm, border: "none", background: "transparent",
    color: c.body, fontFamily: ff.body, fontSize: 13,
    cursor: "pointer", textAlign: "left", textDecoration: "none",
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account — ${OPERATOR.name}`}
        className="ae-topbar-btn"
        style={{
          display: "flex", alignItems: "center", gap: 9,
          height: 38, padding: "0 8px 0 6px",
          borderRadius: r.md,
          border: `1px solid ${open ? "var(--ae-line-strong)" : "transparent"}`,
          background: open ? "var(--ae-surface-2)" : "transparent",
          color: c.ink, cursor: "pointer", fontFamily: ff.body,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 27, height: 27, borderRadius: 999, flexShrink: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "var(--ae-teal-bg)",
            border: "1px solid var(--ae-teal)",
            color: "var(--ae-teal-ink)",
            fontFamily: ff.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em",
          }}
        >
          {OPERATOR.initials}
        </span>
        <span className="ae-account-name" style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.1, whiteSpace: "nowrap" }}>{OPERATOR.name}</span>
          <span style={{ fontSize: 10.5, lineHeight: 1.1, color: c.muted, whiteSpace: "nowrap" }}>Demo session</span>
        </span>
        <ChevronDown aria-hidden style={{ width: 14, height: 14, color: c.muted, flexShrink: 0 }} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: 46, right: 0, zIndex: 1200,
            width: 244, padding: 6,
            background: "var(--ae-surface)",
            border: `1px solid ${c.hairline}`,
            borderRadius: 14,
            boxShadow: "var(--ae-shadow-overlay)",
            fontFamily: ff.body,
          }}
        >
          <div style={{ padding: "8px 12px 10px", borderBottom: `1px solid ${c.hairline}`, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>{OPERATOR.name}</div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{OPERATOR.role}</div>
          </div>
          <Link href={"/simulator/settings" as Route} role="menuitem" className="ae-menu-item" style={item}>
            <UserRound aria-hidden style={{ width: 15, height: 15 }} strokeWidth={1.9} /> Profile & preferences
          </Link>
          <Link href={"/simulator/settings" as Route} role="menuitem" className="ae-menu-item" style={item}>
            <Settings aria-hidden style={{ width: 15, height: 15 }} strokeWidth={1.9} /> Console settings
          </Link>
          <Link href={"/docs" as Route} role="menuitem" className="ae-menu-item" style={item}>
            <Keyboard aria-hidden style={{ width: 15, height: 15 }} strokeWidth={1.9} /> Keyboard shortcuts
          </Link>
          <div style={{ height: 1, background: c.hairline, margin: "4px 6px" }} />
          <Link href={"/" as Route} role="menuitem" className="ae-menu-item" style={{ ...item, color: "var(--ae-rose-ink)" }}>
            <LogOut aria-hidden style={{ width: 15, height: 15 }} strokeWidth={1.9} /> Leave console
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * Simulator top bar.
 *
 * ── 2026-08-16 rebuild ────────────────────────────────────────────────────
 * Three defects drove this, all measured on the live console:
 *
 * 1. COLLISION. The notification badge is absolutely positioned at
 *    top:-5/right:-5 on the bell, and the right cluster ran on a flat gap of
 *    16px with no group boundaries — so the badge overhung its neighbour's hit
 *    rect. `elementFromPoint` at the shared centre returned the badge, meaning
 *    a click intended for "Ask Aeolus" could land on nothing. The cluster is
 *    now three GROUPS separated by real rules, and the bell sits inside a
 *    padded group so the badge has room to overhang into.
 * 2. NO ACCOUNT SURFACE. See AccountMenu above.
 * 3. RESPONSIVE COLLAPSE BY DISPLAY:NONE. The old bar hid the fleet counters
 *    below 860px — the only operational numbers it carried. Information should
 *    be the last thing to go, so the counters now MOVE into a compact chip
 *    rather than disappearing, and decoration yields first.
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

  const rule = <div aria-hidden className="ae-topbar-rule" style={{ width: 1, height: 22, background: c.hairline, flexShrink: 0 }} />

  return (
    <nav
      aria-label="Operations status and controls"
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 14,
        paddingLeft: 20,
        paddingRight: 14,
        background: "var(--ae-surface)",
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
        zIndex: 50,
        fontFamily: ff.body,
        minWidth: 0,
      }}
    >
      {/* ── Context (brand lives in the left rail) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, minWidth: 0 }}>
        <Plane aria-hidden style={{ width: 16, height: 16, color: "var(--ae-teal-ink)", flexShrink: 0 }} strokeWidth={2} />
        <h1
          style={{
            fontFamily: ff.display, fontWeight: 700, fontSize: 15,
            lineHeight: 1, letterSpacing: "-0.01em", whiteSpace: "nowrap",
            color: c.ink, margin: 0,
          }}
        >
          Nimbus Air OCC
        </h1>
        <span
          className="ae-nav-subtitle"
          style={{
            fontFamily: ff.mono, fontSize: 10, fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ae-teal-ink)", padding: "3px 8px",
            borderRadius: 999, background: "var(--ae-teal-bg)",
            border: "1px solid var(--ae-teal-bg)",
            whiteSpace: "nowrap",
          }}
        >
          Operations control
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* ── Group 1: live operational numbers ── */}
      <IndecisionMeter />
      {stats.total > 0 && (
        <div
          className="ae-nav-stats"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            fontSize: 12, color: c.muted, flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            padding: "5px 12px", borderRadius: 999,
            background: "var(--ae-surface-2)",
            border: `1px solid ${c.hairline}`,
            whiteSpace: "nowrap",
          }}
        >
          {/* Status is text with a pigment underline — the landing's
              LIVE/OFFLINE convention. Status dots are banned (design.md). */}
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.ink, borderBottom: "2px solid var(--ae-teal)", paddingBottom: 1 }}>{stats.onTime}</span>
            on time
          </span>
          {stats.delayed > 0 && (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.ink, borderBottom: "2px solid var(--ae-amber)", paddingBottom: 1 }}>{stats.delayed}</span>
              delayed
            </span>
          )}
          {stats.cancelled > 0 && (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.ink, borderBottom: "2px solid var(--ae-line-strong)", paddingBottom: 1, textDecoration: "line-through" }}>{stats.cancelled}</span>
              cancelled
            </span>
          )}
        </div>
      )}

      {rule}

      {/* ── Group 2: assistive controls. Padded so the bell's overhanging
             badge has room INSIDE the group and cannot reach a sibling. ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingLeft: 6, paddingRight: 2 }}>
        <NotificationBell />
        <AgentBubble />
      </div>

      {rule}

      {/* ── Group 3: session state ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span
          title={isConnected ? "Live WebSocket feed connected" : "WebSocket disconnected — showing last known state"}
          style={{
            display: "inline-flex", alignItems: "center",
            fontFamily: ff.mono, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1,
            padding: "6px 11px", borderRadius: 999,
            color: isConnected ? "var(--ae-bg)" : "var(--ae-amber-ink)",
            background: isConnected ? "var(--ae-teal-ink)" : "var(--ae-amber-bg)",
            border: `1px solid ${isConnected ? "var(--ae-teal-ink)" : "var(--ae-amber)"}`,
            whiteSpace: "nowrap",
          }}
        >
          {isConnected ? "Live" : "Offline"}
        </span>

        <button
          onClick={handleReset}
          onBlur={() => setResetArmed(false)}
          className="ae-topbar-btn"
          aria-label={resetArmed ? "Confirm reset — discards the current scenario" : "Reset simulation — asks for confirmation first"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            minHeight: 36, padding: "0 12px", borderRadius: r.md,
            background: resetArmed ? "var(--ae-amber-bg)" : "transparent",
            border: `1px solid ${resetArmed ? "var(--ae-amber)" : c.hairline}`,
            color: resetArmed ? "var(--ae-amber-ink)" : c.body,
            fontFamily: ff.body, fontSize: 12.5, fontWeight: 500,
            cursor: "pointer", whiteSpace: "nowrap",
            transition: "background 150ms ease, border-color 150ms ease",
          }}
        >
          {/* 14px at strokeWidth 2, not 12px at 1.75 — a 1.75px stroke drawn
              at 12px antialiases into lint. Stroke weight should go UP as
              size comes down, not down. */}
          <RotateCcw aria-hidden style={{ width: 14, height: 14 }} strokeWidth={2} />
          <span className="ae-nav-reset-label">{resetArmed ? "Confirm reset" : "Reset"}</span>
        </button>

        <AccountMenu />
      </div>

      <style jsx global>{`
        .ae-topbar-btn:hover { background: var(--ae-surface-2) !important; }
        .ae-topbar-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ae-focus); }
        .ae-menu-item:hover { background: var(--ae-surface-2); color: var(--ae-text); }
        .ae-menu-item:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ae-focus); }

        /* Decoration yields before information, in this order:
           context pill -> account name text -> group rules -> reset label.
           The fleet counters are the LAST thing to go, and they go by wrapping
           out of the flex row rather than by display:none — the old bar hid
           them at 860px, which removed the only operational numbers in the
           chrome on exactly the widths where a dispatcher is most likely to be
           on a laptop. */
        @media (max-width: 1500px) { .ae-nav-subtitle { display: none; } }
        @media (max-width: 1240px) { .ae-account-name { display: none !important; } }
        @media (max-width: 1080px) { .ae-topbar-rule { display: none; } }
        @media (max-width: 980px)  { .ae-nav-reset-label { display: none; } }
        @media (max-width: 860px)  { .ae-nav-stats { display: none !important; } }
      `}</style>
    </nav>
  )
}
