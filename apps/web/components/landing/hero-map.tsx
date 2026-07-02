"use client"

/**
 * HeroMap — Aeolus AOC instrument dashboard (landing hero, right column).
 *
 * A dark "mission control" reveal: on mount the panels fade+rise in a stagger,
 * KPI numbers count up, the Network Health gauge sweeps 0→68 synced to its
 * center number, the Cascade lines draw themselves, the Recovery Plans spring
 * in (and are interactive — click to apply), and the US map comes alive with
 * real aircraft silhouettes flying along arcs at different velocities, each
 * trailing a fading contrail + emitting ripples. Click any plane for a flight
 * readout + ripple burst. Replay re-fires the whole sequence. Honors
 * prefers-reduced-motion.
 *
 * Visual language mirrors the real simulator: the aircraft icon is the same
 * silhouette used in components/simulator/flight-map.tsx; cascade severity is
 * coral→mustard→yellow→forest; plan colors are A=gold B=indigo C=sky D=green
 * (per the simulator plan cards). Dark-theme glow variants of the status
 * tokens keep the severity gradient legible on near-black.
 */

import { motion, useReducedMotion } from "framer-motion"
import { Activity, DollarSign, Gauge, Leaf, Plane, ShieldCheck, RotateCcw, Users, Zap, MousePointerClick } from "lucide-react"
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { ff, r } from "@/lib/design-tokens"

// Dark-theme glow variants of the status palette (green→amber→red severity).
const SEV = { green: "#34D39A", amber: "#F4B740", red: "#F2542D" } as const
// Cascade severity glow (warmth = severity) — echoes flight-map MAP_COLORS.
const CASC = { direct: "#F2542D", order1: "#F4B740", order2: "#F4D35E", none: "#34D39A", reroute: "#22C55E" } as const
// Recovery plan colors — match the simulator plan cards.
const PLAN_COLOR = { A: "#FFD23F", B: "#6366F1", C: "#5DADE2", D: "#34D39A" } as const
// Real aircraft silhouette (identical path to the simulator map markers).
const PLANE_PATH =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"

const EASE = [0.22, 1, 0.36, 1] as const
const T = { kpi: 320, gauge: 520, lines: 760, linesDraw: 900, marker: 1700, plans: 980, map: 640, tooltip: 1750 }

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
        setVal(target * (1 - Math.pow(1 - p, 3)))
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

// ── geometry helpers (quadratic bezier arcs) ─────────────────────────────
type Pt = { x: number; y: number }
type Arc = { p0: Pt; pc: Pt; p2: Pt }
function makeArc(p0: Pt, p2: Pt, bend: number): Arc {
  const mx = (p0.x + p2.x) / 2
  const my = (p0.y + p2.y) / 2
  const dx = p2.x - p0.x
  const dy = p2.y - p0.y
  const len = Math.hypot(dx, dy) || 1
  return { p0, pc: { x: mx + (-dy / len) * bend * len, y: my + (dx / len) * bend * len }, p2 }
}
function bez(a: Arc, t: number): Pt {
  const u = 1 - t
  return { x: u * u * a.p0.x + 2 * u * t * a.pc.x + t * t * a.p2.x, y: u * u * a.p0.y + 2 * u * t * a.pc.y + t * t * a.p2.y }
}
function bezDeg(a: Arc, t: number): number {
  const u = 1 - t
  const dx = 2 * u * (a.pc.x - a.p0.x) + 2 * t * (a.p2.x - a.pc.x)
  const dy = 2 * u * (a.pc.y - a.p0.y) + 2 * t * (a.p2.y - a.pc.y)
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90
}

// ── Card chrome ──────────────────────────────────────────────────────────
const panel = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: r.md,
  backdropFilter: "blur(6px)",
} as const

function Reveal({ delay = 0, reduce, children, style }: { delay?: number; reduce: boolean; children: ReactNode; style?: CSSProperties }) {
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

function SectionLabel({ Icon, children, right }: { Icon: typeof Activity; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: ff.body, fontWeight: 600 }}>
        <Icon style={{ width: 12, height: 12, color: "rgba(255,255,255,0.55)" }} />
        {children}
      </span>
      {right}
    </div>
  )
}

