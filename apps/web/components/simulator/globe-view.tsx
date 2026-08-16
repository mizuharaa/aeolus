"use client"
/**
 * GlobeView — the simulator's globe register.
 *
 * The flat Leaflet map answers "where is this airport". The globe answers a
 * different question: what SHAPE does this disruption have across the network —
 * which corridors are carrying it, and how far from the epicentre has it
 * reached. Great-circle legs are the honest geometry for that; on a Mercator
 * tile a transcon leg is a straight line that lies about its own path.
 *
 * It is drawn on the console's PAPER register — the same warm stock and the
 * same grain as every panel beside it, not a white ball. See the PAPER block
 * below for why "white" was the wrong reading of the brief.
 *
 * It carries the same semantic pigments as the flat map, so switching views
 * never re-teaches the colour vocabulary — `cascColor` is passed in from the
 * map rather than reimplemented here, which is the mistake that put the map and
 * the timeline a full severity order apart once already.
 *
 * Canvas 2D, not R3F. The projection is ~10k sin/cos pairs a frame (about a
 * millisecond) and it is the exact code the landing globe already runs; a
 * three.js sphere would add a renderer, a lighting rig and a texture pipeline
 * to draw the same 10,468 stroked points less crisply.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  toVector, slerp, makeProjector, loadCoastlineRings, screenHeading,
  type Ring, type Vec3,
} from "@/lib/orthographic"
import { paperGrain } from "@/lib/paper-texture"
import { NIMBUS_AIRPORTS, airportTier, type AirportTier } from "./airports"
import type { ScheduledFlight, FlightState } from "@/stores/simulation"

/**
 * PAPER REGISTER — a printed chart, not a white ball.
 *
 * The first version of this took "white" literally: `#FFFFFF` sea, `#FAF7F1`
 * land, on a console whose page floor is `--ae-bg #F5F1E8`. Pure white against
 * warm beige does not read as white, it reads as a HOLE — a cold, untextured
 * disc punched out of the paper, with no material and no relationship to
 * anything around it.
 *
 * These values are the console's own surface tokens, so the globe is made of
 * the same stock as every panel next to it:
 *   sea  ≈ --ae-surface   #FFFEF9   (the card/panel floor)
 *   land ≈ --ae-surface-2 #EFE9DB   (the recessed well)
 * which is also the right way round for a chart: land is the tinted plate, sea
 * is the paper it is printed on. Land additionally carries the shared paper
 * grain, which is what separates "printed chart" from "vector diagram".
 */
/**
 * ── RE-INKED FOR THE CONSOLE REGISTER, 2026-08-16 ─────────────────────────
 *
 * Everything above describes the PAPER register, which the console left on
 * 2026-08-16 (see design.md). This file was missed in that pass, so the globe
 * kept rendering a cream sphere with near-black coastlines inside a near-black
 * console — the single most out-of-register surface in the product, and the
 * reason the globe view read as "no planes on it": the aircraft ARE drawn, in
 * dark ink, at 5px, on cream, inside a dark frame. Verified 39 of 39 flights
 * present in the DOM summary while nothing was legible on screen.
 *
 * The reasoning that chose these values is preserved, just inverted. A globe
 * that is pure `#000` on a `#08090C` floor would be the same HOLE the original
 * comment warns about, so the sphere is built from the console's own surface
 * tokens and reads as a lit body against the floor:
 *   sea  ≈ --ae-surface-2  #202530   (the recessed well)
 *   land ≈ --ae-surface-3  #2D3342   (the raised plate)
 * Land stays the LIGHTER of the two: on a chart the land is the printed plate
 * and the sea is the ground it sits on, and that relationship should survive
 * the register flip rather than invert with it.
 *
 * The name `PAPER` is kept because every call site below uses it and renaming
 * would touch 30 lines for no behavioural gain.
 */
const PAPER = {
  sea: "#202530",
  // The limb DARKENS toward the edge here rather than warming: on a dark floor
  // a lighter rim would read as a halo, which is the plastic look the original
  // comment was avoiding, arrived at from the other direction.
  seaRim: "#171B24",
  seaRimDeep: "#0E1119",
  land: "#2D3342",
  landHi: "#3A4152",
  coast: "rgba(226,232,245,0.52)",
  graticule: "rgba(226,232,245,0.085)",
  limb: "rgba(155,127,224,0.42)",
  route: "rgba(226,232,245,0.20)",
  shadow: "rgba(0,0,0,0.45)",
  // The sphere still needs somewhere to cast, but on near-black a cast shadow
  // is invisible — this is a faint plum bloom instead, which reads as the body
  // being lit rather than as a shadow being cast.
  dropShadow: "rgba(124,92,214,0.16)",
}

