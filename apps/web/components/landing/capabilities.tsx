"use client"
/**
 * System Capabilities — bespoke product-fragment cards.
 *
 * Replaces the previous 6-card uniform grid (generic Lucide icons on pastel
 * chips). Each capability now ships its own hand-built SVG fragment showing
 * an actual artifact from the system — a rotation graph, the optimizer's
 * objective function, a FAR 117 duty timeline, the cost stack, a carbon
 * ledger row, a Monte-Carlo heatmap.
 *
 * Per DESIGN.md `demo-card-grid` rule: "Card sizes are deliberately uneven
 * within the grid to dodge a uniform 'spec sheet' feel. Photography-as-depth
 * via real product UI screenshots, not decorative effects."
 *
 * Grid: 12 cols. Row 1 = two 6-col heroes (cascade + optimizer).
 * Row 2 = four 3-col cards. Heights deliberately non-uniform.
 */
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { c, ff, r, sp, type as typeStyle } from "@/lib/design-tokens"
import { ContentCard, Eyebrow } from "@/components/ds/primitives"

// ── Shared card chrome ───────────────────────────────────────────────────────

function CapabilityCard({
  span,
  surface = c.canvas,
  inkOnDark = false,
  children,
  index = 0,
  height,
}: {
  span: number
  surface?: string
  inkOnDark?: boolean
  children: React.ReactNode
  index?: number
  height?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.06 }}
      style={{ gridColumn: `span ${span} / span ${span}` }}
    >
      <ContentCard
        padding={0}
        style={{
          background: surface,
          color: inkOnDark ? c.onPrimary : c.ink,
          height: height ?? "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: surface === c.canvas ? `1px solid ${c.hairline}` : "none",
        }}
      >
        {children}
      </ContentCard>
    </motion.div>
  )
}

// ── Card 1: Cascade Predictor — rotation-graph fragment ─────────────────────

function CascadeCard({ index }: { index: number }) {
  return (
    <CapabilityCard span={7} index={index} height={340}>
      <div style={{ padding: sp.lg, flex: "0 0 auto" }}>
        <Eyebrow color={c.signatureCoral}>Cascade Predictor</Eyebrow>
        <h3 style={{ ...typeStyle("titleLg", c.ink), marginTop: 8, fontSize: 22 }}>
          Rotation physics, not a black-box model.
        </h3>
        <p style={{ ...typeStyle("bodyMd", c.muted), marginTop: 6, fontSize: 13.5 }}>
          Delays propagate through aircraft rotations the way they actually do — buffer-aware, deterministic, reproducible.
        </p>
      </div>

      {/* SVG rotation fragment */}
      <div style={{ flex: 1, position: "relative", padding: `0 ${sp.lg}px ${sp.lg}px` }}>
        <svg viewBox="0 0 540 160" style={{ width: "100%", height: "100%" }}>
          {/* Connecting arc — direct hit */}
          <path d="M 70 60 Q 180 30 290 60" fill="none" stroke={c.signatureCoral} strokeWidth="1.6" strokeDasharray="4 3" />
          {/* Connecting arc — cascade order 1 */}
          <path d="M 290 60 Q 380 90 470 60" fill="none" stroke={c.signatureMustard} strokeWidth="1.4" strokeDasharray="4 3" />
          {/* Buffer band beneath the arrows */}
          <rect x="58" y="110" width="430" height="22" rx="4" fill={c.surfaceSoft} stroke={c.hairline} />
          <line x1="190" y1="110" x2="190" y2="132" stroke={c.hairline} />
          <line x1="375" y1="110" x2="375" y2="132" stroke={c.hairline} />
          <text x="125" y="126" fontSize="10" fontFamily={ff.mono} fill={c.muted}>buffer 30m</text>
          <text x="280" y="126" fontSize="10" fontFamily={ff.mono} fill={c.muted}>residual +181m</text>
          <text x="412" y="126" fontSize="10" fontFamily={ff.mono} fill={c.muted}>cascade +161m</text>

          {/* Flight nodes */}
          <FlightNode x={70} y={60} code="DEN→ORD" tag="DIRECT" tagColor={c.signatureCoral} delay="+211m" />
          <FlightNode x={290} y={60} code="ORD→LAX" tag="ORDER 1" tagColor={c.signatureMustard} delay="+181m" />
          <FlightNode x={470} y={60} code="LAX→SEA" tag="ORDER 2" tagColor={c.signatureYellow} delay="+161m" />
        </svg>
      </div>
    </CapabilityCard>
  )
}

