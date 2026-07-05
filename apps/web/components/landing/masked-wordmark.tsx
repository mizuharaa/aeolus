"use client"
/**
 * MaskedWordmark — the Hanoi-mask typography treatment.
 *
 * Huge ink letterforms with three ribbon bands (cobalt / violet / amber)
 * slithering horizontally through them. The ribbons render twice from one
 * geometry: a faint pass across the whole stage, and a vivid pass clipped
 * inside the letter outlines — so the color appears to travel *through*
 * the type. GSAP loops the travel; both passes share tween targets so they
 * never drift. Static (but still striped) under prefers-reduced-motion.
 *
 * The text is stretched wall-to-wall with textLength, which is the point:
 * editorial type set tight against the margins, not a centered slogan.
 */

import { useId, useLayoutEffect, useRef, type CSSProperties } from "react"
import { gsap } from "@/components/landing/gsap"

const W = 1000 // viewBox width — ribbons loop with period W

/** A wavy band: sine top edge, offset bottom edge, spanning 2×W. */
function ribbonPath(midY: number, amp: number, thick: number, periods: number, phase: number) {
  const segs = 128
  const span = 2 * W
  const pts: string[] = []
  for (let i = 0; i <= segs; i++) {
    const x = (i / segs) * span
    const y = midY + Math.sin((x / W) * periods * Math.PI * 2 + phase) * amp
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  for (let i = segs; i >= 0; i--) {
    const x = (i / segs) * span
    const y = midY + Math.sin((x / W) * periods * Math.PI * 2 + phase) * amp + thick
    pts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join(" ") + " Z"
}

type Ribbon = {
  color: string
  midY: number
  amp: number
  thick: number
  periods: number
  phase: number
  duration: number
  reverse?: boolean
}

const DEFAULT_RIBBONS: Ribbon[] = [
  { color: "var(--accent-blue)",   midY: 70,  amp: 42, thick: 50, periods: 1, phase: 0.6, duration: 21 },
  { color: "var(--accent-purple)", midY: 128, amp: 54, thick: 36, periods: 2, phase: 2.7, duration: 27, reverse: true },
  { color: "var(--accent-amber)",  midY: 184, amp: 32, thick: 44, periods: 1, phase: 4.1, duration: 17 },
]

export function MaskedWordmark({
  text = "AEOLUS",
  className,
  style,
  outsideOpacity = 0.13,
  ribbons = DEFAULT_RIBBONS,
}: {
  text?: string
  className?: string
  style?: CSSProperties
  outsideOpacity?: number
  ribbons?: Ribbon[]
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "")
  const rootRef = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      ribbons.forEach((r, i) => {
        // one tween drives BOTH copies (faint + clipped) of ribbon i
        const nodes = root.querySelectorAll(`[data-rb="${i}"]`)
        gsap.fromTo(
          nodes,
          { x: r.reverse ? -W : 0 },
          { x: r.reverse ? 0 : -W, duration: r.duration, ease: "none", repeat: -1 },
        )
      })
    }, root)
    return () => ctx.revert()
  }, [ribbons])

  const textAttrs = {
    x: W / 2,
    y: 238,
    textAnchor: "middle" as const,
    textLength: W,
    lengthAdjust: "spacingAndGlyphs" as const,
    fontWeight: 800,
    fontSize: 244,
    letterSpacing: "-0.02em",
    style: { fontFamily: "var(--ae-font-display)" } as CSSProperties,
  }

  const bands = ribbons.map((r, i) => (
    <g key={i} data-rb={i}>
      <path d={ribbonPath(r.midY, r.amp, r.thick, r.periods, r.phase)} fill={r.color} />
    </g>
  ))

  return (
    <svg
      ref={rootRef}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible", ...style }}
      viewBox={`0 0 ${W} 250`}
      role="img"
      aria-label={text}
    >
      <defs>
        <clipPath id={`${id}c`}>
          <text {...textAttrs}>{text}</text>
        </clipPath>
      </defs>

      {/* faint pass — the ribbons keep traveling beyond the letters */}
      <g opacity={outsideOpacity}>{bands}</g>

      {/* the letterforms */}
      <text {...textAttrs} fill="var(--ink)">
        {text}
      </text>

      {/* vivid pass — clipped inside the letterforms */}
      <g clipPath={`url(#${id}c)`}>{bands}</g>
    </svg>
  )
}
