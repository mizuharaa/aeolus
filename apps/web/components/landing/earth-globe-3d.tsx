"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, type ThreeEvent, useFrame, useLoader } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"
import {
  landingScroll,
  markLandingAssetReady,
  registerThreeRoot,
} from "@/lib/scroll"

export type GlobeEventKind = "closure" | "storm" | "cyber" | "ash" | "crew"

export type GlobeEvent = {
  id: string
  kind: GlobeEventKind
  city: string
  airport: string
  lat: number
  lon: number
  title: string
  effect: string
  response: string
  tone: "amber" | "violet" | "rose" | "slate"
}

export const GLOBE_EVENTS: GlobeEvent[] = [
  {
    id: "ord-closure",
    kind: "closure",
    city: "Chicago",
    airport: "KORD",
    lat: 41.9742,
    lon: -87.9073,
    title: "Hub closure",
    effect: "Departure bank held",
    response: "Recovery plans recomputing",
    tone: "amber",
  },
  {
    id: "mnl-storm",
    kind: "storm",
    city: "Manila",
    airport: "RPLL",
    lat: 14.5086,
    lon: 121.0198,
    title: "Convective storm",
    effect: "Arrival flow compressed",
    response: "Weather alternates active",
    tone: "rose",
  },
  {
    id: "sin-cyber",
    kind: "cyber",
    city: "Singapore",
    airport: "WSSS",
    lat: 1.3644,
    lon: 103.9915,
    title: "Cyber disruption",
    effect: "Dispatch link isolated",
    response: "Manual control channel open",
    tone: "violet",
  },
  {
    id: "kef-ash",
    kind: "ash",
    city: "Keflavík",
    airport: "BIKF",
    lat: 63.985,
    lon: -22.6056,
    title: "Volcanic ash",
    effect: "North Atlantic tracks constrained",
    response: "Route exposure recalculating",
    tone: "slate",
  },
  {
    id: "lhr-crew",
    kind: "crew",
    city: "London",
    airport: "EGLL",
    lat: 51.47,
    lon: -0.4543,
    title: "Crew displacement",
    effect: "Legality window tightening",
    response: "Reserve pairings ranked",
    tone: "amber",
  },
]

const DEG = Math.PI / 180
const EARTH_RADIUS = 2.18
const OUT = new THREE.Vector3(0, 0, 1)

useTexture.preload("/textures/earth-blue-marble.jpg")
useTexture.preload("/textures/earth-normal.jpg")

const EVENT_SIGNAL_COLOR = "#E4A728"
const RUNWAY_SURFACE_COLOR = "#2A2112"
const COUNTRY_DATA_URL = "/data/ne-110m-admin-0-countries.json"

type LonLat = [number, number]
type CountryGeometry =
  | { type: "Polygon"; coordinates: LonLat[][] }
  | { type: "MultiPolygon"; coordinates: LonLat[][][] }
type CountryCollection = {
  features: Array<{ geometry: CountryGeometry | null }>
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  return reduced
}

