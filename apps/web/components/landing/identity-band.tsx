"use client"
/**
 * IdentityBand — the AEOLUS wordmark, painted twice so the descending aircraft
 * flies THROUGH the letters instead of past them.
 *
 * Two fixed layers straddle the aircraft's canvas in the same stacking context:
 *
 *   z-index 1   back copy: eyebrow, the full ribboned wordmark, baseline copy
 *   z-index 3   .ae-plane-layer (HeroPlane3D)
 *   z-index 4   front copy: the same wordmark, clipped to its lower part
 *
 * Where the front copy paints, the airframe is behind the letters; where it is
 * clipped away, the airframe draws over the back copy. So a descent that starts
 * above the band and ends below it crosses in front of the letter tops and then
 * slips behind their lower halves — one continuous pass through the type.
 *
 * Both layers are `position: fixed` with identical geometry, so they are
 * aligned by construction rather than by measurement. That matters: the band
 * lives inside a pinned section, and anything measured against the pinned
 * element would drift the moment ScrollTrigger swapped it to fixed.
 *
 * Everything here is a pure function of `landingScroll.scenes.flight`, so
 * scrolling back up replays the reveal exactly.
 */

import { useEffect, useRef } from "react"
import { ArrowDown } from "lucide-react"
import { MaskedWordmark } from "@/components/landing/masked-wordmark"
import { landingScroll, registerLandingFrame } from "@/lib/scroll"

/** Reveal window, in flight-scene progress. Opens once the aircraft has pulled
 * back to its cruise pose and is fully in before the descent starts (0.62). */
const REVEAL_START = 0.34
const REVEAL_END = 0.6

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp01((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

function Band({ front }: { front?: boolean }) {
  return (
    <div className="ae-wm-band">
      <MaskedWordmark
        text="AEOLUS"
        instanceKey={front ? "band-front" : "band-back"}
        // The faint out-of-letter ribbon pass would otherwise print over the
        // aircraft in the front copy, where only the letterforms should occlude.
        outsideOpacity={front ? 0 : 0.13}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  )
}

export function IdentityBand() {
  const backRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const back = backRef.current
    const front = frontRef.current
    if (!back || !front) return

    const apply = () => {
      const progress = landingScroll.reducedMotion
        ? 1
        : landingScroll.scenes.flight
      const reveal = landingScroll.reducedMotion
        ? 1
        : smoothstep(REVEAL_START, REVEAL_END, progress)
      // Held until the aircraft is clear of the bottom of the frame, then the
      // whole band leaves with the pin rather than lingering under the globe.
      const exit = smoothstep(0.96, 1, progress)
      const shown = reveal * (1 - exit)

      back.style.setProperty("--ae-wm-reveal", String(reveal))
      back.style.opacity = String(shown)
      back.style.visibility = shown < 0.004 ? "hidden" : "visible"
      front.style.setProperty("--ae-wm-reveal", String(reveal))
      front.style.opacity = String(shown)
      front.style.visibility = shown < 0.004 ? "hidden" : "visible"
    }

    apply()
    return registerLandingFrame(apply)
  }, [])

  return (
    <>
      <div ref={backRef} className="ae-wm-layer ae-wm-layer--back">
        <div className="ae-wm-eyebrow">
          <span className="lp-eyebrow" style={{ color: "var(--ink)" }}>
            Aeolus
          </span>
          <span className="lp-eyebrow">
            Airline disruption &amp; recovery simulator
          </span>
        </div>

        <Band />

        <div className="ae-wm-baseline">
          <p>
            Trigger a hub closure. Watch the delay cascade spread.{" "}
            <span className="ed-serif" style={{ color: "var(--accent-blue)" }}>
              Recover the network.
            </span>
          </p>
          <span className="lp-eyebrow ae-wm-cue">
            Continue
            <ArrowDown
              aria-hidden
              style={{ width: 14, height: 14 }}
              strokeWidth={2.25}
            />
          </span>
        </div>
      </div>

      {/* The occluding copy. Decorative duplicate — the back layer already
          carries the readable wordmark for assistive tech. */}
      <div
        ref={frontRef}
        className="ae-wm-layer ae-wm-layer--front"
        aria-hidden="true"
      >
        <Band front />
      </div>
    </>
  )
}
