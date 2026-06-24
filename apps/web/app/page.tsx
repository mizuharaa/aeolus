"use client"
import { motion } from "framer-motion"
import Link from "next/link"
import type { Route } from "next"
import {
  Zap, BarChart3, Shield, ArrowRight, Leaf,
  CloudLightning, Sparkles, Network,
} from "lucide-react"
import { AeolusLogo } from "@/components/ds/logo"
import { c, ff, r, sp, sh, type as typeStyle } from "@/lib/design-tokens"
import {
  ButtonPrimary, ButtonSecondary, SignatureCard, CreamCallout,
  ContentCard, Container, Section, Type, Eyebrow, Hairline, Stat,
} from "@/components/ds/primitives"
import { SystemCapabilities } from "@/components/landing/capabilities"
import { HeroSection } from "@/components/landing/hero-section"

// ─── Page data ──────────────────────────────────────────────────────────

const stats = [
  { value: "$34B",   label: "Annual disruption cost (US)", color: c.signatureCoral },
  { value: "74%",    label: "Weather-caused delays",       color: c.signatureMustard },
  { value: "18h",    label: "Avg cascade duration",        color: c.link },
  { value: "<10ms",  label: "Recovery plan solve time",    color: c.statusOnTime.ink },
]

// (System Capabilities now lives in components/landing/capabilities.tsx —
// bespoke product fragments instead of the old uniform Lucide grid.)
const _features_legacy_removed = [
  {
    Icon: CloudLightning,
    title: "21 disruption event types",
    desc: "Weather closures, mechanical AOG, crew sickouts, airspace closures, cyber incidents — every disruption with realistic cascade propagation through aircraft rotations.",
    tone: { surface: c.statusOnTime.bg, accent: c.signatureForest, ink: c.statusOnTime.ink },
  },
  {
    Icon: Zap,
    title: "CP-SAT recovery optimizer",
    desc: "Plans A through D — minimize cost, minimize pax impact, protect tomorrow, and now Plan D (Green Recovery) with full carbon accounting under EU ETS.",
    tone: { surface: c.statusDelayed.bg, accent: c.signatureMustard, ink: "#5C3D0F" },
  },
  {
    Icon: Shield,
    title: "FAR Part 117 crew legality",
    desc: "Duty-time checks surface violation counts on every plan so you can compare regulatory tradeoffs before committing to a recovery strategy.",
    tone: { surface: c.statusCancelled.bg, accent: c.signatureCoral, ink: c.statusCancelled.ink },
  },
  {
    Icon: BarChart3,
    title: "Deterministic cascade predictor",
    desc: "Rotation-graph propagation built from the schedule itself \u2014 no ML model, no training data. Same inputs always produce the same forecast, so every plan is fully reproducible.",
    tone: { surface: c.surfaceSoft, accent: c.link, ink: c.link },
  },
  {
    Icon: Leaf,
    title: "Carbon-aware recovery",
    desc: "EU ETS-priced CO₂ as a fourth optimizer objective. Plan D minimizes emissions; every plan card shows tons of CO₂ alongside dollars.",
    tone: { surface: c.statusRecovered.bg, accent: c.signatureMint, ink: c.statusRecovered.ink },
  },
  {
    Icon: Network,
    title: "Network vulnerability stress test",
    desc: "Run Monte Carlo disruptions against the schedule and surface the most fragile rotations, airports, and crew bases. Chaos engineering for airline ops.",
    tone: { surface: c.signatureCream, accent: c.signatureForest, ink: c.statusOnTime.ink },
  },
]

const steps = [
  { n: "01", t: "Trigger Event",     d: "Pick disruption type, airport or tail number, severity, and duration from the real-world event library." },
  { n: "02", t: "Cascade Computed",  d: "The predictor propagates delays through aircraft rotations, surfacing every downstream effect in real time." },
  { n: "03", t: "Plans Generated",   d: "The optimizer assembles four differentiated strategies, each with full cost decomposition and FAR 117 flags." },
  { n: "04", t: "Why & What-If",     d: "Inspect each plan's counterfactual rationale: what changes if you flip a single decision? Glass-box advisor, not a black box." },
]

