"use client"
/**
 * GlobeCanvas — the landing's 3D centerpiece (react-three-fiber).
 *
 * A spinning dotted-land world (land points sampled client-side from
 * /textures/earth-mask.png) with great-circle flight arcs, paper-jet
 * aircraft traveling them, and a ripple ring that fires on every landing.
 *
 * Two modes, one scene:
 *   "hero"  — free spin, world routes, scroll (phaseRef 0..1) adds spin
 *             and a slight parallax sink.
 *   "story" — the recovery loop. phaseRef carries a scrubbed 0..4 phase:
 *             0→1 rotate/zoom to the US network · 1→2 KORD goes pink and
 *             its flights ground (epicenter ripples) · 2→3 dashed ghost
 *             plans shimmer teal · 3→4 the network re-routes back to teal.
 *
 * phaseRef is a plain mutable ref written by GSAP/Framer scroll handlers —
 * the scene reads it in useFrame, so scroll never re-renders React.
 */

import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import {
  useEffect, useMemo, useRef, useState,
  type CSSProperties, type MutableRefObject,
} from "react"

// ── Palette (canvas-side literals; keep in sync with design tokens) ──────
const SPHERE = "#2E86C9"
const SPHERE_DEEP = "#1E6FB2"
const DOT = "#EAF6FF"
const TEAL = "#2DD4BF"
const TEAL_DEEP = "#0D9488"
const PINK = "#F472B6"
const PINK_DEEP = "#EC4899"
const WHITE = "#FFFFFF"

const R = 1

// ── Geo helpers ──────────────────────────────────────────────────────────
function ll(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

function smoothstep(x: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const AIRPORTS: Record<string, [number, number]> = {
  KORD: [41.98, -87.9], KATL: [33.64, -84.43], KDFW: [32.9, -97.04],
  KLAX: [33.94, -118.41], KDEN: [39.86, -104.67], KJFK: [40.64, -73.78],
  KSEA: [47.45, -122.31], KMIA: [25.79, -80.29], KPHX: [33.43, -112.01],
  KLAS: [36.08, -115.15], KBOS: [42.36, -71.01], KSFO: [37.62, -122.38],
  KIAH: [29.98, -95.34], KDTW: [42.21, -83.35], KMSP: [44.88, -93.22],
  // world stations for the hero's long-haul arcs
  EGLL: [51.47, -0.45], RJTT: [35.55, 139.78], YSSY: [-33.95, 151.18],
  SBGR: [-23.44, -46.47], OMDB: [25.25, 55.36], LFPG: [49.01, 2.55],
}

type ArcSpec = { from: string; to: string; pink?: boolean; dur: number; offset: number; viaHub?: boolean }

const HERO_ARCS: ArcSpec[] = [
  { from: "KORD", to: "EGLL", dur: 9,  offset: 0.05 },
  { from: "KJFK", to: "LFPG", dur: 8,  offset: 0.45, pink: true },
  { from: "KLAX", to: "RJTT", dur: 11, offset: 0.25 },
  { from: "KDFW", to: "SBGR", dur: 10, offset: 0.7 },
  { from: "KSEA", to: "RJTT", dur: 10, offset: 0.55 },
  { from: "KMIA", to: "SBGR", dur: 8,  offset: 0.15, pink: true },
  { from: "KJFK", to: "OMDB", dur: 12, offset: 0.85 },
  { from: "YSSY", to: "KLAX", dur: 12, offset: 0.35 },
  { from: "EGLL", to: "KBOS", dur: 8,  offset: 0.62 },
  { from: "KORD", to: "KSFO", dur: 6,  offset: 0.5 },
  { from: "KATL", to: "KDEN", dur: 5,  offset: 0.1,  pink: true },
  { from: "OMDB", to: "EGLL", dur: 8,  offset: 0.9 },
]

const STORY_ARCS: ArcSpec[] = [
  { from: "KORD", to: "KJFK", dur: 5, offset: 0.1,  viaHub: true },
  { from: "KORD", to: "KATL", dur: 5, offset: 0.5,  viaHub: true },
  { from: "KORD", to: "KDEN", dur: 5, offset: 0.3,  viaHub: true },
  { from: "KORD", to: "KLAX", dur: 7, offset: 0.75, viaHub: true },
  { from: "KORD", to: "KBOS", dur: 5, offset: 0.9,  viaHub: true },
  { from: "KORD", to: "KMIA", dur: 6, offset: 0.2,  viaHub: true },
  { from: "KORD", to: "KSEA", dur: 7, offset: 0.6,  viaHub: true },
  { from: "KORD", to: "KDFW", dur: 5, offset: 0.42, viaHub: true },
  { from: "KATL", to: "KMIA", dur: 4, offset: 0.3 },
  { from: "KDEN", to: "KSFO", dur: 5, offset: 0.65 },
  { from: "KJFK", to: "KBOS", dur: 3, offset: 0.15 },
  { from: "KDFW", to: "KPHX", dur: 4, offset: 0.85 },
  { from: "KMSP", to: "KDTW", dur: 4, offset: 0.55 },
  { from: "KIAH", to: "KLAS", dur: 5, offset: 0.05 },
]

// Ghost "plan" reroutes shown during the solve beat (KORD traffic offloads).
const GHOST_ARCS: [string, string][] = [
  ["KDTW", "KJFK"], ["KMSP", "KDEN"], ["KDTW", "KBOS"], ["KMSP", "KSEA"],
]

function arcCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const dist = a.distanceTo(b)
  const mid = a.clone().add(b).normalize().multiplyScalar(R * (1 + dist * 0.32))
  return new THREE.QuadraticBezierCurve3(
    a.clone().multiplyScalar(1.008), mid, b.clone().multiplyScalar(1.008),
  )
}

// ── Paper-jet geometry: nose + two swept wings + a keel fold ─────────────
function paperJetGeometry(): THREE.BufferGeometry {
  const s = 0.016
  const nose: [number, number, number] = [0, 0, s * 1.7]
  const tailL: [number, number, number] = [-s, 0, -s]
  const tailR: [number, number, number] = [s, 0, -s]
  const spine: [number, number, number] = [0, s * 0.22, -s * 0.7]
  const keel: [number, number, number] = [0, -s * 0.5, -s * 0.7]
  const tris = [nose, tailL, spine, nose, spine, tailR, nose, keel, spine]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3))
  geo.computeVertexNormals()
  return geo
}

