"use client"
/**
 * ContextColumn — the console's single docked working column.
 *
 * ── 2026-08-16: ONE COLUMN, TABBED. Replaces two opposing docked panels ──
 *
 * The shell had Events docked left and Recovery docked right, with a mutual-
 * exclusion rule below 1500px, an overlay fallback below 900px, restore logic
 * that had to reproduce the exclusion, and a flight inspector floating on the
 * map as a third surface. That is four layout modes and three places a panel
 * could appear, which is where the console's collisions came from — the audit
 * measured 16 overlapping interactive pairs at 1440 and 58 at 390.
 *
 * One column removes the entire class of defect: there is exactly one place a
 * panel can be, so nothing can overlap anything, no exclusion rule is needed,
 * and the map is a single uninterrupted region at every width. It also matches
 * how the surface is actually used — an operator is inspecting an event, or a
 * plan, or a flight, not two of them at once.
 *
 * Everything stays REACHABLE, which is the constraint that makes tabs
 * acceptable here rather than a hiding place: each tab carries its own count so
 * the badge tells you what is waiting behind it, and selecting a flight on the
 * map switches to Flight automatically because that IS the request.
 */

import { useEffect, useRef } from "react"
import { Map } from "lucide-react"
import { c, ff, r } from "@/lib/design-tokens"

export type ContextTab = "events" | "recovery" | "flight"

/**
 * A tab is a WORD, not a word wearing a glyph.
 *
 * These carried CloudLightning / Waypoints / Plane. Two costs, both real.
 * Measured: at the column's 360px default each tab gets ~114px, and icon (14)
 * + gaps (12) + count badge (20) + padding (16) left ~52px for the label —
 * so "Recovery" rendered as "Recov…" and, at the mobile sheet's width, as
 * "R…". A truncated tab label is a nav item you cannot read.
 *
 * And none of the three glyphs was carrying meaning the word did not already
 * carry. A lightning bolt for "Events" and a waypoint graph for "Recovery" are
 * decoration that has to be learned; dropping them buys back the 26px that
 * made the labels fit.
 */
const TABS: { id: ContextTab; label: string }[] = [
  { id: "events",   label: "Events" },
  { id: "recovery", label: "Recovery" },
  { id: "flight",   label: "Flight" },
]

