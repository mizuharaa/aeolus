"use client"
/**
 * HeroPlane3D — a smooth cartoonish widebody airliner (three.js), styled
 * after the reference livery: long white fuselage over a dark ink belly with
 * an amber waterline pinstripe, dark tail fin carrying the cobalt / violet /
 * amber ribbons, slender swept wings, underslung engines. No text anywhere.
 *
 * Choreography (revealed by CabinOpening's sky lift, scrubbed by scroll):
 *   - holds a full 3/4 hero view (gentle bob) while the sky lifts,
 *   - then ONE continuous climb — up, banking, away from the viewer — to
 *     park in the top-left corner, fading out by the hero statement.
 * Single segment + frame-rate-independent damping = no joints, no stalls;
 * scrolling back up flies the whole thing in reverse.
 */

import { Canvas, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

/** Build the airliner once. Nose points toward +X. */
function useAirlinerModel() {
  return useMemo(() => {
    const group = new THREE.Group()

    const white = new THREE.MeshStandardMaterial({ color: "#F5F1E8", metalness: 0.2, roughness: 0.45 })
    const ink = new THREE.MeshStandardMaterial({ color: "#1B1626", metalness: 0.3, roughness: 0.5 })
    const wingMat = new THREE.MeshStandardMaterial({ color: "#C9C3B4", metalness: 0.3, roughness: 0.45 })
    const cobalt = new THREE.MeshStandardMaterial({ color: "#2C49E0", metalness: 0.35, roughness: 0.4 })
    const violet = new THREE.MeshStandardMaterial({ color: "#6F3FE4", metalness: 0.35, roughness: 0.4 })
    const amber = new THREE.MeshStandardMaterial({ color: "#EFAF1B", metalness: 0.4, roughness: 0.4 })
    const glass = new THREE.MeshStandardMaterial({ color: "#0B2434", metalness: 0.5, roughness: 0.2 })

    // ── fuselage: long, slender revolved profile (tail -2.9 → nose +2.9) ──
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.012, -2.9),
      new THREE.Vector2(0.1, -2.55),
      new THREE.Vector2(0.2, -2.0),
      new THREE.Vector2(0.28, -1.3),
      new THREE.Vector2(0.31, -0.4),
      new THREE.Vector2(0.31, 0.9),
      new THREE.Vector2(0.29, 1.7),
      new THREE.Vector2(0.24, 2.25),
      new THREE.Vector2(0.14, 2.65),
      new THREE.Vector2(0.03, 2.9),
    ]
    const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), white)
    fuse.rotation.z = -Math.PI / 2
    group.add(fuse)

    // dark belly: a squashed copy of the fuselage, offset down so it wraps
    // the underside with a clean waterline
    const belly = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), ink)
    belly.rotation.z = -Math.PI / 2
    belly.scale.set(1.01, 0.82, 1.02)
    belly.position.y = -0.1
    group.add(belly)

    // amber waterline pinstripe down both sides
    const mkStripe = (z: number) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.035, 0.02), amber)
      s.position.set(-0.15, 0.02, z)
      return s
    }
    group.add(mkStripe(0.305), mkStripe(-0.305))

    // cockpit glass band near the nose
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), glass)
    cockpit.rotation.z = -Math.PI / 2
    cockpit.position.set(2.15, 0.05, 0)
    cockpit.scale.set(1, 0.65, 0.85)
    group.add(cockpit)

    // ── portholes down both sides ──
    const portGeo = new THREE.SphereGeometry(0.028, 10, 8)
    for (let i = 0; i < 18; i++) {
      const x = 1.85 - i * 0.21
      for (const side of [1, -1] as const) {
        const w = new THREE.Mesh(portGeo, glass)
        w.position.set(x, 0.12, side * 0.27)
        w.scale.set(1, 1.2, 0.3)
        group.add(w)
      }
    }

    // ── slender swept wings with a touch of dihedral ──
    const wingGeo = new THREE.BoxGeometry(0.72, 0.04, 2.3)
    const mkWing = (side: 1 | -1) => {
      const w = new THREE.Mesh(wingGeo, wingMat)
      w.position.set(-0.3, -0.12, side * 1.15)
      w.rotation.y = side * -0.42
      w.rotation.x = side * -0.06
      return w
    }
    group.add(mkWing(1), mkWing(-1))

    // ── engines slung under the wings, amber intake lips ──
    const engGeo = new THREE.CylinderGeometry(0.13, 0.115, 0.5, 18)
    const lipGeo = new THREE.TorusGeometry(0.13, 0.025, 10, 20)
    const mkEngine = (side: 1 | -1) => {
      const e = new THREE.Mesh(engGeo, ink)
      e.rotation.z = Math.PI / 2
      e.position.set(0.05, -0.28, side * 0.62)
      const l = new THREE.Mesh(lipGeo, amber)
      l.rotation.y = Math.PI / 2
      l.position.set(0.3, -0.28, side * 0.62)
      return [e, l]
    }
    group.add(...mkEngine(1), ...mkEngine(-1))

    // ── horizontal stabilisers ──
    const stabGeo = new THREE.BoxGeometry(0.45, 0.035, 0.85)
    const mkStab = (side: 1 | -1) => {
      const s = new THREE.Mesh(stabGeo, ink)
      s.position.set(-2.35, 0.08, side * 0.42)
      s.rotation.y = side * -0.35
      return s
    }
    group.add(mkStab(1), mkStab(-1))

    // ── tall dark tail fin with cobalt / violet / amber ribbons ──
    const finShape = new THREE.Shape()
    finShape.moveTo(0.55, 0)
    finShape.lineTo(-0.45, 0)
    finShape.lineTo(-0.32, 0.95)
    finShape.lineTo(0.1, 0.95)
    finShape.closePath()
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.045, bevelEnabled: false }), ink)
    fin.position.set(-2.25, 0.14, -0.022)
    group.add(fin)
    // ribbons sweeping diagonally across the fin
    const ribbonGeo = new THREE.BoxGeometry(0.62, 0.09, 0.055)
    const ribbons: Array<[THREE.MeshStandardMaterial, number]> = [
      [cobalt, 0.72],
      [violet, 0.56],
      [amber, 0.4],
    ]
    for (const [mat, y] of ribbons) {
      const r = new THREE.Mesh(ribbonGeo, mat)
      r.position.set(-2.32 + (0.72 - y) * 0.3, 0.14 + y, 0)
      r.rotation.z = 0.35
      group.add(r)
    }

    return group
  }, [])
}

