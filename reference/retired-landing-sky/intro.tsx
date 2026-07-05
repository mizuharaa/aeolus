"use client"
/**
 * LogoIntro — the brand curtain. The first viewport is nothing but the
 * mark and the wordmark on deep sky; scrolling scrubs the whole stage
 * smaller and up while the hero slides in underneath. Built on a sticky
 * stage (no GSAP pinning) + one scrubbed timeline, so there is no
 * pin-spacer layout jank.
 */

import { useLayoutEffect, useRef } from "react"
import { ChevronDown } from "lucide-react"
import { AeolusLogo } from "@/components/ds/logo"
import { ff } from "@/lib/design-tokens"
import { gsap, SplitText } from "./gsap"

export function LogoIntro() {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const word = wordRef.current
    if (!root || !stage || !word) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let cancelled = false

    const ctx = gsap.context(() => {
      const enter = () => {
        if (cancelled) return
        // entrance — letters climb out of a mask, mark drops in
        const split = new SplitText(word, { type: "chars", mask: "chars" })
        gsap.from(split.chars, {
          yPercent: 120,
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.055,
          delay: 0.15,
        })
        gsap.from(markRef.current, {
          y: -28, opacity: 0, duration: 0.9, ease: "power3.out",
        })
        gsap.from(hintRef.current, { opacity: 0, duration: 0.8, delay: 1.1 })
      }
      if (document.fonts?.status === "loaded") enter()
      else document.fonts?.ready.then(enter).catch(enter)

      // exit — scrubbed by scroll: the curtain lifts
      gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
        },
      })
        .to(stage, { scale: 0.62, yPercent: -16, opacity: 0, ease: "power1.in" }, 0)
        .to(hintRef.current, { opacity: 0, duration: 0.1 }, 0)
    }, root)

    return () => { cancelled = true; ctx.revert() }
  }, [])

  return (
    <section ref={rootRef} style={{ height: "170vh", position: "relative" }} aria-label="Aeolus">
      <div
        className="sky-gradient--deep"
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={stageRef}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "clamp(20px, 3.5vh, 40px)",
            willChange: "transform, opacity",
          }}
        >
          <div ref={markRef}>
            <AeolusLogo size={128} radius={34} style={{ boxShadow: "0 24px 80px rgba(10, 48, 82, 0.35)" }} />
          </div>

          <div
            ref={wordRef}
            className="punch punch--white"
            style={{ fontSize: "clamp(64px, 13vw, 180px)", letterSpacing: "-0.035em" }}
          >
            Aeolus
          </div>

          <span
            style={{
              fontFamily: ff.body,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Airline disruption · simulated · solved
          </span>
        </div>

        {/* scroll hint */}
        <div
          ref={hintRef}
          style={{
            position: "absolute",
            bottom: 34,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            color: "rgba(255,255,255,0.9)",
            fontFamily: ff.body,
            fontSize: 11.5,
            fontWeight: 550,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Scroll
          <ChevronDown style={{ width: 16, height: 16 }} strokeWidth={2} />
        </div>
      </div>
    </section>
  )
}