export function ContextColumn({
  tab, onTab, counts, flightEnabled, onClose, children,
}: {
  tab: ContextTab
  onTab: (t: ContextTab) => void
  counts: Partial<Record<ContextTab, number>>
  flightEnabled: boolean
  /** Supplied only where the column is a full-screen sheet — see below. */
  onClose?: () => void
  children: React.ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)

  // Roving arrow-key navigation, which the WAI-ARIA tabs pattern requires and
  // the previous segmented controls in this codebase never implemented — every
  // tab was its own tab stop, so reaching the panel body from the first tab
  // took as many Tab presses as there were tabs.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return
    const usable = TABS.filter((t) => t.id !== "flight" || flightEnabled)
    const i = usable.findIndex((t) => t.id === tab)
    if (i < 0) return
    e.preventDefault()
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? usable.length - 1
      : e.key === "ArrowRight" ? (i + 1) % usable.length
      : (i - 1 + usable.length) % usable.length
    onTab(usable[next].id)
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${usable[next].id}"]`)?.focus()
    })
  }

  return (
    <section
      aria-label="Working panel"
      style={{
        display: "flex", flexDirection: "column",
        height: "100%", minHeight: 0, minWidth: 0,
        background: c.canvas,
        borderRight: `1px solid ${c.hairline}`,
      }}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label="Working panel sections"
        onKeyDown={onKeyDown}
        style={{
          display: "flex", gap: 0, padding: 0, flexShrink: 0,
          borderBottom: `1px solid ${c.hairline}`,
          background: "var(--ae-surface-2)",
        }}
      >
        {TABS.map(({ id, label }) => {
          const disabled = id === "flight" && !flightEnabled
          const active = tab === id
          const n = counts[id]
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`ae-context-tab-${id}`}
              data-tab={id}
              aria-selected={active}
              aria-controls="ae-context-body"
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onTab(id)}
              className="ae-ctx-tab"
              style={{
                position: "relative",
                flex: 1, minWidth: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                height: 30, padding: "0 6px", borderRadius: 0,
                // A module tab, not a pill: the active one is the white module
                // face rising out of the well, marked by a spectral band on its
                // top edge. Visual weight follows consequence (design.md) — an
                // ink-filled tab reads as "committed", which selecting is not.
                border: "none",
                borderRight: `1px solid ${c.hairline}`,
                background: active ? c.canvas : "transparent",
                boxShadow: active ? `inset 0 2px 0 ${c.fringeViolet}` : "none",
                color: disabled ? "var(--ae-text-3)" : active ? c.ink : c.muted,
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: ff.mono, fontSize: 10.5,
                fontWeight: active ? 700 : 600,
                letterSpacing: "0.10em", textTransform: "uppercase",
                transition: "background 140ms ease, color 140ms ease",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
              {n != null && n > 0 && (
                <span
                  style={{
                    fontFamily: ff.mono, fontSize: 10, fontWeight: 700, lineHeight: 1,
                    padding: "3px 5px", borderRadius: 999, flexShrink: 0,
                    background: active ? "var(--ae-teal-bg)" : "var(--ae-surface-3)",
                    color: active ? "var(--ae-teal-ink)" : c.body,
                  }}
                >
                  {n}
                </span>
              )}
            </button>
          )
        })}

        {/* THE WAY BACK.
            Below 880px this column is a full-screen sheet over an inert map,
            and it shipped with no dismiss control at all — the collapse chevron
            lives on the map's edge, which is exactly the surface the sheet is
            covering. So on a phone, opening the panel was a one-way trip: the
            only exits were the browser back button or a reload. Measurement
            could not catch it (nothing overlapped, every target was big enough)
            because a missing control has no geometry to collide with. */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ae-ctx-tab"
            aria-label="Back to the map"
            style={{
              flexShrink: 0,
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 34, padding: "0 11px", borderRadius: r.sm,
              border: `1px solid ${c.hairline}`,
              background: "var(--ae-surface)",
              color: c.ink, cursor: "pointer",
              fontFamily: ff.body, fontSize: 12.5, fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <Map aria-hidden style={{ width: 14, height: 14 }} strokeWidth={2} />
            Map
          </button>
        )}
      </div>

      {/* aria-labelledby was missing, so the panel announced as an unnamed
          region — a screen-reader user landing here was told "tab panel" with
          no indication of which of the three they were in. */}
      <div
        id="ae-context-body"
        role="tabpanel"
        aria-labelledby={`ae-context-tab-${tab}`}
        tabIndex={0}
        style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {children}
      </div>

      <style jsx global>{`
        .ae-ctx-tab:hover:not(:disabled) { color: var(--ae-text); background: var(--ae-surface-3); }
        .ae-ctx-tab:focus-visible { outline: none; box-shadow: inset 0 0 0 3px var(--ae-focus); }
      `}</style>
    </section>
  )
}

/**
 * Product announcement, demoted from a full-width row to a card inside the
 * column.
 *
 * As a banner it took a permanent 44px strip across the whole console — above
 * the map, above the panels, for a message about a feature — and at 390px its
 * Dismiss button overlapped its own body text. A product note is not
 * dispatcher information, so it does not get to outrank the map for vertical
 * space; it lives with the events it describes and is dismissible for good.
 */
export function AnnouncementCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    /* A ruled note, not a tinted box.
       This was a lavender card with a plum border sitting at the top of the
       column — the most saturated object on the console, spending a filled
       surface on a FEATURE NOTE while live disruption state below it made do
       with hairlines. Visual weight follows consequence, and a product
       announcement has the least of any element here.
       It keeps its place in the column and its dismissal; it just stops
       shouting. The spectral fringe on its leading edge is the whole of its
       decoration. */
    <div
      style={{
        position: "relative",
        padding: "8px 12px 8px 14px",
        borderBottom: `1px solid ${c.hairline}`,
        background: "var(--ae-surface)",
        fontFamily: ff.body,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
          background: "var(--ae-fringe)",
        }}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong
          style={{
            fontFamily: ff.mono, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase", color: c.muted,
          }}
        >
          New — Drone incursion
        </strong>
        <button
          type="button"
          onClick={onDismiss}
          className="ae-detail-btn"
          style={{
            marginLeft: "auto", border: "none", background: "transparent",
            color: c.muted, cursor: "pointer",
            // minHeight 24, not the 21px the padding produced — WCAG 2.5.8.
            fontSize: 11.5, fontWeight: 600, padding: "0 8px", minHeight: 24, borderRadius: 5,
          }}
        >
          Dismiss
        </button>
      </div>
      <p style={{ margin: "5px 0 0", fontSize: 11.5, lineHeight: 1.45, color: c.body }}>
        Runway suspensions with an unknown end time. Recovery is solved across sampled
        closure lengths and reports an expected cost with a regret band.
      </p>
    </div>
  )
}