function FlightNode({ x, y, code, tag, tagColor, delay }: { x: number; y: number; code: string; tag: string; tagColor: string; delay: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill={tagColor} />
      <circle cx={x} cy={y} r="11" fill="none" stroke={tagColor} strokeOpacity="0.35" />
      <text x={x} y={y - 22} fontSize="10.5" fontFamily={ff.body} fontWeight="500" fill={c.ink} textAnchor="middle">{code}</text>
      <text x={x} y={y - 8} fontSize="8" fontFamily={ff.body} fontWeight="600" fill={tagColor} textAnchor="middle" letterSpacing="0.08em">{tag}</text>
      <text x={x} y={y + 22} fontSize="11" fontFamily={ff.mono} fontWeight="600" fill={c.signatureCoral} textAnchor="middle">{delay}</text>
    </g>
  )
}

// ── Card 2: CP-SAT Optimizer — objective function as code ───────────────────

function OptimizerCard({ index }: { index: number }) {
  return (
    <CapabilityCard span={5} surface={c.surfaceDark} inkOnDark index={index} height={340}>
      <div style={{ padding: sp.lg, flex: "0 0 auto" }}>
        <Eyebrow color={c.signaturePeach}>CP-SAT Optimizer</Eyebrow>
        <h3 style={{ ...typeStyle("titleLg", c.onPrimary), marginTop: 8, fontSize: 22 }}>
          Four plans, one solver.
        </h3>
        <p style={{ ...typeStyle("bodyMd", "rgba(255,255,255,0.62)"), marginTop: 6, fontSize: 13 }}>
          Globally optimal under each objective — auditable, reproducible.
        </p>
      </div>

      {/* Code-tile fragment */}
      <div
        style={{
          flex: 1,
          margin: `0 ${sp.lg}px ${sp.lg}px`,
          padding: `12px 14px`,
          borderRadius: r.sm,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid rgba(255,255,255,0.08)`,
          fontFamily: ff.mono,
          fontSize: 11.5,
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.85)",
          overflow: "hidden",
        }}
      >
        <span style={{ color: c.signatureMint }}>minimize</span>{"  "}
        <span style={{ color: c.signaturePeach }}>α</span>·cancel<sub>f</sub> +{" "}
        <span style={{ color: c.signaturePeach }}>β</span>·delay<sub>f</sub><br />
        {"          "}+ <span style={{ color: c.signaturePeach }}>γ</span>·crew<sub>viol</sub> +{" "}
        <span style={{ color: c.signaturePeach }}>δ</span>·oop +{" "}
        <span style={{ color: c.signatureMint }}>ε</span>·co2<sub>kg</sub><br />
        <span style={{ color: c.signatureMint }}>s.t.</span>{"     "}Σ swap<sub>f,a</sub> ≤ 1{"  "}∀ f<br />
        {"          "}delay<sub>f</sub> ≤ 480<br />
        <span style={{ color: "rgba(255,255,255,0.45)" }}>{"# A: α=10  B: β=10  C: δ=10  D: ε=12"}</span>
      </div>
    </CapabilityCard>
  )
}

// ── Card 3: FAR 117 Crew Engine — duty-timeline fragment ────────────────────

function FAR117Card({ index }: { index: number }) {
  return (
    <CapabilityCard span={3} index={index} height={260}>
      <div style={{ padding: sp.md, flex: "0 0 auto" }}>
        <Eyebrow color={c.signatureForest}>FAR Part 117</Eyebrow>
        <h3 style={{ ...typeStyle("titleSm", c.ink), marginTop: 6 }}>Crew legality engine</h3>
      </div>

      <div style={{ flex: 1, padding: `0 ${sp.md}px ${sp.md}px`, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Duty-timeline rail */}
        <svg viewBox="0 0 240 80" style={{ width: "100%" }}>
          {/* Hours scale */}
          {[0, 4, 8, 12, 16, 20, 24].map((h) => (
            <g key={h}>
              <line x1={(h / 24) * 240} y1="42" x2={(h / 24) * 240} y2="48" stroke={c.hairline} />
              <text x={(h / 24) * 240} y="62" fontSize="8" fontFamily={ff.mono} fill={c.muted} textAnchor="middle">{String(h).padStart(2, "0")}</text>
            </g>
          ))}
          {/* FDP bar */}
          <rect x={(6 / 24) * 240} y="22" width={(14 / 24) * 240} height="14" rx="3" fill={c.statusOnTime.bg} stroke={c.signatureForest} />
          {/* WOCL hatched red overlay */}
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke={c.signatureCoral} strokeWidth="1.4" />
          </pattern>
          <rect x={(2 / 24) * 240} y="22" width={(4 / 24) * 240} height="14" rx="3" fill="url(#hatch)" opacity="0.55" />
          <rect x={(2 / 24) * 240} y="22" width={(4 / 24) * 240} height="14" rx="3" fill="none" stroke={c.signatureCoral} strokeOpacity="0.55" />
          {/* Now tick */}
          <line x1={(13 / 24) * 240} y1="14" x2={(13 / 24) * 240} y2="42" stroke={c.ink} strokeWidth="1.8" />
          <text x={(13 / 24) * 240} y="10" fontSize="8" fontFamily={ff.body} fontWeight="500" fill={c.ink} textAnchor="middle">NOW</text>
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ff.mono, fontSize: 11, color: c.muted, marginTop: 2 }}>
          <span>FDP 14h <span style={{ color: c.statusOnTime.ink }}>OK</span></span>
          <span>7-day 52h / 60h</span>
        </div>
      </div>
    </CapabilityCard>
  )
}

// ── Card 4: Cost Engine — DOT-sourced stack ──────────────────────────────────

function CostCard({ index }: { index: number }) {
  // Real DOT BTS 2023 rates encoded in the visual fragment.
  const stacks = [
    { label: "Cancel",   value: 103.7, color: c.signatureCoral },
    { label: "Delay",    value: 23.7,  color: c.signatureMustard },
    { label: "Reposit.", value: 8.0,   color: c.link },
    { label: "DOT 261",  value: 38.4,  color: c.statusDelayed.ink },
  ]
  const max = Math.max(...stacks.map((s) => s.value))
  return (
    <CapabilityCard span={3} index={index} height={260}>
      <div style={{ padding: sp.md, flex: "0 0 auto" }}>
        <Eyebrow color={c.signatureMustard}>Cost Engine</Eyebrow>
        <h3 style={{ ...typeStyle("titleSm", c.ink), marginTop: 6 }}>DOT-sourced, auditable</h3>
      </div>

      <div style={{ flex: 1, padding: `4px ${sp.md}px ${sp.md}px`, display: "flex", flexDirection: "column", gap: 8 }}>
        {stacks.map((s) => {
          const w = (s.value / max) * 100
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: ff.body }}>
              <span style={{ width: 58, color: c.muted }}>{s.label}</span>
              <div style={{ flex: 1, height: 7, borderRadius: r.pill, background: c.surfaceStrong, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${w}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  style={{ height: "100%", background: s.color, borderRadius: r.pill }}
                />
              </div>
              <span style={{ width: 44, fontFamily: ff.mono, fontWeight: 600, fontSize: 11, color: c.ink, textAlign: "right" }}>
                ${s.value.toFixed(1)}K
              </span>
            </div>
          )
        })}
        <span style={{ marginTop: 4, fontSize: 10, fontFamily: ff.mono, color: c.muted }}>
          Single B737-800 · 160 pax · 90-min delay
        </span>
      </div>
    </CapabilityCard>
  )
}

// ── Card 5: Plan D Carbon Ledger ─────────────────────────────────────────────

function CarbonCard({ index }: { index: number }) {
  return (
    <CapabilityCard span={3} surface={c.signatureCream} index={index} height={260}>
      <div style={{ padding: sp.md, flex: "0 0 auto" }}>
        <Eyebrow color={c.signatureForest}>Plan D · Green Recovery</Eyebrow>
        <h3 style={{ ...typeStyle("titleSm", c.ink), marginTop: 6 }}>EU-ETS-priced carbon ledger</h3>
      </div>

      <div style={{ flex: 1, padding: `4px ${sp.md}px ${sp.md}px`, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 10 }}>
        {/* Net ledger */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: ff.display, fontSize: 30, fontWeight: 400, color: c.signatureForest, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>
            +12.4 t
          </span>
          <span style={{ fontFamily: ff.mono, fontSize: 11, color: c.ink, opacity: 0.7 }}>
            net CO₂e across recovery · $1,054 ETS
          </span>
        </div>
        {/* Burn vs save bar */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ flex: 1.6, height: 10, borderRadius: r.pill, background: c.signatureCoral, opacity: 0.85 }} title="burned" />
          <div style={{ flex: 1, height: 10, borderRadius: r.pill, background: c.signatureMint, opacity: 0.85 }} title="saved" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ff.mono, fontSize: 10, color: c.ink, opacity: 0.7 }}>
          <span>burned 19.2 t</span>
          <span>saved 6.8 t</span>
        </div>
      </div>
    </CapabilityCard>
  )
}

// ── Card 6: Stress Test — Monte Carlo heatmap fragment ──────────────────────

function StressTestCard({ index }: { index: number }) {
  const airports = ["ORD", "ATL", "DFW", "LAX"]
  const kinds = ["WX", "GS", "ATC"]
  // Realistic-looking score matrix (higher = more fragile).
  const scores = [
    [0.92, 0.78, 0.41],   // ORD — biggest hub, worst weather impact
    [0.71, 0.62, 0.35],   // ATL
    [0.55, 0.49, 0.28],   // DFW
    [0.42, 0.31, 0.22],   // LAX
  ]
  return (
    <CapabilityCard span={3} index={index} height={260}>
      <div style={{ padding: sp.md, flex: "0 0 auto" }}>
        <Eyebrow color={c.signatureCoral}>Stress Test</Eyebrow>
        <h3 style={{ ...typeStyle("titleSm", c.ink), marginTop: 6 }}>Monte-Carlo vulnerability</h3>
      </div>

      <div style={{ flex: 1, padding: `4px ${sp.md}px ${sp.md}px`, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: `40px repeat(${kinds.length}, 1fr)`, gap: 4, fontFamily: ff.mono, fontSize: 9, color: c.muted }}>
          <span />
          {kinds.map((k) => <span key={k} style={{ textAlign: "center" }}>{k}</span>)}
        </div>
        {/* Heatmap rows */}
        {airports.map((ap, i) => (
          <div key={ap} style={{ display: "grid", gridTemplateColumns: `40px repeat(${kinds.length}, 1fr)`, gap: 4, alignItems: "center" }}>
            <span style={{ fontFamily: ff.mono, fontSize: 10, color: c.ink }}>{ap}</span>
            {kinds.map((k, j) => {
              const v = scores[i][j]
              // Lerp the coral signature → cream cell background by score.
              const alpha = 0.10 + v * 0.55
              return (
                <motion.div
                  key={k}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.05 * (i * 3 + j) }}
                  style={{
                    height: 22,
                    borderRadius: 3,
                    background: `rgba(170,45,0,${alpha})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: ff.mono,
                    fontSize: 10,
                    fontWeight: 500,
                    color: v > 0.5 ? c.canvas : c.ink,
                  }}
                >
                  {v.toFixed(2)}
                </motion.div>
              )
            })}
          </div>
        ))}
        <span style={{ fontFamily: ff.mono, fontSize: 9, color: c.muted, marginTop: 2 }}>
          1k iterations · severity sampled by stage
        </span>
      </div>
    </CapabilityCard>
  )
}

