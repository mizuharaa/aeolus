"use client"

import Lenis from "lenis"
import { advance, type RootState } from "@react-three/fiber"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"

export type LandingScene = "flight" | "identity" | "globe" | "demo"
export type LandingCanvas = "cabin" | "airliner" | "globe"
export type LandingQualityTier = "high" | "balanced" | "low"

export type LandingQualityProfile = {
  tier: LandingQualityTier
  dprMax: 1 | 1.25 | 1.5
  post: "full" | "balanced" | "mobile"
  clouds: boolean
  aurora: boolean
}

type LandingFrame = (time: number, delta: number) => void
type ThreeRootRegistration = {
  state: RootState
  active: () => boolean
  primeFrames: number
  tailFrames: number
  wasActive: boolean
}

/**
 * Mutable, framework-free motion state. ScrollTrigger writes to it and the
 * shared GSAP/R3F frame reads it. Never put React state in this path.
 */
export const landingScroll = {
  scroll: 0,
  velocity: 0,
  direction: 0 as -1 | 0 | 1,
  time: 0,
  delta: 1 / 60,
  reducedMotion: false,
  scenes: {
    flight: 0,
    identity: 0,
    globe: 0,
    demo: 0,
  } satisfies Record<LandingScene, number>,
  active: {
    cabin: true,
    airliner: false,
    globe: false,
  } satisfies Record<LandingCanvas, boolean>,
  quality: {
    tier: "balanced",
    dprMax: 1.25,
    post: "mobile",
    clouds: false,
    aurora: false,
  } as LandingQualityProfile,
}

const frameCallbacks = new Set<LandingFrame>()
const threeRoots = new Map<LandingCanvas, ThreeRootRegistration>()
const requiredAssets = new Set<string>()
const readyAssets = new Set<string>()

let lenis: Lenis | null = null
let mountCount = 0
let refreshQueued = false
let lastFrameMs = 0
let removeReducedMotionListener: (() => void) | null = null
let removeLenisListener: (() => void) | null = null
let removeViewportListeners: (() => void) | null = null
let qualityProbeFrame = 0
let capabilityProfileResolved = false

const QUALITY_PROFILES: Record<LandingQualityTier, LandingQualityProfile> = {
  high: {
    tier: "high",
    dprMax: 1.5,
    post: "balanced",
    clouds: true,
    aurora: true,
  },
  balanced: {
    tier: "balanced",
    dprMax: 1.25,
    post: "mobile",
    clouds: false,
    aurora: false,
  },
  low: {
    tier: "low",
    dprMax: 1,
    post: "mobile",
    clouds: false,
    aurora: false,
  },
}

const QUALITY_RANK: Record<LandingQualityTier, number> = {
  low: 0,
  balanced: 1,
  high: 2,
}

/**
 * A cap in ABSOLUTE device pixels, not in device-pixel-ratio.
 *
 * `dprMax` caps the RATIO, so the drawing buffer still grows with the monitor:
 * the cabin rendered 1.6M pixels on a 1440x900 laptop and 5.8M pixels of
 * exactly the same shot on a 2560x1440 screen. Its fragment shader is a
 * fifteen-light physical BRDF and it is paid per pixel, which is why the hang
 * scaled with screen area — measured before this cap, one cabin frame at
 * 2560x1440 took about two seconds and the page delivered a single idle frame
 * in four. "It freezes on my other screen" was that, literally.
 *
 * So the budget is on area. A laptop keeps essentially its full ratio; a big
 * screen renders the same number of pixels and the compositor upscales, which
 * costs a little softness on the porthole frames and buys back the page.
 */
const MAX_DRAWING_PIXELS = 1_700_000

/** The device-pixel-ratio a landing canvas may use at the current viewport. */
export function landingDpr(): number {
  const max = landingScroll.quality.dprMax
  if (typeof window === "undefined") return max
  const area = window.innerWidth * window.innerHeight
  if (!area) return max
  return Math.max(0.6, Math.min(max, Math.sqrt(MAX_DRAWING_PIXELS / area)))
}

