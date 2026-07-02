"use client"
/**
 * Capabilities — one asymmetric band, not a tile grid.
 *
 * Two visual anchors carry the section: the CP-SAT objective as a real
 * code block on the ink surface, and the rotation-graph cascade diagram
 * on paper. The remaining four capabilities are a plain text grid with
 * hairline rules — titles, one specific sentence, one mono data line.
 * No icon chips, no pastel cards, no repeated card chrome.
 */
import { ArrowRight } from "lucide-react"
import { c, ff } from "@/lib/design-tokens"
import { Eyebrow } from "@/components/ds/primitives"
import { PanIn } from "@/components/landing/scroll-fx"

// ── Anchor 1 — the optimizer, shown as its own objective function ───────────

function OptimizerPanel() {
  return (
    <PanIn
      from="left"
      dist={110}
      style={{
        gridColumn: "span 6 / span 6",
        background: c.surfaceDark,
        border: "1px solid rgba(245,245,240,0.08)",
        borderRadius: 14,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        minHeight: 360,
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: ff.display,
            fontSize: 20,
            fontWeight: 550,
            letterSpacing: "-0.008em",
            color: "#ECEEE9",
            marginBottom: 8,
          }}
        >
          Recovery as a constraint program
        </h3>
        <p style={{ fontFamily: ff.body, fontSize: 13.5, lineHeight: 1.6, color: "rgba(236,238,233,0.62)", maxWidth: 440 }}>
          OR-Tools CP-SAT reassigns aircraft and delays or cancels legs under
          rotation, turn-time, and crew-legality constraints. Four objective
          weightings produce Plans A through D from the same model.
        </p>
      </div>

      <div
        style={{
          flex: 1,
          borderRadius: 10,
          background: "rgba(245,245,240,0.04)",
          border: "1px solid rgba(245,245,240,0.08)",
          padding: "16px 18px",
          fontFamily: ff.mono,
          fontSize: 12.5,
          lineHeight: 1.85,
          color: "rgba(236,238,233,0.82)",
          overflowX: "auto",
        }}
      >
        <span style={{ color: "#45B3A5" }}>minimize</span>{"   "}
        <span style={{ color: "#CDA05E" }}>α</span>·Σ cancel<sub>f</sub> + <span style={{ color: "#CDA05E" }}>β</span>·Σ delay<sub>f</sub>
        <br />
        {"          "}+ <span style={{ color: "#CDA05E" }}>γ</span>·crew<sub>viol</sub> + <span style={{ color: "#CDA05E" }}>δ</span>·oop + <span style={{ color: "#CDA05E" }}>ε</span>·co₂
        <br />
        <span style={{ color: "#45B3A5" }}>s.t.</span>{"       "}Σ<sub>a</sub> swap<sub>f,a</sub> ≤ 1{"   "}∀ f
        <br />
        {"          "}delay<sub>f</sub> ≤ 480 min
        <br />
        {"          "}rotation &amp; turn-time coupling
        <br />
        <span style={{ color: "rgba(236,238,233,0.4)" }}># A α=10 · B β=10 · C δ=10 · D ε=12</span>
      </div>

      <div style={{ fontFamily: ff.mono, fontSize: 11.5, color: "rgba(236,238,233,0.5)" }}>
        median solve 8 ms · 200 flights · 40 tails · 60 pairings
      </div>
    </PanIn>
  )
}

// ── Anchor 2 — the cascade predictor as a rotation-graph diagram ────────────

function RotationNode({ x, y, code, tag, dotColor, delay }: {
  x: number; y: number; code: string; tag: string; dotColor: string; delay: string
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill={dotColor} />
      <circle cx={x} cy={y} r="11" fill="none" stroke={dotColor} strokeOpacity="0.3" />
      <text x={x} y={y - 24} fontSize="11" fontFamily="Inter, sans-serif" fontWeight="550" fill="var(--ae-text)" textAnchor="middle">
        {code}
      </text>
      <text x={x} y={y - 11} fontSize="8.5" fontFamily="Inter, sans-serif" fontWeight="500" fill="var(--ae-text-3)" textAnchor="middle">
        {tag}
      </text>
      <text x={x} y={y + 24} fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="500" fill="var(--ae-text-2)" textAnchor="middle">
        {delay}
      </text>
    </g>
  )
}

