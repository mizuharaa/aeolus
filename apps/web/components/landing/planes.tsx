"use client"
/**
 * Paper planes — the landing's only decorative element. Each DriftPlane
 * is a two-tone folded dart that travels across its section as you
 * scroll (GSAP scrub against the nearest <section>), with a gentle
 * framer bob layered on top so it never sits perfectly still.
 */

import { useLayoutEffect, useRef, type CSSProperties } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { gsap } from "@/components/landing/gsap"

export function PaperPlane({
  size = 30,
  color = "var(--ink)",
}: {
  size?: number
  color?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {/* top wing */}
      <path d="M30 4 L3 15 L13.4 18.6 Z" fill={color} />
      {/* bottom wing — darker fold */}
      <path d="M30 4 L13.4 18.6 L16 27 Z" fill={color} opacity={0.55} />
      {/* fold line */}
      <path d="M30 4 L13.4 18.6" stroke="var(--bg)" strokeWidth="0.9" opacity={0.7} />
    </svg>
  )
}

export function DriftPlane({
  from,
  to,
  rotate = [0, 12],
  size = 28,
  color = "var(--ink)",
  bob = 8,
  style,
}: {
  from: { left: string; top: string }
  to: { left: string; top: string }
  rotate?: [number, number]
  size?: number
  color?: string
  bob?: number
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const section = el.closest("section")
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { left: from.left, top: from.top, rotation: rotate[0] },
        {
          left: to.left,
          top: to.top,
          rotation: rotate[1],
          ease: "none",
          scrollTrigger: {
            trigger: section,
            // first section is already at the top of the page, so start
            // the travel from wherever the section first becomes visible
            start: section.getBoundingClientRect().top + window.scrollY < 10 ? "top top" : "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        },
      )
    }, el)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <span
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        left: from.left,
        top: from.top,
        pointerEvents: "none",
        willChange: "transform",
        zIndex: 1,
        ...style,
      }}
    >
      <motion.span
        style={{ display: "inline-flex" }}
        animate={reduce ? undefined : { y: [0, -bob, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <PaperPlane size={size} color={color} />
      </motion.span>
    </span>
  )
}
