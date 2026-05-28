"use client"

/**
 * HeroMap — Aeolus AOC instrument dashboard (landing hero, right column).
 *
 * A dark "mission control" reveal: on mount the panels fade+rise in a stagger,
 * KPI numbers count up from zero, the Network Health gauge sweeps 0→68 in sync
 * with its center number, the Cascade Propagation lines draw themselves L→R, the
 * Recovery Plan stream flows open, and the US map nodes pulse in with the ORD
 * ground-stop ring + tooltip arriving last. A Replay button re-fires the whole
 * sequence (remount via key change). Honors prefers-reduced-motion.
 *
 * Built with the repo's TSX + framer-motion + design-token conventions. The
 * SEV palette below holds dark-theme *glow* variants of the app status tokens
 * (on-time→green, delayed→amber, cancelled→red) so the severity gradient reads
 * on near-black; tokens (c.*) are used wherever a canonical hue exists.
 */

import { motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { c, ff, r } from "@/lib/design-tokens"

// Dark-theme glow variants of the status palette (green→amber→red severity).
const SEV = {
  green: "#34D39A", // on-time / healthy
  amber: "#F4B740", // delayed
  red: "#F2542D", // cancelled / at-risk
} as const

const EASE = [0.22, 1, 0.36, 1] as const

// ── Choreography schedule (ms) ──────────────────────────────────────────
const T = {
  kpi: 320,
  gauge: 520,
  lines: 760,
  linesDraw: 900,
  marker: 1700,
  stream: 980,
  streamLabel: 1500,
  mapBase: 640,
  tooltip: 1750,
}

// ── count-up hook (requestAnimationFrame, easeOutCubic) ──────────────────
function useCountUp(target: number, duration = 1200, delay = 0, enabled = true) {
  const [val, setVal] = useState(enabled ? 0 : target)
  useEffect(() => {
    if (!enabled) {
      setVal(target)
      return
    }
    let raf = 0
    let start: number | undefined
    const timer = setTimeout(() => {
      const tick = (t: number) => {
        if (start === undefined) start = t
        const p = Math.min((t - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setVal(target * eased)
        if (p < 1) raf = requestAnimationFrame(tick)
        else setVal(target)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      clearTimeout(timer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [target, duration, delay, enabled])
  return val
}

// Ambient post-reveal jitter so numbers feel live, not frozen.
function useLiveCounter(base: number, spread: number, ms: number) {
  const [n, setN] = useState(base)
  useEffect(() => {
    const id = setInterval(() => setN(base + Math.floor(Math.random() * spread)), ms)
    return () => clearInterval(id)
  }, [base, spread, ms])
  return n
}

// ── Map geometry (simplified US, ~continental layout) ────────────────────
const MAP_VB = { w: 560, h: 188 }

const US_OUTLINE =
  "M64,52 L60,92 L82,150 L150,162 L255,166 L272,176 L330,164 L432,170 L442,150 " +
  "L470,120 L486,66 L382,46 L250,42 L120,48 Z"

const AIRPORTS = [
  { code: "ORD", x: 150, y: 56, sev: "red" as const, hot: true },
  { code: "DEN", x: 212, y: 96, sev: "green" as const, hot: false },
  { code: "DFW", x: 272, y: 122, sev: "amber" as const, hot: false },
  { code: "ATL", x: 400, y: 130, sev: "amber" as const, hot: false },
  { code: "JFK", x: 470, y: 70, sev: "green" as const, hot: false },
  { code: "LAX", x: 482, y: 150, sev: "green" as const, hot: false },
]

const ROUTES = [
  { id: "r1", d: "M150,56 Q260,40 400,130", sev: "red" as const, dur: 3.4, delay: 0, w: 2.4 },
  { id: "r2", d: "M150,56 Q190,90 272,122", sev: "red" as const, dur: 2.7, delay: 0.4, w: 2 },
  { id: "r3", d: "M212,96 Q360,60 470,70", sev: "amber" as const, dur: 4.2, delay: 0.9, w: 1.8 },
  { id: "r4", d: "M272,122 Q360,90 470,70", sev: "amber" as const, dur: 3.6, delay: 1.3, w: 1.6 },
  { id: "r5", d: "M400,130 Q445,170 482,150", sev: "green" as const, dur: 4.6, delay: 1.0, w: 1.4 },
  { id: "r6", d: "M212,96 Q240,108 272,122", sev: "green" as const, dur: 2.6, delay: 1.9, w: 1.3 },
]

// ── Cascade S-curves (logistic) → normalized path strings ────────────────
const CHART = { w: 250, h: 116, padX: 6, padY: 10 }
function logisticPath(L: number, k: number, x0: number, maxY: number) {
  const n = 26
  const innerW = CHART.w - CHART.padX * 2
  const innerH = CHART.h - CHART.padY * 2
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 10
    const y = L / (1 + Math.exp(-k * (x - x0)))
    const px = CHART.padX + (i / (n - 1)) * innerW
    const py = CHART.padY + innerH - (y / maxY) * innerH
    pts.push(`${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
  }
  return pts.join(" ")
}
const MAXY = 100
const CASCADE = [
  { label: "2nd-order", color: SEV.green, path: logisticPath(96, 0.8, 6.4, MAXY), draw: 1.5 },
  { label: "1st-order", color: SEV.amber, path: logisticPath(80, 0.95, 4.4, MAXY), draw: 1.3 },
  { label: "Direct impact", color: SEV.red, path: logisticPath(58, 1.15, 2.4, MAXY), draw: 1.1 },
]
// marker point on the 1st-order curve (~x=6.2)
const MARKER = (() => {
  const innerW = CHART.w - CHART.padX * 2
  const innerH = CHART.h - CHART.padY * 2
  const x = 6.2
  const y = 80 / (1 + Math.exp(-0.95 * (x - 4.4)))
  return {
    x: CHART.padX + (x / 10) * innerW,
    y: CHART.padY + innerH - (y / MAXY) * innerH,
    val: Math.round(y),
  }
})()

// ── Recovery plan stream (4 objectives, widths sum to 100) ───────────────
const PLANS = [
  { label: "Cost", pct: 34, color: SEV.green },
  { label: "Pax", pct: 28, color: "#7BD389" },
  { label: "Tomorrow", pct: 22, color: SEV.amber },
  { label: "Green", pct: 16, color: SEV.red },
]

function PlaneGlyph({ fill }: { fill: string }) {
  return <path d="M0,-4.5 L9,0 L0,4.5 L1.8,0 Z" fill={fill} stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
}

// ── Card chrome ──────────────────────────────────────────────────────────
const panel = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: r.md,
  backdropFilter: "blur(6px)",
} as const

function Reveal({
  delay = 0,
  reduce,
  children,
  style,
}: {
  delay?: number
  reduce: boolean
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <motion.div
      style={style}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, delay: delay / 1000, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// ── Network Health gauge ─────────────────────────────────────────────────
function Gauge({ reduce }: { reduce: boolean }) {
  const value = useCountUp(68, 1200, T.gauge, !reduce)
  // semicircle path M20,100 A80,80 0 0 1 180,100 (pathLength normalized to 100)
  const offset = 100 - 68 // value arc reveals to 68%
  // tip position for 68%
  const f = 68 / 100
  const theta = (180 - f * 180) * (Math.PI / 180)
  const tip = { x: 100 + 80 * Math.cos(theta), y: 100 - 80 * Math.sin(theta) }
  return (
    <div style={{ ...panel, padding: 12, display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: ff.body, fontWeight: 600 }}>
        Network Health
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
        <svg viewBox="0 0 200 120" style={{ width: 132, height: 80, overflow: "visible" }}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={SEV.red} />
              <stop offset="50%" stopColor={SEV.amber} />
              <stop offset="100%" stopColor={SEV.green} />
            </linearGradient>
          </defs>
          <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="13" strokeLinecap="round" />
          <motion.path
            d="M20,100 A80,80 0 0 1 180,100"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="13"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            initial={reduce ? false : { strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: offset }}
            transition={reduce ? { duration: 0 } : { duration: 1.2, delay: T.gauge / 1000, ease: EASE }}
          />
          {/* shimmer tip */}
          <motion.circle
            cx={tip.x}
            cy={tip.y}
            r={5}
            fill="#FBE7A8"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 0.55, 1] }}
            transition={reduce ? { duration: 0 } : { delay: (T.gauge + 1200) / 1000, duration: 2.2, repeat: Infinity, repeatType: "reverse" }}
          />
          <text x="100" y="86" textAnchor="middle" fontFamily={ff.mono} fontWeight={700} fontSize="34" fill="#E6EDF3" style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.round(value)}
          </text>
          <text x="100" y="104" textAnchor="middle" fontFamily={ff.mono} fontSize="10" fill="rgba(255,255,255,0.45)">
            % OPS OK
          </text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { l: "On-time", v: "82%", color: SEV.green },
            { l: "Delayed", v: "14%", color: SEV.amber },
            { l: "Cancelled", v: "4%", color: SEV.red },
          ].map((row, i) => (
            <Reveal key={row.l} reduce={reduce} delay={T.gauge + 200 + i * 90} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: r.full, background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: ff.body, minWidth: 52 }}>{row.l}</span>
              <span style={{ fontSize: 11, color: "#E6EDF3", fontFamily: ff.mono, fontWeight: 600 }}>{row.v}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Cascade Propagation self-drawing lines ───────────────────────────────
function Cascade({ reduce }: { reduce: boolean }) {
  return (
    <div style={{ ...panel, padding: 12, position: "relative", flex: 1, minWidth: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: ff.body, fontWeight: 600 }}>
          Cascade Propagation
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: ff.mono }}>t+0 → t+6h</span>
      </div>
      <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} style={{ width: "100%", height: 96, overflow: "visible" }}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={CHART.padX} x2={CHART.w - CHART.padX} y1={CHART.padY + g * (CHART.h - CHART.padY * 2)} y2={CHART.padY + g * (CHART.h - CHART.padY * 2)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {CASCADE.map((s, i) => (
          <motion.path
            key={s.label}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            initial={reduce ? false : { strokeDashoffset: 1 }}
            animate={{ strokeDashoffset: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 1.3, delay: (T.linesDraw + i * 120) / 1000, ease: "easeInOut" }}
            style={{ filter: `drop-shadow(0 0 4px ${s.color}66)` }}
          />
        ))}
        {/* marker + tooltip */}
        <motion.g
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { delay: T.marker / 1000, duration: 0.4, ease: EASE }}
          style={{ transformOrigin: `${MARKER.x}px ${MARKER.y}px` }}
        >
          <circle cx={MARKER.x} cy={MARKER.y} r={3.5} fill="#0A0E14" stroke={SEV.amber} strokeWidth={2} />
          <rect x={MARKER.x - 52} y={MARKER.y - 30} width={104} height={20} rx={5} fill="rgba(10,14,20,0.92)" stroke="rgba(255,255,255,0.12)" />
          <text x={MARKER.x} y={MARKER.y - 16} textAnchor="middle" fontFamily={ff.mono} fontSize="9.5" fill="#E6EDF3">
            1st-order · {MARKER.val} flights
          </text>
        </motion.g>
      </svg>
      <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
        {CASCADE.slice().reverse().map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: ff.body }}>
            <span style={{ width: 8, height: 2, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Recovery plan stream bar ─────────────────────────────────────────────
function Stream({ reduce }: { reduce: boolean }) {
  return (
    <div style={{ ...panel, padding: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: ff.body, fontWeight: 600, marginBottom: 8 }}>
        Recovery Plan Comparison
      </div>
      <div style={{ display: "flex", gap: 3, height: 26, borderRadius: 6, overflow: "hidden" }}>
        {PLANS.map((p, i) => (
          <motion.div
            key={p.label}
            initial={reduce ? false : { flexGrow: 0.001, opacity: 0 }}
            animate={{ flexGrow: p.pct, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { duration: 0.7, delay: (T.stream + i * 110) / 1000, ease: EASE }}
            style={{
              flexBasis: 0,
              flexGrow: p.pct,
              background: `linear-gradient(180deg, ${p.color}, ${p.color}cc)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
            }}
          >
            <Reveal reduce={reduce} delay={T.streamLabel + i * 80}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(10,14,20,0.85)", fontFamily: ff.mono }}>{p.pct}%</span>
            </Reveal>
          </motion.div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {PLANS.map((p) => (
          <span key={p.label} style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: ff.body }}>{p.label}</span>
        ))}
      </div>
    </div>
  )
}

// ── US Network Status map ────────────────────────────────────────────────
function NetworkMap({ reduce }: { reduce: boolean }) {
  const cascading = useLiveCounter(47, 6, 2200)
  return (
    <div style={{ ...panel, padding: 0, position: "relative", overflow: "hidden", height: 196 }}>
      <div style={{ position: "absolute", top: 10, left: 12, zIndex: 2, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: ff.body, fontWeight: 600 }}>
        US Network Status
      </div>

      <svg viewBox={`0 0 ${MAP_VB.w} ${MAP_VB.h}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
          </pattern>
          {ROUTES.map((rt) => (
            <path key={`def-${rt.id}`} id={rt.id} d={rt.d} fill="none" />
          ))}
        </defs>
        <rect width="100%" height="100%" fill="url(#mapGrid)" />
        <path d={US_OUTLINE} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* cascade route arcs — flowing dashes */}
        {ROUTES.map((rt, i) => (
          <motion.path
            key={`line-${rt.id}`}
            d={rt.d}
            stroke={SEV[rt.sev]}
            strokeWidth={rt.w}
            strokeLinecap="round"
            fill="none"
            strokeDasharray="7 6"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: rt.sev === "red" ? 0.95 : 0.6 }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, delay: (T.mapBase + i * 90) / 1000, ease: EASE }}
          />
        ))}

        {/* planes (ambient, after reveal) */}
        {!reduce &&
          ROUTES.slice(0, 4).map((rt) => (
            <g key={`plane-${rt.id}`} opacity={rt.sev === "red" ? 1 : 0.8}>
              <PlaneGlyph fill={SEV[rt.sev]} />
              <animateMotion dur={`${rt.dur}s`} repeatCount="indefinite" rotate="auto" begin={`${1.6 + rt.delay}s`} calcMode="linear">
                <mpath href={`#${rt.id}`} />
              </animateMotion>
            </g>
          ))}

        {/* airports */}
        {AIRPORTS.map((ap, i) => (
          <motion.g
            key={ap.code}
            initial={reduce ? false : { opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { delay: (T.mapBase + i * 100) / 1000, duration: 0.45, ease: EASE }}
            style={{ transformOrigin: `${ap.x}px ${ap.y}px` }}
          >
            {ap.hot && (
              <motion.circle
                cx={ap.x}
                cy={ap.y}
                r={9}
                fill="none"
                stroke={SEV.red}
                strokeWidth={2}
                initial={reduce ? false : { opacity: 0 }}
                animate={reduce ? { opacity: 0.5 } : { r: [9, 26], opacity: [0.7, 0] }}
                transition={reduce ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: "easeOut", delay: T.tooltip / 1000 }}
              />
            )}
            <circle cx={ap.x} cy={ap.y} r={ap.hot ? 5.5 : 4} fill={SEV[ap.sev]} stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} style={{ filter: `drop-shadow(0 0 6px ${SEV[ap.sev]})` }} />
            <text x={ap.x + 9} y={ap.y + 3.5} fill="rgba(255,255,255,0.85)" fontSize="9.5" fontFamily={ff.mono} fontWeight={700}>
              {ap.code}
            </text>
          </motion.g>
        ))}
      </svg>

      {/* ORD disruption tooltip — slides in last */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduce ? { duration: 0 } : { delay: T.tooltip / 1000, duration: 0.45, ease: EASE }}
        style={{
          position: "absolute",
          top: 34,
          left: 38,
          padding: "6px 9px",
          borderRadius: r.sm,
          background: "rgba(10,14,20,0.92)",
          border: `1px solid ${SEV.red}66`,
          maxWidth: 180,
          zIndex: 3,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: "#FBC2A7", fontFamily: ff.body }}>Chicago ORD — Ground Stop</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontFamily: ff.mono, marginTop: 1 }}>{cascading} flights affected</div>
      </motion.div>
    </div>
  )
}

