"use client"
/**
 * LandingFooter — quiet close on whatever register the page ends on
 * (night, by default). Reads the stage tokens only.
 */

import Link from "next/link"
import type { Route } from "next"
import { AeolusMark } from "@/components/ds/logo"

export function LandingFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "56px clamp(20px, 4vw, 56px) 28px" }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, color: "var(--ink)" }}>
              <AeolusMark size={26} />
              <div>
                <div style={{ fontFamily: "var(--ae-font-display)", fontWeight: 650, fontSize: 15, letterSpacing: "-0.01em" }}>
                  Aeolus
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Open-source OCC reference</div>
              </div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 380, color: "var(--muted)", margin: 0 }}>
              Built with FastAPI · Next.js · OR-Tools · GSAP. Open data — DOT
              BTS, FAA NAS, NWS NOAA. No proprietary lock-in.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="lp-eyebrow">Product</span>
            {[
              { href: "/simulator", label: "Simulator" },
              { href: "/simulator/plans", label: "Recovery plans" },
              { href: "/simulator/carbon", label: "Carbon dashboard" },
              { href: "/simulator/stress-test", label: "Stress test" },
            ].map((l) => (
              <Link key={l.href} href={l.href as Route} style={{ fontSize: 13, color: "var(--ink)", textDecoration: "none", opacity: 0.85 }}>
                {l.label}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="lp-eyebrow">Reference</span>
            <Link href="/scenarios" style={{ fontSize: 13, color: "var(--ink)", textDecoration: "none", opacity: 0.85 }}>
              Scenarios
            </Link>
            <Link href="/docs" style={{ fontSize: 13, color: "var(--ink)", textDecoration: "none", opacity: 0.85 }}>
              Methodology
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="lp-eyebrow">Legal</span>
            {[
              { href: "/privacy", label: "Privacy" },
              { href: "/cookies", label: "Cookies" },
              { href: "/terms", label: "Terms" },
            ].map((l) => (
              <Link key={l.href} href={l.href as Route} style={{ fontSize: 13, color: "var(--ink)", textDecoration: "none", opacity: 0.85 }}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            paddingTop: 22,
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--muted)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span>Aeolus is a research artifact. Not a substitute for production OCC software.</span>
          <span style={{ fontFamily: "var(--ae-font-mono)" }}>v0.5.0 · Apache 2.0</span>
        </div>
      </div>
    </footer>
  )
}
