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

import { useEffect, useRef, useState } from "react"

import { Rise } from "@/components/landing/motion"

const PARTNERS = ["MERIDIAN", "NORTHWIND", "CALDERA AIR", "ALTUS", "VESPER", "HELIOS"]

/**
 * Static filter ids — deliberately NOT `useId()`.
 *
 * `useId` numbers nodes by their position in the React tree, so it only stays
 * stable if the server and client build the identical tree. Wrapping each
 * partner name in `<Rise>` changed this subtree's shape and the ids diverged
 * (`boil-_R_1satmlb_-0` on the client vs `boil-_R_7iatmlb_-0` on the server),
 * throwing a hydration mismatch on every landing load. LANDING_HANDOFF.md
 * records the same trap taking `MaskedWordmark` down to a blank screen.
 *
 * A literal is safe here because this section renders once per page; if it ever
 * needs two instances, hash an explicit instanceKey prop rather than reaching
 * for useId again.
 */
const BOIL_ID = "ae-tb-boil"

export function TrustedBy() {
  const f = (n: number) => `${BOIL_ID}-${n}`
  /**
   * The boil only runs while the strip is on screen.
   *
   * Six spans swapping between three `feTurbulence` + `feDisplacementMap`
   * filters three times a second is six CPU turbulence passes per swap, and
   * it ran for the life of the document — including the four seconds a visitor
   * spends at the top of a 22,000px page looking at the cabin. These were the
   * only CSS animations running at idle on the whole landing.
   */
  const stripRef = useRef<HTMLElement>(null)
  const [boiling, setBoiling] = useState(false)

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    if (!("IntersectionObserver" in window)) {
      setBoiling(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setBoiling(Boolean(entry?.isIntersecting)),
      { rootMargin: "10% 0px" },
    )
    observer.observe(strip)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={stripRef}
      aria-label="Reference carriers"
      data-boiling={boiling}
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
            // The six sit on one line, so scroll position alone would move
            // them in lockstep — `delay` phases them into a left-to-right
            // build as the strip climbs.
            <Rise key={name} y={18} delay={i * 0.07}>
            <span
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
            </Rise>
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
        }
        section[data-boiling="true"] .tb-boil {
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
