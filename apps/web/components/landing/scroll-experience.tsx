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

import { useEffect, useLayoutEffect, useRef } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { gsap } from "@/components/landing/gsap"
import styles from "@/components/landing/landing-experience.module.css"
import { LandingNav } from "@/components/landing/landing-nav"
import { LandingAtmosphere } from "@/components/landing/atmosphere"
import { FlightIntroStage } from "@/components/landing/flight-intro-stage"
import { OpeningWordmarkStage } from "@/components/landing/opening-stage"
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

const NOON = {
  "--bg": "#F7F3EA",
  "--ink": "#1C1426",
  "--muted": "#6A6250",
  "--panel": "#FFFEF9",
  "--border": "rgba(28, 20, 38, 0.20)",
  navBg: "rgba(247, 243, 234, 0.94)",
}
const NIGHT = {
  "--bg": "#191223",
  "--ink": "#F1ECE1",
  "--muted": "#9C93B0",
  "--panel": "#241B38",
  "--border": "rgba(241, 236, 225, 0.16)",
  navBg: "rgba(25, 18, 35, 0.92)",
}

export function LandingScrollExperience() {
  const wrapRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => mountLandingScroll(), [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const precise = window.matchMedia("(hover: hover) and (pointer: fine)")
    if (reduced.matches || !precise.matches) return

    const cards = Array.from(
      wrap.querySelectorAll<HTMLElement>(".fp-card, .pr-card, .dm-cap"),
    )
    const cleanups = cards.map((card) => {
      let frame = 0
      card.dataset.aeTilt = "true"

      const move = (event: PointerEvent) => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect()
          const x = (event.clientX - rect.left) / rect.width - 0.5
          const y = (event.clientY - rect.top) / rect.height - 0.5
          card.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-3px)`
        })
      }
      const leave = () => {
        cancelAnimationFrame(frame)
        card.style.transform = ""
      }

      card.addEventListener("pointermove", move)
      card.addEventListener("pointerleave", leave)
      return () => {
        cancelAnimationFrame(frame)
        card.removeEventListener("pointermove", move)
        card.removeEventListener("pointerleave", leave)
        delete card.dataset.aeTilt
        card.style.transform = ""
      }
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

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
          scrollTrigger: {
            trigger,
            start,
            end,
            scrub: 1.2,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
          },
        })
        if (navFill)
          gsap.to(navFill, {
            backgroundColor: navBg,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger,
              start,
              end,
              scrub: 1.2,
              invalidateOnRefresh: true,
              fastScrollEnd: true,
            },
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
          scrollTrigger: {
            trigger: "#cta",
            start: "top 78%",
            end: "top 22%",
            scrub: 1.2,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
          },
        })
    }, wrap)

    return () => ctx.revert()
  }, [])

  return (
    <>
      <style jsx global>{`
        html,
        body {
          overflow-x: clip;
        }
      `}</style>
      <main
        ref={wrapRef}
        className={`${styles.experience} ae-landing-experience lp`}
        style={{ position: "relative" }}
      >
        <Link href="/simulator" className="ae-skip-simulator">
          Skip motion — launch simulator
        </Link>
        <LandingAtmosphere />
        <HeroPlane3D />
        <CabinOpening />
        <LandingNav />
        {/* content sits above the fixed atmosphere/plane layers */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <FlightIntroStage />
          <OpeningWordmarkStage />
          <LiveGlobeStage />
          <StoryMarquee />
          <CinematicSimulatorDemo />
          <Rise><FourPlansSection /></Rise>
          <MethodologySection />
          <Rise><PricingSection /></Rise>
          <Rise><TrustedBy /></Rise>
          <FinalCTAStage />
          <LandingFooter />
        </div>
      </main>
    </>
  )
}
