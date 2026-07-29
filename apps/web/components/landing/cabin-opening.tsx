"use client"
/**
 * CabinOpening — the landing element. A NIGHT business-class cabin in 3D
 * (R3F): a row of three portholes with soft rounded frames and shade slots
 * (reference: clean white plastic, big soft bevels), detailed seats, overhead
 * bins, ceiling and floor — and open sky with sun + drifting clouds outside
 * (a DOM layer under the transparent canvas).
 *
 * Scroll choreography (all scrubbed + damped, reversible):
 *   1. camera pulls back from the window row, panning gently,
 *   2. crosses the aisle and PHASES OUT through the opposite wall's window
 *      (both walls carry the same porthole row),
 *   3. the cabin falls away — open sky with sun and clouds holds a beat,
 *   4. the sky lifts to reveal the full airliner (hero-plane-3d), which then
 *      accelerates upward and away.
 */

import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import {
  landingScroll,
  markLandingAssetReady,
  registerLandingFrame,
  registerThreeRoot,
} from "@/lib/scroll"
import { damp, Spring } from "@/lib/spring"

// ── palette: night business class (reference: dark sculpted ceiling, cool
//    LED spine, warm amber pools on cognac leather + cream shells) ────────
const WALL = "#39322F"       // deep taupe walls
const FRAME_OUT = "#453C36"  // window surrounds
const FRAME_IN = "#2A241F"
const SLOT = "#3E3630"
const PILL = "#5C5248"
const FABRIC = "#8F5B36"     // cognac leather
const FABRIC_LIT = "#B0754A"
const SHELL = "#E9DEC8"      // cream lacquered pod shell (catches the lamps)
const ARMREST = "#4E3A2A"    // walnut
const METAL = "#C9A050"      // brass
const CARPET = "#221B16"     // near-black warm carpet

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function mat(color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.62,
    metalness: 0.08,
    clearcoat: 0.28,
    clearcoatRoughness: 0.36,
    emissive: color,
    emissiveIntensity: 0.035,
    ...opts,
  })
}

function softBox(width: number, height: number, depth: number, radius = 0.045) {
  return new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 4, height / 4, depth / 4))
}

