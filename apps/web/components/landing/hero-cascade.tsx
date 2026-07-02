"use client"
/**
 * HeroCascade — the landing hero's rendered asset.
 *
 * A real-time Three.js render (not a screenshot mockup): the Nimbus Air
 * network as a physical object on an ink slab — 15 airports at their true
 * projected coordinates, route arcs as glass-teal tubes, one disruption
 * epicenter (ORD) glowing amber with its first-generation cascade edges.
 *
 * Studio treatment: single key light from the upper left with soft mapped
 * shadows, hemisphere fill, RoomEnvironment reflections, ACES tone mapping,
 * and a contact shadow under the slab. The object sways ±3° — it does not
 * spin, pulse, or glow. Under prefers-reduced-motion it renders one static
 * frame. Rendering pauses when the tab is hidden or the hero is offscreen.
 *
 * Colors are the system pigments only:
 *   slab #141917 (ink) · nodes #F5F5F0 (paper) · routes #0D9488 (teal)
 *   cascade edges + epicenter #B8863C (amber — the one status color)
 */

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"

// ── Network data (mirrors components/simulator/airports.ts) ─────────────
const AIRPORTS: Record<string, { lat: number; lon: number; hub?: boolean }> = {
  ORD: { lat: 41.9742, lon: -87.9073, hub: true },
  ATL: { lat: 33.6407, lon: -84.4277, hub: true },
  DFW: { lat: 32.8998, lon: -97.0403, hub: true },
  DEN: { lat: 39.8561, lon: -104.6737, hub: true },
  LAX: { lat: 33.9425, lon: -118.408 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  SEA: { lat: 47.4502, lon: -122.3088 },
  MIA: { lat: 25.7959, lon: -80.287 },
  PHX: { lat: 33.4373, lon: -112.0078 },
  LAS: { lat: 36.084, lon: -115.1537 },
  BOS: { lat: 42.3656, lon: -71.0096 },
  SFO: { lat: 37.6213, lon: -122.379 },
  IAH: { lat: 29.9902, lon: -95.3368 },
  DTW: { lat: 42.2162, lon: -83.3554 },
  MSP: { lat: 44.882, lon: -93.2218 },
}

// Curated hub-and-spoke route set. ORD is the disruption epicenter; every
// edge that touches it renders in amber (first cascade generation).
const ROUTES: [string, string][] = [
  ["ORD", "JFK"], ["ORD", "BOS"], ["ORD", "DTW"], ["ORD", "MSP"],
  ["ORD", "DEN"], ["ORD", "DFW"], ["ORD", "ATL"], ["ORD", "SEA"],
  ["ATL", "MIA"], ["ATL", "JFK"], ["ATL", "IAH"], ["ATL", "DFW"],
  ["DFW", "PHX"], ["DFW", "LAX"], ["DFW", "IAH"],
  ["DEN", "SEA"], ["DEN", "SFO"], ["DEN", "LAS"], ["DEN", "PHX"],
]

const EPICENTER = "ORD"

// Pigments (literal — this is a GPU context, CSS vars don't reach it)
const P = {
  ink: 0x141917,
  inkDeep: 0x0f1412,
  paper: 0xf5f5f0,
  teal: 0x0d9488,
  amber: 0xb8863c,
} as const

// Project lat/lon onto slab-local x/z
const LON = { min: -122.379, max: -71.0096 }
const LAT = { min: 25.7959, max: 47.4502 }
const HALF_W = 2.95
const HALF_D = 1.85
function project(lat: number, lon: number): [number, number] {
  const x = ((lon - LON.min) / (LON.max - LON.min)) * 2 * HALF_W - HALF_W
  const z = HALF_D - ((lat - LAT.min) / (LAT.max - LAT.min)) * 2 * HALF_D
  return [x, z]
}

export function HeroCascade({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" })
    } catch {
      setFailed(true)
      return
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.06
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = "block"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"

    const scene = new THREE.Scene()

    // Environment reflections — cheap PBR realism
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)
    camera.position.set(5.2, 4.7, 8.2)
    camera.lookAt(0, 0.15, 0)

    // ── Lighting: one key, one fill ──
    const key = new THREE.DirectionalLight(0xfff6e8, 2.6)
    key.position.set(-5, 8, 4)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -6
    key.shadow.camera.near = 1
    key.shadow.camera.far = 24
    key.shadow.bias = -0.0004
    key.shadow.radius = 5
    scene.add(key)

    const fill = new THREE.HemisphereLight(0xf5f5f0, 0x262e29, 0.7)
    scene.add(fill)

    // ── Object group ──
    const group = new THREE.Group()
    scene.add(group)

    const disposables: { dispose: () => void }[] = [envTex, pmrem]
    const track = <T extends { dispose: () => void }>(d: T): T => {
      disposables.push(d)
      return d
    }

    // Slab
    const slabGeo = track(new RoundedBoxGeometry(7.3, 0.42, 4.7, 4, 0.14))
    const slabMat = track(
      new THREE.MeshStandardMaterial({ color: P.ink, roughness: 0.52, metalness: 0.18, envMapIntensity: 0.55 }),
    )
    const slab = new THREE.Mesh(slabGeo, slabMat)
    slab.position.y = -0.21
    slab.castShadow = true
    slab.receiveShadow = true
    group.add(slab)

    // Contact shadow catcher
    const shadowMat = track(new THREE.ShadowMaterial({ opacity: 0.16 }))
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(26, 26)), shadowMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.46
    ground.receiveShadow = true
    scene.add(ground)

    // Shared materials
    const porcelain = track(
      new THREE.MeshStandardMaterial({ color: P.paper, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.6 }),
    )
    const epicenterMat = track(
      new THREE.MeshStandardMaterial({
        color: P.amber,
        roughness: 0.35,
        metalness: 0.05,
        emissive: P.amber,
        emissiveIntensity: 0.4,
        envMapIntensity: 0.5,
      }),
    )
    const tealMat = track(
      new THREE.MeshStandardMaterial({ color: P.teal, roughness: 0.38, metalness: 0.12, envMapIntensity: 0.6 }),
    )
    const amberMat = track(
      new THREE.MeshStandardMaterial({
        color: P.amber,
        roughness: 0.4,
        metalness: 0.1,
        emissive: P.amber,
        emissiveIntensity: 0.14,
        envMapIntensity: 0.55,
      }),
    )
    const padMat = track(
      new THREE.MeshStandardMaterial({ color: 0x232b27, roughness: 0.7, metalness: 0.1, envMapIntensity: 0.35 }),
    )

    // Nodes
    const nodeGeoSm = track(new THREE.SphereGeometry(0.085, 28, 20))
    const nodeGeoHub = track(new THREE.SphereGeometry(0.125, 32, 24))
    const padGeo = track(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 24))

    const nodePos: Record<string, THREE.Vector3> = {}
    for (const [code, ap] of Object.entries(AIRPORTS)) {
      const [x, z] = project(ap.lat, ap.lon)
      const r = ap.hub ? 0.125 : 0.085
      const y = r + 0.02
      nodePos[code] = new THREE.Vector3(x, y, z)

      const pad = new THREE.Mesh(padGeo, padMat)
      pad.position.set(x, 0.015, z)
      pad.receiveShadow = true
      group.add(pad)

      const mesh = new THREE.Mesh(
        ap.hub ? nodeGeoHub : nodeGeoSm,
        code === EPICENTER ? epicenterMat : porcelain,
      )
      mesh.position.copy(nodePos[code])
      mesh.castShadow = true
      group.add(mesh)
    }

    // Route arcs
    for (const [a, b] of ROUTES) {
      const pa = nodePos[a]
      const pb = nodePos[b]
      if (!pa || !pb) continue
      const dist = pa.distanceTo(pb)
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      mid.y += 0.22 + dist * 0.16
      const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb)
      const isCascade = a === EPICENTER || b === EPICENTER
      const tube = new THREE.Mesh(
        track(new THREE.TubeGeometry(curve, 28, isCascade ? 0.02 : 0.013, 8)),
        isCascade ? amberMat : tealMat,
      )
      tube.castShadow = true
      group.add(tube)
    }

    // Epicenter ring — a flat torus around ORD on the slab (static)
    const ringGeo = track(new THREE.TorusGeometry(0.34, 0.012, 10, 48))
    const ring = new THREE.Mesh(ringGeo, epicenterMat)
    ring.rotation.x = -Math.PI / 2
    const ord = nodePos[EPICENTER]
    ring.position.set(ord.x, 0.035, ord.z)
    group.add(ring)

    // Slight presentation tilt
    group.rotation.y = -0.16

    // ── Sizing ──
    const setSize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    const ro = new ResizeObserver(setSize)
    ro.observe(host)
    setSize()

    // ── Animation: gentle sway only ──
    let raf = 0
    let visible = true
    let pageVisible = !document.hidden
    const t0 = performance.now()

    const frame = () => {
      raf = 0
      const t = (performance.now() - t0) / 1000
      group.rotation.y = -0.16 + Math.sin(t * 0.22) * 0.055
      group.position.y = Math.sin(t * 0.3) * 0.012
      renderer.render(scene, camera)
      schedule()
    }
    const schedule = () => {
      if (!reduceMotion && visible && pageVisible && raf === 0) raf = requestAnimationFrame(frame)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        schedule()
      },
      { threshold: 0.05 },
    )
    io.observe(host)

    const onVis = () => {
      pageVisible = !document.hidden
      schedule()
    }
    document.addEventListener("visibilitychange", onVis)

    schedule()
    if (reduceMotion) renderer.render(scene, camera)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      for (const d of disposables) d.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    }
  }, [])

  if (failed) {
    // WebGL unavailable — hold the composition with a flat ink slab.
    return (
      <div
        className={className}
        style={{
          ...style,
          background: "#141917",
          borderRadius: 16,
        }}
      />
    )
  }

  return <div ref={hostRef} className={className} style={{ position: "relative", ...style }} aria-hidden />
}
