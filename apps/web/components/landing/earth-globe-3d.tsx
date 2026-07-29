"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"
import {
  GLOBE_EVENTS,
  globeEventRuntime,
  type GlobeEvent,
  type GlobeEventKind,
} from "@/components/landing/globe-events"
import {
  getLandingQualityProfile,
  landingScroll,
  markLandingAssetReady,
  registerThreeRoot,
} from "@/lib/scroll"
import { Spring } from "@/lib/spring"
import { CanvasBudget } from "@/components/landing/canvas-budget"

const DEG = Math.PI / 180
const EARTH_RADIUS = 2.18
const OUT = new THREE.Vector3(0, 0, 1)

const EVENT_COLORS: Record<GlobeEventKind, string> = {
  closure: "#E0457B",
  storm: "#4FD8E8",
  cyber: "#A78BFA",
  ash: "#E8A33D",
  crew: "#F5F0E6",
}
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

function eventOrientation(event: GlobeEvent) {
  const normal = latLonToVector3(event.lat, event.lon, 1).normalize()
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal)
  if (east.lengthSq() < 0.0001) east.set(1, 0, 0)
  east.normalize()
  const north = new THREE.Vector3().crossVectors(normal, east).normalize()
  const basis = new THREE.Matrix4().makeBasis(east, north, normal)
  return new THREE.Quaternion().setFromRotationMatrix(basis).invert()
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

function Atmosphere({
  reducedMotion,
  aurora,
}: {
  reducedMotion: boolean
  aurora: boolean
}) {
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
          uAuroraStrength: { value: aurora ? 1 : 0 },
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
          uniform float uAuroraStrength;
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
            float aurora = polar * auroraNoise * limb * 0.22 * uAuroraStrength;

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
    [aurora],
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

const EVENT_KIND_CODE: Record<GlobeEventKind, number> = {
  closure: 0,
  storm: 1,
  cyber: 2,
  ash: 3,
  crew: 4,
}

function EventColumn({
  event,
  amount,
  reducedMotion,
}: {
  event: GlobeEvent
  amount: React.MutableRefObject<number>
  reducedMotion: boolean
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uStrength: { value: 0 },
          uKind: { value: EVENT_KIND_CODE[event.kind] },
          uColor: { value: new THREE.Color(EVENT_COLORS[event.kind]) },
        },
        vertexShader: `
          varying vec3 vLocalPosition;
          varying vec2 vUv;
          void main() {
            vLocalPosition = position;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uStrength;
          uniform float uKind;
          uniform vec3 uColor;
          varying vec3 vLocalPosition;
          varying vec2 vUv;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          float noise21(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
                       mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y);
          }

          void main() {
            float height = clamp(vUv.y, 0.0, 1.0);
            float edge = 1.0 - smoothstep(0.18, 0.5, abs(vUv.x - 0.5));
            float noise = noise21(vec2(vUv.x * 8.0, height * 6.0 - uTime * 0.55));
            float body = edge * pow(1.0 - height, 1.35) * mix(0.52, 1.0, noise);

            if (uKind > 0.5 && uKind < 1.5) {
              body *= 0.62 + sin(height * 26.0 - uTime * 2.1 + noise * 4.0) * 0.2;
            } else if (uKind > 1.5 && uKind < 2.5) {
              float scan = step(0.56, fract(height * 13.0 - uTime * 2.6));
              body *= mix(0.18, 1.0, scan);
            } else if (uKind > 2.5 && uKind < 3.5) {
              body *= smoothstep(0.2, 0.9, noise + height * 0.34);
            } else if (uKind > 3.5) {
              body *= 0.18;
            }

            float alpha = body * uStrength * 0.42;
            if (alpha < 0.006) discard;
            gl_FragColor = vec4(uColor * (0.8 + noise * 0.55), alpha);
          }
        `,
      }),
    [event.kind],
  )

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    material.uniforms.uStrength.value = amount.current
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh position={[0, 0, 0.37]} rotation={[Math.PI / 2, 0, 0]} material={material}>
      <cylinderGeometry args={[0.018, 0.105, 0.72, 24, 1, true]} />
    </mesh>
  )
}