function detectCapabilityTier(): LandingQualityTier {
  if (typeof window === "undefined") return "high"

  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency || 8
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches
  const compactViewport = Math.min(window.innerWidth, window.innerHeight) < 760

  if (memory <= 4 || cores <= 4 || (coarsePointer && compactViewport)) {
    return "low"
  }
  return "balanced"
}

function applyQualityProfile(tier: LandingQualityTier) {
  const next = QUALITY_PROFILES[tier]
  Object.assign(landingScroll.quality, next)
  const dpr = landingDpr()
  threeRoots.forEach(({ state }) => state.setDpr(dpr))
}

export function getLandingQualityProfile(): LandingQualityProfile {
  if (!capabilityProfileResolved && typeof window !== "undefined") {
    capabilityProfileResolved = true
    applyQualityProfile(detectCapabilityTier())
  }
  return landingScroll.quality
}

export function setLandingQualityTier(
  tier: LandingQualityTier,
  options: { allowUpgrade?: boolean } = {},
) {
  const current = landingScroll.quality.tier
  if (!options.allowUpgrade && QUALITY_RANK[tier] >= QUALITY_RANK[current]) return
  applyQualityProfile(tier)
}

function startCapabilityProbe() {
  if (document.visibilityState !== "visible") return
  const startedAt = performance.now()
  let frameCount = 0

  const sample = (now: number) => {
    frameCount += 1
    const elapsed = now - startedAt
    if (elapsed < 500) {
      qualityProbeFrame = window.requestAnimationFrame(sample)
      return
    }

    qualityProbeFrame = 0
    const fps = (frameCount * 1000) / Math.max(elapsed, 1)
    if (fps < 42) setLandingQualityTier("low")
    else if (fps < 55) setLandingQualityTier("balanced")
  }

  qualityProbeFrame = window.requestAnimationFrame(sample)
}

const driveScroll = (time: number) => {
  const instance = lenis
  if (!instance) return
  instance.raf(time * 1000)
  ScrollTrigger.update()
}

/**
 * ── RENDER ON DEMAND ──────────────────────────────────────────────────────
 *
 * Every landing scene is scrubbed by scroll position. So while the scroll and
 * all four scene progress values are unchanged there is, by construction,
 * nothing new to draw — and drawing anyway is what froze the page.
 *
 * Measured before this guard, on the production build at 2560x1440: the page
 * delivered ONE idle frame in four seconds, because the cabin canvas (a
 * full-viewport fifteen-light physical scene) re-rendered on every tick while
 * the visitor sat still at the top of the page. A CDP sampling profile put
 * 6,145ms of a 9,485ms window in native rasterisation and 2,213ms inside
 * `WebGLProgram.getUniforms`, which is where three.js blocks on shader link.
 *
 * The scenes damp toward their scroll targets rather than snapping, so drawing
 * continues for SETTLE_MS past the last change to let that damping come to
 * rest. `performance.now()` rather than the ticker clock: the GSAP ticker's
 * time is elapsed-since-start and the two are not the same epoch.
 */
const SETTLE_MS = 900
let sceneSignature = ""
let settleUntil = 0

function scenesSettling(): boolean {
  const now = performance.now()
  const { scenes } = landingScroll
  const next = `${Math.round(landingScroll.scroll)}|${scenes.flight.toFixed(4)}|${scenes.identity.toFixed(4)}|${scenes.globe.toFixed(4)}|${scenes.demo.toFixed(4)}`
  if (next !== sceneSignature) {
    sceneSignature = next
    settleUntil = now + SETTLE_MS
  }
  return now < settleUntil
}

/**
 * Draw the next SETTLE_MS of frames even though no scene value moved — for
 * the things that change a canvas without changing the scroll: a resize, a
 * trigger refresh, coming back to a backgrounded tab.
 */
function invalidateLandingScenes() {
  sceneSignature = ""
  settleUntil = performance.now() + SETTLE_MS
}

