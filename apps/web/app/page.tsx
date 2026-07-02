"use client"
import Link from "next/link"
import type { Route } from "next"
import { ArrowRight } from "lucide-react"
import { AeolusLogo } from "@/components/ds/logo"
import { c, ff } from "@/lib/design-tokens"
import { ButtonPrimary, Container, Eyebrow } from "@/components/ds/primitives"
import { SystemCapabilities } from "@/components/landing/capabilities"
import { HeroSection } from "@/components/landing/hero-section"
import { PanIn, ScrollPlane } from "@/components/landing/scroll-fx"

// ─── Page data ──────────────────────────────────────────────────────────

const stats = [
  { value: "$34B", label: "US airline disruption cost, annual" },
  { value: "74%",  label: "of delay minutes are weather-driven" },
  { value: "18h",  label: "average cascade after a hub closure" },
  { value: "<10ms", label: "CP-SAT solve on the 200-flight network" },
]

const steps = [
  {
    n: "01",
    t: "Trigger a disruption",
    d: "Pick one of 21 event types — weather closure to cyber incident — set severity and duration, or load a live FAA ground stop from the NAS feed.",
  },
  {
    n: "02",
    t: "The cascade propagates",
    d: "The rotation graph carries the delay through every downstream leg, two generations deep, and prices the damage in dollars and pax-minutes.",
  },
  {
    n: "03",
    t: "The solver returns four plans",
    d: "CP-SAT minimizes cost, passenger impact, next-day exposure, or carbon — each plan fully costed, with FAR 117 flags attached.",
  },
  {
    n: "04",
    t: "Inspect and apply",
    d: "Apply a plan to the live map, read its counterfactual rationale, and watch cancellations, delays, and tail swaps execute leg by leg.",
  },
]

// ─── Page ───────────────────────────────────────────────────────────────
// Section entrances are scroll-SCRUBBED via PanIn (pure functions of scroll
// position — they pan in from left/right and reverse on scroll back).