function CabinEnvironment() {
  const { gl, scene } = useThree()

  useEffect(() => {
    const previous = scene.environment
    const previousIntensity = scene.environmentIntensity
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.03)
    scene.environment = target.texture
    scene.environmentIntensity = 0.48
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
 * A vintage business-class pod, facing +x: cognac leather cushions with
 * channel seams, a cream lacquered privacy shell wrapping the back, walnut
 * console armrests with brass trim, a leather ottoman, and a brass plinth.
 * `withLamp` adds a small warm table lamp on the aisle console — those lamp
 * materials are returned on g.userData.lampMats for the idle glow animation.
 */
function seat(withLamp = false) {
  const g = new THREE.Group()
  const leather = mat(FABRIC, { roughness: 0.7 })
  const leatherLit = mat(FABRIC_LIT, { roughness: 0.7 })
  const shell = mat(SHELL, { roughness: 0.45 })
  const walnut = mat(ARMREST, { roughness: 0.55, emissiveIntensity: 0.12 })
  const brass = mat(METAL, { roughness: 0.3, metalness: 0.75, emissiveIntensity: 0.15 })
  const cream = mat("#F4EDDE", { roughness: 0.9 })

  // wide seat cushion with channel seams
  const base = new THREE.Mesh(softBox(0.62, 0.18, 0.62, 0.07), leather)
  base.position.set(0.02, 0, 0)
  const baseFront = new THREE.Mesh(softBox(0.12, 0.18, 0.62, 0.045), leatherLit)
  baseFront.position.set(0.3, -0.01, 0)
  g.add(base, baseFront)
  for (const z of [-0.18, 0, 0.18]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.19, 0.018), leatherLit)
    seam.position.set(0.02, 0, z)
    g.add(seam)
  }

  // reclined leather backrest with vertical channels
  const back = new THREE.Mesh(softBox(0.2, 0.92, 0.58, 0.075), leather)
  back.position.set(-0.28, 0.46, 0)
  back.rotation.z = -0.18
  g.add(back)
  for (const z of [-0.18, 0, 0.18]) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.9, 0.016), leatherLit)
    ch.position.set(-0.28, 0.46, z)
    ch.rotation.z = -0.18
    g.add(ch)
  }
  // plush cream headrest pillow
  const pillow = new THREE.Mesh(softBox(0.16, 0.22, 0.42, 0.07), cream)
  pillow.position.set(-0.36, 0.98, 0)
  pillow.rotation.z = -0.18
  g.add(pillow)

  // cream privacy shell wrapping the back + sides (the pod)
  const shellBack = new THREE.Mesh(softBox(0.08, 1.15, 0.78, 0.035), shell)
  shellBack.position.set(-0.5, 0.5, 0)
  shellBack.rotation.z = -0.12
  g.add(shellBack)
  for (const side of [1, -1] as const) {
    const wing = new THREE.Mesh(softBox(0.55, 0.95, 0.05, 0.02), shell)
    wing.position.set(-0.22, 0.42, side * 0.4)
    wing.rotation.z = -0.06
    g.add(wing)
    // brass trim rail on the shell edge
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.055), brass)
    rail.position.set(-0.22, 0.9, side * 0.4)
    rail.rotation.z = -0.06
    g.add(rail)
  }

  // walnut console armrests with brass inlay
  for (const side of [1, -1] as const) {
    const console_ = new THREE.Mesh(softBox(0.72, 0.3, 0.16, 0.055), walnut)
    console_.position.set(0.02, 0.22, side * 0.39)
    g.add(console_)
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.03, 0.18), mat("#5E4633", { roughness: 0.4 }))
    top.position.set(0.02, 0.38, side * 0.39)
    g.add(top)
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.015, 0.02), brass)
    inlay.position.set(0.02, 0.385, side * (0.39 + 0.07)) // outer edge line
    g.add(inlay)
  }

  // leather ottoman ahead of the seat
  const ottoman = new THREE.Mesh(softBox(0.34, 0.16, 0.5, 0.06), leather)
  ottoman.position.set(0.62, -0.04, 0)
  g.add(ottoman)
  const ottomanSeam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.51), leatherLit)
  ottomanSeam.position.set(0.62, 0.02, 0)
  g.add(ottomanSeam)

  // brass plinth base instead of legs
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.55), mat("#3E2E20", { roughness: 0.6 }))
  plinth.position.set(0, -0.28, 0)
  const kick = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.57), brass)
  kick.position.set(0, -0.42, 0)
  g.add(plinth, kick)

  // warm table lamp on the aisle console — vintage hotel-bar touch
  if (withLamp) {
    const lampGlow = new THREE.MeshStandardMaterial({
      color: "#FFE7B8", emissive: "#FFCE7A", emissiveIntensity: 1.6, roughness: 0.6,
    })
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.14, 8), brass)
    stem.position.set(-0.2, 0.46, -0.39)
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.09, 12), lampGlow)
    shade.position.set(-0.2, 0.56, -0.39)
    g.add(stem, shade)
    g.userData.lampMats = [lampGlow]
  }

  return g
}

/** A porthole unit: soft outer frame, inner bevel, shade slot + pill handle. */
function porthole() {
  const g = new THREE.Group()
  // outer soft ring
  const outer = roundedRect(1.62, 2.08, 0.68)
  outer.holes.push(roundedRect(1.16, 1.62, 0.5))
  const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.09, bevelEnabled: false }), mat(FRAME_OUT))
  g.add(ring)
  // inner bevel ring
  const inner = roundedRect(1.2, 1.66, 0.52)
  inner.holes.push(roundedRect(1.06, 1.52, 0.46))
  const bevel = new THREE.Mesh(new THREE.ExtrudeGeometry(inner, { depth: 0.05, bevelEnabled: false }), mat(FRAME_IN))
  bevel.position.z = 0.03
  g.add(bevel)
  // shade slot near the top of the frame + its pill handle
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.02), mat(SLOT))
  slot.position.set(0, 0.86, 0.1)
  const pill = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(0.5, 0.07, 0.035), { depth: 0.02, bevelEnabled: false }), mat(PILL))
  pill.position.set(0, 0.86, 0.11)
  g.add(slot, pill)
  return g
}