// ── Network Health gauge ─────────────────────────────────────────────────
function GaugePanel({ reduce }: { reduce: boolean }) {
  const value = useCountUp(68, 1200, T.gauge, !reduce)
  const f = 68 / 100
  const theta = (180 - f * 180) * (Math.PI / 180)
  const tip = { x: 100 + 80 * Math.cos(theta), y: 100 - 80 * Math.sin(theta) }
  return (
    <div style={{ ...panel, padding: 12, display: "flex", flexDirection: "column" }}>
      <SectionLabel Icon={Gauge}>Network Health</SectionLabel>
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
            animate={{ strokeDashoffset: 32 }}
            transition={reduce ? { duration: 0 } : { duration: 1.2, delay: T.gauge / 1000, ease: EASE }}
          />
          <motion.circle
            cx={tip.x}
            cy={tip.y}
            r={5}
            fill="#FBE7A8"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduce ? { duration: 0 } : { delay: (T.gauge + 1200) / 1000, duration: 0.4 }}
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
const CHART = { w: 250, h: 116, padX: 6, padY: 10 }
function logisticPath(L: number, k: number, x0: number) {
  const n = 26
  const innerW = CHART.w - CHART.padX * 2
  const innerH = CHART.h - CHART.padY * 2
  return Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * 10
    const y = L / (1 + Math.exp(-k * (x - x0)))
    return `${i === 0 ? "M" : "L"}${(CHART.padX + (i / (n - 1)) * innerW).toFixed(1)},${(CHART.padY + innerH - (y / 100) * innerH).toFixed(1)}`
  }).join(" ")
}
const CASCADE = [
  { label: "2nd-order", color: CASC.order2, path: logisticPath(96, 0.8, 6.4) },
  { label: "1st-order", color: CASC.order1, path: logisticPath(80, 0.95, 4.4) },
  { label: "Direct", color: CASC.direct, path: logisticPath(58, 1.15, 2.4) },
]
const MARKER = (() => {
  const innerW = CHART.w - CHART.padX * 2
  const innerH = CHART.h - CHART.padY * 2
  const y = 80 / (1 + Math.exp(-0.95 * (6.2 - 4.4)))
  return { x: CHART.padX + 0.62 * innerW, y: CHART.padY + innerH - (y / 100) * innerH, val: Math.round(y) }
})()
function CascadePanel({ reduce }: { reduce: boolean }) {
  return (
    <div style={{ ...panel, padding: 12, position: "relative", flex: 1, minWidth: 200 }}>
      <SectionLabel Icon={Activity} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: ff.mono }}>t+0 → t+6h</span>}>
        Cascade Propagation
      </SectionLabel>
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
        <motion.g
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { delay: T.marker / 1000, duration: 0.4, ease: EASE }}
          style={{ transformOrigin: `${MARKER.x}px ${MARKER.y}px` }}
        >
          <circle cx={MARKER.x} cy={MARKER.y} r={3.5} fill="#0A0E14" stroke={CASC.order1} strokeWidth={2} />
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

