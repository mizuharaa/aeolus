"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"
import {
  landingScroll,
  registerLandingFrame,
} from "@/lib/scroll"

const smoothstep = (value: number, start: number, end: number) => {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

/**
 * Immediate first-paint flight sequence. It replaces the two startup WebGL
 * roots with composited DOM layers, keeping the cabin → airframe → flyaway
 * narrative without blocking the browser while shaders and geometry compile.
 */
export function FlightOpeningLite() {
  const layerRef = useRef<HTMLDivElement>(null)
  const cabinRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const paint = () => {
      const progress = landingScroll.scenes.flight
      const copyExit = smoothstep(progress, 0.025, 0.16)
      const cabinExit = smoothstep(progress, 0.3, 0.48)
      const planeEntry = smoothstep(progress, 0.28, 0.48)
      const fly = smoothstep(progress, 0.52, 0.99)
      const visible = progress < 0.995

      if (layerRef.current) {
        layerRef.current.style.visibility = visible ? "visible" : "hidden"
      }
      if (copyRef.current) {
        copyRef.current.style.opacity = String(1 - copyExit)
        copyRef.current.style.transform = `translate3d(0, ${(
          -40 * copyExit
        ).toFixed(2)}px, 0)`
      }
      if (cabinRef.current) {
        cabinRef.current.style.opacity = String(1 - cabinExit)
        cabinRef.current.style.transform = `scale(${(
          1 + cabinExit * 0.08
        ).toFixed(4)})`
      }
      if (planeRef.current) {
        const x = Math.sin(fly * Math.PI * 1.45) * 12 + fly * 54
        const y = -fly * 46 - Math.sin(fly * Math.PI) * 10
        const scale = 1.04 - planeEntry * 0.16 - fly * 0.68
        const roll = -4 + Math.sin(fly * Math.PI * 1.55) * 18
        planeRef.current.style.opacity = String(
          planeEntry * (1 - smoothstep(fly, 0.9, 1)),
        )
        planeRef.current.style.transform = `translate3d(calc(-50% + ${x.toFixed(
          2,
        )}vw), calc(-50% + ${y.toFixed(2)}dvh), 0) rotate(${roll.toFixed(
          2,
        )}deg) scale(${Math.max(0.18, scale).toFixed(4)})`
      }
    }

    paint()
    return registerLandingFrame(paint)
  }, [])

  return (
    <div ref={layerRef} className="ae-flight-lite" aria-hidden="true">
      <div className="ae-flight-lite-sky" />

      <div ref={planeRef} className="ae-flight-lite-plane">
        <Image
          alt=""
          fill
          priority
          sizes="(max-width: 48rem) 92vw, 78vw"
          src="/images/aeolus-airliner-poster.webp"
        />
      </div>

      <div ref={cabinRef} className="ae-flight-lite-cabin">
        <span className="ae-flight-lite-ceiling" />
        <span className="ae-flight-lite-aisle" />
        <div className="ae-flight-lite-seats">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="ae-flight-lite-seat">
              <i />
              <b />
            </span>
          ))}
        </div>
      </div>

      <div ref={copyRef} className="co-intro-copy">
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
            Every seat connects to an aircraft, a legal crew, and a live
            network. Aeolus makes those constraints visible before the first
            decision.
          </span>
        </p>
        <span className="co-scroll-cue co-reveal">
          <span>Scroll to open the airframe ↓</span>
        </span>
      </div>
    </div>
  )
}