const renderFrame = (time: number) => {
  const nowMs = time * 1000
  const delta = lastFrameMs
    ? Math.min(Math.max((nowMs - lastFrameMs) / 1000, 0), 1 / 30)
    : 1 / 60
  lastFrameMs = nowMs
  landingScroll.time = time
  landingScroll.delta = delta

  // A tab nobody is looking at gets nothing at all.
  if (document.visibilityState === "hidden") return

  frameCallbacks.forEach((callback) => callback(time, delta))
  const settling = scenesSettling()
  threeRoots.forEach((registration) => {
    const active = registration.active()
    if (registration.wasActive && !active) registration.tailFrames = 12
    const warming = registration.primeFrames > 0 || registration.tailFrames > 0
    if (warming || (active && settling)) {
      advance(nowMs, false, registration.state)
      registration.primeFrames = Math.max(0, registration.primeFrames - 1)
      if (!active) {
        registration.tailFrames = Math.max(0, registration.tailFrames - 1)
      }
    }
    registration.wasActive = active
  })
}

const onViewportChange = () => {
  if (document.visibilityState !== "visible") return
  const dpr = landingDpr()
  threeRoots.forEach(({ state }) => state.setDpr(dpr))
  invalidateLandingScenes()
}

const syncLenisState = (instance: Lenis) => {
  landingScroll.scroll = instance.animatedScroll
  landingScroll.velocity = instance.velocity
  landingScroll.direction = instance.direction
  ScrollTrigger.update()
}

export function mountLandingScroll() {
  mountCount += 1
  if (lenis) return unmountLandingScroll

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  )
  const syncMotionPreference = () => {
    landingScroll.reducedMotion = motionPreference.matches
  }
  syncMotionPreference()
  motionPreference.addEventListener("change", syncMotionPreference)
  removeReducedMotionListener = () =>
    motionPreference.removeEventListener("change", syncMotionPreference)

  getLandingQualityProfile()
  startCapabilityProbe()

  lenis = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 1,
    syncTouch: false,
    gestureOrientation: "vertical",
    autoRaf: false,
  })
  if (process.env.NODE_ENV !== "production") {
    ;(
      window as typeof window & {
        __olusLenis?: Lenis
        __olusLandingScroll?: typeof landingScroll
        __olusScrollTrigger?: typeof ScrollTrigger
      }
    ).__olusLenis = lenis
    ;(
      window as typeof window & {
        __olusLandingScroll?: typeof landingScroll
      }
    ).__olusLandingScroll = landingScroll
    ;(
      window as typeof window & {
        __olusScrollTrigger?: typeof ScrollTrigger
      }
    ).__olusScrollTrigger = ScrollTrigger
  }
  removeLenisListener = lenis.on("scroll", syncLenisState)
  syncLenisState(lenis)

  // A resize changes both the drawing-buffer budget and the framing, and
  // neither moves a scene value, so the render-on-demand guard has to be told.
  removeViewportListeners = () => {
    window.removeEventListener("resize", onViewportChange)
    document.removeEventListener("visibilitychange", onViewportChange)
  }
  window.addEventListener("resize", onViewportChange)
  document.addEventListener("visibilitychange", onViewportChange)

  // Lenis runs first; DOM and all registered R3F roots render later on the
  // same GSAP tick, after ScrollTrigger has resolved the new scroll position.
  gsap.ticker.add(driveScroll, false, true)
  gsap.ticker.add(renderFrame)
  gsap.ticker.lagSmoothing(0)
  queueLandingRefresh()

  return unmountLandingScroll
}

function unmountLandingScroll() {
  mountCount = Math.max(0, mountCount - 1)
  if (mountCount > 0) return

  gsap.ticker.remove(driveScroll)
  gsap.ticker.remove(renderFrame)
  removeLenisListener?.()
  removeReducedMotionListener?.()
  removeViewportListeners?.()
  if (qualityProbeFrame) window.cancelAnimationFrame(qualityProbeFrame)
  lenis?.destroy()
  if (process.env.NODE_ENV !== "production") {
    delete (
      window as typeof window & {
        __olusLenis?: Lenis
        __olusLandingScroll?: typeof landingScroll
        __olusScrollTrigger?: typeof ScrollTrigger
      }
    ).__olusLenis
    delete (
      window as typeof window & {
        __olusLandingScroll?: typeof landingScroll
      }
    ).__olusLandingScroll
    delete (
      window as typeof window & {
        __olusScrollTrigger?: typeof ScrollTrigger
      }
    ).__olusScrollTrigger
  }
  lenis = null
  removeLenisListener = null
  removeViewportListeners = null
  removeReducedMotionListener = null
  qualityProbeFrame = 0
  lastFrameMs = 0
}

