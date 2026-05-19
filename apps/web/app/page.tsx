"use client"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Plane, Zap, BarChart3, Shield, ArrowRight, Leaf,
  CloudLightning, Sparkles, AlertTriangle, Network,
} from "lucide-react"
import { c, ff, r, sp, sh, type as typeStyle } from "@/lib/design-tokens"
import {
  ButtonPrimary, ButtonSecondary, SignatureCard, CreamCallout,
  ContentCard, Container, Section, Type, Eyebrow, Hairline, Stat,
} from "@/components/ds/primitives"

// ─── Hero map — repainted on the editorial palette ───────────────────────
//
// Dark forest signature surface (was the teal gradient). Coral hot-marker for
// the disrupted airport, mustard pulse for active rotation, mint for the
// stable airports. Teal is *not* used as the wallpaper anymore; it appears
// only as a small "live" pill below.

function HeroMap() {
  const airports = [
    { x: 150, y: 80,  code: "ORD", hot: true  },
    { x: 450, y: 215, code: "ATL", hot: false },
    { x: 300, y: 155, code: "DFW", hot: false },
    { x: 530, y: 115, code: "JFK", hot: false },
    { x: 240, y: 120, code: "DEN", hot: false },
    { x: 530, y: 255, code: "LAX", hot: false },
  ]
  // Cascade lines use the semantic palette, not arbitrary brand colors:
  // coral = direct hit, mustard = order-1 cascade, peach = order-2,
  // mint = stable (no impact yet).
  const lines = [
    { d: "M150,80 Q300,30 450,215",   color: c.cascadeDirect, delay: 0.4 },
    { d: "M300,155 Q400,110 530,115", color: c.cascadeOrder1, delay: 0.9 },
    { d: "M240,120 Q390,70 530,115",  color: c.signaturePeach, delay: 1.3 },
    { d: "M150,80 Q210,140 300,155",  color: c.signatureMint,  delay: 1.7 },
  ]

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 420,
        borderRadius: r.lg,
        overflow: "hidden",
        background: c.surfaceDark,           // near-black ink wash
        border: `1px solid ${c.surfaceDarkElevated}`,
      }}
    >
      {/* Soft grid */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.08 }}>
        <defs>
          <pattern id="hg" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0L0 0 0 44" fill="none" stroke="white" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hg)" />
      </svg>

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 640 340"
        preserveAspectRatio="xMidYMid meet"
      >
        {lines.map((l, i) => (
          <motion.path
            key={i}
            initial={false}
            d={l.d}
            stroke={l.color}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="7 5"
            animate={{ pathLength: 1, opacity: 0.92 }}
            transition={{ duration: 2.2, delay: l.delay }}
          />
        ))}

        {airports.map((ap, idx) => (
          <g key={ap.code}>
            <motion.circle
              cx={ap.x} cy={ap.y} r="5"
              initial={false}
              fill={ap.hot ? c.cascadeDirect : c.signatureMint}
              stroke="rgba(255,255,255,0.20)"
              strokeWidth="1.5"
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 + idx * 0.1 }}
            />
            <motion.circle
              cx={ap.x} cy={ap.y} r={ap.hot ? 14 : 10}
              initial={false}
              fill="none"
              stroke={ap.hot ? c.cascadeDirect : "rgba(255,255,255,0.30)"}
              strokeWidth="1"
              animate={{
                r: ap.hot ? [12, 22, 12] : [9, 15, 9],
                opacity: [0.55, 0.05, 0.55],
              }}
              transition={{ duration: 2.5, repeat: Infinity, delay: idx * 0.35 }}
            />
            <text
              x={ap.x + 10} y={ap.y + 4}
              fill="rgba(255,255,255,0.80)"
              fontSize="9"
              fontFamily={ff.mono}
              fontWeight="600"
            >
              {ap.code}
            </text>
          </g>
        ))}

        <motion.circle
          cx={150} cy={80} r="18"
          fill="none" stroke={c.cascadeDirect} strokeWidth="2.5"
          initial={{ scale: 1, opacity: 0.85 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 2.2, repeat: Infinity, delay: 2 }}
        />
      </svg>

      {/* Disruption alert — coral surface (cancelled palette) */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5, duration: 0.5 }}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: r.pill,
          background: "rgba(170,45,0,0.18)",
          border: `1px solid rgba(170,45,0,0.50)`,
          backdropFilter: "blur(8px)",
        }}
      >
        <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, color: "#FBC2A7" }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "#FBC2A7", fontFamily: ff.body, letterSpacing: "0.04em" }}>
          ORD thunderstorm — 47 flights cascading
        </span>
      </motion.div>

      {/* Live indicator — teal as secondary brand voltage */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          borderRadius: r.pill,
          background: "rgba(13,148,136,0.18)",
          border: "1px solid rgba(13,148,136,0.40)",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: r.full, background: "#5EEAD4" }} className="animate-pulse" />
        <span style={{ fontSize: 11, fontWeight: 500, color: "#9DECE5", letterSpacing: "0.04em" }}>
          Live simulation
        </span>
      </div>

      {/* Recovery plans badge — mint (recovered palette) */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3, duration: 0.5 }}
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          padding: "10px 14px",
          borderRadius: r.md,
          background: "rgba(168,216,196,0.18)",
          border: "1px solid rgba(168,216,196,0.45)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 500, color: "#C9EEDB", letterSpacing: "0.04em" }}>
          3 recovery plans ready
        </div>
        <div style={{ fontSize: 10, marginTop: 2, color: "rgba(201,238,219,0.65)", fontFamily: ff.mono }}>
          Solved in &lt;10ms · CP-SAT MILP
        </div>
      </motion.div>

      {/* Status pills — semantic palette */}
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.5 }}
        style={{ position: "absolute", bottom: 16, left: 16, display: "flex", gap: 8 }}
      >
        {[
          { label: "153 on time",  ink: "#C9EEDB", bg: "rgba(168,216,196,0.16)", bdr: "rgba(168,216,196,0.40)" },
          { label: "31 delayed",   ink: "#FCD9B6", bg: "rgba(252,171,121,0.18)", bdr: "rgba(252,171,121,0.40)" },
          { label: "16 cancelled", ink: "#FBC2A7", bg: "rgba(170,45,0,0.20)",    bdr: "rgba(170,45,0,0.45)" },
        ].map((p) => (
          <span
            key={p.label}
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "5px 10px",
              borderRadius: r.pill,
              background: p.bg,
              border: `1px solid ${p.bdr}`,
              color: p.ink,
              fontFamily: ff.body,
              letterSpacing: "0.02em",
            }}
          >
            {p.label}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Page data ──────────────────────────────────────────────────────────

const stats = [
  { value: "$34B",   label: "Annual disruption cost (US)", color: c.signatureCoral },
  { value: "74%",    label: "Weather-caused delays",       color: c.signatureMustard },
  { value: "18h",    label: "Avg cascade duration",        color: c.link },
  { value: "<10ms",  label: "Recovery plan solve time",    color: c.statusOnTime.ink },
]

// Features re-grouped into the five system pillars. Each gets one of the
// five Airtable signature tones — same palette as event-panel categories.
const features = [
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

      {/* ── Hero ──
          White canvas + signature dark card on the right (the editorial
          pricing-page pattern). No more teal gradient wallpaper. */}
      <section style={{ paddingTop: 96, paddingBottom: 64, position: "relative" }}>
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 64,
              alignItems: "center",
            }}
            className="hero-grid"
          >
            <div>
              <motion.div
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: sp.lg,
                  padding: "6px 14px",
                  borderRadius: r.pill,
                  background: c.surfaceSoft,
                  border: `1px solid ${c.hairline}`,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: r.full, background: c.statusOnTime.dot }} className="animate-pulse" />
                <Eyebrow>Nimbus Air · 40 aircraft · 200 daily flights</Eyebrow>
              </motion.div>

              <motion.h1
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.68, delay: 0.08 }}
                style={{
                  fontFamily: ff.display,
                  fontWeight: 400,
                  fontSize: "clamp(40px, 6vw, 72px)",
                  lineHeight: 1.06,
                  letterSpacing: "-0.01em",
                  color: c.ink,
                  marginBottom: sp.md,
                }}
              >
                When weather hits,<br />
                <span style={{ color: c.signatureCoral }}>flights cascade.</span><br />
                <span style={{ color: c.muted }}>Aeolus recovers.</span>
              </motion.h1>

              <motion.p
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.22 }}
                style={{
                  ...typeStyle("titleMd", c.body),
                  fontSize: 17,
                  marginBottom: sp.lg,
                  maxWidth: 540,
                  lineHeight: 1.55,
                }}
              >
                Open-source Operations Control Center. Trigger real-world disruptions
                against a synthetic US airline network and receive four ranked recovery
                plans — with carbon accounting and counterfactual rationale — in milliseconds.
              </motion.p>

              <motion.div
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.35 }}
                style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
              >
                <Link href="/simulator" style={{ textDecoration: "none" }}>
                  <ButtonPrimary trailingIcon={<ArrowRight style={{ width: 16, height: 16 }} />}>
                    Launch simulator
                  </ButtonPrimary>
                </Link>
                <Link href="/docs" style={{ textDecoration: "none" }}>
                  <ButtonSecondary>Read methodology</ButtonSecondary>
                </Link>
              </motion.div>

              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.52 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  marginTop: sp.lg,
                  flexWrap: "wrap",
                }}
              >
                <Stat label="Annual cost"    value="$34B"  hint="US disruption losses" />
                <span style={{ width: 1, height: 36, background: c.hairline }} />
                <Stat label="Solve time"     value="<10ms" hint="CP-SAT MILP" />
                <span style={{ width: 1, height: 36, background: c.hairline }} />
                <Stat label="Plans/event"    value="4"     hint="Cost · Pax · Future · Carbon" />
              </motion.div>
            </div>

            <motion.div
              initial={false}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.28 }}
            >
              <HeroMap />
            </motion.div>
          </div>
        </Container>
      </section>

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

      {/* ── Features — six pillars on canvas content cards ── */}
      <Section background={c.canvas} style={{ paddingTop: 96, paddingBottom: 96 }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55 }}
            style={{ textAlign: "center", marginBottom: 64 }}
          >
            <Eyebrow color={c.muted}>System Capabilities</Eyebrow>
            <h2
              style={{
                ...typeStyle("displayMd", c.ink),
                marginTop: 12,
                marginBottom: 16,
              }}
            >
              Built like a real OCC.
            </h2>
            <p style={{ ...typeStyle("titleMd", c.muted), maxWidth: 620, margin: "0 auto", fontSize: 16 }}>
              Every component reflects how carriers approach disruption recovery — transparent, inspectable logic from first principles. No black-box AI advice.
            </p>
          </motion.div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: sp.md,
            }}
          >
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: (i % 3) * 0.06 }}
              >
                <ContentCard
                  padding={sp.lg}
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: sp.sm,
                    borderLeft: `4px solid ${f.tone.accent}`,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: r.md,
                      background: f.tone.surface,
                      color: f.tone.ink,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <f.Icon style={{ width: 20, height: 20 }} />
                  </div>
                  <h3 style={{ ...typeStyle("titleSm", c.ink), marginTop: 4 }}>{f.title}</h3>
                  <p style={{ ...typeStyle("bodyMd", c.muted), lineHeight: 1.55 }}>{f.desc}</p>
                </ContentCard>
              </motion.div>
            ))}
          </div>
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
                Three new capabilities that legacy recovery systems don't have: carbon-aware
                Plan&nbsp;D under EU ETS pricing, a glass-box "Why this plan?" explainer that
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
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: r.sm,
            background: c.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plane style={{ width: 15, height: 15, color: c.onPrimary }} />
        </div>
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
            href={l.href}
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
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: r.sm,
                  background: "#0D9488",   // teal as secondary brand voltage
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plane style={{ width: 14, height: 14, color: c.onPrimary }} />
              </div>
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
              <Link key={l.href} href={l.href} style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
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
