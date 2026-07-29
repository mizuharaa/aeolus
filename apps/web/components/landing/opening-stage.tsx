"use client"
/**
 * OpeningWordmarkStage — the post-flight identity beat. Warm beige paper, the abstract
 * cyclone mark, and the AEOLUS wordmark set wall-to-wall with cobalt /
 * violet / amber ribbons slithering through the letterforms. Floating
 * geometry drifts around the type; scroll pulls the whole composition up
 * with a light parallax (scrubbed, no pinning).
 */

import { useLayoutEffect, useRef } from "react"
import { ArrowDown } from "lucide-react"
import { gsap } from "@/components/landing/gsap"
import { MaskedWordmark } from "@/components/landing/masked-wordmark"

export function OpeningWordmarkStage() {
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const wmRef = useRef<HTMLDivElement>(null)
  const eyebrowRef = useRef<HTMLDivElement>(null)
  const baselineRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const wm = wmRef.current
    const eyebrow = eyebrowRef.current
    const baseline = baselineRef.current
    if (!root || !stage || !wm || !eyebrow || !baseline) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      const entrance = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top 88%",
          end: "top 20%",
          scrub: 0.45,
          invalidateOnRefresh: true,
        },
      })

      entrance
        .fromTo(
          eyebrow,
          { yPercent: 80, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.28 },
          0,
        )
        .fromTo(
          wm,
          { clipPath: "inset(0 100% 0 0)", yPercent: 10 },
          { clipPath: "inset(0 0% 0 0)", yPercent: 0, duration: 0.72 },
          0.04,
        )
        .fromTo(
          baseline,
          { yPercent: 45, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.28 },
          0.5,
        )

      gsap.to(stage, {
        yPercent: -5,
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom top",
          scrub: 0.35,
        },
      })

    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section
      id="identity"
      ref={rootRef}
      className="ae-identity-stage"
      aria-label="Aeolus"
      tabIndex={0}
    >
      <div ref={stageRef} className="ae-identity-sticky">
      {/* the flying dart is now the 3D HeroPlane3D layer (see scroll-experience) */}

      {/* eyebrow row */}
      <div ref={eyebrowRef} className="ae-identity-eyebrow">
        <span className="lp-eyebrow" style={{ color: "var(--ink)" }}>
          Aeolus
        </span>
        <span className="lp-eyebrow">Airline disruption &amp; recovery simulator</span>
      </div>

      {/* the wordmark — full bleed: breaks out of the section padding and
          stretches wall-to-wall, ribbons running past the viewport edges */}
      <div ref={wmRef} className="ae-identity-wordmark">
        <MaskedWordmark
          text="AEOLUS"
          style={{ height: "clamp(170px, 24vw, 330px)", width: "100%" }}
        />
      </div>

      {/* baseline row */}
      <div ref={baselineRef} className="ae-identity-baseline">
        <p>
          Trigger a hub closure. Watch the delay cascade spread.{" "}
          <span className="ed-serif" style={{ color: "var(--accent-blue)" }}>
            Recover the network.
          </span>
        </p>
        <span className="lp-eyebrow ae-identity-cue">
          Continue
          <ArrowDown aria-hidden style={{ width: 14, height: 14 }} strokeWidth={2.25} />
        </span>
      </div>
      </div>
    </section>
  )
}
