"use client"
/**
 * HeroPlane3D — the textured airliner, flown down THROUGH the AEOLUS wordmark.
 *
 * The model is the shipped GLB (`/models/aeolus-airliner.glb`): one 30k-vertex
 * mesh carrying a baked base-colour atlas, a normal map, a metallic-roughness
 * map and an emissive map — window rows, doors, panel lines, the gold cheatline
 * and the plum fin are all IN the maps. A previous pass replaced it with a
 * hand-built lathe-and-extrude model whose materials had no maps at all; that
 * read as untextured plastic with detached nacelles, so the GLB path is back
 * and the procedural model is gone.
 *
 * Choreography (one pinned scene, scrubbed by scroll):
 *   0.00–0.20  a close 3/4 hero view holds while the cabin's sky lifts away
 *   0.20–0.48  pulls out and left to a cruise pose, clearing the lower frame
 *   0.35–0.62  the AEOLUS wordmark wipes in underneath (IdentityBand)
 *   0.62–1.00  ONE continuous descent: the aircraft banks right, noses over,
 *              crosses the wordmark band — passing in front of the letter tops
 *              and behind their lower halves — and leaves through the bottom
 *              of the frame at readable scale.
 *
 * The pass-through is a stacking trick, not a shader: IdentityBand paints the
 * same wordmark twice, once under this canvas and once over it, clipped. See
 * identity-band.tsx.
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
import { damp } from "@/lib/spring"
import { CanvasBudget } from "@/components/landing/canvas-budget"

/** Recorded in ASSETS.md. Base colour, normal, metallic-roughness and emissive
 * are baked into this file — there is no separate texture to wire up. */
const AIRLINER_MODEL = "/models/aeolus-airliner.glb"

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

/**
 * Upgrade a loaded standard material to physical so the airframe reads as
 * polished paint under the studio environment, keeping every baked map.
 */
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
    // The airframe is seen at a shallow angle for most of the descent, which is
    // exactly where an unfiltered map turns the window row into aliasing noise.
    if (texture) texture.anisotropy = 8
  }
  return upgraded
}

function GeneratedAirliner({ onReady }: { onReady: () => void }) {
  const { scene } = useGLTF(AIRLINER_MODEL)
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
    // The source model has its nose on local −X. Normalise that once here so
    // every flight quaternion downstream can treat +X as forward.
    wrapper.rotation.y = Math.PI
    return wrapper
  }, [scene])

  useEffect(() => {
    onReady()
    return () => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material]
        for (const material of materials) material.dispose()
      })
    }
  }, [model, onReady])

  return <primitive object={model} />
}

useGLTF.preload(AIRLINER_MODEL)

/**
 * ── THE AIRCRAFT FACES LEFT, 2026-08-16 ──────────────────────────────────
 *
 * The manoeuvre is a BACKWARDS Q: the aircraft crosses the wordmark RIGHT to
 * LEFT and the tail stroke curls down-left, mirroring the previous path.
 *
 * Both poses below are mirrored with it, and they have to be. Yaw mirrors as
 * `θ → π − θ` (a Y-rotation takes forward +X to (cos θ, 0, −sin θ); negating x
 * gives (−cos θ, 0, −sin θ), which is π − θ) and roll negates. Mirroring only
 * the PATH and leaving these was the obvious cheaper edit and it does not work:
 * the cruise pose would have slerped from yaw −0.28 to yaw +3.60 during the
 * pull-back, i.e. a 222° rotation, and the hero would have visibly spun on its
 * axis before flying anywhere.
 *
 * CLOSE keeps its x. It already sits on the right of frame, which is where a
 * right-to-left run wants to begin — mirroring its position too would have sent
 * the aircraft left during the pull-back and then straight back across to the
 * right to start the cross, crossing the frame three times to make two moves.
 */
const CLOSE = {
  pos: new THREE.Vector3(0.72, -0.2, 1.3),
  rot: new THREE.Euler(0.08, Math.PI + 0.28, 0),
  scale: 2.16,
}
/**
 * Cruise pose. Held high and left of centre on purpose: the wordmark wipes in
 * across the middle of the frame under the aircraft, and the descent needs a
 * full diagonal of travel before it reaches the letters. A centred cruise pose
 * left the plane already sitting on the type with nowhere to fall from.
 */
/**
 * Cruise pose: left of centre and level with the wordmark band, because the
 * next move is a crossing rather than a dive. It used to sit high and left,
 * which made the only available path a diagonal that cut the corner of the
 * type instead of running through it.
 */
