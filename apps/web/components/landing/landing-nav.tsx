"use client"
/**
 * LandingNav — fixed editorial nav. Transparent over the opening wordmark,
 * inks in as you leave it; every color reads the stage tokens so the nav
 * re-inks itself automatically as GSAP walks the page through its registers.
 * On desktop the links show inline; below 820px they collapse into a sheet
 * toggled by a hamburger. The brand mark gets a subtle 3D tilt on hover.
 *
 * Rendering constraint (Chromium): inside this fixed layer, var()-based
 * colors must come from CSS CLASSES (.lp-nav, .lp-nav-link, .lp-btn--ink),
 * never inline styles — inline var() references are not re-resolved when the
 * stage variables retint. The bar fill is a child span whose backgroundColor
 * scroll-experience tweens as a literal value.
 */

import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, Menu, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const LINKS = [
  { href: "/scenarios", label: "Scenarios" },
  { href: "/docs", label: "Methodology" },
  { href: "/simulator", label: "Simulator" },
] as const

export function LandingNav() {
  const navRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    // Scroll-linked morph: the bar pans + fades in progressively as the opening
    // wordmark leaves, rather than snapping on at a threshold. Written straight
    // to style in a rAF so it's buttery at any scroll speed / FPS.
    let ticking = false
    const apply = () => {
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (window.scrollY - vh * 0.22) / (vh * 0.24)))
      const eased = p * p * (3 - 2 * p) // smoothstep
      nav.style.opacity = String(eased)
      nav.style.transform = `translateY(${(1 - eased) * -14}px)`
      nav.style.pointerEvents = eased > 0.5 ? "auto" : "none"
      ticking = false
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply) } }
    apply()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // close the mobile sheet on resize up to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 820) setMenuOpen(false) }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <nav
      ref={navRef}
      className="lp-nav"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 62,
        padding: "0 clamp(20px, 4vw, 40px)",
        opacity: 0,
        pointerEvents: "none",
        transform: "translateY(-14px)",
        willChange: "opacity, transform",
      }}
    >
      {/* Bar fill — GSAP tweens this backgroundColor per stage register. */}
      <span
        className="lp-nav-fill"
        aria-hidden
        style={{ position: "absolute", inset: 0, zIndex: -1, background: "rgba(237, 230, 214, 0.94)" }}
      />

      {/* wordmark logo — the hero statement text IS the brand now */}
      <Link href="/" aria-label="Aeolus home" className="lp-nav-link lp-nav-brand" style={{ display: "flex", alignItems: "center" }}>
        <span className="lp-nav-mark lp-nav-wordmark" style={{ display: "inline-flex", transformStyle: "preserve-3d" }}>
          AEOLUS
        </span>
      </Link>

      {/* desktop links */}
      <div className="lp-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href as Route}
            className="lp-nav-link lp-nav-inline-link"
            style={{ padding: "8px 14px", fontSize: 13.5, fontWeight: 550, opacity: 0.82 }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          href="/simulator"
          className="lp-btn lp-btn--ink lp-nav-cta"
          style={{ padding: "9px 18px", fontSize: 13.5 }}
        >
          Launch simulator
          <ArrowRight style={{ width: 14, height: 14 }} strokeWidth={2.25} />
        </Link>

        {/* mobile hamburger */}
        <button
          type="button"
          className="lp-nav-burger lp-nav-link"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: "none",
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          {menuOpen ? <X style={{ width: 18, height: 18 }} strokeWidth={2} /> : <Menu style={{ width: 18, height: 18 }} strokeWidth={2} />}
        </button>
      </div>

      {/* mobile sheet */}
      {menuOpen && (
        <div
          className="lp-nav-sheet"
          style={{
            position: "absolute",
            top: 62,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            padding: "10px 16px 18px",
            borderBottom: "1px solid var(--border)",
            background: "var(--panel)",
          }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href as Route}
              className="lp-nav-link"
              onClick={() => setMenuOpen(false)}
              style={{ padding: "13px 6px", fontSize: 16, fontWeight: 600, borderBottom: "1px solid var(--border)" }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/simulator"
            className="lp-btn lp-btn--ink"
            onClick={() => setMenuOpen(false)}
            style={{ marginTop: 14, justifyContent: "center", padding: "12px 18px" }}
          >
            Launch simulator
            <ArrowRight style={{ width: 15, height: 15 }} strokeWidth={2.25} />
          </Link>
        </div>
      )}

    </nav>
  )
}
