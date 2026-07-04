"use client"
/**
 * System capabilities — asymmetric editorial composition, dark register.
 *
 * Each panel carries an actual artifact of the system (rotation graph,
 * objective function, duty timeline, cost stack, carbon ledger, Monte
 * Carlo heatmap) instead of icon-and-blurb cards. Layout is deliberately
 * uneven: a 7/5 pair, a 4/4/4 band at a different height, then one
 * full-width stress-test breakout — no repeated card wall.
 *
 * Accent discipline: rose = disruption/severity, teal = recovery/action,
 * everything else neutral.
 */

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { c, ff } from "@/lib/design-tokens"
import { Rise, StaggerGroup, StaggerItem } from "./motion"

const MONO = ff.mono
const BODY = ff.body

const panel: CSSProperties = {
  background: c.canvas,
  border: `1px solid ${c.hairline}`,
  borderRadius: 12,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  height: "100%",
}

function PanelHead({ kicker, title, desc, accent = c.muted }: { kicker: string; title: string; desc?: string; accent?: string }) {
  return (
    <div style={{ padding: "20px 22px 0" }}>
      <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 550, letterSpacing: "0.12em", textTransform: "uppercase", color: accent }}>
        {kicker}
      </span>
      <h3 style={{ fontFamily: ff.display, fontSize: 19, fontWeight: 600, color: c.ink, margin: "10px 0 0", letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      {desc && (
        <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.55, color: c.body, margin: "8px 0 0" }}>{desc}</p>
      )}
    </div>
  )
}

// ── Cascade predictor — rotation graph ───────────────────────────────────
function CascadePanel() {
  const node = (x: number, y: number, code: string, tag: string, tagColor: string, delay: string) => (
    <g>
      <circle cx={x} cy={y} r="5.5" style={{ fill: tagColor }} />
      <circle cx={x} cy={y} r="11" fill="none" style={{ stroke: tagColor }} strokeOpacity="0.35" />
      <text x={x} y={y - 24} fontSize="11" fontFamily={BODY} fontWeight="500" style={{ fill: "var(--ae-text)" }} textAnchor="middle">{code}</text>
      <text x={x} y={y - 11} fontSize="8" fontFamily={BODY} fontWeight="600" style={{ fill: tagColor }} textAnchor="middle" letterSpacing="0.08em">{tag}</text>
      <text x={x} y={y + 24} fontSize="11" fontFamily={MONO} fontWeight="600" style={{ fill: "var(--ae-rose-ink)" }} textAnchor="middle">{delay}</text>
    </g>
  )
  return (
    <div style={panel} className="lp-panel">
      <PanelHead
        kicker="Cascade predictor"
        accent={c.roseInk}
        title="Rotation physics, not a black box"
        desc="Delays propagate through aircraft rotations the way they actually do — buffer-aware, deterministic, reproducible. Same inputs, same forecast, every time."
      />
      <div style={{ flex: 1, padding: "10px 22px 20px", minHeight: 190 }}>
        <svg viewBox="0 0 540 170" style={{ width: "100%", height: "100%" }}>
          <path d="M 70 64 Q 180 32 290 64" fill="none" style={{ stroke: "var(--ae-rose)" }} strokeWidth="1.5" strokeDasharray="4 3" />
          <path d="M 290 64 Q 380 96 470 64" fill="none" style={{ stroke: "var(--ae-rose-soft)" }} strokeWidth="1.3" strokeDasharray="4 3" />
          <rect x="58" y="116" width="430" height="24" rx="5" style={{ fill: "var(--ae-surface-2)", stroke: "var(--ae-line)" }} />
          <line x1="192" y1="116" x2="192" y2="140" style={{ stroke: "var(--ae-line)" }} />
          <line x1="372" y1="116" x2="372" y2="140" style={{ stroke: "var(--ae-line)" }} />
          <text x="124" y="132" fontSize="10" fontFamily={MONO} style={{ fill: "var(--ae-text-3)" }}>buffer 30m</text>
          <text x="282" y="132" fontSize="10" fontFamily={MONO} style={{ fill: "var(--ae-text-3)" }} textAnchor="middle">residual +181m</text>
          <text x="430" y="132" fontSize="10" fontFamily={MONO} style={{ fill: "var(--ae-text-3)" }} textAnchor="middle">cascade +161m</text>
          {node(70, 64, "DEN–ORD", "DIRECT", "var(--ae-rose)", "+211m")}
          {node(290, 64, "ORD–LAX", "ORDER 1", "var(--ae-rose-soft)", "+181m")}
          {node(470, 64, "LAX–SEA", "ORDER 2", "var(--ae-rose-soft2)", "+161m")}
        </svg>
      </div>
    </div>
  )
}

