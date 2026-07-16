"use client"
/**
 * HeroPlane3D — a DETAILED commercial airliner (three.js): white fuselage over
 * an ink belly joined at an amber waterline, low-mounted swept tapered wings
 * with winglets, pylon-hung engine nacelles with visible fans + spinners +
 * exhaust cones, swept tail fin carrying the cobalt/violet/amber livery
 * ribbons, swept stabilisers, flat cockpit glass panels, and warm-lit cabin
 * windows (the interior reads through the glass). No text anywhere.
 *
 * Attachment rule: every part is positioned so its geometry PENETRATES the
 * part it mounts to (wing roots buried in the fuselage, pylons overlapping
 * both wing and nacelle, fin base inside the tail cone) — visible seams or
 * floating parts are geometrically impossible.
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

/** Build the airliner once. Nose points toward +X. Length ±2.9. */
function useAirlinerModel() {
  return useMemo(() => {
    const group = new THREE.Group()

    const white = new THREE.MeshStandardMaterial({ color: "#F7F3EA", metalness: 0.15, roughness: 0.35 })
    const ink = new THREE.MeshStandardMaterial({ color: "#1B1626", metalness: 0.3, roughness: 0.5 })
    const wingMat = new THREE.MeshStandardMaterial({ color: "#CFC9BA", metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide })
    const cobalt = new THREE.MeshStandardMaterial({ color: "#2C49E0", metalness: 0.35, roughness: 0.4 })
    const violet = new THREE.MeshStandardMaterial({ color: "#6F3FE4", metalness: 0.35, roughness: 0.4 })
    const amber = new THREE.MeshStandardMaterial({ color: "#EFAF1B", metalness: 0.4, roughness: 0.4 })
    const glass = new THREE.MeshStandardMaterial({ color: "#101C26", metalness: 0.6, roughness: 0.15 })
    // cabin windows glow warm — the lit interior reading through the glass
    const cabinGlow = new THREE.MeshStandardMaterial({
      color: "#2A2F3A", metalness: 0.2, roughness: 0.3,
      emissive: "#FFC98A", emissiveIntensity: 0.55,
    })
    const fanMat = new THREE.MeshStandardMaterial({ color: "#2A3540", metalness: 0.85, roughness: 0.3 })

    // ── fuselage: revolved profile, tail −2.9 → nose +2.9 ──
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.012, -2.9),
      new THREE.Vector2(0.08, -2.6),
      new THREE.Vector2(0.17, -2.15),
      new THREE.Vector2(0.26, -1.5),
      new THREE.Vector2(0.30, -0.7),
      new THREE.Vector2(0.31, 0.3),
      new THREE.Vector2(0.30, 1.1),
      new THREE.Vector2(0.28, 1.7),
      new THREE.Vector2(0.24, 2.2),
      new THREE.Vector2(0.17, 2.6),
      new THREE.Vector2(0.05, 2.86),
      new THREE.Vector2(0.012, 2.9),
    ]
    const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), white)
    fuse.rotation.z = -Math.PI / 2
    group.add(fuse)

    // ink belly — a HALF-lathe (bottom sector only) at +2% radius, so it
    // wraps the underside and meets the white skin exactly at the waterline.
    // No full duplicate shell, no z-fighting on top.
    const bellyProfile = profile.map((p) => new THREE.Vector2(p.x * 1.02, p.y))
    const belly = new THREE.Mesh(
      new THREE.LatheGeometry(bellyProfile, 32, Math.PI * 1.5, Math.PI),
      ink,
    )
    belly.rotation.z = -Math.PI / 2
    group.add(belly)

    // amber waterline pinstripes riding the belly/skin seam
    const mkStripe = (z: number) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.045, 0.02), amber)
      s.position.set(-0.15, 0, z)
      return s
    }
    group.add(mkStripe(0.315), mkStripe(-0.315))

    // ── wings: extruded swept tapered planform, LOW-mounted, root chord
    //    buried inside the fuselage ──
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0.75, 0) // root leading edge
    wingShape.lineTo(-0.55, 0) // root trailing edge
    wingShape.lineTo(-1.05, 2.05) // tip trailing edge (swept back)
    wingShape.lineTo(-0.75, 2.05) // tip leading edge
    wingShape.closePath()
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.055, bevelEnabled: false })
    wingGeo.rotateX(Math.PI / 2) // planform span +Y → +Z (right wing)

    const wingR = new THREE.Mesh(wingGeo, wingMat)
    wingR.position.set(0, -0.16, 0)
    wingR.rotation.x = -0.09 // dihedral — tip rises
    const wingL = new THREE.Mesh(wingGeo.clone().scale(1, 1, -1), wingMat)
    wingL.position.set(0, -0.16, 0)
    wingL.rotation.x = 0.09
    group.add(wingR, wingL)

    // winglets — canted panels whose base overlaps the wingtip
    const mkWinglet = (side: 1 | -1) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.30, 0.028), wingMat)
      w.position.set(-0.9, 0.15, side * 2.06)
      w.rotation.x = side * -0.45 // cant outward-up
      return w
    }
    group.add(mkWinglet(1), mkWinglet(-1))

    // ── engines: nacelle + fan disc + spinner + amber lip + exhaust cone,
    //    hung on a pylon that overlaps BOTH the wing and the nacelle ──
    const mkEngine = (side: 1 | -1) => {
      const parts: THREE.Mesh[] = []
      const z = side * 0.85

      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.15, 0.6, 24, 1, true), ink)
      nacelle.rotation.z = Math.PI / 2
      nacelle.position.set(0.45, -0.3, z)
      parts.push(nacelle)

      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 24), fanMat)
      fan.rotation.z = Math.PI / 2
      fan.position.set(0.72, -0.3, z)
      parts.push(fan)

      const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 16), white)
      spinner.rotation.z = -Math.PI / 2
      spinner.position.set(0.77, -0.3, z)
      parts.push(spinner)

      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 12, 28), amber)
      lip.rotation.y = Math.PI / 2
      lip.position.set(0.75, -0.3, z)
      parts.push(lip)

      const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 16), fanMat)
      exhaust.rotation.z = Math.PI / 2 // point −X (aft)
      exhaust.position.set(0.10, -0.3, z)
      parts.push(exhaust)

      // pylon — spans wing underside (≈−0.11 here) down into the nacelle top
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.07), ink)
      pylon.position.set(0.18, -0.17, z)
      parts.push(pylon)

      return parts
    }
    group.add(...mkEngine(1), ...mkEngine(-1))

    // ── tail fin: swept, base buried inside the tail cone ──
    const finShape = new THREE.Shape()
    finShape.moveTo(-1.85, 0)
    finShape.lineTo(-2.85, 0)
    finShape.lineTo(-3.0, 1.15)
    finShape.lineTo(-2.55, 1.15)
    finShape.closePath()
    const fin = new THREE.Mesh(
      new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false }),
      ink,
    )
    fin.position.set(0, 0.05, -0.025) // base sunk into the fuselage
    group.add(fin)

    // livery ribbons sweeping diagonally across the fin — deeper than the
    // fin so they read on both faces
    const ribbonGeo = new THREE.BoxGeometry(0.55, 0.10, 0.07)
    const ribbons: Array<[THREE.MeshStandardMaterial, number]> = [
      [cobalt, 0.95],
      [violet, 0.75],
      [amber, 0.55],
    ]
    for (const [mat, y] of ribbons) {
      const rb = new THREE.Mesh(ribbonGeo, mat)
      rb.position.set(-2.55 - (y - 0.55) * 0.3, y, 0)
      rb.rotation.z = 0.42
      group.add(rb)
    }

    // ── horizontal stabilisers: swept tapered planforms, buried in the
    //    tail cone, slight dihedral ──
    const stabShape = new THREE.Shape()
    stabShape.moveTo(-2.35, 0)
    stabShape.lineTo(-2.85, 0)
    stabShape.lineTo(-3.0, 0.75)
    stabShape.lineTo(-2.78, 0.75)
    stabShape.closePath()
    const stabGeo = new THREE.ExtrudeGeometry(stabShape, { depth: 0.035, bevelEnabled: false })
    stabGeo.rotateX(Math.PI / 2)
    const stabR = new THREE.Mesh(stabGeo, wingMat)
    stabR.position.set(0, 0.06, 0)
    stabR.rotation.x = -0.12
    const stabL = new THREE.Mesh(stabGeo.clone().scale(1, 1, -1), wingMat)
    stabL.position.set(0, 0.06, 0)
    stabL.rotation.x = 0.12
    group.add(stabR, stabL)

    // ── cockpit: flat glass panels wrapped around the nose ──
    const mkCockpitPane = (x: number, z: number, rotY: number, w: number) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.10, 0.02), glass)
      p.position.set(x, 0.10, z)
      p.rotation.y = rotY
      return p
    }
    for (const side of [1, -1] as const) {
      group.add(
        mkCockpitPane(2.18, side * 0.205, side * -0.5, 0.22), // side panes
        mkCockpitPane(2.35, side * 0.12, side * -1.0, 0.18), // front panes
      )
    }

    // ── cabin windows: two warm-lit rows (the interior showing through) ──
    const portGeo = new THREE.SphereGeometry(0.026, 10, 8)
    for (let i = 0; i < 16; i++) {
      const x = 1.7 - i * 0.21
      for (const side of [1, -1] as const) {
        const w = new THREE.Mesh(portGeo, cabinGlow)
        w.position.set(x, 0.10, side * 0.287)
        w.scale.set(1, 1.25, 0.35)
        group.add(w)
      }
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
    const seen = new Set<THREE.Material>()
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m && !seen.has(m)) {
        seen.add(m)
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
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} />
        <directionalLight position={[-4, -1, 2]} intensity={0.5} color="#F3B7C4" />
        <directionalLight position={[0, -3, 1]} intensity={0.25} color="#EDE6D6" />
        <Airliner progressRef={progressRef} />
      </Canvas>
    </div>
  )
}