// ── KPI strip ────────────────────────────────────────────────────────────
function Kpi({ reduce, label, value, fmt, delay }: { reduce: boolean; label: string; value: number; fmt: (n: number) => string; delay: number }) {
  const n = useCountUp(value, 1200, delay, !reduce)
  return (
    <div style={{ ...panel, padding: "8px 10px", flex: 1, minWidth: 92 }}>
      <div style={{ fontFamily: ff.mono, fontWeight: 700, fontSize: 19, color: "#E6EDF3", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmt(n)}</div>
      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", fontFamily: ff.body, marginTop: 2, letterSpacing: "0.02em" }}>{label}</div>
    </div>
  )
}

export function HeroMap() {
  const reduceMotion = useReducedMotion()
  const reduce = !!reduceMotion
  const [playKey, setPlayKey] = useState(0)

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: r.lg,
        overflow: "hidden",
        padding: 14,
        background:
          "radial-gradient(120% 80% at 28% -10%, rgba(242,84,45,0.12), transparent 55%), radial-gradient(100% 90% at 85% 110%, rgba(52,211,154,0.10), transparent 55%), #0A0E14",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
      }}
    >
      {/* faint noise/grid texture */}
      <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5, pointerEvents: "none" }}>
        <defs>
          <pattern id="heroDots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.05)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#heroDots)" />
      </svg>

      <div key={playKey} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.span
              style={{ width: 7, height: 7, borderRadius: r.full, background: SEV.green, display: "block", boxShadow: `0 0 8px ${SEV.green}` }}
              animate={reduce ? undefined : { opacity: [1, 0.35, 1], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <span style={{ fontFamily: ff.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#E6EDF3" }}>NIMBUS AIR · AOC</span>
            <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", fontFamily: ff.body }}>live simulation</span>
          </div>
          <button
            onClick={() => setPlayKey((k) => k + 1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: r.pill,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontFamily: ff.body,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <RotateCcw style={{ width: 11, height: 11 }} /> Replay
          </button>
        </div>

        {/* alert pill */}
        <Reveal reduce={reduce} delay={120} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: r.pill, background: "rgba(242,84,45,0.14)", border: `1px solid ${SEV.red}55`, alignSelf: "flex-start" }}>
          <AlertTriangle style={{ width: 13, height: 13, color: "#FBC2A7", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#FBC2A7", fontFamily: ff.body, letterSpacing: "0.02em" }}>ORD thunderstorm — 3 active disruptions cascading</span>
        </Reveal>

        {/* KPI strip */}
        <Reveal reduce={reduce} delay={200} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Kpi reduce={reduce} label="Flights at risk" value={147} fmt={(n) => `${Math.round(n)}`} delay={T.kpi} />
          <Kpi reduce={reduce} label="Pax affected" value={12480} fmt={(n) => Math.round(n).toLocaleString()} delay={T.kpi + 80} />
          <Kpi reduce={reduce} label="Recovery cost" value={2.4} fmt={(n) => `$${n.toFixed(1)}M`} delay={T.kpi + 160} />
          <Kpi reduce={reduce} label="On-time perf" value={82} fmt={(n) => `${Math.round(n)}%`} delay={T.kpi + 240} />
        </Reveal>

        {/* gauge + cascade */}
        <Reveal reduce={reduce} delay={T.gauge - 80} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 210px", minWidth: 210 }}>
            <Gauge reduce={reduce} />
          </div>
          <Cascade reduce={reduce} />
        </Reveal>

        {/* recovery stream */}
        <Reveal reduce={reduce} delay={T.stream - 80}>
          <Stream reduce={reduce} />
        </Reveal>

        {/* map */}
        <Reveal reduce={reduce} delay={T.mapBase - 100}>
          <NetworkMap reduce={reduce} />
        </Reveal>

        {/* footer line */}
        <Reveal reduce={reduce} delay={T.tooltip + 100} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { label: "153 on-time", color: SEV.green },
              { label: "31 delayed", color: SEV.amber },
              { label: "16 cancelled", color: SEV.red },
            ].map((p) => (
              <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 600, padding: "3px 8px", borderRadius: r.pill, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontFamily: ff.body }}>
                <span style={{ width: 6, height: 6, borderRadius: r.full, background: p.color }} />
                {p.label}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", fontFamily: ff.mono }}>4 plans · 8 FAR-117 flags · &lt;10ms CP-SAT</span>
        </Reveal>
      </div>
    </div>
  )
}
