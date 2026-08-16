"use client"
/**
 * Workspace chrome for the /simulator OCC — the pieces that make the three-zone
 * layout resizable and collapsible:
 *
 *   useResizable   pointer-drag width/height with min/max clamp + persistence
 *   ResizeHandle   the thin draggable divider between panels
 *   PanelHeader    a coloured panel header with a title, accent, and collapse ✕
 *   ReopenTab      a floating tab to bring a collapsed panel back
 *
 * The accent colour per panel is what brings the landing's palette into the
 * dashboard without abandoning the daylight/operational register: a tinted
 * gradient header strip + a 2px top rule in the panel's pigment.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, PanelRightClose, X } from "lucide-react"
import { c, ff } from "@/lib/design-tokens"

/**
 * How far a pointer move grows the sized region, per handle position.
 *
 * The sign follows one rule: WHICH SIDE OF THE HANDLE THE SIZED REGION IS ON.
 *
 *   left   handle right of the region  → moving right grows it   (pos - startPos)
 *   right  handle left of the region   → moving left grows it    (startPos - pos)
 *   bottom handle BELOW the region     → moving down grows it    (pos - startPos)
 *
 * `bottom` used to reuse `right`'s formula. That is correct for a handle above
 * a region that grows upward, which is not this handle: it sits under the map
 * and sizes the map. The result was a divider that ran AWAY from the cursor —
 * pulling down, the direction that should enlarge the map, collapsed it to its
 * 200px floor and moved the handle ~250px upward. It then persisted that to
 * localStorage, so one wrong drag survived a reload.
 */
function deltaFor(side: "left" | "right" | "bottom", pos: number, startPos: number): number {
  return side === "right" ? startPos - pos : pos - startPos
}

export function useResizable(
  storageKey: string,
  initial: number,
  min: number,
  max: number,
  side: "left" | "right" | "bottom" = "left",
) {
  const [size, setSize] = useState(initial)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const n = parseInt(saved, 10)
        if (!Number.isNaN(n)) setSize(Math.min(max, Math.max(min, n)))
      }
    } catch {}
  }, [storageKey, min, max])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      draggingRef.current = true
      setDragging(true)
      const startPos = side === "bottom" ? e.clientY : e.clientX
      const startSize = size
      try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId) } catch {}
      document.body.style.cursor = side === "bottom" ? "row-resize" : "col-resize"
      document.body.style.userSelect = "none"

      const move = (ev: PointerEvent) => {
        if (!draggingRef.current) return
        const pos = side === "bottom" ? ev.clientY : ev.clientX
        setSize(Math.min(max, Math.max(min, startSize + deltaFor(side, pos, startPos))))
      }
      const up = () => {
        draggingRef.current = false
        setDragging(false)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        // persist + nudge Leaflet to recompute
        setSize((s) => {
          try { localStorage.setItem(storageKey, String(Math.round(s))) } catch {}
          return s
        })
        window.dispatchEvent(new Event("resize"))
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
    },
    [size, min, max, side, storageKey],
  )

  return { size, setSize, onPointerDown, dragging }
}

/**
 * The draggable divider.
 *
 * The hit strip is 24px and the VISIBLE rule is 6px, centred in it (WCAG 2.5.8
 * asks for a 24px target, not a 24px mark). It was 6px tall for both, which is
 * the most-dragged control in the console rendered at a quarter of the minimum
 * target size.
 *
 * It is also a real `separator` widget now. Passing `value`/`min`/`max`/`onValue`
 * makes it focusable and arrow-key operable: it previously carried
 * `role="separator"` with `tabIndex -1`, no `aria-label` and no key handler, so
 * the only rebalancing control on the console was unreachable without a mouse.
 */
