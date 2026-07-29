"use client"

import Lenis from "lenis"
import { advance, type RootState } from "@react-three/fiber"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"

export type LandingScene = "flight" | "identity" | "globe" | "demo"
export type LandingCanvas = "cabin" | "airliner" | "globe" | "macbook"
export type LandingQualityTier = "high" | "balanced" | "low"

export type LandingQualityProfile = {
  tier: LandingQualityTier
  dprMax: 1 | 1.5 | 2
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
    airliner: true,
    globe: false,
    macbook: false,
  } satisfies Record<LandingCanvas, boolean>,
  quality: {
    tier: "high",
    dprMax: 2,
    post: "full",
    clouds: true,
    aurora: true,
  } as LandingQualityProfile,
}

const frameCallbacks = new Set<LandingFrame>()
const threeRoots = new Map<LandingCanvas, ThreeRootRegistration>()
const requiredAssets = new Set(["cabin", "airliner", "earth"])
const readyAssets = new Set<string>()

let lenis: Lenis | null = null
let mountCount = 0
let refreshQueued = false
let lastFrameMs = 0
let removeReducedMotionListener: (() => void) | null = null
let removeLenisListener: (() => void) | null = null
let qualityProbeFrame = 0
let capabilityProfileResolved = false

const QUALITY_PROFILES: Record<LandingQualityTier, LandingQualityProfile> = {
  high: {
    tier: "high",
    dprMax: 2,
    post: "full",
    clouds: true,
    aurora: true,
  },
  balanced: {
    tier: "balanced",
    dprMax: 1.5,
    post: "balanced",
    clouds: true,
    aurora: true,
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
  if (memory <= 8 || cores <= 8 || coarsePointer || window.innerWidth < 1024) {
    return "balanced"
  }
  return "high"
}

function applyQualityProfile(tier: LandingQualityTier) {
  const next = QUALITY_PROFILES[tier]
  Object.assign(landingScroll.quality, next)
  threeRoots.forEach(({ state }) => state.setDpr(next.dprMax))
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

const renderFrame = (time: number) => {
  const nowMs = time * 1000
  const delta = lastFrameMs
    ? Math.min(Math.max((nowMs - lastFrameMs) / 1000, 0), 1 / 30)
    : 1 / 60
  lastFrameMs = nowMs
  landingScroll.time = time
  landingScroll.delta = delta

  frameCallbacks.forEach((callback) => callback(time, delta))
  threeRoots.forEach((registration) => {
    const active = registration.active()
    if (registration.wasActive && !active) registration.tailFrames = 48
    if (registration.primeFrames > 0 || registration.tailFrames > 0 || active) {
      advance(nowMs, false, registration.state)
      registration.primeFrames = Math.max(0, registration.primeFrames - 1)
      if (!active) {
        registration.tailFrames = Math.max(0, registration.tailFrames - 1)
      }
    }
    registration.wasActive = active
  })
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
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
    syncTouch: true,
    syncTouchLerp: 0.06,
    gestureOrientation: "vertical",
    autoRaf: false,
  })
  if (process.env.NODE_ENV !== "production") {
    ;(
      window as typeof window & {
        __aeolusLenis?: Lenis
        __aeolusLandingScroll?: typeof landingScroll
        __aeolusScrollTrigger?: typeof ScrollTrigger
      }
    ).__aeolusLenis = lenis
    ;(
      window as typeof window & {
        __aeolusLandingScroll?: typeof landingScroll
      }
    ).__aeolusLandingScroll = landingScroll
    ;(
      window as typeof window & {
        __aeolusScrollTrigger?: typeof ScrollTrigger
      }
    ).__aeolusScrollTrigger = ScrollTrigger
  }
  removeLenisListener = lenis.on("scroll", syncLenisState)
  syncLenisState(lenis)

  // Lenis runs first; DOM and all registered R3F roots render later on the
  // same GSAP tick, after ScrollTrigger has resolved the new scroll position.
  gsap.ticker.add(driveScroll, false, true)
  gsap.ticker.add(renderFrame)
  gsap.ticker.lagSmoothing(0)

  return unmountLandingScroll
}

function unmountLandingScroll() {
  mountCount = Math.max(0, mountCount - 1)
  if (mountCount > 0) return

  gsap.ticker.remove(driveScroll)
  gsap.ticker.remove(renderFrame)
  removeLenisListener?.()
  removeReducedMotionListener?.()
  if (qualityProbeFrame) window.cancelAnimationFrame(qualityProbeFrame)
  lenis?.destroy()
  if (process.env.NODE_ENV !== "production") {
    delete (
      window as typeof window & {
        __aeolusLenis?: Lenis
        __aeolusLandingScroll?: typeof landingScroll
        __aeolusScrollTrigger?: typeof ScrollTrigger
      }
    ).__aeolusLenis
    delete (
      window as typeof window & {
        __aeolusLandingScroll?: typeof landingScroll
      }
    ).__aeolusLandingScroll
    delete (
      window as typeof window & {
        __aeolusScrollTrigger?: typeof ScrollTrigger
      }
    ).__aeolusScrollTrigger
  }
  lenis = null
  removeLenisListener = null
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
    primeFrames: 12,
    tailFrames: 0,
    wasActive: active(),
  }
  threeRoots.set(id, registration)
  state.setDpr(getLandingQualityProfile().dprMax)

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
  queueLandingRefresh()
}

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
      lenis?.resize()
      ScrollTrigger.refresh()
      refreshQueued = false
    })
  })
}