const TIER_R: Record<AirportTier, number> = { hub: 5.5, focus_city: 4.2, spoke: 3.2 }
// Imported from the map's palette in spirit — the same teals, re-inked up for
// the dark sphere exactly as MAP_COLORS was. These were #0B4F47 / #2F6D63 /
// #4A5D55, which measure 1.2–1.6:1 on #2D3342.
const TIER_FILL: Record<AirportTier, string> = {
  hub: "#5EE0C6", focus_city: "#33B49B", spoke: "#34A08C",
}

const ZOOM_MIN = 0.9
const ZOOM_MAX = 2.6
/** Opening camera. `0` returns here, which is the cheapest way back from a
 *  globe someone has spun to the far side of the planet. */
const DEFAULT_ZOOM = 1.14
const DEFAULT_LON = -96
const DEFAULT_LAT = 38

/**
 * A plane silhouette, drawn nose-up in a unit box and rotated to the leg's
 * SCREEN heading.
 *
 * The brief asked for the nodes to read as aircraft rather than as dots. A dot
 * carries position; a silhouette carries position AND direction, which on a
 * cascade map is the difference between "there is a flight here" and "this
 * flight is heading into the closed airport". Scaled by depth so aircraft on
 * the limb sit smaller, which is what sells the sphere.
 */
function planePath(context: CanvasRenderingContext2D, size: number) {
  const s = size
  context.beginPath()
  context.moveTo(0, -s)                       // nose
  context.lineTo(s * 0.26, -s * 0.16)         // right shoulder
  context.lineTo(s * 0.98, s * 0.30)          // right wingtip
  context.lineTo(s * 0.98, s * 0.50)
  context.lineTo(s * 0.24, s * 0.30)          // right wing root
  context.lineTo(s * 0.20, s * 0.74)          // right tailplane root
  context.lineTo(s * 0.52, s * 0.98)
  context.lineTo(s * 0.52, s * 1.10)
  context.lineTo(0, s * 0.92)                 // tail
  context.lineTo(-s * 0.52, s * 1.10)
  context.lineTo(-s * 0.52, s * 0.98)
  context.lineTo(-s * 0.20, s * 0.74)
  context.lineTo(-s * 0.24, s * 0.30)
  context.lineTo(-s * 0.98, s * 0.50)
  context.lineTo(-s * 0.98, s * 0.30)
  context.lineTo(-s * 0.26, -s * 0.16)
  context.closePath()
}

export type GlobeFlight = {
  id: string
  f: ScheduledFlight
  /** 0..1 along the leg, already clamped by the caller. */
  t: number
  color: string
  cancelled: boolean
  state: FlightState | undefined
  /**
   * What an APPLIED recovery plan did to this leg, if anything.
   *
   * The globe previously drew a track for a leg only when it was cancelled or
   * carried a cascade order — so applying a plan changed the aircraft's COLOUR
   * (swap plum, delayed gold) while the leg it was flying stayed trackless.
   * The whole point of the globe is showing what shape a disruption and its
   * recovery have across the network, and a recovery that moves aircraft
   * without drawing where they now go answers half the question.
   */
  action?: "cancelled" | "swapped" | "delayed" | null
}

