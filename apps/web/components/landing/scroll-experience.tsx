"use client"
/**
 * LandingScrollExperience — the whole landing page as one staged scroll.
 *
 *   dawn   OpeningWordmarkStage + HeroStatementStage   warm beige
 *   noon   CinematicSimulatorDemo + MethodologySection bright, hard contrast
 *   night  FinalCTAStage + footer                      deep ink
 *
 * The stage registers are sets of the .lp custom properties; GSAP
 * scrub-tweens them on the wrapper as each section approaches, so type,
 * rules, buttons, ribbons and the nav re-ink themselves in sync. Under
 * prefers-reduced-motion the page stays on the dawn register end to end.
 */

import { useLayoutEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { gsap } from "@/components/landing/gsap"
import styles from "@/components/landing/landing-experience.module.css"
import { LandingNav } from "@/components/landing/landing-nav"
import { LandingAtmosphere } from "@/components/landing/atmosphere"
import { FlightIntroStage } from "@/components/landing/flight-intro-stage"
import { LiveGlobeStage } from "@/components/landing/live-globe-stage"
import { StoryMarquee } from "@/components/landing/marquee"
import { CinematicSimulatorDemo } from "@/components/landing/demo/cinematic-simulator-demo"
import { FourPlansSection } from "@/components/landing/four-plans"
import { MethodologySection } from "@/components/landing/methodology-section"
import { PricingSection } from "@/components/landing/pricing"
import { TrustedBy } from "@/components/landing/trusted-by"
import { FinalCTAStage } from "@/components/landing/final-cta-stage"
import { LandingFooter } from "@/components/landing/footer"
import { Rise } from "@/components/landing/motion"
import { mountLandingScroll } from "@/lib/scroll"

// 3D layers only on the client
const CabinOpening = dynamic(
  () => import("@/components/landing/cabin-opening").then((m) => m.CabinOpening),
  { ssr: false },
)
const HeroPlane3D = dynamic(
  () => import("@/components/landing/hero-plane-3d").then((m) => m.HeroPlane3D),
  { ssr: false },
)

// Registers follow the `.lp` scope: cool paper, neutral ink. No beige.
const NOON = {
  "--bg": "#FFFFFF",
  "--ink": "#0E0E12",
  "--muted": "#56565F",
  "--panel": "#FAFAF8",
  "--border": "rgba(14, 14, 18, 0.18)",
  navBg: "rgba(255, 255, 255, 0.94)",
}
const NIGHT = {
  "--bg": "#111116",
  "--ink": "#F4F4F2",
  "--muted": "#9A9AA4",
  "--panel": "#1A1A21",
  "--border": "rgba(244, 244, 242, 0.16)",
  navBg: "rgba(17, 17, 22, 0.92)",
}

export function LandingScrollExperience() {
  const wrapRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => mountLandingScroll(), [])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      // The fixed nav gets the vars written directly onto it as well:
      // Chromium fails to repaint a fixed + backdrop-filter layer when an
      // INHERITED custom property changes, so inheriting from the wrapper
      // leaves the nav frozen on the previous register. Inline writes on
      // the nav itself always invalidate its paint.
      const nav = wrap.querySelector("nav")
      const navFill = wrap.querySelector(".lp-nav-fill")
      const shift = (
        trigger: string,
        theme: Record<string, string>,
        start = "top 78%",
        end = "top 22%",
      ) => {
        const { navBg, ...vars } = theme
        // Vars are written inline on the nav too (not only inherited from
        // the wrapper) and the bar fill is tweened as a real backgroundColor
        // on a CHILD of the fixed nav — both are workarounds for Chromium
        // refusing to repaint a fixed element's own background when an
        // inherited custom property changes.
        const targets = nav ? [wrap, nav] : [wrap]
        gsap.to(targets, {
          ...vars,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger, start, end, scrub: true },
        })
        if (navFill)
          gsap.to(navFill, {
            backgroundColor: navBg,
            ease: "none",
            immediateRender: false,
            scrollTrigger: { trigger, start, end, scrub: true },
          })
      }

      // The demo console is light now, so the page stays on the beige
      // family until the night CTA: dawn → noon (demo + methodology) → night.
      shift("#demo", NOON)
      shift("#cta", NIGHT)

      // The peach/rose atmosphere blobs are multiply-blended: over beige they
      // read as warm washes, but multiplied over the night register's near-
      // black they turn into muddy smudges that no longer blend. Fade the
      // whole atmosphere out across the same scroll range the night register
      // fades in, so the two motions read as one crossfade.
      const atmos = wrap.querySelector(".lp-atmos")
      if (atmos)
        gsap.to(atmos, {
          opacity: 0,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger: "#cta", start: "top 78%", end: "top 22%", scrub: true },
        })
    }, wrap)

    return () => ctx.revert()
  }, [])

  return (
    // `ae-landing-experience` is the scope root for the module's compound
    // rules (`.experience.ae-landing-experience …`). It has to sit on the same
    // element as `styles.experience` AND wrap every landing section — the nav,
    // the marquee and the CTA buttons all live outside the per-scene wrappers
    // below, so scoping it to one of those left 38 rules matching nothing.
    <main
      ref={wrapRef}
      className={`lp ${styles.experience} ae-landing-experience`}
      style={{ position: "relative" }}
    >
      <LandingAtmosphere />
      <LandingNav />
      {/* Two rules govern this block and they pull against each other:

          1. The wrapper around FlightIntroStage must NOT set z-index (or any
             other stacking-context trigger). The AEOLUS band inside it puts one
             fixed layer UNDER the aircraft's canvas (z 1 vs 3) and one OVER it
             (z 4) so the descent passes through the letters; a stacking context
             here would trap all three together and shove the band behind.
          2. The wrapper must nonetheless EXIST. ScrollTrigger pins #flight-intro
             by wrapping it in a pin-spacer, and HeroPlane3D / CabinOpening are
             `next/dynamic ssr:false`, so they mount afterwards and React tries
             to insert them before their next sibling. With the section as a bare
             sibling that sibling is now the pin-spacer React never rendered, and
             the insert throws NotFoundError, killing the whole page. */}
      <div className={styles.experience}>
        <HeroPlane3D />
        <CabinOpening />
        <div>
          <FlightIntroStage />
        </div>
      </div>
      {/* content sits above the fixed atmosphere and flight layers */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.experience}>
          <LiveGlobeStage />
        </div>
        <StoryMarquee />
        <div className={styles.experience}>
          <CinematicSimulatorDemo />
        </div>
        <Rise><FourPlansSection /></Rise>
        <MethodologySection />
        <Rise><PricingSection /></Rise>
        <Rise><TrustedBy /></Rise>
        <FinalCTAStage />
        <LandingFooter />
      </div>
    </main>
  )
}