function EventReticle({
  event,
  amount,
  reducedMotion,
}: {
  event: GlobeEvent
  amount: React.MutableRefObject<number>
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: EVENT_COLORS[event.kind],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [event.kind],
  )
  const geometry = useMemo(() => {
    const radius = 0.24
    const edge = 0.075
    const positions = new Float32Array([
      -radius, radius - edge, 0, -radius, radius, 0,
      -radius, radius, 0, -radius + edge, radius, 0,
      radius - edge, radius, 0, radius, radius, 0,
      radius, radius, 0, radius, radius - edge, 0,
      radius, -radius + edge, 0, radius, -radius, 0,
      radius, -radius, 0, radius - edge, -radius, 0,
      -radius + edge, -radius, 0, -radius, -radius, 0,
      -radius, -radius, 0, -radius, -radius + edge, 0,
    ])
    const result = new THREE.BufferGeometry()
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return result
  }, [])

  useFrame(({ clock }) => {
    material.opacity = amount.current * 0.92
    if (!groupRef.current) return
    const time = reducedMotion ? 0 : clock.elapsedTime
    groupRef.current.rotation.z = Math.sin(time * 0.52) * 0.045
    groupRef.current.scale.setScalar(0.88 + amount.current * 0.12)
  })

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return (
    <group ref={groupRef} position={[0, 0, 0.085]}>
      <lineSegments geometry={geometry} material={material} renderOrder={9} />
    </group>
  )
}

