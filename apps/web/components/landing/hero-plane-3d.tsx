"use client"
/**
 * HeroPlane3D — a smooth 3D airliner (three.js) that flies across the opening.
 * It sits in the top-left corner on load and, as you scroll, banks and glides
 * diagonally toward the bottom-right; scrolling back up flies it in reverse
 * to the corner. Fades out by the hero statement, fixed, pointer-events none,
 * above the atmosphere but below the nav.
 *
 * Smoothness:
 *  - the fuselage is a LatheGeometry (revolved profile) so the body reads as a
 *    rounded aircraft, not a boxy dart;
 *  - scroll only writes a target; a frame-rate-independent exponential damp
 *    (1 - e^{-k·dt}) chases it every frame, so motion is fluid and reverses
 *    cleanly at any FPS;
 *  - the component stays mounted the whole time (so cur never resets and the
 *    fly-back is continuous) but skips all per-frame work while faded out.
 */

import { Canvas, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

/** Build the airliner once. Nose points toward +X. */
function useAirlinerModel() {
  return useMemo(() => {
    const group = new THREE.Group()

    const body = new THREE.MeshStandardMaterial({ color: "#F5F1E8", metalness: 0.35, roughness: 0.38 })
    const wingMat = new THREE.MeshStandardMaterial({ color: "#2C49E0", metalness: 0.35, roughness: 0.36 })
    const accentMat = new THREE.MeshStandardMaterial({ color: "#6F3FE4", metalness: 0.4, roughness: 0.36 })
    const engineMat = new THREE.MeshStandardMaterial({ color: "#232B33", metalness: 0.6, roughness: 0.3 })
    const trimMat = new THREE.MeshStandardMaterial({ color: "#EFAF1B", metalness: 0.45, roughness: 0.35 })
    const glassMat = new THREE.MeshStandardMaterial({ color: "#0B2434", metalness: 0.5, roughness: 0.2 })

    // ── fuselage: revolve a smooth profile (radius vs length along Y) ──
    // Profile runs from tail (-2) to nose (+2.3); rotated to lie along +X.
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.015, -2.05),
      new THREE.Vector2(0.14, -1.75),
      new THREE.Vector2(0.26, -1.3),
      new THREE.Vector2(0.33, -0.6),
      new THREE.Vector2(0.35, 0.4),
      new THREE.Vector2(0.34, 1.1),
      new THREE.Vector2(0.29, 1.6),
      new THREE.Vector2(0.18, 2.0),
      new THREE.Vector2(0.04, 2.3),
    ]
    const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), body)
    fuse.rotation.z = -Math.PI / 2 // profile Y → world X (nose toward +X)
    group.add(fuse)

    // cockpit glass band near the nose
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), glassMat)
    glass.rotation.z = -Math.PI / 2
    glass.position.set(1.45, 0.06, 0)
    glass.scale.set(1, 0.7, 0.9)
    group.add(glass)

    // amber cheatline stripes down both sides
    const mkStripe = (z: number) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.045, 0.02), trimMat)
      s.position.set(-0.1, 0.05, z)
      return s
    }
    group.add(mkStripe(0.335), mkStripe(-0.335))

    // ── main wings ──
    // Flat swept boxes. The root is buried inside the fuselage (span starts
    // near the centreline) so the wing visibly grows out of the body instead
    // of floating beside it. Chord X, thickness Y, span Z.
    const wingGeo = new THREE.BoxGeometry(0.92, 0.055, 1.55)
    const mkWing = (side: 1 | -1) => {
      const w = new THREE.Mesh(wingGeo, wingMat)
      // centre outboard so span runs from ~0.03 (root, inside fuselage) to ~1.6
      w.position.set(-0.12, -0.05, side * 0.82)
      w.rotation.y = side * -0.26 // sweep the tip aft
      return w
    }
    const wingTipZ = 1.58
    group.add(mkWing(1), mkWing(-1))

    // violet winglets standing up at each swept tip
    const wingletGeo = new THREE.BoxGeometry(0.34, 0.24, 0.05)
    const mkWinglet = (side: 1 | -1) => {
      const t = new THREE.Mesh(wingletGeo, accentMat)
      t.position.set(-0.53, 0.09, side * wingTipZ) // aft (swept) + outboard
      t.rotation.y = side * -0.26
      return t
    }
    group.add(mkWinglet(1), mkWinglet(-1))

    // ── horizontal stabilisers at the tail (small swept boxes) ──
    const stabGeo = new THREE.BoxGeometry(0.5, 0.05, 0.82)
    const mkStab = (side: 1 | -1) => {
      const s = new THREE.Mesh(stabGeo, wingMat)
      s.position.set(-1.52, 0.03, side * 0.44) // root buried in tail cone
      s.rotation.y = side * -0.32
      return s
    }
    group.add(mkStab(1), mkStab(-1))

    // ── vertical tailfin (amber) rising from the tail top ──
    const finShape = new THREE.Shape()
    finShape.moveTo(0.42, 0)     // base fore
    finShape.lineTo(-0.5, 0)     // base aft
    finShape.lineTo(-0.42, 0.72) // tip aft
    finShape.lineTo(0.02, 0.72)  // tip fore
    finShape.closePath()
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false }), trimMat)
    fin.position.set(-1.4, 0.12, -0.025) // sits on the tail top, thickness centred on z=0
    group.add(fin)

    // ── engines: nacelles slung UNDER and slightly forward of each wing ──
    const engGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.56, 18)
    const mkEngine = (side: 1 | -1) => {
      const e = new THREE.Mesh(engGeo, engineMat)
      e.rotation.z = Math.PI / 2 // thrust axis along X
      e.position.set(0.04, -0.22, side * 0.72)
      return e
    }
    // violet intake lip so each engine reads as a nacelle, not a peg
    const lipGeo = new THREE.TorusGeometry(0.15, 0.03, 10, 20)
    const mkLip = (side: 1 | -1) => {
      const l = new THREE.Mesh(lipGeo, accentMat)
      l.rotation.y = Math.PI / 2
      l.position.set(0.32, -0.22, side * 0.72)
      return l
    }
    group.add(mkEngine(1), mkEngine(-1), mkLip(1), mkLip(-1))

    group.scale.setScalar(0.5)
    return group
  }, [])
}

