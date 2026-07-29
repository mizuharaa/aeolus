"use client"
/**
 * TrustedBy — the "trusted by the best" strip, drawn with a 2000s paper /
 * line-boil aesthetic: every name and the rule around it is rendered as an
 * SVG stroke run through a turbulence displacement filter that swaps between
 * a few seeds ~10×/s, so the lines jitter like hand-inked animation
 * (Squigglevision / "boil"). Reduced motion freezes it on one clean frame.
 *
 * These are illustrative reference carriers for the synthetic Nimbus Air
 * network, labelled as such — not real customer claims.
 */

import { useId } from "react"

const PARTNERS = ["MERIDIAN", "NORTHWIND", "CALDERA AIR", "ALTUS", "VESPER", "HELIOS"]

export function TrustedBy() {
  const uid = useId().replace(/[:]/g, "")
  const f = (n: number) => `boil-${uid}-${n}`

  return (
    <section
      aria-label="Reference carriers"
      style={{
        position: "relative",
        padding: "clamp(70px, 10vh, 120px) clamp(20px, 4vw, 56px)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* three turbulence frames the names cycle through to "boil" */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          {[0, 1, 2].map((i) => (
            <filter key={i} id={f(i)}>
              <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={i * 7 + 3} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={4.5} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          ))}
        </defs>
      </svg>

      <div style={{ maxWidth: 1480, margin: "0 auto", textAlign: "center" }}>
        <span className="lp-eyebrow" style={{ display: "block", marginBottom: "clamp(28px, 4vh, 48px)" }}>
          05 — Trusted by the best
        </span>

        <div
          className="tb-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "clamp(20px, 3vw, 44px)",
            alignItems: "center",
            justifyItems: "center",
          }}
        >
          {PARTNERS.map((name, i) => (
            <span
              key={name}
              className="tb-boil"
              style={{
                fontFamily: "var(--ae-font-display)",
                fontWeight: 800,
                fontSize: "clamp(18px, 2vw, 27px)",
                letterSpacing: "0.02em",
                color: "var(--ink)",
                opacity: 0.82,
                // stagger the boil so the names don't jitter in lockstep
                animationDelay: `${(i % 3) * -0.1}s`,
              }}
            >
              {name}
            </span>
          ))}
        </div>

        <p
          style={{
            margin: "clamp(30px, 4vh, 52px) auto 0",
            maxWidth: 520,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--muted)",
          }}
        >
          Illustrative reference carriers for the synthetic Nimbus Air network.
          Aeolus runs the same recovery engine against any fleet you model.
        </p>
      </div>

      <style jsx>{`
        .tb-boil {
          display: inline-block;
          filter: url(#${f(0)});
          animation: tb-boil-cycle 0.32s steps(1) infinite;
        }
        @keyframes tb-boil-cycle {
          0% { filter: url(#${f(0)}); }
          33% { filter: url(#${f(1)}); }
          66% { filter: url(#${f(2)}); }
          100% { filter: url(#${f(0)}); }
        }
        .tb-boil:hover { opacity: 1 !important; }
        @media (prefers-reduced-motion: reduce) {
          .tb-boil { animation: none; filter: url(#${f(1)}); }
        }
      `}</style>
    </section>
  )
}
