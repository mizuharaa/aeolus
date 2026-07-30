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

/**
 * ONE pigment for every event kind.
 *
 * This was a five-colour rainbow — pink closure, cyan storm, violet cyber,
 * amber ash, paper crew — which said, wrongly, that the five differ in kind of
 * seriousness. They do not: all five are disruptions, and in this design system
 * accents are semantic, never decorative. What distinguishes them is the label
 * next to the mark, so the mark itself is disruption-pink in every case and the
 * globe stops reading as a legend of five hues nobody can decode.
 *
 * `kind` still selects the decal's SHAPE inside the marker shader, which is the
 * distinction that survives being one colour.
 */
const EVENT_PIGMENT = "#E0457B"
const EVENT_COLORS: Record<GlobeEventKind, string> = {
  closure: EVENT_PIGMENT,
  storm: EVENT_PIGMENT,
  cyber: EVENT_PIGMENT,
  ash: EVENT_PIGMENT,
  crew: EVENT_PIGMENT,
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

/**
 * The sun is FIXED. It used to drift at 0.018 rad/s, which crawled the day/night
 * terminator across the sphere for as long as the page was open — a permanent
 * idle animation nobody asked for, on the one element large enough that its
 * shading change is visible in peripheral vision. `time` is kept in the
 * signature so the callers below read unchanged; it is deliberately unused.
 */
function updateSunDirection(_time: number, target = SUN_DIRECTION) {
  return target.set(0.78, 0.28, 0.58).normalize()
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
          // aurora permanently off: a drifting polar colour wash was pure
          // decoration on a product globe and the noisiest thing on the sphere
          uAuroraStrength: { value: 0 },
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
    [],
  )

  // uTime stays 0 for everyone, not just reduced-motion users. It drove two
  // counter-rotating sine bands (0.55 and 0.31 rad/s) and a scrolling aurora
  // noise across the atmosphere limb — a bright rim shimmering permanently
  // around the whole sphere. This is the halo in peripheral vision that reads
  // as the page flickering even when you are looking at the copy.
  useFrame(() => {
    updateSunDirection(0, material.uniforms.uSunDirection.value)
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
    const count = 1200
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
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        varying float vPulse;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vPulse = 0.76;
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

  useFrame(() => {
    if (!pointsRef.current) return
    const progress = reducedMotion ? 0 : landingScroll.scenes.globe
    pointsRef.current.rotation.y = progress * 0.026
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

/**
 * EventMarker — a STATIC mark on the surface. No time input, anywhere.
 *
 * This replaces five components totalling ~390 lines: `EventColumn` (an
 * additively-blended plume cylinder whose body was multiplied by
 * `sin(height * 26 - uTime * 2.1)`), `EventReticle` (corner brackets rocking on
 * `sin(time * 0.52)`), plus `EventParticles` and `CrewRoute`, which were both
 * dead code — defined, animated in review, and never rendered.
 *
 * Two things were wrong with that rig and they had the same cause. Every event
 * kept its full VFX stack alive permanently at 11% strength, not just the
 * selected one, so five plumes and five sets of brackets animated forever: that
 * is the flicker, and those faint pink brackets scattered over the ocean are
 * what it looked like when it was working as written. An earlier pass pinned
 * `uAeEventTime` to 0 in the globe's own decal shader and recorded the flashing
 * as fixed, but never touched these, which is why nothing appeared to change.
 *
 * What remains: the surface decal (a static disc and edge ring drawn by the
 * globe material, already time-free) marks the active event, and this component
 * adds a plain ring at every site so the other four are locatable. Selection
 * still eases — that is a state change with an end, not an idle loop — and
 * under reduced motion it snaps instead.
 */
function EventMarker({
  event,
  index,
}: {
  event: GlobeEvent
  index: number
}) {
  const rootRef = useRef<THREE.Group>(null)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: EVENT_PIGMENT,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const point = useMemo(
    () => latLonToVector3(event.lat, event.lon, EARTH_RADIUS + 0.012),
    [event.lat, event.lon],
  )
  const rotation = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(OUT, point.clone().normalize()),
    [point],
  )

  useFrame((_state, delta) => {
    const group = rootRef.current
    if (!group) return
    const eventsActive =
      landingScroll.reducedMotion || landingScroll.scenes.globe >= 0.24
    const selected = globeEventRuntime.activeIndex === index
    const target = eventsActive ? (selected ? 0.95 : 0.34) : 0
    material.opacity = landingScroll.reducedMotion
      ? target
      : THREE.MathUtils.damp(material.opacity, target, 6, Math.min(delta, 1 / 30))
    group.visible = material.opacity > 0.006
    if (!group.visible) return
    const scaleTarget = selected ? 1 : 0.62
    group.scale.setScalar(
      landingScroll.reducedMotion
        ? scaleTarget
        : THREE.MathUtils.damp(group.scale.x, scaleTarget, 6, Math.min(delta, 1 / 30)),
    )
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <group ref={rootRef} position={point} quaternion={rotation}>
      <mesh material={material} renderOrder={9}>
        <ringGeometry args={[0.052, 0.064, 48]} />
      </mesh>
    </group>
  )
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
  const focusSpringRef = useRef(new Spring(54))
  const eventSpringRef = useRef(new Spring(28))
  const cameraSpringRef = useRef(new Spring(34))
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

          // ONE STATIC MARK. Every animated term here was removed: three
          // expanding rings on a fract() loop, a 1.7 rad/s swirl, a scanline, a
          // hash plume re-rolling twice a second, and rotating dots. Together
          // they produced the flashing the brief calls out, and none of them
          // carried information the label does not already state. What is left
          // is a soft disc and one crisp edge ring — no time input at all, so it
          // cannot flash, and it is identical under prefers-reduced-motion.
          float aeBase = 1.0 - smoothstep(0.012, 0.052, aeDistance);
          float aeEdge = 1.0 - smoothstep(0.002, 0.009, abs(aeDistance - 0.052));
          float aePattern = aeBase * 0.3 + aeEdge * 0.8;

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
    material.customProgramCacheKey = () => "aeolus-earth-event-decal-v2-static"
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
      // held at 0: the decal is static by design (see the shader note above)
      shader.uniforms.uAeEventTime.value = 0
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
      />
      {GLOBE_EVENTS.map((event, index) => (
        <EventMarker key={event.id} event={event} index={index} />
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