// ── Land dots — sampled from the equirectangular water mask ─────────────
function useLandDots() {
  const [positions, setPositions] = useState<Float32Array | null>(null)

  useEffect(() => {
    let alive = true
    const img = new Image()
    img.src = "/textures/earth-mask.png"
    img.onload = () => {
      if (!alive) return
      const W = 640, H = 320
      const cv = document.createElement("canvas")
      cv.width = W; cv.height = H
      const ctx = cv.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, W, H)
      const data = ctx.getImageData(0, 0, W, H).data
      const lum = (x: number, y: number) =>
        data[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4]

      // Polarity auto-detect: land covers ~29% of Earth, so whichever
      // class is the minority is land (mask conventions vary).
      let dark = 0
      const SAMPLES = 5000
      for (let i = 0; i < SAMPLES; i++) {
        if (lum((Math.random() * W) | 0, (Math.random() * H) | 0) < 128) dark++
      }
      const landIsDark = dark / SAMPLES < 0.5

      const pos: number[] = []
      const N = 34000
      const golden = Math.PI * (3 - Math.sqrt(5))
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2
        const rad = Math.sqrt(Math.max(0, 1 - y * y))
        const th = golden * i
        const x = Math.cos(th) * rad
        const z = Math.sin(th) * rad
        // invert the ll() mapping to find this point's lat/lon
        const lat = 90 - (Math.acos(y) * 180) / Math.PI
        let theta = Math.atan2(z, -x)
        if (theta < 0) theta += Math.PI * 2
        const lon = (theta * 180) / Math.PI - 180
        const px = Math.round(((lon + 180) / 360) * (W - 1))
        const py = Math.round(((90 - lat) / 180) * (H - 1))
        const isDark = lum(px, py) < 128
        if (isDark === landIsDark) pos.push(x * R, y * R, z * R)
      }
      setPositions(new Float32Array(pos))
    }
    return () => { alive = false }
  }, [])

  return positions
}

