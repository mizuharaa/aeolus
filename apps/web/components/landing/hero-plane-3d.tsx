"use client"
/**
 * HeroPlane3D — a SLEEK commercial airliner (three.js): pearl-white crown over
 * a champagne belly joined at a gold waterline, spline-curved low-mounted
 * wings with root fairings and swept winglets, lathed engine nacelles with
 * gold intake lips + fans + spinners, a royal-plum tail with one gold sweep,
 * a smooth dark cockpit visor, and warm-lit cabin windows. Every silhouette
 * edge is curved/beveled — no box corners. No text anywhere.
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

/** Build the airliner once. Nose points toward +X. Length ±2.9.
 *
 * Sleek pass: every silhouette edge is a spline, every extrusion beveled,
 * every joint blended with a fairing — no visible box corners anywhere.
 * Livery: pearl-white crown over a champagne belly split by a gold
 * waterline; royal-plum tail with a single gold sweep. */
function useAirlinerModel() {
  return useMemo(() => {
    const group = new THREE.Group()

    // clearcoated pearl — reads as polished paint, not plastic
    const white = new THREE.MeshPhysicalMaterial({
      color: "#F9F6EE", metalness: 0.1, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.25,
    })
    const champagne = new THREE.MeshPhysicalMaterial({
      color: "#D9C9A8", metalness: 0.25, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3,
    })
    const plum = new THREE.MeshPhysicalMaterial({
      color: "#5B3FA8", metalness: 0.3, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25,
    })
    const gold = new THREE.MeshStandardMaterial({ color: "#C9A050", metalness: 0.7, roughness: 0.3 })
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: "#E8E2D2", metalness: 0.3, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide,
    })
    const glass = new THREE.MeshStandardMaterial({ color: "#141B2E", metalness: 0.6, roughness: 0.12 })
    // cabin windows glow warm — the lit interior reading through the glass
    const cabinGlow = new THREE.MeshStandardMaterial({
      color: "#2A2F3A", metalness: 0.2, roughness: 0.3,
      emissive: "#FFC98A", emissiveIntensity: 0.55,
    })
    const fanMat = new THREE.MeshStandardMaterial({ color: "#2A3038", metalness: 0.85, roughness: 0.3 })

    // ── fuselage: smooth spline-sampled revolve, tail −2.9 → nose +2.9 ──
    const ctrl = [
      [0.012, -2.9], [0.09, -2.55], [0.19, -2.05], [0.27, -1.4],
      [0.305, -0.6], [0.315, 0.3], [0.305, 1.1], [0.285, 1.7],
      [0.245, 2.2], [0.17, 2.6], [0.06, 2.85], [0.012, 2.9],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const spline = new THREE.SplineCurve(ctrl)
    const profile = spline.getPoints(64).map((p) => new THREE.Vector2(Math.max(p.x, 0.012), p.y))
    const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), white)
    fuse.rotation.z = -Math.PI / 2
    group.add(fuse)

    // champagne belly — HALF-lathe (bottom sector) at +1.5% radius, meeting
    // the pearl crown exactly at the waterline. No z-fighting on top.
    const bellyProfile = profile.map((p) => new THREE.Vector2(p.x * 1.015, p.y))
    const belly = new THREE.Mesh(
      new THREE.LatheGeometry(bellyProfile, 64, Math.PI * 1.5, Math.PI),
      champagne,
    )
    belly.rotation.z = -Math.PI / 2
    group.add(belly)

    // gold waterline pinstripes riding the seam — slim rounded tubes, not
    // sharp-edged boxes
    const mkStripe = (z: number) => {
      const curve = new THREE.LineCurve3(
        new THREE.Vector3(-2.35, 0, z),
        new THREE.Vector3(2.2, 0, z),
      )
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 1, 0.018, 8), gold)
    }
    group.add(mkStripe(0.317), mkStripe(-0.317))

    // ── wings: curved swept planform (spline leading/trailing edges),
    //    beveled extrusion, LOW-mounted, root buried in the fuselage ──
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0.78, 0) // root leading edge
    wingShape.lineTo(-0.55, 0) // root trailing edge
    // trailing edge sweeps back with a gentle inward curve
    wingShape.quadraticCurveTo(-0.72, 0.9, -1.02, 2.02)
    wingShape.lineTo(-0.78, 2.05) // tip chord
    // leading edge curves forward at the root (fillet) then runs straight
    wingShape.quadraticCurveTo(-0.15, 0.55, 0.78, 0)
    wingShape.closePath()
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 3,
    })
    wingGeo.rotateX(Math.PI / 2) // planform span +Y → +Z (right wing)

    const wingR = new THREE.Mesh(wingGeo, wingMat)
    wingR.position.set(0, -0.16, 0)
    wingR.rotation.x = -0.09 // dihedral — tip rises
    const wingL = new THREE.Mesh(wingGeo.clone().scale(1, 1, -1), wingMat)
    wingL.position.set(0, -0.16, 0)
    wingL.rotation.x = 0.09
    group.add(wingR, wingL)

    // wing-root fairing — a stretched half-capsule blending wing into hull
    const fairing = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), champagne)
    fairing.scale.set(2.2, 0.55, 1.0)
    fairing.position.set(0.05, -0.26, 0)
    group.add(fairing)

    // winglets — swept beveled blades curving up from the wingtip
    const wlShape = new THREE.Shape()
    wlShape.moveTo(0, 0)
    wlShape.lineTo(0.24, 0)
    wlShape.quadraticCurveTo(0.16, 0.18, 0.1, 0.34)
    wlShape.lineTo(0.0, 0.3)
    wlShape.quadraticCurveTo(0.02, 0.12, 0, 0)
    wlShape.closePath()
    const wlGeo = new THREE.ExtrudeGeometry(wlShape, {
      depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2,
    })
    const mkWinglet = (side: 1 | -1) => {
      const w = new THREE.Mesh(wlGeo, plum)
      w.position.set(-1.02, 0.02, side * 2.05)
      w.rotation.x = side * -0.42 // cant outward-up
      return w
    }
    group.add(mkWinglet(1), mkWinglet(-1))

    // ── engines: smooth lathed nacelle (rounded lip → taper → exhaust),
    //    fan + spinner inside, hung on a faired pylon ──
    const nacProfile: THREE.Vector2[] = []
    const nacCtrl = [
      [0.155, 0.30], [0.172, 0.24], [0.176, 0.1], [0.168, -0.05],
      [0.15, -0.2], [0.115, -0.30], [0.07, -0.34],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    new THREE.SplineCurve(nacCtrl).getPoints(24).forEach((p) => nacProfile.push(p))
    const mkEngine = (side: 1 | -1) => {
      const parts: THREE.Object3D[] = []
      const z = side * 0.85

      const nacelle = new THREE.Mesh(new THREE.LatheGeometry(nacProfile, 48), white)
      nacelle.rotation.z = -Math.PI / 2
      nacelle.position.set(0.45, -0.3, z)
      parts.push(nacelle)

      // gold lip ring on the intake
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.016, 12, 36), gold)
      lip.rotation.y = Math.PI / 2
      lip.position.set(0.75, -0.3, z)
      parts.push(lip)

      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 32), fanMat)
      fan.rotation.z = Math.PI / 2
      fan.position.set(0.72, -0.3, z)
      parts.push(fan)

      const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 20), champagne)
      spinner.rotation.z = -Math.PI / 2
      spinner.position.set(0.77, -0.3, z)
      parts.push(spinner)

      const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 20), fanMat)
      exhaust.rotation.z = Math.PI / 2 // point −X (aft)
      exhaust.position.set(0.08, -0.3, z)
      parts.push(exhaust)

      // pylon — a squashed capsule spanning wing underside into nacelle top
      const pylon = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.3, 4, 12), white)
      pylon.rotation.z = Math.PI / 2 - 0.18
      pylon.scale.set(1, 1, 0.7)
      pylon.position.set(0.2, -0.18, z)
      parts.push(pylon)

      return parts
    }
    group.add(...mkEngine(1), ...mkEngine(-1))

    // ── tail fin: royal plum, curved swept edges, beveled, base buried ──
    const finShape = new THREE.Shape()
    finShape.moveTo(-1.85, 0)
    finShape.lineTo(-2.85, 0)
    // trailing edge sweeps up with a slight curve, rounded tip
    finShape.quadraticCurveTo(-3.0, 0.55, -3.0, 1.1)
    finShape.quadraticCurveTo(-2.99, 1.16, -2.92, 1.16)
    finShape.lineTo(-2.58, 1.14)
    // leading edge curves down into the spine (dorsal fillet)
    finShape.quadraticCurveTo(-2.2, 0.6, -1.85, 0)
    finShape.closePath()
    const fin = new THREE.Mesh(
      new THREE.ExtrudeGeometry(finShape, {
        depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.016, bevelSegments: 2,
      }),
      plum,
    )
    fin.position.set(0, 0.05, -0.02) // base sunk into the fuselage
    group.add(fin)

    // single gold sweep across the plum fin — quiet, premium
    const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.09), gold)
    sweep.position.set(-2.62, 0.78, 0)
    sweep.rotation.z = 0.5
    group.add(sweep)

    // ── horizontal stabilisers: curved swept planforms, beveled ──
    const stabShape = new THREE.Shape()
    stabShape.moveTo(-2.35, 0)
    stabShape.lineTo(-2.85, 0)
    stabShape.quadraticCurveTo(-2.98, 0.4, -2.99, 0.72)
    stabShape.lineTo(-2.8, 0.74)
    stabShape.quadraticCurveTo(-2.55, 0.35, -2.35, 0)
    stabShape.closePath()
    const stabGeo = new THREE.ExtrudeGeometry(stabShape, {
      depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2,
    })
    stabGeo.rotateX(Math.PI / 2)
    const stabR = new THREE.Mesh(stabGeo, wingMat)
    stabR.position.set(0, 0.06, 0)
    stabR.rotation.x = -0.12
    const stabL = new THREE.Mesh(stabGeo.clone().scale(1, 1, -1), wingMat)
    stabL.position.set(0, 0.06, 0)
    stabL.rotation.x = 0.12
    group.add(stabR, stabL)

    // ── cockpit: one smooth dark visor band wrapping the nose (the modern
    //    "mask" look) instead of flat panes ──
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.245, 48, 24, 0, Math.PI * 2, 0.9, 0.55), glass)
    visor.rotation.z = -Math.PI / 2 - 0.32
    visor.scale.set(1, 1.6, 1)
    visor.position.set(2.22, 0.06, 0)
    group.add(visor)

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
        <directionalLight position={[3, 5, 4]} intensity={1.6} color="#FFF6E6" />
        <directionalLight position={[-4, -1, 2]} intensity={0.45} color="#C9B8F0" />
        <directionalLight position={[0, -3, 1]} intensity={0.3} color="#EDE4D0" />
        <Airliner progressRef={progressRef} />
      </Canvas>
    </div>
  )
}
