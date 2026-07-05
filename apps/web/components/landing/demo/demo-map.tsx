"use client"
/**
 * DemoMap — the world plane the demo camera flies over.
 *
 * Layers, back to front:
 *   1. DotCanvas       dotted CONUS landmass, sampled from earth-mask.png
 *   2. route graph     faint always-on arcs for every flight (the network)
 *   3. cascade layer   pink hub routes, drawn out as the closure propagates
 *   4. reroute layer   teal re-flow arcs, drawn out as recovery commits
 *   5. airport nodes   the 15 Nimbus airports (KORD is the epicenter)
 *   6. flight layer    one DOM plane glyph per live flight, moved every frame
 *                      by the orchestrator's rAF loop (varied speeds; hub
 *                      flights hold amber, then reroute/release teal)
 *
 * Presentational only. Every animated node carries a dm-* class / data-i the
 * orchestrator targets. Under reduced motion the planes are placed once at a
 * believable stable frame and nothing moves.
 */

import { useEffect, useRef } from "react"
import {
  AIRPORTS,
  CASCADE_PATHS,
  FLIGHT_GEO,
  KORD,
  MASK_WINDOW,
  NET_PATHS,
  REROUTE_PATHS,
  WORLD_H,
  WORLD_W,
  bezAngle,
  bezPoint,
} from "@/components/landing/demo/demo-data"

function DotCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const g = canvas.getContext("2d")
    if (!g) return

    const img = new Image()
    img.src = "/textures/earth-mask.png"
    img.onload = () => {
      const mw = 720
      const mh = 360
      const off = document.createElement("canvas")
      off.width = mw
      off.height = mh
      const og = off.getContext("2d", { willReadFrequently: true })
      if (!og) return
      og.drawImage(img, 0, 0, mw, mh)
      const px = og.getImageData(0, 0, mw, mh).data

      // Land is the minority class — detect polarity, then sample.
      let bright = 0
      const stride = 16
      let total = 0
      for (let i = 0; i < px.length; i += 4 * stride) {
        if (px[i] > 127) bright++
        total++
      }
      const landIsBright = bright / total < 0.5

      const isLand = (lat: number, lon: number) => {
        const u = Math.min(mw - 1, Math.max(0, Math.round(((lon + 180) / 360) * mw)))
        const v = Math.min(mh - 1, Math.max(0, Math.round(((90 - lat) / 180) * mh)))
        const val = px[(v * mw + u) * 4] > 127
        return landIsBright ? val : !val
      }

      const { LON_MIN, LON_MAX, LAT_MIN, LAT_MAX } = MASK_WINDOW
      g.clearRect(0, 0, WORLD_W, WORLD_H)
      const step = 8
      for (let x = 0; x < WORLD_W; x += step) {
        for (let y = 0; y < WORLD_H; y += step) {
          const lon = LON_MIN + (x / WORLD_W) * (LON_MAX - LON_MIN)
          const lat = LAT_MAX - (y / WORLD_H) * (LAT_MAX - LAT_MIN)
          if (isLand(lat, lon)) {
            // gentle vertical depth: brighter toward the north, so the plane
            // floor reads as a lit surface rather than a flat field of dots
            const depth = 0.20 + 0.12 * (1 - y / WORLD_H)
            g.fillStyle = `rgba(70, 116, 158, ${depth})`
            g.beginPath()
            g.arc(x, y, 1.6, 0, Math.PI * 2)
            g.fill()
          }
        }
      }
    }
  }, [])

  return (
    <canvas
      ref={ref}
      width={WORLD_W}
      height={WORLD_H}
      style={{ position: "absolute", inset: 0, width: WORLD_W, height: WORLD_H }}
    />
  )
}