/** A rounded carry-on suitcase for the open overhead bin. */
function suitcase(color: string) {
  const g = new THREE.Group()
  const shell = mat(color, { roughness: 0.55 })
  const trim = mat(ARMREST, { roughness: 0.7, emissiveIntensity: 0.1 })
  const body = new THREE.Mesh(softBox(0.55, 0.4, 0.3, 0.065), shell)
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), trim)
  handle.position.set(0, 0.24, 0)
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.31), trim)
  g.add(body, handle, band)
  return g
}

const WINDOW_XS = [-2.05, 0, 2.05]
const WALL_B_Z = 4.7

/** One cabin side: wall with three porthole holes + framed windows. */
function cabinWall(inward: 1 | -1) {
  const g = new THREE.Group()
  const wallShape = roundedRect(30, 20, 0.01)
  for (const x of WINDOW_XS) {
    const hole = roundedRect(1.16, 1.62, 0.5)
    const path = new THREE.Path()
    hole.getPoints(48).forEach((p, i) => (i === 0 ? path.moveTo(p.x + x, p.y) : path.lineTo(p.x + x, p.y)))
    path.closePath()
    wallShape.holes.push(path)
  }
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(wallShape, 24), mat(WALL, { side: THREE.DoubleSide }))
  g.add(wall)
  for (const x of WINDOW_XS) {
    const p = porthole()
    p.position.set(x, 0, 0)
    p.scale.z = inward
    g.add(p)
  }
  // subtle panel seams between windows
  for (const x of [-3.1, -1.02, 1.02, 3.1]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 20, 0.015), mat(FRAME_IN, { emissiveIntensity: 0.15 }))
    seam.position.set(x, 0, 0.01 * inward)
    g.add(seam)
  }
  // PSU panels above each window: air vents + warm reading lights
  for (const x of WINDOW_XS) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.06), mat(SLOT))
    panel.position.set(x, 1.45, 0.05 * inward)
    g.add(panel)
    for (const dx of [-0.3, 0, 0.3]) {
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12),
        new THREE.MeshStandardMaterial({ color: "#FFEFC9", emissive: "#FFE1A0", emissiveIntensity: 1.4 }),
      )
      lamp.rotation.x = Math.PI / 2
      lamp.position.set(x + dx, 1.45, 0.09 * inward)
      g.add(lamp)
    }
  }
  return g
}

