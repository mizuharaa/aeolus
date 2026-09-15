"use client"
/**
 * THE BOARD BAR — 44px, the console's only full-width chrome.
 *
 * Replaces `SimulatorNav` (56px) for the Hairline Mosaic rebuild. Everything
 * the old bar carried is still here or has moved somewhere it is easier to
 * reach; nothing was dropped. The moves, and why:
 *
 *   · The BRAND is now the plain word "Olus" set in type. The cyclone
 *     OlusMark and the little plane glyph are both gone from the console —
 *     a mark that has to be explained is decoration on an operations surface,
 *     and the plane icon was doing nothing the word did not already do.
 *   · The THEME SWITCH's three-state control moved into Settings. The bar
 *     keeps a single light/dark toggle, because flipping register mid-shift is
 *     a real, frequent act; choosing "follow the OS" is a once-ever act and
 *     does not deserve permanent width.
 *   · "Nimbus Air OCC" moved to the account block, where the session identity
 *     already lives. It is the carrier whose network this session is running,
 *     which is a property of the session, not a page title.
 *
 * 44px, not 56: twelve pixels of a fixed shell is twelve pixels the map does
 * not get, and every control here fits a 32px target inside 44 with room to
 * spare. The bar is chrome; the board is the product.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { RotateCcw, ChevronDown, LogOut, Settings, Keyboard, Sun, Moon } from "lucide-react"
import { toast } from "sonner"
import { useConsoleTheme } from "@/lib/use-theme"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { NotificationBell } from "@/components/simulator/notification-bell"
import { AgentBubble } from "@/components/simulator/agent-bubble"
import { useIndecisionCost, fmtUsdShort } from "@/lib/use-live-cost"
import { RULE, Figure, Chip } from "@/components/simulator/board"

/** The demo operator the in-memory API runs as. Labelled, never dressed up as
 *  a real account — inventing a plausible signed-in user is exactly the
 *  fiction the honest-copy rule exists to prevent. */
const OPERATOR = { name: "Duty dispatcher", role: "Demo session · Nimbus Air OCC", initials: "DD" }

/* ── Cost of indecision ──────────────────────────────────────────────────
   Only present while a disruption is running and nothing is committed. It is
   the one figure on the bar that is an argument rather than a fact, so it is
   the one that gets the rose fringe. */
function IndecisionMeter() {
  const { active, ratePerMin, accrued } = useIndecisionCost()
  if (!active) return null
  return (
    <span
      className="ae-bar-meter"
      title="Cost accruing while no recovery plan is committed (pax value-of-time + crew overtime)"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: sp.xs,
        height: 26,
        padding: `0 ${sp.xs}px`,
        border: `1px solid ${c.rose}`,
        borderRadius: r.xs,
        background: "var(--ae-rose-bg)",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        className="ae-hide-below-1450"
        style={{
          fontFamily: ff.mono, fontSize: 9.5, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", color: c.roseInk,
        }}
      >
        Uncommitted
      </span>
      <Figure value={`−${fmtUsdShort(ratePerMin)}`} unit="/min" tone="rose" size={12} />
      <span className="ae-hide-below-1450">
        <Figure value={fmtUsdShort(accrued)} label="burned" tone="muted" size={12} />
      </span>
    </span>
  )
}

/* ── Register toggle ─────────────────────────────────────────────────────
   Two states in the bar; the third ("follow the OS") lives in Settings. The
   button states which register it will switch TO and says so in its label,
   because an icon alone is ambiguous in both directions. */
