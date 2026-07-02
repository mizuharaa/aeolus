/**
 * AeolusLogo — the Aeolus brand mark.
 *
 * A flat teal rounded-square tile carrying the origami-jet glyph in paper
 * white. Static by design: the mark is the one place the identity teal
 * appears at full strength on every screen, and it does not animate,
 * pulse, orbit, or glow. app/icon.svg mirrors this resting state.
 *
 * The wordmark text ("Aeolus") stays at each call site — this is the mark only.
 */

import type { CSSProperties } from "react"

const JET_MAIN = "M2 9.6 L22 2 L11 13 Z"
const JET_WING = "M11 13 L22 2 L14.5 22 Z"

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
        background: "#0D9488",
        border: "1px solid rgba(15,20,18,0.10)",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        <g transform="translate(16 16) scale(0.86) translate(-12 -12)">
          <path d={JET_MAIN} fill="#F5F5F0" />
          <path d={JET_WING} fill="#F5F5F0" opacity={0.62} />
        </g>
      </svg>
    </span>
  )
}
