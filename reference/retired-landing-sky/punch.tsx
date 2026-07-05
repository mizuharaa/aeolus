"use client"
/**
 * Punched-text motion primitives — the landing's loud typographic voice.
 *
 *   PunchReveal — SplitText line reveal: masked lines slam up out of their
 *                 own overflow wells (on scroll into view, or on mount).
 *   GhostMarquee — full-bleed outlined display strip whose x-position is
 *                 scrubbed by scroll direction.
 *   CountUp — tabular numeral that counts up once when it enters the view.
 *
 * All of it degrades to static type under prefers-reduced-motion (GSAP
 * timelines are skipped entirely).
 */

import {
  createElement, useLayoutEffect, useRef,
  type CSSProperties, type ElementType, type ReactNode,
} from "react"
import { gsap, SplitText } from "./gsap"

function prefersReduced(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

// ── PunchReveal ──────────────────────────────────────────────────────────
export function PunchReveal({
  children,
  as: Tag = "div",
  className,
  style,
  delay = 0,
  stagger = 0.1,
  onMount = false,
  start = "top 87%",
}: {
  children: ReactNode
  as?: ElementType
  className?: string
  style?: CSSProperties
  delay?: number
  stagger?: number
  /** true → play immediately (above-the-fold content) instead of on scroll */
  onMount?: boolean
  start?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReduced()) return
    let cancelled = false

    const ctx = gsap.context(() => {
      const run = () => {
        if (cancelled) return
        const split = new SplitText(el, { type: "lines", mask: "lines" })
        gsap.from(split.lines, {
          yPercent: 118,
          duration: 1.05,
          ease: "power4.out",
          stagger,
          delay,
          ...(onMount
            ? {}
            : { scrollTrigger: { trigger: el, start, once: true } }),
        })
      }
      // split after webfonts settle so line boxes are measured correctly
      if (document.fonts?.status === "loaded") run()
      else document.fonts?.ready.then(run).catch(run)
    }, el)

    return () => { cancelled = true; ctx.revert() }
  }, [delay, stagger, onMount, start])

  return createElement(Tag, { ref, className, style }, children)
}

// ── GhostMarquee ─────────────────────────────────────────────────────────
export function GhostMarquee({
  text,
  height = "clamp(80px, 14vw, 180px)",
  fontSize = "clamp(52px, 8.5vw, 132px)",
}: {
  text: string
  height?: string
  fontSize?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const track = trackRef.current
    if (!root || !track || prefersReduced()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(track, { xPercent: -4 }, {
        xPercent: -26,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 0.8 },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  const copies = Array.from({ length: 4 })
  return (
    <div
      ref={rootRef}
      className="lp-marquee"
      aria-hidden
      style={{ height, display: "flex", alignItems: "center" }}
    >
      <div ref={trackRef} className="lp-marquee-track">
        {copies.map((_, i) => (
          <span key={i} className="punch punch--ghost" style={{ fontSize, lineHeight: 1 }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── CountUp ──────────────────────────────────────────────────────────────
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.8,
  className,
  style,
}: {
  to: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fmt = (v: number) =>
      `${prefix}${v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`

    if (prefersReduced()) { el.textContent = fmt(to); return }

    const state = { v: 0 }
    const ctx = gsap.context(() => {
      el.textContent = fmt(0)
      gsap.to(state, {
        v: to,
        duration,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => { el.textContent = fmt(state.v) },
        onComplete: () => { el.textContent = fmt(to) },
      })
    }, el)
    return () => ctx.revert()
  }, [to, decimals, prefix, suffix, duration])

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums", ...style }}
    >
      {prefix}0{suffix}
    </span>
  )
}
