"use client"

import { useCallback, useEffect } from "react"
import {
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
} from "@react-three/drei"
import { useThree } from "@react-three/fiber"
import {
  getLandingQualityProfile,
  setLandingQualityTier,
} from "@/lib/scroll"

/**
 * Shared adaptive policy for every landing canvas. It never creates a RAF:
 * the monitor samples frames advanced by the one GSAP/Lenis clock.
 */
export function CanvasBudget() {
  const setDpr = useThree((state) => state.setDpr)

  useEffect(() => {
    setDpr(getLandingQualityProfile().dprMax)
  }, [setDpr])

  const decline = useCallback(() => {
    setLandingQualityTier("low")
    setDpr(1)
  }, [setDpr])

  return (
    <>
      <PerformanceMonitor
        flipflops={2}
        bounds={(refreshRate) => [
          Math.min(42, refreshRate * 0.7),
          Math.min(58, refreshRate * 0.92),
        ]}
        onDecline={decline}
        onFallback={decline}
      />
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </>
  )
}