const SIDE = {
  pos: new THREE.Vector3(1.9, 0.55, -0.2),
  rot: new THREE.Euler(0.05, Math.PI + 0.46, -0.01),
  scale: 0.62,
}
const ZOOM_START = 0.2
const ZOOM_END = 0.48
/**
 * The cross-and-dive occupies the LAST THIRD of the scene, not the last 38%.
 * It used to start at 0.62 and finish at 0.985, so a fast flick crossed the
 * whole manoeuvre in a few frames and the aircraft appeared to vanish. Starting
 * later and ending at 1.0 gives the hold a longer beat and spreads the descent
 * across more scroll, so the same flick covers proportionally less of it.
 */
const CLIMB_START = 0.72
const CLIMB_END = 1
const Q_CLOSE = new THREE.Quaternion().setFromEuler(CLOSE.rot)
const Q_SIDE = new THREE.Quaternion().setFromEuler(SIDE.rot)
/**
 * The Q. Two moves in one continuous curve:
 *
 *   u 0.00 → 0.45   THE CROSS. The aircraft tracks left-to-right straight
 *                   ACROSS the AEOLUS wordmark, holding y inside the letter
 *                   band so it passes through the letterforms rather than
 *                   diagonally past them. This is the beat the brief asks for:
 *                   a crossing, not a fly-by.
 *   u 0.45 → 1.00   THE TAIL. Having cleared the S it curls over, banks hard
 *                   and dives out through the bottom of the frame — the stroke
 *                   that turns an O into a Q — and the wordmark is dragged down
 *                   with it (see DRAG_START in identity-band.tsx).
 *
 * The camera sits at (0.55, −0.28, 8.6) with a 32° fov looking at the origin,
 * so at z=0 the frame is roughly y ∈ [−2.47, 2.47] and the wordmark band —
 * centred in the viewport — occupies about y ∈ [−0.8, 0.8]. Points 2–5 sit
 * inside that band; if the band's height in identity-band.tsx changes, these
 * are what to retune or the cross misses the type.
 *
 * The old shake came from deriving bank off quantised curve tangents, which is
 * fixed by the closed-form `bankAt`/`pitchAt` below — so this path is allowed
 * the single x reversal in its tail that makes the Q a Q. y still only falls.
 */
const Q_PATH = new THREE.CatmullRomCurve3(
  [
    SIDE.pos.clone(),
    new THREE.Vector3(1.55, 0.46, -0.16), // entering the band from the RIGHT
    new THREE.Vector3(0.78, 0.32, -0.08), // ── across the letters ──
    new THREE.Vector3(-0.05, 0.16, 0.02),
    new THREE.Vector3(-0.88, -0.02, 0.14),
    new THREE.Vector3(-1.52, -0.26, 0.3), // clear of the A, starting to curl
    new THREE.Vector3(-1.88, -0.74, 0.52), // ── the tail of the backwards Q ──
    new THREE.Vector3(-1.82, -1.48, 0.82),
    new THREE.Vector3(-1.52, -2.38, 1.16),
    new THREE.Vector3(-1.12, -3.4, 1.5),
  ],
  false,
  "catmullrom",
  0.5,
)
const Q_FRAMES = Q_PATH.computeFrenetFrames(400, false)

/**
 * Bank and pitch are AUTHORED functions of path progress, not derived from the
 * curve's curvature.
 *
 * The old rig took a ±0.008 finite difference of `getTangentAt` and multiplied
 * the result by 42. `getTangentAt` reads an arc-length lookup table with 200
 * divisions, so a ±0.008 step lands barely one division apart and the estimate
 * quantises — that quantisation noise, amplified 42× and clamped at ±55°, is
 * what snapped the roll between extremes every frame. A closed-form profile
 * cannot jitter no matter how the curve is sampled.
 */
// Attitude follows the two moves. Near level across the letters — a hard bank
// while crossing would hide the silhouette edge-on exactly where it is meant to
// read against the type — then rolling into the turn as the tail curls away.
// NEGATED with the mirrored path: the tail now curls to the LEFT, so the
// aircraft banks left through it. Bank is the one attitude term that has to
// flip when a path is mirrored — pitch does not, which is why `pitchAt` below
// is unchanged.
const bankAt = (u: number) =>
  -(
    THREE.MathUtils.degToRad(7) * Math.sin(Math.PI * Math.min(u / 0.4, 1)) +
    THREE.MathUtils.degToRad(34) * THREE.MathUtils.smoothstep(u, 0.45, 0.86)
  )