/**
 * Two poses only — hero view and the parked corner — joined by ONE smooth
 * segment, so there is no mid-flight joint to stall on.
 */
// The zoom continues out of the cabin window: a HUGE horizontal side profile
// (we just phased out through the fuselage) keeps pulling back until the
// whole plane fits the frame side-on, holds a beat, then climbs out.
const CLOSE = { pos: new THREE.Vector3(0.8, -0.3, 1.6), rot: new THREE.Euler(0.02, -0.06, 0), scale: 2.2 }
const SIDE = { pos: new THREE.Vector3(0, 0.1, 0), rot: new THREE.Euler(0.05, -0.16, 0.01), scale: 0.66 }
// climb-out runs along the line y = x: equal rise and run, a clean 45°
// diagonal up-and-right, receding slightly from the viewer
const AWAY = { pos: new THREE.Vector3(5.6, 5.7, -2.4), scale: 0.6 }
const ZOOM_START = 0.28
const ZOOM_END = 0.57
const CLIMB_START = 0.63
const CLIMB_END = 0.88

const Q_CLOSE = new THREE.Quaternion().setFromEuler(CLOSE.rot)
const Q_SIDE = new THREE.Quaternion().setFromEuler(SIDE.rot)
// climb-out: nose (+X) along the travel direction, wings level w.r.t. world
// up, banked into the turn — reads as climbing away, never inverted
const Q_AWAY = (() => {
  const x = AWAY.pos.clone().sub(SIDE.pos).normalize()
  const z = new THREE.Vector3().crossVectors(x, new THREE.Vector3(0, 1, 0)).normalize()
  const y = new THREE.Vector3().crossVectors(z, x)
  const aim = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
  return new THREE.Quaternion().setFromAxisAngle(x, -0.28).multiply(aim)
})()

function Airliner({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null)
  const model = useAirlinerModel()
  const cur = useRef(0)
  const mats = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = []
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m) {
        m.transparent = true
        list.push(m)
      }
    })
    return list
  }, [model])
  const lastFade = useRef(1)

  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    // frame-rate-independent damp toward the scroll target; an instant jump
    // (anchor link, scrollIntoView) snaps instead of ghosting mid-flight
    const k = 3.4
    if (Math.abs(progressRef.current - cur.current) > 0.35) cur.current = progressRef.current
    else cur.current += (progressRef.current - cur.current) * (1 - Math.exp(-k * Math.min(delta, 0.05)))
    const t = cur.current

    const fade = 1 - THREE.MathUtils.smoothstep(t, 0.82, 0.94)
    if (fade <= 0.01) {
      if (g.visible) g.visible = false
      return
    }
    if (!g.visible) g.visible = true

    let s: number
    if (t < CLIMB_START) {
      // continuing zoom-out: giant side profile → whole plane, horizontal
      const z = THREE.MathUtils.smoothstep(t, ZOOM_START, ZOOM_END)
      g.position.lerpVectors(CLOSE.pos, SIDE.pos, z)
      g.quaternion.copy(Q_CLOSE).slerp(Q_SIDE, z)
      g.scale.setScalar(THREE.MathUtils.lerp(CLOSE.scale, SIDE.scale, z))
      s = 0
    } else {
      // upward climb-out with ACCELERATION: quadratic ease-in — starts from
      // rest at the side view and leaves the top of the frame at full speed
      const r = THREE.MathUtils.clamp((t - CLIMB_START) / (CLIMB_END - CLIMB_START), 0, 1)
      s = r * r
      g.position.lerpVectors(SIDE.pos, AWAY.pos, s)
      g.quaternion.copy(Q_SIDE).slerp(Q_AWAY, s)
      g.scale.setScalar(THREE.MathUtils.lerp(SIDE.scale, AWAY.scale, s))
    }

    // gentle turbulence bob, easing off as it flies away
    const clock = state.clock.elapsedTime
    const bob = 1 - s * 0.6
    g.position.y += Math.sin(clock * 1.0) * 0.06 * bob
    g.position.z += Math.sin(clock * 0.45) * 0.07 * bob
    g.rotation.x += Math.sin(clock * 0.6) * 0.025 * bob
    g.rotation.z += Math.cos(clock * 0.7) * 0.03 * bob

    if (Math.abs(fade - lastFade.current) > 0.002) {
      for (const m of mats) m.opacity = fade
      lastFade.current = fade
    }
  })

  return <primitive object={model} ref={ref} />
}

export function HeroPlane3D() {
  const progressRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let ticking = false
    const compute = () => {
      const span = window.innerHeight * 1.7
      progressRef.current = Math.min(1, Math.max(0, window.scrollY / span))
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(compute)
      }
    }
    compute()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none" }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ width: "100%", height: "100%" }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, -1, 2]} intensity={0.55} color="#F3B7C4" />
        <Airliner progressRef={progressRef} />
      </Canvas>
    </div>
  )
}
