"use client"
/**
 * SimulatorRail — collapsible left section nav for the /simulator workspace.
 *
 * Daylight register (paper floor, hairline border, teal identity). Sits full
 * viewport height on the far left; every /simulator route mounts it through
 * app/simulator/layout.tsx. Collapsed it is an icon rail (labels appear on
 * hover as tooltips); expanded it shows grouped labels. The collapse state
 * persists in localStorage. This replaces the old top-bar route tabs so the
 * top bar can carry status only.
 */

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  FlaskConical,
  GitCompareArrows,
  Waypoints,
  Users,
  UserRound,
  Gauge,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react"
import { AeolusMark } from "@/components/ds/logo"
import { c, ff, r } from "@/lib/design-tokens"

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

const EXPANDED = 214
const COLLAPSED = 62

export function SimulatorRail() {
  const pathname = usePathname() ?? "/simulator"
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem("aeolus-rail-collapsed")
      if (saved === "1") setCollapsed(true)
      if (saved === null && window.innerWidth < 1100) setCollapsed(true)
    } catch {}
  }, [])

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v
      try { localStorage.setItem("aeolus-rail-collapsed", next ? "1" : "0") } catch {}
      return next
    })
  }

  const isActive = (href: string) =>
    href === "/simulator" ? pathname === "/simulator" : pathname.startsWith(href)

  const width = collapsed ? COLLAPSED : EXPANDED

  return (
    <nav
      aria-label="Simulator sections"
      style={{
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        width,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: c.canvas,
        borderRight: `1px solid ${c.hairline}`,
        // transition only after mount so SSR width matches first client paint
        transition: mounted ? "width 260ms cubic-bezier(0.22,0.9,0.28,1)" : "none",
        overflow: "hidden",
        zIndex: 60,
        fontFamily: ff.body,
      }}
    >
      {/* brand / home */}
      <Link
        href="/"
        title="Aeolus — home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          height: 60,
          padding: `0 ${collapsed ? 0 : 16}px`,
          justifyContent: collapsed ? "center" : "flex-start",
          textDecoration: "none",
          borderBottom: `1px solid ${c.hairline}`,
          flexShrink: 0,
        }}
      >
        <AeolusMark size={24} style={{ color: c.ink }} />
        {!collapsed && (
          <span style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 16, color: c.ink, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            Aeolus
          </span>
        )}
      </Link>

      {/* groups */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        {GROUPS.map((group) => (
          <div key={group.heading} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                fontFamily: ff.mono,
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: c.muted,
                padding: collapsed ? "6px 0" : "6px 10px 2px",
                textAlign: collapsed ? "center" : "left",
                whiteSpace: "nowrap",
                opacity: collapsed ? 0.55 : 1,
              }}
            >
              {collapsed ? "·" : group.heading}
            </span>
            {group.items.map(({ href, label, Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href as Route}
                  title={collapsed ? label : undefined}
                  className="ae-rail-link"
                  data-active={active}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    height: 40,
                    padding: collapsed ? 0 : "0 10px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: r.md,
                    textDecoration: "none",
                    color: active ? c.tealInk : c.body,
                    background: active ? "var(--ae-teal-bg)" : "transparent",
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 450,
                    position: "relative",
                    transition: "background 150ms ease, color 150ms ease",
                  }}
                >
                  {active && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: 3,
                        background: "var(--ae-teal)",
                      }}
                    />
                  )}
                  <Icon style={{ width: 17, height: 17, flexShrink: 0, color: active ? "var(--ae-teal)" : c.muted }} strokeWidth={1.75} />
                  {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {/* collapse toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand" : "Collapse"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 46,
          padding: collapsed ? 0 : "0 18px",
          justifyContent: collapsed ? "center" : "flex-start",
          border: "none",
          borderTop: `1px solid ${c.hairline}`,
          background: "transparent",
          color: c.muted,
          cursor: "pointer",
          fontFamily: ff.body,
          fontSize: 12.5,
          flexShrink: 0,
        }}
      >
        {collapsed ? (
          <PanelLeftOpen style={{ width: 17, height: 17 }} strokeWidth={1.75} />
        ) : (
          <PanelLeftClose style={{ width: 17, height: 17 }} strokeWidth={1.75} />
        )}
        {!collapsed && <span style={{ whiteSpace: "nowrap" }}>Collapse</span>}
      </button>

      <style jsx>{`
        .ae-rail-link[data-active="false"]:hover {
          background: var(--ae-surface-2) !important;
          color: ${c.ink} !important;
        }
      `}</style>
    </nav>
  )
}