// ── Public composition ───────────────────────────────────────────────────────

export function SystemCapabilities() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55 }}
        style={{ textAlign: "center", marginBottom: 64 }}
      >
        <Eyebrow color={c.muted}>System Capabilities</Eyebrow>
        <h2 style={{ ...typeStyle("displayMd", c.ink), marginTop: 12, marginBottom: 16 }}>
          Built like a real OCC, not a settings menu.
        </h2>
        <p style={{ ...typeStyle("titleMd", c.muted), maxWidth: 640, margin: "0 auto", fontSize: 16 }}>
          Six capabilities, each visible as an actual product fragment — the cascade graph, the
          optimizer&apos;s objective function, the duty-time engine, the cost stack, the carbon ledger,
          the vulnerability heatmap. No hero icons. No filler.
        </p>
      </motion.div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: sp.md,
          alignItems: "stretch",
        }}
      >
        <CascadeCard index={0} />
        <OptimizerCard index={1} />
        <FAR117Card index={2} />
        <CostCard index={3} />
        <CarbonCard index={4} />
        <StressTestCard index={5} />
      </div>

      {/* Footer "explore" link — Airtable editorial: one secondary CTA per band. */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: sp.xl }}>
        <a
          href="/simulator"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: ff.body,
            fontSize: 14,
            fontWeight: 500,
            color: c.ink,
            textDecoration: "none",
            padding: "10px 16px",
            borderRadius: r.lg,
            border: `1px solid ${c.hairline}`,
            background: c.canvas,
          }}
        >
          Try them in the simulator
          <ArrowRight style={{ width: 14, height: 14 }} />
        </a>
      </div>
    </>
  )
}