export function ResizeHandle({
  onPointerDown,
  side = "left",
  label = "Resize",
  value,
  min,
  max,
  onValue,
  step = 16,
  bigStep = 64,
}: {
  onPointerDown: (e: React.PointerEvent) => void
  side?: "left" | "right" | "bottom"
  label?: string
  value?: number
  min?: number
  max?: number
  /** Takes React's functional updater — see the note in `onKeyDown`. */
  onValue?: (update: (cur: number) => number) => void
  step?: number
  bigStep?: number
}) {
  const [hot, setHot] = useState(false)
  const [focused, setFocused] = useState(false)
  const horizontal = side === "bottom"
  const keyboard = value !== undefined && min !== undefined && max !== undefined && !!onValue

  // Grow keys point the way the region grows: for the bottom handle the map is
  // ABOVE it, so ArrowDown enlarges — the same relationship the drag now honours.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!keyboard) return
    const grow = horizontal ? "ArrowDown" : "ArrowRight"
    const shrink = horizontal ? "ArrowUp" : "ArrowLeft"
    const amount = e.shiftKey ? bigStep : step
    // A FUNCTIONAL update, not `value + amount`.
    //
    // `value` is a prop, so it is only as fresh as the last render. Two
    // keypresses inside one React batch both read the same stale number and
    // the second overwrites the first with an identical result — held arrow
    // keys and fast repeats moved the divider one step and then stopped.
    let delta: ((cur: number) => number) | null = null
    if (e.key === grow) delta = (cur) => cur + amount
    else if (e.key === shrink) delta = (cur) => cur - amount
    else if (e.key === "Home") delta = () => min!
    else if (e.key === "End") delta = () => max!
    if (!delta) return
    e.preventDefault()
    const clamp = delta
    onValue!((cur) => Math.min(max!, Math.max(min!, clamp(cur))))
    window.dispatchEvent(new Event("resize"))
  }

  const active = hot || focused
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      role="separator"
      tabIndex={keyboard ? 0 : -1}
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      aria-label={keyboard ? `${label} — arrow keys to adjust` : undefined}
      aria-valuenow={keyboard ? Math.round(value!) : undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      title="Drag to resize"
      style={{
        position: "relative",
        flexShrink: 0,
        // 24px target, 6px rule. Negative margins keep the extra 18px from
        // stealing layout height from the regions it sits between.
        width: horizontal ? "100%" : 24,
        height: horizontal ? 24 : "100%",
        margin: horizontal ? "-9px 0" : "0 -9px",
        cursor: horizontal ? "row-resize" : "col-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        zIndex: 20,
        touchAction: "none",
      }}
    >
      {/* the visible rule */}
      <span
        aria-hidden
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: horizontal ? "100%" : 6,
          height: horizontal ? 6 : "100%",
          background: active ? "var(--ae-teal)" : "transparent",
          boxShadow: focused ? "0 0 0 3px var(--ae-focus)" : undefined,
          transition: "background 140ms ease",
        }}
      >
        {/* grip dots, centered */}
        <span
          style={{
            display: "flex",
            flexDirection: horizontal ? "row" : "column",
            gap: 3,
            opacity: active ? 0 : 0.5,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 3, height: 3, borderRadius: 99, background: c.muted }} />
          ))}
        </span>
      </span>
    </div>
  )
}

/** Colored panel header — title + subtitle + accent, with a collapse button. */
export function PanelHeader({
  title,
  subtitle,
  accent,
  icon,
  onCollapse,
  collapseSide = "left",
}: {
  title: string
  subtitle?: string
  accent: string
  icon?: ReactNode
  onCollapse: () => void
  collapseSide?: "left" | "right"
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 12px 12px 16px",
        borderBottom: `1px solid ${c.hairline}`,
        // tinted gradient wash in the panel's pigment — the color the user wanted
        background: `linear-gradient(180deg, ${accent}14, transparent)`,
        flexShrink: 0,
      }}
    >
      {/* 2px top accent rule */}
      <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      {icon && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 9,
            background: `${accent}1E`,
            color: accent,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        {/* h2, not div: every panel title is a real section heading. The
            console shipped with zero headings, so screen-reader heading
            navigation — the primary wayfinding mechanism — did not exist. */}
        <h2 style={{ fontFamily: ff.display, fontWeight: 650, fontSize: 14.5, color: c.ink, letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0 }}>
          {title}
        </h2>
        {subtitle && (
          <div style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: "0.06em", color: c.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {subtitle}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onCollapse}
        aria-label={`Collapse ${title}`}
        title="Collapse panel"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 8,
          border: `1px solid ${c.hairline}`,
          background: "transparent",
          color: c.muted,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {collapseSide === "left" ? (
          <ChevronLeft style={{ width: 15, height: 15 }} strokeWidth={2} />
        ) : (
          <PanelRightClose style={{ width: 15, height: 15 }} strokeWidth={1.9} />
        )}
      </button>
    </div>
  )
}

