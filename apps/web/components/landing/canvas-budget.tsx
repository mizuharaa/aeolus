"use client"

import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { getLandingQualityProfile } from "@/lib/scroll"

/**
 * Apply the shared capability budget without installing a separate monitor
 * inside every canvas. Global quality detection and registerThreeRoot own
 * subsequent DPR changes.
 */
export function CanvasBudget() {
  const setDpr = useThree((state) => state.setDpr)

  useEffect(() => {
    setDpr(getLandingQualityProfile().dprMax)
  }, [setDpr])

  return null
}
