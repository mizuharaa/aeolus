"use client"
/**
 * IdentityBand — the OLUS wordmark, painted twice so the descending aircraft
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
import { AviationSubstrate } from "@/components/landing/aviation-substrate"
import { landingScroll, registerLandingFrame } from "@/lib/scroll"

/** Reveal window, in flight-scene progress. Opens once the aircraft has pulled
 * back to its cruise pose and is fully in before the crossing starts (0.62). */
const REVEAL_START = 0.34
const REVEAL_END = 0.6

/**
 * The drag. Once the aircraft has crossed the letters and its Q curls into the
 * dive, the whole band is pulled DOWN behind it and accelerates out of frame.
 *
 * This is the "drag the website down" beat. Previously the aircraft left
 * through the bottom of the frame and the page simply sat there, so the exit
 * read as the plane leaving rather than as the plane taking the page with it.
 * Tying the band's exit to the same progress that drives the dive couples the
 * two: the type follows the aircraft out.
 *
 * The range starts at the tail of the Q (u≈0.45 of the path maps to ~0.79 of
 * the scene, since the path only runs from CLIMB_START 0.62), not at the
 * crossing — dragging during the cross would pull the letters out from under
 * the aircraft mid-pass.
 */
const DRAG_START = 0.78
const DRAG_END = 1
/** Viewport heights the band travels on its way out. */
const DRAG_DISTANCE = 46

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp01((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

function Band({ front }: { front?: boolean }) {
  return (
    <div className="ae-wm-band">
      <MaskedWordmark
        text="OLUS"
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

      // Eased on a cubic so the band starts slow and accelerates away, which is
      // what makes it read as being pulled rather than simply sliding.
      const dragT = landingScroll.reducedMotion
        ? 0
        : smoothstep(DRAG_START, DRAG_END, progress)
      const drag = dragT * dragT * DRAG_DISTANCE

      for (const layer of [back, front]) {
        layer.style.setProperty("--ae-wm-reveal", String(reveal))
        layer.style.opacity = String(shown)
        layer.style.visibility = shown < 0.004 ? "hidden" : "visible"
        layer.style.transform = drag > 0.01 ? `translate3d(0, ${drag.toFixed(2)}dvh, 0)` : ""
      }
    }

    apply()
    return registerLandingFrame(apply)
  }, [])

  return (
    <>
      <div ref={backRef} className="ae-wm-layer ae-wm-layer--back">
        {/* FIRST child of the back layer, deliberately. It inherits the band's
            reveal opacity and its drag transform for free, so the chart plate
            arrives with the wordmark and is pulled out of frame with it — one
            object, not a background the type happens to be sitting on. Painting
            order puts it under everything else here: it carries z-index 0 while
            the band, eyebrow and baseline are positioned with z-index auto and
            come later in the DOM. */}
        <AviationSubstrate />

        <div className="ae-wm-eyebrow">
          <span className="lp-eyebrow" style={{ color: "var(--ink)" }}>
            Olus
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
