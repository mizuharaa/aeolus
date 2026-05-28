"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { c, ff, sp, r, type as typeStyle } from "@/lib/design-tokens"
import { ButtonPrimary, ButtonSecondary, Container, Eyebrow, Stat } from "@/components/ds/primitives"
import { HeroMap } from "@/components/landing/hero-map"

const idleFloat = (delay: number, y = 3) => ({
  animate: { y: [0, -y, 0] },
  transition: { duration: 4.2, repeat: Infinity, ease: "easeInOut" as const, delay },
})

const idlePulse = (delay: number) => ({
  animate: { opacity: [0.88, 1, 0.88] },
  transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const, delay },
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
            <motion.div {...idleFloat(0, 2)} style={{ display: "inline-block", marginBottom: sp.lg }}>
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
                <motion.span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: r.full,
                    background: c.statusOnTime.dot,
                    display: "block",
                  }}
                  animate={{ scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <Eyebrow>Nimbus Air · 40 aircraft · 200 daily flights</Eyebrow>
              </div>
            </motion.div>

            <h1
              style={{
                fontFamily: ff.display,
                fontWeight: 800,
                fontSize: "clamp(44px, 6.2vw, 78px)",
                lineHeight: 0.98,
                letterSpacing: "-0.035em",
                color: c.ink,
                marginBottom: sp.md,
              }}
            >
              <motion.span
                {...idleFloat(0.1, 4)}
                style={{ display: "block", textShadow: "0 1px 0 rgba(255,255,255,0.8)" }}
              >
                When weather hits,
              </motion.span>
              <motion.span
                style={{ display: "block", color: c.signatureCoral }}
                animate={{
                  y: [0, -5, 0],
                  scale: [1, 1.015, 1],
                  textShadow: [
                    "0 0 0 rgba(170,45,0,0)",
                    "0 0 32px rgba(170,45,0,0.28)",
                    "0 0 0 rgba(170,45,0,0)",
                  ],
                }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >
                flights cascade.
              </motion.span>
              <motion.span
                {...idleFloat(0.5, 3)}
                style={{ display: "block", color: c.muted }}
                animate={{
                  y: [0, -3, 0],
                  opacity: [0.92, 1, 0.92],
                }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                Aeolus recovers.
              </motion.span>
            </h1>

            <motion.p
              {...idlePulse(0.2)}
              style={{
                ...typeStyle("titleMd", c.body),
                fontSize: 17,
                fontWeight: 500,
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
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                marginTop: sp.lg,
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "Annual cost", value: "$34B", hint: "US disruption losses", delay: 0 },
                { label: "Solve time", value: "<10ms", hint: "CP-SAT MILP", delay: 0.15 },
                { label: "Plans/event", value: "4", hint: "Cost · Pax · Future · Carbon", delay: 0.3 },
              ].map((stat, i) => (
                <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  {i > 0 && <span style={{ width: 1, height: 36, background: c.hairline }} />}
                  <motion.div {...idleFloat(stat.delay, 2)}>
                    <Stat label={stat.label} value={stat.value} hint={stat.hint} />
                  </motion.div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Map */}
          <motion.div
            animate={{
              y: [0, -6, 0],
              scale: [1, 1.008, 1],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <HeroMap />
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