// ── Optimizer — objective function ───────────────────────────────────────
function OptimizerPanel() {
  const kw = { color: c.tealInk }
  const coef = { color: c.roseInk }
  return (
    <div style={panel} className="lp-panel">
      <PanelHead
        kicker="CP-SAT optimizer"
        accent={c.tealInk}
        title="Four plans, one solver"
        desc="Globally optimal under each objective. Auditable weights, reproducible runs."
      />
      <div
        style={{
          flex: 1,
          margin: "14px 22px 20px",
          padding: "14px 16px",
          borderRadius: 8,
          background: c.surfaceSoft,
          border: `1px solid ${c.hairline}`,
          fontFamily: MONO,
          fontSize: 12,
          lineHeight: 1.8,
          color: c.ink,
          minHeight: 150,
        }}
      >
        <span style={kw}>minimize</span>{"  "}
        <span style={coef}>α</span>·cancel<sub>f</sub> + <span style={coef}>β</span>·delay<sub>f</sub>
        <br />
        {"          "}+ <span style={coef}>γ</span>·crew<sub>viol</sub> + <span style={coef}>δ</span>·oop + <span style={coef}>ε</span>·co2<sub>kg</sub>
        <br />
        <span style={kw}>s.t.</span>{"      "}Σ swap<sub>f,a</sub> ≤ 1 &nbsp;∀ f
        <br />
        {"          "}delay<sub>f</sub> ≤ 480
        <br />
        <span style={{ color: c.muted }}># A: α=10 · B: β=10 · C: δ=10 · D: ε=12</span>
      </div>
    </div>
  )
}

// ── FAR 117 duty timeline ────────────────────────────────────────────────
function CrewPanel() {
  return (
    <div style={panel} className="lp-panel">
      <PanelHead kicker="FAR Part 117" title="Crew legality, checked on every plan" />
      <div style={{ flex: 1, padding: "16px 22px 20px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8 }}>
        <svg viewBox="0 0 240 82" style={{ width: "100%" }}>
          {[0, 4, 8, 12, 16, 20, 24].map((h) => (
            <g key={h}>
              <line x1={(h / 24) * 240} y1="44" x2={(h / 24) * 240} y2="50" style={{ stroke: "var(--ae-line)" }} />
              <text x={(h / 24) * 240} y="64" fontSize="8" fontFamily={MONO} style={{ fill: "var(--ae-text-3)" }} textAnchor="middle">
                {String(h).padStart(2, "0")}
              </text>
            </g>
          ))}
          <rect x={(6 / 24) * 240} y="24" width={(14 / 24) * 240} height="14" rx="3" style={{ fill: "var(--ae-teal-bg)", stroke: "var(--ae-teal)" }} />
          <pattern id="lpHatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" style={{ stroke: "var(--ae-rose)" }} strokeWidth="1.4" />
          </pattern>
          <rect x={(2 / 24) * 240} y="24" width={(4 / 24) * 240} height="14" rx="3" fill="url(#lpHatch)" opacity="0.5" />
          <line x1={(13 / 24) * 240} y1="16" x2={(13 / 24) * 240} y2="44" style={{ stroke: "var(--ae-text)" }} strokeWidth="1.6" />
          <text x={(13 / 24) * 240} y="11" fontSize="8" fontFamily={BODY} fontWeight="500" style={{ fill: "var(--ae-text)" }} textAnchor="middle">now</text>
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, color: c.muted }}>
          <span>FDP 14h · <span style={{ color: c.tealInk }}>legal</span></span>
          <span>7-day 52h / 60h</span>
        </div>
      </div>
    </div>
  )
}

// ── Cost engine ──────────────────────────────────────────────────────────
function CostPanel() {
  const rows = [
    { label: "Cancellation", value: 103.7, accent: true },
    { label: "Delay", value: 23.7 },
    { label: "Repositioning", value: 8.0 },
    { label: "DOT compensation", value: 38.4 },
  ]
  const max = Math.max(...rows.map((r) => r.value))
  return (
    <div style={panel} className="lp-panel">
      <PanelHead kicker="Cost engine" title="DOT-sourced, fully decomposed" />
      <div style={{ flex: 1, padding: "16px 22px 20px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 9 }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, fontFamily: BODY }}>
            <span style={{ width: 108, color: c.body }}>{r.label}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: c.surfaceStrong, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${(r.value / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.08 }}
                style={{ height: "100%", borderRadius: 3, background: r.accent ? "var(--ae-rose)" : "var(--ae-line-strong)" }}
              />
            </div>
            <span style={{ width: 52, fontFamily: MONO, fontWeight: 600, fontSize: 11.5, color: c.ink, textAlign: "right" }}>
              ${r.value.toFixed(1)}K
            </span>
          </div>
        ))}
        <span style={{ marginTop: 6, fontSize: 10.5, fontFamily: MONO, color: c.muted }}>
          B737-800 · 160 pax · 90-min delay · BTS 2023 rates
        </span>
      </div>
    </div>
  )
}

