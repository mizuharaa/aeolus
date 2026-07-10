"use client"
/**
 * SimulatorPageShell — the wrapper used by every secondary simulator route
 * (plans, cascade, crew, passengers, carbon, stress-test).
 *
 * Renders the sticky `SimulatorNav` plus a constrained content area on the
 * Airtable editorial canvas. Pages provide their own breadcrumb / title row
 * so each surface keeps a clear identity inside the consistent shell.
 */
import { useEffect } from "react"
import Link from "next/link"
import type { Route } from "next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSimulationStore, type ScheduledFlight, type FleetAircraft } from "@/stores/simulation"
import { useWebSocket } from "@/lib/websocket"
import { SimulatorNav } from "@/components/simulator/nav"
import { apiClient } from "@/lib/api"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { Type, Container } from "@/components/ds/primitives"

export function SimulatorPageShell({
  breadcrumbs = [],
  title,
  subtitle,
  actions,
  children,
  maxWidth = 1280,
}: {
  breadcrumbs?: { label: string; href?: string }[]
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  maxWidth?: number
}) {
  const { flightStates, setSchedule, setFleet } = useSimulationStore()
  const { isConnected } = useWebSocket()

  const stateValues = Object.values(flightStates)
  const affectedCount = stateValues.filter((f) => f.cascade_order >= 0).length

  // Hydrate schedule + fleet so the shared nav badges render correctly when a
  // user lands directly on /simulator/* via a deep link (without first visiting
  // the main simulator page).
  useEffect(() => {
    apiClient
      .get<{ flights?: ScheduledFlight[] } | ScheduledFlight[]>("/simulator/schedule")
      .then((res) => {
        const d = res.data
        const list = Array.isArray(d) ? d : d?.flights
        setSchedule(list ?? [])
      })
      .catch(() => {})
    apiClient
      .get<{ aircraft?: FleetAircraft[] }>("/network/aircraft")
      .then((res) => setFleet(res.data?.aircraft ?? []))
      .catch(() => {})
  }, [setSchedule, setFleet])

  return (
    <div style={{ background: "var(--ae-bg)", minHeight: "100vh", fontFamily: ff.body }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <SimulatorNav isConnected={isConnected} affectedCount={affectedCount} />
      </div>

      {/* ── Page header band — breadcrumbs + title + actions ─────────── */}
      <div
        style={{
          background: "var(--ae-bg)",
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        <Container maxWidth={maxWidth} style={{ paddingTop: sp.lg, paddingBottom: sp.lg }}>
          {breadcrumbs.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: sp.xs,
                fontSize: 12,
                color: c.muted,
              }}
            >
              {breadcrumbs.map((b, i) => (
                <span key={`${b.label}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {b.href ? (
                    <Link
                      href={b.href as Route}
                      style={{ color: c.muted, textDecoration: "none" }}
                    >
                      {b.label}
                    </Link>
                  ) : (
                    <span style={{ color: c.body }}>{b.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <ChevronRight style={{ width: 12, height: 12, color: c.borderStrong }} />
                  )}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: sp.md,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <Type as="h1" role="displayMd" color={c.ink} style={{ marginBottom: subtitle ? 6 : 0 }}>
                {title}
              </Type>
              {subtitle && (
                <Type as="p" role="bodyMd" color={c.muted} style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 720 }}>
                  {subtitle}
                </Type>
              )}
            </div>
            {actions && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {actions}
              </div>
            )}
          </div>
        </Container>
      </div>

      {/* ── Content area ────────────────────────────────────────────── */}
      <div style={{ background: "var(--ae-bg)", minHeight: "calc(100vh - 60px)" }}>
        <Container maxWidth={maxWidth} style={{ paddingTop: sp.lg, paddingBottom: sp.xxl }}>
          {children}
        </Container>
      </div>
    </div>
  )
}

/** Small "Back to simulator" link, often pinned next to the breadcrumbs. */
export function BackToSimulator() {
  return (
    <Link
      href="/simulator"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: c.body,
        textDecoration: "none",
        padding: "6px 10px",
        borderRadius: r.sm,
        background: c.surfaceSoft,
        border: `1px solid ${c.hairline}`,
      }}
    >
      <ChevronLeft style={{ width: 14, height: 14 }} /> Simulator
    </Link>
  )
}

/** Empty-state used by every secondary route when the user lands here without
 *  first triggering a disruption. Cream callout, semantic eyebrow. */
export function NoActiveDisruptionState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      className="ae-maestro-card"
      style={{
        padding: sp.xxl,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span className="ae-punch">Awaiting Disruption</span>
      <Type as="h2" role="titleLg" color={c.ink}>
        {title}
      </Type>
      <Type as="p" role="bodyMd" color={c.body} style={{ maxWidth: 560, lineHeight: 1.55 }}>
        {description}
      </Type>
      <Link
        href="/simulator"
        style={{
          marginTop: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: c.ink,
          textDecoration: "none",
          padding: "8px 14px",
          borderRadius: r.lg,
          background: c.canvas,
          border: `1px solid ${c.hairline}`,
        }}
      >
        Trigger an event in the simulator
        <ChevronRight style={{ width: 14, height: 14 }} />
      </Link>
    </div>
  )
}
