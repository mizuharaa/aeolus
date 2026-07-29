"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber"
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
useTexture.preload("/textures/earth-water-mask.png")
useTexture.preload("/textures/earth-roughness.png")
useTexture.preload("/textures/earth-night-lights.png")
useTexture.preload("/textures/earth-clouds.png")
useTexture.preload("/textures/earth-borders.png")

const EVENT_SIGNAL_COLOR = "#E4A728"
const RUNWAY_SURFACE_COLOR = "#2A2112"
const SUN_DIRECTION = new THREE.Vector3()

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

function updateSunDirection(time: number, target = SUN_DIRECTION) {
  const drift = time * 0.018
  return target
    .set(Math.cos(drift) * 0.78, 0.28 + Math.sin(drift * 0.63) * 0.09, 0.58)
    .normalize()
}

function CountryBorders({ texture }: { texture: THREE.Texture }) {
  return (
    <mesh scale={1.0028} renderOrder={5}>
      <sphereGeometry args={[EARTH_RADIUS, 128, 96]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.72}
        alphaTest={0.025}
        depthWrite={false}
        blending={THREE.NormalBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function NightLights({ texture }: { texture: THREE.Texture }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uMap: { value: texture },
          uSunDirection: { value: new THREE.Vector3(0.78, 0.28, 0.58).normalize() },
          uColor: { value: new THREE.Color("#FFC46B") },
          uIntensity: { value: 0.9 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform vec3 uSunDirection;
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            float ndl = dot(normalize(vWorldNormal), normalize(uSunDirection));
            float night = 1.0 - smoothstep(-0.15, 0.15, ndl);
            float lightMap = pow(texture2D(uMap, vUv).r, 1.18);
            float strength = lightMap * night * uIntensity;
            if (strength < 0.008) discard;
            gl_FragColor = vec4(uColor * strength * 1.3, strength);
          }
        `,
      }),
    [texture],
  )

  useFrame(({ clock }) => {
    updateSunDirection(clock.elapsedTime, material.uniforms.uSunDirection.value)
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh scale={1.0016} material={material} renderOrder={3}>
      <sphereGeometry args={[EARTH_RADIUS, 128, 96]} />
    </mesh>
  )
}

function CloudLayer({
  texture,
  reducedMotion,
}: {
  texture: THREE.Texture
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: texture },
          uSunDirection: { value: new THREE.Vector3(0.78, 0.28, 0.58).normalize() },
          uOpacity: { value: 0.34 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;
          void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform vec3 uSunDirection;
          uniform float uOpacity;
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;
          void main() {
            float clouds = pow(texture2D(uMap, vUv).r, 1.12);
            float ndl = dot(normalize(vWorldNormal), normalize(uSunDirection));
            float daylight = smoothstep(-0.22, 0.4, ndl);
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDirection), 0.0), 2.2);
            vec3 nightCloud = vec3(0.15, 0.18, 0.24);
            vec3 dayCloud = vec3(0.88, 0.92, 0.98);
            vec3 color = mix(nightCloud, dayCloud, daylight) + rim * vec3(0.12, 0.19, 0.28);
            float alpha = clouds * uOpacity * mix(0.36, 1.0, daylight);
            if (alpha < 0.008) discard;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      }),
    [texture],
  )

  useFrame(({ clock }, delta) => {
    updateSunDirection(clock.elapsedTime, material.uniforms.uSunDirection.value)
    if (!reducedMotion && meshRef.current) {
      meshRef.current.rotation.y += Math.min(delta, 1 / 30) * 0.009
    }
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh ref={meshRef} scale={1.007} material={material} renderOrder={2}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 72]} />
    </mesh>
  )
}

function Atmosphere({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSunDirection: { value: new THREE.Vector3(0.78, 0.28, 0.58).normalize() },
          uIndigo: { value: new THREE.Color("#33206F") },
          uCyan: { value: new THREE.Color("#4FD8E8") },
          uViolet: { value: new THREE.Color("#8E68ED") },
          uAmber: { value: new THREE.Color("#F5C572") },
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vLocalNormal;
          varying vec3 vWorldPosition;
          void main() {
            vLocalNormal = normalize(normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uSunDirection;
          uniform vec3 uIndigo;
          uniform vec3 uCyan;
          uniform vec3 uViolet;
          uniform vec3 uAmber;
          varying vec3 vWorldNormal;
          varying vec3 vLocalNormal;
          varying vec3 vWorldPosition;

          float hash31(vec3 p) {
            p = fract(p * 0.1031);
            p += dot(p, p.yzx + 33.33);
            return fract((p.x + p.y) * p.z);
          }

          float noise31(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                  mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                  mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
              f.z
            );
          }

          float fbm(vec3 p) {
            float value = 0.0;
            float amplitude = 0.55;
            for (int i = 0; i < 4; i++) {
              value += noise31(p) * amplitude;
              p = p * 2.03 + 7.17;
              amplitude *= 0.48;
            }
            return value;
          }

          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            vec3 worldNormal = normalize(vWorldNormal);
            float ndv = dot(worldNormal, viewDirection);
            float fresnel = pow(1.0 - abs(ndv), 3.2);
            float limb = smoothstep(0.38, 0.94, fresnel);
            float sunSide = smoothstep(-0.1, 0.62, dot(worldNormal, normalize(uSunDirection)));

            vec3 spectrum = mix(uIndigo, uCyan, smoothstep(0.0, 0.38, fresnel));
            spectrum = mix(spectrum, uViolet, smoothstep(0.38, 0.72, fresnel));
            spectrum = mix(spectrum, uAmber, smoothstep(0.78, 1.0, fresnel) * sunSide);

            float latitude = vLocalNormal.y;
            float w1 = sin(latitude * 34.0 + uTime * 0.55) * 0.5 + 0.5;
            float w2 = sin(latitude * 61.0 - uTime * 0.31 + fbm(vLocalNormal * 2.0) * 2.4) * 0.5 + 0.5;
            float wave = mix(w1, w2, 0.45) * limb * 0.22;

            float polar = smoothstep(0.62, 0.92, abs(latitude));
            float auroraNoise = smoothstep(0.5, 0.88, fbm(vLocalNormal * 8.0 + vec3(0.0, uTime * 0.035, 0.0)));
            vec3 auroraColor = mix(vec3(0.23, 0.93, 0.65), uViolet, smoothstep(0.75, 0.98, abs(latitude)));
            float aurora = polar * auroraNoise * limb * 0.22;

            float latGrid = 1.0 - smoothstep(0.0, 0.045, abs(sin(asin(clamp(vLocalNormal.y, -1.0, 1.0)) * 18.0)));
            float lonGrid = 1.0 - smoothstep(0.0, 0.045, abs(sin(atan(vLocalNormal.z, vLocalNormal.x) * 18.0)));
            float graticule = max(latGrid, lonGrid) * smoothstep(0.72, 0.98, fresnel) * 0.04;

            vec3 color = spectrum * (fresnel * 1.24 + wave);
            color += auroraColor * aurora;
            color += uCyan * graticule;
            float alpha = clamp(fresnel * 0.68 + wave * 0.42 + aurora + graticule, 0.0, 0.76);
            gl_FragColor = vec4(color, alpha);
          }
        `,
      }),
    [],
  )

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    updateSunDirection(clock.elapsedTime, material.uniforms.uSunDirection.value)
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh scale={1.04} material={material} renderOrder={7}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 72]} />
    </mesh>
  )
}

