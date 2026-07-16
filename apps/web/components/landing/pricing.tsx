"use client"
/**
 * PricingSection — an editorial pricing LEDGER, not a card rack. Three tier
 * rows sit directly on the paper between drawn rules: display tier name +
 * blurb · features as a prose run · mono price · typographic CTA. The
 * recommended tier is marked with an amber rule + mono tag instead of a
 * "Most popular" badge on a lifted box.
 */

import Link from "next/link"
import { useLayoutEffect, useRef } from "react"
import { ArrowRight } from "lucide-react"
import { gsap } from "@/components/landing/gsap"

type Tier = {
  name: string
  price: string
  period?: string
  blurb: string
  cta: string
  href: string
  features: string[]
  recommended?: boolean
}

const TIERS: Tier[] = [
  {
    name: "Explorer",
    price: "$0",
    period: "forever",
    blurb: "Kick the tires on real disruption physics.",
    cta: "Start free",
    href: "/simulator",
    features: ["Sandbox network (1 hub)", "3 curated scenarios", "Delay cascade replay", "Community scenario library"],
  },
  {
    name: "Operations",
    price: "$79",
    period: "per seat / month",
    blurb: "The full recovery loop for working OCC teams.",
    cta: "Start 14-day trial",
    href: "/simulator",
    features: [
      "Full network, unlimited scenarios",
      "All four recovery plans (cost / pax / crew / carbon)",
      "Agent command console",
      "Exports & shareable replays",
      "Priority support",
    ],
    recommended: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    blurb: "Your fleet, your schedules, your rules engine.",
    cta: "Talk to us",
    href: "mailto:hello@aeolus.dev",
    features: ["Private data feeds & SSO", "Custom crew-legality rules", "Simulation API access", "Dedicated recovery engineer"],
  },
]

export function PricingSection() {
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const ctx = gsap.context(() => {
      gsap.from(".pr-row", {
        y: 28,
        opacity: 0,
        stagger: 0.10,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 74%" },
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 40 }}>
        <div>
          <span className="lp-eyebrow">05 — Plans &amp; pricing</span>
          <h2
            style={{
              margin: "10px 0 0",
              fontSize: "clamp(30px, 4.4vw, 54px)",
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              color: "var(--ink, var(--ae-text))",
            }}
          >
            Priced like a tool,
            <br />
            <span className="ed-serif" style={{ color: "var(--accent-blue, #2C49E0)" }}>
              not a consultancy.
            </span>
          </h2>
        </div>
        <p style={{ maxWidth: 380, margin: 0, color: "var(--muted, var(--ae-text-3))", fontSize: 15, lineHeight: 1.55 }}>
          Every tier runs the same simulation core — the difference is network size, seats, and how deep the recovery
          tooling goes.
        </p>
      </div>

      {/* The ledger — rows between drawn rules, no boxes */}
      <div style={{ borderTop: "2px solid var(--ink, var(--ae-text))" }}>
        {TIERS.map((t) => (
          <Link
            key={t.name}
            href={t.href as import("next").Route}
            className="pr-row"
            aria-label={`${t.name} — ${t.price}${t.period ? ` ${t.period}` : ""} · ${t.cta}`}
          >
            {/* name + blurb */}
            <div className="pr-name-cell">
              {t.recommended && <span className="pr-tag">Recommended · OCC teams</span>}
              <span className="pr-name">{t.name}</span>
              <span className="pr-blurb">{t.blurb}</span>
            </div>

            {/* features as a prose run, not a checkmark list */}
            <p className="pr-features">
              {t.features.map((f, i) => (
                <span key={f}>
                  {f}
                  {i < t.features.length - 1 && <span className="pr-sep"> · </span>}
                </span>
              ))}
            </p>

            {/* price + CTA */}
            <div className="pr-price-cell">
              <span className="pr-price">{t.price}</span>
              {t.period && <span className="pr-period">{t.period}</span>}
              <span className={t.recommended ? "pr-cta pr-cta--solid" : "pr-cta"}>
                {t.cta}
                <ArrowRight className="pr-arrow" style={{ width: 14, height: 14 }} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <style jsx>{`
        :global(.pr-row) {
          display: grid;
          grid-template-columns: minmax(180px, 280px) minmax(0, 1fr) auto;
          gap: clamp(16px, 3vw, 48px);
          align-items: start;
          padding: clamp(22px, 3.5vh, 34px) 4px;
          border-bottom: 1px solid var(--border, var(--ae-line));
          text-decoration: none;
          transition: background 180ms ease;
        }
        :global(.pr-row:hover) {
          background: color-mix(in srgb, var(--ink, #141019) 4%, transparent);
        }
        :global(.pr-row:focus-visible) {
          outline: 3px solid var(--accent-blue, #2c49e0);
          outline-offset: -3px;
        }
        .pr-name-cell {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .pr-tag {
          font-family: var(--ae-font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--accent-amber, #b8863c);
        }
        .pr-name {
          font-size: clamp(22px, 2.6vw, 32px);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.05;
          color: var(--ink, var(--ae-text));
        }
        .pr-blurb {
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--muted, var(--ae-text-3));
        }
        .pr-features {
          margin: 6px 0 0;
          font-size: 14.5px;
          line-height: 1.7;
          color: var(--ink, var(--ae-text));
          max-width: 56ch;
        }
        .pr-sep {
          color: var(--accent-blue, #2c49e0);
          font-weight: 600;
        }
        .pr-price-cell {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          text-align: right;
          white-space: nowrap;
        }
        .pr-price {
          font-family: var(--ae-font-mono);
          font-size: clamp(26px, 3vw, 38px);
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--ink, var(--ae-text));
          font-variant-numeric: tabular-nums;
        }
        .pr-period {
          font-size: 12px;
          color: var(--muted, var(--ae-text-3));
        }
        .pr-cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 12px;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink, var(--ae-text));
          border-bottom: 2px solid var(--accent-amber, #efaf1b);
          padding-bottom: 2px;
        }
        .pr-cta--solid {
          border-bottom: none;
          background: var(--ink, #141019);
          color: var(--bg, #f5f0e3);
          border-radius: 999px;
          padding: 9px 18px;
        }
        :global(.pr-row) .pr-arrow {
          transition: transform 180ms cubic-bezier(0.22, 0.9, 0.28, 1);
        }
        :global(.pr-row:hover) .pr-arrow {
          transform: translateX(4px);
        }
        @media (max-width: 860px) {
          :global(.pr-row) {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .pr-price-cell {
            align-items: flex-start;
            text-align: left;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.pr-row:hover) .pr-arrow {
            transform: none;
          }
        }
      `}</style>
    </section>
  )
}
