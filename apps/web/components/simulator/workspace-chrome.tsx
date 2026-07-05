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
import { ChevronLeft, ChevronRight, PanelRightClose, X } from "lucide-react"
import { c, ff } from "@/lib/design-tokens"

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
        // left rail grows as pointer moves right; right rail + bottom grow as
        // pointer moves the opposite way
        const delta =
          side === "left" ? pos - startPos : side === "right" ? startPos - pos : startPos - pos
        setSize(Math.min(max, Math.max(min, startSize + delta)))
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

export function ResizeHandle({
  onPointerDown,
  side = "left",
}: {
  onPointerDown: (e: React.PointerEvent) => void
  side?: "left" | "right" | "bottom"
}) {
  const [hot, setHot] = useState(false)
  const horizontal = side === "bottom"
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      role="separator"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      title="Drag to resize"
      style={{
        position: "relative",
        flexShrink: 0,
        width: horizontal ? "100%" : 6,
        height: horizontal ? 6 : "100%",
        cursor: horizontal ? "row-resize" : "col-resize",
        background: hot ? "var(--ae-teal)" : "transparent",
        transition: "background 140ms ease",
        zIndex: 20,
        touchAction: "none",
      }}
    >
      {/* grip dots, centered */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          display: "flex",
          flexDirection: horizontal ? "row" : "column",
          gap: 3,
          opacity: hot ? 0 : 0.5,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 3, height: 3, borderRadius: 99, background: c.muted }} />
        ))}
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
        <div style={{ fontFamily: ff.display, fontWeight: 650, fontSize: 14.5, color: c.ink, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
          {title}
        </div>
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