/** Swept plane silhouette, nose pointing +x so heading = rotate(angle). */
function PlaneGlyph() {
  return (
    <svg viewBox="0 0 20 20" width={15} height={15} style={{ display: "block", overflow: "visible" }}>
      <path
        d="M19 10 L2 3.4 L6.6 10 L2 16.6 Z"
        fill="currentColor"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DemoMap({ staticMode }: { staticMode: boolean }) {
  return (
    <div
      className="dm-world"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: WORLD_W,
        height: WORLD_H,
        transformOrigin: "0 0",
        willChange: "transform",
      }}
    >
      <DotCanvas />

      {/* route graph + cascade + reroute layers */}
      <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
        {/* always-on faint network */}
        <g className="dm-net">
          {NET_PATHS.map((d, i) => (
            <path key={`n${i}`} d={d} fill="none" stroke="rgba(11,36,52,0.10)" strokeWidth={1} strokeLinecap="round" />
          ))}
        </g>
        {/* cascade — hub routes flash pink as the closure spreads */}
        <g className="dm-cascade" style={{ opacity: staticMode ? 0 : 1 }}>
          {CASCADE_PATHS.map((d, i) => (
            <path
              key={`c${i}`}
              className="dm-c1"
              d={d}
              pathLength={1}
              fill="none"
              stroke="var(--dk-rose)"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeDasharray={1}
              strokeDashoffset={staticMode ? 1 : 1}
            />
          ))}
        </g>
        {/* reroute — teal re-flow arcs, drawn as recovery commits */}
        <g>
          {REROUTE_PATHS.map((d, i) => (
            <path
              key={`r${i}`}
              className="dm-rr"
              d={d}
              pathLength={1}
              fill="none"
              stroke="var(--dk-teal)"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeDasharray={1}
              strokeDashoffset={staticMode ? 0 : 1}
            />
          ))}
        </g>
      </svg>

      {/* airports */}
      {AIRPORTS.filter((a) => a.wave !== 0).map((a) => (
        <div
          key={a.code}
          className="dm-ap"
          data-wave={a.wave}
          style={{ position: "absolute", left: a.x, top: a.y, transform: "translate(-50%, -50%)" }}
        >
          <span
            className="dm-ap-dot"
            style={{
              display: "block",
              width: 7,
              height: 7,
              borderRadius: 99,
              border: "1.5px solid #7E98A8",
              background: "#FFFFFF",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 9,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "var(--ae-font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.08em",
              color: "var(--dk-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {a.code.slice(1)}
          </span>
        </div>
      ))}

      {/* KORD — the epicenter */}
      <div
        className="dm-kord"
        style={{ position: "absolute", left: KORD.x, top: KORD.y, transform: "translate(-50%, -50%)", zIndex: 6 }}
      >
        <span className="dm-kord-rings" style={{ opacity: staticMode ? 0 : 0 }} aria-hidden>
          <span className="dm-ring" />
          <span className="dm-ring dm-ring--late" />
        </span>
        <span
          className="dm-kord-dot"
          style={{
            position: "relative",
            display: "block",
            width: 12,
            height: 12,
            borderRadius: 99,
            border: "2px solid #7E98A8",
            background: "#FFFFFF",
          }}
        />
        <span
          style={{
            position: "absolute",
            top: 13,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "var(--ae-font-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--dk-text)",
            whiteSpace: "nowrap",
          }}
        >
          ORD
        </span>
      </div>

      {/* flight layer — one plane per live flight, moved by the rAF loop */}
      <div className="dm-flights" style={{ position: "absolute", inset: 0, zIndex: 7 }} aria-hidden>
        {FLIGHT_GEO.map((f, i) => {
          // static frame: place at phase along the reroute arc, teal + level
          const p = bezPoint(f.reroute, f.phase)
          const ang = bezAngle(f.reroute, f.phase)
          return (
            <div
              key={f.id}
              className="dm-plane"
              data-i={i}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                color: "var(--dk-teal)",
                transform: staticMode ? `translate(${p.x}px, ${p.y}px)` : "translate(-100px, -100px)",
                willChange: "transform",
              }}
            >
              <span
                className="dm-plane-hold"
                style={{
                  position: "absolute",
                  left: -9,
                  top: -9,
                  width: 18,
                  height: 18,
                  borderRadius: 99,
                  border: "1.5px solid var(--dk-amber)",
                  opacity: 0,
                }}
              />
              <span
                className="dm-plane-glyph"
                style={{ display: "block", margin: "-7px 0 0 -7px", transform: `rotate(${ang}deg)` }}
              >
                <PlaneGlyph />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