export function getLenis() {
  return lenis
}

export function registerLandingFrame(callback: LandingFrame) {
  frameCallbacks.add(callback)
  return () => {
    frameCallbacks.delete(callback)
  }
}

export function registerThreeRoot(
  id: LandingCanvas,
  state: RootState,
  active: () => boolean = () => landingScroll.active[id],
) {
  // Html portals and post-processing subscriptions mount just after the
  // canvas root. A short shared-clock warmup lets those late subscriptions
  // settle without giving each canvas its own RAF loop.
  const registration = {
    state,
    active,
    primeFrames: 4,
    tailFrames: 0,
    wasActive: active(),
  }
  threeRoots.set(id, registration)
  getLandingQualityProfile()
  state.setDpr(landingDpr())

  return () => {
    if (threeRoots.get(id) === registration) threeRoots.delete(id)
  }
}

export function setLandingSceneActive(id: LandingCanvas, active: boolean) {
  ;(landingScroll.active as Record<LandingCanvas, boolean>)[id] = active
}

export function resetLandingScene(scene: LandingScene, value = 0) {
  landingScroll.scenes[scene] = value
}

export function markLandingAssetReady(asset: string) {
  readyAssets.add(asset)
  // New content in a scene, with no scroll movement to announce it. Without
  // this the airliner GLB can land while the visitor is parked inside the pin
  // and the canvas would hold the frame it drew before the model existed.
  invalidateLandingScenes()
  queueLandingRefresh()
}

/**
 * Recompute trigger positions after late-arriving layout (fonts, the airliner
 * GLB) — but ONLY while the visitor is still at the top of the page.
 *
 * `markLandingAssetReady("airliner")` fires when a 488KB model finishes
 * downloading, which can be seconds after mount. `ScrollTrigger.refresh()`
 * recalculates the start and end of every pinned trigger, and this page has
 * four of them; running it while someone is scrolled inside a pin re-resolves
 * that pin underneath them and dumps them back at its start. That is the
 * "scrolling through the demo sends me back to the top of the laptop" bug — the
 * page was not looping, it was being re-measured mid-scroll.
 *
 * Past the first viewport the refresh buys nothing (layout above is already
 * settled and pinned sections size themselves from the viewport) and risks
 * exactly that jump, so it is dropped. Genuine resizes still refresh through
 * ScrollTrigger's own listener, which is not this path.
 */
const REFRESH_SAFE_SCROLL = 200

function queueLandingRefresh() {
  if (
    refreshQueued ||
    !Array.from(requiredAssets).every((asset) => readyAssets.has(asset))
  ) {
    return
  }
  refreshQueued = true
  void document.fonts.ready.then(() => {
    window.requestAnimationFrame(() => {
      refreshQueued = false
      if ((lenis?.animatedScroll ?? window.scrollY) > REFRESH_SAFE_SCROLL) return
      lenis?.resize()
      // Sort BEFORE refreshing, or every trigger below the pins is measured
      // against a document that does not yet include their pin distance.
      // The three pinned sections are created by `next/dynamic ssr:false`
      // components, so they enter ScrollTrigger's list AFTER the ordinary
      // sections further down the page. ScrollTrigger folds pin distance into
      // later triggers in LIST order, not document order, so the sections
      // below the demo were resolving ~4,900px too early — measured: the four
      // plans' start was 6,966 against a real 11,838. They were therefore at
      // progress 1 before you ever reached them, which is why everything down
      // there looked like a finished screenshot no matter how you scrolled.
      // sort() reorders the list permanently, so ScrollTrigger's own resize
      // refreshes stay correct afterwards.
      ScrollTrigger.sort()
      ScrollTrigger.refresh()
      // A refresh can move every scene's progress without a scroll event.
      invalidateLandingScenes()
    })
  })
}