// ── Carbon ledger ────────────────────────────────────────────────────────
function CarbonPanel() {
  return (
    <div style={panel} className="lp-panel">
      <PanelHead kicker="Plan D · green recovery" accent={c.tealInk} title="EU-ETS-priced carbon ledger" />
      <div style={{ flex: 1, padding: "16px 22px 20px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12 }}>
        <div>
          <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 600, color: c.tealInk, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            +12.4 t
          </span>
          <div style={{ fontFamily: MONO, fontSize: 11, color: c.muted, marginTop: 6 }}>
            net CO₂e across recovery · $1,054 ETS
          </div>
        </div>
        <div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ flex: 19.2, height: 8, borderRadius: 4, background: "var(--ae-rose-soft)" }} />
            <div style={{ flex: 6.8, height: 8, borderRadius: 4, background: "var(--ae-teal)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: c.muted, marginTop: 6 }}>
            <span>burned 19.2 t</span>
            <span>saved 6.8 t</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stress test breakout — full width ────────────────────────────────────
function StressPanel() {
  const airports = ["ORD", "ATL", "DFW", "DEN", "JFK", "LAX"]
  const kinds = ["Weather", "Ground stop", "ATC", "Mechanical", "Crew"]
  const scores = [
    [0.92, 0.78, 0.41, 0.36, 0.52],
    [0.71, 0.62, 0.35, 0.31, 0.44],
    [0.55, 0.49, 0.28, 0.34, 0.38],
    [0.61, 0.42, 0.31, 0.26, 0.29],
    [0.58, 0.66, 0.52, 0.22, 0.35],
    [0.42, 0.31, 0.22, 0.28, 0.24],
  ]
  return (
    <div style={{ ...panel, flexDirection: "row", flexWrap: "wrap" }} className="lp-panel">
      <div style={{ flex: "1 1 300px", minWidth: 280, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 550, letterSpacing: "0.12em", textTransform: "uppercase", color: c.roseInk }}>
          Stress test
        </span>
        <h3 style={{ fontFamily: ff.display, fontSize: 22, fontWeight: 600, color: c.ink, margin: 0, letterSpacing: "-0.012em" }}>
          Find the fragile rotations before weather does
        </h3>
        <p style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: c.body, margin: 0, maxWidth: 380 }}>
          Monte Carlo disruption sweeps against the live schedule surface the
          airports, tails, and crew bases where a single event does the most
          damage — chaos engineering for airline ops.
        </p>
        <span style={{ fontFamily: MONO, fontSize: 11, color: c.muted, marginTop: "auto" }}>
          1,000 iterations · severity sampled by stage
        </span>
      </div>
      <div style={{ flex: "2 1 460px", minWidth: 320, padding: "24px 22px", borderLeft: `1px solid ${c.hairline}` }}>
        <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${kinds.length}, 1fr)`, gap: 5, fontFamily: MONO, fontSize: 9.5, color: c.muted, marginBottom: 5 }}>
          <span />
          {kinds.map((k) => (
            <span key={k} style={{ textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {airports.map((ap, i) => (
            <div key={ap} style={{ display: "grid", gridTemplateColumns: `52px repeat(${kinds.length}, 1fr)`, gap: 5, alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: c.ink }}>{ap}</span>
              {kinds.map((k, j) => {
                const v = scores[i][j]
                return (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: 0.03 * (i * kinds.length + j) }}
                    style={{
                      height: 26,
                      borderRadius: 4,
                      background: `rgba(229,99,142,${0.06 + v * 0.5})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: MONO,
                      fontSize: 10,
                      color: v > 0.55 ? "#FFF" : c.body,
                    }}
                  >
                    {v.toFixed(2)}
                  </motion.div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Public composition ───────────────────────────────────────────────────
export function CapabilitySections() {
  return (
    <section style={{ padding: "128px 40px" }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        {/* editorial split header — left title, right supporting copy */}
        <Rise>
          <div className="lp-split" style={{ marginBottom: 56 }}>
            <div>
              <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 550, letterSpacing: "0.14em", textTransform: "uppercase", color: c.muted }}>
                System capabilities
              </span>
              <h2 style={{ fontFamily: ff.display, fontSize: "clamp(30px, 3.4vw, 44px)", fontWeight: 600, color: c.ink, margin: "14px 0 0", letterSpacing: "-0.02em", lineHeight: 1.08 }}>
                Built like a real OCC,
                <br />
                not a settings menu.
              </h2>
            </div>
            <p style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.6, color: c.body, margin: 0, maxWidth: 480, justifySelf: "end" }}>
              Every capability below is shown as an actual artifact of the
              system — the rotation graph, the objective function, the duty
              timeline, the cost stack, the carbon ledger, the vulnerability
              matrix. No hero icons, no filler.
            </p>
          </div>
        </Rise>

        <StaggerGroup className="lp-grid-12" gap={0.08}>
          <StaggerItem className="lp-span-7"><CascadePanel /></StaggerItem>
          <StaggerItem className="lp-span-5"><OptimizerPanel /></StaggerItem>
          <StaggerItem className="lp-span-4"><CrewPanel /></StaggerItem>
          <StaggerItem className="lp-span-4"><CostPanel /></StaggerItem>
          <StaggerItem className="lp-span-4"><CarbonPanel /></StaggerItem>
          <StaggerItem className="lp-span-12"><StressPanel /></StaggerItem>
        </StaggerGroup>

        <Rise delay={0.1}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
            <Link
              href="/simulator"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: BODY, fontSize: 14, fontWeight: 500,
                color: c.ink, textDecoration: "none",
              }}
            >
              Try them in the simulator
              <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </Rise>
      </div>
    </section>
  )
}
