"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowRight } from "lucide-react"
import { c, ff } from "@/lib/design-tokens"
import { ButtonPrimary, Container, Eyebrow } from "@/components/ds/primitives"

// three.js is ~120 kB gzipped — split it out of the first-load bundle and
// hold the composition with a flat ink slab while it streams in.
const HeroCascade = dynamic(
  () => import("@/components/landing/hero-cascade").then((m) => m.HeroCascade),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "absolute",
          inset: "12% 6% 14% 6%",
          background: "#141917",
          borderRadius: 18,
          transform: "perspective(900px) rotateX(24deg) rotateZ(-4deg)",
          opacity: 0.9,
        }}
        aria-hidden
      />
    ),
  },
)

/**
 * Landing hero — assembly intro + scrubbed exit.
 *
 * INTRO (podium.global-inspired): the composition is built from scattered
 * product fragments — the render, the plan card, the cascade readout, two
 * data tags, the headline lines — that spring in from offset positions and
 * scaffold toward their final placement. One-time, on mount, ~1.2 s.
 * Recovery = reassembly; the intro literalizes the product.
 *
 * EXIT: as the user scrolls away, copy pans out left and the visual pans
 * out right, scrubbed to scroll position — reverse-scrolling flies it all
 * back in. No observers; pure functions of scroll.
 */

// Assembly spring — fragments converge with weight, not fade.
const spring = { type: "spring" as const, stiffness: 64, damping: 15, mass: 0.9 }

const assemble = (dx: number, dy: number, rot: number, delay: number) => ({
  initial: { opacity: 0, x: dx, y: dy, rotate: rot, scale: 0.92 },
  animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
  transition: { ...spring, delay },
})