function buildCabin() {
  const root = new THREE.Group()

  // the wall we look at, and the wall we phase out through
  root.add(cabinWall(1))
  const wallB = cabinWall(-1)
  wallB.position.z = WALL_B_Z
  wallB.rotation.y = Math.PI
  root.add(wallB)

  // ceiling: dark sculpted slab with a cool blue-white LED spine down the
  // aisle (the reference shot's signature) + soft amber wash strips
  const ceil = new THREE.Mesh(softBox(30, 0.15, WALL_B_Z + 1, 0.06), mat("#2B2733", { roughness: 0.52 }))
  ceil.position.set(0, 2.6, WALL_B_Z / 2)
  root.add(ceil)
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.05, 0.5),
    new THREE.MeshStandardMaterial({ color: "#DDEBFF", emissive: "#BFD9FF", emissiveIntensity: 2.2 }),
  )
  spine.position.set(0, 2.52, WALL_B_Z / 2)
  root.add(spine)
  for (const z of [0.9, WALL_B_Z - 0.9]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.04, 0.08),
      new THREE.MeshStandardMaterial({ color: "#FFE9BC", emissive: "#FFD98F", emissiveIntensity: 1.4 }),
    )
    strip.position.set(0, 2.15, z)
    root.add(strip)
  }

  // overhead bins along both walls: molded shell, per-seat door seams,
  // pill latches — one door held open with carry-on luggage inside
  for (const [z, flip] of [
    [0.75, 1],
    [WALL_B_Z - 0.75, -1],
  ] as const) {
    const bin = new THREE.Mesh(softBox(26, 0.95, 1.15, 0.16), mat("#332E3B", { roughness: 0.5, clearcoat: 0.38 }))
    bin.position.set(0, 2.0, z)
    bin.rotation.x = 0.3 * flip
    root.add(bin)
    // door seams so the bin reads as a row of stowage doors, not one slab
    for (const x of [-3.1, -1.02, 1.02, 3.1]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.8, 0.06), mat(FRAME_IN, { emissiveIntensity: 0.15 }))
      seam.position.set(x, 1.98, z + 0.56 * flip)
      seam.rotation.x = 0.3 * flip
      root.add(seam)
    }
    for (const x of WINDOW_XS) {
      const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(0.5, 0.08, 0.04), { depth: 0.03, bevelEnabled: false }), mat(SLOT))
      handle.position.set(x, 1.62, z + 0.55 * flip)
      root.add(handle)
    }
  }

  // one OPEN bin on the near wall: dark cavity, raised door, luggage inside
  {
    const z = 0.75
    const cavity = new THREE.Mesh(softBox(2.0, 0.6, 0.7, 0.08), mat("#59544A", { emissiveIntensity: 0.05, roughness: 0.86 }))
    cavity.position.set(2.05, 2.05, z + 0.28)
    cavity.rotation.x = 0.3
    root.add(cavity)
    const door = new THREE.Mesh(softBox(2.0, 0.55, 0.06, 0.025), mat("#3B3544", { roughness: 0.5, clearcoat: 0.42 }))
    door.position.set(2.05, 2.62, z + 0.72)
    door.rotation.x = -1.15 // swung up + out
    root.add(door)
    const bagA = suitcase("#8A4B2F")
    bagA.position.set(1.72, 1.98, z + 0.34)
    bagA.rotation.set(0.3, 0.12, 0)
    const bagB = suitcase("#33415C")
    bagB.position.set(2.38, 2.0, z + 0.3)
    bagB.rotation.set(0.3, -0.08, 0)
    root.add(bagA, bagB)
  }

  // walnut dado rail along both walls — the vintage waistline
  for (const [z, flip] of [[0.02, 1], [WALL_B_Z - 0.02, -1]] as const) {
    const dado = new THREE.Mesh(new THREE.BoxGeometry(26, 0.09, 0.05), mat(ARMREST, { roughness: 0.5, emissiveIntensity: 0.12 }))
    dado.position.set(0, -0.35, z + 0.03 * flip)
    root.add(dado)
    const brassLine = new THREE.Mesh(new THREE.BoxGeometry(26, 0.02, 0.055), mat(METAL, { roughness: 0.3, metalness: 0.75, emissiveIntensity: 0.2 }))
    brassLine.position.set(0, -0.28, z + 0.03 * flip)
    root.add(brassLine)
  }

  // floor: deep warm carpet with a camel runner down the aisle
  const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, WALL_B_Z + 1), mat(CARPET, { roughness: 1 }))
  floor.position.set(0, -1.95, WALL_B_Z / 2)
  root.add(floor)
  const aisle = new THREE.Mesh(new THREE.BoxGeometry(30, 0.11, 1.1), mat("#6B4A32", { roughness: 1 }))
  aisle.position.set(0, -1.95, WALL_B_Z / 2)
  root.add(aisle)
  // brass runner trim lines
  for (const dz of [-0.56, 0.56]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(30, 0.115, 0.04), mat(METAL, { roughness: 0.35, metalness: 0.7, emissiveIntensity: 0.18 }))
    trim.position.set(0, -1.95, WALL_B_Z / 2 + dz)
    root.add(trim)
  }

  // three banks of business pods, 2-2 across — side profile to the camera
  // (facing the nose, +x). Window pods carry warm brass table lamps.
  const lampMats: THREE.MeshStandardMaterial[] = []
  let seatIdx = 0
  for (const z of [0.95, WALL_B_Z / 2, WALL_B_Z - 0.95]) {
    for (const x of [-2.6, -1.4, 1.4, 2.6]) {
      const windowSide = Math.abs(x) > 2
      const s = seat(windowSide)
      s.rotation.y = 0
      s.position.set(x, -1.25, z)
      if (s.userData.lampMats) lampMats.push(...(s.userData.lampMats as THREE.MeshStandardMaterial[]))
      // folded camel blanket on every third ottoman
      if (seatIdx % 3 === 0) {
        const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.4), mat("#C08A4E", { roughness: 0.95 }))
        blanket.position.set(0.62, 0.08, 0)
        s.add(blanket)
      }
      root.add(s)
      seatIdx++
    }
  }
  root.userData.lampMats = lampMats

  // window shades at varied heights on the near wall — a lived-in touch
  for (const [i, x] of WINDOW_XS.entries()) {
    if (i === 1) continue // center window stays fully open
    const drop = i === 0 ? 0.55 : 0.3
    const shade = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(1.04, drop, 0.12), { depth: 0.02, bevelEnabled: false }), mat(PILL))
    shade.position.set(x, 0.74 - drop / 2, 0.05)
    root.add(shade)
  }

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
  })

  return root
}

