"use client"
/**
 * Landing page — daylight sky, animation-first.
 *
 * Flow: full-screen logo curtain → sky hero (3D globe, planes, ripples) →
 * ghost marquee → pinned 3D recovery-loop story → count-up stats band →
 * capability panels → methodology ledger → solve-log CTA → footer.
 *
 * Motion stack: GSAP ScrollTrigger + SplitText for the scrubbed/punched
 * sequences, Framer Motion for entrances and chips, react-three-fiber for
 * the world. Accent semantics: pink = disruption, teal = recovery.
 */

import Link from "next/link"
import type { Route } from "next"
import { ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"
import { AeolusLogo } from "@/components/ds/logo"
import { c, ff } from "@/lib/design-tokens"
import { ButtonPrimary } from "@/components/ds/primitives"
import { CapabilitySections } from "@/components/landing/capability-sections"
import { LogoIntro } from "@/components/landing/intro"
import { SkyHero } from "@/components/landing/sky-hero"
import { RecoveryLoop } from "@/components/landing/recovery-loop"
import { CountUp, GhostMarquee, PunchReveal } from "@/components/landing/punch"
import { Rise, StaggerGroup, StaggerItem } from "@/components/landing/motion"

export default function LandingPage() {
  return (
    <main
      style={{
        background: "var(--ae-bg)",
        minHeight: "100vh",
        overflowX: "clip",
        fontFamily: ff.body,
        color: c.body,
      }}
    >
      <LandingNav />
      <LogoIntro />
      <SkyHero />
      <GhostMarquee text="Simulate · Predict · Solve · Commit ·" />
      <RecoveryLoop />
      <StatsBand />
      <CapabilitySections />
      <Methodology />
      <FinalCta />
      <LandingFooter />
    </main>
  )
}

// ─── Nav — hidden over the logo curtain, white over sky, glass on paper ──
function LandingNav() {
  const [visible, setVisible] = useState(false)
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight
      setVisible(window.scrollY > vh * 0.85)
      setSolid(window.scrollY > vh * 2.15)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const linkColor = solid ? c.body : "rgba(255,255,255,0.94)"

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
        padding: "0 40px",
        background: solid ? "rgba(255,255,255,0.82)" : "transparent",
        backdropFilter: solid ? "blur(14px)" : "none",
        WebkitBackdropFilter: solid ? "blur(14px)" : "none",
        borderBottom: `1px solid ${solid ? "var(--ae-line)" : "transparent"}`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? "translateY(0)" : "translateY(-10px)",
        transition: "opacity 320ms ease, transform 320ms ease, background 320ms ease, border-color 320ms ease",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <AeolusLogo size={30} />
        <span
          style={{
            fontFamily: ff.display, fontWeight: 600, fontSize: 17,
            color: solid ? c.ink : "#FFFFFF", letterSpacing: "-0.01em",
            transition: "color 320ms ease",
          }}
        >
          Aeolus
        </span>
      </Link>

      <div className="lp-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[
          { href: "/scenarios", label: "Scenarios" },
          { href: "/docs", label: "Methodology" },
          { href: "/simulator", label: "Simulator" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href as Route}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontFamily: ff.body,
              fontSize: 13.5,
              fontWeight: 500,
              color: linkColor,
              textDecoration: "none",
              transition: "color 320ms ease",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <Link href="/simulator" style={{ textDecoration: "none" }}>
        <button
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 999, cursor: "pointer",
            background: solid ? "var(--ae-primary)" : "#FFFFFF",
            color: solid ? "var(--ae-on-primary)" : "#0B2434",
            border: "none",
            fontFamily: ff.body, fontSize: 13.5, fontWeight: 600,
            boxShadow: solid ? "var(--ae-shadow-button)" : "0 8px 28px rgba(10,48,82,0.25)",
            transition: "background 320ms ease, color 320ms ease",
          }}
        >
          Launch simulator
          <ArrowRight style={{ width: 14, height: 14 }} />
        </button>
      </Link>
    </nav>
  )
}

// ─── Stats band — punched numerals count up on entry ─────────────────────
const STATS = [
  { value: 202, suffix: "", label: "flights simulated daily", decimals: 0 },
  { value: 8.4, suffix: " ms", label: "median recovery solve", decimals: 1 },
  { value: 4, suffix: "", label: "ranked plans per event", decimals: 0 },
  { value: 480, suffix: "", label: "connections saved per storm", decimals: 0 },
]