function EventParticles({
  event,
  amount,
  reducedMotion,
}: {
  event: GlobeEvent
  amount: React.MutableRefObject<number>
  reducedMotion: boolean
}) {
  const { geometry, material } = useMemo(() => {
    const count = event.kind === "ash" ? 144 : 96
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)
    let seed = 103 + EVENT_KIND_CODE[event.kind] * 97
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * 0.16
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.sin(angle) * radius
      positions[index * 3 + 2] = random() * 0.62
      phases[index] = random()
      sizes[index] = 0.65 + random() * 1.6
    }

    const pointGeometry = new THREE.BufferGeometry()
    pointGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    pointGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1))
    pointGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1))
    const pointMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: 0 },
        uKind: { value: EVENT_KIND_CODE[event.kind] },
        uColor: { value: new THREE.Color(EVENT_COLORS[event.kind]) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uStrength;
        uniform float uKind;
        attribute float aPhase;
        attribute float aSize;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float cycle = fract(aPhase + uTime * (0.065 + uKind * 0.008));
          p.z = cycle * 0.68;
          p.xy *= 0.5 + cycle * 1.35;
          if (uKind > 0.5 && uKind < 1.5) {
            float angle = uTime * 0.8 + cycle * 4.0;
            p.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p.xy;
          } else if (uKind > 1.5 && uKind < 2.5) {
            p.x += step(0.82, fract(uTime * 2.4 + aPhase * 7.0)) * 0.08;
          } else if (uKind > 2.5 && uKind < 3.5) {
            p.x += cycle * cycle * 0.24;
          }
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * (22.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
          vAlpha = (1.0 - cycle) * uStrength;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float dotShape = 1.0 - smoothstep(0.08, 0.5, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(uColor, dotShape * vAlpha * 0.46);
        }
      `,
    })
    return { geometry: pointGeometry, material: pointMaterial }
  }, [event.kind])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    material.uniforms.uStrength.value = amount.current
  })

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

function EventMarker({
  event,
  index,
  reducedMotion,
}: {
  event: GlobeEvent
  index: number
  reducedMotion: boolean
}) {
  const rootRef = useRef<THREE.Group>(null)
  const amountRef = useRef(0)
  const point = useMemo(
    () => latLonToVector3(event.lat, event.lon, EARTH_RADIUS + 0.014),
    [event.lat, event.lon],
  )
  const rotation = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(OUT, point.clone().normalize()),
    [point],
  )

  useFrame(({ clock }, delta) => {
    const group = rootRef.current
    if (!group) return
    const eventsActive = landingScroll.reducedMotion || landingScroll.scenes.globe >= 0.24
    const selected = globeEventRuntime.activeIndex === index
    const target = eventsActive ? (selected ? 1 : 0.11) : 0
    amountRef.current = THREE.MathUtils.damp(
      amountRef.current,
      target,
      selected ? 7.2 : 4.2,
      Math.min(delta, 1 / 30),
    )
    const amount = amountRef.current
    group.visible = amount > 0.006
    if (!group.visible) return
    const time = reducedMotion ? 0 : clock.elapsedTime
    const pulse = selected ? 1 + Math.sin(time * 1.6 + index) * 0.018 : 1
    group.scale.setScalar(pulse)
  })

  return (
    <group ref={rootRef} position={point} quaternion={rotation}>
      <EventColumn event={event} amount={amountRef} reducedMotion={reducedMotion} />
      <EventReticle event={event} amount={amountRef} reducedMotion={reducedMotion} />
      <EventParticles event={event} amount={amountRef} reducedMotion={reducedMotion} />
    </group>
  )
}

function CrewRoute({ reducedMotion }: { reducedMotion: boolean }) {
  const { geometry, material } = useMemo(() => {
    const from = latLonToVector3(51.47, -0.4543, 1).normalize()
    const to = latLonToVector3(41.9742, -87.9073, 1).normalize()
    const angle = Math.acos(THREE.MathUtils.clamp(from.dot(to), -1, 1))
    const sinAngle = Math.sin(angle)
    const count = 72
    const positions = new Float32Array(count * 3)
    const progression = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1)
      const a = Math.sin((1 - t) * angle) / sinAngle
      const b = Math.sin(t * angle) / sinAngle
      const point = from
        .clone()
        .multiplyScalar(a)
        .add(to.clone().multiplyScalar(b))
        .normalize()
        .multiplyScalar(EARTH_RADIUS + 0.035 + Math.sin(Math.PI * t) * 0.12)
      point.toArray(positions, index * 3)
      progression[index] = t
    }
    const routeGeometry = new THREE.BufferGeometry()
    routeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    routeGeometry.setAttribute("aT", new THREE.BufferAttribute(progression, 1))
    const routeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: 0 },
        uColor: { value: new THREE.Color(EVENT_COLORS.crew) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uStrength;
        attribute float aT;
        varying float vAlpha;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float train = 1.0 - smoothstep(0.025, 0.11, abs(fract(aT - uTime * 0.08) - 0.5));
          float dash = step(0.48, fract(aT * 18.0));
          gl_PointSize = mix(1.25, 3.5, train) * (62.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
          vAlpha = max(dash * 0.28, train) * uStrength;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float dotShape = 1.0 - smoothstep(0.08, 0.5, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(uColor, dotShape * vAlpha);
        }
      `,
    })
    return { geometry: routeGeometry, material: routeMaterial }
  }, [])

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    const target =
      (landingScroll.reducedMotion || landingScroll.scenes.globe >= 0.24) &&
      GLOBE_EVENTS[globeEventRuntime.activeIndex]?.kind === "crew"
        ? 1
        : 0
    material.uniforms.uStrength.value = THREE.MathUtils.damp(
      material.uniforms.uStrength.value,
      target,
      6,
      Math.min(delta, 1 / 30),
    )
  })

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