// ── Ripple ring pool (2 rings per emitter, retriggered on demand) ───────
class RippleEmitter {
  meshes: THREE.Mesh[] = []
  mats: THREE.MeshBasicMaterial[] = []
  start = -10
  size: number

  constructor(parent: THREE.Group, at: THREE.Vector3, color: string, size = 0.07) {
    this.size = size
    const normal = at.clone().normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      })
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), mat)
      mesh.position.copy(normal.clone().multiplyScalar(R * 1.006))
      mesh.quaternion.copy(q)
      mesh.scale.setScalar(0.001)
      mesh.renderOrder = 3
      parent.add(mesh)
      this.meshes.push(mesh)
      this.mats.push(mat)
    }
  }

  fire(now: number) { this.start = now }

  /** strength lets the story epicenter loop at full amplitude */
  update(now: number, strength = 1) {
    const LIFE = 1.5
    for (let i = 0; i < 2; i++) {
      const age = now - this.start - i * 0.33
      if (age > 0 && age < LIFE && strength > 0.01) {
        const k = age / LIFE
        this.meshes[i].scale.setScalar(0.015 + k * this.size)
        this.mats[i].opacity = (1 - k) * 0.75 * strength
      } else {
        this.mats[i].opacity = 0
      }
    }
  }

  dispose() {
    for (const m of this.meshes) { m.geometry.dispose(); m.removeFromParent() }
    for (const m of this.mats) m.dispose()
  }
}

// ── The scene ────────────────────────────────────────────────────────────
type Mode = "hero" | "story"

