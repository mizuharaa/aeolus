"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { c, ff, sp, r, type as typeStyle } from "@/lib/design-tokens"
import { ButtonPrimary, ButtonSecondary, Container, Eyebrow, Stat } from "@/components/ds/primitives"
import { HeroMap } from "@/components/landing/hero-map"

/**
 * Landing hero — original layout (copy left, AOC dashboard mockup right).
 *
 * Motion policy: one entrance transition on mount, then everything holds
 * still. No idle float loops, no pulsing status dots, no text glow — the
 * headline is flat, high-contrast type.
 */

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.22, 0.9, 0.28, 1] as const, delay },
})

export function HeroSection() {
  return (
    <section style={{ paddingTop: 96, paddingBottom: 64, position: "relative" }}>
      <Container>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 64,
            alignItems: "center",
          }}
          className="hero-grid"
        >
          {/* Copy */}
          <div>
            <motion.div {...enter(0)} style={{ display: "inline-block", marginBottom: sp.lg }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: r.pill,
                  background: c.surfaceSoft,
                  border: `1px solid ${c.hairline}`,
                }}
              >
                <Eyebrow>Nimbus Air · 40 aircraft · 200 daily flights</Eyebrow>
              </div>
            </motion.div>

            <motion.h1
              {...enter(0.08)}
              style={{
                fontFamily: ff.display,
                fontWeight: 700,
                fontSize: "clamp(44px, 6.2vw, 78px)",
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
                color: c.ink,
                marginBottom: sp.md,
              }}
            >
              <span style={{ display: "block" }}>When weather hits,</span>
              <span style={{ display: "block", color: c.amber }}>flights cascade.</span>
              <span style={{ display: "block", color: c.muted }}>Aeolus recovers.</span>
            </motion.h1>

            <motion.p
              {...enter(0.16)}
              style={{
                ...typeStyle("titleMd", c.body),
                fontSize: 17,
                fontWeight: 450,
                marginBottom: sp.lg,
                maxWidth: 540,
                lineHeight: 1.55,
              }}
            >
              Open-source Operations Control Center. Trigger real-world disruptions
              against a synthetic US airline network and receive four ranked recovery
              plans — with carbon accounting and counterfactual rationale — in milliseconds.
            </motion.p>

            <motion.div
              {...enter(0.24)}
              style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
            >
              <Link href="/simulator" style={{ textDecoration: "none" }}>
                <ButtonPrimary trailingIcon={<ArrowRight style={{ width: 16, height: 16 }} />}>
                  Launch simulator
                </ButtonPrimary>
              </Link>
              <Link href="/docs" style={{ textDecoration: "none" }}>
                <ButtonSecondary>Read methodology</ButtonSecondary>
              </Link>
            </motion.div>

            <motion.div
              {...enter(0.32)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                marginTop: sp.lg,
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "Annual cost", value: "$34B", hint: "US disruption losses" },
                { label: "Solve time", value: "<10ms", hint: "CP-SAT MILP" },
                { label: "Plans/event", value: "4", hint: "Cost · Pax · Future · Carbon" },
              ].map((stat, i) => (
                <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  {i > 0 && <span style={{ width: 1, height: 36, background: c.hairline }} />}
                  <Stat label={stat.label} value={stat.value} hint={stat.hint} />
                </div>
              ))}
            </motion.div>
          </div>

          {/* AOC dashboard mockup */}
          <motion.div {...enter(0.2)}>
            <HeroMap />
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