function latLonToVector3(lat: number, lon: number, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * DEG
  const theta = (lon + 180) * DEG
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function CountryBorders() {
  const source = useLoader(THREE.FileLoader, COUNTRY_DATA_URL)
  const geometry = useMemo(() => {
    const raw =
      typeof source === "string"
        ? source
        : new TextDecoder().decode(source as ArrayBuffer)
    const collection = JSON.parse(raw) as CountryCollection
    const positions: number[] = []

    const appendRing = (ring: LonLat[]) => {
      for (let index = 1; index < ring.length; index += 1) {
        const previous = ring[index - 1]
        const current = ring[index]
        if (!previous || !current) continue
        // Dateline-wrapping polygon edges otherwise draw a chord through
        // the globe. The adjacent segment on the opposite side closes it.
        if (Math.abs(current[0] - previous[0]) > 180) continue
        const a = latLonToVector3(previous[1], previous[0], EARTH_RADIUS + 0.022)
        const b = latLonToVector3(current[1], current[0], EARTH_RADIUS + 0.022)
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }

    for (const feature of collection.features) {
      const shape = feature.geometry
      if (!shape) continue
      if (shape.type === "Polygon") {
        shape.coordinates.forEach(appendRing)
      } else {
        shape.coordinates.forEach((polygon) => polygon.forEach(appendRing))
      }
    }

    const result = new THREE.BufferGeometry()
    result.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    )
    result.computeBoundingSphere()
    return result
  }, [source])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments geometry={geometry} renderOrder={4}>
      <lineBasicMaterial
        color={EVENT_SIGNAL_COLOR}
        transparent
        opacity={0.38}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  )
}

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          glowColor: { value: new THREE.Color("#6FA8E7") },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float fresnel = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 5.2);
            gl_FragColor = vec4(glowColor, fresnel * 0.22);
          }
        `,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh scale={1.028} material={material}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 48]} />
    </mesh>
  )
}

function ClosureEffect({
  color,
  reducedMotion,
}: {
  color: string
  reducedMotion: boolean
}) {
  const sweepRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (reducedMotion) return
    const time = clock.elapsedTime
    if (sweepRef.current) {
      sweepRef.current.rotation.z = time * 0.42
    }
    lightRef.current?.children.forEach((child, index) => {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = 0.46 + Math.sin(time * 1.85 + index * 1.1) * 0.22
    })
  })

  return (
    <group>
      <mesh position={[0, 0, 0.025]}>
        <circleGeometry args={[0.31, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {[
        { rotation: Math.PI / 4, width: 0.42 },
        { rotation: -Math.PI / 4, width: 0.34 },
      ].map((runway, runwayIndex) => (
        <group
          key={runway.rotation}
          position={[0, 0, 0.075 + runwayIndex * 0.012]}
          rotation={[0, 0, runway.rotation]}
        >
          <mesh>
            <boxGeometry args={[runway.width, 0.064, 0.026]} />
            <meshStandardMaterial
              color={RUNWAY_SURFACE_COLOR}
              metalness={0.58}
              roughness={0.48}
              emissive={color}
              emissiveIntensity={0.16}
            />
          </mesh>
          {[-0.12, 0, 0.12].map((x) => (
            <mesh key={x} position={[x, 0, 0.019]}>
              <boxGeometry args={[0.032, 0.071, 0.009]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={2.35}
                roughness={0.34}
              />
            </mesh>
          ))}
        </group>
      ))}

      <group ref={lightRef} position={[0, 0, 0.105]}>
        {[
          [-0.28, -0.13, -0.35],
          [-0.18, 0.25, 0.58],
          [0.22, 0.22, -0.42],
          [0.29, -0.11, 0.44],
        ].map(([x, y, rotation], index) => (
          <mesh key={index} position={[x, y, 0]} rotation={[0, 0, rotation]}>
            <boxGeometry args={[0.072, 0.018, 0.012]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.62}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      <mesh position={[0, 0, 0.052]} rotation={[0, 0, -0.32]}>
        <ringGeometry args={[0.346, 0.36, 40, 1, 0.18, 1.58]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.72}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.054]} rotation={[0, 0, 2.72]}>
        <ringGeometry args={[0.394, 0.406, 40, 1, 0.08, 0.92]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={sweepRef} position={[0, 0, 0.047]}>
        <mesh position={[0, 0.255, 0]}>
          <boxGeometry args={[0.009, 0.31, 0.008]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.415, 0]}>
          <boxGeometry args={[0.028, 0.045, 0.012]} />
          <meshBasicMaterial color={color} transparent opacity={0.82} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function StormEffect({ color }: { color: string }) {
  return (
    <group position={[0, 0, 0.11]}>
      {[
        [-0.13, 0.03, 0.03, 0.12],
        [-0.03, 0.09, 0.08, 0.17],
        [0.11, 0.04, 0.02, 0.14],
        [0.02, -0.02, 0, 0.15],
      ].map(([x, y, z, radius], index) => (
        <mesh key={index} position={[x, y, z]}>
          <sphereGeometry args={[radius, 18, 14]} />
          <meshStandardMaterial
            color={index === 1 ? "#D9E3ED" : "#AAB7C5"}
            roughness={0.88}
            emissive={index === 1 ? color : "#4F5D70"}
            emissiveIntensity={index === 1 ? 0.35 : 0.12}
          />
        </mesh>
      ))}
      {[-0.1, 0, 0.1].map((x, index) => (
        <mesh key={x} position={[x, -0.16 - index * 0.015, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.16, 6]} />
          <meshBasicMaterial color="#7CC2F0" transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  )
}

function CyberEffect({ color }: { color: string }) {
  return (
    <group position={[0, 0, 0.06]}>
      <mesh>
        <ringGeometry args={[0.13, 0.17, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.86} side={THREE.DoubleSide} />
      </mesh>
      {[-0.11, -0.04, 0.04, 0.11].map((x, index) => (
        <mesh key={x} position={[x, 0.03 - index * 0.025, 0.11 + index * 0.025]}>
          <boxGeometry args={[0.028, 0.18 - index * 0.02, 0.035]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.6 - index * 0.25} />
        </mesh>
      ))}
    </group>
  )
}

function AshEffect({ color }: { color: string }) {
  const positions = useMemo(() => {
    const values = new Float32Array(96 * 3)
    let seed = 37
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let index = 0; index < 96; index += 1) {
      const spread = 0.035 + index * 0.0018
      values[index * 3] = (random() - 0.5) * spread * 2
      values[index * 3 + 1] = (random() - 0.5) * spread * 1.4
      values[index * 3 + 2] = 0.04 + random() * 0.38 + index * 0.0018
    }
    return values
  }, [])

  return (
    <points position={[0, 0, 0.04]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.035} transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}

function CrewEffect({ color }: { color: string }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.25, -0.04, 0.04),
        new THREE.Vector3(-0.08, 0.08, 0.22),
        new THREE.Vector3(0.12, 0.12, 0.28),
        new THREE.Vector3(0.28, -0.02, 0.08),
      ]),
    [],
  )

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 48, 0.012, 6, false]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.1} />
      </mesh>
      <mesh position={[-0.25, -0.04, 0.045]}>
        <ringGeometry args={[0.05, 0.075, 24]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.28, -0.02, 0.085]}>
        <ringGeometry args={[0.05, 0.075, 24]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function EventEffect({
  event,
  selected,
  reducedMotion,
}: {
  event: GlobeEvent
  selected: boolean
  reducedMotion: boolean
}) {
  const pulseRef = useRef<THREE.Group>(null)
  const amountRef = useRef(0)
  const point = useMemo(() => latLonToVector3(event.lat, event.lon, EARTH_RADIUS + 0.015), [event.lat, event.lon])
  const rotation = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(OUT, point.clone().normalize()),
    [point],
  )
  const color = EVENT_SIGNAL_COLOR

  useFrame(({ clock }, delta) => {
    const group = pulseRef.current
    if (!group) return
    const eventsActive =
      landingScroll.reducedMotion || landingScroll.scenes.globe >= 0.26
    const target = selected && eventsActive ? 1 : 0
    amountRef.current = THREE.MathUtils.damp(
      amountRef.current,
      target,
      4.8,
      Math.min(delta, 1 / 30),
    )
    const amount = amountRef.current
    group.visible = amount > 0.008
    if (!group.visible) return

    if (reducedMotion) {
      group.scale.setScalar(amount)
      group.rotation.z = 0
      return
    }
    const phase = clock.elapsedTime
    const pulse = 1 + Math.sin(phase * 1.55) * 0.026
    group.scale.setScalar(amount * pulse)
    group.rotation.z = Math.sin(phase * 0.5) * 0.034
  })

  return (
    <group position={point} quaternion={rotation}>
      <group ref={pulseRef}>
        {event.kind === "closure" && (
          <ClosureEffect color={color} reducedMotion={reducedMotion} />
        )}
        {event.kind === "storm" && <StormEffect color={color} />}
        {event.kind === "cyber" && <CyberEffect color={color} />}
        {event.kind === "ash" && <AshEffect color={color} />}
        {event.kind === "crew" && <CrewEffect color={color} />}
      </group>
    </group>
  )
}

function EarthModel({
  activeEvent,
  onReady,
  reducedMotion,
}: {
  activeEvent: GlobeEvent
  onReady?: () => void
  reducedMotion: boolean
}) {
  const planetRef = useRef<THREE.Group>(null)
  const drag = useRef({ active: false, x: 0, y: 0, until: 0 })
  const [albedo, normal] = useTexture([
    "/textures/earth-blue-marble.jpg",
    "/textures/earth-normal.jpg",
  ])
  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.075, 0.075),
      color: new THREE.Color("#D8DDD8"),
      roughness: 0.84,
      metalness: 0,
    })

    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
          #include <map_fragment>
          float aeLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(vec3(aeLuma), diffuseColor.rgb, 0.84);
        `,
      )
    }
    material.customProgramCacheKey = () => "aeolus-natural-earth-v2"
    return material
  }, [albedo, normal])

  useEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.anisotropy = 6
    normal.colorSpace = THREE.NoColorSpace
    normal.anisotropy = 4
    markLandingAssetReady("earth")
    onReady?.()
  }, [albedo, normal, onReady])

  useEffect(
    () => () => {
      globeMaterial.dispose()
    },
    [globeMaterial],
  )

  useEffect(() => {
    drag.current.until = 0
  }, [activeEvent.id])

  useFrame((_, delta) => {
    const group = planetRef.current
    if (!group) return
    const eventsActive =
      landingScroll.reducedMotion || landingScroll.scenes.globe >= 0.26
    const now = performance.now() / 1000
    const targetY = -activeEvent.lon * DEG - Math.PI / 2
    const targetX = THREE.MathUtils.clamp(activeEvent.lat * DEG, -0.92, 0.92)

    if (!eventsActive) {
      const idleX = -0.12
      const damping = 1 - Math.exp(-delta * 2.2)
      group.rotation.x += (idleX - group.rotation.x) * damping
      if (!reducedMotion && !drag.current.active) {
        group.rotation.y += delta * 0.075
      }
      return
    }

    if (reducedMotion && !drag.current.active) {
      group.rotation.y = targetY
      group.rotation.x = targetX
      return
    }

    if (drag.current.active || now < drag.current.until) {
      if (!drag.current.active) group.rotation.y += delta * 0.035
      return
    }

    const yDifference = Math.atan2(
      Math.sin(targetY - group.rotation.y),
      Math.cos(targetY - group.rotation.y),
    )
    const damping = 1 - Math.exp(-delta * 1.55)
    group.rotation.y += yDifference * damping
    group.rotation.x += (targetX - group.rotation.x) * damping
  })

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    drag.current.active = true
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    ;(event.nativeEvent.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const group = planetRef.current
    if (!group || !drag.current.active) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    group.rotation.y += dx * 0.006
    group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + dy * 0.0045, -1.05, 1.05)
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    drag.current.active = false
    drag.current.until = performance.now() / 1000 + 5
  }

  return (
    <group
      ref={planetRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <mesh castShadow receiveShadow material={globeMaterial}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 48]} />
      </mesh>
      <CountryBorders />
      <Atmosphere />
      {GLOBE_EVENTS.map((event) => (
        <EventEffect
          key={event.id}
          event={event}
          selected={event.id === activeEvent.id}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}

function EarthScene({
  activeEvent,
  onReady,
  reducedMotion,
}: {
  activeEvent: GlobeEvent
  onReady?: () => void
  reducedMotion: boolean
}) {
  return (
    <>
      <hemisphereLight args={["#D8E5EE", "#151D2B", 0.86]} />
      <directionalLight position={[5, 2.4, 5]} intensity={2.55} color="#F7EAD1" />
      <directionalLight position={[-4, -1.5, 1]} intensity={0.34} color="#7892B2" />
      <EarthModel
        activeEvent={activeEvent}
        onReady={onReady}
        reducedMotion={reducedMotion}
      />
    </>
  )
}

export function EarthGlobe3D({
  activeEvent,
  onReady,
}: {
  activeEvent: GlobeEvent
  onReady?: () => void
}) {
  const reducedMotion = useReducedMotionPreference()
  const rootRef = useRef<HTMLDivElement>(null)
  const unregisterCanvasRef = useRef<null | (() => void)>(null)

  useEffect(
    () => () => {
      unregisterCanvasRef.current?.()
      unregisterCanvasRef.current = null
    },
    [],
  )

  return (
    <div ref={rootRef} className="ae-globe-canvas">
      <Canvas
        aria-label="Interactive textured Earth showing a simulated airline disruption"
        camera={{ position: [0, 0.12, 7.8], fov: 32, near: 0.1, far: 80 }}
        dpr={[1, 2]}
        frameloop="never"
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        onCreated={(state) => {
          const { gl } = state
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 0.96
          unregisterCanvasRef.current?.()
          unregisterCanvasRef.current = registerThreeRoot(
            "globe",
            state,
            () => landingScroll.active.globe,
          )
        }}
      >
        <Suspense fallback={null}>
          <EarthScene
            activeEvent={activeEvent}
            onReady={onReady}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