function GlobeScene({
  mode,
  phaseRef,
  reduced,
}: {
  mode: Mode
  phaseRef?: MutableRefObject<number>
  reduced: boolean
}) {
  const tiltRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const rippleGroupRef = useRef<THREE.Group>(null)
  const landDots = useLandDots()

  const arcSpecs = mode === "hero" ? HERO_ARCS : STORY_ARCS

  // Static geometry/material construction — one pass, disposed on unmount.
  const built = useMemo(() => {
    const jetGeo = paperJetGeometry()
    const arcs = arcSpecs.map((spec) => {
      const a = ll(...AIRPORTS[spec.from])
      const b = ll(...AIRPORTS[spec.to])
      const curve = arcCurve(a, b)
      const base = new THREE.Color(spec.pink ? PINK : TEAL)
      const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.0035, 6, false)
      const tubeMat = new THREE.MeshBasicMaterial({
        color: base.clone(), transparent: true, opacity: 0.8, depthWrite: false,
      })
      const jetMat = new THREE.MeshBasicMaterial({
        color: WHITE, transparent: true, opacity: 1, side: THREE.DoubleSide,
      })
      return {
        spec, curve, base, tubeGeo, tubeMat, jetMat,
        dest: b, t: spec.offset, lastT: spec.offset,
      }
    })

    const ghosts = GHOST_ARCS.map(([f, t]) => {
      const curve = arcCurve(ll(...AIRPORTS[f]), ll(...AIRPORTS[t]))
      const pts = curve.getPoints(60)
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = new THREE.LineDashedMaterial({
        color: "#D9FBF6", dashSize: 0.028, gapSize: 0.02, transparent: true, opacity: 0,
      })
      const line = new THREE.Line(geo, mat)
      line.computeLineDistances()
      return { line, mat }
    })

    const nodes = Object.entries(AIRPORTS)
      .filter(([code]) => mode === "hero" || code.startsWith("K"))
      .map(([code, [lat, lon]]) => ({
        code,
        pos: ll(lat, lon, R * 1.004),
        hub: code === "KORD" || code === "KATL" || code === "KDFW",
      }))

    return { jetGeo, arcs, ghosts, nodes }
  }, [arcSpecs, mode])

  // Ripple emitters live in a plain group managed imperatively.
  const emittersRef = useRef<RippleEmitter[]>([])
  const epicenterRef = useRef<RippleEmitter | null>(null)
  useEffect(() => {
    const g = rippleGroupRef.current
    if (!g) return
    emittersRef.current = built.arcs.map(
      (a) => new RippleEmitter(g, a.dest, a.spec.pink ? PINK : WHITE, 0.06),
    )
    if (mode === "story") {
      epicenterRef.current = new RippleEmitter(g, ll(...AIRPORTS.KORD), PINK, 0.11)
    }
    return () => {
      emittersRef.current.forEach((e) => e.dispose())
      emittersRef.current = []
      epicenterRef.current?.dispose()
      epicenterRef.current = null
    }
  }, [built, mode])

  // Dispose static geometry on unmount.
  useEffect(() => {
    return () => {
      built.jetGeo.dispose()
      built.arcs.forEach((a) => { a.tubeGeo.dispose(); a.tubeMat.dispose(); a.jetMat.dispose() })
      built.ghosts.forEach((g) => { g.line.geometry.dispose(); g.mat.dispose() })
    }
  }, [built])

  // US-front spin target (KORD centered on camera axis).
  const usFront = useMemo(() => {
    const v = ll(...AIRPORTS.KORD)
    return -Math.atan2(v.x, v.z)
  }, [])

  const jetRefs = useRef<(THREE.Mesh | null)[]>([])
  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpTan = useMemo(() => new THREE.Vector3(), [])
  const tmpLook = useMemo(() => new THREE.Vector3(), [])
  const pinkColor = useMemo(() => new THREE.Color(PINK_DEEP), [])

  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime
    const p = phaseRef?.current ?? 0
    const tilt = tiltRef.current
    const spin = spinRef.current
    if (!tilt || !spin) return

    // ── Rotation / framing ──
    if (mode === "hero") {
      const speed = reduced ? 0 : 0.05
      spin.rotation.y += delta * speed
      spin.rotation.y += 0 // scroll boost applied below via target
      tilt.rotation.x = 0.42
      // scroll (p ∈ 0..1): extra spin + gentle sink
      spin.rotation.y = (spin.rotation.y % (Math.PI * 2)) // keep bounded
      tilt.position.y = -p * 0.22
      spin.rotation.y += (p * 1.1 - (spin.userData.lastBoost ?? 0))
      spin.userData.lastBoost = p * 1.1
    } else {
      // blend from free spin into the US-front hold as the story begins
      const hold = smoothstep(p, 0.05, 0.9)
      if (!reduced) spin.userData.free = (spin.userData.free ?? usFront - 1.4) + delta * 0.05 * (1 - hold)
      const free = spin.userData.free ?? usFront
      const wobble = Math.sin(now * 0.12) * 0.02
      spin.rotation.y = free * (1 - hold) + (usFront + wobble) * hold
      tilt.rotation.x = 0.42 + hold * 0.24
      // zoom: in for the incident, breathe out on recovery — but keep the
      // full sphere inside the canvas so it reads as a floating world
      const zoomIn = smoothstep(p, 0.4, 1.4)
      const zoomOut = smoothstep(p, 3.2, 3.9)
      const s = 0.8 + zoomIn * 0.17 - zoomOut * 0.05
      tilt.scale.setScalar(s)
    }

    // ── Story phase factors ──
    // d: disruption engaged (KORD pink, flights grounded)
    // g: ghost plans visible (solve beat)
    // r: recovered (commit beat)
    const d = mode === "story" ? smoothstep(p, 1.05, 1.5) * (1 - smoothstep(p, 3.05, 3.6)) : 0
    const g = mode === "story" ? smoothstep(p, 2.05, 2.4) * (1 - smoothstep(p, 3.0, 3.4)) : 0

    // ── Arcs + jets + landing ripples ──
    for (let i = 0; i < built.arcs.length; i++) {
      const a = built.arcs[i]
      const affected = a.spec.viaHub ? d : 0

      a.tubeMat.color.copy(a.base).lerp(pinkColor, affected)
      a.tubeMat.opacity = 0.8 - (mode === "story" && !a.spec.viaHub ? 0.3 * d : 0)

      // jets slow to a hold while their hub is shut, resume on recovery
      const speed = reduced ? 0 : 1 - 0.92 * affected
      a.lastT = a.t
      a.t = (a.t + (delta * speed) / a.spec.dur) % 1

      const jet = jetRefs.current[i]
      if (jet) {
        a.curve.getPointAt(a.t, tmpPos)
        a.curve.getTangentAt(a.t, tmpTan)
        jet.position.copy(tmpPos)
        jet.up.copy(tmpPos).normalize()
        jet.lookAt(tmpLook.copy(tmpPos).add(tmpTan))
        a.jetMat.opacity = 1 - 0.9 * affected
      }

      // wrapped → landed → ripple
      if (a.lastT > a.t && emittersRef.current[i]) {
        emittersRef.current[i].fire(now)
      }
      emittersRef.current[i]?.update(now, 1 - affected)
    }

    // ── Ghost plan arcs (solve beat) ──
    for (const gh of built.ghosts) {
      gh.mat.opacity = g * (0.55 + 0.25 * Math.sin(now * 3))
    }

    // ── Epicenter ripple — loops while the disruption is live ──
    const epi = epicenterRef.current
    if (epi) {
      if (d > 0.05 && now - epi.start > 1.5) epi.fire(now)
      epi.update(now, d)
    }
  })

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[-2, 3, 4]} intensity={0.9} />

      <group ref={tiltRef} rotation={[0.42, 0, 0]}>
        <group ref={spinRef}>
          {/* base sphere */}
          <mesh>
            <sphereGeometry args={[R * 0.995, 64, 64]} />
            <meshStandardMaterial color={SPHERE} roughness={0.85} metalness={0} />
          </mesh>
          {/* deep tint toward the poles via a second, slightly smaller shell */}
          <mesh>
            <sphereGeometry args={[R * 0.994, 32, 32]} />
            <meshBasicMaterial color={SPHERE_DEEP} transparent opacity={0.25} />
          </mesh>

          {/* dotted land */}
          {landDots && (
            <points>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[landDots, 3]} />
              </bufferGeometry>
              <pointsMaterial
                color={DOT} size={0.0115} sizeAttenuation transparent opacity={0.9} depthWrite={false}
              />
            </points>
          )}

          {/* airport nodes */}
          {built.nodes.map((n) => (
            <mesh key={n.code} position={n.pos}>
              <sphereGeometry args={[n.hub ? 0.011 : 0.007, 10, 10]} />
              <meshBasicMaterial color={n.hub ? TEAL : DOT} />
            </mesh>
          ))}

          {/* flight arcs + jets */}
          {built.arcs.map((a, i) => (
            <group key={`${a.spec.from}-${a.spec.to}`}>
              <mesh geometry={a.tubeGeo} material={a.tubeMat} />
              <mesh
                ref={(el) => { jetRefs.current[i] = el }}
                geometry={built.jetGeo}
                material={a.jetMat}
              />
            </group>
          ))}

          {/* ghost plan reroutes */}
          {built.ghosts.map((gh, i) => (
            <primitive key={i} object={gh.line} />
          ))}

          {/* ripple rings */}
          <group ref={rippleGroupRef} />
        </group>
        {/* NOTE: no additive "atmosphere" shell — over a transparent canvas
            it composites as a gray dome. The halo is CSS, behind the canvas. */}
      </group>
    </>
  )
}

// ── Public component ─────────────────────────────────────────────────────
export function GlobeCanvas({
  mode = "hero",
  phaseRef,
  style,
  className,
}: {
  mode?: Mode
  phaseRef?: MutableRefObject<number>
  style?: CSSProperties
  className?: string
}) {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const camera = mode === "hero"
    ? { position: [0, 0, 2.65] as [number, number, number], fov: 42 }
    : { position: [0, 0.05, 2.55] as [number, number, number], fov: 42 }

  return (
    <div className={className} style={{ position: "relative", ...style }} aria-hidden>
      <Canvas
        camera={camera}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <group position={mode === "hero" ? [0, -0.2, 0] : [0, 0, 0]} scale={mode === "hero" ? 1.28 : 1}>
          <GlobeScene mode={mode} phaseRef={phaseRef} reduced={reduced} />
        </group>
      </Canvas>
    </div>
  )
}
