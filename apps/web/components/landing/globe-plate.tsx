"use client"
/**
 * GlobePlate — an interactive vector globe for the event theatre.
 *
 * ── Why vectors, not a raster ────────────────────────────────────────────────
 * The first version of this file rasterised an orthographic projection from
 * `earth-mask.png`: one inverse projection plus four neighbour lookups per
 * pixel, ~1.5M mask reads for a 560px disc. Fine for a still image, impossible
 * at 60fps, so it could not be dragged, zoomed or given inertia.
 *
 * This version projects 273 coastline rings (10,468 points) from
 * `world-coastline.json` every frame instead. That is ~10k sin/cos pairs —
 * around a millisecond — so rotation, zoom and momentum are all free, and the
 * coastline stays crisp at any zoom because it is stroked, not sampled.
 *
 * ── Motion ───────────────────────────────────────────────────────────────────
 * Everything moves on ONE damped model, driven by the shared landing clock:
 *
 *   drag        → angular velocity, released with inertia and exponential decay
 *   scroll      → target zoom and tilt, damped (never snapped) toward
 *   selection   → the globe eases around to face the chosen event
 *   flights     → nodes travel great-circle arcs between Nimbus stations
 *
 * This is continuous, low-frequency motion — a globe turning and aircraft
 * tracking across it. It is deliberately NOT the thing that was removed
 * earlier: no additive blending, no per-frame opacity churn, no `fract()`
 * cycles popping particles from 1 back to 0, nothing above ~0.3Hz. Under
 * `prefers-reduced-motion` the flights and the idle drift both stop and the
 * globe holds a single static orientation.
 *
 * Palette literals, not tokens: per DESIGN.md, map surfaces do not var() their
 * pigments.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  GLOBE_EVENTS,
  globeEventRuntime,
  setGlobeEventIndex,
} from "@/components/landing/globe-events"
import { landingScroll, registerLandingFrame } from "@/lib/scroll"

/** Night-register literals. Keep in step with the NIGHT object. */
const INK = {
  ocean: "#101016",
  oceanRim: "#1B1B24",
  land: "#2B2B36",
  coast: "rgba(232, 230, 224, 0.62)",
  graticule: "rgba(244, 244, 242, 0.06)",
  limb: "rgba(244, 244, 242, 0.2)",
  route: "rgba(244, 244, 242, 0.12)",
  plane: "#C9C6BE",
  event: "#E0457B",
}

const DEG = Math.PI / 180

/**
 * A paper grain, built once and tiled over the landmasses.
 *
 * The land was one flat fill, which is what made the globe read as a wireframe
 * diagram rather than as a printed chart — the rest of the landing is paper
 * stock and the one big object on the page had no surface at all. This is a
 * deterministic 128px tile of low-amplitude noise plus faint horizontal fibre,
 * multiplied over the base land colour at low alpha. Built once per page: it is
 * a static pattern, not a per-frame effect.
 */
let grainPattern: CanvasPattern | null = null
function paperGrain(context: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPattern) return grainPattern
  const tile = document.createElement("canvas")
  tile.width = 128
  tile.height = 128
  const g = tile.getContext("2d")
  if (!g) return null
  const image = g.createImageData(128, 128)
  // Deterministic LCG — a random() here would make the texture differ between
  // the server-rendered and client-rendered passes of any future SSR attempt.
  let seed = 1337
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  for (let y = 0; y < 128; y += 1) {
    const fibre = Math.sin(y * 0.7) * 5
    for (let x = 0; x < 128; x += 1) {
      const offset = (y * 128 + x) * 4
      const value = 150 + rand() * 74 + fibre
      image.data[offset] = value
      image.data[offset + 1] = value
      image.data[offset + 2] = value
      image.data[offset + 3] = 46
    }
  }
  g.putImageData(image, 0, 0)
  grainPattern = context.createPattern(tile, "repeat")
  return grainPattern
}
const MAX_DISC = 780
/**
 * The sphere's radius is `(canvas / 2) * BASE_RADIUS * zoom`, so BASE_RADIUS
 * has to leave headroom for the top of the zoom range or the globe is drawn
 * larger than the element holding it. At 0.94 × 1.85 the radius came to 539px
 * inside a 620px canvas — a 1078px sphere, clipped to a grey disc, with every
 * event mark projected outside the frame.
 */
