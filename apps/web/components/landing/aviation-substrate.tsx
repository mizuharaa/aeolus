"use client"
/**
 * AviationSubstrate — the ground the AEOLUS wordmark stands on.
 *
 * ── The brief: "the beige background looks really bland, add aviation effects,
 *    no AI slop icons" ───────────────────────────────────────────────────────
 *
 * The distinction that matters is between AVIATION ICONOGRAPHY and AVIATION
 * DRAFTING. Icons — a little plane, a cloud, a globe, a paper dart — are what
 * every generated page reaches for, they carry no information, and at the size
 * a background wants them they are just clip art at 8% opacity. What actually
 * looks like aviation is the DRAWING SYSTEM real charts are made of: a
 * graticule, a VOR compass rose with its degree ticks, great-circle airways
 * with named waypoints, and isogonic contour lines. None of those are pictures
 * of flying; they are the notation of it, which is why they read as authentic
 * rather than as decoration.
 *
 * Everything here is drawn from the same primitives an aeronautical chart uses,
 * at chart-plausible values: the compass rose is ticked every 10° with heavier
 * marks at the cardinals, the airways run as great-circle arcs rather than
 * straight lines, and the waypoints carry five-letter ICAO-style names.
 *
 * ── Motion ────────────────────────────────────────────────────────────────
 * Parallax is driven by SCROLL POSITION only, never by a clock. The landing
 * had two wall-clock sine wobbles in it (the hero's idle bob and the cabin
 * camera's "turbulence") and both read as the page shaking; adding a third
 * would undo that fix. At rest this layer is perfectly still.
 */

import { useEffect, useRef } from "react"
import { landingScroll, registerLandingFrame } from "@/lib/scroll"