// ─── Page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main style={{ background: c.canvas, minHeight: "100vh", overflowX: "hidden", fontFamily: ff.body, color: c.body }}>
      <LandingNav />

      <HeroSection />

      <Hairline />

      {/* ── Stats ── */}
      <Section background={c.canvas} style={{ paddingTop: 64, paddingBottom: 64 }}>
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: sp.xl,
            }}
          >
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                style={{ textAlign: "center" }}
              >
                <div
                  style={{
                    fontFamily: ff.display,
                    fontWeight: 400,
                    fontSize: "clamp(36px, 4vw, 56px)",
                    lineHeight: 1.05,
                    color: s.color,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ ...typeStyle("caption", c.muted), marginTop: 8 }}>
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      <Hairline />

      {/* ── System Capabilities — bespoke product fragments, no Lucide grid ──
          See components/landing/capabilities.tsx. Each card carries an actual
          SVG fragment of the system (rotation graph, optimizer objective,
          duty timeline, cost stack, carbon ledger, MC heatmap) — per the
          Airtable demo-grid "uneven heights + photography-as-depth" rule. */}
      <Section background={c.canvas} style={{ paddingTop: 96, paddingBottom: 96 }}>
        <Container>
          <SystemCapabilities />
        </Container>
      </Section>

      <Hairline />

      {/* ── How it works — cream callout strip ── */}
      <Section background={c.surfaceSoft} style={{ paddingTop: 96, paddingBottom: 96 }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55 }}
            style={{ textAlign: "center", marginBottom: 64 }}
          >
            <Eyebrow color={c.muted}>How It Works</Eyebrow>
            <h2 style={{ ...typeStyle("displayMd", c.ink), marginTop: 12 }}>
              From disruption to recovery in seconds.
            </h2>
          </motion.div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: sp.md,
            }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
              >
                <ContentCard
                  padding={sp.lg}
                  style={{
                    height: "100%",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      right: -8,
                      fontFamily: ff.display,
                      fontWeight: 400,
                      fontSize: 96,
                      color: c.surfaceStrong,
                      lineHeight: 1,
                      opacity: 0.5,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {step.n}
                  </div>
                  <div style={{ position: "relative" }}>
                    <Eyebrow color={c.muted}>Step {step.n}</Eyebrow>
                    <h3 style={{ ...typeStyle("titleSm", c.ink), marginTop: 8, marginBottom: 8 }}>
                      {step.t}
                    </h3>
                    <p style={{ ...typeStyle("bodyMd", c.muted), lineHeight: 1.55 }}>
                      {step.d}
                    </p>
                  </div>
                </ContentCard>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── New capabilities band — signature forest card with cream callout ── */}
      <Section background={c.canvas} style={{ paddingTop: 96, paddingBottom: 96 }}>
        <Container>
          <SignatureCard variant="forest" padding={sp.xxl} style={{ marginBottom: sp.xl }}>
            <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: sp.sm }}>
              <Eyebrow color="rgba(255,255,255,0.65)">New in this release</Eyebrow>
              <h2
                style={{
                  ...typeStyle("displayMd", c.onPrimary),
                  fontFamily: ff.display,
                }}
              >
                Carbon, counterfactuals, and chaos engineering.
              </h2>
              <p
                style={{
                  ...typeStyle("titleMd", "rgba(255,255,255,0.78)"),
                  fontSize: 16,
                  lineHeight: 1.55,
                }}
              >
                Three new capabilities that legacy recovery systems don&apos;t have: carbon-aware
                Plan&nbsp;D under EU ETS pricing, a glass-box &ldquo;Why this plan?&rdquo; explainer that
                re-runs the optimizer with one decision flipped, and a Monte Carlo network
                vulnerability stress test that surfaces your most fragile rotations before
                weather finds them.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                <Link href="/simulator/carbon" style={{ textDecoration: "none" }}>
                  <button
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      height: 40,
                      padding: "0 18px",
                      borderRadius: r.lg,
                      background: c.canvas,
                      color: c.ink,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: ff.body,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    <Leaf style={{ width: 14, height: 14 }} /> Carbon dashboard
                  </button>
                </Link>
                <Link href="/simulator/stress-test" style={{ textDecoration: "none" }}>
                  <button
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      height: 40,
                      padding: "0 18px",
                      borderRadius: r.lg,
                      background: "transparent",
                      color: c.onPrimary,
                      border: "1px solid rgba(255,255,255,0.35)",
                      cursor: "pointer",
                      fontFamily: ff.body,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    <Network style={{ width: 14, height: 14 }} /> Run stress test
                  </button>
                </Link>
              </div>
            </div>
          </SignatureCard>

          <CreamCallout
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: sp.lg,
              alignItems: "center",
            }}
          >
            <div>
              <Eyebrow color={c.statusOnTime.ink}>Glass-box advisor</Eyebrow>
              <Type as="p" role="bodyMd" color={c.body} style={{ marginTop: 6, lineHeight: 1.55 }}>
                Every recovery plan is inspectable: counterfactual rationale, full cost
                decomposition, FAR 117 flags, carbon ledger. No black-box AI.
              </Type>
            </div>
            <div>
              <Stat label="Plans" value="A · B · C · D" hint="Cost · Pax · Future · Carbon" />
            </div>
            <div>
              <Stat label="Counterfactuals" value="∀ flight" hint="Re-run with one flip" color={c.signatureCoral} />
            </div>
          </CreamCallout>
        </Container>
      </Section>

      {/* ── Final CTA — dark surface card, near-black ── */}
      <Section background={c.canvas} style={{ paddingTop: 96, paddingBottom: 96 }}>
        <Container>
          <SignatureCard
            variant="dark"
            padding={sp.xxl}
            style={{
              textAlign: "center",
              maxWidth: 880,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: sp.md,
                padding: "5px 14px",
                borderRadius: r.pill,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <Sparkles style={{ width: 14, height: 14, color: c.signatureMustard }} />
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.78)" }}>
                Try it now — no setup required
              </span>
            </div>

            <h2
              style={{
                ...typeStyle("displayLg", c.onPrimary),
                fontFamily: ff.display,
                marginBottom: sp.md,
              }}
            >
              Trigger your first<br />disruption.
            </h2>

            <p
              style={{
                ...typeStyle("titleMd", "rgba(255,255,255,0.66)"),
                fontSize: 16,
                marginBottom: sp.lg,
                maxWidth: 560,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.55,
              }}
            >
              One click. Watch flights cascade on the live US map. Compare four recovery plans.
              Inspect FAR 117 flags, cost decomposition, and CO₂ ledgers in real time.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <Link href="/simulator" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 48,
                    padding: "0 22px",
                    borderRadius: r.lg,
                    background: c.canvas,
                    color: c.ink,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: ff.body,
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  Open the simulator <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              </Link>
              <Link href="/scenarios" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 48,
                    padding: "0 22px",
                    borderRadius: r.lg,
                    background: "transparent",
                    color: c.onPrimary,
                    border: "1px solid rgba(255,255,255,0.35)",
                    cursor: "pointer",
                    fontFamily: ff.body,
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  Browse scenarios
                </button>
              </Link>
            </div>
          </SignatureCard>
        </Container>
      </Section>

      <LandingFooter />
    </main>
  )
}

