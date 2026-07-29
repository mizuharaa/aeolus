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

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import * as THREE from "three"
import {
  landingScroll,
  markLandingAssetReady,
  registerLandingFrame,
  registerThreeRoot,
} from "@/lib/scroll"
import { Spring } from "@/lib/spring"

function StudioEnvironment() {
  const { gl, scene } = useThree()

  useEffect(() => {
    const previous = scene.environment
    const previousIntensity = scene.environmentIntensity
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = 0.64
    room.dispose()

    return () => {
      scene.environment = previous
      scene.environmentIntensity = previousIntensity
      target.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}

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

const CLOSE = {
  pos: new THREE.Vector3(0.72, -0.2, 1.3),
  rot: new THREE.Euler(0.08, -0.28, 0),
  scale: 2.16,
}
const SIDE = {
  pos: new THREE.Vector3(-0.1, 0.06, 0),
  rot: new THREE.Euler(0.09, -0.42, 0.015),
  scale: 0.66,
}
const ZOOM_START = 0.24
const ZOOM_END = 0.54
const CLIMB_START = 0.56
const CLIMB_END = 0.98
const Q_CLOSE = new THREE.Quaternion().setFromEuler(CLOSE.rot)
const Q_SIDE = new THREE.Quaternion().setFromEuler(SIDE.rot)
const Q_PATH = new THREE.CatmullRomCurve3(
  [
    SIDE.pos,
    new THREE.Vector3(1.05, 0.48, -0.52),
    new THREE.Vector3(1.5, 1.02, -1.22),
    new THREE.Vector3(0.72, 1.52, -2.05),
    new THREE.Vector3(-0.72, 1.38, -2.88),
    new THREE.Vector3(-1.02, 0.94, -3.82),
    new THREE.Vector3(0.25, 0.92, -4.82),
    new THREE.Vector3(4.8, 2.15, -7),
  ],
  false,
  "catmullrom",
  0.42,
)

function ProceduralAirliner() {
  const model = useAirlinerModel()
  return <primitive object={model} />
}

function physicalFromStandard(source: THREE.MeshStandardMaterial) {
  const upgraded = new THREE.MeshPhysicalMaterial({
    color: source.color,
    map: source.map,
    normalMap: source.normalMap,
    normalScale: source.normalScale,
    roughness: Math.max(0.16, source.roughness * 0.88),
    roughnessMap: source.roughnessMap,
    metalness: Math.max(0.24, source.metalness),
    metalnessMap: source.metalnessMap,
    emissive: source.emissive,
    emissiveMap: source.emissiveMap,
    emissiveIntensity: source.emissiveIntensity,
    aoMap: source.aoMap,
    aoMapIntensity: source.aoMapIntensity,
    alphaMap: source.alphaMap,
    opacity: source.opacity,
    transparent: source.transparent,
    side: source.side,
    clearcoat: 0.62,
    clearcoatRoughness: 0.17,
    envMapIntensity: 1.18,
  })
  upgraded.name = `${source.name || "airliner"}-physical`
  for (const texture of [
    upgraded.map,
    upgraded.normalMap,
    upgraded.roughnessMap,
    upgraded.metalnessMap,
    upgraded.emissiveMap,
    upgraded.aoMap,
  ]) {
    if (texture) texture.anisotropy = 8
  }
  return upgraded
}

function GeneratedAirliner({ onReady }: { onReady: () => void }) {
  const { scene } = useGLTF("/models/aeolus-airliner.glb")
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      const source = object.material
      object.material = Array.isArray(source)
        ? source.map((material) =>
            material instanceof THREE.MeshStandardMaterial
              ? physicalFromStandard(material)
              : material.clone(),
          )
        : source instanceof THREE.MeshStandardMaterial
          ? physicalFromStandard(source)
          : source.clone()
    })

    const bounds = new THREE.Box3().setFromObject(clone)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    clone.position.sub(center)
    clone.scale.setScalar(5.8 / Math.max(size.x, size.y, size.z))

    const wrapper = new THREE.Group()
    wrapper.add(clone)
    // Meshy inferred the source image with its nose on local -X. Normalize
    // that axis once so every flight quaternion can treat +X as forward.
    wrapper.rotation.y = Math.PI
    return wrapper
  }, [scene])

  useEffect(() => {
    onReady()
    return () => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material.dispose()
      })
    }
  }, [model, onReady])

  return <primitive object={model} />
}

useGLTF.preload("/models/aeolus-airliner.glb")

function orientationFromTangent(tangent: THREE.Vector3, bank: number) {
  const x = tangent.clone().normalize()
  const z = new THREE.Vector3().crossVectors(x, new THREE.Vector3(0, 1, 0))
  if (z.lengthSq() < 0.0001) z.set(0, 0, 1)
  z.normalize()
  const y = new THREE.Vector3().crossVectors(z, x).normalize()
  const aim = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, z),
  )
  return new THREE.Quaternion().setFromAxisAngle(x, bank).multiply(aim)
}