/** Floating tab to reopen a collapsed side panel. */
export function ReopenTab({
  label,
  accent,
  side,
  icon,
  onClick,
}: {
  label: string
  accent: string
  side: "left" | "right"
  icon?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${label}`}
      title={`Open ${label}`}
      style={{
        // mid-edge (vertically centred) so the reopen tab never collides with
        // the top-corner overlays (search bar, focus button, flight panels).
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        [side]: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        border: `1px solid ${c.hairline}`,
        borderLeft: side === "left" ? "none" : undefined,
        borderRight: side === "right" ? "none" : undefined,
        borderTopRightRadius: side === "left" ? 12 : 0,
        borderBottomRightRadius: side === "left" ? 12 : 0,
        borderTopLeftRadius: side === "right" ? 12 : 0,
        borderBottomLeftRadius: side === "right" ? 12 : 0,
        background: "var(--ae-surface)",
        color: c.ink,
        cursor: "pointer",
        boxShadow: "var(--ae-shadow-card-elev)",
        fontFamily: ff.body,
        fontSize: 12.5,
        fontWeight: 550,
      }}
    >
      {side === "right" && <ChevronLeft style={{ width: 14, height: 14, color: accent }} strokeWidth={2} />}
      {icon && <span style={{ display: "inline-flex", color: accent }}>{icon}</span>}
      <span>{label}</span>
      {side === "left" && <ChevronRight style={{ width: 14, height: 14, color: accent }} strokeWidth={2} />}
    </button>
  )
}

export { X }


const PANEL_EASE = [0.22, 0.9, 0.28, 1] as const

// ─── Floating overlay panel ──────────────────────────────────────────────
// A workspace side panel: a thin accent top rule, the child's own header, a
// scrollable body, and a slim vertical launcher tab when closed.
//
// `docked` (the default) makes it a GRID TRACK — it takes width in the flex
// row and the surface beside it narrows to fit. It used to be an absolutely
// positioned overlay at z-640, which measured as covering 58.7% of the map at
// 1280 and 75.8% at 200% zoom, and buried five of the map's own overlays
// (counters, legend, flight ticket, airport card) underneath it. That is also
// what forced the "selecting a flight force-closes both panels" workaround:
// the topology could not show a flight and its recovery options at once, which
// are the two things an operator needs together.
//
// `docked={false}` keeps the old overlay behaviour for callers that genuinely
// want a floating layer.

export function FloatingPanel({
  side, open, accent, title, icon, onOpen, onClose, children, width = 356, badge,
  docked = true,
}: {
  side: "left" | "right"
  open: boolean
  accent: string
  title: string
  icon: React.ReactNode
  onOpen: () => void
  onClose: () => void
  children: React.ReactNode
  width?: number
  badge?: number
  docked?: boolean
}) {
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            key={`${side}-panel`}
            initial={docked ? { width: 0, opacity: 0 } : { x: side === "left" ? -28 : 28, opacity: 0 }}
            animate={docked ? { width, opacity: 1 } : { x: 0, opacity: 1 }}
            exit={docked ? { width: 0, opacity: 0 } : { x: side === "left" ? -28 : 28, opacity: 0 }}
            transition={{ duration: 0.26, ease: PANEL_EASE }}
            aria-label={title}
            style={{
              // Docked: a real track in the flex row, so nothing is covered
              // and no z-index arbitration is needed. Floating: the old layer.
              ...(docked
                ? {
                    position: "relative" as const,
                    width,
                    flexShrink: 0,
                    [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${c.hairline}`,
                  }
                : {
                    position: "absolute" as const,
                    top: 14,
                    bottom: 14,
                    [side]: 14,
                    width: `min(${width}px, calc(100% - 88px))`,
                    zIndex: 640,
                    border: `1px solid ${c.hairline}`,
                    borderRadius: 18,
                    boxShadow: "var(--ae-shadow-overlay)",
                  }),
              background: "var(--ae-surface)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: ff.body,
            }}
          >
            {/* accent top rule — the only chrome this layer adds; each panel
                brings its own header, so we don't stack a second one */}
            <span aria-hidden style={{ height: 3, background: accent, flexShrink: 0 }} />

            {/* floating close — sits over the panel header's empty right end */}
            <button
              type="button" onClick={onClose} aria-label={`Close ${title}`}
              style={{
                position: "absolute", top: 9, right: 9, zIndex: 5,
                // 36, not 28: a panel's dismiss control was under the 32px
                // comfortable floor while sitting in the corner most likely to
                // be hit in a hurry.
                width: 36, height: 36, borderRadius: 9, border: `1px solid ${c.hairline}`,
                background: "var(--ae-surface)", color: c.muted, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X style={{ width: 15, height: 15 }} strokeWidth={2} />
            </button>

            {/* body — the panel manages its own header + internal scroll
                (both EventPanel and RecoveryPlans are h-full flex columns) */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {children}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* launcher tab (closed) */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key={`${side}-tab`}
            type="button"
            onClick={onOpen}
            aria-label={`Open ${title}`}
            initial={{ x: side === "left" ? -12 : 12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: side === "left" ? -12 : 12, opacity: 0 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease: PANEL_EASE }}
            className="ae-launcher"
            style={{
              // Docked: a full-height edge rail. The click target being the
              // whole column is deliberate (Fitts's law — it is the easiest
              // target on the screen), but the CONTENT sits at the top rather
              // than floating in the middle of an 840px strip, which is what
              // made it read as an unfinished sliver. No card chrome, no
              // shadow, no asymmetric radius: at full height those made it look
              // like a collapsed panel that had gone wrong rather than a tab.
              ...(docked
                ? {
                    position: "relative" as const,
                    flexShrink: 0,
                    alignSelf: "stretch" as const,
                    justifyContent: "flex-start" as const,
                    paddingTop: 14,
                    width: 38,
                    background: "var(--ae-surface)",
                    [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${c.hairline}`,
                  }
                : {
                    position: "absolute" as const, top: "50%", [side]: 0,
                    transform: "translateY(-50%)", zIndex: 610,
                    justifyContent: "center" as const,
                    padding: "16px 9px",
                    background: "var(--ae-surface)",
                    border: `1px solid ${c.hairline}`,
                    [side === "left" ? "borderLeft" : "borderRight"]: "none",
                    borderRadius: side === "left" ? "0 14px 14px 0" : "14px 0 0 14px",
                    boxShadow: "var(--ae-shadow-card-elev)",
                  }),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              color: c.ink,
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
          >
            {/* The icon gets a tinted tile so there is an obvious "press me"
                at the top of the rail rather than a bare glyph. */}
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                color: accent,
              }}
            >
              {icon}
            </span>
            <span
              style={{
                writingMode: "vertical-rl",
                transform: side === "left" ? "rotate(180deg)" : "none",
                fontFamily: ff.mono,
                fontSize: 10.5,
                fontWeight: 650,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: c.body,
              }}
            >
              {title}
            </span>
            {badge != null && (
              <span
                style={{
                  // This badge is the ONLY on-screen signal that recovery plans
                  // have arrived — the panel deliberately does not open itself.
                  // At 10px in an 18px pill on a rail at the screen edge, the
                  // console's most consequential state change was also its
                  // smallest mark. 11px in a 20px pill, on the 11px floor.
                  fontFamily: ff.mono, fontSize: 11, fontWeight: 700, lineHeight: 1,
                  minWidth: 20, height: 20, padding: "0 6px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: accent, color: "#fff",
                }}
              >
                {badge}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
