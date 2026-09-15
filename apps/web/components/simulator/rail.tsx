"use client"
/**
 * SimulatorRail — the left navigation for every /simulator route.
 *
 * ── 2026-08-16: THE RAIL PUSHES, IT DOES NOT OVERLAY ──────────────────────
 *
 * The previous implementation reserved a SLIM-width layout slot and rendered
 * the expanded nav as a fixed overlay on top of the page, under a comment
 * explaining that this was so "page content never reflows". On an ops console
 * that is the wrong trade: the thing the expanded nav covered was the Events
 * panel and the left third of the map — i.e. hovering the navigation hid the
 * disruption controls and part of the network being navigated. A dispatcher
 * should never lose sight of live state to read a menu label.
 *
 * The layout slot now tracks the ACTUAL width, so expanding the rail shifts
 * the whole console right and nothing is ever occluded. The cost is a reflow,
 * which is why the map's ResizeObserver is rAF-coalesced (see MapResizeFix in
 * flight-map.tsx) — without that, the 240ms width transition fired ~15 full
 * Leaflet re-layouts per hover.
 *
 * Structure follows the reference: brand, search, one primary action, then
 * grouped nav where a section with children expands to show them nested. Sub-
 * items are only reachable when the rail is expanded, so every parent is also
 * a real destination — a collapsed rail never hides a route behind a hover.
 */

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
/**
 * ── 2026-08-17: ONLY UNIVERSALLY RECOGNISED GLYPHS ────────────────────────
 *
 * Four icons were replaced because they were a private vocabulary: a
 * dashboard-grid for the live MAP, a waypoint graph for CASCADE, compare-
 * arrows (a diff glyph, borrowed from version control) for RECOVERY, and a
 * speedometer for ANALYSIS. None of them is readable without being learned
 * first, and an icon that needs a legend is not doing an icon's job on a
 * surface someone reads under time pressure.
 *
 * The replacements are all glyphs a person already knows from somewhere else:
 * a map, a clock, scales, a bar chart. Where no universal glyph exists the
 * answer is a word, not a cleverer drawing.
 */
import {
  Map as MapIcon,
  FlaskConical,
  Scale,
  Clock,
  Users,
  UserRound,
  BarChart3,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Bookmark,
  Search,
  Plus,
  Settings,
  LifeBuoy,
  CornerDownRight,
  type LucideIcon,
} from "lucide-react"
import { c, ff, r } from "@/lib/design-tokens"
import { OpsBrief } from "@/components/simulator/ops-brief"

type NavItem = {
  href: string
  label: string
  Icon: LucideIcon
  children?: { href: string; label: string }[]
}

/**
 * Every parent is a real route. A section that only existed to hold children
 * would be a dead control at SLIM width, where children are not rendered.
 */
const NAV: NavItem[] = [
  { href: "/simulator", label: "Live map", Icon: MapIcon },
  {
    href: "/simulator/cascade",
    label: "Cascade",
    Icon: Clock,
    children: [
      { href: "/simulator/cascade", label: "Timeline" },
      { href: "/simulator/watchlist", label: "Watchlist" },
      { href: "/simulator/playtest", label: "Playtest" },
    ],
  },
  {
    href: "/simulator/plans",
    label: "Recovery",
    Icon: Scale,
    children: [
      { href: "/simulator/plans", label: "Plans" },
      { href: "/simulator/crew", label: "Crew" },
      { href: "/simulator/passengers", label: "Passengers" },
    ],
  },
  {
    href: "/simulator/stress-test",
    label: "Analysis",
    Icon: BarChart3,
    children: [
      { href: "/simulator/stress-test", label: "Stress test" },
      { href: "/simulator/carbon", label: "Carbon" },
    ],
  },
]

export const RAIL_SLIM = 68
export const RAIL_WIDE = 252
/**
 * Phone width. 52px, not 68 — at 390px the slim rail was taking 17.4% of the
 * viewport for a column of icons with no labels, permanently, on the axis the
 * console has least of. 52 still clears the 44px primary-target floor with a
 * 4px gutter either side, and hands 16px back to the map.
 *
 * It does NOT collapse to zero. There is no hamburger on this console and
 * adding one would trade a visible 52px for a hidden menu plus a new control;
 * on an ops surface the section nav staying permanently on screen is worth
 * more than the width. Full off-canvas drawer is parked (see NEXT-STEPS.md).
 */
