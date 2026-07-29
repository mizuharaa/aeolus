"use client"
/**
 * GSAP text effects for the landing.
 *
 *  SplitReveal   — editorial headline reveal: SplitText line masks, lines
 *                  slide up out of overflow wells when scrolled into view.
 *  TickerNumber  — a numeral that counts to its value once in view.
 *
 * Both collapse to static rendering under prefers-reduced-motion, and both
 * wait for document.fonts so SplitText never measures fallback metrics.
 */

import { createElement, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { gsap, ScrollTrigger, SplitText } from "@/components/landing/gsap"

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function SplitReveal({
  children,
  as = "div",
  className,
  style,
  delay = 0,
  stagger = 0.09,
  start = "top 85%",
}: {
  children: ReactNode
  as?: keyof HTMLElementTagNameMap
  className?: string
  style?: CSSProperties
  delay?: number
  stagger?: number
  start?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReduced()) return

    let split: SplitText | undefined
    const ctx = gsap.context(() => {
      gsap.set(el, { autoAlpha: 0 })
      document.fonts.ready.then(() => {
        if (!ref.current) return
        split = new SplitText(el, { type: "lines", mask: "lines", linesClass: "lp-line" })
        gsap.set(el, { autoAlpha: 1 })
        gsap.from(split.lines, {
          yPercent: 115,
          duration: 1.0,
          ease: "power4.out",
          stagger,
          delay,
          scrollTrigger: { trigger: el, start, once: true },
        })
      })
    }, el)

    return () => {
      split?.revert()
      ctx.revert()
    }
  }, [delay, stagger, start])

  // createElement instead of JSX: `as` is a runtime tag name and TS can't
  // reconcile the polymorphic ref through JSX generics.
  return createElement(as, { ref, className, style }, children)
}

export function TickerNumber({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
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

  const fmt = (v: number) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReduced()) {
      el.textContent = fmt(to)
      return
    }
    const proxy = { v: 0 }
    const ctx = gsap.context(() => {
      gsap.to(proxy, {
        v: to,
        duration,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
        onUpdate: () => {
          el.textContent = fmt(proxy.v)
        },
      })
    })
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, decimals, prefix, suffix, duration])

  return (
    <span ref={ref} className={className} style={style}>
      {fmt(0)}
    </span>
  )
}

/**
 * HighlightSwipe — a marker band that pans left→right behind the wrapped
 * phrase, SCRUBBED to scroll: it draws as the phrase enters and retracts as
 * the user scrolls back up. It stops at ~80% coverage so the tail of the
 * word stays bare, reading like a hand-drawn marker rather than a fill.
 */
export function HighlightSwipe({
  children,
  color = "var(--accent-amber)",
  height = "42%",
  coverage = 0.8,
  style,
}: {
  children: ReactNode
  color?: string
  height?: string
  /** final horizontal extent, 0..1 — 0.8 leaves the last ~20% uncovered */
  coverage?: number
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const band = el.querySelector<HTMLElement>(".hl-band")
    if (!band) return
    if (prefersReduced()) {
      band.style.transform = `scaleX(${coverage})`
      return
    }
    const ctx = gsap.context(() => {
      // scrub: scaleX tracks scroll position both ways, so scrolling back up
      // retracts the marker instead of leaving it filled.
      gsap.fromTo(
        band,
        { scaleX: 0 },
        {
          scaleX: coverage,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            end: "top 46%",
            scrub: 0.6,
          },
        },
      )
    }, el)
    return () => ctx.revert()
  }, [coverage])

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block", ...style }}>
      <span
        className="hl-band"
        aria-hidden
        style={{
          // extra right inset catches the slant overhang of italic glyphs so
          // the marker reaches past the final letter rather than stopping short
          position: "absolute",
          left: "-1.5%",
          right: "-4%",
          bottom: "6%",
          height,
          background: color,
          borderRadius: 6,
          transform: "scaleX(0)",
          transformOrigin: "0 50%",
          zIndex: 0,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  )
}

export { ScrollTrigger }
