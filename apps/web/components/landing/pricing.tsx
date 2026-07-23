"use client"
/**
 * PricingSection — MVP edition. One plan, one card. Aeolus is free while it's
 * in MVP, so the section states that plainly: a single centered card with a
 * price, what's included, and one CTA. Hover lifts the card and lights the
 * border in plum; the feature list is the informative payload. When paid
 * tiers arrive this grid can grow back to multiple cards.
 */

import Link from "next/link"
import { useLayoutEffect, useRef } from "react"
import { ArrowRight, Check } from "lucide-react"
import { gsap } from "@/components/landing/gsap"

const PLAN = {
  name: "Free",
  price: "$0",
  period: "while we're in MVP",
  blurb: "The whole recovery loop, open to everyone. Trigger real disruption physics, watch the cascade spread, and compare recovery plans — no card, no trial clock.",
  cta: "Launch the simulator",
  href: "/simulator",
  features: [
    "Full Nimbus Air network + live ADS-B traffic",
    "Every disruption type — weather, ATC, crew, mechanical",
    "Delay cascade replay across the network",
    "All four recovery plans — cost · passengers · crew · carbon",
    "Deterministic CP-SAT solver, sub-10ms solves",
    "Shareable scenario replays",
  ],
}

export function PricingSection() {
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const ctx = gsap.context(() => {
      gsap.from(".pr-card", {
        y: 32,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 76%" },
      })
      gsap.from(".pr-feat", {
        x: -12,
        opacity: 0,
        stagger: 0.06,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 62%" },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section
      id="pricing"
      ref={rootRef}
      aria-label="Plans and pricing"
      style={{ padding: "clamp(72px, 10vh, 128px) clamp(20px, 4vw, 56px)", maxWidth: 1280, margin: "0 auto" }}
    >
      <div style={{ textAlign: "center", marginBottom: 44, maxWidth: 620, marginInline: "auto" }}>
        <span className="lp-eyebrow">05 — Plans &amp; pricing</span>
        <h2
          style={{
            margin: "12px 0 14px",
            fontSize: "clamp(30px, 4.4vw, 54px)",
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            color: "var(--ink, var(--ae-text))",
          }}
        >
          Free{" "}
          <span className="ed-serif" style={{ color: "var(--accent-blue, #5B3FA8)" }}>
            while we build.
          </span>
        </h2>
        <p style={{ margin: 0, color: "var(--muted, var(--ae-text-3))", fontSize: 15.5, lineHeight: 1.6 }}>
          Aeolus is in MVP, so the full engine is open with no paywall. Paid tiers for large fleets and
          teams will come later — for now, everything below is yours.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Link
          href={PLAN.href as import("next").Route}
          className="pr-card"
          aria-label={`${PLAN.name} plan — ${PLAN.price} ${PLAN.period}. ${PLAN.cta}`}
        >
          {/* header row: name/tag + price */}
          <div className="pr-head">
            <div className="pr-head-l">
              <span className="pr-tag">Current plan · MVP</span>
              <span className="pr-name">{PLAN.name}</span>
            </div>
            <div className="pr-price-cell">
              <span className="pr-price">{PLAN.price}</span>
              <span className="pr-period">{PLAN.period}</span>
            </div>
          </div>

          <p className="pr-blurb">{PLAN.blurb}</p>

          <span className="pr-rule" aria-hidden />

          <ul className="pr-features">
            {PLAN.features.map((f) => (
              <li key={f} className="pr-feat">
                <span className="pr-check" aria-hidden>
                  <Check style={{ width: 13, height: 13 }} strokeWidth={2.5} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <span className="pr-cta">
            {PLAN.cta}
            <ArrowRight className="pr-arrow" style={{ width: 16, height: 16 }} strokeWidth={2.25} />
          </span>
          <span className="pr-note">No sign-up · no credit card · nothing to cancel</span>
        </Link>
      </div>

      <style jsx>{`
        :global(.pr-card) {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 540px;
          padding: clamp(26px, 4vw, 40px);
          background: var(--panel, var(--ae-surface));
          border: 1.5px solid var(--border, var(--ae-line));
          border-radius: 20px;
          text-decoration: none;
          box-shadow: 0 1px 2px rgba(28, 20, 38, 0.05);
          transition: transform 240ms cubic-bezier(0.22, 0.9, 0.28, 1),
            box-shadow 240ms ease, border-color 200ms ease;
          will-change: transform;
        }
        :global(.pr-card:hover) {
          transform: translateY(-6px);
          border-color: var(--accent-blue, #5b3fa8);
          box-shadow: 0 26px 60px -30px rgba(91, 63, 168, 0.55),
            0 0 0 1px color-mix(in srgb, var(--accent-blue, #5b3fa8) 30%, transparent) inset;
        }
        :global(.pr-card:focus-visible) {
          outline: none;
          border-color: var(--accent-blue, #5b3fa8);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-blue, #5b3fa8) 40%, transparent);
        }

        .pr-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .pr-head-l {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        .pr-tag {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          font-family: var(--ae-font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--accent-amber, #b8863c);
          padding: 4px 9px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent-amber, #b8863c) 14%, transparent);
        }
        .pr-name {
          font-size: clamp(26px, 3vw, 36px);
          font-weight: 750;
          letter-spacing: -0.02em;
          line-height: 1;
          color: var(--ink, var(--ae-text));
        }
        .pr-price-cell {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pr-price {
          font-family: var(--ae-font-mono);
          font-size: clamp(34px, 4.4vw, 46px);
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1;
          color: var(--ink, var(--ae-text));
          font-variant-numeric: tabular-nums;
        }
        .pr-period {
          margin-top: 6px;
          font-size: 12px;
          color: var(--muted, var(--ae-text-3));
        }

        .pr-blurb {
          margin: 18px 0 0;
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--muted, var(--ae-text-3));
        }

        .pr-rule {
          display: block;
          height: 1px;
          margin: 22px 0;
          background: var(--border, var(--ae-line));
        }

        .pr-features {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pr-feat {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          font-size: 14.5px;
          line-height: 1.45;
          color: var(--ink, var(--ae-text));
        }
        .pr-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          margin-top: 1px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent-blue, #5b3fa8) 14%, transparent);
          color: var(--accent-blue, #5b3fa8);
          transition: background 200ms ease, transform 200ms cubic-bezier(0.22, 0.9, 0.28, 1);
        }
        :global(.pr-card:hover) .pr-check {
          background: var(--accent-blue, #5b3fa8);
          color: #fff;
        }

        .pr-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 30px;
          padding: 14px 22px;
          font-size: 15px;
          font-weight: 650;
          color: var(--bg, #f5f1e8);
          background: var(--ink, #1c1426);
          border-radius: 999px;
          transition: background 200ms ease;
        }
        :global(.pr-card:hover) .pr-cta {
          background: var(--accent-blue, #5b3fa8);
        }
        :global(.pr-card) .pr-arrow {
          transition: transform 200ms cubic-bezier(0.22, 0.9, 0.28, 1);
        }
        :global(.pr-card:hover) .pr-arrow {
          transform: translateX(4px);
        }

        .pr-note {
          margin-top: 12px;
          text-align: center;
          font-size: 12px;
          color: var(--muted, var(--ae-text-3));
        }

        @media (max-width: 480px) {
          .pr-head {
            flex-direction: column;
            gap: 14px;
          }
          .pr-price-cell {
            align-items: flex-start;
            text-align: left;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.pr-card:hover) {
            transform: none;
          }
          :global(.pr-card:hover) .pr-arrow {
            transform: none;
          }
        }
      `}</style>
    </section>
  )
}