function StarField({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null)
  const { geometry, material } = useMemo(() => {
    const count = 4000
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    let seed = 9147
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    for (let index = 0; index < count; index += 1) {
      const z = random() * 2 - 1
      const azimuth = random() * Math.PI * 2
      const radius = 28 + random() * 34
      const radial = Math.sqrt(1 - z * z)
      positions[index * 3] = Math.cos(azimuth) * radial * radius
      positions[index * 3 + 1] = z * radius
      positions[index * 3 + 2] = Math.sin(azimuth) * radial * radius
      sizes[index] = 0.65 + Math.pow(random(), 5) * 2.9
      phases[index] = random() * Math.PI * 2
    }

    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    starGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1))
    starGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1))

    const starMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        attribute float aSize;
        attribute float aPhase;
        varying float vPulse;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vPulse = 0.72 + sin(uTime * 0.45 + aPhase) * 0.22;
          gl_PointSize = aSize * (86.0 / max(6.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vPulse;
        void main() {
          vec2 point = gl_PointCoord - 0.5;
          float alpha = (1.0 - smoothstep(0.08, 0.5, length(point))) * vPulse;
          gl_FragColor = vec4(vec3(0.78, 0.82, 0.94), alpha * 0.62);
        }
      `,
    })
    return { geometry: starGeometry, material: starMaterial }
  }, [])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    if (!pointsRef.current) return
    const progress = landingScroll.scenes.globe
    pointsRef.current.rotation.y = progress * 0.026 + (reducedMotion ? 0 : clock.elapsedTime * 0.0007)
    pointsRef.current.rotation.x = progress * -0.012
  })

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-10}
    />
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
  const [albedo, normal, waterMask, roughness, nightLights, clouds, borders] = useTexture([
    "/textures/earth-blue-marble.jpg",
    "/textures/earth-normal.jpg",
    "/textures/earth-water-mask.png",
    "/textures/earth-roughness.png",
    "/textures/earth-night-lights.png",
    "/textures/earth-clouds.png",
    "/textures/earth-borders.png",
  ])
  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      map: albedo,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.34, 0.34),
      roughnessMap: roughness,
      roughness: 1,
      metalness: 0,
      ior: 1.34,
      specularIntensity: 0.92,
      specularIntensityMap: waterMask,
      specularColor: new THREE.Color("#D8ECFF"),
    })
    return material
  }, [albedo, normal, roughness, waterMask])

  useEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.anisotropy = 8
    normal.colorSpace = THREE.NoColorSpace
    waterMask.colorSpace = THREE.NoColorSpace
    roughness.colorSpace = THREE.NoColorSpace
    nightLights.colorSpace = THREE.NoColorSpace
    clouds.colorSpace = THREE.NoColorSpace
    borders.colorSpace = THREE.SRGBColorSpace
    normal.anisotropy = 6
    waterMask.anisotropy = 4
    roughness.anisotropy = 4
    nightLights.anisotropy = 4
    clouds.anisotropy = 4
    borders.anisotropy = 4
    clouds.wrapS = THREE.RepeatWrapping
    markLandingAssetReady("earth")
    onReady?.()
  }, [albedo, borders, clouds, nightLights, normal, onReady, roughness, waterMask])

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
      group.rotation.x = THREE.MathUtils.damp(
        group.rotation.x,
        idleX,
        2.2,
        Math.min(delta, 1 / 30),
      )
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
    const clampedDelta = Math.min(delta, 1 / 30)
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      group.rotation.y + yDifference,
      1.55,
      clampedDelta,
    )
    group.rotation.x = THREE.MathUtils.damp(
      group.rotation.x,
      targetX,
      1.55,
      clampedDelta,
    )
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
        <sphereGeometry args={[EARTH_RADIUS, 128, 96]} />
      </mesh>
      <NightLights texture={nightLights} />
      <CloudLayer texture={clouds} reducedMotion={reducedMotion} />
      <CountryBorders texture={borders} />
      <Atmosphere reducedMotion={reducedMotion} />
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

function EarthLighting({ reducedMotion }: { reducedMotion: boolean }) {
  const keyRef = useRef<THREE.DirectionalLight>(null)
  const sun = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime
    updateSunDirection(time, sun)
    keyRef.current?.position.copy(sun).multiplyScalar(8)
  })

  return (
    <>
      <hemisphereLight args={["#AFC3D6", "#08070E", 0.2]} />
      <directionalLight
        ref={keyRef}
        position={[6.2, 2.2, 4.6]}
        intensity={3.15}
        color="#FFF1D7"
      />
      <directionalLight
        position={[-4, -1.8, 1]}
        intensity={0.08}
        color="#506E9A"
      />
    </>
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
      <StarField reducedMotion={reducedMotion} />
      <EarthLighting reducedMotion={reducedMotion} />
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
