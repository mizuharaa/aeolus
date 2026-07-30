"use client"
/**
 * GlobePlate — the event theatre's globe, drawn as an orthographic chart.
 *
 * This replaces `earth-globe-3d.tsx` (955 lines, three.js, 4.7MB of Earth
 * textures). That scene was a photoreal NASA blue marble, which DESIGN_NOTES
 * bans outright ("generic blue globe heroes"), and it carried five permanently
 * animating VFX rigs that were the source of the landing's flicker.
 *
 * What it is now: one raster pass over `earth-mask.png` — the same land/sea
 * mask the demo's CONUS plate already samples — projected orthographically in
 * the landing's night register. Dark disc, graphite land, a paper coastline
 * hairline, a 15° graticule. It reads as an operations chart rather than a
 * photograph of the planet, which is the register the rest of the page is in.
 *
 * Colours are canvas literals on purpose: per DESIGN.md, map surfaces do not
 * var() their pigments. They are the night register's values, listed in PLATE.
 *
 * MOTION: there is none. The plate is drawn once per orientation and never
 * touched again — no rAF loop, no shader clock, nothing to flicker. It redraws
 * only when the active event changes (the globe turns to face it) or the
 * element resizes. Selecting an event is a discrete, user-initiated change with
 * an end, not an idle animation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  GLOBE_EVENTS,
  globeEventRuntime,
  setGlobeEventIndex,
} from "@/components/landing/globe-events"
import { registerLandingFrame } from "@/lib/scroll"

/**
 * Night-register literals, as RGB triples so the per-pixel loop does not parse
 * colour strings. Land sits well clear of the ocean in value: at the first
 * attempt land was #33333E against a #15151B ocean and the continents were
 * almost invisible against the section's own near-black.
 */
const OCEAN = [0x12, 0x12, 0x18] as const
const LAND = [0x4a, 0x4a, 0x59] as const
const COAST = [0xe4, 0xe2, 0xdc] as const
const PLATE = {
  graticule: "rgba(244, 244, 242, 0.05)",
  limb: "rgba(244, 244, 242, 0.18)",
}

/** The mask's own resolution. Sampling it at 720x360 threw away half the
 *  coastline detail and gave the continents a visibly stepped edge. */
const MASK_W = 1600
const MASK_H = 800

/** Disc cap. The orbit box is ~790px tall on a desktop viewport and a disc that
 *  size bleeds off every edge of the section once GSAP scales the box 1.12. */
const MAX_DISC = 560
const DEG = Math.PI / 180

type LandLookup = (lat: number, lon: number) => boolean

let maskPromise: Promise<LandLookup> | null = null

/**
 * Load the land mask once per page and hand back a lat/lon predicate. Shared
 * across mounts — StrictMode double-invokes effects in development and this
 * would otherwise decode a 430KB PNG twice.
 */
function loadLandLookup(): Promise<LandLookup> {
  if (maskPromise) return maskPromise
  maskPromise = new Promise<LandLookup>((resolve, reject) => {
    const image = new Image()
    image.src = "/textures/earth-mask.png"
    image.onerror = () => reject(new Error("earth-mask.png failed to load"))
    image.onload = () => {
      const off = document.createElement("canvas")
      off.width = MASK_W
      off.height = MASK_H
      const context = off.getContext("2d", { willReadFrequently: true })
      if (!context) {
        reject(new Error("2d context unavailable"))
        return
      }
      context.drawImage(image, 0, 0, MASK_W, MASK_H)
      const pixels = context.getImageData(0, 0, MASK_W, MASK_H).data

      // Detect polarity rather than assume it: land is whichever class is in
      // the minority. Same test the demo's CONUS plate uses.
      let bright = 0
      let total = 0
      for (let index = 0; index < pixels.length; index += 4 * 16) {
        if (pixels[index] > 127) bright += 1
        total += 1
      }
      const landIsBright = bright / total < 0.5

      resolve((lat, lon) => {
        const u = ((lon + 180) / 360) * MASK_W
        const v = ((90 - lat) / 180) * MASK_H
        const x = u < 0 ? 0 : u > MASK_W - 1 ? MASK_W - 1 : u | 0
        const y = v < 0 ? 0 : v > MASK_H - 1 ? MASK_H - 1 : v | 0
        const isBright = pixels[(y * MASK_W + x) * 4] > 127
        return landIsBright ? isBright : !isBright
      })
    }
  })
  return maskPromise
}

