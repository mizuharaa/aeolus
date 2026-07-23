"use client"
/**
 * SimulatorRail — the left icon rail for every /simulator route.
 *
 * Rest state: a slim monochrome icon column (no labels, no color, no dots).
 * Hovering the rail expands it in place as an OVERLAY (content never
 * reflows); a pin keeps it expanded in-flow. Icons answer hover with a
 * spring pop (Phantom-wallet style). Active route = ink text + plum bar.
 *
 * The rail also owns two flyouts:
 *   · OpsBrief — the daily operations report. Auto-opens once per session
 *     on boot, reopenable from the "Daily brief" item.
 *
 * (The recovery-plans pop-out lives in the workspace now — it's the floating
 * Recovery panel that auto-opens on the map when plans are ready.)
 */

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  FlaskConical,
  GitCompareArrows,
  Waypoints,
  Users,
  UserRound,
  Gauge,
  Leaf,
  Pin,
  PinOff,
  ScrollText,
  type LucideIcon,
} from "lucide-react"
import { AeolusMark } from "@/components/ds/logo"
import { c, ff, r } from "@/lib/design-tokens"
import { OpsBrief } from "@/components/simulator/ops-brief"

type NavGroup = { heading: string; items: { href: string; label: string; Icon: LucideIcon }[] }

const GROUPS: NavGroup[] = [
  {
    heading: "Operations",
    items: [
      { href: "/simulator", label: "Live map", Icon: LayoutDashboard },
      { href: "/simulator/cascade", label: "Cascade", Icon: Waypoints },
      { href: "/simulator/playtest", label: "Playtest", Icon: FlaskConical },
    ],
  },
  {
    heading: "Recovery",
    items: [
      { href: "/simulator/plans", label: "Plans", Icon: GitCompareArrows },
      { href: "/simulator/crew", label: "Crew", Icon: Users },
      { href: "/simulator/passengers", label: "Passengers", Icon: UserRound },
    ],
  },
  {
    heading: "Analysis",
    items: [
      { href: "/simulator/stress-test", label: "Stress test", Icon: Gauge },
      { href: "/simulator/carbon", label: "Carbon", Icon: Leaf },
    ],
  },
]

const SLIM = 66
const WIDE = 228
const SPRING = { type: "spring" as const, stiffness: 420, damping: 26 }

/** One nav row. The icon pops on hover (spring), the label rides the
 * expansion. Monochrome: muted at rest, ink on hover, ink+plum when active. */
function RailItem({
  href, label, Icon, active, expanded, onClick,
}: {
  href?: string
  label: string
  Icon: LucideIcon
  active: boolean
  expanded: boolean
  onClick?: () => void
}) {
  const inner = (
    <>
      {active && (
        <motion.span
          layoutId="rail-active-bar"
          aria-hidden
          style={{
            position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
            borderRadius: 3, background: "var(--ae-teal)",
          }}
        />
      )}
      <motion.span
        className="rail-ic"
        whileHover={{ scale: 1.18, rotate: -4 }}
        whileTap={{ scale: 0.92 }}
        transition={SPRING}
        style={{ display: "inline-flex", flexShrink: 0 }}
      >
        <Icon
          style={{ width: 18, height: 18, color: active ? c.ink : "currentColor" }}
          strokeWidth={active ? 2 : 1.75}
        />
      </motion.span>
      <span
        style={{
          whiteSpace: "nowrap",
          opacity: expanded ? 1 : 0,
          transform: expanded ? "translateX(0)" : "translateX(-6px)",
          transition: "opacity 180ms ease 60ms, transform 220ms cubic-bezier(0.22,0.9,0.28,1) 60ms",
          fontSize: 13.5,
          fontWeight: active ? 600 : 470,
        }}
      >
        {label}
      </span>
    </>
  )

  const style: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 13,
    height: 42,
    width: "100%",
    padding: "0 0 0 23px",
    borderRadius: r.md,
    border: "none",
    background: active ? "var(--ae-teal-bg)" : "transparent",
    color: active ? c.ink : c.muted,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: ff.body,
    textAlign: "left",
    transition: "background 150ms ease, color 150ms ease",
    overflow: "hidden",
  }

  return href ? (
    <Link href={href as Route} title={expanded ? undefined : label} className="ae-rail-item" style={style}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} title={expanded ? undefined : label} className="ae-rail-item" style={style}>
      {inner}
    </button>
  )
}