// ─── Nav (white canvas, near-black ink, hairline) ───────────────────────

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
        height: 64,
        padding: "0 32px",
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${c.hairline}`,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <AeolusLogo size={32} />
        <span
          style={{
            fontFamily: ff.display,
            fontWeight: 500,
            fontSize: 18,
            color: c.ink,
            letterSpacing: "-0.01em",
          }}
        >
          Aeolus
        </span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {[
          { href: "/scenarios", label: "Scenarios" },
          { href: "/docs",      label: "Methodology" },
          { href: "/simulator", label: "Simulator" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href as Route}
            style={{
              padding: "8px 14px",
              borderRadius: r.sm,
              fontFamily: ff.body,
              fontSize: 14,
              fontWeight: 400,
              color: c.body,
              textDecoration: "none",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <Link href="/simulator" style={{ textDecoration: "none" }}>
        <ButtonPrimary size="sm" trailingIcon={<ArrowRight style={{ width: 14, height: 14 }} />}>
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
        background: c.surfaceDark,
        color: "rgba(255,255,255,0.55)",
        padding: "64px 32px 32px",
      }}
    >
      <Container style={{ paddingLeft: 0, paddingRight: 0 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AeolusLogo size={32} />
              <div>
                <div style={{ fontFamily: ff.display, fontWeight: 500, fontSize: 16, color: c.onPrimary, letterSpacing: "-0.01em" }}>
                  Aeolus
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                  Open-source OCC reference
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 380 }}>
              Built with FastAPI · Next.js · OR-Tools · Leaflet · Zustand. Open data — DOT BTS,
              FAA NAS, NWS NOAA. No proprietary lock-in.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Eyebrow color="rgba(255,255,255,0.45)">Product</Eyebrow>
            {[
              { href: "/simulator",            label: "Simulator" },
              { href: "/simulator/plans",      label: "Recovery plans" },
              { href: "/simulator/carbon",     label: "Carbon dashboard" },
              { href: "/simulator/stress-test", label: "Stress test" },
            ].map((l) => (
              <Link key={l.href} href={l.href as Route} style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Eyebrow color="rgba(255,255,255,0.45)">Reference</Eyebrow>
            <Link href="/scenarios" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>Scenarios</Link>
            <Link href="/docs" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>Methodology</Link>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12,
            color: "rgba(255,255,255,0.35)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span>Aeolus is a research artifact. Not a substitute for production OCC software.</span>
          <span style={{ fontFamily: ff.mono }}>v0.2.0 · Apache 2.0</span>
        </div>
      </Container>
    </footer>
  )
}
