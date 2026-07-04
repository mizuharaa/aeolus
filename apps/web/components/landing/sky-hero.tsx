"use client"
/**
 * SkyHero — bright sky stage. Punched white headline over the spinning
 * world: the globe crests from the bottom of the viewport (reference:
 * big-sphere hero), planes ride the arcs, glass chips float around the
 * horizon. Scroll scrubs extra spin + parallax into the globe via a
 * mutable phase ref (no React re-renders on scroll).
 */

import dynamic from "next/dynamic"
import Link from "next/link"
import { useLayoutEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, CloudLightning, Route, Timer } from "lucide-react"
import { ff } from "@/lib/design-tokens"
import { gsap, ScrollTrigger } from "./gsap"
import { PunchReveal } from "./punch"

const GlobeCanvas = dynamic(() => import("./globe").then((m) => m.GlobeCanvas), {
  ssr: false,
})

const CHIPS = [
  {
    icon: <CloudLightning style={{ width: 14, height: 14, color: "#BE185D" }} strokeWidth={2} />,
    iconBg: "rgba(236, 72, 153, 0.16)",
    label: "KORD · ground stop",
    pos: { left: "10%", top: "56%" } as const,
    float: 9,
  },
  {
    icon: <Route style={{ width: 14, height: 14, color: "#0B7065" }} strokeWidth={2} />,
    iconBg: "rgba(13, 148, 136, 0.16)",
    label: "112 flights re-routed",
    pos: { right: "9%", top: "52%" } as const,
    float: 12,
  },
  {
    icon: <Timer style={{ width: 14, height: 14, color: "#0369A1" }} strokeWidth={2} />,
    iconBg: "rgba(56, 189, 248, 0.2)",
    label: "solved in 8.4 ms",
    pos: { left: "20%", top: "82%" } as const,
    float: 10,
  },
]

export function SkyHero() {
  const rootRef = useRef<HTMLElement>(null)
  const phaseRef = useRef(0)
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => { phaseRef.current = self.progress },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={rootRef}
      className="sky-gradient"
      style={{
        position: "relative",
        minHeight: "108vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* ── soft halo where the world crests ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          bottom: "-30vh",
          transform: "translateX(-50%)",
          width: "min(1400px, 150vw)",
          height: "80vh",
          background: "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 62%)",
          pointerEvents: "none",
        }}
      />

      {/* ── the world ── */}
      <GlobeCanvas
        mode="hero"
        phaseRef={phaseRef}
        style={{
          position: "absolute",
          left: "50%",
          bottom: "-62vh",
          transform: "translateX(-50%)",
          width: "min(1300px, 140vw)",
          height: "115vh",
          pointerEvents: "none",
        }}
      />

      {/* ── floating glass chips ── */}
      {CHIPS.map((chip) => (
        <motion.div
          key={chip.label}
          className="sky-chip"
          style={{ position: "absolute", zIndex: 3, ...chip.pos }}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.span
            style={{ display: "inline-flex", alignItems: "center", gap: 9 }}
            animate={reduce ? undefined : { y: [0, -chip.float, 0] }}
            transition={{ duration: 5.5 + chip.float * 0.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="sky-chip-icon" style={{ background: chip.iconBg }}>
              {chip.icon}
            </span>
            {chip.label}
          </motion.span>
        </motion.div>
      ))}

      {/* ── copy ── */}
      <div
        style={{
          position: "relative",
          zIndex: 4,
          textAlign: "center",
          padding: "0 24px",
          marginTop: "16vh",
          maxWidth: 1100,
        }}
      >
        <PunchReveal
          as="h1"
          onMount={false}
          stagger={0.12}
          className="punch punch--white"
          style={{ fontSize: "clamp(44px, 7.2vw, 108px)" }}
        >
          Put airline recovery
          <br />
          on autopilot
        </PunchReveal>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: ff.body,
            fontSize: "clamp(15px, 1.4vw, 18px)",
            lineHeight: 1.6,
            color: "rgba(255, 255, 255, 0.95)",
            maxWidth: 620,
            margin: "22px auto 0",
            textShadow: "0 1px 12px rgba(17, 68, 105, 0.25)",
          }}
        >
          Aeolus simulates real-world disruptions against a 200-flight airline,
          predicts the delay cascade, and returns four costed recovery plans —
          in milliseconds.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.68, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 30, flexWrap: "wrap" }}
        >
          <Link href="/simulator" style={{ textDecoration: "none" }}>
            <button
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "13px 26px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "#FFFFFF", color: "#0B2434",
                fontFamily: ff.body, fontSize: 14.5, fontWeight: 600,
                boxShadow: "0 10px 36px rgba(10, 48, 82, 0.28)",
              }}
            >
              Launch the simulator
              <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
          </Link>
          <a href="#loop" style={{ textDecoration: "none" }}>
            <button
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "13px 26px", borderRadius: 999, cursor: "pointer",
                background: "rgba(255,255,255,0.14)", color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.55)",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                fontFamily: ff.body, fontSize: 14.5, fontWeight: 550,
              }}
            >
              Watch the recovery loop
            </button>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
