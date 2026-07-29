"use client"
/**
 * MethodologySection — the systems ledger, set as a high-contrast
 * editorial table: mono indices, hard rules, display-weight system names,
 * cobalt reference tags. Deterministic language only.
 */

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SplitReveal } from "@/components/landing/type-fx"
import { Rise, StaggerGroup, StaggerItem } from "@/components/landing/motion"

const SYSTEMS = [
  {
    name: "Cascade model",
    desc: "Rotation-graph propagation built from the schedule itself — buffer-aware, no ML, no training data. Every forecast is reproducible from its inputs.",
    tag: "deterministic",
  },
  {
    name: "Recovery optimizer",
    desc: "OR-Tools CP-SAT over swaps, delays, cancellations and reroutes; four weighted objectives produce four differentiated plans.",
    tag: "< 10 ms",
  },
  {
    name: "Cost engine",
    desc: "DOT BTS 2023 delay and cancellation rates, DOT compensation rules, EU-ETS carbon pricing — every dollar in a plan is decomposable.",
    tag: "BTS 2023",
  },
  {
    name: "Crew legality",
    desc: "FAR Part 117 flight-duty-period tables and cumulative limits, evaluated per plan; violations surface as flags before you commit.",
    tag: "Part 117",
  },
  {
    name: "Live context",
    desc: "FAA NAS status and NWS weather alerts stream in beside the synthetic network, so scenarios sit against real airspace conditions.",
    tag: "FAA · NWS",
  },
  {
    name: "Audit trail",
    desc: "Every trigger, solve and commit is logged with its inputs and objective weights; any recovery plan can be replayed step by step.",
    tag: "replayable",
  },
]

export function MethodologySection() {
  return (
    <section
      id="methodology"
      aria-label="Methodology"
      style={{ padding: "clamp(90px, 13vh, 150px) clamp(20px, 4vw, 56px)" }}
    >
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 32,
            flexWrap: "wrap",
            marginBottom: 48,
          }}
        >
          <div>
            <span className="lp-eyebrow" style={{ display: "block", marginBottom: 22 }}>
              04 — Methodology
            </span>
            <SplitReveal
              as="h2"
              className="ed-display"
              style={{ fontSize: "clamp(40px, 5.6vw, 92px)" }}
            >
              Deterministic.
              <br />
              <em className="ed-serif" style={{ color: "var(--accent-purple)" }}>
                Auditable.
              </em>{" "}
              Open.
            </SplitReveal>
          </div>
          <Rise>
            <p style={{ margin: 0, maxWidth: 380, fontSize: 15.5, lineHeight: 1.55, color: "var(--muted)" }}>
              Six systems, no black boxes. Same inputs, same cascade, same
              plans — every run of the simulator is reproducible end to end.
            </p>
          </Rise>
        </div>

        <StaggerGroup gap={0.07}>
          {SYSTEMS.map((s, i) => (
            <StaggerItem key={s.name}>
              <div className="lp-mrow">
                <span
                  style={{
                    fontFamily: "var(--ae-font-mono)",
                    fontSize: 12,
                    color: "var(--accent-amber)",
                    fontWeight: 600,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="ed-display"
                  style={{ fontSize: "clamp(20px, 1.9vw, 27px)", letterSpacing: "-0.02em" }}
                >
                  {s.name}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted)", maxWidth: 640 }}>
                  {s.desc}
                </span>
                <span
                  style={{
                    fontFamily: "var(--ae-font-mono)",
                    fontSize: 11.5,
                    color: "var(--accent-blue)",
                    whiteSpace: "nowrap",
                    justifySelf: "end",
                  }}
                >
                  {s.tag}
                </span>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Rise delay={0.1}>
          <div style={{ paddingTop: 28 }}>
            <Link
              href="/docs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14.5,
                fontWeight: 600,
                color: "var(--ink)",
                textDecoration: "none",
                borderBottom: "2px solid var(--accent-amber)",
                paddingBottom: 3,
              }}
            >
              Read the full methodology
              <ArrowRight style={{ width: 15, height: 15 }} strokeWidth={2.25} />
            </Link>
          </div>
        </Rise>
      </div>
    </section>
  )
}