function StatsBand() {
  return (
    <section style={{ padding: "96px 40px", borderTop: `1px solid ${c.hairline}` }}>
      <div
        style={{
          maxWidth: 1480, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 32,
        }}
      >
        {STATS.map((s) => (
          <div key={s.label}>
            <CountUp
              to={s.value}
              decimals={s.decimals}
              suffix={s.suffix}
              className="punch punch--ink"
              style={{ fontSize: "clamp(48px, 5.4vw, 84px)", display: "block" }}
            />
            <span style={{ fontFamily: ff.body, fontSize: 13.5, color: c.muted, display: "block", marginTop: 8 }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Methodology — spec ledger, not a card grid ──────────────────────────
const METHODS = [
  {
    name: "Cascade model",
    desc: "Rotation-graph propagation built from the schedule itself — buffer-aware, no ML, no training data. Every forecast is reproducible from its inputs.",
    ref: "deterministic",
  },
  {
    name: "Recovery optimizer",
    desc: "OR-Tools CP-SAT over swaps, delays, cancellations and reroutes; four weighted objectives produce four differentiated plans.",
    ref: "<10 ms",
  },
  {
    name: "Cost engine",
    desc: "DOT BTS 2023 delay and cancellation rates, DOT compensation rules, EU-ETS carbon pricing — every dollar in a plan is decomposable.",
    ref: "BTS 2023",
  },
  {
    name: "Crew legality",
    desc: "FAR Part 117 flight-duty-period tables and cumulative limits, evaluated per plan; violations surface as flags before you commit.",
    ref: "Part 117",
  },
  {
    name: "Live context",
    desc: "FAA NAS status and NWS weather alerts stream in beside the synthetic network, so scenarios sit against real airspace conditions.",
    ref: "FAA · NWS",
  },
]

function Methodology() {
  return (
    <section style={{ padding: "96px 40px 128px", borderTop: `1px solid ${c.hairline}` }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ marginBottom: 40, maxWidth: 720 }}>
          <span style={{ fontFamily: ff.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: c.skyInk }}>
            Methodology
          </span>
          <PunchReveal
            as="h2"
            className="punch punch--ink"
            style={{ fontSize: "clamp(34px, 4vw, 56px)", textTransform: "none", margin: "14px 0 0" }}
          >
            Deterministic. Auditable. Open.
          </PunchReveal>
        </div>

        <StaggerGroup gap={0.06}>
          {METHODS.map((m) => (
            <StaggerItem key={m.name}>
              <div className="lp-ledger-row">
                <span style={{ fontFamily: ff.display, fontSize: 15.5, fontWeight: 600, color: c.ink, letterSpacing: "-0.008em" }}>
                  {m.name}
                </span>
                <span style={{ fontFamily: ff.body, fontSize: 13.5, lineHeight: 1.6, color: c.body }}>
                  {m.desc}
                </span>
                <span style={{ fontFamily: ff.mono, fontSize: 12, color: c.tealInk, whiteSpace: "nowrap" }}>
                  {m.ref}
                </span>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Rise delay={0.1}>
          <div style={{ borderTop: `1px solid ${c.hairline}`, paddingTop: 24 }}>
            <Link
              href="/docs"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: ff.body, fontSize: 14, fontWeight: 500, color: c.ink, textDecoration: "none" }}
            >
              Read the full methodology
              <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </Rise>
      </div>
    </section>
  )
}

// ─── Final CTA — copy beside a real solve transcript ─────────────────────
const LOG_LINES: { text: React.ReactNode; prompt?: boolean }[] = [
  {
    prompt: true,
    text: <>aeolus trigger --event weather_closure --airport KORD --severity 4</>,
  },
  { text: <><Dim>cascade&nbsp;&nbsp;&nbsp;</Dim>47 direct · 61 first-order · 39 second-order<Right>2.1 ms</Right></> },
  { text: <><Dim>solve&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Dim>plans A · B · C · D<Right>8.4 ms</Right></> },
  { text: <><Dim>ranked&nbsp;&nbsp;&nbsp;&nbsp;</Dim>B — minimize pax impact<Right>$2.4M · 0 flags</Right></> },
  { prompt: true, text: <>aeolus apply B</> },
  { text: <><Dim>committed&nbsp;</Dim>118 actions · network recovering<Right>14:33Z</Right></> },
]

function Dim({ children }: { children: React.ReactNode }) {
  return <span style={{ color: c.muted }}>{children}</span>
}
function Right({ children }: { children: React.ReactNode }) {
  return <span style={{ float: "right", color: c.muted }}>{children}</span>
}

function FinalCta() {
  return (
    <section style={{ padding: "0 40px 128px" }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div
          className="sky-gradient--deep"
          style={{
            border: `1px solid ${c.hairline}`,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(11,36,52,0.18)",
          }}
        >
          <div className="lp-split" style={{ gap: 0, alignItems: "stretch" }}>
            <div style={{ padding: "clamp(32px, 4vw, 64px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
              <PunchReveal
                as="h2"
                className="punch punch--white"
                style={{ fontSize: "clamp(34px, 3.8vw, 54px)", textTransform: "none" }}
              >
                Trigger your first storm.
              </PunchReveal>
              <Rise delay={0.08}>
                <p style={{ fontFamily: ff.body, fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.94)", margin: 0, maxWidth: 440 }}>
                  No setup, no account. Pick an event, watch the cascade cross
                  the network, and compare four recovery plans with full cost,
                  crew, and carbon detail.
                </p>
              </Rise>
              <Rise delay={0.16}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link href="/simulator" style={{ textDecoration: "none" }}>
                    <button
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "13px 26px", borderRadius: 999, border: "none", cursor: "pointer",
                        background: "#FFFFFF", color: "#0B2434",
                        fontFamily: ff.body, fontSize: 14.5, fontWeight: 600,
                        boxShadow: "0 10px 36px rgba(10,48,82,0.28)",
                      }}
                    >
                      Open the simulator
                      <ArrowRight style={{ width: 15, height: 15 }} />
                    </button>
                  </Link>
                  <Link href="/scenarios" style={{ textDecoration: "none" }}>
                    <button
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "13px 26px", borderRadius: 999, cursor: "pointer",
                        background: "rgba(255,255,255,0.14)", color: "#FFFFFF",
                        border: "1px solid rgba(255,255,255,0.55)",
                        fontFamily: ff.body, fontSize: 14.5, fontWeight: 550,
                      }}
                    >
                      Browse scenarios
                    </button>
                  </Link>
                </div>
              </Rise>
            </div>

            {/* solve transcript */}
            <div
              style={{
                background: "rgba(9, 38, 62, 0.55)",
                backdropFilter: "blur(6px)",
                borderLeft: "1px solid rgba(255,255,255,0.14)",
                padding: "clamp(28px, 3.4vw, 56px)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <StaggerGroup gap={0.14} style={{ fontFamily: ff.mono, fontSize: 12.5, lineHeight: 2.1, color: "#EAF4FC" }}>
                {LOG_LINES.map((l, i) => (
                  <StaggerItem key={i}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {l.prompt ? (
                        <>
                          <span style={{ color: "#5EEAD4" }}>$ </span>
                          <span style={{ color: "#FFFFFF" }}>{l.text}</span>
                        </>
                      ) : (
                        <span style={{ color: "rgba(234,244,252,0.85)", display: "block" }}>&nbsp;&nbsp;{l.text}</span>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${c.hairline}`, color: c.muted, padding: "64px 40px 32px" }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AeolusLogo size={30} />
              <div>
                <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 15, color: c.ink, letterSpacing: "-0.01em" }}>
                  Aeolus
                </div>
                <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>Open-source OCC reference</div>
              </div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 380, color: c.muted }}>
              Built with FastAPI · Next.js · OR-Tools · three.js · GSAP. Open
              data — DOT BTS, FAA NAS, NWS NOAA. No proprietary lock-in.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: ff.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: c.muted }}>
              Product
            </span>
            {[
              { href: "/simulator", label: "Simulator" },
              { href: "/simulator/plans", label: "Recovery plans" },
              { href: "/simulator/carbon", label: "Carbon dashboard" },
              { href: "/simulator/stress-test", label: "Stress test" },
            ].map((l) => (
              <Link key={l.href} href={l.href as Route} style={{ fontSize: 13, color: c.body, textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: ff.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: c.muted }}>
              Reference
            </span>
            <Link href="/scenarios" style={{ fontSize: 13, color: c.body, textDecoration: "none" }}>Scenarios</Link>
            <Link href="/docs" style={{ fontSize: 13, color: c.body, textDecoration: "none" }}>Methodology</Link>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: `1px solid ${c.hairline}`,
            fontSize: 12,
            color: c.muted,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span>Aeolus is a research artifact. Not a substitute for production OCC software.</span>
          <span style={{ fontFamily: ff.mono }}>v0.4.0 · Apache 2.0</span>
        </div>
      </div>
    </footer>
  )
}
