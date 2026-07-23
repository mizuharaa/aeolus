"use client"
/**
 * Landing motion primitives.
 *
 * One easing, one vocabulary. Entrances are staged (clip-reveal for display
 * type, fade+rise for panels), fire once, and never loop. Everything routes
 * through useReducedMotion so the page reads as a static document when the
 * user asks for that.
 */

import { motion, useInView, useReducedMotion } from "framer-motion"
import { useRef, type CSSProperties, type ReactNode } from "react"

export const EASE = [0.16, 1, 0.3, 1] as const // premium out-expo feel

/** Fade + rise, fired when the element scrolls into view (once). */
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
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      // once:false — the reveal reverses when the element scrolls back out,
      // so the page animates in BOTH scroll directions
      viewport={{ once: false, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
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

/** Stagger container + child for grouped panel entrances. */
export function StaggerGroup({
  children,
  style,
  className,
  gap = 0.07,
  delay = 0,
}: {
  children: ReactNode
  style?: CSSProperties
  className?: string
  gap?: number
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: false, margin: "-60px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

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
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** True once the node has been in view — for one-shot canvas/SVG sequences. */
export function useSeenOnce(margin = "-80px") {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, margin: margin as never })
  return { ref, seen }
}