export const RAIL_PHONE = 52

/** One top-level nav row. */
function RailItem({
  href, label, Icon, active, expanded, onClick, badge,
}: {
  href?: string
  label: string
  Icon: LucideIcon
  active: boolean
  expanded: boolean
  onClick?: () => void
  badge?: string
}) {
  const inner = (
    <>
      {active && (
        <span
          aria-hidden
          // Classed so the phone-width rule that strips labels out of the flow
          // can exempt it. It is the only span in this row that is NOT a label
          // — it is the active-route marker, and it is absolutely positioned so
          // it costs no width in the 52px column.
          className="ae-rail-bar"
          style={{
            position: "absolute", left: 0, top: 7, bottom: 7, width: 3,
            borderRadius: "0 3px 3px 0", background: "var(--ae-teal)",
          }}
        />
      )}
      <Icon
        aria-hidden
        style={{ width: 18, height: 18, flexShrink: 0, color: active ? "var(--ae-teal-ink)" : "currentColor" }}
        strokeWidth={active ? 2.2 : 1.9}
      />
      <span
        style={{
          whiteSpace: "nowrap",
          opacity: expanded ? 1 : 0,
          transform: expanded ? "translateX(0)" : "translateX(-6px)",
          transition: "opacity 160ms ease 50ms, transform 200ms cubic-bezier(0.22,0.9,0.28,1) 50ms",
          fontSize: 13.5,
          fontWeight: active ? 600 : 470,
        }}
      >
        {label}
      </span>
      {badge && expanded && (
        <span
          style={{
            marginLeft: "auto", marginRight: 12,
            fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600,
            padding: "2px 6px", borderRadius: r.sm,
            background: "var(--ae-teal-bg)", color: "var(--ae-teal-ink)",
          }}
        >
          {badge}
        </span>
      )}
    </>
  )

  const style: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 13,
    height: 40,
    width: "100%",
    padding: "0 0 0 24px",
    borderRadius: r.md,
    border: "none",
    background: active ? "var(--ae-teal-bg)" : "transparent",
    color: active ? c.ink : c.muted,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: ff.body,
    textAlign: "left",
    transition: "background 140ms ease, color 140ms ease",
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

/** A nested child route. Rendered only when the rail is expanded. */
function SubItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href as Route}
      className="ae-rail-item"
      style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 34, paddingLeft: 34, marginLeft: 12,
        borderRadius: r.sm,
        textDecoration: "none",
        fontFamily: ff.body, fontSize: 12.75,
        fontWeight: active ? 600 : 450,
        whiteSpace: "nowrap",
        // The active child gets the boxed treatment from the reference: a
        // filled well, not just coloured text. Visual weight follows
        // consequence (design.md) — this is where you ARE, not a hover.
        background: active ? "var(--ae-surface-3)" : "transparent",
        color: active ? c.ink : c.muted,
        boxShadow: active ? "inset 0 0 0 1px var(--ae-line)" : "none",
        transition: "background 140ms ease, color 140ms ease",
      }}
    >
      <CornerDownRight aria-hidden style={{ width: 13, height: 13, flexShrink: 0, opacity: 0.7 }} strokeWidth={1.9} />
      {label}
    </Link>
  )
}