function CascadePanel() {
  return (
    <PanIn
      from="right"
      dist={110}
      style={{
        gridColumn: "span 6 / span 6",
        background: c.canvas,
        border: `1px solid ${c.hairline}`,
        borderRadius: 14,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        minHeight: 360,
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: ff.display,
            fontSize: 20,
            fontWeight: 550,
            letterSpacing: "-0.008em",
            color: c.ink,
            marginBottom: 8,
          }}
        >
          The cascade is rotation physics
        </h3>
        <p style={{ fontFamily: ff.body, fontSize: 13.5, lineHeight: 1.6, color: c.muted, maxWidth: 440 }}>
          The predictor walks each aircraft&apos;s day: subtract the turn buffer,
          carry the residual delay onto the next leg, repeat for two
          generations. Same inputs, same forecast, every time.
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <svg viewBox="0 0 540 170" style={{ width: "100%", height: "auto" }}>
          <path d="M 70 64 Q 180 30 290 64" fill="none" stroke="var(--ae-amber)" strokeWidth="1.6" strokeDasharray="5 4" />
          <path d="M 290 64 Q 380 96 470 64" fill="none" stroke="var(--ae-amber-soft)" strokeWidth="1.5" strokeDasharray="5 4" />

          <rect x="58" y="118" width="430" height="24" rx="5" fill="var(--ae-surface-2)" stroke="var(--ae-line)" />
          <line x1="196" y1="118" x2="196" y2="142" stroke="var(--ae-line)" />
          <line x1="372" y1="118" x2="372" y2="142" stroke="var(--ae-line)" />
          <text x="127" y="133.5" fontSize="10" fontFamily="'JetBrains Mono', monospace" fill="var(--ae-text-3)" textAnchor="middle">buffer −30m</text>
          <text x="284" y="133.5" fontSize="10" fontFamily="'JetBrains Mono', monospace" fill="var(--ae-text-3)" textAnchor="middle">residual +181m</text>
          <text x="430" y="133.5" fontSize="10" fontFamily="'JetBrains Mono', monospace" fill="var(--ae-text-3)" textAnchor="middle">cascade +161m</text>

          <RotationNode x={70}  y={64} code="DEN → ORD" tag="direct hit" dotColor="var(--ae-amber)"       delay="+211m" />
          <RotationNode x={290} y={64} code="ORD → LAX" tag="order 1"    dotColor="var(--ae-amber-soft)"  delay="+181m" />
          <RotationNode x={470} y={64} code="LAX → SEA" tag="order 2"    dotColor="var(--ae-amber-soft2)" delay="+161m" />
        </svg>
      </div>

      <div style={{ fontFamily: ff.mono, fontSize: 11.5, color: c.muted }}>
        deterministic rotation-graph propagation · two generations
      </div>
    </PanIn>
  )
}

// ── The remaining four — plain text on hairlines ─────────────────────────────

const QUIET_CAPABILITIES = [
  {
    title: "FAR 117 crew legality",
    body: "Every plan reports duty-time flags computed from cumulative flight-duty periods, 117.25 rest minimums, and WOCL windows.",
    data: "60 pairings · 14 h FDP caps",
  },
  {
    title: "Cost engine",
    body: "Cancellation, delay, and repositioning are costed from DOT Form 41 block-hour rates and $82.50 per passenger-hour of delay.",
    data: "DOT BTS 2023 rates",
  },
  {
    title: "Carbon ledger",
    body: "Plan D minimizes CO₂e as a fourth objective; every plan carries tons burned and saved, priced at the EU ETS allowance rate.",
    data: "EU ETS $/tCO₂e",
  },
  {
    title: "Network stress test",
    body: "Monte-Carlo sweeps sample 1,000 disruption draws against the schedule and rank the most fragile rotations, airports, and crew bases.",
    data: "1k iterations per sweep",
  },
]

export function SystemCapabilities() {
  return (
    <>
      <PanIn from="left" dist={100} style={{ marginBottom: 56, maxWidth: 560 }}>
        <Eyebrow>Capabilities</Eyebrow>
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
          Rotation physics in, four recovery plans out.
        </h2>
      </PanIn>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <OptimizerPanel />
        <CascadePanel />
      </div>

      {/* Quiet capabilities — text only, hairline rules */}
      <PanIn
        from="left"
        dist={70}
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "0 40px",
          borderTop: `1px solid ${c.hairline}`,
        }}
      >
        {QUIET_CAPABILITIES.map((cap) => (
          <div key={cap.title} style={{ padding: "26px 0 6px" }}>
            <h4 style={{ fontFamily: ff.body, fontSize: 14.5, fontWeight: 550, color: c.ink, marginBottom: 8 }}>
              {cap.title}
            </h4>
            <p style={{ fontFamily: ff.body, fontSize: 13, lineHeight: 1.6, color: c.muted, marginBottom: 10 }}>
              {cap.body}
            </p>
            <span style={{ fontFamily: ff.mono, fontSize: 11, color: c.tealInk }}>{cap.data}</span>
          </div>
        ))}
      </PanIn>

      <div style={{ marginTop: 44 }}>
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
            borderBottom: `1px solid ${c.borderStrong}`,
            paddingBottom: 2,
          }}
        >
          Try them in the simulator
          <ArrowRight style={{ width: 14, height: 14 }} />
        </a>
      </div>
    </>
  )
}
