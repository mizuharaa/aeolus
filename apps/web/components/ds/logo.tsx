"use client"

/**
 * AeolusLogo — the Aeolus brand mark.
 *
 * A compact rounded-square tile (teal→deep-teal gradient, brand voltage) with
 * a two-tone origami jet (white wing + gold accent wing), wind streaks trailing
 * behind it (Aeolus = god of wind), and a ring of particles orbiting the tile.
 * Idle motion is subtle and continuous (banking jet, flowing wind, orbiting
 * + twinkling particles); on hover the whole mark springs up and the wind gusts
 * out — a responsive flourish. Honors prefers-reduced-motion (renders the
 * resting state with no animation).
 *
 * Used everywhere the wordmark appears (landing nav/footer, simulator nav,
 * docs, scenarios). The static resting state is mirrored in app/icon.svg for
 * the browser-tab favicon.
 *
 * The wordmark text ("Aeolus") stays at each call site — this is the mark only.
 */

import { motion, useReducedMotion } from "framer-motion"
import type { CSSProperties } from "react"

// Two-tone origami jet, drawn in a 24-unit box (centered ~12,12).
const JET_WHITE = "M2 9.6 L22 2 L11 13 Z"
const JET_GOLD = "M11 13 L22 2 L14.5 22 Z"

// Particle ring — symmetric around the tile center so the orbit spins true.
const PARTICLES = [
  { x: 16, y: 3.5, r: 1.3, fill: "#F59E0B", dur: 2.4 },
  { x: 28.5, y: 16, r: 1.1, fill: "#FFFFFF", dur: 3.1 },
  { x: 16, y: 28.5, r: 1.2, fill: "#5EEAD4", dur: 2.7 },
  { x: 3.5, y: 16, r: 1.0, fill: "#F59E0B", dur: 3.4 },
]

export function AeolusLogo({
  size = 32,
  radius,
  className,
  style,
}: {
  size?: number
  radius?: number
  className?: string
  style?: CSSProperties
}) {
  const reduce = !!useReducedMotion()
  const rad = radius ?? Math.round(size * 0.3)

  return (
    <motion.span
      className={className}
      aria-label="Aeolus"
      role="img"
      whileHover={reduce ? undefined : { scale: 1.07 }}
      transition={{ type: "spring", stiffness: 420, damping: 16 }}
      style={{
        display: "inline-flex",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: rad,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        background: "linear-gradient(135deg, #0D9488 0%, #064E45 55%, #042F2E 100%)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 2px 10px rgba(4,47,46,0.40)",
        ...style,
      }}
    >
      <svg viewBox="0 0 32 32" width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block" }}>
        <defs>
          <radialGradient id="ae-glow" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect width="32" height="32" fill="url(#ae-glow)" />

        {/* Particle ring — orbits the tile, each dot twinkling */}
        <motion.g
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          {PARTICLES.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.fill}
              animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
              transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            />
          ))}
        </motion.g>

        {/* Wind streaks — flow behind the jet; gust outward on hover */}
        <motion.g
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1.3}
          strokeLinecap="round"
          fill="none"
          whileHover={reduce ? undefined : { scaleX: 1.25, opacity: 1 }}
          style={{ transformBox: "fill-box", transformOrigin: "left center" }}
        >
          {[
            { d: "M3 20 q4 -1.4 8 -0.4", dash: "6 7", dur: 1.3, w: "rgba(94,234,212,0.75)" },
            { d: "M4 24 q3.5 -1.2 7 -0.6", dash: "5 7", dur: 1.6, w: "rgba(255,255,255,0.5)" },
            { d: "M2 16.5 q3 -1 6 -0.4", dash: "4 8", dur: 1.9, w: "rgba(245,158,11,0.7)" },
          ].map((s, i) => (
            <motion.path
              key={i}
              d={s.d}
              stroke={s.w}
              strokeDasharray={s.dash}
              animate={reduce ? undefined : { strokeDashoffset: [0, -13] }}
              transition={{ duration: s.dur, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </motion.g>

        {/* Origami jet — banks gently */}
        <motion.g
          animate={reduce ? undefined : { y: [0, -1.4, 0], rotate: [-3.5, 2.5, -3.5] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <g transform="translate(16 16) scale(0.82) translate(-12 -12)">
            <path d={JET_WHITE} fill="#FFFFFF" />
            <path d={JET_GOLD} fill="#F59E0B" />
            {/* nose glint */}
            <circle cx="21" cy="2.6" r="1.1" fill="#FFE7B3" />
          </g>
        </motion.g>
      </svg>
    </motion.span>
  )
}