const BASE_RADIUS = 0.7
const ZOOM_MIN = 1
const ZOOM_MAX = 1.34
/** Degrees per second of idle rotation, and how long after a drag it resumes. */
const IDLE_SPEED = 2.4
const IDLE_RESUME_DELAY = 2.5

type Ring = Float32Array
let ringsPromise: Promise<Ring[]> | null = null

function loadRings(): Promise<Ring[]> {
  if (ringsPromise) return ringsPromise
  ringsPromise = fetch("/data/world-coastline.json")
    .then((response) => response.json())
    .then((payload: { rings: number[][] }) =>
      payload.rings.map((ring) => Float32Array.from(ring)),
    )
  return ringsPromise
}

/** Nimbus stations the flight nodes track between, as [lat, lon]. */
const STATIONS: Record<string, [number, number]> = {
  ORD: [41.98, -87.9],
  JFK: [40.64, -73.78],
  LHR: [51.47, -0.45],
  KEF: [63.99, -22.61],
  SIN: [1.36, 103.99],
  MNL: [14.51, 121.02],
  LAX: [33.94, -118.41],
  NRT: [35.76, 140.39],
  DXB: [25.25, 55.36],
  GRU: [-23.43, -46.47],
  JNB: [-26.13, 28.24],
  SYD: [-33.94, 151.18],
}

/** Long-haul pairs, with a per-leg period in seconds. Varied on purpose: a
 *  fleet moving in lockstep reads as a screensaver, not as traffic. */
const LEGS: [keyof typeof STATIONS, keyof typeof STATIONS, number, number][] = [
  ["ORD", "LHR", 46, 0.0],
  ["JFK", "LHR", 41, 0.35],
  ["LAX", "NRT", 58, 0.12],
  ["SIN", "SYD", 44, 0.62],
  ["DXB", "SIN", 39, 0.28],
  ["LHR", "JNB", 54, 0.8],
  ["GRU", "JFK", 49, 0.5],
  ["MNL", "SIN", 33, 0.18],
  ["KEF", "ORD", 37, 0.72],
  ["NRT", "SIN", 43, 0.44],
]

type Vec3 = { x: number; y: number; z: number }

function toVector(lat: number, lon: number): Vec3 {
  const phi = lat * DEG
  const lambda = lon * DEG
  const cosPhi = Math.cos(phi)
  return {
    x: cosPhi * Math.cos(lambda),
    y: Math.sin(phi),
    z: cosPhi * Math.sin(lambda),
  }
}

/** Great-circle interpolation, so a leg follows the route a jet would fly. */
function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z
  dot = dot < -1 ? -1 : dot > 1 ? 1 : dot
  const omega = Math.acos(dot)
  if (omega < 1e-6) return a
  const sinOmega = Math.sin(omega)
  const wa = Math.sin((1 - t) * omega) / sinOmega
  const wb = Math.sin(t * omega) / sinOmega
  return {
    x: a.x * wa + b.x * wb,
    y: a.y * wa + b.y * wb,
    z: a.z * wa + b.z * wb,
  }
}

const PRECOMPUTED_LEGS = LEGS.map(([from, to, period, phase]) => ({
  from: toVector(...STATIONS[from]),
  to: toVector(...STATIONS[to]),
  period,
  phase,
}))

/**
 * Rotate a unit vector into view space and project it orthographically.
 * Returns screen offsets in disc-radius units plus the depth term; depth < 0
 * means the point is on the far side and must not be drawn.
 */
