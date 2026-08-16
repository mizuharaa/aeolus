"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"
import { IdentityBand } from "@/components/landing/identity-band"
import {
  landingScroll,
  resetLandingScene,
  setLandingSceneActive,
} from "@/lib/scroll"

/**
 * Scroll room for the cabin → airframe → identity shot. The imagery lives in
 * fixed layers so the camera can cross the cabin wall without a DOM cut, and so
 * the AEOLUS wordmark can be stacked around the aircraft's canvas rather than
 * waiting in a section below it.
 *
 * The pin was 400% of the viewport and its last three viewports were bare
 * paper: the cabin faded out by 0.62vh and nothing replaced it but the
 * aircraft. It is 200% now, and the wordmark reveals inside it — so the same
 * beat carries the identity payload that used to sit in its own near-empty
 * section afterwards.
 */
/**
 * THE DWELL. The brief is "no matter how hard the user scrolls it stays in
 * place for a bit, then does the animation" — so the first slice of the pin has
 * to absorb scroll without advancing the scene.
 *
 * This is an EASE, not a delayed start, and that distinction is the whole
 * mechanism. ScrollTrigger's `scrub` interpolates toward the trigger's own
 * progress; anything that gates on a threshold instead ("only move once
 * progress > 0.18") snaps the moment it opens, and snaps harder the faster the
 * user flicks — which is exactly the input the brief says must not break it.
 * Remapping progress through a curve that is FLAT over its first stretch makes
 * the dwell survive any scroll velocity, because velocity never enters: at 40%
 * of the way through the hold the scene is at zero whether that took the user
 * two seconds or two frames.
 *
 * Leaving the hold is eased rather than stepped. A flat segment joined straight
 * to a linear ramp is C0-continuous but not C1 — the scene would go from
 * stationary to full rate in one frame and read as a jolt. The quadratic
 * run-in below matches value AND slope at the join, then normalises so the
 * curve still reaches exactly 1.
 */
const HOLD = 0.2   // fraction of the pin that absorbs scroll with no motion
const RUN_IN = 0.18 // fraction of the REMAINING travel spent easing out of it

function holdThenFly(p: number): number {
  if (p <= HOLD) return 0
  const u = (p - HOLD) / (1 - HOLD)
  const raw = u < RUN_IN ? (u * u) / (2 * RUN_IN) : u - RUN_IN / 2
  return raw / (1 - RUN_IN / 2)
}

export function FlightIntroStage() {
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const media = gsap.matchMedia()
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const tween = gsap.fromTo(
        landingScroll.scenes,
        { flight: 0 },
        {
          flight: 1,
          // The dwell lives here rather than in the rig, so everything driven
          // by `scenes.flight` — aircraft, cabin, wordmark — holds together.
          ease: holdThenFly,
          scrollTrigger: {
            trigger: root,
            start: "top top",
            // 380%, not 300%. The dwell spends the first 20% of the pin, so the
            // manoeuvre itself would have lost a fifth of its scroll length at
            // the old value — and the sensitivity that 300% was raised to fix
            // would have come straight back. 380% leaves the flying part ~304%,
            // i.e. slightly MORE room than before, with the hold on top.
            end: "+=380%",
            scrub: 1.2,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
            onUpdate: (self) => {
              // Thresholds are read in SCENE space, not raw pin space. They
              // describe where the cabin hands off to the airframe, which is a
              // fact about the choreography — mixing them with raw progress
              // would make the hold silently retime the handoff, and the cabin
              // would start dissolving during the beat that is meant to be
              // dead still.
              const t = holdThenFly(self.progress)
              setLandingSceneActive("cabin", self.isActive && t < 0.54)
              setLandingSceneActive(
                "airliner",
                self.isActive && t > 0.02 && t < 0.999,
              )
            },
            onToggle: (self) => {
              if (!self.isActive) {
                setLandingSceneActive("cabin", false)
                setLandingSceneActive("airliner", false)
              }
            },
            onLeave: () => {
              setLandingSceneActive("cabin", false)
              setLandingSceneActive("airliner", false)
            },
            onEnterBack: () => {
              setLandingSceneActive("cabin", true)
              setLandingSceneActive("airliner", true)
            },
          },
        },
      )

      return () => tween.kill()
    })

    media.add("(prefers-reduced-motion: reduce)", () => {
      const trigger = ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom top",
        invalidateOnRefresh: true,
        fastScrollEnd: true,
        onUpdate: (self) => {
          // Reduced motion gets the two END STATES and no interpolation, so the
          // dwell is irrelevant here — there is nothing to hold.
          landingScroll.scenes.flight = self.progress < 0.5 ? 0 : 1
        },
        onToggle: (self) => {
          setLandingSceneActive("cabin", false)
          setLandingSceneActive("airliner", false)
          if (!self.isActive && self.direction > 0) {
            landingScroll.scenes.flight = 1
          }
        },
      })
      return () => trigger.kill()
    })

    return () => {
      media.revert()
      resetLandingScene("flight")
      setLandingSceneActive("cabin", true)
      setLandingSceneActive("airliner", true)
    }
  }, [])

  return (
    <section
      id="flight-intro"
      ref={rootRef}
      className="ae-flight-intro"
      aria-label="From cabin to airframe"
    >
      <h1 className="ae-sr-only">Airline recovery starts inside the aircraft and reaches the whole network.</h1>
      <IdentityBand />
      <div className="ae-flight-cue" aria-hidden>
        <span>Cabin</span>
        <i />
        <span>Airframe</span>
        <i />
        <span>Network</span>
      </div>
    </section>
  )
}