function EarthModel({
  onReady,
  reducedMotion,
}: {
  onReady?: () => void
  reducedMotion: boolean
}) {
  const quality = getLandingQualityProfile()
  const planetRef = useRef<THREE.Group>(null)
  const drag = useRef({
    active: false,
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
    until: 0,
  })
  const lastEventVersionRef = useRef(globeEventRuntime.version)
  const idleYawRef = useRef(0)
  const fromEventQuaternionRef = useRef(eventOrientation(GLOBE_EVENTS[0]))
  const toEventQuaternionRef = useRef(eventOrientation(GLOBE_EVENTS[0]))
  const currentEventQuaternionRef = useRef(eventOrientation(GLOBE_EVENTS[0]))
  const focusSpringRef = useRef(new Spring(92))
  const eventSpringRef = useRef(new Spring(76))
  const cameraSpringRef = useRef(new Spring(54))
  const initializedRef = useRef(false)
  const surfaceShaderRef = useRef<{
    uniforms: Record<string, { value: unknown }>
  } | null>(null)
  const idleQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const dragQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const desiredQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const idleEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), [])
  const dragEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), [])
  const eventNormal = useMemo(() => new THREE.Vector3(), [])

  if (!initializedRef.current) {
    eventSpringRef.current.value = 1
    cameraSpringRef.current.value = 7.8
    initializedRef.current = true
  }

  const compactTextureTier = quality.tier !== "high"
  const textureUrls = compactTextureTier
    ? [
        "/textures/earth-blue-marble-mobile.jpg",
        "/textures/earth-normal-mobile.jpg",
        "/textures/earth-water-mask-mobile.png",
        "/textures/earth-roughness-mobile.png",
        "/textures/earth-night-lights-mobile.png",
        "/textures/earth-borders-mobile.png",
      ]
    : [
        "/textures/earth-blue-marble.jpg",
        "/textures/earth-normal.jpg",
        "/textures/earth-water-mask.png",
        "/textures/earth-roughness.png",
        "/textures/earth-night-lights.png",
        "/textures/earth-clouds.png",
        "/textures/earth-borders.png",
      ]
  const loadedTextures = useTexture(textureUrls) as THREE.Texture[]
  const [albedo, normal, waterMask, roughness, nightLights] = loadedTextures
  const clouds = compactTextureTier ? null : loadedTextures[5]
  const borders = compactTextureTier ? loadedTextures[5] : loadedTextures[6]
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

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uAeEventNormal = { value: new THREE.Vector3(0, 0, 1) }
      shader.uniforms.uAeEventColor = { value: new THREE.Color(EVENT_COLORS.closure) }
      shader.uniforms.uAeEventAmount = { value: 0 }
      shader.uniforms.uAeEventTime = { value: 0 }
      shader.uniforms.uAeEventKind = { value: 0 }

      shader.vertexShader = `
        varying vec3 vAeSurfaceNormal;
      ${shader.vertexShader}`.replace(
        "#include <beginnormal_vertex>",
        `
          #include <beginnormal_vertex>
          vAeSurfaceNormal = normalize(objectNormal);
        `,
      )

      shader.fragmentShader = `
        uniform vec3 uAeEventNormal;
        uniform vec3 uAeEventColor;
        uniform float uAeEventAmount;
        uniform float uAeEventTime;
        uniform float uAeEventKind;
        varying vec3 vAeSurfaceNormal;

        float aeHash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
      ${shader.fragmentShader}`.replace(
        "#include <map_fragment>",
        `
          #include <map_fragment>
          vec3 aeSurface = normalize(vAeSurfaceNormal);
          vec3 aeEvent = normalize(uAeEventNormal);
          float aeDistance = acos(clamp(dot(aeSurface, aeEvent), -1.0, 1.0));
          vec3 aeReference = abs(aeEvent.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 aeTangent = normalize(cross(aeReference, aeEvent));
          vec3 aeBitangent = normalize(cross(aeEvent, aeTangent));
          float aeX = dot(aeSurface, aeTangent);
          float aeY = dot(aeSurface, aeBitangent);
          float aeAngle = atan(aeY, aeX);

          float aeBase = 1.0 - smoothstep(0.012, 0.052, aeDistance);
          float aeEdge = 1.0 - smoothstep(0.002, 0.009, abs(aeDistance - 0.052));
          float aeRings = 0.0;
          for (int aeIndex = 0; aeIndex < 3; aeIndex++) {
            float aePhase = fract(uAeEventTime * 0.18 + float(aeIndex) * 0.333);
            float aeRadius = 0.035 + aePhase * 0.22;
            float aeRing = 1.0 - smoothstep(0.003, 0.012, abs(aeDistance - aeRadius));
            aeRings += aeRing * (1.0 - aePhase);
          }

          float aePattern = aeBase;
          if (uAeEventKind < 0.5) {
            aePattern = aeBase * 0.22 + aeEdge * 0.86 + aeRings * 0.58;
          } else if (uAeEventKind < 1.5) {
            float aeSwirl = sin(aeAngle * 6.0 - uAeEventTime * 1.7 + aeDistance * 92.0) * 0.5 + 0.5;
            aePattern = aeBase * aeSwirl * 0.58 + aeRings * 0.34;
          } else if (uAeEventKind < 2.5) {
            float aeScan = step(0.55, fract((aeX + aeY) * 72.0 - uAeEventTime * 2.6));
            float aeStutter = step(0.18, fract(uAeEventTime * 7.0));
            aePattern = aeBase * mix(0.12, 0.68, aeScan * aeStutter) + aeRings * 0.26;
          } else if (uAeEventKind < 3.5) {
            float aePlume = smoothstep(0.2, 0.85, aeHash(floor(vec2(aeX, aeY) * 210.0) + floor(uAeEventTime * 0.45)));
            aePattern = aeBase * mix(0.1, 0.48, aePlume) + aeRings * 0.22;
          } else {
            float aeDots = step(0.68, fract((aeAngle / 6.2831853 + 0.5) * 16.0 - uAeEventTime * 0.12));
            aePattern = aeBase * 0.08 + aeEdge * aeDots * 0.72 + aeRings * 0.12;
          }

          float aeEventGlow = clamp(aePattern * uAeEventAmount, 0.0, 1.15);
          diffuseColor.rgb = mix(diffuseColor.rgb, uAeEventColor, clamp(aeEventGlow * 0.24, 0.0, 0.42));
        `,
      ).replace(
        "#include <emissivemap_fragment>",
        `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += uAeEventColor * aeEventGlow * 0.38;
        `,
      )

      surfaceShaderRef.current = shader
    }
    material.customProgramCacheKey = () => "aeolus-earth-event-decal-v1"
    return material
  }, [albedo, normal, roughness, waterMask])

  useEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.anisotropy = 8
    normal.colorSpace = THREE.NoColorSpace
    waterMask.colorSpace = THREE.NoColorSpace
    roughness.colorSpace = THREE.NoColorSpace
    nightLights.colorSpace = THREE.NoColorSpace
    if (clouds) clouds.colorSpace = THREE.NoColorSpace
    borders.colorSpace = THREE.SRGBColorSpace
    normal.anisotropy = 6
    waterMask.anisotropy = 4
    roughness.anisotropy = 4
    nightLights.anisotropy = 4
    if (clouds) clouds.anisotropy = 4
    borders.anisotropy = 4
    if (clouds) clouds.wrapS = THREE.RepeatWrapping
    markLandingAssetReady("earth")
    onReady?.()
  }, [albedo, borders, clouds, nightLights, normal, onReady, roughness, waterMask])

  useEffect(
    () => () => {
      globeMaterial.dispose()
    },
    [globeMaterial],
  )

  useFrame(({ camera, clock }, delta) => {
    const group = planetRef.current
    if (!group) return
    const clampedDelta = Math.min(delta, 1 / 30)
    const activeEvent = GLOBE_EVENTS[globeEventRuntime.activeIndex] ?? GLOBE_EVENTS[0]
    const now = performance.now() / 1000
    if (lastEventVersionRef.current !== globeEventRuntime.version) {
      fromEventQuaternionRef.current.copy(currentEventQuaternionRef.current)
      toEventQuaternionRef.current.copy(eventOrientation(activeEvent))
      eventSpringRef.current.value = 0
      eventSpringRef.current.velocity = 0
      lastEventVersionRef.current = globeEventRuntime.version
      drag.current.until = 0
    }

    const eventTransition = eventSpringRef.current.step(1, clampedDelta)
    currentEventQuaternionRef.current.slerpQuaternions(
      fromEventQuaternionRef.current,
      toEventQuaternionRef.current,
      THREE.MathUtils.smootherstep(eventTransition, 0, 1),
    )

    const scrollTarget = reducedMotion
      ? 1
      : THREE.MathUtils.smoothstep(landingScroll.scenes.globe, 0.16, 0.42)
    const focus = focusSpringRef.current.step(scrollTarget, clampedDelta)

    if (!reducedMotion) idleYawRef.current += clampedDelta * 0.075
    idleEuler.set(-0.12, idleYawRef.current, 0)
    idleQuaternion.setFromEuler(idleEuler)
    desiredQuaternion
      .copy(idleQuaternion)
      .slerp(currentEventQuaternionRef.current, focus)

    if (!drag.current.active && now > drag.current.until) {
      drag.current.yaw = THREE.MathUtils.damp(
        drag.current.yaw,
        0,
        2.8,
        clampedDelta,
      )
      drag.current.pitch = THREE.MathUtils.damp(
        drag.current.pitch,
        0,
        2.8,
        clampedDelta,
      )
    }
    dragEuler.set(drag.current.pitch, drag.current.yaw, 0)
    dragQuaternion.setFromEuler(dragEuler)
    desiredQuaternion.premultiply(dragQuaternion)
    group.quaternion.copy(desiredQuaternion)

    const midpointDolly =
      Math.sin(THREE.MathUtils.clamp(eventTransition, 0, 1) * Math.PI) *
      0.54 *
      focus
    const targetCameraZ = 7.8 - focus * 0.44 + midpointDolly
    camera.position.z = cameraSpringRef.current.step(targetCameraZ, clampedDelta)
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      0.12 - focus * 0.035,
      5,
      clampedDelta,
    )
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(
        camera.fov,
        32 - focus * 2.2,
        4.2,
        clampedDelta,
      )
      camera.updateProjectionMatrix()
    }

    const shader = surfaceShaderRef.current
    if (shader) {
      eventNormal.copy(latLonToVector3(activeEvent.lat, activeEvent.lon, 1)).normalize()
      ;(shader.uniforms.uAeEventNormal.value as THREE.Vector3).copy(eventNormal)
      ;(shader.uniforms.uAeEventColor.value as THREE.Color).set(
        EVENT_COLORS[activeEvent.kind],
      )
      shader.uniforms.uAeEventAmount.value = focus
      shader.uniforms.uAeEventTime.value = reducedMotion ? 0 : clock.elapsedTime
      shader.uniforms.uAeEventKind.value = EVENT_KIND_CODE[activeEvent.kind]
    }
  })

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    drag.current.active = true
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    ;(event.nativeEvent.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!planetRef.current || !drag.current.active) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    drag.current.yaw += dx * 0.0052
    drag.current.pitch = THREE.MathUtils.clamp(
      drag.current.pitch + dy * 0.0042,
      -0.7,
      0.7,
    )
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
      {quality.clouds && clouds ? (
        <CloudLayer texture={clouds} reducedMotion={reducedMotion} />
      ) : null}
      <CountryBorders texture={borders} />
      <Atmosphere
        reducedMotion={reducedMotion}
        aurora={quality.aurora}
      />
      {GLOBE_EVENTS.map((event, index) => (
        <EventMarker
          key={event.id}
          event={event}
          index={index}
          reducedMotion={reducedMotion}
        />
      ))}
      <CrewRoute reducedMotion={reducedMotion} />
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
  onReady,
  reducedMotion,
}: {
  onReady?: () => void
  reducedMotion: boolean
}) {
  return (
    <>
      <StarField reducedMotion={reducedMotion} />
      <EarthLighting reducedMotion={reducedMotion} />
      <EarthModel
        onReady={onReady}
        reducedMotion={reducedMotion}
      />
    </>
  )
}

export function EarthGlobe3D({
  onReady,
}: {
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
        dpr={[1, 1.5]}
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
        <CanvasBudget />
        <Suspense fallback={null}>
          <EarthScene
            onReady={onReady}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