export function HeroSection() {
  const reduce = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)

  // Scrubbed exit parallax — reverses on scroll back.
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })
  const copyX = useTransform(scrollYProgress, [0, 1], [0, -110])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.15])
  const visualX = useTransform(scrollYProgress, [0, 1], [0, 130])
  const visualY = useTransform(scrollYProgress, [0, 1], [0, 60])
  const visualOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.2])

  const still = reduce
    ? { initial: undefined, animate: undefined, transition: undefined }
    : null

  return (
    <section
      ref={heroRef}
      style={{ paddingTop: 84, paddingBottom: 96, position: "relative", overflow: "hidden" }}
    >
      <Container maxWidth={1200}>
        <div
          className="hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.02fr) minmax(0, 1fr)",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* ── Copy — lines pan in from alternating sides ── */}
          <motion.div style={reduce ? undefined : { x: copyX, opacity: copyOpacity }}>
            <motion.div {...(still ?? assemble(-70, 0, 0, 0.05))}>
              <Eyebrow>Nimbus Air · 40 aircraft · 200 daily flights</Eyebrow>
            </motion.div>

            <h1
              style={{
                fontFamily: ff.display,
                fontWeight: 600,
                fontSize: "clamp(40px, 4.6vw, 60px)",
                lineHeight: 1.04,
                letterSpacing: "-0.022em",
                color: c.ink,
                margin: "20px 0 22px",
                maxWidth: 560,
              }}
            >
              <motion.span style={{ display: "block" }} {...(still ?? assemble(-90, 0, 0, 0.12))}>
                From ground stop
              </motion.span>
              <motion.span style={{ display: "block" }} {...(still ?? assemble(90, 0, 0, 0.2))}>
                to recovery plan
              </motion.span>
              <motion.span style={{ display: "block" }} {...(still ?? assemble(-90, 0, 0, 0.28))}>
                in <span style={{ color: "var(--ae-teal)", whiteSpace: "nowrap" }}>10&nbsp;ms</span>.
              </motion.span>
            </h1>

            <motion.p
              {...(still ?? assemble(0, 36, 0, 0.38))}
              style={{
                fontFamily: ff.body,
                fontSize: 17,
                fontWeight: 400,
                lineHeight: 1.6,
                color: c.body,
                maxWidth: 500,
                marginBottom: 32,
              }}
            >
              Aeolus injects 21 kinds of disruption into a synthetic US airline,
              propagates the cascade through every aircraft rotation, and solves
              recovery as a CP-SAT program — four costed plans, each checked
              against FAR 117 crew limits.
            </motion.p>

            <motion.div
              {...(still ?? assemble(0, 30, 0, 0.46))}
              style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}
            >
              <Link href="/simulator" style={{ textDecoration: "none" }}>
                <ButtonPrimary trailingIcon={<ArrowRight style={{ width: 15, height: 15 }} />}>
                  Open the simulator
                </ButtonPrimary>
              </Link>
              <Link
                href="/docs"
                style={{
                  fontFamily: ff.body,
                  fontSize: 14,
                  fontWeight: 500,
                  color: c.ink,
                  textDecoration: "none",
                  borderBottom: `1px solid ${c.borderStrong}`,
                  paddingBottom: 2,
                }}
              >
                Read the methodology
              </Link>
            </motion.div>
          </motion.div>

          {/* ── Rendered asset + fragments that scaffold into place ── */}
          <motion.div
            style={{
              position: "relative",
              height: "min(560px, 58vw)",
              minHeight: 420,
              ...(reduce ? {} : { x: visualX, y: visualY, opacity: visualOpacity }),
            }}
          >
            {/* The render itself rises last — the fragments assemble "onto" it */}
            <motion.div
              {...(still ?? {
                initial: { opacity: 0, scale: 0.9, y: 44 },
                animate: { opacity: 1, scale: 1, y: 0 },
                transition: { ...spring, delay: 0.1 },
              })}
              style={{ position: "absolute", inset: 0 }}
            >
              <HeroCascade style={{ position: "absolute", inset: 0 }} />
            </motion.div>

            {/* Fragment: cascade readout — flies in from upper right */}
            <motion.div
              {...(still ?? assemble(150, -110, 8, 0.55))}
              style={{
                position: "absolute",
                top: 6,
                right: 0,
                background: c.canvas,
                border: `1px solid ${c.hairline}`,
                borderRadius: 10,
                boxShadow: "var(--ae-shadow-card-elev)",
                padding: "10px 14px",
                fontFamily: ff.body,
                minWidth: 208,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ae-amber)", flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 550, color: c.ink }}>ORD — weather closure</span>
              </div>
              <div style={{ fontSize: 11.5, color: c.muted, marginTop: 5, fontFamily: ff.mono }}>
                23 affected · 6 direct · 17 cascade
              </div>
            </motion.div>

            {/* Fragment: solver tag — from the left */}
            <motion.div
              {...(still ?? assemble(-140, 60, -10, 0.68))}
              style={{
                position: "absolute",
                top: "34%",
                left: -10,
                background: "#141917",
                border: "1px solid rgba(245,245,240,0.1)",
                borderRadius: 8,
                padding: "7px 12px",
                fontFamily: ff.mono,
                fontSize: 11,
                color: "#ECEEE9",
                boxShadow: "var(--ae-shadow-card-elev)",
              }}
            >
              <span style={{ color: "#45B3A5" }}>CP-SAT</span> · optimal · 8 ms
            </motion.div>

            {/* Fragment: residual tag — from below right */}
            <motion.div
              {...(still ?? assemble(110, 120, 12, 0.8))}
              style={{
                position: "absolute",
                top: "58%",
                right: -8,
                background: c.canvas,
                border: `1px solid ${c.hairline}`,
                borderRadius: 8,
                padding: "6px 11px",
                fontFamily: ff.mono,
                fontSize: 11,
                color: "var(--ae-amber-ink)",
                boxShadow: "var(--ae-shadow-card)",
              }}
            >
              ORD → LAX +181 min
            </motion.div>

            {/* Fragment: recovery plan card — the last piece locks in */}
            <motion.div
              {...(still ?? assemble(-170, 150, -9, 0.92))}
              style={{
                position: "absolute",
                bottom: -6,
                left: -4,
                width: 224,
                background: c.canvas,
                border: `1px solid ${c.hairline}`,
                borderRadius: 12,
                boxShadow: "var(--ae-shadow-overlay)",
                overflow: "hidden",
                fontFamily: ff.body,
              }}
            >
              <div
                style={{
                  padding: "10px 14px 9px",
                  borderBottom: `1px solid ${c.hairline}`,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 550, color: c.ink }}>Plan A · Minimize cost</span>
                <span style={{ fontSize: 11, fontFamily: ff.mono, color: c.tealInk }}>8 ms</span>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  ["Total cost", "$1.24M"],
                  ["Cancellations", "3"],
                  ["Delays", "11"],
                  ["FAR 117 flags", "0"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span style={{ color: c.muted }}>{k}</span>
                    <span style={{ fontFamily: ff.mono, fontWeight: 500, color: c.ink, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                  </div>
                ))}
                <div
                  style={{
                    marginTop: 3,
                    height: 30,
                    borderRadius: 7,
                    background: "var(--ae-teal)",
                    color: "#0F1412",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 550,
                  }}
                >
                  Apply plan
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
