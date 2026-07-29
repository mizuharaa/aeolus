"use client"
/**
 * FinalCTAStage — the closer, on the night register. The masked-ribbon
 * treatment returns one last time over "RUN A DISRUPTION." (the wordmark
 * component reads --ink, so the letters flip to bone automatically),
 * beside a real solve transcript in mono.
 */

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { MaskedWordmark } from "@/components/landing/masked-wordmark"
import { Rise, StaggerGroup, StaggerItem } from "@/components/landing/motion"
import { DriftPlane } from "@/components/landing/planes"

const LOG = [
  { prompt: true, text: "aeolus trigger --event weather_closure --airport KORD --severity 4" },
  { text: "cascade   47 direct · 61 first-order · 39 second-order", right: "2.1 ms" },
  { text: "solve     plans A · B · C · D", right: "8.4 ms" },
  { text: "ranked    B — minimize pax impact", right: "$2.4M · 0 flags" },
  { prompt: true, text: "aeolus apply B" },
  { text: "committed 118 actions · network recovering", right: "14:33Z" },
]

export function FinalCTAStage() {
  return (
    <section
      id="cta"
      aria-label="Run a disruption"
      style={{
        position: "relative",
        padding: "clamp(90px, 14vh, 170px) clamp(20px, 4vw, 56px) clamp(60px, 8vh, 100px)",
      }}
    >
      <DriftPlane from={{ left: "-5%", top: "26%" }} to={{ left: "102%", top: "8%" }} rotate={[2, 16]} size={30} color="var(--accent-amber)" bob={7} />

      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <span className="lp-eyebrow" style={{ display: "block", marginBottom: 30 }}>
          06 — Your turn
        </span>

        <Rise>
          <MaskedWordmark text="RUN A DISRUPTION." outsideOpacity={0.1} />
        </Rise>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "clamp(32px, 4vw, 72px)",
            alignItems: "center",
            marginTop: "clamp(40px, 6vh, 72px)",
          }}
          className="lp-cta-split"
        >
          <div style={{ display: "grid", gap: 26 }}>
            <Rise>
              <p style={{ margin: 0, maxWidth: 480, fontSize: "clamp(15px, 1.4vw, 18px)", lineHeight: 1.6, color: "var(--muted)" }}>
                No setup, no account. Pick an event, watch the delay cascade
                cross the network, and compare four recovery plans with full
                cost, crew and carbon detail.
              </p>
            </Rise>
            <Rise delay={0.08}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Link href="/simulator" className="lp-btn lp-btn--amber">
                  Launch simulator
                  <ArrowRight style={{ width: 15, height: 15 }} strokeWidth={2.25} />
                </Link>
                <Link href="/scenarios" className="lp-btn lp-btn--ghost">
                  Browse scenarios
                </Link>
              </div>
            </Rise>
          </div>

          {/* solve transcript */}
          <Rise delay={0.12}>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "clamp(20px, 2.4vw, 34px)",
                background: "var(--panel)",
              }}
            >
              <StaggerGroup
                gap={0.12}
                style={{
                  fontFamily: "var(--ae-font-mono)",
                  fontSize: 12.5,
                  lineHeight: 2.05,
                  color: "var(--ink)",
                }}
              >
                {LOG.map((l, i) => (
                  <StaggerItem key={i}>
                    <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap", overflow: "hidden" }}>
                      {l.prompt ? (
                        <>
                          <span style={{ color: "var(--accent-amber)" }}>$</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{l.text}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {"  "}{l.text}
                          </span>
                          {l.right ? (
                            <span style={{ marginLeft: "auto", color: "var(--accent-teal)" }}>{l.right}</span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  )
}
