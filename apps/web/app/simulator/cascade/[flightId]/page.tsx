"use client"
import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowDown, Plane, Clock, X, AlertTriangle } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { airportLabel, aircraftLabel } from "@/lib/labels"
import { c, ff, r, sp, type as typeStyle } from "@/lib/design-tokens"
import { ContentCard, Eyebrow, Type, StatusBadge } from "@/components/ds/primitives"
import { SimulatorPageShell, NoActiveDisruptionState } from "@/components/simulator/page-shell"

/**
 * Cascade drill-down — Slice 3.
 *
 * Given a flight id, render its rotation lineage: every preceding leg flown
 * by the same tail today, plus every downstream leg whose state has been
 * propagated by the cascade predictor. This is the "why was my flight late?"
 * surface that the right-rail rotation card always promised.
 */
export default function CascadeDrillDownPage() {
  const params = useParams()
  const fid = ((params?.flightId as string | undefined) ?? "").toUpperCase()
  const { schedule, flightStates, fleet } = useSimulationStore()

  const target = useMemo(() => schedule.find((f) => f.id === fid), [schedule, fid])
  const targetState = target ? flightStates[target.id] : null

  const lineage = useMemo(() => {
    if (!target || !target.aircraft_id) return [] as Array<{ flight: any; state: any; isTarget: boolean }>
    const sameTail = schedule
      .filter((f) => f.aircraft_id === target.aircraft_id)
      .sort((a, b) => a.scheduled_departure.localeCompare(b.scheduled_departure))
    return sameTail.map((f) => ({
      flight: f,
      state: flightStates[f.id] || { status: "scheduled", delay_minutes: 0, cascade_order: -1, p_delayed: 0, flight_id: f.id },
      isTarget: f.id === target.id,
    }))
  }, [target, schedule, flightStates])

  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Cascade", href: "/simulator/cascade" },
        { label: fid },
      ]}
      title={`Lineage \u2014 ${fid}`}
      subtitle={
        target
          ? `Rotation chain for ${aircraftLabel(target.aircraft_id || "", fleet).tail || target.aircraft_id || "tail"} on ${target.scheduled_departure?.split("T")[0] || ""}`
          : "Flight not in current schedule."
      }
    >
      {!target ? (
        <NoActiveDisruptionState
          title={`No flight ${fid} in current schedule.`}
          description="The flight may have been removed by a recovery plan or is not part of the active disruption window."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: sp.lg }}>
          {/* Target summary */}
          <ContentCard padding={sp.lg}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: sp.md }}>
              <Stat label="Status" value={
                <StatusBadge
                  kind={targetState?.status === "cancelled" ? "cancelled" :
                        (targetState?.delay_minutes ?? 0) > 0 ? "delayed" : "on-time"}
                />
              } />
              <Stat label="Delay" value={
                <span style={{ fontFamily: ff.mono, fontSize: 22, color: (targetState?.delay_minutes ?? 0) > 0 ? c.statusDelayed.ink : c.muted, fontVariantNumeric: "tabular-nums" }}>
                  {(targetState?.delay_minutes ?? 0) > 0 ? `+${targetState!.delay_minutes}m` : "—"}
                </span>
              } />
              <Stat label="Cascade order" value={
                <span style={{ fontFamily: ff.mono, fontSize: 22, color: c.ink }}>
                  {targetState?.cascade_order === 0 ? "Direct" :
                   targetState?.cascade_order === 1 ? "Order 1" :
                   targetState?.cascade_order === 2 ? "Order 2" : "—"}
                </span>
              } />
              <Stat label="Aircraft" value={
                <span style={{ fontFamily: ff.mono, fontSize: 16, color: c.ink }}>
                  {aircraftLabel(target.aircraft_id || "", fleet).tail || target.aircraft_id || "—"}
                </span>
              } />
            </div>
            {targetState?.reason && (
              <div
                style={{
                  marginTop: sp.md,
                  padding: 12,
                  borderRadius: r.sm,
                  background: c.statusDelayed.bg,
                  color: c.statusDelayed.ink,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} />
                <span>{targetState.reason}</span>
              </div>
            )}
          </ContentCard>

          {/* Lineage chain */}
          <ContentCard padding={sp.lg}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sp.md }}>
              <Plane style={{ width: 16, height: 16, color: c.muted }} />
              <Type as="h2" role="titleSm" color={c.ink}>Rotation chain</Type>
            </div>
            <Type as="p" role="bodyMd" color={c.muted} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: sp.md }}>
              All segments flown by this tail in chronological order. Delay propagates downstream when an upstream leg overruns its turn buffer.
            </Type>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {lineage.length === 0 && (
                <div style={{ fontSize: 13, color: c.muted, fontStyle: "italic" }}>
                  Cannot determine rotation — no aircraft tail recorded for this flight.
                </div>
              )}
              {lineage.map((leg, i) => (
                <div key={leg.flight.id}>
                  <LineageRow leg={leg} />
                  {i < lineage.length - 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0", color: c.borderStrong }}>
                      <ArrowDown style={{ width: 14, height: 14 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ContentCard>
        </div>
      )}
    </SimulatorPageShell>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      <div>{value}</div>
    </div>
  )
}

function LineageRow({ leg }: { leg: { flight: any; state: any; isTarget: boolean } }) {
  const { flight, state, isTarget } = leg
  const o = airportLabel(flight.origin)
  const d = airportLabel(flight.destination)
  const isCancelled = state.status === "cancelled"
  const isDelayed = state.delay_minutes > 0 && !isCancelled

  const palette =
    isCancelled ? c.statusCancelled :
    isDelayed   ? c.statusDelayed :
                  c.statusOnTime

  const Icon = isCancelled ? X : isDelayed ? Clock : Plane

  return (
    <Link
      href={`/simulator/cascade/${flight.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1.2fr) minmax(0, 2fr) 100px 90px",
        gap: sp.sm,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: r.sm,
        border: `1px solid ${isTarget ? palette.dot : c.hairline}`,
        background: isTarget ? palette.bg : c.canvas,
        textDecoration: "none",
        color: c.body,
        fontFamily: ff.body,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: r.sm,
          background: palette.bg,
          color: palette.ink,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: 14, height: 14 }} />
      </span>
      <span style={{ fontFamily: ff.mono, fontSize: 13, fontWeight: 500, color: c.ink }}>
        {flight.id} {isTarget && <span style={{ fontSize: 10, color: c.muted, marginLeft: 4 }}>(this flight)</span>}
      </span>
      <span style={{ fontSize: 13, color: c.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: ff.mono }}>{o.iata || flight.origin}</span>
        {" \u2192 "}
        <span style={{ fontFamily: ff.mono }}>{d.iata || flight.destination}</span>
        {flight.scheduled_departure && (
          <span style={{ marginLeft: 8, fontSize: 11, color: c.muted, fontFamily: ff.mono }}>
            {flight.scheduled_departure.slice(11, 16)}Z
          </span>
        )}
      </span>
      <span style={{ fontFamily: ff.mono, fontSize: 12, color: palette.ink, fontVariantNumeric: "tabular-nums" }}>
        {isCancelled ? "Cancelled" : isDelayed ? `+${state.delay_minutes}m` : "On time"}
      </span>
      <span style={{ fontFamily: ff.mono, fontSize: 11, color: c.muted, fontVariantNumeric: "tabular-nums" }}>
        {state.cascade_order === 0 ? "Direct" :
         state.cascade_order === 1 ? "Order 1" :
         state.cascade_order === 2 ? "Order 2" : ""}
      </span>
    </Link>
  )
}
