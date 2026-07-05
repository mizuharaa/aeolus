"use client"
/**
 * CookieConsent — a GDPR/ePrivacy-style consent banner shown until the visitor
 * makes a choice. Aeolus sets only first-party functional storage (theme, map
 * focus, rail collapse, and this consent record) — no third-party ad/analytics
 * cookies — so the banner offers Accept / Reject / details, records the choice
 * in localStorage, and never blocks the page. Mounted once in the root layout.
 *
 * The choice is stored under `aeolus-cookie-consent` as "all" | "essential".
 * Reject still keeps essential functional storage (needed for the app to work)
 * but signals that no optional analytics should ever be initialised.
 */

import Link from "next/link"
import { useEffect, useState } from "react"

const KEY = "aeolus-cookie-consent"

export function CookieConsent() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true)
    } catch {
      // storage blocked — show the banner but choices simply won't persist
      setOpen(true)
    }
  }, [])

  const choose = (value: "all" | "essential") => {
    try {
      localStorage.setItem(KEY, value)
      localStorage.setItem(`${KEY}-at`, new Date().toISOString())
    } catch {}
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "clamp(12px, 3vw, 24px)",
        bottom: "clamp(12px, 3vw, 24px)",
        zIndex: 9000,
        width: "min(420px, calc(100vw - 24px))",
        background: "#14100F",
        color: "#F2ECE1",
        border: "1px solid rgba(242, 236, 225, 0.16)",
        borderRadius: 16,
        boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)",
        padding: "18px 18px 16px",
        fontFamily: 'Inter, "Inter Display", system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: "-0.01em", marginBottom: 8 }}>
        Cookies & local storage
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "rgba(242, 236, 225, 0.72)" }}>
        Aeolus uses only first-party functional storage to remember your
        preferences (theme, map focus, layout). We don&apos;t run third-party
        advertising or cross-site tracking. See our{" "}
        <Link href="/cookies" style={{ color: "#EFAF1B", textDecoration: "underline" }}>
          Cookie Policy
        </Link>{" "}
        and{" "}
        <Link href="/privacy" style={{ color: "#EFAF1B", textDecoration: "underline" }}>
          Privacy Policy
        </Link>
        .
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => choose("all")}
          style={{
            flex: "1 1 auto",
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            background: "#EFAF1B",
            color: "#14100F",
            fontSize: 13,
            fontWeight: 650,
            cursor: "pointer",
          }}
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={() => choose("essential")}
          style={{
            flex: "1 1 auto",
            padding: "10px 16px",
            borderRadius: 999,
            border: "1px solid rgba(242, 236, 225, 0.28)",
            background: "transparent",
            color: "#F2ECE1",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Essential only
        </button>
      </div>
    </div>
  )
}
