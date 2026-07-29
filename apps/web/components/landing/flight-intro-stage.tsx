"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"
import {
  landingScroll,
  resetLandingScene,
  setLandingSceneActive,
} from "@/lib/scroll"

/**
 * Scroll room for the cabin-to-airframe handoff. The actual imagery remains
 * in fixed WebGL layers so the camera can cross the cabin wall without a DOM
 * cut. Once the aircraft reaches its full three-quarter view, HeroPlane3D
 * owns the short, one-time Q-flight and hands focus to the restored Aeolus
 * identity stage before the network view begins.
 */
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
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "+=400%",
            scrub: 1.2,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
            onUpdate: (self) => {
              setLandingSceneActive(
                "cabin",
                self.isActive && self.progress < 0.54,
              )
              setLandingSceneActive(
                "airliner",
                self.isActive &&
                  self.progress > 0.18 &&
                  self.progress < 0.999,
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
      tabIndex={0}
    >
      <h1 className="ae-sr-only">Airline recovery starts inside the aircraft and reaches the whole network.</h1>
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