// Likewise the nose: level through the cross, then a trim on top of what the
// descending tangent already supplies. Kept modest — stacking a large pitch on
// the tangent read as a near-vertical plunge.
const pitchAt = (u: number) =>
  THREE.MathUtils.degToRad(2) * Math.sin(Math.PI * Math.min(u / 0.35, 1)) -
  THREE.MathUtils.degToRad(11) * THREE.MathUtils.smoothstep(u, 0.5, 0.95)

const CONTRAIL_SAMPLES = 120

function Contrail({
  progress,
}: {
  progress: { current: number }
}) {
  const { gl } = useThree()
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry()
    result.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(CONTRAIL_SAMPLES * 2 * 3),
        3,
      ),
    )
    result.setAttribute(
      "aAlpha",
      new THREE.BufferAttribute(
        new Float32Array(CONTRAIL_SAMPLES * 2),
        1,
      ),
    )
    return result
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        blending: THREE.NormalBlending,
        depthWrite: false,
        transparent: true,
        uniforms: {
          uOpacity: { value: 0 },
          uPixelRatio: { value: 1 },
        },
        vertexShader: `
          attribute float aAlpha;
          varying float vAlpha;
          uniform float uPixelRatio;

          void main() {
            vAlpha = aAlpha;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            float perspective = 11.0 / max(8.0, -viewPosition.z);
            gl_PointSize = (2.0 + aAlpha * 4.8) * uPixelRatio * perspective;
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          uniform float uOpacity;

          void main() {
            vec2 centered = gl_PointCoord - 0.5;
            float radial = 1.0 - smoothstep(0.08, 0.5, length(centered));
            float filament = 0.76 + 0.24 * smoothstep(0.5, 0.0, abs(centered.y));
            vec3 aeolusVapor = vec3(0.42, 0.34, 0.68);
            gl_FragColor = vec4(aeolusVapor, radial * filament * vAlpha * uOpacity * 0.34);
          }
        `,
      }),
    [],
  )
  const point = useMemo(() => new THREE.Vector3(), [])
  const binormal = useMemo(() => new THREE.Vector3(), [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    const u = progress.current
    const positionAttribute = geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute
    const alphaAttribute = geometry.getAttribute(
      "aAlpha",
    ) as THREE.BufferAttribute
    const positions = positionAttribute.array as Float32Array
    const alphas = alphaAttribute.array as Float32Array
    const reveal = THREE.MathUtils.smoothstep(u, 0.015, 0.12)
    const exit = 1 - THREE.MathUtils.smoothstep(u, 0.82, 1)
    material.uniforms.uOpacity.value = reveal * exit
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.75)

    for (let index = 0; index < CONTRAIL_SAMPLES; index += 1) {
      const age = index / (CONTRAIL_SAMPLES - 1)
      const sample = u - age * 0.19
      const alpha =
        sample > 0
          ? Math.pow(1 - age, 1.55) *
            (1 - THREE.MathUtils.smoothstep(age, 0.88, 1))
          : 0
      Q_PATH.getPointAt(Math.max(0, sample), point)
      const frameIndex = Math.min(
        400,
        Math.max(0, Math.round(Math.max(0, sample) * 400)),
      )
      binormal.copy(Q_FRAMES.binormals[frameIndex])
      const expansion =
        age *
        (0.012 +
          Math.sin(index * 1.73 + state.clock.elapsedTime * 0.35) *
            0.006)
      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const side = sideIndex === 0 ? -1 : 1
        const vertex = index * 2 + sideIndex
        const offset = vertex * 3
        positions[offset] =
          point.x + binormal.x * (side * 0.045 + expansion)
        positions[offset + 1] =
          point.y + binormal.y * (side * 0.045 + expansion)
        positions[offset + 2] =
          point.z + binormal.z * (side * 0.045 + expansion)
        alphas[vertex] = alpha
      }
    }
    positionAttribute.needsUpdate = true
    alphaAttribute.needsUpdate = true
  })

  return (
    <points
      frustumCulled={false}
      geometry={geometry}
      material={material}
    />
  )
}