function PlaneRig({
  onReady,
}: {
  onReady: () => void
}) {
  const ref = useRef<THREE.Group>(null)
  const progressSpring = useRef(new Spring(82, 2 * Math.sqrt(82)))
  const point = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const group = ref.current
    if (!group) return

    const reducedMotion = landingScroll.reducedMotion
    const target = landingScroll.scenes.flight
    const t = reducedMotion
      ? progressSpring.current.snap(target)
      : progressSpring.current.step(target, delta)
    const visibility = 1 - THREE.MathUtils.smoothstep(t, 0.9, 0.995)
    group.visible = visibility > 0.005
    if (!group.visible) return

    if (t <= CLIMB_START) {
      const zoom = THREE.MathUtils.smoothstep(t, ZOOM_START, ZOOM_END)
      group.position.lerpVectors(CLOSE.pos, SIDE.pos, zoom)
      group.quaternion.copy(Q_CLOSE).slerp(Q_SIDE, zoom)
      group.scale.setScalar(THREE.MathUtils.lerp(CLOSE.scale, SIDE.scale, zoom))
      if (!reducedMotion) {
        group.position.y += Math.sin(state.clock.elapsedTime * 0.65) * 0.028
        group.rotation.z += Math.sin(state.clock.elapsedTime * 0.42) * 0.012
      }
      return
    }

    const pathProgress = THREE.MathUtils.smootherstep(
      t,
      CLIMB_START,
      CLIMB_END,
    )
    Q_PATH.getPointAt(pathProgress, point)
    Q_PATH.getTangentAt(Math.min(0.999, pathProgress + 0.002), tangent)
    group.position.copy(point)

    const turn = Math.sin(pathProgress * Math.PI * 2.2)
    const pathRotation = orientationFromTangent(tangent, -0.13 - turn * 0.075)
    const entryBlend = THREE.MathUtils.smoothstep(pathProgress, 0, 0.12)
    group.quaternion.copy(Q_SIDE).slerp(pathRotation, entryBlend)
    group.scale.setScalar(THREE.MathUtils.lerp(SIDE.scale, 0.18, pathProgress))
  })

  return (
    <group ref={ref}>
      <Suspense fallback={null}>
        <GeneratedAirliner onReady={onReady} />
      </Suspense>
    </group>
  )
}

export function HeroPlane3D() {
  const layerRef = useRef<HTMLDivElement>(null)
  const unregisterCanvasRef = useRef<null | (() => void)>(null)
  const [modelReady, setModelReady] = useState(false)
  const markReady = useCallback(() => {
    markLandingAssetReady("airliner")
    setModelReady(true)
  }, [])

  useEffect(
    () => {
      const unregisterFrame = registerLandingFrame(() => {
        const layer = layerRef.current
        if (!layer) return
        const progress = landingScroll.scenes.flight
        const exit = THREE.MathUtils.smoothstep(progress, 0.9, 0.995)
        const visible =
          landingScroll.active.airliner &&
          !landingScroll.reducedMotion &&
          exit < 0.999
        layer.style.opacity = visible ? String(1 - exit) : "0"
        layer.style.visibility = visible ? "visible" : "hidden"
      })

      return () => {
        unregisterFrame()
        unregisterCanvasRef.current?.()
        unregisterCanvasRef.current = null
      }
    },
    [],
  )

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={`ae-plane-layer${modelReady ? " is-model-ready" : ""}`}
    >
      <Image
        alt=""
        className="ae-plane-poster"
        fill
        priority
        sizes="100vw"
        src="/images/aeolus-airliner-poster.webp"
      />
      <Canvas
        camera={{ position: [0.55, -0.28, 8.6], fov: 32 }}
        dpr={[1, 2]}
        frameloop="never"
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        onCreated={(state) => {
          const { gl } = state
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMappingExposure = 1.1
          unregisterCanvasRef.current?.()
          unregisterCanvasRef.current = registerThreeRoot(
            "airliner",
            state,
            () =>
              landingScroll.active.airliner &&
              !landingScroll.reducedMotion,
          )
        }}
      >
        <StudioEnvironment />
        <hemisphereLight args={["#fff8e9", "#18101e", 0.42]} />
        <directionalLight
          castShadow
          color="#fff7e8"
          intensity={1.45}
          position={[4.8, 6.2, 5.4]}
        />
        <spotLight
          angle={0.48}
          color="#d8c6ff"
          intensity={14}
          penumbra={0.82}
          position={[-4, 2.6, 4]}
        />
        <PlaneRig onReady={markReady} />
      </Canvas>
    </div>
  )
}
