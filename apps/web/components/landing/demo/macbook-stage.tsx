"use client"

import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  RoundedBox,
} from "@react-three/drei"
import { Canvas, useFrame, type RootState } from "@react-three/fiber"
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react"
import * as THREE from "three"
import {
  landingScroll,
  markLandingAssetReady,
  registerThreeRoot,
} from "@/lib/scroll"
import { Spring, damp } from "@/lib/spring"
import { CanvasBudget } from "@/components/landing/canvas-budget"

const BODY_WIDTH = 3.126
const BODY_DEPTH = 2.212
const BODY_HEIGHT = 0.155
const LID_DEPTH = 2.065
const LID_THICKNESS = 0.062
const SCREEN_WIDTH = 2.956
const SCREEN_DEPTH = 1.848
// Drei's transform-mode Html uses a 10 / 400 CSS-to-world conversion.
// Compensate once here so the 1280px OCC surface occupies the 2.956-unit
// display aperture without any per-frame DOM measurement.
const SCREEN_SCALE = (SCREEN_WIDTH / 1280) * 40
const OPEN_ANGLE = -1.92

type MacbookStageProps = {
  children: ReactNode
  staticMode: boolean
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = THREE.MathUtils.clamp(
    (value - edge0) / Math.max(edge1 - edge0, Number.EPSILON),
    0,
    1,
  )
  return x * x * (3 - 2 * x)
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.closePath()
}

function createKeyboardTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 1536
  canvas.height = 640
  const context = canvas.getContext("2d")
  if (!context) return new THREE.CanvasTexture(canvas)

  const background = context.createLinearGradient(0, 0, 0, canvas.height)
  background.addColorStop(0, "#303034")
  background.addColorStop(1, "#242428")
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)

  const rows = [
    ["esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "–", "=", "⌫"],
    ["tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
    ["caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "return"],
    ["shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "shift"],
    ["fn", "ctrl", "⌥", "⌘", "space", "⌘", "⌥", "◀", "▲", "▼", "▶"],
  ]
  const rowWidths = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1.35, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.35],
    [1.65, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.85],
    [2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2],
    [1, 1, 1, 1.2, 5.3, 1.2, 1, 1, 1, 1, 1],
  ]

  const inset = 46
  const gap = 10
  const rowHeight = 92
  const rowGap = 12
  const startY = 32

  rows.forEach((row, rowIndex) => {
    const units = rowWidths[rowIndex].reduce((sum, value) => sum + value, 0)
    const keyUnit =
      (canvas.width - inset * 2 - gap * (row.length - 1)) / units
    let x = inset

    row.forEach((label, keyIndex) => {
      const width = keyUnit * rowWidths[rowIndex][keyIndex]
      const y = startY + rowIndex * (rowHeight + rowGap)
      const keyGradient = context.createLinearGradient(0, y, 0, y + rowHeight)
      keyGradient.addColorStop(0, "#1d1d20")
      keyGradient.addColorStop(0.84, "#111114")
      keyGradient.addColorStop(1, "#09090b")

      context.save()
      context.shadowColor = "rgba(0,0,0,0.9)"
      context.shadowBlur = 8
      context.shadowOffsetY = 5
      drawRoundedRect(context, x, y, width, rowHeight, 12)
      context.fillStyle = keyGradient
      context.fill()
      context.restore()

      drawRoundedRect(context, x + 1.5, y + 1.5, width - 3, rowHeight - 3, 11)
      context.strokeStyle = "rgba(255,255,255,0.12)"
      context.lineWidth = 2
      context.stroke()

      context.fillStyle = "rgba(245,240,230,0.78)"
      context.font =
        label.length > 2
          ? "500 18px ui-monospace, monospace"
          : "500 23px ui-monospace, monospace"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(label, x + width / 2, y + rowHeight / 2 - 1)
      x += width + gap
    })
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function LaptopModel({
  children,
  staticMode,
}: MacbookStageProps) {
  const rigRef = useRef<THREE.Group>(null)
  const lidRef = useRef<THREE.Group>(null)
  const htmlRef = useRef<HTMLDivElement>(null)
  const screenGlowRef = useRef<THREE.PointLight>(null)
  const openSpring = useMemo(() => {
    const spring = new Spring(142, 2 * Math.sqrt(142))
    spring.value = 1
    return spring
  }, [])
  const dollySpring = useRef(new Spring(86, 2 * Math.sqrt(86)))
  const roll = useRef(0)
  const keyboardTexture = useMemo(createKeyboardTexture, [])

  useEffect(
    () => () => {
      keyboardTexture.dispose()
    },
    [keyboardTexture],
  )

  useFrame(({ camera }, delta) => {
    const progress = staticMode ? 0.45 : landingScroll.scenes.demo
    const closeAmount = staticMode
      ? 0
      : smoothstep(0.72, 0.955, progress)
    const targetOpen = 1 - closeAmount
    const spring = openSpring

    // A real hinge has more friction on the closing stroke. The final six
    // percent is intentionally viscous, then the magnet supplies a tiny,
    // transient snap that disappears as velocity settles.
    const closing = targetOpen < spring.value
    spring.stiffness = closing ? 154 : 128
    spring.damping =
      2 * Math.sqrt(spring.stiffness) * (closing ? 1.12 : 0.94)
    if (closing && spring.value < 0.06) {
      spring.velocity = Math.max(spring.velocity, -0.24)
      spring.damping *= 1.42
    }
    const openAmount = THREE.MathUtils.clamp(
      spring.step(targetOpen, delta),
      -0.015,
      1.015,
    )
    const magneticSettle =
      closing && openAmount < 0.045
        ? Math.max(-0.013, spring.velocity * 0.022)
        : 0
    const physicalOpen = Math.max(-0.013, openAmount + magneticSettle)

    if (lidRef.current) {
      lidRef.current.rotation.x = OPEN_ANGLE * physicalOpen
    }

    const focus = staticMode
      ? 0.7
      : smoothstep(0.12, 0.34, progress) *
        (1 - smoothstep(0.68, 0.9, progress))
    const dolly = dollySpring.current.step(focus, delta)
    if (rigRef.current) {
      rigRef.current.scale.setScalar(0.88 + dolly * 0.09 - closeAmount * 0.035)
      rigRef.current.position.y = -0.16 + dolly * 0.06
      roll.current = damp(
        roll.current,
        (landingScroll.direction || 0) * 0.006 * (1 - closeAmount),
        5,
        delta,
      )
      rigRef.current.rotation.z = roll.current
    }

    const targetCameraY = 2.26 - dolly * 0.12 + closeAmount * 0.08
    const targetCameraZ = 4.56 - dolly * 0.34 + closeAmount * 0.16
    camera.position.y = damp(camera.position.y, targetCameraY, 6, delta)
    camera.position.z = damp(camera.position.z, targetCameraZ, 6, delta)
    camera.lookAt(0, 0.72, -0.03)

    const screenEnergy = Math.max(0, openAmount) ** 2
    if (screenGlowRef.current) {
      screenGlowRef.current.intensity =
        screenEnergy < 0.0004 ? 0 : 0.42 * screenEnergy
    }
    if (htmlRef.current) {
      htmlRef.current.style.opacity = String(
        THREE.MathUtils.smoothstep(screenEnergy, 0.015, 0.2),
      )
      htmlRef.current.style.visibility =
        screenEnergy < 0.004 ? "hidden" : "visible"
    }
  })

  return (
    <>
      <group ref={rigRef} rotation={[-0.035, 0, 0]} dispose={null}>
        <group>
          <RoundedBox
            args={[BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH]}
            radius={0.085}
            smoothness={6}
            position={[0, BODY_HEIGHT / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#626268"
              metalness={0.9}
              roughness={0.38}
              anisotropy={0.5}
              anisotropyRotation={Math.PI / 2}
              envMapIntensity={1.1}
            />
          </RoundedBox>

          <RoundedBox
            args={[2.96, 0.014, 1.07]}
            radius={0.035}
            smoothness={4}
            position={[0, BODY_HEIGHT + 0.009, -0.29]}
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#ffffff"
              metalness={0.02}
              roughness={0.62}
              map={keyboardTexture}
              emissive="#111114"
              emissiveIntensity={0.28}
            />
          </RoundedBox>

          <RoundedBox
            args={[1.42, 0.006, 0.72]}
            radius={0.055}
            smoothness={6}
            position={[0, BODY_HEIGHT + 0.008, 0.68]}
          >
            <meshPhysicalMaterial
              color="#55555b"
              metalness={0.82}
              roughness={0.28}
              envMapIntensity={1.05}
            />
          </RoundedBox>

          <RoundedBox
            args={[0.48, 0.022, 0.06]}
            radius={0.03}
            smoothness={5}
            position={[0, BODY_HEIGHT * 0.5, BODY_DEPTH / 2 + 0.006]}
          >
            <meshPhysicalMaterial
              color="#303034"
              metalness={0.82}
              roughness={0.36}
            />
          </RoundedBox>

          {[
            [-1.27, -0.018, -0.84],
            [1.27, -0.018, -0.84],
            [-1.27, -0.018, 0.84],
            [1.27, -0.018, 0.84],
          ].map((position, index) => (
            <RoundedBox
              key={index}
              args={[0.24, 0.025, 0.11]}
              radius={0.025}
              smoothness={4}
              position={position as [number, number, number]}
            >
              <meshStandardMaterial color="#171719" roughness={0.86} />
            </RoundedBox>
          ))}

          {[-1.16, 1.16].map((x) => (
            <mesh
              key={x}
              position={[x, BODY_HEIGHT + 0.006, -BODY_DEPTH / 2 + 0.018]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.038, 0.038, 0.48, 24]} />
              <meshPhysicalMaterial
                color="#27272a"
                metalness={0.92}
                roughness={0.24}
              />
            </mesh>
          ))}
        </group>

        <group
          ref={lidRef}
          position={[0, BODY_HEIGHT + 0.01, -BODY_DEPTH / 2]}
          rotation={[OPEN_ANGLE, 0, 0]}
        >
          <RoundedBox
            args={[BODY_WIDTH, LID_THICKNESS, LID_DEPTH]}
            radius={0.07}
            smoothness={6}
            position={[0, LID_THICKNESS / 2, LID_DEPTH / 2]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color="#5e5e64"
              metalness={0.92}
              roughness={0.36}
              anisotropy={0.5}
              anisotropyRotation={Math.PI / 2}
              clearcoat={0.08}
              clearcoatRoughness={0.45}
              envMapIntensity={1.14}
            />
          </RoundedBox>

          {[
            [0, -0.006, 2.006, 3.03, 0.012, 0.118],
            [0, -0.006, 0.059, 3.03, 0.012, 0.118],
            [-1.486, -0.006, LID_DEPTH / 2, 0.058, 0.012, 1.84],
            [1.486, -0.006, LID_DEPTH / 2, 0.058, 0.012, 1.84],
          ].map(([x, y, z, width, height, depth], index) => (
            <RoundedBox
              key={index}
              args={[width, height, depth]}
              radius={0.024}
              smoothness={4}
              position={[x, y, z]}
            >
              <meshPhysicalMaterial
                color="#050507"
                metalness={0.08}
                roughness={0.14}
                clearcoat={1}
                clearcoatRoughness={0.08}
              />
            </RoundedBox>
          ))}

          <Html
            transform
            center
            position={[0, -0.014, LID_DEPTH / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={SCREEN_SCALE}
            zIndexRange={[8, 0]}
          >
            <div
              ref={htmlRef}
              className="dm-screen-html"
              data-testid="occ-dashboard-screen"
            >
              <span className="dm-screen-notch" aria-hidden="true" />
              <span className="dm-screen-reflection" aria-hidden="true" />
              {children}
            </div>
          </Html>

          <pointLight
            ref={screenGlowRef}
            color="#b9c7ff"
            intensity={0.42}
            distance={3.4}
            decay={1.8}
            position={[0, -0.22, LID_DEPTH * 0.52]}
          />
        </group>
      </group>

      <ContactShadows
        position={[0, -0.03, 0]}
        opacity={0.38}
        scale={6}
        blur={2.8}
        far={4.5}
        frames={1}
      />
    </>
  )
}

function LaptopEnvironment() {
  return (
    <Environment resolution={256} background={false}>
      <Lightformer
        form="rect"
        color="#f5efe3"
        intensity={3.2}
        position={[-3, 4, 2]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[3, 5, 1]}
      />
      <Lightformer
        form="rect"
        color="#8e78e7"
        intensity={2.1}
        position={[4, 1, 1]}
        rotation={[0, -Math.PI / 3, 0]}
        scale={[2, 3, 1]}
      />
      <Lightformer
        form="ring"
        color="#e8a33d"
        intensity={1.4}
        position={[0, 2, -4]}
        scale={3.5}
      />
    </Environment>
  )
}

export function MacbookStage({
  children,
  staticMode,
}: MacbookStageProps) {
  const unregisterRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    markLandingAssetReady("macbook")
    return () => unregisterRef.current?.()
  }, [])

  const registerRoot = (state: RootState) => {
    unregisterRef.current?.()
    unregisterRef.current = registerThreeRoot(
      "macbook",
      state,
      () => landingScroll.active.macbook || staticMode,
    )
  }

  return (
    <div className="dm-macbook-stage" aria-label="Aeolus OCC dashboard on a closing laptop">
      <Canvas
        frameloop="never"
        dpr={[1, 2]}
        camera={{ position: [0, 2.26, 4.56], fov: 28, near: 0.1, far: 30 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        shadows
        onCreated={registerRoot}
      >
        <CanvasBudget />
        <color attach="background" args={["#0a0711"]} />
        <ambientLight intensity={0.24} color="#ded8ef" />
        <directionalLight
          position={[-4, 6, 5]}
          intensity={2.2}
          color="#fff4dd"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight
          position={[4, 2, -3]}
          intensity={1.2}
          color="#836df0"
        />
        <LaptopEnvironment />
        <LaptopModel staticMode={staticMode}>{children}</LaptopModel>
      </Canvas>
    </div>
  )
}