function PlaneRig({
  onReady,
}: {
  onReady: () => void
}) {
  const ref = useRef<THREE.Group>(null)
  // One filter, not three. Scroll already passes through Lenis (lerp 0.085)
  // and a ScrollTrigger scrub of 1.2; stacking a second-order spring on top of
  // those added visible rubber-banding on every direction change. A single
  // frame-rate-independent damp is enough to absorb dropped frames.
  const smoothed = useRef(0)
  const pathProgress = useRef(0)
  const point = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const lateralAxis = useMemo(() => new THREE.Vector3(), [])
  const upAxis = useMemo(() => new THREE.Vector3(), [])
  const basis = useMemo(() => new THREE.Matrix4(), [])
  const pathRotation = useMemo(() => new THREE.Quaternion(), [])
  const bankRotation = useMemo(() => new THREE.Quaternion(), [])
  const pitchRotation = useMemo(() => new THREE.Quaternion(), [])

  useFrame((state, delta) => {
    const group = ref.current
    if (!group) return

    const reducedMotion = landingScroll.reducedMotion
    const target = landingScroll.scenes.flight
    if (reducedMotion) smoothed.current = target
    // 6, not 14. This is the aircraft's own inertia on top of Lenis and the
    // 1.2 scrub, and at 14 it tracked the scroll almost rigidly — a fast flick
    // threw the whole descent past in a couple of frames and read as the plane
    // disappearing. A softer follow means the airframe keeps flying its arc
    // for a moment after the wheel stops, which is both calmer and harder to
    // skip past.
    else smoothed.current = damp(smoothed.current, target, 6, delta)
    const t = smoothed.current
    // The aircraft leaves through the bottom of the frame, so it does not need
    // to be faded out — this is only a safety net for a very fast flick past
    // the end of the pin. Held to the last 1% so it never dissolves in shot.
    const visibility = 1 - THREE.MathUtils.smoothstep(t, 0.99, 1)
    group.visible = visibility > 0.005
    if (!group.visible) return

    if (t <= CLIMB_START) {
      pathProgress.current = 0
      const zoom = THREE.MathUtils.smoothstep(t, ZOOM_START, ZOOM_END)
      group.position.lerpVectors(CLOSE.pos, SIDE.pos, zoom)
      group.quaternion.copy(Q_CLOSE).slerp(Q_SIDE, zoom)
      group.scale.setScalar(THREE.MathUtils.lerp(CLOSE.scale, SIDE.scale, zoom))
      // NO IDLE BOB. There used to be a `position.y += sin(elapsedTime * 0.55)
      // * 0.018` here, intended as a floating hover. Two things made it read as
      // a shake rather than as flight. It ran on WALL-CLOCK time while every
      // other motion on this layer is driven by SCROLL POSITION, so it kept
      // moving when the aircraft was meant to be held still — and the eye reads
      // sustained unexplained movement in a hero object as instability, not
      // life. Worse, it applied to the same `position.y` the zoom lerp had just
      // written, so at any scroll position where the lerp was mid-flight the
      // two fought each other frame to frame.
      //
      // A held aircraft is now genuinely held. Motion on this layer comes from
      // scroll and from nothing else.
      return
    }

    const u = THREE.MathUtils.smootherstep(t, CLIMB_START, CLIMB_END)
    pathProgress.current = u
    Q_PATH.getPointAt(u, point)
    Q_PATH.getTangentAt(u, tangent)
    group.position.copy(point)

    lateralAxis.crossVectors(tangent, THREE.Object3D.DEFAULT_UP)
    if (lateralAxis.lengthSq() < 0.0001) lateralAxis.set(0, 0, 1)
    lateralAxis.normalize()
    upAxis.crossVectors(lateralAxis, tangent).normalize()
    basis.makeBasis(tangent, upAxis, lateralAxis)
    pathRotation.setFromRotationMatrix(basis)

    bankRotation.setFromAxisAngle(tangent, bankAt(u))
    pathRotation.premultiply(bankRotation)
    pitchRotation.setFromAxisAngle(lateralAxis, pitchAt(u))
    pathRotation.premultiply(pitchRotation)

    const entryBlend = THREE.MathUtils.smoothstep(u, 0, 0.12)
    group.quaternion.copy(Q_SIDE).slerp(pathRotation, entryBlend)
    // Stays a readable aircraft all the way out instead of shrinking to a
    // speck — it exits the frame at size, which is what sells the downward pull.
    group.scale.setScalar(
      THREE.MathUtils.lerp(SIDE.scale, 0.52, THREE.MathUtils.smoothstep(u, 0.1, 0.75)),
    )
  })

  return (
    <>
      <Contrail progress={pathProgress} />
      <group ref={ref}>
        <Suspense fallback={null}>
          <GeneratedAirliner onReady={onReady} />
        </Suspense>
      </group>
    </>
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
        // Starts only once the airframe is already below the frame bottom
        // (u ≈ 0.93 on the path). Fading from 0.9 dissolved it in mid-air,
        // which killed the whole point of exiting through the bottom.
        const exit = THREE.MathUtils.smoothstep(progress, 0.95, 0.999)
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
        <CanvasBudget />
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