/** Forward orthographic projection, in units of the disc radius. */
function project(lat: number, lon: number, lat0: number, lon0: number) {
  const phi = lat * DEG
  const lambda = (lon - lon0) * DEG
  const phi0 = lat0 * DEG
  const cosC =
    Math.sin(phi0) * Math.sin(phi) +
    Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda)
  return {
    x: Math.cos(phi) * Math.sin(lambda),
    y: Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda),
    // cosC < 0 means the point is on the far side of the sphere.
    visible: cosC >= 0,
  }
}

/**
 * Draw the disc. One pass, no animation. `land` is sampled per device pixel and
 * a pixel is coastline when it is land with at least one non-land neighbour —
 * which is what gives the plate its drawn-chart edge instead of a soft blob.
 */
function drawPlate(
  canvas: HTMLCanvasElement,
  size: number,
  lat0: number,
  lon0: number,
  land: LandLookup,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pixels = Math.max(1, Math.round(size * dpr))
  canvas.width = pixels
  canvas.height = pixels
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`

  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, pixels, pixels)

  const radius = pixels / 2
  const image = context.createImageData(pixels, pixels)
  const data = image.data
  const phi0 = lat0 * DEG
  const sinPhi0 = Math.sin(phi0)
  const cosPhi0 = Math.cos(phi0)

  // Inverse orthographic per pixel, plus a 1px neighbour test for the coastline.
  const isLandAt = (px: number, py: number) => {
    const nx = (px - radius) / radius
    const ny = (radius - py) / radius
    const rho2 = nx * nx + ny * ny
    if (rho2 > 1) return null
    const rho = Math.sqrt(rho2)
    const c = Math.asin(rho > 1 ? 1 : rho)
    const sinC = Math.sin(c)
    const cosC = Math.cos(c)
    const lat = Math.asin(cosC * sinPhi0 + (rho === 0 ? 0 : (ny * sinC * cosPhi0) / rho))
    const lon =
      lon0 +
      Math.atan2(nx * sinC, rho * cosPhi0 * cosC - ny * sinPhi0 * sinC) / DEG
    return land(lat / DEG, ((lon + 540) % 360) - 180)
  }

  for (let py = 0; py < pixels; py += 1) {
    for (let px = 0; px < pixels; px += 1) {
      const offset = (py * pixels + px) * 4
      const here = isLandAt(px, py)
      if (here === null) continue // outside the disc: stays transparent

      // A gentle limb darkening so the disc reads as a sphere, not a coin.
      const nx = (px - radius) / radius
      const ny = (radius - py) / radius
      const limb = 1 - Math.min(1, nx * nx + ny * ny) * 0.55

      let tone: readonly [number, number, number] | readonly number[]
      if (here) {
        const coast =
          isLandAt(px + 1, py) !== true ||
          isLandAt(px - 1, py) !== true ||
          isLandAt(px, py + 1) !== true ||
          isLandAt(px, py - 1) !== true
        tone = coast ? COAST : LAND
      } else {
        tone = OCEAN
      }
      data[offset] = tone[0] * limb
      data[offset + 1] = tone[1] * limb
      data[offset + 2] = tone[2] * limb
      data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  // Graticule + limb, drawn as vectors on top so they stay hairline-crisp.
  context.save()
  context.translate(radius, radius)
  context.lineWidth = Math.max(1, dpr * 0.5)
  context.strokeStyle = PLATE.graticule

  for (let lat = -75; lat <= 75; lat += 15) {
    context.beginPath()
    let started = false
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = project(lat, lon, lat0, lon0)
      if (!p.visible) {
        started = false
        continue
      }
      const x = p.x * radius
      const y = -p.y * radius
      if (started) context.lineTo(x, y)
      else {
        context.moveTo(x, y)
        started = true
      }
    }
    context.stroke()
  }

  for (let lon = -180; lon < 180; lon += 15) {
    context.beginPath()
    let started = false
    for (let lat = -90; lat <= 90; lat += 2) {
      const p = project(lat, lon, lat0, lon0)
      if (!p.visible) {
        started = false
        continue
      }
      const x = p.x * radius
      const y = -p.y * radius
      if (started) context.lineTo(x, y)
      else {
        context.moveTo(x, y)
        started = true
      }
    }
    context.stroke()
  }

  context.beginPath()
  context.arc(0, 0, radius - dpr * 0.5, 0, Math.PI * 2)
  context.strokeStyle = PLATE.limb
  context.lineWidth = Math.max(1, dpr)
  context.stroke()
  context.restore()
}

export function GlobePlate({
  onReady,
  onSelect,
}: {
  onReady?: () => void
  onSelect?: (index: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landRef = useRef<LandLookup | null>(null)
  const drawnRef = useRef<{ size: number; index: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(globeEventRuntime.activeIndex)
  const [size, setSize] = useState(0)
  // A real state flag, not a nudge: setSize(current => current) bails out of
  // rendering because the value is identical, so when the mask resolved after
  // the measure effect the plate was never drawn at all.
  const [landReady, setLandReady] = useState(false)

  const active = GLOBE_EVENTS[activeIndex] ?? GLOBE_EVENTS[0]
  /**
   * The globe turns to face the selected event, but deliberately does NOT
   * centre on it. Centring put the active mark exactly at the disc's middle,
   * which is also where the event headline sits — so the one mark that matters
   * was permanently underneath "Hub closure / Chicago". Offsetting the
   * projection centre north-east of the event pushes the mark into the disc's
   * lower-left quadrant, clear of the type and better composed than a bullseye.
   * Latitude is damped toward the equator so picking Keflavík does not tip the
   * disc onto its pole.
   */
  const lon0 = active.lon + 24
  const lat0 = Math.max(-30, Math.min(46, active.lat * 0.4 + 20))

  useEffect(() => {
    let cancelled = false
    loadLandLookup()
      .then((lookup) => {
        if (cancelled) return
        landRef.current = lookup
        drawnRef.current = null
        setLandReady(true)
        onReady?.()
      })
      .catch(() => onReady?.())
    return () => {
      cancelled = true
    }
  }, [onReady])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const box = wrap.getBoundingClientRect()
      setSize(Math.round(Math.min(box.width, box.height, MAX_DISC)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // Redraw only when the orientation or the box actually changed.
  useEffect(() => {
    const canvas = canvasRef.current
    const land = landRef.current
    if (!canvas || !land || size <= 0) return
    const previous = drawnRef.current
    if (previous && previous.size === size && previous.index === activeIndex) return
    drawPlate(canvas, size, lat0, lon0, land)
    drawnRef.current = { size, index: activeIndex }
  }, [activeIndex, landReady, lat0, lon0, size])

  // The feed and the plate share one selection. This mirrors the runtime the
  // rest of the scene already reads rather than introducing a second source.
  useEffect(() => {
    let seen = globeEventRuntime.version
    return registerLandingFrame(() => {
      if (globeEventRuntime.version === seen) return
      seen = globeEventRuntime.version
      setActiveIndex(globeEventRuntime.activeIndex)
    })
  }, [])

  const select = useCallback(
    (index: number) => {
      setGlobeEventIndex(index)
      setActiveIndex(index)
      onSelect?.(index)
    },
    [onSelect],
  )

  const marks = useMemo(
    () =>
      GLOBE_EVENTS.map((event, index) => {
        const p = project(event.lat, event.lon, lat0, lon0)
        return { event, index, ...p }
      }),
    [lat0, lon0],
  )

  return (
    <div ref={wrapRef} className="ae-plate">
      <div className="ae-plate-disc" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} className="ae-plate-canvas" aria-hidden />
        {/* Marks are DOM, not canvas: they must be focusable, hit-testable and
            announced. The canvas is decoration; this layer is the control. */}
        {size > 0
          ? marks.map(({ event, index, x, y, visible }) =>
              visible ? (
                <button
                  key={event.id}
                  type="button"
                  className="ae-plate-mark"
                  data-active={index === activeIndex}
                  aria-pressed={index === activeIndex}
                  style={{
                    left: `${(0.5 + x / 2) * 100}%`,
                    top: `${(0.5 - y / 2) * 100}%`,
                  }}
                  onClick={() => select(index)}
                >
                  <span className="ae-plate-ring" aria-hidden />
                  <span className="ae-plate-label">
                    {event.airport}
                    <small>{event.title}</small>
                  </span>
                </button>
              ) : null,
            )
          : null}
      </div>
    </div>
  )
}
