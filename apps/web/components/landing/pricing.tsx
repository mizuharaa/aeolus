"use client"
/**
 * PricingSection — plans & pricing on shadcn primitives (Card/Badge/Button),
 * inked in the landing's editorial register: beige paper, white cards,
 * cobalt action, one recommended tier lifted with the violet wash.
 */

import Link from "next/link"
import { useLayoutEffect, useRef } from "react"
import { ArrowRight, Check } from "lucide-react"
import { gsap } from "@/components/landing/gsap"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

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
      gsap.from(".pr-card", {
        y: 42,
        opacity: 0,
        stagger: 0.09,
        duration: 0.75,
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {TIERS.map((t) => (
          <Card
            key={t.name}
            className="pr-card"
            style={{
              background: "var(--panel, var(--ae-surface))",
              borderColor: t.recommended ? "#2C49E0" : "var(--border, var(--ae-line))",
              boxShadow: t.recommended ? "0 18px 48px -18px rgba(44, 73, 224, 0.35)" : undefined,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {t.recommended && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "0 0 auto 0",
                  height: 4,
                  background: "linear-gradient(90deg, #2C49E0, #6F3FE4, #EFAF1B)",
                }}
              />
            )}
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <CardTitle style={{ fontSize: 18, letterSpacing: "0.01em" }}>{t.name}</CardTitle>
                {t.recommended && <Badge style={{ background: "#2C49E0", color: "#fff" }}>Most popular</Badge>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink, var(--ae-text))" }}>
                  {t.price}
                </span>
                {t.period && <span style={{ fontSize: 13, color: "var(--muted, var(--ae-text-3))" }}>{t.period}</span>}
              </div>
              <CardDescription style={{ marginTop: 4 }}>{t.blurb}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {t.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.45 }}>
                    <Check style={{ width: 15, height: 15, marginTop: 2, flexShrink: 0, color: "#2C49E0" }} strokeWidth={2.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                asChild
                variant={t.recommended ? "default" : "outline"}
                style={t.recommended ? { background: "#2C49E0", color: "#fff", width: "100%" } : { width: "100%" }}
              >
                <Link href={t.href as import("next").Route}>
                  {t.cta}
                  <ArrowRight style={{ width: 15, height: 15 }} />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  )
}
