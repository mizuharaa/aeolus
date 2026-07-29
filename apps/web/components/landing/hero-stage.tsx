"use client"
/**
 * HeroStatementStage — the pitch, stated plainly. Giant editorial ink type
 * with a serif italic accent, concrete aviation copy, two pill CTAs.
 */

import Link from "next/link"
import { ArrowDown, ArrowRight } from "lucide-react"
import { HighlightSwipe, SplitReveal } from "@/components/landing/type-fx"
import { Rise } from "@/components/landing/motion"

export function HeroStatementStage() {
  return (
    <section
      aria-label="Airline recovery, simulated live"
      style={{
        position: "relative",
        padding: "clamp(90px, 14vh, 160px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <span className="lp-eyebrow" style={{ display: "block", marginBottom: 26 }}>
          01 — The premise
        </span>

        <SplitReveal
          as="h1"
          className="ed-display"
          style={{ fontSize: "clamp(52px, 8.6vw, 138px)", maxWidth: 1220 }}
        >
          Airline recovery,{" "}
          <em className="ed-serif" style={{ color: "var(--accent-blue)", fontStyle: "italic" }}>
            <HighlightSwipe coverage={1} height="64%">simulated live.</HighlightSwipe>
          </em>
        </SplitReveal>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 40,
            flexWrap: "wrap",
            marginTop: "clamp(36px, 6vh, 64px)",
          }}
        >
          <Rise>
            <p
              style={{
                margin: 0,
                maxWidth: 560,
                fontSize: "clamp(16px, 1.45vw, 19px)",
                lineHeight: 1.55,
                color: "var(--muted)",
                fontWeight: 450,
              }}
            >
              Trigger a hub closure, watch the delay cascade spread across the
              network, then compare recovery plans by{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>cost</strong>,{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>passengers</strong>,{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>crew legality</strong> and{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>carbon</strong>.
            </p>
          </Rise>

          <Rise delay={0.1}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/simulator" className="lp-btn lp-btn--ink">
                Launch simulator
                <ArrowRight style={{ width: 15, height: 15 }} strokeWidth={2.25} />
              </Link>
              <a href="#demo" className="lp-btn lp-btn--ghost">
                Watch the recovery loop
                <ArrowDown style={{ width: 15, height: 15 }} strokeWidth={2.25} />
              </a>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  )
}
