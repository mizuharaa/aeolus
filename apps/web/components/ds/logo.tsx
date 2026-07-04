/**
 * AeolusLogo — the Aeolus brand mark, daylight edition.
 *
 * A sky→teal gradient tile carrying a white globe with an orbiting jet:
 * the same motif as the landing hero (planes circling a spinning world).
 * Front of the orbit passes over the globe at full strength, the back
 * half recedes — one mark, a little depth, no glow, no animation.
 *
 * The wordmark text ("Aeolus") stays at each call site — this is the mark only.
 */

import type { CSSProperties } from "react"

export function AeolusLogo({
  size = 32,
  radius,
  className,
  style,
}: {
  size?: number
  radius?: number
  className?: string
  style?: CSSProperties
}) {
  const rad = radius ?? Math.round(size * 0.28)

  return (
    <span
      className={className}
      aria-label="Aeolus"
      role="img"
      style={{
        display: "inline-flex",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: rad,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        background: "linear-gradient(135deg, #38BDF8 0%, #0EA5C9 55%, #0D9488 100%)",
        border: "1px solid rgba(11,36,52,0.10)",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        {/* back half of the orbit — passes behind the globe */}
        <path
          d="M 28.06 10.63 A 13.2 5 -24 0 0 3.94 21.37"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.38"
        />
        {/* the globe */}
        <circle cx="16" cy="16" r="7.2" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        {/* one meridian + the equator hint */}
        <ellipse cx="16" cy="16" rx="3.1" ry="7.2" fill="none" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.55" />
        <line x1="9.2" y1="16" x2="22.8" y2="16" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.55" />
        {/* front half of the orbit — passes over the globe */}
        <path
          d="M 3.94 21.37 A 13.2 5 -24 0 0 28.06 10.63"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* the jet riding the orbit */}
        <g transform="translate(28.06 10.63) rotate(-46)">
          <path d="M 0 -3.1 L 2.5 3.1 L 0 1.7 L -2.5 3.1 Z" fill="#FFFFFF" />
        </g>
      </svg>
    </span>
  )
}
