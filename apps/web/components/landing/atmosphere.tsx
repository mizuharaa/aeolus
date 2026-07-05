"use client"
/**
 * LandingAtmosphere — soft peach/rose blooms fixed behind the whole landing.
 * They drift and breathe as the page scrolls (GSAP scrub) so the warm beige
 * floor never reads flat. Restrained: heavy blur, multiply blend, low opacity.
 * Under reduced motion they sit still.
 */

import { useLayoutEffect, useRef } from "react"
import { gsap } from "@/components/landing/gsap"

type Blob = { bg: string; size: number; left: string; top: string; drift: [number, number]; scale: number }

const BLOBS: Blob[] = [
  { bg: "var(--peach)", size: 620, left: "-8%", top: "4%", drift: [120, -60], scale: 1.15 },
  { bg: "var(--rose)", size: 520, left: "68%", top: "18%", drift: [-140, 90], scale: 1.2 },
  { bg: "var(--peach)", size: 560, left: "52%", top: "62%", drift: [90, -120], scale: 1.1 },
  { bg: "var(--rose)", size: 440, left: "4%", top: "74%", drift: [70, 60], scale: 1.18 },
]

export function LandingAtmosphere() {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      const blobs = gsap.utils.toArray<HTMLElement>(".lp-blob")
      blobs.forEach((b, i) => {
        const [dx, dy] = BLOBS[i]?.drift ?? [80, -60]
        gsap.to(b, {
          xPercent: dx / 6,
          yPercent: dy / 6,
          scale: BLOBS[i]?.scale ?? 1.1,
          ease: "none",
          scrollTrigger: {
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.2,
          },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div className="lp-atmos" ref={ref} aria-hidden>
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="lp-blob"
          style={{ background: b.bg, width: b.size, height: b.size, left: b.left, top: b.top }}
        />
      ))}
    </div>
  )
}
