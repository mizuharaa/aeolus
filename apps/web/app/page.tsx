"use client"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Plane, Zap, BarChart3, Shield, ArrowRight,
  CloudLightning, Clock, TrendingDown, Terminal,
  Sparkles, AlertTriangle, Activity,
} from "lucide-react"

// ─── Animated hero map (glassmorphism card) ───────────────────────────────────

function HeroMap() {
  const airports = [
    { x: 150, y: 80,  code: "ORD", hot: true  },
    { x: 450, y: 215, code: "ATL", hot: false },
    { x: 300, y: 155, code: "DFW", hot: false },
    { x: 530, y: 115, code: "JFK", hot: false },
    { x: 240, y: 120, code: "DEN", hot: false },
    { x: 530, y: 255, code: "LAX", hot: false },
  ]
  const lines = [
    { d: "M150,80 Q300,30 450,215",   color: "#EF6C4A", delay: 0.4 },
    { d: "M300,155 Q400,110 530,115", color: "#FFD23F", delay: 0.9 },
    { d: "M240,120 Q390,70 530,115",  color: "#3CC4BD", delay: 1.3 },
    { d: "M150,80 Q210,140 300,155",  color: "#5DADE2", delay: 1.7 },
  ]

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden"
      style={{
        height: 420,
        background: "rgba(11,61,58,0.55)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
        <defs>
          <pattern id="hg" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0L0 0 0 44" fill="none" stroke="white" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hg)" />
      </svg>

      {/* Flight paths + airports */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 640 340"
        preserveAspectRatio="xMidYMid meet"
      >
        {lines.map((l, i) => (
          <motion.path
            key={i}
            d={l.d}
            stroke={l.color}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="7 5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.88 }}
            transition={{ duration: 2.2, delay: l.delay }}
          />
        ))}

        {airports.map((ap, idx) => (
          <g key={ap.code}>
            <motion.circle
              cx={ap.x} cy={ap.y} r="5"
              fill={ap.hot ? "#EF6C4A" : "rgba(255,255,255,0.88)"}
              stroke="rgba(255,255,255,0.20)"
              strokeWidth="1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 + idx * 0.1 }}
            />
            <motion.circle
              cx={ap.x} cy={ap.y} r={ap.hot ? 14 : 10}
              fill="none"
              stroke={ap.hot ? "#EF6C4A" : "rgba(255,255,255,0.35)"}
              strokeWidth="1"
              animate={{
                r: ap.hot ? [12, 22, 12] : [9, 15, 9],
                opacity: [0.5, 0.05, 0.5],
              }}
              transition={{ duration: 2.5, repeat: Infinity, delay: idx * 0.35 }}
            />
            <text
              x={ap.x + 10} y={ap.y + 4}
              fill="rgba(255,255,255,0.80)"
              fontSize="9"
              fontFamily="Sofia Sans, Arial, sans-serif"
              fontWeight="700"
            >
              {ap.code}
            </text>
          </g>
        ))}

        <motion.circle
          cx={150} cy={80} r="18"
          fill="none" stroke="#EF6C4A" strokeWidth="2.5"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 2.2, repeat: Infinity, delay: 2 }}
        />
      </svg>

      {/* Disruption alert */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5, duration: 0.5 }}
        className="absolute top-4 left-4 flex items-center gap-2 px-3.5 py-2 rounded-2xl"
        style={{
          background: "rgba(239,108,74,0.18)",
          border: "1px solid rgba(239,108,74,0.45)",
          backdropFilter: "blur(8px)",
        }}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#FCA5A5" }} />
        <span className="text-[11px] font-bold" style={{ color: "#FCA5A5" }}>
          ORD thunderstorm — 47 flights cascading
        </span>
      </motion.div>

      {/* Live indicator */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-semibold text-white/80">Live simulation</span>
      </div>

      {/* Recovery plans badge */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3, duration: 0.5 }}
        className="absolute bottom-4 right-4 px-3.5 py-2.5 rounded-2xl"
        style={{
          background: "rgba(43,168,162,0.20)",
          border: "1px solid rgba(43,168,162,0.45)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="text-[11px] font-bold" style={{ color: "#7FD8D4" }}>3 recovery plans ready</div>
        <div className="text-[10px] mt-0.5" style={{ color: "rgba(127,216,212,0.65)" }}>Solved in &lt;10ms · heuristic optimizer</div>
      </motion.div>

      {/* Status pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.5 }}
        className="absolute bottom-4 left-4 flex gap-2"
      >
        {[
          { label: "153 on time",  bg: "rgba(52,211,153,0.18)", bdr: "rgba(52,211,153,0.38)", color: "#6EE7B7" },
          { label: "31 delayed",   bg: "rgba(251,191,36,0.18)", bdr: "rgba(251,191,36,0.38)", color: "#FCD34D" },
          { label: "16 cancelled", bg: "rgba(239,108,74,0.22)", bdr: "rgba(239,108,74,0.42)", color: "#FCA5A5" },
        ].map((p) => (
          <span
            key={p.label}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: p.bg, border: `1px solid ${p.bdr}`, color: p.color }}
          >
            {p.label}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const stats = [
  { value: "$34B",  label: "Annual disruption cost (US)", color: "#EF6C4A", delay: 0    },
  { value: "74%",   label: "Weather-caused delays",       color: "#FFD23F", delay: 0.08 },
  { value: "18h",   label: "Avg cascade duration",        color: "#5DADE2", delay: 0.16 },
  { value: "<10ms", label: "Recovery plan solve time",    color: "#2BA8A2", delay: 0.24 },
]

const features = [
  {
    Icon: CloudLightning,
    title: "10 disruption event types",
    desc: "Weather, mechanical AOG, crew sickouts, airspace closures, cyber incidents — all with realistic cascade propagation through aircraft rotations.",
    accent: "#EF6C4A",
    accentBg: "rgba(239,108,74,0.08)",
  },
  {
    Icon: Zap,
    title: "Heuristic recovery optimizer",
    desc: "Three plan archetypes — minimize cost, minimize pax impact, protect next day — produced in milliseconds with full portfolio cost rollups.",
    accent: "#FFD23F",
    accentBg: "rgba(255,210,63,0.08)",
  },
  {
    Icon: Shield,
    title: "FAR Part 117 crew legality",
    desc: "Duty-time checks surface violation counts on every plan so you can compare regulatory tradeoffs before committing to a recovery strategy.",
    accent: "#2BA8A2",
    accentBg: "rgba(43,168,162,0.08)",
  },
  {
    Icon: BarChart3,
    title: "Cascade + ML predictor",
    desc: "Rotation-based propagation, optionally backed by a trained ML model for realistic delay duration expectations across the whole fleet.",
    accent: "#5DADE2",
    accentBg: "rgba(93,173,226,0.08)",
  },
]

const steps = [
  { n: "01", t: "Trigger Event",    d: "Pick disruption type, airport or tail number, severity, and duration from the real-world event library." },
  { n: "02", t: "Cascade Computed", d: "The predictor propagates delays through aircraft rotations, surfacing every downstream effect in real time." },
  { n: "03", t: "Plans Generated",  d: "The optimizer assembles three differentiated strategies, each with full cost breakdowns and FAR 117 flags." },
  { n: "04", t: "Plans Delivered",  d: "Results stream instantly to the OCC dashboard. Compare, inspect, and apply your chosen recovery plan live." },
]

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden" style={{ background: "#EFF8F7" }}>

      {/* ── Fixed navigation ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-6 md:px-10"
        style={{
          background: "linear-gradient(135deg, #0B3D3A 0%, #1E8C86 100%)",
          boxShadow: "0 2px 20px rgba(0,0,0,0.25)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#FFD23F", boxShadow: "0 2px 10px rgba(255,210,63,0.45)" }}
          >
            <Plane className="w-5 h-5" style={{ color: "#1E8C86" }} />
          </div>
          <span className="font-extrabold text-lg text-white tracking-tight">Aeolus</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/scenarios" className="text-white/65 hover:text-white transition-colors font-medium">Scenarios</Link>
          <Link href="/docs"      className="text-white/65 hover:text-white transition-colors font-medium">Methodology</Link>
          <Link href="/simulator" className="text-white/65 hover:text-white transition-colors font-medium">Simulator</Link>
        </div>

        <Link href="/simulator" className="btn-gold h-9 px-5 text-sm">
          Launch simulator <ArrowRight className="w-4 h-4" />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative min-h-screen flex items-center pt-16 pb-24 px-6 md:px-10 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0B3D3A 0%, #1A7A74 45%, #2BA8A2 100%)" }}
      >
        {/* Decorative radial glows */}
        <div
          className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(43,168,162,0.14) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,210,63,0.07) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: headline + CTA */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2.5 mb-7 px-4 py-2 rounded-full"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.17)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-white/80 tracking-widest uppercase">
                Nimbus Air · 40 aircraft · 142 daily flights
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.68, delay: 0.08 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.04] mb-6"
              style={{ color: "white" }}
            >
              When weather hits,<br />
              <span style={{ color: "#FFD23F" }}>flights cascade.</span><br />
              <span style={{ color: "rgba(255,255,255,0.82)" }}>Aeolus recovers.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.60, delay: 0.22 }}
              className="text-base md:text-lg mb-8 leading-relaxed max-w-xl"
              style={{ color: "rgba(255,255,255,0.68)" }}
            >
              Open-source Operations Control Center. Trigger real-world disruptions against a synthetic US airline network and receive three ranked recovery plans in milliseconds.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.35 }}
              className="flex items-center gap-3 flex-wrap"
            >
              <Link href="/simulator" className="btn-gold h-12 px-7 text-base font-black">
                Launch simulator <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center h-12 px-6 text-base font-semibold rounded-full transition-all hover:bg-white/15"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.24)",
                  color: "rgba(255,255,255,0.84)",
                }}
              >
                Read methodology
              </Link>
            </motion.div>

            {/* Micro-stat pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.52 }}
              className="flex items-center gap-3 mt-8 flex-wrap"
            >
              {[
                { v: "$34B",   l: "annual cost" },
                { v: "<10ms",  l: "to solve"    },
                { v: "3 plans", l: "per event"  },
              ].map((s) => (
                <div
                  key={s.l}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-full"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" }}
                >
                  <span className="text-sm font-black text-white">{s.v}</span>
                  <span className="text-xs text-white/50">{s.l}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: animated map card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.28 }}
          >
            <HeroMap />
          </motion.div>
        </div>

        {/* Scroll nudge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Scroll</span>
          <motion.div
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-7 rounded-full"
            style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.30), transparent)" }}
          />
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 md:py-24 px-6 md:px-10 bg-white border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 44 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: s.delay }}
                className="text-center"
              >
                <div
                  className="text-4xl md:text-5xl lg:text-6xl font-black mb-2.5 tracking-tight"
                  style={{ color: s.color }}
                >
                  {s.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium leading-snug">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 md:py-28 px-6 md:px-10" style={{ background: "#EFF8F7" }}>
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 mb-5 text-xs font-black uppercase tracking-widest" style={{ color: "#2BA8A2" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FFD23F" }} />
              System capabilities
            </div>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-4"
              style={{ color: "#1F2937" }}
            >
              Built like a real OCC.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg leading-relaxed">
              Every component reflects how carriers approach disruption recovery — transparent, inspectable logic from first principles.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -80 : 80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.68, ease: [0.21, 0.47, 0.32, 0.98] }}
                whileHover={{ y: -5, transition: { duration: 0.22 } }}
                className="surface-card p-7 lg:p-8 relative overflow-hidden group cursor-default"
                style={{ borderLeft: `4px solid ${f.accent}` }}
              >
                {/* Hover bg tint */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                  style={{ background: f.accentBg }}
                />
                <div className="relative">
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      width: 52, height: 52,
                      background: f.accentBg,
                      border: `1px solid ${f.accent}35`,
                      boxShadow: `0 4px 18px ${f.accent}22`,
                    }}
                  >
                    <f.Icon className="w-6 h-6" style={{ color: f.accent }} />
                  </div>
                  <h3 className="text-lg font-black mb-3" style={{ color: "#1F2937" }}>{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 md:py-28 px-6 md:px-10 bg-white border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55 }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-2 mb-5 text-xs font-black uppercase tracking-widest" style={{ color: "#2BA8A2" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FFD23F" }} />
              How it works
            </div>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-4"
              style={{ color: "#1F2937" }}
            >
              From disruption to recovery<br className="hidden md:block" /> in seconds.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 52 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.58, delay: i * 0.11 }}
                className="surface-card p-6 lg:p-7 relative overflow-hidden"
              >
                <div
                  className="absolute -top-2 -right-2 font-black select-none leading-none"
                  style={{ fontSize: 88, color: "rgba(43,168,162,0.07)" }}
                >
                  {step.n}
                </div>
                <div className="relative">
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: "#2BA8A2" }}
                  >
                    Step {step.n}
                  </div>
                  <h3 className="text-base font-black mb-2.5" style={{ color: "#1F2937" }}>{step.t}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="py-24 md:py-32 px-6 md:px-10 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0B3D3A 0%, #1E8C86 60%, #2BA8A2 100%)" }}
      >
        <div
          className="absolute -top-40 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,210,63,0.09) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 44 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.68 }}
          >
            <div
              className="inline-flex items-center gap-2 mb-7 px-4 py-2 rounded-full"
              style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.20)" }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#FFD23F" }} />
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">
                Try it now — no setup required
              </span>
            </div>

            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-[1.06]"
              style={{ color: "white" }}
            >
              Trigger your first<br />disruption.
            </h2>

            <p
              className="text-base md:text-lg mb-10 leading-relaxed max-w-xl mx-auto"
              style={{ color: "rgba(255,255,255,0.66)" }}
            >
              One click. Watch flights cascade on the live US map. Compare three recovery plans. Inspect FAR 117 flags in real time.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/simulator" className="btn-gold px-8 text-base font-black" style={{ height: 52 }}>
                Open the simulator <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/scenarios"
                className="inline-flex items-center justify-center px-7 text-base font-semibold rounded-full transition-all hover:bg-white/15"
                style={{
                  height: 52,
                  background: "rgba(255,255,255,0.09)",
                  border: "1px solid rgba(255,255,255,0.26)",
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                Browse scenarios
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-12 md:py-16 px-6 md:px-10"
        style={{ background: "#071E1C", borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "#FFD23F", boxShadow: "0 2px 10px rgba(255,210,63,0.35)" }}
            >
              <Plane className="w-5 h-5" style={{ color: "#1E8C86" }} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Aeolus</div>
              <div className="text-xs text-white/40">Open-source OCC reference</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-white/45">
            <Link href="/scenarios" className="hover:text-white/80 transition-colors">Scenarios</Link>
            <Link href="/docs"      className="hover:text-white/80 transition-colors">Methodology</Link>
            <Link href="/simulator" className="hover:text-white/80 transition-colors">Simulator</Link>
          </div>
        </div>

        <div
          className="max-w-6xl mx-auto mt-8 pt-8 text-xs text-white/25"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          Built with Next.js · React · Framer Motion · Leaflet · Zustand · Python FastAPI
        </div>
      </footer>
    </main>
  )
}