export function SimulatorRail() {
  const pathname = usePathname() ?? "/simulator"
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      if (localStorage.getItem("aeolus-rail-pinned") === "1") setPinned(true)
      // boot brief — once per session
      if (!sessionStorage.getItem("aeolus-brief-seen")) {
        sessionStorage.setItem("aeolus-brief-seen", "1")
        const t = window.setTimeout(() => setBriefOpen(true), 1600)
        return () => window.clearTimeout(t)
      }
    } catch {}
  }, [])

  const togglePin = () => {
    setPinned((v) => {
      const next = !v
      try { localStorage.setItem("aeolus-rail-pinned", next ? "1" : "0") } catch {}
      return next
    })
  }

  const isActive = (href: string) =>
    href === "/simulator" ? pathname === "/simulator" : pathname.startsWith(href)

  const expanded = pinned || hovered
  const slotWidth = pinned ? WIDE : SLIM // layout width: overlay when hover-expanded

  return (
    <>
      {/* layout slot — reserves rail space; the nav overlays it when
          hover-expanded so page content never reflows */}
      <div style={{ width: slotWidth, flexShrink: 0, transition: mounted ? "width 240ms cubic-bezier(0.22,0.9,0.28,1)" : "none" }} />

      <nav
        aria-label="Simulator sections"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: expanded ? WIDE : SLIM,
          zIndex: 950,
          display: "flex",
          flexDirection: "column",
          background: c.canvas,
          borderRight: `1px solid ${c.hairline}`,
          boxShadow: expanded && !pinned ? "var(--ae-shadow-card-elev)" : "none",
          transition: mounted ? "width 240ms cubic-bezier(0.22,0.9,0.28,1), box-shadow 240ms ease" : "none",
          overflow: "hidden",
          fontFamily: ff.body,
        }}
      >
        {/* brand — wordmark only, no badge */}
        <Link
          href="/"
          title="Aeolus — home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: 60,
            padding: "0 0 0 21px",
            textDecoration: "none",
            borderBottom: `1px solid ${c.hairline}`,
            flexShrink: 0,
            color: c.ink,
          }}
        >
          <AeolusMark size={22} style={{ color: c.ink }} />
          <span
            style={{
              fontFamily: ff.display,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              opacity: expanded ? 1 : 0,
              transition: "opacity 180ms ease 60ms",
            }}
          >
            AEOLUS
          </span>
        </Link>

        {/* daily brief — the report lives at the top of the rail */}
        <div style={{ padding: "10px 8px 0" }}>
          <RailItem
            label="Daily brief"
            Icon={ScrollText}
            active={briefOpen}
            expanded={expanded}
            onClick={() => setBriefOpen(true)}
          />
        </div>

        {/* groups */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {GROUPS.map((group) => (
            <div key={group.heading} style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
              <span
                aria-hidden
                style={{
                  height: 16,
                  fontFamily: ff.mono,
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: c.muted,
                  paddingLeft: 15,
                  whiteSpace: "nowrap",
                  opacity: expanded ? 0.9 : 0,
                  transition: "opacity 160ms ease",
                }}
              >
                {group.heading}
              </span>
              {group.items.map(({ href, label, Icon }) => (
                <RailItem key={href} href={href} label={label} Icon={Icon} active={isActive(href)} expanded={expanded} />
              ))}
            </div>
          ))}
        </div>

        {/* pin toggle */}
        <button
          type="button"
          onClick={togglePin}
          aria-label={pinned ? "Unpin navigation" : "Pin navigation open"}
          title={pinned ? "Unpin" : "Pin open"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            height: 46,
            padding: "0 0 0 23px",
            border: "none",
            borderTop: `1px solid ${c.hairline}`,
            background: "transparent",
            color: pinned ? c.ink : c.muted,
            cursor: "pointer",
            fontFamily: ff.body,
            fontSize: 12.5,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {pinned
            ? <PinOff style={{ width: 16, height: 16, flexShrink: 0 }} strokeWidth={1.75} />
            : <Pin style={{ width: 16, height: 16, flexShrink: 0 }} strokeWidth={1.75} />}
          <span style={{ whiteSpace: "nowrap", opacity: expanded ? 1 : 0, transition: "opacity 180ms ease 60ms" }}>
            {pinned ? "Unpin rail" : "Pin rail open"}
          </span>
        </button>

        <style jsx global>{`
          .ae-rail-item:hover {
            background: var(--ae-surface-2);
            color: var(--ae-text) !important;
          }
          .ae-rail-item:focus-visible {
            outline: none;
            box-shadow: inset 0 0 0 3px var(--ae-focus);
          }
        `}</style>
      </nav>

      <OpsBrief open={briefOpen} onClose={() => setBriefOpen(false)} railWidth={slotWidth} />
    </>
  )
}