function Airliner({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null)
  const model = useAirlinerModel()
  const cur = useRef(0)
  const mats = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = []
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m) { m.transparent = true; list.push(m) }
    })
    return list
  }, [model])
  const lastFade = useRef(1)

  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    // frame-rate-independent damp toward the scroll target
    const k = 4.2
    cur.current += (progressRef.current - cur.current) * (1 - Math.exp(-k * Math.min(delta, 0.05)))
    const t = cur.current

    const fade = 1 - THREE.MathUtils.smoothstep(t, 0.82, 1.0)
    if (fade <= 0.01) {
      // fully out of view — hide and skip the rest (cheap while scrolled away)
      if (g.visible) g.visible = false
      return
    }
    if (!g.visible) g.visible = true

    const clock = state.clock.elapsedTime
    const x = THREE.MathUtils.lerp(-3.1, 3.8, t)
    const y = THREE.MathUtils.lerp(1.9, -2.5, t)
    g.position.set(x, y + Math.sin(clock * 1.0) * 0.08, 0.2 + Math.sin(clock * 0.45) * 0.09)
    g.rotation.set(
      0.32 + Math.sin(clock * 0.6) * 0.035,
      -0.6 + Math.sin(clock * 0.45) * 0.045,
      -0.5 + Math.cos(clock * 0.7) * 0.05,
    )

    if (Math.abs(fade - lastFade.current) > 0.002) {
      for (const m of mats) m.opacity = fade
      lastFade.current = fade
    }
  })

  return <primitive object={model} ref={ref} />
}

export function HeroPlane3D() {
  const progressRef = useRef(0)
  const canRun = useRef(true)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canRun.current = false
      return
    }
    let ticking = false
    const compute = () => {
      const span = window.innerHeight * 1.4
      progressRef.current = Math.min(1, Math.max(0, window.scrollY / span))
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(compute) }
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
