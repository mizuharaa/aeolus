"use client"
/**
 * LandingAtmosphere — flat color waves behind the whole landing.
 *
 * No blur, no radial glow: crisp layered sine bands in the brand pigments
 * (plum / lavender / gold) printed on the paper at low opacity, like inked
 * contrail lines on a chart. GSAP drifts each band horizontally on an
 * endless loop (waveform travel) and adds a light scroll parallax.
 * Under reduced motion they sit still.
 */

import { useLayoutEffect, useRef } from "react"
import { gsap } from "@/components/landing/gsap"

const W = 1440

/** A wavy band: sine top edge, offset bottom edge, spanning 2×W so a −W
 * translate loops seamlessly. */
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

type Band = { color: string; opacity: number; midY: number; amp: number; thick: number; periods: number; phase: number; dur: number; reverse?: boolean }

// One cluster high on the page, one low — each three thin printed bands.
const TOP: Band[] = [
  { color: "var(--accent-purple)", opacity: 0.14, midY: 60,  amp: 26, thick: 10, periods: 2, phase: 0.4, dur: 46 },
  { color: "var(--accent-blue)",   opacity: 0.10, midY: 100, amp: 34, thick: 14, periods: 1.5, phase: 2.2, dur: 60, reverse: true },
  { color: "var(--accent-amber)",  opacity: 0.12, midY: 140, amp: 22, thick: 8,  periods: 2.5, phase: 4.0, dur: 38 },
]
const BOTTOM: Band[] = [
  { color: "var(--accent-amber)",  opacity: 0.12, midY: 50,  amp: 30, thick: 12, periods: 1.5, phase: 1.1, dur: 52, reverse: true },
  { color: "var(--accent-purple)", opacity: 0.12, midY: 100, amp: 24, thick: 9,  periods: 2, phase: 3.3, dur: 44 },
  { color: "var(--accent-blue)",   opacity: 0.09, midY: 145, amp: 36, thick: 16, periods: 1, phase: 5.1, dur: 66 },
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
        <path key={i} data-wave d={wavePath(b.midY, b.amp, b.thick, b.periods, b.phase)} fill={b.color} opacity={b.opacity} />
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
      const all = [...TOP, ...BOTTOM]
      gsap.utils.toArray<SVGPathElement>("[data-wave]").forEach((p, i) => {
        const b = all[i]
        if (!b) return
        // endless waveform travel — translate by one period and wrap
        gsap.fromTo(
          p,
          { x: b.reverse ? -W : 0 },
          { x: b.reverse ? 0 : -W, duration: b.dur, ease: "none", repeat: -1 },
        )
      })
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
