/**
 * AeolusMark — the Aeolus brand mark.
 *
 * Aeolus is the keeper of the winds, so the mark is three wind strokes:
 * clean tapering lines that curl forward like streamlines over a wing.
 * Monochrome, drawn in currentColor (set `style={{ color }}` to re-ink),
 * no gradients, no badge tile, no gloss — it prints like type.
 *
 * `AeolusLogo` keeps the historical name/props so no call site churns;
 * legacy `ink` / `accent` / `radius` props are accepted for compatibility.
 */

import type { CSSProperties } from "react"

export function AeolusMark({
  size = 34,
  accent: _accent,
  ink: _ink,
  radius: _radius,
  className,
  style,
}: {
  size?: number
  accent?: string
  ink?: string
  radius?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={className}
      aria-label="Aeolus"
      role="img"
      style={{ display: "inline-flex", flexShrink: 0, width: size, height: size, ...style }}
    >
      <svg viewBox="0 0 40 40" width="100%" height="100%" style={{ display: "block" }}>
        <g
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3.2"
        >
          {/* three streamlines, each ending in a forward curl */}
          <path d="M6 13 H26 a4.5 4.5 0 1 0 -4.5 -4.5" />
          <path d="M6 20.5 H31 a4 4 0 1 1 -4 4" />
          <path d="M6 28 H21 a3.5 3.5 0 1 0 -3.5 3.5" opacity="0.55" />
        </g>
      </svg>
    </span>
  )
}

export function AeolusLogo({
  size = 34,
  radius: _radius, // kept for call-site compatibility
  className,
  style,
}: {
  size?: number
  radius?: number
  className?: string
  style?: CSSProperties
}) {
  return <AeolusMark size={size} className={className} style={style} />
}
