"use client"
/**
 * Landing motion primitives.
 *
 * Entrances are SCROLL-LINKED, not triggered. Every reveal is a continuous
 * function of where its own element sits in the viewport, so the wheel moves
 * it proportionally, reversing the scroll plays it backwards, and stopping
 * mid-way leaves it mid-way. The previous vocabulary fired a fixed 0.7s tween
 * once a threshold was crossed: the page snapped between finished states on
 * its own clock and read as a slideshow of screenshots.
 *
 * A spring sits between raw scroll progress and the rendered value, so the
 * motion carries weight instead of tracking the wheel rigidly 1:1.
 *
 * Everything routes through useReducedMotion so the page reads as a static
 * document when the user asks for that.
 */

import { motion, useInView, useReducedMotion } from "framer-motion"
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react"

import { gsap } from "@/components/landing/gsap"

export const EASE = [0.16, 1, 0.3, 1] as const // premium out-expo feel

// The window the reveal is spread across, as viewport percentages: it starts
// while the element's top is still near the bottom of the screen and finishes
// once that top has climbed past the middle. Shared by every primitive here so
// the page reveals on one rhythm.
const START = 94
const END = 56

/**
 * Fade + rise, driven continuously by the element's own scroll position.
 *
 * On ScrollTrigger rather than framer's useScroll deliberately. This page
 * scrolls through Lenis on a shared GSAP ticker and pins four sections behind
 * pin-spacers; a second, independent scroll reader measures against a document
 * those pins have already displaced, which is exactly the desync that had the
 * lower half of this page permanently finished. One scroll authority only.
 */
export function Rise({
  children,
  delay = 0,
  y = 24,
  style,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  style?: CSSProperties
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    // `delay` survives from the old triggered vocabulary as a phase offset:
    // a delayed sibling simply needs more scroll before it starts, which keeps
    // every existing call site's ordering without any of them changing.
    const shift = Math.min(delay, 0.6) * 20
    const ctx = gsap.context(() => {
      gsap.from(el, {
        y,
        opacity: 0,
        // The scroll position IS the timing — an easing curve on top of it
        // fights the wheel instead of following it.
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: `top ${START - shift}%`,
          end: `top ${END - shift}%`,
          scrub: 0.7,
        },
      })
    }, el)
    return () => ctx.revert()
  }, [delay, y])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}

/**
 * One member of a revealing group. Same machinery as Rise with a shorter
 * throw — there is no orchestrating parent any more, because once each item
 * reads its own scroll position the stagger falls out of the geometry: an
 * item further down the page enters the window later. That also makes the
 * cascade survive a reversed scroll, which a parent-driven staggerChildren
 * could not do.
 */
export function StaggerItem({
  children,
  style,
  className,
}: {
  children: ReactNode
  style?: CSSProperties
  className?: string
}) {
  return (
    <Rise y={20} style={style} className={className}>
      {children}
    </Rise>
  )
}

/** Clip-reveal for a single display line — the line slides up out of an
 *  overflow-hidden well. Used for hero + section headlines. */
export function LineReveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode
  delay?: number
  style?: CSSProperties
}) {
  const reduce = useReducedMotion()
  return (
    <span style={{ display: "block", overflow: "hidden", ...style }}>
      <motion.span
        style={{ display: "block", willChange: "transform" }}
        initial={reduce ? false : { y: "112%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.85, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  )
}

/** True once the node has been in view — for one-shot canvas/SVG sequences. */
export function useSeenOnce(margin = "-80px") {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, margin: margin as never })
  return { ref, seen }
}