function RegisterToggle() {
  const { resolved, set } = useConsoleTheme()
  const next = resolved === "dark" ? "light" : "dark"
  const Icon = resolved === "dark" ? Sun : Moon
  return (
    <button
      type="button"
      onClick={() => set(next)}
      className="ae-bar-btn"
      aria-label={`Switch to the ${next} register`}
      title={`Switch to the ${next} register`}
      style={{
        width: 30, height: 30, borderRadius: r.xs,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: RULE, background: "transparent", color: c.body, cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Icon aria-hidden style={{ width: 14, height: 14 }} strokeWidth={2} />
    </button>
  )
}

/* ── Account ─────────────────────────────────────────────────────────────
   "Who applied this plan" has to have an answer on screen for a console that
   commits schedule changes. */
function AccountMenu() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
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
    display: "flex", alignItems: "center", gap: sp.xs,
    minHeight: 32, padding: `0 ${sp.sm}px`,
    fontFamily: ff.body, fontSize: 12.5, fontWeight: 500,
    color: c.body, textDecoration: "none", background: "transparent",
    border: "none", width: "100%", cursor: "pointer", textAlign: "left",
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account — ${OPERATOR.name}, ${OPERATOR.role}`}
        className="ae-bar-btn"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 30, padding: "0 6px 0 4px", borderRadius: r.xs,
          border: RULE, background: "transparent", cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22, height: 22, borderRadius: r.xs,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: c.surfaceStrong, color: c.ink,
            fontFamily: ff.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          }}
        >
          {OPERATOR.initials}
        </span>
        <ChevronDown aria-hidden style={{ width: 12, height: 12, color: c.muted }} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: 900,
            minWidth: 224, padding: `${sp.xxs}px 0`,
            background: c.canvas, border: RULE, borderRadius: r.sm,
            boxShadow: "var(--ae-shadow-overlay)",
          }}
        >
          <div style={{ padding: `${sp.xs}px ${sp.sm}px`, borderBottom: RULE }}>
            <div style={{ fontFamily: ff.body, fontSize: 13, fontWeight: 600, color: c.ink }}>{OPERATOR.name}</div>
            <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: c.muted, marginTop: 2 }}>{OPERATOR.role}</div>
          </div>
          {/* These two used to point at /simulator/settings, which did not
              exist — both were dead links. The route ships with this rebuild. */}
          <Link href={"/simulator/settings" as Route} role="menuitem" className="ae-menu-item" style={item} onClick={() => setOpen(false)}>
            <Settings aria-hidden style={{ width: 14, height: 14 }} strokeWidth={2} /> Settings
          </Link>
          <Link href={"/simulator/settings#shortcuts" as Route} role="menuitem" className="ae-menu-item" style={item} onClick={() => setOpen(false)}>
            <Keyboard aria-hidden style={{ width: 14, height: 14 }} strokeWidth={2} /> Keyboard shortcuts
          </Link>
          <Link href={"/" as Route} role="menuitem" className="ae-menu-item" style={{ ...item, color: c.roseInk }} onClick={() => setOpen(false)}>
            <LogOut aria-hidden style={{ width: 14, height: 14 }} strokeWidth={2} /> Leave the console
          </Link>
        </div>
      )}
    </div>
  )
}

export function BoardBar({ isConnected }: { isConnected: boolean }) {
  const { reset, flightStates, schedule } = useSimulationStore()

  const stats = useMemo(() => {
    const states = Object.values(flightStates)
    const total = schedule.length || states.length
    const cancelled = states.filter((f) => f.status === "cancelled").length
    const delayed = states.filter(
      (f) => f.status === "delayed" || (f.status !== "cancelled" && f.delay_minutes > 0),
    ).length
    return { total, onTime: Math.max(0, total - cancelled - delayed), delayed, cancelled }
  }, [flightStates, schedule.length])

  // Reset discards the whole scenario, so it arms before it fires — same
  // two-step as the plan commit, for the same reason.
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

  const sep = <span aria-hidden className="ae-bar-sep" style={{ width: 1, height: 18, background: c.hairline, flexShrink: 0 }} />

  return (
    <nav
      aria-label="Operations status and controls"
      style={{
        position: "relative",
        height: 44,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: sp.sm,
        padding: `0 ${sp.xs}px 0 ${sp.sm}px`,
        background: c.canvas,
        borderBottom: RULE,
        fontFamily: ff.body,
        minWidth: 0,
        zIndex: 50,
      }}
    >
      {/* ── Identity. The word, and nothing else. ── */}
      <span
        style={{
          fontFamily: ff.display,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: c.ink,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        Olus
      </span>

      {sep}

      {/* ── The network, in figures. Underline carries the meaning, so the
             encoding survives without colour — and cancelled is struck
             through rather than given a hue of its own. ── */}
      {stats.total > 0 && (
        <div
          className="ae-bar-stats"
          style={{ display: "flex", alignItems: "baseline", gap: sp.sm, minWidth: 0, flexShrink: 1, overflow: "hidden" }}
        >
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
            <span style={{ borderBottom: `2px solid ${c.fringeMint}`, paddingBottom: 1 }}>
              <Figure value={stats.onTime} size={13} />
            </span>
            <span style={{ fontSize: 11.5, color: c.muted }}>on time</span>
          </span>
          {stats.delayed > 0 && (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
              <span style={{ borderBottom: `2px solid ${c.amber}`, paddingBottom: 1 }}>
                <Figure value={stats.delayed} size={13} />
              </span>
              <span style={{ fontSize: 11.5, color: c.muted }}>delayed</span>
            </span>
          )}
          {stats.cancelled > 0 && (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
              <span style={{ borderBottom: `2px solid ${c.borderStrong}`, paddingBottom: 1, textDecoration: "line-through" }}>
                <Figure value={stats.cancelled} size={13} tone="muted" />
              </span>
              <span style={{ fontSize: 11.5, color: c.muted }}>cancelled</span>
            </span>
          )}
        </div>
      )}

      <span style={{ flex: 1, minWidth: sp.xs }} />

      <IndecisionMeter />

      {sep}

      <span style={{ display: "inline-flex", alignItems: "center", gap: sp.xs, flexShrink: 0 }}>
        <NotificationBell />
        <span className="ae-bar-assist" style={{ display: "inline-flex" }}>
          <AgentBubble />
        </span>
      </span>

      {sep}

      <span style={{ display: "inline-flex", alignItems: "center", gap: sp.xs, flexShrink: 0 }}>
        <Chip tone={isConnected ? "teal" : "amber"} title={isConnected ? "Live WebSocket feed connected" : "WebSocket disconnected — showing last known state"}>
          {isConnected ? "LIVE" : "OFFLINE"}
        </Chip>

        <button
          type="button"
          onClick={handleReset}
          onBlur={() => setResetArmed(false)}
          className="ae-bar-btn ae-bar-assist"
          aria-label={resetArmed ? "Confirm reset — discards the current scenario" : "Reset simulation — asks for confirmation first"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 30, padding: `0 ${sp.xs}px`, borderRadius: r.xs,
            background: resetArmed ? "var(--ae-amber-bg)" : "transparent",
            border: `1px solid ${resetArmed ? c.amber : c.hairline}`,
            color: resetArmed ? c.amberInk : c.body,
            fontFamily: ff.body, fontSize: 12, fontWeight: 500,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          <RotateCcw aria-hidden style={{ width: 13, height: 13 }} strokeWidth={2} />
          <span className="ae-bar-reset-label">{resetArmed ? "Confirm reset" : "Reset"}</span>
        </button>

        <RegisterToggle />
        <AccountMenu />
      </span>
    </nav>
  )
}
