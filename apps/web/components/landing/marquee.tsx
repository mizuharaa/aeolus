"use client"
/**
 * StoryMarquee — thin editorial divider strip. The four beats of the
 * recovery loop repeat across the viewport, alternating solid ink and
 * outlined ghost type; scroll scrubs the strip sideways.
 */

import { useLayoutEffect, useRef } from "react"
import { gsap } from "@/components/landing/gsap"

const BEATS = ["Hub closure", "Delay cascade", "Four plans", "Recovery"]

export function StoryMarquee() {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const track = trackRef.current
    if (!root || !track) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        track,
        { xPercent: -3 },
        {
          xPercent: -26,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 0.7 },
        },
      )
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="lp-marquee"
      style={{ padding: "clamp(20px, 4vh, 44px) 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div ref={trackRef} className="lp-marquee-track">
        {Array.from({ length: 4 }).map((_, copy) =>
          BEATS.map((b, i) => (
            <span
              key={`${copy}-${i}`}
              className={`lp-marquee-word${(copy * BEATS.length + i) % 2 === 0 ? " lp-marquee-word--solid" : ""}`}
              style={{ fontSize: "clamp(34px, 4.6vw, 68px)", lineHeight: 1 }}
            >
              {b}
              <span style={{ margin: "0 0 0 56px", color: "var(--accent-amber)", WebkitTextStroke: 0 }}>·</span>
            </span>
          )),
        )}
      </div>
    </div>
  )
}
