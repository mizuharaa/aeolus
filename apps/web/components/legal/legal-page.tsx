import Link from "next/link"
import type { Route } from "next"
import type { ReactNode } from "react"
import { AeolusMark } from "@/components/ds/logo"

/**
 * LegalPage — shared shell for the privacy / terms / cookie documents. Warm
 * beige editorial surface matching the landing, a simple back link, a title
 * block with the effective date, and readable prose. Server component.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main
      className="lp"
      style={{ minHeight: "100vh", padding: "0 clamp(20px, 5vw, 56px) 96px" }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "26px 0 40px",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--ink)" }}>
            <AeolusMark size={26} />
            <span style={{ fontFamily: "var(--ae-font-display)", fontWeight: 650, fontSize: 16.5, letterSpacing: "-0.01em" }}>
              Aeolus
            </span>
          </Link>
          <Link href="/" className="lp-eyebrow" style={{ textDecoration: "none" }}>
            ← Back to home
          </Link>
        </header>

        <h1 className="ed-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginBottom: 12 }}>
          {title}
        </h1>
        <p className="lp-eyebrow" style={{ marginBottom: 44 }}>
          Last updated · {updated}
        </p>

        <div className="legal-prose">{children}</div>

        <footer style={{ marginTop: 64, paddingTop: 22, borderTop: "1px solid var(--border)", display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { href: "/privacy", label: "Privacy" },
            { href: "/cookies", label: "Cookies" },
            { href: "/terms", label: "Terms" },
          ].map((l) => (
            <Link key={l.href} href={l.href as Route} style={{ fontSize: 13, color: "var(--ink)", opacity: 0.8, textDecoration: "none" }}>
              {l.label}
            </Link>
          ))}
        </footer>
      </div>
    </main>
  )
}