function makeProjector(lat0: number, lon0: number) {
  const cosLat = Math.cos(lat0 * DEG)
  const sinLat = Math.sin(lat0 * DEG)
  const cosLon = Math.cos(-lon0 * DEG)
  const sinLon = Math.sin(-lon0 * DEG)
  return (v: Vec3) => {
    // Yaw about the polar axis so `lon0` faces the camera. This yields three
    // axes and it matters which is which: `along` points at the viewer, `side`
    // is screen-horizontal, `up` is the polar direction. An earlier version
    // returned `along` as the screen x and used `side` as the depth — the two
    // swapped — so the globe faced 90° away from the requested longitude and
    // every projected mark landed outside the disc.
    const along = v.x * cosLon - v.z * sinLon // cosφ·cos(λ − lon0)
    const side = v.x * sinLon + v.z * cosLon // cosφ·sin(λ − lon0)
    const up = v.y

    // Then pitch by `lat0` about the screen-horizontal axis.
    return {
      x: side,
      y: up * cosLat - along * sinLat,
      depth: up * sinLat + along * cosLat,
    }
  }
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
  const markLayerRef = useRef<HTMLDivElement>(null)
  const ringsRef = useRef<Ring[] | null>(null)
  const [size, setSize] = useState(0)
  const [activeIndex, setActiveIndex] = useState(globeEventRuntime.activeIndex)

  /**
   * The whole camera lives in one mutable object read by the frame loop. React
   * state here would re-render on every pointer move; this is the same
   * framework-free motion pattern `landingScroll` uses.
   */
  const cam = useRef({
    lon: -60,
    lat: 22,
    zoom: 1,
    targetLon: -60,
    targetLat: 22,
    velLon: 0,
    velLat: 0,
    dragging: false,
    // Set true once the visitor drags; the globe then stops auto-facing the
    // selected event, because yanking the view out from under someone's hand
    // is the rudest thing an interactive globe can do.
    userAimed: false,
    // Seconds since the last interaction, for resuming the idle rotation.
    idleHold: 0,
  })

  const pointer = useRef({ id: -1, x: 0, y: 0, moved: 0 })

  useEffect(() => {
    let cancelled = false
    loadRings()
      .then((rings) => {
        if (cancelled) return
        ringsRef.current = rings
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
      // offsetWidth/Height, not getBoundingClientRect: the rect is POST
      // transform, and `.ae-globe-orbit` above us is scaled 0.86 → 1.06 by the
      // section's morph timeline. Measuring the rect fed that scale back into
      // the disc's own size, so the canvas shrank and grew with the tween on
      // top of being scaled by it — the sphere changed size for two reasons at
      // once. The layout box is the stable reference.
      setSize(
        Math.round(Math.min(wrap.offsetWidth, wrap.offsetHeight, MAX_DISC)),
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  /** Aim at an event unless the visitor has taken the wheel. */
  const aimAt = useCallback((index: number) => {
    const event = GLOBE_EVENTS[index]
    if (!event) return
    // Offset north-east of the site so its mark lands in the disc's lower-left
    // quadrant rather than under the centred headline.
    cam.current.targetLon = event.lon + 24
    cam.current.targetLat = Math.max(-30, Math.min(46, event.lat * 0.4 + 20))
    cam.current.userAimed = false
  }, [])

  useEffect(() => {
    aimAt(globeEventRuntime.activeIndex)
  }, [aimAt])

  // Mirror the shared selection runtime rather than owning a second copy.
  useEffect(() => {
    let seen = globeEventRuntime.version
    return registerLandingFrame(() => {
      if (globeEventRuntime.version === seen) return
      seen = globeEventRuntime.version
      setActiveIndex(globeEventRuntime.activeIndex)
      aimAt(globeEventRuntime.activeIndex)
    })
  }, [aimAt])

  const select = useCallback(
    (index: number) => {
      setGlobeEventIndex(index)
      setActiveIndex(index)
      aimAt(index)
      onSelect?.(index)
    },
    [aimAt, onSelect],
  )

  /** Drag to turn the globe, with momentum on release. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size <= 0) return

    const down = (event: PointerEvent) => {
      if (landingScroll.reducedMotion) return
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 }
      cam.current.dragging = true
      cam.current.velLon = 0
      cam.current.velLat = 0
      canvas.setPointerCapture(event.pointerId)
    }

    const move = (event: PointerEvent) => {
      if (!cam.current.dragging || event.pointerId !== pointer.current.id) return
      const dx = event.clientX - pointer.current.x
      const dy = event.clientY - pointer.current.y
      pointer.current.x = event.clientX
      pointer.current.y = event.clientY
      pointer.current.moved += Math.abs(dx) + Math.abs(dy)

      // Degrees per pixel scales with the disc so the surface tracks the finger
      // at roughly 1:1 regardless of size or zoom.
      const perPixel = 180 / (size * cam.current.zoom)
      const dLon = -dx * perPixel
      const dLat = dy * perPixel
      cam.current.targetLon += dLon
      cam.current.targetLat = Math.max(-72, Math.min(72, cam.current.targetLat + dLat))
      cam.current.lon += dLon
      cam.current.lat = Math.max(-72, Math.min(72, cam.current.lat + dLat))
      cam.current.velLon = dLon
      cam.current.velLat = dLat
      cam.current.userAimed = true
    }

    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer.current.id) return
      cam.current.dragging = false
      pointer.current.id = -1
    }

    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerup", up)
    canvas.addEventListener("pointercancel", up)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", up)
    }
  }, [size])

  const marks = useMemo(() => GLOBE_EVENTS.map((event) => toVector(event.lat, event.lon)), [])

  /** One frame: advance the camera, draw the globe, place the marks. */
  useEffect(() => {
    const canvas = canvasRef.current
    const layer = markLayerRef.current
    if (!canvas || !layer || size <= 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixels = Math.round(size * dpr)
    canvas.width = pixels
    canvas.height = pixels
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    const context = canvas.getContext("2d")
    if (!context) return

    const markNodes = Array.from(
      layer.querySelectorAll<HTMLElement>("[data-mark]"),
    )

    let onScreen = false
    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting
      },
      { rootMargin: "20% 0px" },
    )
    visibility.observe(canvas)

    const unregister = registerLandingFrame((time, delta) => {
      // Do nothing at all while the section is off screen. This loop projects
      // ~12,500 points (10,468 coastline + graticule + flight arcs) and it was
      // running on every frame of the entire page — the globe was costing its
      // full budget while the visitor was reading the pricing table. This is
      // the single biggest contributor to the page feeling heavy.
      if (!onScreen) return

      const rings = ringsRef.current
      const c = cam.current
      const reduced = landingScroll.reducedMotion
      const step = Math.min(delta, 1 / 30)

      // ── camera ──────────────────────────────────────────────────────────
      if (!c.dragging && !reduced) {
        // Momentum: carry the release velocity and bleed it off exponentially.
        if (Math.abs(c.velLon) > 0.0004 || Math.abs(c.velLat) > 0.0004) {
          c.targetLon += c.velLon
          c.targetLat = Math.max(-72, Math.min(72, c.targetLat + c.velLat))
          c.lon += c.velLon
          c.lat = Math.max(-72, Math.min(72, c.lat + c.velLat))
          const decay = Math.exp(-2.6 * step)
          c.velLon *= decay
          c.velLat *= decay
        } else {
          // Idle rotation. It used to run at 0.34°/s and only while the globe
          // had never been touched, which read as no idle animation at all —
          // a third of a degree per second is below the threshold where a
          // viewer registers movement. At 2.4°/s the planet is visibly turning
          // (a full revolution in about two and a half minutes) without ever
          // being fast enough to fight a reader.
          //
          // It also RESUMES: after a drag it waits out IDLE_RESUME_DELAY and
          // then picks the rotation back up from wherever the visitor left it,
          // instead of parking forever.
          c.idleHold = c.userAimed ? c.idleHold + step : 0
          if (!c.userAimed || c.idleHold > IDLE_RESUME_DELAY) {
            const ramp = c.userAimed
              ? Math.min(1, (c.idleHold - IDLE_RESUME_DELAY) / 1.4)
              : 1
            c.targetLon += step * IDLE_SPEED * ramp
          }
        }
      }

      if (!c.dragging) {
        const ease = reduced ? 1 : 1 - Math.exp(-4.5 * step)
        c.lon += (c.targetLon - c.lon) * ease
        c.lat += (c.targetLat - c.lat) * ease
      }

      // Scroll drives the push-in: the disc grows and levels off as the scene
      // takes the viewport. Damped, so a flick of the wheel never snaps it.
      const progress = reduced ? 1 : landingScroll.scenes.globe
      const targetZoom = ZOOM_MIN + (ZOOM_MAX - ZOOM_MIN) * Math.min(1, progress * 1.25)
      c.zoom += (targetZoom - c.zoom) * (reduced ? 1 : 1 - Math.exp(-3.2 * step))

      // ── draw ────────────────────────────────────────────────────────────
      const radius = (pixels / 2) * BASE_RADIUS * c.zoom
      const cx = pixels / 2
      const cy = pixels / 2
      const project = makeProjector(c.lat, c.lon)

      context.clearRect(0, 0, pixels, pixels)
      context.save()
      context.translate(cx, cy)

      // ocean body, with a rim gradient so the disc reads as a sphere
      const fill = context.createRadialGradient(
        -radius * 0.25,
        -radius * 0.3,
        radius * 0.1,
        0,
        0,
        radius,
      )
      fill.addColorStop(0, INK.oceanRim)
      fill.addColorStop(1, INK.ocean)
      context.beginPath()
      context.arc(0, 0, radius, 0, Math.PI * 2)
      context.fillStyle = fill
      context.fill()

      // Everything else is clipped to the disc, so a ring crossing the limb is
      // cut by the horizon instead of streaking across the section.
      context.clip()

      // graticule every 15°
      context.strokeStyle = INK.graticule
      context.lineWidth = Math.max(1, dpr * 0.6)
      context.beginPath()
      for (let lat = -75; lat <= 75; lat += 15) {
        let pen = false
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(toVector(lat, lon))
          if (p.depth < 0) {
            pen = false
            continue
          }
          const x = p.x * radius
          const y = -p.y * radius
          if (pen) context.lineTo(x, y)
          else {
            context.moveTo(x, y)
            pen = true
          }
        }
      }
      for (let lon = -180; lon < 180; lon += 15) {
        let pen = false
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = project(toVector(lat, lon))
          if (p.depth < 0) {
            pen = false
            continue
          }
          const x = p.x * radius
          const y = -p.y * radius
          if (pen) context.lineTo(x, y)
          else {
            context.moveTo(x, y)
            pen = true
          }
        }
      }
      context.stroke()

      // landmasses — filled, then stroked, so the coast reads as a drawn edge
      if (rings) {
        context.beginPath()
        for (const ring of rings) {
          let pen = false
          for (let index = 0; index < ring.length; index += 2) {
            const p = project(toVector(ring[index + 1], ring[index]))
            if (p.depth < 0) {
              pen = false
              continue
            }
            const x = p.x * radius
            const y = -p.y * radius
            if (pen) context.lineTo(x, y)
            else {
              context.moveTo(x, y)
              pen = true
            }
          }
        }
        context.fillStyle = INK.land
        context.fill()
        // Paper stock over the flat fill, clipped to the land itself so the
        // ocean stays smooth and the continents carry the grain.
        const grain = paperGrain(context)
        if (grain) {
          context.save()
          context.clip()
          context.fillStyle = grain
          context.fillRect(-radius, -radius, radius * 2, radius * 2)
          context.restore()
        }
        context.strokeStyle = INK.coast
        context.lineWidth = Math.max(1, dpr * 0.7)
        context.lineJoin = "round"
        context.stroke()
      }

      // ── flight nodes ────────────────────────────────────────────────────
      // Great-circle legs, drawn as a faint track plus a node in motion. The
      // node is a filled dot; nothing here blends additively or blinks.
      const flightTime = reduced ? 0 : time
      for (const leg of PRECOMPUTED_LEGS) {
        const a = project(leg.from)
        const b = project(leg.to)

        if (a.depth >= 0 || b.depth >= 0) {
          context.beginPath()
          let pen = false
          for (let s = 0; s <= 1.0001; s += 0.04) {
            const p = project(slerp(leg.from, leg.to, s))
            if (p.depth < 0) {
              pen = false
              continue
            }
            const x = p.x * radius
            const y = -p.y * radius
            if (pen) context.lineTo(x, y)
            else {
              context.moveTo(x, y)
              pen = true
            }
          }
          context.strokeStyle = INK.route
          context.lineWidth = Math.max(1, dpr * 0.5)
          context.stroke()
        }

        // Ping-pong along the leg so aircraft return rather than teleporting
        // back to the origin — a wrap would be a visible jump every period.
        const cycle = (leg.phase + flightTime / leg.period) % 1
        const t = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2
        const at = project(slerp(leg.from, leg.to, t))
        if (at.depth < 0) continue

        const x = at.x * radius
        const y = -at.y * radius
        // Fade toward the limb so nodes sink over the horizon instead of
        // vanishing at the edge.
        const alpha = Math.min(1, at.depth * 3.4)
        context.globalAlpha = alpha
        context.beginPath()
        context.arc(x, y, Math.max(1.6, dpr * 1.7), 0, Math.PI * 2)
        context.fillStyle = INK.plane
        context.fill()
        context.globalAlpha = 1
      }

      context.restore()

      // limb ring on top, unclipped, so the horizon stays a clean circle
      context.beginPath()
      context.arc(cx, cy, radius, 0, Math.PI * 2)
      context.strokeStyle = INK.limb
      context.lineWidth = Math.max(1, dpr)
      context.stroke()

      // ── event marks ─────────────────────────────────────────────────────
      // DOM, not canvas: they must be focusable, hit-testable and announced.
      for (let index = 0; index < markNodes.length; index += 1) {
        const node = markNodes[index]
        const p = project(marks[index])
        if (p.depth < 0) {
          if (node.style.visibility !== "hidden") node.style.visibility = "hidden"
          continue
        }
        if (node.style.visibility === "hidden") node.style.visibility = "visible"
        const x = (p.x * radius) / dpr + size / 2
        const y = (-p.y * radius) / dpr + size / 2
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
        node.style.opacity = String(Math.min(1, p.depth * 4))
      }
    })

    return () => {
      visibility.disconnect()
      unregister()
    }
  }, [marks, size])

  return (
    <div ref={wrapRef} className="ae-plate">
      <div className="ae-plate-disc" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} className="ae-plate-canvas" aria-hidden />
        <div ref={markLayerRef} className="ae-plate-marks">
          {GLOBE_EVENTS.map((event, index) => (
            <button
              key={event.id}
              type="button"
              data-mark
              className="ae-plate-mark"
              data-active={index === activeIndex}
              aria-pressed={index === activeIndex}
              onClick={() => {
                // Ignore the click that ends a drag.
                if (pointer.current.moved > 6) return
                select(index)
              }}
            >
              <span className="ae-plate-ring" aria-hidden />
              <span className="ae-plate-label">
                {event.airport}
                <small>{event.title}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
