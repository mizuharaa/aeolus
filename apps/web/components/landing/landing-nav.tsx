"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useEffect, useRef } from "react"
import { landingScroll, registerLandingFrame } from "@/lib/scroll"

/**
 * N9 edge navigation: identity at the left edge, one quiet operational
 * descriptor in the open middle, and one decisive action at the right.
 */
export function LandingNav() {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const apply = () => {
      const progress = Math.min(
        1,
        Math.max(0, (landingScroll.scenes.flight - 0.08) / 0.12),
      )
      const eased = progress * progress * (3 - 2 * progress)
      nav.style.opacity = String(eased)
      nav.style.transform = `translateY(${(1 - eased) * -12}px)`
      nav.style.pointerEvents = eased > 0.5 ? "auto" : "none"
    }

    apply()
    return registerLandingFrame(apply)
  }, [])

  return (
    <nav
      ref={navRef}
      className="lp-nav"
      aria-label="Primary navigation"
      style={{
        position: "fixed",
        inset: "0 0 auto",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: 0,
        pointerEvents: "none",
        transform: "translateY(-12px)",
        willChange: "opacity, transform",
      }}
    >
      <span
        className="lp-nav-fill"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background: "rgba(237, 230, 214, 0.94)",
        }}
      />

      <Link
        href="/"
        aria-label="Aeolus home"
        className="lp-nav-link lp-nav-brand"
      >
        <span className="lp-nav-wordmark">AEOLUS</span>
      </Link>

      <span className="lp-nav-edge-meta" aria-hidden="true">
        Operations / recovery simulation
      </span>

      <Link href="/simulator" className="lp-btn lp-btn--ink lp-nav-cta">
        Launch simulator
        <ArrowRight aria-hidden="true" size={14} strokeWidth={2.25} />
      </Link>
    </nav>
  )
}
