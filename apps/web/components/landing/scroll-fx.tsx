"use client"
/**
 * Scroll effects for the landing page.
 *
 * PanIn — scroll-SCRUBBED horizontal entrance. The element's x/opacity are
 * pure functions of scroll position (no IntersectionObserver, no one-shot
 * trigger), so panning reverses naturally when the user scrolls back up.
 *
 * ScrollPlane — a huge top-view jet (the same silhouette as the simulator's
 * map markers) that flies across the page, its position, heading, and color
 * all driven by overall scroll progress. Scroll down: it departs the hero
 * render and sweeps left/right down the page. Scroll up: it flies the route
 * in reverse. Hidden below 960px and under prefers-reduced-motion.
 */

import { useRef, type CSSProperties, type ReactNode } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"

// ─── PanIn — scrubbed left/right entrance ────────────────────────────────

export function PanIn({
  from = "left",
  dist = 90,
  children,
  style,
  className,
}: {
  from?: "left" | "right"
  dist?: number
  children: ReactNode
  style?: CSSProperties
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    // 0 when the element's top crosses 98% of the viewport,
    // 1 when it crosses 60% — a short, snappy scrub window.
    offset: ["start 0.98", "start 0.6"],
  })
  const x = useTransform(scrollYProgress, [0, 1], [from === "left" ? -dist : dist, 0])
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])

  if (reduce) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <motion.div ref={ref} className={className} style={{ x, opacity, ...style }}>
      {children}
    </motion.div>
  )
}

// ─── ScrollPlane — the aircraft that flies the page ──────────────────────

// Flight plan: progress stops, position in vw/vh. It lifts off from the
// hero render (right column), sweeps left over the stats band, banks right
// across the capabilities gap, crosses back over "how it works", cuts
// through the ink CTA band (switching to paper), and departs top-right.
const STOPS = [0, 0.06, 0.24, 0.46, 0.66, 0.85, 1]
const XS = [64, 66, -16, 84, -18, 58, 114] // vw
const YS = [55, 47, 24, 58, 36, 60, 10] // vh

// Heading per stop, from travel direction. The glyph's nose points up, so
// facing direction (dx, dy) means rotate = atan2(dx, -dy). Angles are
// unwrapped so the plane banks through turns instead of spinning.
function headings(): number[] {
  const seg: number[] = []
  for (let i = 0; i < STOPS.length - 1; i++) {
    const dx = XS[i + 1] - XS[i]
    const dy = YS[i + 1] - YS[i]
    seg.push((Math.atan2(dx, -dy) * 180) / Math.PI)
  }
  const rot: number[] = []
  for (let i = 0; i < STOPS.length; i++) {
    let a = i === 0 ? seg[0] : i === STOPS.length - 1 ? seg[seg.length - 1] : (seg[i - 1] + seg[i]) / 2
    if (i > 0) {
      // unwrap toward the previous value
      while (a - rot[i - 1] > 180) a -= 360
      while (a - rot[i - 1] < -180) a += 360
    }
    rot.push(a)
  }
  return rot
}
const ROTS = headings()

// Same top-view jet silhouette the map markers use.
const JET_PATH =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"

export function ScrollPlane() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()

  const x = useTransform(scrollYProgress, STOPS, XS.map((v) => `${v}vw`))
  const y = useTransform(scrollYProgress, STOPS, YS.map((v) => `${v}vh`))
  const rotate = useTransform(scrollYProgress, STOPS, ROTS)
  // Invisible while the hero is at rest; fades in as the journey starts,
  // gone before the very end of the page.
  const opacity = useTransform(scrollYProgress, [0, 0.03, 0.08, 0.93, 0.99], [0, 0, 0.92, 0.92, 0])
  // Slight altitude breathing.
  const scale = useTransform(scrollYProgress, [0, 0.24, 0.46, 0.66, 1], [0.85, 1.1, 0.95, 1.12, 0.9])
  // Ink over the light registers; paper once it crosses into the ink CTA band.
  const color = useTransform(scrollYProgress, [0.82, 0.88], ["#0F1412", "#ECEEE9"])

  if (reduce) return null

  return (
    <motion.div
      aria-hidden
      className="ae-scroll-plane"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        x,
        y,
        rotate,
        scale,
        opacity,
        color,
        zIndex: 35,
        pointerEvents: "none",
        width: "clamp(220px, 24vw, 380px)",
        height: "clamp(220px, 24vw, 380px)",
        marginLeft: "calc(clamp(220px, 24vw, 380px) / -2)",
        marginTop: "calc(clamp(220px, 24vw, 380px) / -2)",
        filter: "drop-shadow(0 24px 32px rgba(15,20,18,0.18))",
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <path d={JET_PATH} fill="currentColor" />
        {/* teal wing accent — the identity color rides along */}
        <path d="M2 14l8-5v2l-8 5z" fill="#0D9488" opacity="0.85" />
      </svg>
    </motion.div>
  )
}