export default function LandingPage() {
  return (
    <main
      style={{
        background: "var(--ae-bg)",
        minHeight: "100vh",
        overflowX: "hidden",
        fontFamily: ff.body,
        color: c.body,
      }}
    >
      <LandingNav />

      {/* The scroll-driven aircraft — flies the page down and back up */}
      <ScrollPlane />

      <HeroSection />

      {/* ── Stats — one ruled band, four plain numbers ── */}
      <section style={{ borderTop: `1px solid ${c.hairline}`, borderBottom: `1px solid ${c.hairline}` }}>
        <Container maxWidth={1200}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            {stats.map((s, i) => (
              <PanIn
                key={s.label}
                from={i % 2 === 0 ? "left" : "right"}
                dist={70 + i * 14}
                style={{
                  padding: "44px 32px 44px 0",
                  borderLeft: i > 0 ? `1px solid ${c.hairline}` : "none",
                  paddingLeft: i > 0 ? 32 : 0,
                }}
              >
                <div
                  style={{
                    fontFamily: ff.display,
                    fontWeight: 600,
                    fontSize: "clamp(36px, 3.6vw, 52px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.02em",
                    color: c.ink,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: c.muted, marginTop: 10, maxWidth: 210 }}>
                  {s.label}
                </div>
              </PanIn>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Capabilities — two anchors + quiet text grid ── */}
      <section style={{ paddingTop: 112, paddingBottom: 112 }}>
        <Container maxWidth={1200}>
          <SystemCapabilities />
        </Container>
      </section>

      {/* ── How it works — one horizontal timeline, no boxes ── */}
      <section style={{ paddingTop: 96, paddingBottom: 112, background: "var(--ae-surface)", borderTop: `1px solid ${c.hairline}`, borderBottom: `1px solid ${c.hairline}` }}>
        <Container maxWidth={1200}>
          <PanIn from="right" dist={100} style={{ marginBottom: 56, maxWidth: 560 }}>
            <Eyebrow>How it works</Eyebrow>
            <h2
              style={{
                fontFamily: ff.display,
                fontSize: "clamp(26px, 3vw, 34px)",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                lineHeight: 1.15,
                color: c.ink,
                marginTop: 14,
              }}
            >
              One event in, one decision out.
            </h2>
          </PanIn>

          <div style={{ position: "relative" }}>
            {/* The timeline rule */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 5,
                left: 0,
                right: 0,
                height: 1,
                background: c.hairline,
              }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 40,
              }}
            >
              {steps.map((step, i) => (
                <PanIn
                  key={step.n}
                  from={i % 2 === 0 ? "left" : "right"}
                  dist={60 + i * 18}
                  style={{ position: "relative", paddingTop: 28 }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: i === 0 ? "var(--ae-teal)" : "var(--ae-surface)",
                      border: i === 0 ? "1px solid var(--ae-teal)" : `1px solid ${c.borderStrong}`,
                    }}
                  />
                  <div style={{ fontFamily: ff.mono, fontSize: 11, color: c.muted, marginBottom: 10 }}>{step.n}</div>
                  <h3 style={{ fontFamily: ff.body, fontSize: 15.5, fontWeight: 550, color: c.ink, marginBottom: 8 }}>
                    {step.t}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: c.muted }}>{step.d}</p>
                </PanIn>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Final CTA — full-bleed ink band ── */}
      <section style={{ background: "#0F1412", paddingTop: 104, paddingBottom: 104 }}>
        <Container maxWidth={1200}>
          <PanIn from="left" dist={120} style={{ maxWidth: 640 }}>
            <h2
              style={{
                fontFamily: ff.display,
                fontSize: "clamp(32px, 4vw, 44px)",
                fontWeight: 600,
                letterSpacing: "-0.018em",
                lineHeight: 1.08,
                color: "#ECEEE9",
                marginBottom: 18,
              }}
            >
              Trigger your first disruption.
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "rgba(236,238,233,0.6)", marginBottom: 36, maxWidth: 520 }}>
              The full Nimbus Air network loads in the browser. Close O&apos;Hare
              for four hours, watch 23 flights cascade, and compare four ways out.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <Link href="/simulator" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 44,
                    padding: "0 24px",
                    borderRadius: 10,
                    background: "var(--ae-teal)",
                    color: "#0F1412",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: ff.body,
                    fontSize: 14,
                    fontWeight: 550,
                  }}
                >
                  Open the simulator <ArrowRight style={{ width: 15, height: 15 }} />
                </button>
              </Link>
              <Link href="/scenarios" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 44,
                    padding: "0 24px",
                    borderRadius: 10,
                    background: "transparent",
                    color: "#ECEEE9",
                    border: "1px solid rgba(236,238,233,0.25)",
                    cursor: "pointer",
                    fontFamily: ff.body,
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Browse scenarios
                </button>
              </Link>
            </div>
            <div style={{ marginTop: 40, fontFamily: ff.mono, fontSize: 11.5, color: "rgba(236,238,233,0.4)" }}>
              FastAPI + Next.js · OR-Tools CP-SAT · open data: DOT BTS, FAA NAS, NWS
            </div>
          </PanIn>
        </Container>
      </section>

      <LandingFooter />
    </main>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 62,
        padding: "0 32px",
        background: "rgba(245,245,240,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${c.hairline}`,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <AeolusLogo size={28} />
        <span
          style={{
            fontFamily: ff.display,
            fontWeight: 600,
            fontSize: 17,
            color: c.ink,
            letterSpacing: "-0.01em",
          }}
        >
          Aeolus
        </span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[
          { href: "/scenarios", label: "Scenarios" },
          { href: "/docs", label: "Methodology" },
          { href: "/simulator", label: "Simulator" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href as Route}
            style={{
              padding: "8px 14px",
              fontFamily: ff.body,
              fontSize: 14,
              fontWeight: 450,
              color: c.body,
              textDecoration: "none",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <Link href="/simulator" style={{ textDecoration: "none" }}>
        <ButtonPrimary size="sm" trailingIcon={<ArrowRight style={{ width: 13, height: 13 }} />}>
          Launch simulator
        </ButtonPrimary>
      </Link>
    </nav>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer
      style={{
        background: "#0F1412",
        borderTop: "1px solid rgba(236,238,233,0.08)",
        color: "rgba(236,238,233,0.55)",
        padding: "56px 32px 32px",
      }}
    >
      <Container maxWidth={1200} style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <AeolusLogo size={28} />
              <div>
                <div style={{ fontFamily: ff.display, fontWeight: 550, fontSize: 15, color: "#ECEEE9", letterSpacing: "-0.01em" }}>
                  Aeolus
                </div>
                <div style={{ fontSize: 12, color: "rgba(236,238,233,0.4)", marginTop: 2 }}>
                  Open-source OCC reference
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 380 }}>
              Built with FastAPI, Next.js, OR-Tools, and Leaflet on open data —
              DOT BTS, FAA NAS status, NWS alerts.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 550, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(236,238,233,0.35)" }}>
              Product
            </span>
            {[
              { href: "/simulator", label: "Simulator" },
              { href: "/simulator/plans", label: "Recovery plans" },
              { href: "/simulator/carbon", label: "Carbon dashboard" },
              { href: "/simulator/stress-test", label: "Stress test" },
            ].map((l) => (
              <Link key={l.href} href={l.href as Route} style={{ fontSize: 13, color: "rgba(236,238,233,0.6)", textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 550, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(236,238,233,0.35)" }}>
              Reference
            </span>
            <Link href="/scenarios" style={{ fontSize: 13, color: "rgba(236,238,233,0.6)", textDecoration: "none" }}>Scenarios</Link>
            <Link href="/docs" style={{ fontSize: 13, color: "rgba(236,238,233,0.6)", textDecoration: "none" }}>Methodology</Link>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: "1px solid rgba(236,238,233,0.08)",
            fontSize: 12,
            color: "rgba(236,238,233,0.35)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span>Aeolus is a research artifact, not production OCC software.</span>
          <span style={{ fontFamily: ff.mono }}>v0.3.0 · Apache 2.0</span>
        </div>
      </Container>
    </footer>
  )
}