/** Degree ticks around the compass rose, chart-style: long at the cardinals. */
function CompassRose({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const ticks = []
  for (let deg = 0; deg < 360; deg += 10) {
    const cardinal = deg % 90 === 0
    const major = deg % 30 === 0
    const len = cardinal ? 22 : major ? 14 : 8
    const a = ((deg - 90) * Math.PI) / 180
    ticks.push(
      <line
        key={deg}
        x1={cx + Math.cos(a) * r}
        y1={cy + Math.sin(a) * r}
        x2={cx + Math.cos(a) * (r - len)}
        y2={cy + Math.sin(a) * (r - len)}
        strokeWidth={cardinal ? 2 : major ? 1.4 : 0.9}
      />,
    )
  }
  return (
    <g stroke="currentColor" fill="none">
      <circle cx={cx} cy={cy} r={r} strokeWidth={1.4} />
      <circle cx={cx} cy={cy} r={r - 26} strokeWidth={0.8} />
      {ticks}
      {/* Cardinal labels, set in the chart's own mono voice. */}
      <g fill="currentColor" stroke="none" fontFamily="var(--ae-font-mono)" fontSize={20} fontWeight={600} textAnchor="middle">
        <text x={cx} y={cy - r + 46}>N</text>
        <text x={cx + r - 40} y={cy + 7}>E</text>
        <text x={cx} y={cy + r - 32}>S</text>
        <text x={cx - r + 40} y={cy + 7}>W</text>
      </g>
    </g>
  )
}

/** A great-circle airway: a quadratic arc with waypoint ticks along it. */
function Airway({
  d, waypoints,
}: {
  d: string
  waypoints: { x: number; y: number; name: string }[]
}) {
  return (
    <g>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.1} strokeDasharray="14 9" />
      {waypoints.map((w) => (
        <g key={w.name}>
          {/* Waypoints are drawn as the chart's open triangle, not a dot. */}
          <path
            d={`M${w.x} ${w.y - 6} L${w.x + 5.5} ${w.y + 4} L${w.x - 5.5} ${w.y + 4} Z`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
          />
          <text
            x={w.x + 11}
            y={w.y + 5}
            fill="currentColor"
            fontFamily="var(--ae-font-mono)"
            fontSize={11}
            letterSpacing="0.1em"
          >
            {w.name}
          </text>
        </g>
      ))}
    </g>
  )
}

export function AviationSubstrate() {
  const farRef = useRef<SVGGElement>(null)
  const nearRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const far = farRef.current
    const near = nearRef.current
    if (!far || !near) return

    const apply = () => {
      // Reduced motion gets the substrate, statically. It is texture, not
      // information, so holding it still costs nothing.
      const p = landingScroll.reducedMotion ? 0 : landingScroll.scenes.flight
      // Two depths, opposite signs — the parallax that makes a flat SVG read as
      // a plate the wordmark sits ON rather than a pattern printed behind it.
      far.style.transform = `translate3d(0, ${(p * -34).toFixed(2)}px, 0)`
      near.style.transform = `translate3d(0, ${(p * 62).toFixed(2)}px, 0)`
    }

    apply()
    return registerLandingFrame(apply)
  }, [])

  return (
    <div className="ae-substrate" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          {/* The graticule — meridians and parallels at chart spacing. */}
          <pattern id="ae-graticule" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="M96 0 L0 0 0 96" fill="none" stroke="currentColor" strokeWidth="0.7" />
          </pattern>
        </defs>

        {/* ── far plate ── */}
        <g ref={farRef} className="ae-substrate-far">
          <rect x={-200} y={-200} width={2000} height={1300} fill="url(#ae-graticule)" opacity={0.5} />
          {/* Isogonic lines — the long, slowly-curving contours that give a
              sectional its sense of a curved earth underneath. */}
          <g fill="none" stroke="currentColor" strokeWidth={1} opacity={0.72}>
            <path d="M-100 250 C 300 180, 700 300, 1100 210 S 1500 140, 1750 230" />
            <path d="M-100 430 C 320 360, 720 480, 1120 392 S 1520 322, 1760 410" />
            <path d="M-100 640 C 340 566, 740 686, 1140 598 S 1540 528, 1780 616" />
          </g>
        </g>

        {/* ── near plate ── */}
        <g ref={nearRef} className="ae-substrate-near">
          <CompassRose cx={1268} cy={286} r={196} />
          <Airway
            d="M-60 686 Q 420 470, 900 556 T 1720 396"
            waypoints={[
              { x: 292, y: 566, name: "OSKUR" },
              { x: 900, y: 556, name: "VANTH" },
              { x: 1364, y: 452, name: "ELDIR" },
            ]}
          />
          <Airway
            d="M170 -40 Q 300 320, 640 520 T 1180 900"
            waypoints={[{ x: 452, y: 404, name: "KAERO" }]}
          />
        </g>

      </svg>
      {/* ── THE GRAIN IS A TILE NOW, NOT A FULL-VIEWPORT FILTER ──────────────
          This was `<rect width=1600 height=900 filter="url(#ae-grain)">` —
          a live `feTurbulence` at 3 octaves stretched over the whole of a
          `position: fixed; inset: 0` layer. Chromium runs SVG filters on the
          CPU, on the main thread, over every device pixel of the rect, and the
          two plates above rewrite their transforms on every frame of the
          flight scene, so the whole noise field was regenerated with them.
          That is the per-pixel main-thread work that made the page freeze in
          proportion to screen size: at 2560x1440 @2x the rect covers 14.7M
          device pixels, and a CDP profile of this scroll band put 21,340ms of
          a 21,403ms window inside the compositor with 22ms of JS in it.

          The same texture out of a 180px tile is one filter pass on 32k
          pixels, cached and repeated — which is how the globe surface's grain
          has always been done in this file's own stylesheet. Same look, and it
          is now a sibling of the drawing rather than a child of it, which is
          why it still tooths the lines: it paints after the svg. */}
      <span className="ae-substrate-grain" aria-hidden />
    </div>
  )
}
