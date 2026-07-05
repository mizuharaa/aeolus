"use client"
import { RotateCcw, Plane } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { useMemo } from "react"
import { c, ff } from "@/lib/design-tokens"
import { NotificationBell } from "@/components/simulator/notification-bell"

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

  const handleReset = async () => {
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
        // lively tinted gradient wash — sky→teal→amber at low alpha, so the
        // ops bar reads warm/colorful rather than flat paper.
        background:
          "linear-gradient(90deg, rgba(56,189,248,0.10), rgba(13,148,136,0.06) 42%, rgba(184,134,60,0.05) 78%, var(--ae-bg))",
        borderBottom: `1px solid ${c.hairline}`,
        boxShadow: "inset 0 -2px 0 -1px rgba(13,148,136,0.25)",
        flexShrink: 0,
        zIndex: 50,
        fontFamily: ff.body,
        minWidth: 0,
      }}
    >
      {/* ── Context label (brand lives in the left rail) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
        {/* colorful ops badge */}
        <span
          aria-hidden
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 8,
            background: "linear-gradient(135deg, var(--ae-sky), var(--ae-teal))",
            boxShadow: "0 2px 8px -3px var(--ae-teal)",
          }}
        >
          <Plane style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2.25} />
        </span>
        <span
          style={{
            fontFamily: ff.display,
            fontWeight: 700,
            fontSize: 15.5,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            background: "linear-gradient(90deg, var(--ae-text), var(--ae-teal-ink))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ae-teal)" }} />
              <span style={{ fontFamily: ff.mono, fontWeight: 550, color: c.ink }}>{stats.onTime}</span>
              on time
            </span>
            {stats.delayed > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ae-amber)" }} />
                <span style={{ fontFamily: ff.mono, fontWeight: 550, color: c.ink }}>{stats.delayed}</span>
                delayed
              </span>
            )}
            {stats.cancelled > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ae-line-strong)" }} />
                <span style={{ fontFamily: ff.mono, fontWeight: 550, color: c.ink }}>{stats.cancelled}</span>
                cancelled
              </span>
            )}
          </div>
        )}

        <div className="ae-nav-stats" style={{ width: 1, height: 18, background: c.hairline }} />

        {/* Live ops feed — imminent arrivals + active disruptions */}
        <NotificationBell />

        {/* Connection state — colored pill with a live pulse dot */}
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontFamily: ff.mono,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            lineHeight: 1,
            padding: "5px 10px",
            borderRadius: 999,
            color: isConnected ? "var(--ae-teal-ink)" : "var(--ae-amber-ink)",
            background: isConnected ? "var(--ae-teal-bg)" : "var(--ae-amber-bg)",
            border: `1px solid ${isConnected ? "var(--ae-teal)" : "var(--ae-amber)"}`,
          }}
        >
          <span
            className="ae-live-dot"
            style={{ width: 7, height: 7, borderRadius: "50%", background: isConnected ? "var(--ae-teal)" : "var(--ae-amber)" }}
          />
          {isConnected ? "Live" : "Offline"}
        </span>

        <button
          onClick={handleReset}
          aria-label="Reset simulation"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 30,
            padding: "0 12px",
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${c.borderStrong}`,
            color: c.ink,
            fontFamily: ff.body,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
        >
          <RotateCcw style={{ width: 12, height: 12 }} strokeWidth={1.75} />
          <span className="ae-nav-reset-label">Reset</span>
        </button>
      </div>

      <style jsx>{`
        .ae-nav-routes::-webkit-scrollbar { display: none; }

        @media (max-width: 1100px) {
          .ae-nav-subtitle { display: none; }
        }
        @media (max-width: 1400px) {
          .ae-nav-stats { display: none !important; }
        }
        @media (max-width: 900px) {
          .ae-nav-reset-label { display: none; }
        }
      `}</style>
    </nav>
  )
}
