"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { AeolusLogo } from "@/components/ds/logo"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { useMemo } from "react"
import { c, ff } from "@/lib/design-tokens"

/**
 * Simulator top bar — dark register.
 *
 * Flat ink surface, hairline bottom border. Routes are underline tabs
 * (teal rule on the active route), not boxed pills. Fleet status is plain
 * text with pigment dots. The connection indicator is THE one live dot in
 * the app: small, solid, static — teal connected, rust offline.
 */
interface SimulatorNavProps {
  isConnected: boolean
  affectedCount: number
}

const NAV_LINKS = [
  { href: "/simulator",             label: "Simulator" },
  { href: "/simulator/playtest",    label: "Playtest" },
  { href: "/simulator/plans",       label: "Plans" },
  { href: "/simulator/cascade",     label: "Cascade" },
  { href: "/simulator/crew",        label: "Crew" },
  { href: "/simulator/passengers",  label: "Passengers" },
  { href: "/simulator/stress-test", label: "Stress test" },
  { href: "/simulator/carbon",      label: "Carbon" },
] as const

export function SimulatorNav({ isConnected }: SimulatorNavProps) {
  const pathname = usePathname() ?? "/simulator"
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

  const isActiveLink = (href: string) => {
    if (href === "/simulator") return pathname === "/simulator"
    return pathname.startsWith(href)
  }

  return (
    <nav
      style={{
        height: 60,
        display: "flex",
        alignItems: "stretch",
        gap: 20,
        paddingLeft: 20,
        paddingRight: 20,
        background: "var(--ae-bg)",
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
        zIndex: 50,
        fontFamily: ff.body,
        minWidth: 0,
      }}
    >
      {/* ── Wordmark ── */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <AeolusLogo size={26} />
        <span
          style={{
            fontFamily: ff.display,
            fontWeight: 600,
            fontSize: 16,
            lineHeight: 1,
            color: c.ink,
            letterSpacing: "-0.01em",
          }}
        >
          Aeolus
        </span>
        <span
          className="ae-nav-subtitle"
          style={{
            fontFamily: ff.body,
            fontSize: 12.5,
            fontWeight: 400,
            color: c.muted,
            borderLeft: `1px solid ${c.hairline}`,
            paddingLeft: 10,
            marginLeft: 2,
            whiteSpace: "nowrap",
          }}
        >
          Nimbus Air OCC
        </span>
      </Link>

      {/* ── Route menu — underline tabs, scrolls in its own lane ── */}
      <div
        className="ae-nav-routes"
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "stretch",
          gap: 2,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {NAV_LINKS.map((link) => {
          const active = isActiveLink(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: ff.body,
                fontSize: 13.5,
                fontWeight: active ? 550 : 450,
                color: active ? c.ink : c.muted,
                textDecoration: "none",
                padding: "0 12px",
                display: "inline-flex",
                alignItems: "center",
                borderBottom: active ? "2px solid var(--ae-teal)" : "2px solid transparent",
                marginBottom: -1,
                transition: "color 150ms ease, border-color 150ms ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {link.label}
            </Link>
          )
        })}
      </div>

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

        {/* Connection state — plain text, no dot, no pulse */}
        <span
          style={{
            fontFamily: ff.mono,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            lineHeight: 1,
            color: isConnected ? c.tealInk : c.amberInk,
            borderBottom: `2px solid ${isConnected ? "var(--ae-teal)" : "var(--ae-amber)"}`,
            paddingBottom: 3,
          }}
        >
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