export function SimulatorRail() {
  const pathname = usePathname() ?? "/simulator"
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [phone, setPhone] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      if (localStorage.getItem("olus-rail-pinned") === "1") setPinned(true)
    } catch {}
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 880px)")
    const sync = () => setPhone(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const togglePin = () => {
    setPinned((v) => {
      const next = !v
      try { localStorage.setItem("olus-rail-pinned", next ? "1" : "0") } catch {}
      return next
    })
  }

  const exact = (href: string) => pathname === href
  const within = (item: NavItem) =>
    item.href === "/simulator"
      ? pathname === "/simulator"
      : pathname.startsWith(item.href) ||
        (item.children?.some((ch) => pathname.startsWith(ch.href)) ?? false)

  // Keyboard users get the same expansion mouse users get. Without
  // focus-within the labels stayed at opacity 0 while tabbing through the
  // nav, so every rail stop announced a name the user could not see.
  // Hover-expand is disabled on a phone. There is no hover there, and letting
  // focus alone expand it to 252px would cover two-thirds of a 390px viewport
  // the moment a keyboard or switch user tabbed into the nav.
  const expanded = phone ? pinned : pinned || hovered || focusWithin
  const width = expanded ? RAIL_WIDE : phone ? RAIL_PHONE : RAIL_SLIM

  return (
    <>
      {/* Layout slot. Its width tracks the REAL width, so expanding the rail
          pushes the console right instead of covering it. */}
      <div
        style={{
          width,
          flexShrink: 0,
          transition: mounted ? "width 240ms cubic-bezier(0.22,0.9,0.28,1)" : "none",
        }}
      />

      <nav
        aria-label="Simulator sections"
        // Drives the phone-width centring rules below. The rail's items carry a
        // 24px left indent so their glyphs line up with the labels that appear
        // on expand; at RAIL_PHONE that indent puts an 18px icon at x 24–42 in
        // a 52px column, i.e. hard against the right edge and visually clipped.
        // Centring is only correct while COLLAPSED — pinned open on a phone the
        // labels are back and the indent is doing its job again.
        data-collapsed={!expanded ? "" : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocusWithin(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false)
        }}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width,
          zIndex: 950,
          display: "flex",
          flexDirection: "column",
          background: c.canvas,
          borderRight: `1px solid ${c.hairline}`,
          transition: mounted ? "width 240ms cubic-bezier(0.22,0.9,0.28,1)" : "none",
          overflow: "hidden",
          fontFamily: ff.body,
        }}
      >
        {/* No brand block.
            The cyclone OlusMark used to sit here with the wordmark beside
            it. Both are gone from the console: the mark because a logo that
            has to be explained is decoration on an operations surface, and
            the wordmark because the board bar three pixels to the right
            already says OLUS — the rail was printing the product name a
            second time in the operator's peripheral vision, permanently, and
            spending 56px of the nav column to do it.

            That height now belongs to navigation, which is the rail's only
            job. The route home is the "Leave the console" item in the account
            menu, where the rest of the session controls live. */}

        {/* search + primary action */}
        <div style={{ padding: "2px 10px 10px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="ae-rail-search"
            // Focuses the console's real search field rather than owning a
            // second one — two search boxes on one screen is the drift this
            // system keeps having to undo.
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>("[data-ae-search]")
              el?.focus()
            }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              height: 36, width: "100%", padding: "0 10px 0 13px",
              borderRadius: r.md, cursor: "pointer",
              border: `1px solid ${c.hairline}`,
              background: "var(--ae-surface-2)",
              color: c.muted, fontFamily: ff.body, fontSize: 13,
              textAlign: "left", overflow: "hidden",
            }}
          >
            <Search aria-hidden style={{ width: 15, height: 15, flexShrink: 0 }} strokeWidth={1.9} />
            <span style={{ whiteSpace: "nowrap", opacity: expanded ? 1 : 0, transition: "opacity 160ms ease 50ms" }}>
              Search flights
            </span>
            {expanded && (
              <kbd
                style={{
                  marginLeft: "auto", fontFamily: ff.mono, fontSize: 10.5,
                  padding: "1px 5px", borderRadius: 4,
                  border: `1px solid ${c.hairline}`, color: c.muted,
                }}
              >
                /
              </kbd>
            )}
          </button>

          <Link
            href={"/simulator/scenarios" as Route}
            className="ae-rail-cta"
            title={expanded ? undefined : "Load scenario"}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              height: 38, width: "100%", padding: "0 10px 0 12px",
              borderRadius: r.md, textDecoration: "none",
              border: "1px solid var(--ae-primary)",
              background: "var(--ae-primary)",
              color: "var(--ae-on-primary)",
              fontFamily: ff.body, fontSize: 13.25, fontWeight: 600,
              overflow: "hidden",
              transition: "background 140ms ease",
            }}
          >
            <Plus aria-hidden style={{ width: 16, height: 16, flexShrink: 0 }} strokeWidth={2.4} />
            <span style={{ whiteSpace: "nowrap", opacity: expanded ? 1 : 0, transition: "opacity 160ms ease 50ms" }}>
              Load scenario
            </span>
          </Link>
        </div>

        {/* nav */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 10px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => {
            const open = expanded && !!item.children && within(item)
            return (
              <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <RailItem
                  href={item.href}
                  label={item.label}
                  Icon={item.Icon}
                  active={within(item)}
                  expanded={expanded}
                />
                {open && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingBottom: 4 }}>
                    {item.children!.map((ch) => (
                      <SubItem key={ch.href + ch.label} href={ch.href} label={ch.label} active={exact(ch.href)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ height: 1, background: c.hairline, margin: "10px 4px" }} />

          <RailItem
            label="Daily brief"
            Icon={FileText}
            active={briefOpen}
            expanded={expanded}
            onClick={() => setBriefOpen(true)}
          />
          <RailItem href="/simulator/watchlist" label="Watchlist" Icon={Bookmark} active={exact("/simulator/watchlist")} expanded={expanded} />
          <RailItem href="/simulator/playtest" label="Playtest" Icon={FlaskConical} active={exact("/simulator/playtest")} expanded={expanded} />
        </div>

        {/* footer */}
        <div style={{ padding: "6px 10px 8px", borderTop: `1px solid ${c.hairline}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <RailItem href="/docs" label="Docs & support" Icon={LifeBuoy} active={false} expanded={expanded} />
          <RailItem href="/simulator/settings" label="Settings" Icon={Settings} active={exact("/simulator/settings")} expanded={expanded} />
          <button
            type="button"
            onClick={togglePin}
            aria-label={pinned ? "Unpin navigation" : "Pin navigation open"}
            aria-pressed={pinned}
            className="ae-rail-item"
            style={{
              display: "flex", alignItems: "center", gap: 13,
              height: 38, padding: "0 0 0 24px", borderRadius: r.md,
              border: "none", background: "transparent",
              color: pinned ? c.ink : c.muted,
              cursor: "pointer", fontFamily: ff.body, fontSize: 12.75,
              overflow: "hidden", width: "100%", textAlign: "left",
            }}
          >
            {pinned
              ? <PanelLeftClose aria-hidden style={{ width: 17, height: 17, flexShrink: 0 }} strokeWidth={1.9} />
              : <PanelLeftOpen aria-hidden style={{ width: 17, height: 17, flexShrink: 0 }} strokeWidth={1.9} />}
            <span style={{ whiteSpace: "nowrap", opacity: expanded ? 1 : 0, transition: "opacity 160ms ease 50ms" }}>
              {pinned ? "Unpin rail" : "Pin rail open"}
            </span>
          </button>
        </div>

        <style jsx global>{`
          .ae-rail-item:hover {
            background: var(--ae-surface-2);
            color: var(--ae-text) !important;
          }
          .ae-rail-item:focus-visible,
          .ae-rail-search:focus-visible,
          .ae-rail-cta:focus-visible {
            outline: none;
            box-shadow: inset 0 0 0 3px var(--ae-focus);
          }
          .ae-rail-search:hover { background: var(--ae-surface-3); color: var(--ae-text); }
          .ae-rail-cta:hover { background: var(--ae-primary-active); border-color: var(--ae-primary-active); }

          /* Phone width, collapsed: centre every glyph in the 52px column.
             The labels have to leave LAYOUT, not just go transparent. At full
             width they ride the expansion on opacity so the text can fade in
             place, but a nowrap label at opacity 0 still claims its full
             measure — so centring the row was centring an
             icon-plus-invisible-label pair and pushing the icon clean out of
             the 52px box. Removing them from flow is what actually centres the
             glyph, and it costs nothing here because at this width they are
             never revealed without the rail also widening. */
          @media (max-width: 880px) {
            nav[data-collapsed] .ae-rail-item,
            nav[data-collapsed] .ae-rail-search,
            nav[data-collapsed] .ae-rail-cta {
              padding-left: 0 !important;
              padding-right: 0 !important;
              justify-content: center;
              gap: 0;
            }
            /* Descendant selectors, not child combinators: a bare greater-than
               inside a styled-jsx template is parsed as JSX and fails the
               build. Backticks are avoided in this block for the same reason —
               they close the template literal. */
            nav[data-collapsed] .ae-rail-item span:not(.ae-rail-bar),
            nav[data-collapsed] .ae-rail-search span,
            nav[data-collapsed] .ae-rail-search kbd,
            nav[data-collapsed] .ae-rail-cta span {
              display: none;
            }
          }
        `}</style>
      </nav>

      <OpsBrief open={briefOpen} onClose={() => setBriefOpen(false)} railWidth={width} />
    </>
  )
}
