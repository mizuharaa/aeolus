"use client"
/**
 * FourPlansSection — the loud, colourful centrepiece between the demo and the
 * methodology. A full-bleed teal→violet gradient panel carrying the four
 * recovery plans (A/B/C/D) as glass cards, with bubbling blobs that drift on
 * scroll and cards that rise + tilt into place. This is where the landing gets
 * its saturated colour; everything else stays warm-beige editorial.
 *
 * Reduced motion drops the parallax and shows the cards static.
 */

import { useLayoutEffect, useRef } from "react"
import { gsap } from "@/components/landing/gsap"

type Plan = {
  id: string
  objective: string
  cost: string
  cxl: string
  note: string
  recommended?: boolean
}

const PLANS: Plan[] = [
  { id: "A", objective: "Minimize cost", cost: "$1.9M", cxl: "11 cancellations", note: "Cheapest ledger, most stranded pax." },
  { id: "B", objective: "Minimize pax impact", cost: "$2.4M", cxl: "3 cancellations", note: "Fewest disruptions, zero crew violations.", recommended: true },
  { id: "C", objective: "Protect tomorrow", cost: "$2.7M", cxl: "5 cancellations", note: "Keeps aircraft positioned for the next day." },
  { id: "D", objective: "Minimize carbon", cost: "$2.2M", cxl: "8 cancellations", note: "Lowest net CO₂ under EU-ETS pricing." },
]

export function FourPlansSection() {
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      // blobs drift as the panel scrolls through
      gsap.utils.toArray<HTMLElement>(".fp-blob").forEach((b, i) => {
        gsap.to(b, {
          yPercent: i % 2 === 0 ? -22 : 26,
          xPercent: i % 2 === 0 ? 12 : -14,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1.1 },
        })
      })
      // cards rise + tilt in
      gsap.from(".fp-card", {
        y: 46,
        opacity: 0,
        rotateX: 12,
        stagger: 0.1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 72%" },
      })
      // headline reveal
      gsap.from(".fp-head", {
        y: 28,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 78%" },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={rootRef}
      aria-label="Four recovery plans"
      className="fp-section"
      style={{
        position: "relative",
        margin: "clamp(40px, 7vh, 90px) clamp(12px, 3vw, 40px)",
        borderRadius: "clamp(20px, 3vw, 34px)",
        overflow: "hidden",
        padding: "clamp(56px, 9vh, 120px) clamp(22px, 5vw, 76px)",
        background:
          "#241A38",
        color: "#F4F0FF",
        perspective: 1400,
      }}
    >
      {/* bubbling blobs */}
      <div className="fp-blob" aria-hidden style={{ position: "absolute", top: "-12%", left: "-6%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,207,180,0.55), transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }} />
      <div className="fp-blob" aria-hidden style={{ position: "absolute", bottom: "-16%", right: "-4%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(147,90,240,0.55), transparent 70%)", filter: "blur(34px)", pointerEvents: "none" }} />
      <div className="fp-blob" aria-hidden style={{ position: "absolute", top: "34%", right: "28%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,175,27,0.30), transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", maxWidth: 1320, margin: "0 auto" }}>
        <div className="fp-head" style={{ marginBottom: "clamp(30px, 5vh, 56px)", maxWidth: 760 }}>
          <span
            style={{
              fontFamily: "var(--ae-font-mono)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(244,240,255,0.72)",
            }}
          >
            03 — One disruption, four ways out
          </span>
          <h2
            className="ed-display"
            style={{ fontSize: "clamp(34px, 5.4vw, 82px)", color: "#FFFFFF", marginTop: 18 }}
          >
            Four plans, ranked in{" "}
            <em className="ed-serif" style={{ color: "#FFD98A", fontStyle: "italic" }}>
              8 milliseconds.
            </em>
          </h2>
          <p style={{ marginTop: 18, fontSize: "clamp(15px, 1.4vw, 18px)", lineHeight: 1.6, color: "rgba(244,240,255,0.82)", maxWidth: 560 }}>
            The optimizer weighs cost, passengers, tomorrow&apos;s schedule and
            carbon — then hands you four differentiated recovery plans to choose
            between, not one black-box answer.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "clamp(14px, 1.6vw, 22px)",
          }}
        >
          {PLANS.map((p) => (
            <div
              key={p.id}
              className="fp-card"
              style={{
                position: "relative",
                borderRadius: 18,
                padding: "22px 20px 20px",
                background: p.recommended ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                border: p.recommended ? "1px solid rgba(255,217,138,0.7)" : "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(10px)",
                boxShadow: p.recommended ? "0 20px 50px -24px rgba(0,0,0,0.6)" : "0 12px 34px -24px rgba(0,0,0,0.5)",
                transformStyle: "preserve-3d",
              }}
            >
              {p.recommended && (
                <span
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontFamily: "var(--ae-font-mono)",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#14100F",
                    background: "#FFD98A",
                    padding: "3px 8px",
                    borderRadius: 999,
                  }}
                >
                  Applied
                </span>
              )}
              <div
                style={{
                  fontFamily: "var(--ae-font-display)",
                  fontWeight: 800,
                  fontSize: 40,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  color: "#FFFFFF",
                }}
              >
                {p.id}
              </div>
              <div style={{ marginTop: 8, fontSize: 15, fontWeight: 650, color: "#FFFFFF" }}>{p.objective}</div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 14,
                  fontFamily: "var(--ae-font-mono)",
                  fontSize: 12.5,
                  color: "rgba(244,240,255,0.9)",
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.cost}</span>
                <span style={{ color: "rgba(244,240,255,0.7)" }}>{p.cxl}</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.55, color: "rgba(244,240,255,0.72)" }}>
                {p.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          .fp-card { transform: none !important; opacity: 1 !important; }
        }
      `}</style>
    </section>
  )
}
