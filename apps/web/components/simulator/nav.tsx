"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wifi, WifiOff, RotateCcw } from "lucide-react"
import { AeolusLogo } from "@/components/ds/logo"
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
  { href: "/simulator/playtest",     label: "Playtest" },
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
        gap: sp.md,
        paddingLeft: sp.lg,
        paddingRight: sp.lg,
        background: c.canvas,
        borderBottom: `1px solid ${c.hairline}`,
        flexShrink: 0,
        zIndex: 50,
        fontFamily: ff.body,
        // Overall horizontal containment: prevent the bar itself from causing
        // page-level overflow. The route menu is the one element allowed to
        // scroll horizontally.
        minWidth: 0,
      }}
    >
      {/* ── Wordmark (never compresses) ── */}
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
        <AeolusLogo size={28} />
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
        {/* The "Nimbus Air OCC" subtitle hides below 1100px so it doesn't
            collide with the route menu on standard laptop widths. */}
        <span
          className="ae-nav-subtitle"
          style={{
            fontFamily: ff.body,
            fontSize: 13,
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

      {/* ── Center route menu — own its overflow lane ──
          The wordmark + right cluster are pinned (flexShrink: 0). The menu
          itself is `flex: 1, overflow-x: auto` so when the 8 route labels
          are wider than the available canvas, the menu scrolls horizontally
          INSIDE the bar rather than pushing the right cluster off-screen. */}
      <div
        className="ae-nav-routes"
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          overflowX: "auto",
          overflowY: "hidden",
          // Hide the scrollbar on Firefox / WebKit; the underlying scroll
          // gesture still works (trackpad swipe, shift+wheel).
          scrollbarWidth: "none",
          // ms-overflow-style:none for legacy Edge.
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
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                color: active ? c.ink : c.body,
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: r.sm,
                background: active ? c.surfaceSoft : "transparent",
                transition: "background 150ms ease, color 150ms ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {link.label}
            </Link>
          )
        })}
      </div>

      {/* ── Right cluster (pinned, never compresses) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {/* Status pills — hidden below 1400px so they don't crowd the
            route menu's scroll lane on standard laptops. */}
        {stats.total > 0 && (
          <div className="ae-nav-stats" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusBadge kind="on-time"   count={stats.onTime}    compact />
            {stats.delayed   > 0 && <StatusBadge kind="delayed"   count={stats.delayed}   compact />}
            {stats.cancelled > 0 && <StatusBadge kind="cancelled" count={stats.cancelled} compact />}
          </div>
        )}

        <div className="ae-nav-stats" style={{ width: 1, height: 20, background: c.hairline }} />

        <ConnectionPill connected={isConnected} />

        {/* Reset collapses to icon-only on narrow widths. */}
        <ButtonSecondary
          size="sm"
          onClick={handleReset}
          aria-label="Reset simulation"
          leadingIcon={<RotateCcw style={{ width: 13, height: 13 }} />}
        >
          <span className="ae-nav-reset-label">Reset</span>
        </ButtonSecondary>

        {/* Primary CTA — one per viewport. */}
        <Link href="/simulator/stress-test" style={{ textDecoration: "none" }}>
          <ButtonPrimary size="sm">
            <span className="ae-nav-cta-label">Run stress test</span>
            <span className="ae-nav-cta-short">Stress</span>
          </ButtonPrimary>
        </Link>
      </div>

      {/* Scoped responsive rules — applied without polluting Tailwind config.
          The styled-jsx tag is parsed once at module load. */}
      <style jsx>{`
        /* Hide the scrollbar inside the route lane on WebKit. */
        .ae-nav-routes::-webkit-scrollbar { display: none; }

        /* Subtitle collapses below 1100px to give the route menu room. */
        @media (max-width: 1100px) {
          .ae-nav-subtitle { display: none; }
        }

        /* Status pills + divider hide below 1400px so the right cluster
           doesn't crowd the route menu at standard 1280/1366 widths. */
        @media (max-width: 1400px) {
          .ae-nav-stats { display: none !important; }
        }

        /* Reset button collapses to icon-only below 900px (mobile/iPad). */
        @media (max-width: 900px) {
          .ae-nav-reset-label { display: none; }
        }

        /* Primary CTA shrinks to "Stress" below 1200px. */
        .ae-nav-cta-short { display: none; }
        @media (max-width: 1200px) {
          .ae-nav-cta-label { display: none; }
          .ae-nav-cta-short { display: inline; }
        }
      `}</style>
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