export function GlobeView({
  flights,
  selectedFlight,
  onFlightSelect,
  eventAirports,
}: {
  flights: GlobeFlight[]
  selectedFlight: string | null
  onFlightSelect: (id: string | null) => void
  /** ICAOs at the epicentre of an active event — drawn with a pulse ring. */
  eventAirports: Set<string>
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ringsRef = useRef<Ring[] | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [reduced, setReduced] = useState(false)

  // North America centred — the modelled network is US domestic, so opening
  // anywhere else would make the operator drag before they can read anything.
  // Default zoom fits the WHOLE sphere: radius is `min(W,H)/2 * 0.86 * zoom`,
  // so anything above ~1.16 crops the poles. It opened at 1.55, which on a
  // tall map sliced the top of the globe off exactly where the search bar sits
  // — a deliberate-looking crop and a clipping bug are indistinguishable to
  // someone who did not write it, and the reading people land on is "broken".
  // Zooming past this is fine, because then it is the operator's own doing.
  const cam = useRef({
    lon: DEFAULT_LON, lat: DEFAULT_LAT, zoom: DEFAULT_ZOOM,
    targetLon: DEFAULT_LON, targetLat: DEFAULT_LAT, targetZoom: DEFAULT_ZOOM,
    velLon: 0, velLat: 0, dragging: false,
  })
  const pointer = useRef({ id: -1, x: 0, y: 0, moved: 0 })

  /** Screen positions of the last drawn aircraft, for hit-testing clicks. */
  const hits = useRef<{ id: string; x: number; y: number }[]>([])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadCoastlineRings()
      .then((rings) => { if (!cancelled) ringsRef.current = rings })
      .catch(() => { /* globe still renders as sphere + graticule + network */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === "undefined") return
    const measure = () => setBox({ w: wrap.offsetWidth, h: wrap.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  const airports = useMemo(
    () => Object.entries(NIMBUS_AIRPORTS).map(([icao, ap]) => ({
      icao, ap, v: toVector(ap.lat, ap.lon), tier: airportTier(icao),
    })),
    [],
  )

  const legs = useMemo(
    () => flights.flatMap((g) => {
      const o = NIMBUS_AIRPORTS[g.f.origin]
      const d = NIMBUS_AIRPORTS[g.f.destination]
      if (!o || !d) return []
      return [{ ...g, from: toVector(o.lat, o.lon), to: toVector(d.lat, d.lon) }]
    }),
    [flights],
  )

  /** Drag to turn, wheel to zoom. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || box.w <= 0) return

    const down = (e: PointerEvent) => {
      pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
      cam.current.dragging = true
      cam.current.velLon = 0
      cam.current.velLat = 0
      // Set the cursor on the NODE, not through React. `cam` is a ref precisely
      // so dragging does not re-render, which means a `cursor: dragging ? ... `
      // expression in JSX is evaluated once and never updates — the grab cursor
      // never became a grabbing cursor, so the globe gave no feedback that it
      // had taken the drag.
      canvas.style.cursor = "grabbing"
      canvas.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!cam.current.dragging || e.pointerId !== pointer.current.id) return
      const dx = e.clientX - pointer.current.x
      const dy = e.clientY - pointer.current.y
      pointer.current.x = e.clientX
      pointer.current.y = e.clientY
      pointer.current.moved += Math.abs(dx) + Math.abs(dy)
      const disc = Math.min(box.w, box.h)
      const perPixel = 180 / (disc * cam.current.zoom)
      const dLon = -dx * perPixel
      const dLat = dy * perPixel
      cam.current.targetLon += dLon
      cam.current.targetLat = Math.max(-80, Math.min(80, cam.current.targetLat + dLat))
      cam.current.lon += dLon
      cam.current.lat = Math.max(-80, Math.min(80, cam.current.lat + dLat))
      cam.current.velLon = dLon
      cam.current.velLat = dLat
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer.current.id) return
      cam.current.dragging = false
      canvas.style.cursor = "grab"
      pointer.current.id = -1
      // A drag must not also select whatever aircraft is under the release.
      if (pointer.current.moved <= 6) {
        const rect = canvas.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        let best: { id: string; d: number } | null = null
        for (const h of hits.current) {
          const d = Math.hypot(h.x - px, h.y - py)
          if (d < 14 && (!best || d < best.d)) best = { id: h.id, d }
        }
        onFlightSelect(best ? (best.id === selectedFlight ? null : best.id) : null)
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const next = cam.current.targetZoom * (e.deltaY > 0 ? 0.9 : 1.1)
      cam.current.targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next))
    }

    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerup", up)
    canvas.addEventListener("pointercancel", up)
    canvas.addEventListener("wheel", wheel, { passive: false })
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", up)
      canvas.removeEventListener("wheel", wheel)
    }
  }, [box.w, box.h, onFlightSelect, selectedFlight])

  /** Nudge the camera's zoom, clamped. Shared by the wheel, the keys and the
   *  on-screen buttons so all three can never drift apart. */
  const nudgeZoom = useCallback((factor: number) => {
    const c = cam.current
    c.targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, c.targetZoom * factor))
  }, [])

  /** Keyboard camera — the flat map has zoom buttons; this needs an equivalent. */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const c = cam.current
    const step = e.shiftKey ? 24 : 8
    if (e.key === "ArrowLeft") c.targetLon -= step
    else if (e.key === "ArrowRight") c.targetLon += step
    else if (e.key === "ArrowUp") c.targetLat = Math.min(80, c.targetLat + step)
    else if (e.key === "ArrowDown") c.targetLat = Math.max(-80, c.targetLat - step)
    else if (e.key === "+" || e.key === "=") nudgeZoom(1.15)
    else if (e.key === "-" || e.key === "_") nudgeZoom(0.87)
    else if (e.key === "0") { c.targetZoom = DEFAULT_ZOOM; c.targetLon = DEFAULT_LON; c.targetLat = DEFAULT_LAT }
    else if (e.key === "Escape") onFlightSelect(null)
    else return
    e.preventDefault()
  }, [onFlightSelect, nudgeZoom])

  // ── The frame loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || box.w <= 0 || box.h <= 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(box.w * dpr)
    canvas.height = Math.round(box.h * dpr)
    canvas.style.width = `${box.w}px`
    canvas.style.height = `${box.h}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let last = performance.now()

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const delta = Math.min((now - last) / 1000, 1 / 30)
      last = now

      const c = cam.current
      // Momentum, then damped approach to target. Reduced motion snaps.
      if (!c.dragging && !reduced) {
        if (Math.abs(c.velLon) > 0.0004 || Math.abs(c.velLat) > 0.0004) {
          c.targetLon += c.velLon
          c.targetLat = Math.max(-80, Math.min(80, c.targetLat + c.velLat))
          c.lon += c.velLon
          c.lat = Math.max(-80, Math.min(80, c.lat + c.velLat))
          const decay = Math.exp(-2.6 * delta)
          c.velLon *= decay
          c.velLat *= decay
        }
      }
      if (!c.dragging) {
        const ease = reduced ? 1 : 1 - Math.exp(-5 * delta)
        c.lon += (c.targetLon - c.lon) * ease
        c.lat += (c.targetLat - c.lat) * ease
      }
      c.zoom += (c.targetZoom - c.zoom) * (reduced ? 1 : 1 - Math.exp(-6 * delta))

      const W = canvas.width
      const H = canvas.height
      const radius = (Math.min(W, H) / 2) * 0.86 * c.zoom
      const cx = W / 2
      const cy = H / 2
      const project = makeProjector(c.lat, c.lon)
      const rings = ringsRef.current

      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(cx, cy)

      // ── the sheet the globe sits on ───────────────────────────────────
      // A soft contact shadow under the sphere. Without it the disc floats with
      // no relationship to the panel behind it, which is a large part of why
      // the white version read as a cut-out.
      ctx.save()
      ctx.beginPath()
      ctx.arc(0, radius * 0.045, radius * 1.005, 0, Math.PI * 2)
      ctx.filter = `blur(${Math.max(4, dpr * 9)}px)`
      ctx.fillStyle = PAPER.dropShadow
      ctx.fill()
      ctx.restore()

      // ── sphere body ───────────────────────────────────────────────────
      // Light from the upper left, falling off into a WARM rim. Two stops of
      // shade rather than one: a single stop gave a flat disc with a dark
      // outline, and the second stop is what actually turns the edge away from
      // the viewer.
      const fill = ctx.createRadialGradient(
        -radius * 0.32, -radius * 0.36, radius * 0.06, 0, 0, radius,
      )
      fill.addColorStop(0, "#FFFFFC")
      fill.addColorStop(0.55, PAPER.sea)
      fill.addColorStop(0.86, PAPER.seaRim)
      fill.addColorStop(1, PAPER.seaRimDeep)
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.clip()

      // Paper grain across the whole sphere — the shared tile, so the globe is
      // literally the same stock as the landing's. This is the single biggest
      // difference between "printed chart" and "vector diagram".
      const grain = paperGrain(ctx)
      if (grain) {
        ctx.save()
        ctx.fillStyle = grain
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
        ctx.restore()
      }

      // ── graticule every 15° ───────────────────────────────────────────
      ctx.strokeStyle = PAPER.graticule
      ctx.lineWidth = Math.max(1, dpr * 0.6)
      ctx.beginPath()
      for (let lat = -75; lat <= 75; lat += 15) {
        let pen = false
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(toVector(lat, lon))
          if (p.depth < 0) { pen = false; continue }
          const x = p.x * radius, y = -p.y * radius
          if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true }
        }
      }
      for (let lon = -180; lon < 180; lon += 15) {
        let pen = false
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = project(toVector(lat, lon))
          if (p.depth < 0) { pen = false; continue }
          const x = p.x * radius, y = -p.y * radius
          if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true }
        }
      }
      ctx.stroke()

      // ── landmasses ────────────────────────────────────────────────────
      if (rings) {
        ctx.beginPath()
        for (const ring of rings) {
          let pen = false
          for (let i = 0; i < ring.length; i += 2) {
            const p = project(toVector(ring[i + 1], ring[i]))
            if (p.depth < 0) { pen = false; continue }
            const x = p.x * radius, y = -p.y * radius
            if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true }
          }
        }
        // Land is the tinted plate. It takes its own light-to-shade ramp in the
        // same direction as the sphere, so continents on the far limb sit back
        // rather than staying uniformly bright and flattening the ball.
        const landFill = ctx.createRadialGradient(
          -radius * 0.32, -radius * 0.36, radius * 0.06, 0, 0, radius,
        )
        landFill.addColorStop(0, PAPER.landHi)
        landFill.addColorStop(0.7, PAPER.land)
        landFill.addColorStop(1, "#E0D7C2")
        ctx.fillStyle = landFill
        ctx.fill()

        // Grain again, clipped to the land, so the plate is a touch coarser
        // than the sea it prints on.
        if (grain) {
          ctx.save()
          ctx.clip()
          ctx.fillStyle = grain
          ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
          ctx.restore()
        }

        ctx.strokeStyle = PAPER.coast
        ctx.lineWidth = Math.max(1, dpr * 0.7)
        ctx.lineJoin = "round"
        ctx.stroke()
      }

      // ── flight legs ───────────────────────────────────────────────────
      // Trajectory first, aircraft on top, so a plane is never hidden under
      // another leg's track.
      const nextHits: { id: string; x: number; y: number }[] = []

      const strokeArc = (from: Vec3, to: Vec3, color: string, width: number, dash: number[] | null, alpha: number) => {
        ctx.beginPath()
        let pen = false
        for (let s = 0; s <= 1.0001; s += 0.025) {
          const p = project(slerp(from, to, s))
          if (p.depth < 0) { pen = false; continue }
          const x = p.x * radius, y = -p.y * radius
          if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true }
        }
        ctx.setLineDash(dash ?? [])
        ctx.globalAlpha = alpha
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // WHICH legs get a drawn track, and why not all of them.
      //
      // The first version stroked a full great-circle for every leg in the
      // fleet. On the nominal network that is 142 arcs over a 15-airport
      // domestic map — every one of them crossing the others — and the result
      // was a ball of yarn with the aircraft lost inside it. The flat map has
      // never done this: it draws IMPACT routes plus the selected arc, and
      // nothing else. Same rule here, so the two views agree about what a line
      // on screen means.
      //
      // A track therefore says "this leg is part of the disruption, or you
      // asked about it". An unaffected flight is just its aircraft.
      //
      // A leg is "affected" if the disruption reached it OR a plan moved it.
      // The `action` arm is the addition: applying a plan re-routes and delays
      // aircraft, and those are exactly the legs an operator has just decided
      // about, so they must be the ones carrying a drawn track.
      const isAffected = (g: typeof legs[number]) =>
        g.cancelled || (g.state?.cascade_order ?? -1) >= 0 || !!g.action

      for (const leg of legs) {
        const sel = leg.id === selectedFlight
        if (!sel && !isAffected(leg)) continue
        // A leg touched by an APPLIED PLAN is drawn in that plan's own colour
        // rather than in the neutral route grey, because it is no longer just
        // context — it is the outcome of a decision. Cancelled legs keep the
        // dashed "no longer operating" semantic they have on the flat map, so
        // the state is never colour-alone.
        const planned = !!leg.action && leg.action !== "cancelled"
        strokeArc(
          leg.from, leg.to,
          sel || planned ? leg.color : PAPER.route,
          sel ? dpr * 2.4 : planned ? dpr * 1.7 : Math.max(1, dpr * 0.8),
          leg.cancelled ? [dpr * 7, dpr * 5] : null,
          sel ? 0.95 : planned ? 0.85 : 0.55,
        )
      }

      for (const leg of legs) {
        const p = project(slerp(leg.from, leg.to, leg.t))
        if (p.depth < 0) continue
        const x = p.x * radius
        const y = -p.y * radius
        const sel = leg.id === selectedFlight
        // Fade and shrink toward the limb so aircraft sink over the horizon.
        const depth = Math.min(1, p.depth * 3.2)
        // Sized so the silhouette actually reads as an aircraft rather than as
        // a dot with corners. At 6.4 the wings were ~3px on a 300px-tall map,
        // which is the same information a circle carries.
        const size = (sel ? 12 : 8.6) * dpr * (0.62 + 0.38 * Math.min(1, p.depth * 1.6))
        const angle = screenHeading(project, leg.from, leg.to, leg.t)

        nextHits.push({ id: leg.id, x: (x + cx) / dpr, y: (y + cy) / dpr })

        ctx.save()
        ctx.translate(x, y)
        ctx.globalAlpha = depth

        // A contact shadow on the sphere under the aircraft. This is the one
        // cue that reads as "above the surface" in an orthographic projection,
        // where nothing else conveys altitude.
        ctx.save()
        ctx.translate(size * 0.5, size * 0.62)
        ctx.rotate(angle + Math.PI / 2)
        ctx.scale(1, 0.5)
        planePath(ctx, size * 0.92)
        ctx.fillStyle = PAPER.shadow
        ctx.fill()
        ctx.restore()

        // `+ PI/2` because the glyph is drawn nose-up (−y) and the heading is
        // measured from +x.
        ctx.rotate(angle + Math.PI / 2)
        // A LIT aircraft, not a flat fill. On the dark sphere a solid silhouette
        // reads as a hole punched in the globe; the bloom underneath makes it
        // read as a mark sitting above the surface and is what actually makes
        // the fleet findable at 8px. Selected legs get a stronger one.
        ctx.shadowColor = leg.color
        ctx.shadowBlur = (sel ? 14 : 7) * dpr
        planePath(ctx, size)
        ctx.fillStyle = leg.color
        ctx.fill()
        ctx.shadowBlur = 0
        // A DARK edge, not a paper one. The old paper-coloured hairline was
        // lighter than most marks it bounded, so on the dark sphere it read as
        // a halo and fattened every aircraft. Dark separates the fleet where it
        // bunches over a hub without adding apparent mass.
        ctx.strokeStyle = "rgba(8,9,12,0.72)"
        ctx.lineWidth = Math.max(1, dpr * 0.7)
        ctx.stroke()

        if (leg.cancelled) {
          // Struck out, exactly as on the flat map.
          ctx.rotate(-(angle + Math.PI / 2))
          ctx.beginPath()
          ctx.moveTo(-size * 0.85, -size * 0.85)
          ctx.lineTo(size * 0.85, size * 0.85)
          // Was #333935 — near-black on a near-black sphere, so the one mark
          // that says "this leg is not operating" was invisible.
          ctx.strokeStyle = "#D5DAE6"
          ctx.lineWidth = Math.max(1.2, dpr * 1.1)
          ctx.stroke()
        }
        if (sel) {
          ctx.rotate(-(angle + Math.PI / 2))
          ctx.beginPath()
          ctx.arc(0, 0, size * 1.9, 0, Math.PI * 2)
          // The console register's plum. #5B3FA8 measures 1.9:1 on this sphere.
          ctx.strokeStyle = "#B9A3EE"
          ctx.lineWidth = Math.max(1.5, dpr * 1.4)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        ctx.restore()
      }
      hits.current = nextHits

      // ── airports ──────────────────────────────────────────────────────
      for (const a of airports) {
        const p = project(a.v)
        if (p.depth < 0) continue
        const x = p.x * radius, y = -p.y * radius
        const r = TIER_R[a.tier] * dpr
        ctx.globalAlpha = Math.min(1, p.depth * 3.4)

        if (eventAirports.has(a.icao)) {
          ctx.beginPath()
          ctx.arc(x, y, r * 2.4, 0, Math.PI * 2)
          ctx.strokeStyle = "#9A6420"
          ctx.lineWidth = Math.max(1.5, dpr * 1.4)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = TIER_FILL[a.tier]
        ctx.fill()
        ctx.strokeStyle = PAPER.sea
        ctx.lineWidth = Math.max(1, dpr * 0.8)
        ctx.stroke()

        // Labels only for the tiers that carry the network's shape, and only
        // when there is room — 15 labels on a small globe is a wall of text.
        if ((a.tier === "hub" || a.tier === "focus_city") && radius > 150 * dpr) {
          ctx.font = `600 ${Math.round(9.5 * dpr)}px ui-monospace, monospace`
          ctx.textAlign = "center"
          // Airport codes sit over land, sea or the terminator depending on
          // rotation, so they carry their own dark backing stroke rather than
          // relying on whichever happens to be behind them. Paint order is
          // stroke-then-fill so the halo never eats the glyph.
          ctx.lineWidth = 3 * dpr
          ctx.strokeStyle = "rgba(8,9,12,0.85)"
          ctx.strokeText(a.ap.iata, x, y - r - 4 * dpr)
          ctx.fillStyle = "#F2F3F7"
          ctx.fillText(a.ap.iata, x, y - r - 4 * dpr)
        }
        ctx.globalAlpha = 1
      }

      ctx.restore()

      // limb ring on top, unclipped, so the horizon stays a clean drawn circle
      // — the printed edge of the plate.
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = PAPER.limb
      ctx.lineWidth = Math.max(1, dpr * 1.1)
      ctx.stroke()
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [box.w, box.h, legs, airports, selectedFlight, eventAirports, reduced])

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, background: "var(--ae-surface)" }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="application"
        aria-label={
          `Network globe — ${flights.length} flights across ${airports.length} airports. ` +
          `Arrow keys to rotate, plus and minus to zoom, Escape to clear the selection.`
        }
        style={{ display: "block", cursor: "grab", touchAction: "none", outline: "none" }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = "inset 0 0 0 3px var(--ae-focus)" }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = "none" }}
      />
      {/* ZOOM — the globe had none.
          Leaflet's +/- control unmounts with the map, so switching to the globe
          silently removed the only visible way to zoom. The wheel worked, but a
          control that exists only as an undiscoverable gesture is not a control
          — "can't zoom into the globe" is the correct reading of that UI.
          Same lane, same size and same order as Leaflet's, so zoom does not
          move when the projection changes. */}
      <div
        className="ae-globe-zoom"
        role="group"
        aria-label="Globe zoom"
        style={{
          position: "absolute", top: 66, right: 12, zIndex: 500,
          display: "flex", flexDirection: "column",
          borderRadius: 10, overflow: "hidden",
          border: "1px solid var(--ae-line)", boxShadow: "var(--ae-shadow-card-elev)",
          background: "var(--ae-surface)",
        }}
      >
        {([["+", "Zoom in", 1.18], ["−", "Zoom out", 0.85]] as const).map(([glyph, label, f], i) => (
          <button
            key={label}
            type="button"
            onClick={() => nudgeZoom(f)}
            aria-label={label}
            title={label}
            style={{
              width: 40, height: 36, border: "none", cursor: "pointer",
              background: "var(--ae-surface)", color: "var(--ae-text)",
              fontSize: 15, fontWeight: 500, lineHeight: 1,
              borderTop: i === 1 ? "1px solid var(--ae-line)" : undefined,
            }}
          >
            {glyph}
          </button>
        ))}
      </div>

      {/* The canvas cannot be read by assistive tech, so the same facts are
          available as text. This is not a duplicate control surface — the flat
          map view is the accessible way to work the network mark by mark, and
          the view switch is always reachable. */}
      <p className="sr-only">
        {flights.length} flights shown.{" "}
        {flights.filter((f) => f.cancelled).length} cancelled.
        Use the zoom buttons, or arrow keys to rotate and 0 to reset the view.
      </p>
    </div>
  )
}
