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
  end = "top 46%",
  mode = "once",
}: {
  children: ReactNode
  as?: keyof HTMLElementTagNameMap
  className?: string
  style?: CSSProperties
  delay?: number
  stagger?: number
  start?: string
  end?: string
  mode?: "once" | "reversible" | "scrub"
}) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReduced()) return

    let split: SplitText | undefined
    let disposed = false
    const ctx = gsap.context(() => {
      gsap.set(el, { autoAlpha: 0 })
      document.fonts.ready.then(() => {
        if (!ref.current || disposed) return
        ctx.add(() => {
          split = new SplitText(el, { type: "lines", mask: "lines", linesClass: "lp-line" })
          gsap.set(el, { autoAlpha: 1 })

          if (mode === "scrub") {
            gsap.fromTo(
              split.lines,
              { yPercent: 115 },
              {
                yPercent: 0,
                ease: "none",
                stagger,
                scrollTrigger: { trigger: el, start, end, scrub: 0.65 },
              },
            )
            return
          }

          gsap.from(split.lines, {
            yPercent: 115,
            duration: 1.0,
            ease: "power4.out",
            stagger,
            delay,
            scrollTrigger:
              mode === "reversible"
                ? { trigger: el, start, toggleActions: "play none none reverse" }
                : { trigger: el, start, once: true },
          })
        })
      })
    }, el)

    return () => {
      disposed = true
      split?.revert()
      ctx.revert()
    }
  }, [delay, end, mode, stagger, start])

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
 * HighlightSwipe — an inverted amber block whose mask wipes left→right while
 * the words remain still. It is sampled from scroll in both directions, so
 * reversing past the reveal closes the same mask without replay state.
 */
export function HighlightSwipe({
  children,
  color = "var(--flight-amber, var(--accent-amber))",
  height = "100%",
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
      band.style.clipPath = `inset(0 ${(1 - coverage) * 100}% 0 0)`
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        band,
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: `inset(0 ${(1 - coverage) * 100}% 0 0)`,
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
    <span
      ref={ref}
      className="hl-swipe"
      style={{
        position: "relative",
        display: "inline-block",
        isolation: "isolate",
        marginInline: "-0.08em",
        paddingInline: "0.08em",
        letterSpacing: "-0.02em",
        ...style,
      }}
    >
      <span
        className="hl-band"
        aria-hidden
        style={{
          position: "absolute",
          insetInline: 0,
          top: "3%",
          height,
          background: color,
          borderRadius: "0.06em",
          clipPath: "inset(0 100% 0 0)",
          zIndex: 0,
        }}
      />
      <span
        className="hl-copy"
        style={{
          position: "relative",
          zIndex: 1,
          color: "var(--color-accent-ink, oklch(13.9% 0.0227 298.19))",
        }}
      >
        {children}
      </span>
    </span>
  )
}

export { ScrollTrigger }
