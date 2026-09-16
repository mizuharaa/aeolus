"use client"
/**
 * LandingAtmosphere — flat color waves behind the whole landing.
 *
 * No blur, no radial glow: crisp layered sine bands in the brand pigments
 * (plum / lavender / gold) printed on the paper at low opacity, like inked
 * contrail lines on a chart. GSAP gives the two clusters a light scroll
 * parallax and nothing else; under reduced motion they sit still. (The endless
 * horizontal drift that used to ride on top of that is gone — see the note in
 * the effect.)
 */

import { useLayoutEffect, useRef } from "react"
import { gsap } from "@/components/landing/gsap"

const W = 1440

/** A wavy band: sine top edge, offset bottom edge, spanning 2×W so a −W
 * offset still covers the frame. */
function wavePath(midY: number, amp: number, thick: number, periods: number, phase: number) {
  const segs = 96
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

type Band = { color: string; opacity: number; midY: number; amp: number; thick: number; periods: number; phase: number; reverse?: boolean }

// One cluster high on the page, one low — each three thin printed bands.
// The amber bands were the beige. Accents are semantic in this system, so a
// decorative wash is the wrong place for them: the warm band is now a neutral
// ink tint and the cool bands are pulled back, so the waves read as printed
// paper texture instead of a coloured glow.
const INK_WASH = "var(--ink)"
const TOP: Band[] = [
  { color: "var(--accent-purple)", opacity: 0.09, midY: 60,  amp: 26, thick: 10, periods: 2, phase: 0.4 },
  { color: "var(--accent-blue)",   opacity: 0.07, midY: 100, amp: 34, thick: 14, periods: 1.5, phase: 2.2, reverse: true },
  { color: INK_WASH,               opacity: 0.05, midY: 140, amp: 22, thick: 8,  periods: 2.5, phase: 4.0 },
]
const BOTTOM: Band[] = [
  { color: INK_WASH,               opacity: 0.05, midY: 50,  amp: 30, thick: 12, periods: 1.5, phase: 1.1, reverse: true },
  { color: "var(--accent-purple)", opacity: 0.08, midY: 100, amp: 24, thick: 9,  periods: 2, phase: 3.3 },
  { color: "var(--accent-blue)",   opacity: 0.06, midY: 145, amp: 36, thick: 16, periods: 1, phase: 5.1 },
]

function WaveCluster({ bands, style }: { bands: Band[]; style: React.CSSProperties }) {
  return (
    <svg
      className="lp-wave"
      viewBox={`0 0 ${W} 200`}
      preserveAspectRatio="none"
      style={{ ...style }}
      aria-hidden
    >
      {bands.map((b, i) => (
        <path
          key={i}
          data-wave
          d={wavePath(b.midY, b.amp, b.thick, b.periods, b.phase)}
          fill={b.color}
          opacity={b.opacity}
          /* The offset the endless tween used to start a reversed band at.
             Static now, so the composition is the one that was approved. */
          transform={b.reverse ? `translate(${-W} 0)` : undefined}
        />
      ))}
    </svg>
  )
}

export function LandingAtmosphere() {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      // ── NO ENDLESS WAVEFORM TRAVEL ────────────────────────────────────────
      // Six paths used to translate on their own 38–66s loops here, forever.
      // The paths sit INSIDE two `position: fixed; inset: 0` SVGs, so moving
      // them repaints the whole layer rather than moving a composited one, and
      // the layer is the viewport — on a 2560x1440 screen at dpr 2 that is a
      // 14.7M-pixel repaint on every frame, for the entire life of the page, in
      // every section. Measured at that size: hiding `.lp-atmos` alone took the
      // parked frame time from 33ms to 17ms and doubled the frames delivered.
      //
      // The waves are printed ink on paper in this system, not weather. They
      // keep the scroll parallax below, which only costs anything on frames the
      // page was repainting anyway.
      //
      // light parallax: the clusters drift apart as the page scrolls
      const [top, bottom] = gsap.utils.toArray<SVGSVGElement>(".lp-wave")
      if (top && bottom) {
        gsap.to(top, {
          yPercent: -30,
          ease: "none",
          scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 1.2 },
        })
        gsap.to(bottom, {
          yPercent: 24,
          ease: "none",
          scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 1.2 },
        })
      }
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div className="lp-atmos" ref={ref} aria-hidden>
      <WaveCluster bands={TOP} style={{ top: "6%", height: "22vh" }} />
      <WaveCluster bands={BOTTOM} style={{ bottom: "4%", height: "26vh" }} />
    </div>
  )
}