// Arc-length sampling keeps speed even through unequally spaced control
// points. The gaze follows its own softer spring so the body leads the look.
const CAM_START = new THREE.Vector3(6.25, -0.05, WALL_B_Z / 2)
const CAM_PATH = new THREE.CatmullRomCurve3(
  [
    CAM_START,
    new THREE.Vector3(4.45, 0.02, WALL_B_Z / 2),
    new THREE.Vector3(2.2, 0.08, WALL_B_Z / 2),
    new THREE.Vector3(0.5, 0.12, WALL_B_Z / 2 + 0.25),
    new THREE.Vector3(-0.08, 0.16, WALL_B_Z + 0.55),
    new THREE.Vector3(0.25, 0.22, 7.4),
  ],
  false,
  "catmullrom",
  0.5,
)
const LOOK_PATH = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-0.8, -0.34, WALL_B_Z / 2),
    new THREE.Vector3(-1.15, -0.32, WALL_B_Z / 2),
    new THREE.Vector3(-1.8, -0.3, WALL_B_Z / 2),
    new THREE.Vector3(-1.2, -0.22, WALL_B_Z / 2 + 0.35),
    new THREE.Vector3(0.05, -0.08, 1.4),
    new THREE.Vector3(0.25, -0.05, 1.2),
  ],
  false,
  "catmullrom",
  0.5,
)

function CabinScene() {
  const cabin = useMemo(buildCabin, [])
  const pathSpring = useRef(new Spring(92, 2 * Math.sqrt(92)))
  const lookSpring = useRef(new Spring(62, 2 * Math.sqrt(62)))
  const rollRef = useRef(0)
  const cameraPoint = useMemo(() => new THREE.Vector3(), [])
  const lookPoint = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const previousTangent = useMemo(() => new THREE.Vector3(), [])
  const lateral = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    markLandingAssetReady("cabin")
  }, [])

  useFrame((state, delta) => {
    const cam = state.camera
    const reducedMotion = landingScroll.reducedMotion
    const target = THREE.MathUtils.smoothstep(
      landingScroll.scenes.flight,
      0.02,
      0.43,
    )
    const pathT = reducedMotion
      ? pathSpring.current.snap(target)
      : pathSpring.current.step(target, delta)
    const lookT = reducedMotion
      ? lookSpring.current.snap(target)
      : lookSpring.current.step(target, delta)

    const clock = state.clock.elapsedTime
    const noiseFade = 1 - THREE.MathUtils.smoothstep(pathT, 0.68, 0.94)
    const swayX = reducedMotion
      ? 0
      : (Math.sin(clock * 0.35) * 0.004 +
          Math.sin(clock * 0.08 + 1.2) * 0.012) *
        noiseFade
    const swayY = reducedMotion
      ? 0
      : (Math.sin(clock * 0.42 + 0.8) * 0.003 +
          Math.sin(clock * 0.09) * 0.01) *
        noiseFade
    CAM_PATH.getPointAt(pathT, cameraPoint)
    LOOK_PATH.getPointAt(lookT, lookPoint)
    cam.position.copy(cameraPoint)
    cam.position.x += swayX
    cam.position.y += swayY
    cam.lookAt(lookPoint)

    CAM_PATH.getTangentAt(pathT, tangent)
    CAM_PATH.getTangentAt(Math.max(0, pathT - 0.012), previousTangent)
    lateral.copy(tangent).sub(previousTangent)
    right.crossVectors(tangent, cam.up).normalize()
    const targetRoll = THREE.MathUtils.clamp(
      -lateral.dot(right) * 5.4,
      -0.11,
      0.11,
    )
    rollRef.current = reducedMotion
      ? 0
      : damp(rollRef.current, targetRoll, 4, delta)
    cam.rotateZ(rollRef.current)

    if (cam instanceof THREE.PerspectiveCamera) {
      const targetFov = THREE.MathUtils.lerp(38, 30, pathT)
      cam.fov = reducedMotion ? targetFov : damp(cam.fov, targetFov, 5, delta)
      cam.updateProjectionMatrix()
    }

    // idle life: the brass table lamps breathe — a slow, warm candle-like
    // glow cycle, each lamp on its own phase
    const lampMats = cabin.userData.lampMats as THREE.MeshStandardMaterial[] | undefined
    if (lampMats && !reducedMotion) {
      lampMats.forEach((m, i) => {
        m.emissiveIntensity = 1.5 + Math.sin(clock * 1.3 + i * 1.7) * 0.35
      })
    }
  })

  return (
    <>
      <CabinEnvironment />
      <hemisphereLight args={["#ffe7c3", "#170f1d", 0.44]} />
      <directionalLight
        castShadow
        color="#d9e9ff"
        intensity={1.15}
        position={[1.5, 4.2, -3.5]}
      />
      <rectAreaLight
        color="#c8deff"
        height={0.45}
        intensity={3.2}
        position={[0, 2.38, 2.35]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={10}
      />
      <rectAreaLight
        color="#ffd394"
        height={1.5}
        intensity={3.8}
        position={[0, 0.15, 1.4]}
        rotation={[0, Math.PI, 0]}
        width={9}
      />
      <pointLight color="#ffbd70" distance={7} intensity={8} position={[0, -0.2, 2.2]} />
      <pointLight color="#ffcf89" distance={5} intensity={6} position={[2.5, 0.1, 1.0]} />
      <pointLight color="#ffcf89" distance={5} intensity={6} position={[-2.5, 0.1, 3.7]} />
      <primitive object={cabin} />
    </>
  )
}

