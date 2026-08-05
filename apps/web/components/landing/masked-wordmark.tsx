"use client"
/**
 * MaskedWordmark — the Hanoi-mask typography treatment.
 *
 * Huge ink letterforms with three ribbon bands (cobalt / violet / amber)
 * slithering horizontally through them. The ribbons render twice from one
 * geometry: a faint pass across the whole stage, and a vivid pass clipped
 * inside the letter outlines — so the color appears to travel *through*
 * the type. Static (but still striped) under prefers-reduced-motion.
 *
 * The text is stretched wall-to-wall with textLength, which is the point:
 * editorial type set tight against the margins, not a centered slogan.
 *
 * Ribbon travel is a PURE FUNCTION of the shared landing clock, not a per-
 * instance GSAP loop. The flight scene stacks two copies of this wordmark —
 * one behind the aircraft, one in front — and any per-instance timeline would
 * let their ribbons drift apart and expose the seam between the two layers.
 * Sampling one clock makes drift impossible however many copies mount.
 */

import { useEffect, useRef, type CSSProperties } from "react"
import { landingScroll, registerLandingFrame } from "@/lib/scroll"

/**
 * The clipPath needs an id unique per mounted copy. `useId()` cannot supply it:
 * it numbers nodes by tree position, and this component renders inside a
 * subtree whose server and client markup already differ, so the two sides
 * produced different ids and hydration tore the whole page down. Hashing an
 * explicit caller-supplied key is deterministic on both sides.
 */
function stableSvgId(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `ae-mask-${(hash >>> 0).toString(36)}`
}

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

/** Per-ribbon vertical swell — makes the bands truly undulate (waveform)
 * instead of only sliding sideways. Tuned per index, deterministic. */
const SWELL = [
  { y: 16, dur: 5.2 },
  { y: -20, dur: 6.8 },
  { y: 12, dur: 4.4 },
]

export function MaskedWordmark({
  text = "AEOLUS",
  className,
  instanceKey,
  style,
  outsideOpacity = 0.13,
  ribbons = DEFAULT_RIBBONS,
}: {
  text?: string
  className?: string
  /** Required when two copies of the SAME text mount on one page, so their
   *  clip paths do not collide. */
  instanceKey?: string
  style?: CSSProperties
  outsideOpacity?: number
  ribbons?: Ribbon[]
}) {
  const id = stableSvgId(instanceKey ? `${text}:${instanceKey}` : text)
  const rootRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (landingScroll.reducedMotion) return

    // Both passes of ribbon i (faint + clipped) carry the same data-rb, so one
    // computed transform drives both — and the same value lands on every other
    // mounted copy of this wordmark on the same frame.
    const groups = ribbons.map((_, index) =>
      Array.from(root.querySelectorAll<SVGGElement>(`[data-rb="${index}"]`)),
    )

    return registerLandingFrame((time) => {
      ribbons.forEach((r, index) => {
        const travel = ((time / r.duration) % 1) * -W
        // Both directions must stay inside [−W, 0]: the band geometry spans
        // 2W from x=0, so any positive offset drags empty space into frame.
        const x = r.reverse ? -W - travel : travel
        const swell = SWELL[index % SWELL.length]
        // 1 − cos gives the old sine.inOut yoyo without a timeline to keep.
        const y = swell.y * (0.5 - 0.5 * Math.cos((time / swell.dur) * Math.PI))
        const transform = `translate(${x.toFixed(2)} ${y.toFixed(2)})`
        for (const group of groups[index]) group.setAttribute("transform", transform)
      })
    })
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
      preserveAspectRatio="none"
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
