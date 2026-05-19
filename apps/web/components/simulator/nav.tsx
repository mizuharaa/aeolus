"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plane, Wifi, WifiOff, RotateCcw } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { useMemo } from "react"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { ButtonPrimary, ButtonSecondary, StatusBadge } from "@/components/ds/primitives"

/**
 * Top nav — `{component.top-nav}` from DESIGN.md.
 *
 * White canvas, 64px tall, hairline bottom border. The nav stays light on
 * every page; never inverts over dark sections.
 *
 * Left:   Aeolus wordmark (with the small near-black tile icon, no gold).
 * Center: Horizontal route menu (Simulator / Plans / Cascade / Crew /
 *         Passengers / Stress Test / Carbon).
 * Right:  Connection pill + Reset (secondary) + status badges as compact pills.
 */
interface SimulatorNavProps {
  isConnected: boolean
  affectedCount: number
}

const NAV_LINKS = [
  { href: "/simulator",              label: "Simulator" },
  { href: "/simulator/plans",        label: "Plans" },
  { href: "/simulator/cascade",      label: "Cascade" },
  { href: "/simulator/crew",         label: "Crew" },
  { href: "/simulator/passengers",   label: "Passengers" },
  { href: "/simulator/stress-test",  label: "Stress test" },
  { href: "/simulator/carbon",       label: "Carbon" },
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
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: sp.lg,
        paddingRight: sp.lg,
        background: c.canvas,
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
        zIndex: 50,
        fontFamily: ff.body,
      }}
    >
      {/* ── Wordmark ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 32, minWidth: 0 }}>
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: r.sm,
              background: c.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plane style={{ width: 14, height: 14, color: c.onPrimary }} />
          </div>
          <span
            style={{
              fontFamily: ff.display,
              fontWeight: 500,
              fontSize: 18,
              lineHeight: 1,
              color: c.ink,
              letterSpacing: "-0.01em",
            }}
          >
            Aeolus
          </span>
          <span
            style={{
              fontFamily: ff.body,
              fontSize: 13,
              fontWeight: 400,
              color: c.muted,
              borderLeft: `1px solid ${c.hairline}`,
              paddingLeft: 10,
              marginLeft: 2,
            }}
          >
            Nimbus Air OCC
          </span>
        </Link>

        {/* ── Center route menu ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {NAV_LINKS.map((link) => {
            const active = isActiveLink(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: ff.body,
                  fontSize: 14,
                  fontWeight: active ? 500 : 400,
                  color: active ? c.ink : c.body,
                  textDecoration: "none",
                  padding: "8px 12px",
                  borderRadius: r.sm,
                  background: active ? c.surfaceSoft : "transparent",
                  transition: "background 150ms ease, color 150ms ease",
                  whiteSpace: "nowrap",
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Right cluster ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Compact status pills — only render counts that exist */}
        {stats.total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusBadge kind="on-time"   count={stats.onTime}    compact />
            {stats.delayed   > 0 && <StatusBadge kind="delayed"   count={stats.delayed}   compact />}
            {stats.cancelled > 0 && <StatusBadge kind="cancelled" count={stats.cancelled} compact />}
          </div>
        )}

        <div style={{ width: 1, height: 20, background: c.hairline }} />

        <ConnectionPill connected={isConnected} />

        <ButtonSecondary
          size="sm"
          onClick={handleReset}
          leadingIcon={<RotateCcw style={{ width: 13, height: 13 }} />}
        >
          Reset
        </ButtonSecondary>

        {/* Primary CTA — one per viewport. On the simulator surface this is
            the "Run stress test" call-to-action that drives users to the
            new vulnerability dashboard. */}
        <Link href="/simulator/stress-test" style={{ textDecoration: "none" }}>
          <ButtonPrimary size="sm">Run stress test</ButtonPrimary>
        </Link>
      </div>
    </nav>
  )
}

function ConnectionPill({ connected }: { connected: boolean }) {
  // Connection state lives off the semantic palette: green forest tint when
  // live, coral tint when offline. No more arbitrary opacity-on-teal pills.
  const palette = connected ? c.statusOnTime : c.statusCancelled
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: ff.body,
        fontSize: 12,
        fontWeight: 500,
        padding: "5px 10px",
        borderRadius: r.pill,
        background: palette.bg,
        color: palette.ink,
        lineHeight: 1,
      }}
    >
      {connected
        ? <Wifi    style={{ width: 12, height: 12 }} />
        : <WifiOff style={{ width: 12, height: 12 }} />}
      {connected ? "Live" : "Offline"}
    </span>
  )
}
