"use client"
/**
 * OpeningWordmarkStage — the first screen. Warm beige paper, the abstract
 * cyclone mark, and the AEOLUS wordmark set wall-to-wall with cobalt /
 * violet / amber ribbons slithering through the letterforms. Floating
 * geometry drifts around the type; scroll pulls the whole composition up
 * with a light parallax (scrubbed, no pinning).
 */

import { useLayoutEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowDown } from "lucide-react"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"
import { AeolusMark } from "@/components/ds/logo"
import { MaskedWordmark } from "@/components/landing/masked-wordmark"
import { EASE } from "@/components/landing/motion"

export function OpeningWordmarkStage() {
  const rootRef = useRef<HTMLElement>(null)
  const wmRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    const root = rootRef.current
    const wm = wmRef.current
    if (!root || !wm) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      gsap.to(wm, {
        yPercent: -14,
        scale: 0.97,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.5 },
      })

      // The stage sits under the CabinOpening/SplinePlane layers until the
      // fly-through is done, so its reveal is scroll-scrubbed (not played
      // blind on mount): the whole composition blends in while the plane
      // climbs, and the AEOLUS letters wipe in left → right.
      const vh = () => window.innerHeight
      // hold the stage on screen while the cabin fly-through + plane climb
      // play above it; it starts scrolling once the sequence resolves
      ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: () => "+=" + vh() * 1.7,
        pin: true,
      })
      gsap.fromTo(
        root,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          ease: "none",
          immediateRender: true,
          scrollTrigger: { start: () => vh() * 1.0, end: () => vh() * 1.35, scrub: 0.5 },
        },
      )
      gsap.fromTo(
        wm,
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)",
          ease: "none",
          immediateRender: true,
          scrollTrigger: { start: () => vh() * 1.05, end: () => vh() * 1.45, scrub: 0.5 },
        },
      )
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={rootRef}
      aria-label="Aeolus"
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "110px clamp(20px, 4vw, 56px) 48px",
        gap: "clamp(28px, 4.5vh, 56px)",
      }}
    >
      {/* the flying dart is now the 3D HeroPlane3D layer (see scroll-experience) */}

      {/* eyebrow row */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <AeolusMark size={30} style={{ color: "var(--ink)" }} />
          <span className="lp-eyebrow" style={{ color: "var(--ink)" }}>
            Aeolus
          </span>
        </span>
        <span className="lp-eyebrow">Airline disruption &amp; recovery simulator</span>
      </motion.div>

      {/* the wordmark */}
      <motion.div
        ref={wmRef}
        initial={reduce ? false : { opacity: 0, y: 56 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, ease: EASE, delay: 0.3 }}
        style={{ willChange: "transform" }}
      >
        <MaskedWordmark text="AEOLUS" />
      </motion.div>

      {/* baseline row */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
          borderTop: "1px solid var(--border)",
          paddingTop: 22,
        }}
      >
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            fontSize: "clamp(16px, 1.5vw, 19px)",
            lineHeight: 1.45,
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          Trigger a hub closure. Watch the delay cascade spread.{" "}
          <span className="ed-serif" style={{ color: "var(--accent-blue)" }}>
            Recover the network.
          </span>
        </p>
        <span
          className="lp-eyebrow"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink)" }}
        >
          Scroll
          <motion.span
            aria-hidden
            style={{ display: "inline-flex" }}
            animate={reduce ? undefined : { y: [0, 5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown style={{ width: 14, height: 14 }} strokeWidth={2.25} />
          </motion.span>
        </span>
      </motion.div>
    </section>
  )
}