export function CabinOpening() {
  const layerRef = useRef<HTMLDivElement>(null)
  const skyRef = useRef<HTMLDivElement>(null)
  const cabinRef = useRef<HTMLDivElement>(null)
  const sloganRef = useRef<HTMLDivElement>(null)
  const unregisterCanvasRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    const smooth = (value: number, start: number, end: number) =>
      THREE.MathUtils.smoothstep(value, start, end)
    const paint = () => {
      const progress = landingScroll.scenes.flight
      const copyExit = smooth(progress, 0.025, 0.16)
      const cabinExit = smooth(progress, 0.38, 0.5)
      const skyExit = smooth(progress, 0.5, 0.63)
      const visible = progress < 0.66

      if (layerRef.current) {
        layerRef.current.style.visibility = visible ? "visible" : "hidden"
      }
      if (sloganRef.current) {
        sloganRef.current.style.opacity = String(1 - copyExit)
        sloganRef.current.style.transform = `translate3d(0, ${(
          -48 * copyExit
        ).toFixed(3)}px, 0)`
      }
      if (cabinRef.current) {
        cabinRef.current.style.opacity = String(1 - cabinExit)
        cabinRef.current.style.visibility =
          cabinExit > 0.995 ? "hidden" : "visible"
      }
      if (skyRef.current) {
        skyRef.current.style.opacity = String(1 - skyExit)
        skyRef.current.style.visibility =
          skyExit > 0.995 ? "hidden" : "visible"
      }
    }
    paint()
    const unregisterFrame = registerLandingFrame(paint)
    return () => {
      unregisterFrame()
      unregisterCanvasRef.current?.()
      unregisterCanvasRef.current = null
    }
  }, [])

  return (
    <div ref={layerRef} className="co-opening-layer">
      {/* open sky: gradient, sun, drifting clouds — seen through the windows,
          then full-bleed once the cabin falls away */}
      <div
        ref={skyRef}
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #5FA8EE 0%, #85BDF2 48%, #C8E2F9 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "12%",
            right: "16%",
            width: "34vmin",
            height: "34vmin",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,241,196,0.95) 0%, rgba(255,233,168,0.55) 34%, rgba(255,233,168,0) 68%)",
            filter: "blur(2px)",
          }}
        />
        {/* realistic cumulus: layered puffs with shaded undersides */}
        {[
          { top: "20%", left: "-28%", w: 26, dur: "64s", delay: "0s" },
          { top: "44%", left: "-45%", w: 34, dur: "84s", delay: "-30s" },
          { top: "64%", left: "-30%", w: 22, dur: "56s", delay: "-14s" },
          { top: "10%", left: "-38%", w: 18, dur: "72s", delay: "-48s" },
          { top: "76%", left: "-50%", w: 30, dur: "95s", delay: "-60s" },
        ].map((c, i) => (
          <div
            key={i}
            className="co-cumulus"
            style={{ top: c.top, left: c.left, width: `${c.w}vmin`, height: `${c.w * 0.45}vmin`, animationDuration: c.dur, animationDelay: c.delay }}
          >
            <span style={{ left: "4%", bottom: "2%", width: "38%", height: "56%" }} />
            <span style={{ left: "22%", bottom: "16%", width: "48%", height: "84%" }} />
            <span style={{ left: "48%", bottom: "10%", width: "40%", height: "66%" }} />
            <span style={{ left: "62%", bottom: "0%", width: "34%", height: "48%" }} />
            <span className="co-base" style={{ left: "6%", bottom: "-4%", width: "88%", height: "38%" }} />
          </div>
        ))}
      </div>

      {/* the white cabin interior */}
      <div ref={cabinRef} style={{ position: "absolute", inset: 0 }}>
        <Canvas
          aria-hidden="true"
          camera={{ position: CAM_START.toArray(), fov: 38 }}
          dpr={[1, 2]}
          frameloop="never"
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          onCreated={(state) => {
            const { gl } = state
            gl.outputColorSpace = THREE.SRGBColorSpace
            gl.toneMappingExposure = 1.02
            unregisterCanvasRef.current?.()
            unregisterCanvasRef.current = registerThreeRoot(
              "cabin",
              state,
              () =>
                landingScroll.active.cabin &&
                !landingScroll.reducedMotion,
            )
          }}
          shadows
          style={{ width: "100%", height: "100%" }}
        >
          <CabinScene />
        </Canvas>
        {/* soft photographic vignette, like the reference shot */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(115% 100% at 50% 46%, rgba(0,0,0,0) 50%, rgba(12,9,7,0.45) 100%)",
          }}
        />
      </div>

      <div ref={sloganRef} className="co-intro-copy">
        <header className="co-intro-heading">
          <span className="ae-live-label co-reveal">
            <span>01 — Inside the decision</span>
          </span>
          <h1 className="co-intro-title" aria-label="Inside every recovery">
            <span className="co-reveal">
              <span>Inside every</span>
            </span>
            <span className="co-reveal">
              <span>recovery.</span>
            </span>
          </h1>
        </header>
        <p className="co-reveal">
          <span>
            Every seat connects to an aircraft, a legal crew, and a live network.
            Aeolus makes those constraints visible before the first decision.
          </span>
        </p>
        <span className="co-scroll-cue co-reveal">
          <span>Scroll to open the airframe ↓</span>
        </span>
      </div>

      <style>{`
        .co-cumulus {
          position: absolute;
          filter: blur(1.2px) drop-shadow(0 10px 14px rgba(120, 160, 210, 0.22));
          animation: co-drift linear infinite;
        }
        .co-cumulus span {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle at 38% 30%, #ffffff 0%, #fdfeff 52%, #eef5fc 74%, rgba(214, 231, 248, 0.25) 100%);
          box-shadow: inset -8px -14px 22px rgba(157, 192, 230, 0.5);
        }
        .co-cumulus .co-base {
          border-radius: 999px;
          box-shadow: inset 0 -16px 24px rgba(150, 186, 226, 0.55);
        }
        @keyframes co-drift {
          from { transform: translateX(0); }
          to { transform: translateX(175vw); }
        }
        @media (prefers-reduced-motion: reduce) {
          .co-cumulus { animation: none; }
        }
      `}</style>
    </div>
  )
}