// ── Recovery Plans — interactive, springy ────────────────────────────────
const PLANS = [
  { id: "A" as const, label: "Minimize Cost", sub: "Lowest exposure", Icon: DollarSign, bar: 0.62, metric: "$2.4M" },
  { id: "B" as const, label: "Min. Pax Impact", sub: "Best pax exp.", Icon: Users, bar: 0.78, metric: "31K px·m" },
  { id: "C" as const, label: "Protect Tmrw", sub: "Fewest next-day", Icon: ShieldCheck, bar: 0.9, metric: "0 OOP" },
  { id: "D" as const, label: "Green Recovery", sub: "Lowest CO₂", Icon: Leaf, bar: 0.7, metric: "−4.2t" },
]
function PlansPanel({ reduce }: { reduce: boolean }) {
  const [applied, setApplied] = useState<string>("A")
  return (
    <div style={{ ...panel, padding: 12 }}>
      <SectionLabel Icon={Activity} right={<span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: ff.mono }}>solved &lt;10ms · CP-SAT</span>}>
        Recovery Plans
      </SectionLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PLANS.map((p, i) => {
          const color = PLAN_COLOR[p.id]
          const on = applied === p.id
          return (
            <motion.button
              key={p.id}
              onClick={() => setApplied((cur) => (cur === p.id ? "" : p.id))}
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 20, delay: (T.plans + i * 90) / 1000 }}
              whileHover={reduce ? undefined : { y: -4, scale: 1.04 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              style={{
                flex: "1 1 110px",
                minWidth: 110,
                textAlign: "left",
                cursor: "pointer",
                padding: "9px 10px",
                borderRadius: r.md,
                background: on ? `${color}1f` : "rgba(255,255,255,0.025)",
                border: `1px solid ${on ? `${color}88` : "rgba(255,255,255,0.08)"}`,
                boxShadow: on ? `0 0 18px ${color}33` : "none",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: color, color: "#0A0E14", fontFamily: ff.mono, fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {p.id}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#E6EDF3", fontFamily: ff.body, lineHeight: 1.1 }}>{p.label}</span>
              </div>
              {/* animated cost/score bar */}
              <div style={{ position: "relative", height: 5, borderRadius: r.pill, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 5 }}>
                <motion.div
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${p.bar * 100}%` }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18, delay: (T.plans + 250 + i * 90) / 1000 }}
                  style={{ position: "absolute", inset: 0, borderRadius: r.pill, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, color: "rgba(255,255,255,0.45)", fontFamily: ff.body }}>
                  <p.Icon style={{ width: 9, height: 9 }} /> {p.sub}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: ff.mono, fontVariantNumeric: "tabular-nums" }}>{p.metric}</span>
              </div>
              {on && (
                <motion.span
                  initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  style={{ position: "absolute", top: 7, right: 8, fontSize: 8, fontWeight: 800, letterSpacing: "0.06em", color, fontFamily: ff.mono }}
                >
                  ✓ APPLIED
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ── US Network Status — interactive plane sim ────────────────────────────
const MAP_VB = { w: 620, h: 300 }
const US_OUTLINE =
  "M70,58 L62,108 L92,176 L168,196 L292,200 L312,214 L372,198 L500,206 L516,176 L548,128 L566,72 L430,50 L280,46 L132,54 Z"
const APX: Record<string, Pt & { hub?: boolean; hot?: boolean }> = {
  ORD: { x: 200, y: 92, hub: true, hot: true },
  SEA: { x: 110, y: 60, hub: false },
  DEN: { x: 240, y: 150, hub: false },
  DFW: { x: 300, y: 205, hub: false },
  ATL: { x: 430, y: 195, hub: true },
  JFK: { x: 540, y: 110, hub: true },
  LAX: { x: 150, y: 200, hub: false },
  MIA: { x: 500, y: 262, hot: false },
}
type Sev = keyof typeof CASC
type Plane = {
  id: string; arc: Arc; color: string; sev: Sev; tail: string; type: string; kt: number
  from: string; to: string; t: number; speed: number; x: number; y: number; deg: number
  trail: Pt[]; lastRipple: number; boostUntil: number
}
type Ripple = { id: number; x: number; y: number; color: string; age: number; life: number }
const ROUTE_DEFS: { from: string; to: string; sev: Sev; kt: number; tail: string; type: string; bend: number }[] = [
  { from: "ORD", to: "ATL", sev: "direct", kt: 488, tail: "N014NB", type: "B737-800", bend: -0.22 },
  { from: "ORD", to: "DFW", sev: "direct", kt: 452, tail: "N007NB", type: "A320", bend: 0.18 },
  { from: "ORD", to: "DEN", sev: "order1", kt: 430, tail: "N021NB", type: "E175", bend: 0.16 },
  { from: "DEN", to: "JFK", sev: "order1", kt: 505, tail: "N032NB", type: "B757-200", bend: -0.2 },
  { from: "DFW", to: "ATL", sev: "order2", kt: 410, tail: "N019NB", type: "A320", bend: 0.2 },
  { from: "ATL", to: "MIA", sev: "none", kt: 398, tail: "N003NB", type: "E175", bend: -0.16 },
  { from: "SEA", to: "DEN", sev: "none", kt: 466, tail: "N028NB", type: "B737-800", bend: 0.18 },
  { from: "ATL", to: "JFK", sev: "reroute", kt: 472, tail: "N011NB", type: "B737-800", bend: -0.24 },
  { from: "LAX", to: "DFW", sev: "order2", kt: 440, tail: "N025NB", type: "A320", bend: 0.16 },
]
const SEV_LABEL: Record<Sev, string> = { direct: "Direct impact", order1: "1st-order", order2: "2nd-order", none: "On-time", reroute: "Re-routed" }
function buildPlanes(): Plane[] {
  return ROUTE_DEFS.map((d, i) => {
    const p0 = APX[d.from]
    const p2 = APX[d.to]
    const arc = makeArc({ x: p0.x, y: p0.y }, { x: p2.x, y: p2.y }, d.bend)
    const t = (i / ROUTE_DEFS.length + 0.07) % 1
    const pos = bez(arc, t)
    return {
      id: `${d.from}-${d.to}`, arc, color: CASC[d.sev], sev: d.sev, tail: d.tail, type: d.type, kt: d.kt,
      from: d.from, to: d.to, t, speed: 0.085 + (d.kt - 380) / 380 * 0.11, x: pos.x, y: pos.y, deg: bezDeg(arc, t),
      trail: [], lastRipple: 0, boostUntil: 0,
    }
  })
}

function NetworkMap({ reduce }: { reduce: boolean }) {
  const planesRef = useRef<Plane[]>([])
  if (planesRef.current.length === 0) planesRef.current = buildPlanes()
  const ripplesRef = useRef<Ripple[]>([])
  const ridRef = useRef(1)
  const [, setTick] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [hintGone, setHintGone] = useState(false)

  useEffect(() => {
    if (reduce) return
    let raf = 0
    let prev: number | undefined
    let acc = 0
    const loop = (ts: number) => {
      if (prev === undefined) prev = ts
      const dt = Math.min((ts - prev) / 1000, 0.05)
      prev = ts
      for (const p of planesRef.current) {
        p.t += p.speed * (p.boostUntil > ts ? 2.6 : 1) * dt
        if (p.t > 1) p.t -= 1
        const pos = bez(p.arc, p.t)
        p.x = pos.x
        p.y = pos.y
        p.deg = bezDeg(p.arc, p.t)
        p.trail.push({ x: pos.x, y: pos.y })
        if (p.trail.length > 12) p.trail.shift()
        if (ts - p.lastRipple > 720) {
          ripplesRef.current.push({ id: ridRef.current++, x: pos.x, y: pos.y, color: p.color, age: 0, life: 1.3 })
          p.lastRipple = ts
        }
      }
      for (const rp of ripplesRef.current) rp.age += dt
      ripplesRef.current = ripplesRef.current.filter((rp) => rp.age < rp.life)
      acc += dt
      if (acc > 0.033) {
        setTick((n) => n + 1)
        acc = 0
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduce])

  function clickPlane(id: string) {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now()
    const p = planesRef.current.find((pl) => pl.id === id)
    if (p) {
      p.boostUntil = now + 1000
      for (let i = 0; i < 3; i++) ripplesRef.current.push({ id: ridRef.current++, x: p.x, y: p.y, color: p.color, age: -i * 0.13, life: 1.1 })
    }
    setHintGone(true)
    setSelected((s) => (s === id ? null : id))
  }

  const sel = selected ? planesRef.current.find((p) => p.id === selected) ?? null : null

  return (
    <div style={{ ...panel, padding: 0, position: "relative", overflow: "hidden", width: "100%", aspectRatio: `${MAP_VB.w} / ${MAP_VB.h}` }}>
      <div style={{ position: "absolute", top: 10, left: 12, zIndex: 3, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: ff.body, fontWeight: 600 }}>
        <Plane style={{ width: 12, height: 12 }} /> US Network Status
      </div>

      <svg
        viewBox={`0 0 ${MAP_VB.w} ${MAP_VB.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        onClick={() => setSelected(null)}
      >
        <defs>
          <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapGrid)" />
        <path d={US_OUTLINE} fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* faint route arcs */}
        {planesRef.current.map((p, i) => (
          <motion.path
            key={`arc-${p.id}`}
            d={`M${p.arc.p0.x},${p.arc.p0.y} Q${p.arc.pc.x},${p.arc.pc.y} ${p.arc.p2.x},${p.arc.p2.y}`}
            fill="none"
            stroke={p.color}
            strokeWidth={1}
            strokeDasharray="4 6"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: p.sev === "direct" ? 0.5 : 0.28 }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, delay: (T.map + i * 80) / 1000, ease: EASE }}
          />
        ))}

        {/* ripples (contrail wake) */}
        {!reduce &&
          ripplesRef.current.map((rp) => {
            if (rp.age < 0) return null
            const k = rp.age / rp.life
            return <circle key={rp.id} cx={rp.x} cy={rp.y} r={4 + k * 20} fill="none" stroke={rp.color} strokeWidth={1.4} opacity={(1 - k) * 0.5} />
          })}

        {/* plane trails */}
        {!reduce &&
          planesRef.current.map((p) =>
            p.trail.length > 1 ? (
              <polyline key={`tr-${p.id}`} points={p.trail.map((pt) => `${pt.x},${pt.y}`).join(" ")} fill="none" stroke={p.color} strokeWidth={2} strokeLinecap="round" opacity={0.3} />
            ) : null
          )}

        {/* airports */}
        {Object.entries(APX).map(([code, ap], i) => (
          <motion.g
            key={code}
            initial={reduce ? false : { opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { delay: (T.map + i * 70) / 1000, duration: 0.45, ease: EASE }}
            style={{ transformOrigin: `${ap.x}px ${ap.y}px` }}
          >
            {ap.hot && (
              <motion.circle
                cx={ap.x}
                cy={ap.y}
                r={12}
                fill="none"
                stroke={SEV.red}
                strokeWidth={1.6}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 0.55 }}
                transition={reduce ? { duration: 0 } : { duration: 0.5, delay: T.tooltip / 1000 }}
              />
            )}
            <circle cx={ap.x} cy={ap.y} r={ap.hot ? 5 : ap.hub ? 4 : 3.2} fill={ap.hot ? SEV.red : "#9DD9C9"} stroke="rgba(255,255,255,0.85)" strokeWidth={1.4} style={{ filter: `drop-shadow(0 0 5px ${ap.hot ? SEV.red : "#34D39A"})` }} />
            <text x={ap.x + 8} y={ap.y + 3.5} fill="rgba(255,255,255,0.82)" fontSize="9" fontFamily={ff.mono} fontWeight={700}>
              {code}
            </text>
          </motion.g>
        ))}

        {/* planes — real aircraft silhouette, click for fun */}
        {planesRef.current.map((p, i) => {
          const on = selected === p.id
          const R = on ? 11 : 8
          return (
            <motion.g
              key={`pl-${p.id}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduce ? { duration: 0 } : { delay: (T.map + 300 + i * 60) / 1000, duration: 0.5 }}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation()
                clickPlane(p.id)
              }}
            >
              <g transform={`translate(${p.x},${p.y})`}>
                <circle r={R + 9} fill="transparent" />
                {on && <circle r={R + 5} fill="none" stroke={p.color} strokeWidth={1.6} opacity={0.85} />}
                <circle r={R} fill={p.color} stroke="#fff" strokeWidth={1.6} style={{ filter: `drop-shadow(0 0 6px ${p.color}cc)` }} />
                <g transform={`rotate(${p.deg}) scale(${R * 0.072}) translate(-12,-12)`}>
                  <path d={PLANE_PATH} fill="#fff" />
                </g>
              </g>
            </motion.g>
          )
        })}
      </svg>

      {/* ORD ground-stop tooltip */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduce ? { duration: 0 } : { delay: T.tooltip / 1000, duration: 0.45, ease: EASE }}
        style={{ position: "absolute", top: `${(APX.ORD.y / MAP_VB.h) * 100}%`, left: `${(APX.ORD.x / MAP_VB.w) * 100}%`, transform: "translate(8px, -120%)", padding: "5px 8px", borderRadius: r.sm, background: "rgba(10,14,20,0.92)", border: `1px solid ${SEV.red}66`, zIndex: 2, pointerEvents: "none" }}
      >
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "#FBC2A7", fontFamily: ff.body }}>Chicago ORD — Ground Stop</div>
        <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.55)", fontFamily: ff.mono, marginTop: 1 }}>47 flights affected</div>
      </motion.div>

      {/* selected-plane readout card */}
      {sel && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          style={{ position: "absolute", top: `${(sel.y / MAP_VB.h) * 100}%`, left: `${(sel.x / MAP_VB.w) * 100}%`, transform: "translate(-50%, calc(-100% - 16px))", minWidth: 132, padding: "7px 9px", borderRadius: r.sm, background: "rgba(10,14,20,0.95)", border: `1px solid ${sel.color}88`, boxShadow: `0 6px 20px ${sel.color}33`, zIndex: 4, pointerEvents: "none" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: r.full, background: sel.color, boxShadow: `0 0 6px ${sel.color}` }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#E6EDF3", fontFamily: ff.mono }}>{sel.tail}</span>
            <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.5)", fontFamily: ff.body }}>{sel.type}</span>
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.7)", fontFamily: ff.mono }}>
            {sel.from} → {sel.to} · {sel.kt} kt
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: sel.color, fontFamily: ff.body, marginTop: 1 }}>{SEV_LABEL[sel.sev]}</div>
        </motion.div>
      )}

      {/* click hint — appears once, fades out */}
      {!reduce && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: hintGone ? 0 : [0, 0.75, 0.75, 0] }}
          transition={hintGone ? { duration: 0.3 } : { delay: T.tooltip / 1000 + 0.4, duration: 6, times: [0, 0.08, 0.85, 1] }}
          style={{ position: "absolute", bottom: 8, right: 10, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, color: "rgba(255,255,255,0.55)", fontFamily: ff.body, zIndex: 2, pointerEvents: "none" }}
        >
          <MousePointerClick style={{ width: 11, height: 11 }} /> click a plane
        </motion.div>
      )}
    </div>
  )
}

// ── KPI strip ────────────────────────────────────────────────────────────
function Kpi({ reduce, label, value, fmt, delay, Icon }: { reduce: boolean; label: string; value: number; fmt: (n: number) => string; delay: number; Icon: typeof Plane }) {
  const n = useCountUp(value, 1200, delay, !reduce)
  return (
    <div style={{ ...panel, padding: "8px 10px", flex: 1, minWidth: 92 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
        <Icon style={{ width: 11, height: 11, color: "rgba(255,255,255,0.4)" }} />
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", fontFamily: ff.body, letterSpacing: "0.02em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: ff.mono, fontWeight: 700, fontSize: 19, color: "#E6EDF3", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmt(n)}</div>
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
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Plane style={{ width: 12, height: 12, color: "#E6EDF3" }} />
            </span>
            <span style={{ fontFamily: ff.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#E6EDF3" }}>NIMBUS AIR · AOC</span>
          </div>
          <button
            onClick={() => setPlayKey((k) => k + 1)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: r.pill, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontFamily: ff.body, fontSize: 10, fontWeight: 600 }}
          >
            <RotateCcw style={{ width: 11, height: 11 }} /> Replay
          </button>
        </div>

        {/* disruption banner — mirrors the real DisruptionBanner */}
        <Reveal reduce={reduce} delay={120} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 11px", borderRadius: r.pill, background: "rgba(242,84,45,0.16)", border: `1px solid ${SEV.red}66`, alignSelf: "flex-start" }}>
          <Zap style={{ width: 13, height: 13, color: "#FBC2A7", flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FBC2A7", fontFamily: ff.body }}>Disruption Active</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "#FDBA8C", fontFamily: ff.body }}>ORD thunderstorm</span>
          <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 7px", borderRadius: r.pill, background: `${SEV.red}40`, color: "#FCA5A5", fontFamily: ff.mono }}>3</span>
        </Reveal>

        {/* KPI strip */}
        <Reveal reduce={reduce} delay={200} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Kpi reduce={reduce} Icon={Plane} label="Flights at risk" value={147} fmt={(n) => `${Math.round(n)}`} delay={T.kpi} />
          <Kpi reduce={reduce} Icon={Users} label="Pax affected" value={12480} fmt={(n) => Math.round(n).toLocaleString()} delay={T.kpi + 80} />
          <Kpi reduce={reduce} Icon={DollarSign} label="Recovery cost" value={2.4} fmt={(n) => `$${n.toFixed(1)}M`} delay={T.kpi + 160} />
          <Kpi reduce={reduce} Icon={Activity} label="On-time perf" value={82} fmt={(n) => `${Math.round(n)}%`} delay={T.kpi + 240} />
        </Reveal>

        {/* gauge + cascade */}
        <Reveal reduce={reduce} delay={T.gauge - 80} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 210px", minWidth: 210 }}>
            <GaugePanel reduce={reduce} />
          </div>
          <CascadePanel reduce={reduce} />
        </Reveal>

        {/* recovery plans */}
        <Reveal reduce={reduce} delay={T.plans - 80}>
          <PlansPanel reduce={reduce} />
        </Reveal>

        {/* map */}
        <Reveal reduce={reduce} delay={T.map - 100}>
          <NetworkMap reduce={reduce} />
        </Reveal>

        {/* footer */}
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, color: "rgba(255,255,255,0.4)", fontFamily: ff.mono }}>
            <ShieldCheck style={{ width: 11, height: 11 }} /> 8 FAR-117 flags
          </span>
        </Reveal>
      </div>
    </div>
  )
}
