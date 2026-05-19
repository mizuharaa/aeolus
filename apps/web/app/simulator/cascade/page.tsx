"use client"
import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronRight, Search } from "lucide-react"
import { CascadeTimeline } from "@/components/simulator/cascade-timeline"
import { useSimulationStore, useHasActiveDisruption } from "@/stores/simulation"
import { airportLabel } from "@/lib/labels"
import { c, ff, r, sp, type as typeStyle } from "@/lib/design-tokens"
import { ContentCard, Eyebrow, Type, StatusBadge } from "@/components/ds/primitives"
import { SimulatorPageShell, NoActiveDisruptionState } from "@/components/simulator/page-shell"

/**
 * Cascade index — Slice 3.
 *
 * Lifts the docked timeline into a dedicated full-screen route and adds a
 * filterable affected-flight list. From here the user can click any flight
 * to drill down into its rotation lineage.
 */
export default function CascadeIndexPage() {
  const { flightStates, schedule, cascadeSummary } = useSimulationStore()
  const hasDisruption = useHasActiveDisruption()
  const [filter, setFilter] = useState("")
  const [orderFilter, setOrderFilter] = useState<-1 | 0 | 1 | 2>(-1)

  const affected = schedule
    .map((f) => ({
      ...f,
      state: flightStates[f.id] || { cascade_order: -1, delay_minutes: 0, status: "scheduled", p_delayed: 0, flight_id: f.id },
    }))
    .filter((f) => f.state.cascade_order >= 0)
    .filter((f) => orderFilter === -1 || f.state.cascade_order === orderFilter)
    .filter((f) => {
      if (!filter.trim()) return true
      const q = filter.trim().toLowerCase()
      return (
        f.id.toLowerCase().includes(q) ||
        f.origin.toLowerCase().includes(q) ||
        f.destination.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const ao = a.state.cascade_order
      const bo = b.state.cascade_order
      if (ao !== bo) return ao - bo
      return (b.state.delay_minutes || 0) - (a.state.delay_minutes || 0)
    })

  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Cascade" },
      ]}
      title="Cascade analysis"
      subtitle={
        cascadeSummary
          ? `${cascadeSummary.directly_affected} direct hits · ${cascadeSummary.cascade_1} order-1 · ${cascadeSummary.cascade_2} order-2 · ${cascadeSummary.total_affected} total affected`
          : "Rotation-based propagation across the whole fleet. Click any flight to inspect its lineage."
      }
    >
      {!hasDisruption && affected.length === 0 ? (
        <NoActiveDisruptionState
          title="No cascade in progress."
          description="When a disruption is triggered, every downstream rotation will appear here with its expected delay and order."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: sp.lg }}>

          {/* ── Hero timeline (full width) ── */}
          <ContentCard padding={0} style={{ overflow: "hidden", height: 280 }}>
            <CascadeTimeline selectedFlight={null} onFlightSelect={() => {}} />
          </ContentCard>

          {/* ── Filter bar + table ── */}
          <ContentCard padding={sp.md}>
            <div style={{ display: "flex", alignItems: "center", gap: sp.sm, flexWrap: "wrap", marginBottom: sp.sm }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: r.sm,
                  border: `1px solid ${c.hairline}`,
                  background: c.canvas,
                  flex: "1 1 240px",
                }}
              >
                <Search style={{ width: 14, height: 14, color: c.muted }} />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter NB123, ORD, ATL…"
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontFamily: ff.body,
                    fontSize: 13,
                    color: c.body,
                  }}
                />
              </div>
              <OrderFilter value={orderFilter} onChange={setOrderFilter} />
              <span style={{ fontSize: 12, color: c.muted, fontFamily: ff.mono }}>
                {affected.length} flight{affected.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Table */}
            <div style={{ borderTop: `1px solid ${c.hairline}` }}>
              {affected.slice(0, 100).map((f, idx) => (
                <CascadeRow key={f.id} flight={f} index={idx} />
              ))}
              {affected.length > 100 && (
                <div style={{ padding: 12, fontSize: 12, color: c.muted, fontFamily: ff.mono, textAlign: "center" }}>
                  + {affected.length - 100} more — narrow filters to surface them.
                </div>
              )}
            </div>
          </ContentCard>
        </div>
      )}
    </SimulatorPageShell>
  )
}

function OrderFilter({
  value, onChange,
}: {
  value: -1 | 0 | 1 | 2
  onChange: (v: -1 | 0 | 1 | 2) => void
}) {
  const opts: { v: -1 | 0 | 1 | 2; label: string; bg: string }[] = [
    { v: -1, label: "All",     bg: c.surfaceSoft },
    { v:  0, label: "Direct",  bg: c.statusCancelled.bg },
    { v:  1, label: "Order 1", bg: c.statusDelayed.bg },
    { v:  2, label: "Order 2", bg: c.surfaceSoft },
  ]
  return (
    <div style={{ display: "inline-flex", borderRadius: r.sm, border: `1px solid ${c.hairline}`, overflow: "hidden" }}>
      {opts.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              border: "none",
              fontSize: 12,
              fontWeight: 500,
              padding: "6px 10px",
              fontFamily: ff.body,
              background: active ? c.ink : c.canvas,
              color: active ? c.onPrimary : c.body,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function CascadeRow({ flight, index }: { flight: any; index: number }) {
  const { state } = flight
  const o = airportLabel(flight.origin)
  const d = airportLabel(flight.destination)
  const orderLabel = state.cascade_order === 0 ? "Direct" :
                     state.cascade_order === 1 ? "Order 1" :
                     state.cascade_order === 2 ? "Order 2" : "—"
  const orderBg = state.cascade_order === 0 ? c.cascadeDirect :
                  state.cascade_order === 1 ? c.cascadeOrder1 :
                  state.cascade_order === 2 ? c.cascadeOrder2 : c.cascadeNone
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(0.4, index * 0.01) }}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 2fr) 90px 100px 90px auto",
        gap: sp.sm,
        alignItems: "center",
        padding: "10px 8px",
        borderBottom: `1px solid ${c.hairline}`,
        fontFamily: ff.body,
      }}
    >
      <span style={{ fontFamily: ff.mono, fontSize: 13, fontWeight: 500, color: c.ink }}>
        {flight.id}
      </span>
      <span style={{ fontSize: 13, color: c.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: ff.mono }}>{o.iata || flight.origin}</span>
        {" \u2192 "}
        <span style={{ fontFamily: ff.mono }}>{d.iata || flight.destination}</span>
        {o.city && d.city && (
          <span style={{ marginLeft: 8, fontSize: 11, color: c.muted }}>{o.city}{" \u2192 "}{d.city}</span>
        )}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 500,
          padding: "3px 8px",
          borderRadius: r.pill,
          background: orderBg,
          color: state.cascade_order < 0 ? c.body : c.canvas,
          width: "fit-content",
        }}
      >
        {orderLabel}
      </span>
      <span style={{ fontFamily: ff.mono, fontSize: 13, color: state.delay_minutes > 0 ? c.statusDelayed.ink : c.muted, fontVariantNumeric: "tabular-nums" }}>
        {state.delay_minutes > 0 ? `+${state.delay_minutes}m` : "—"}
      </span>
      <span>
        <StatusBadge
          kind={state.status === "cancelled" ? "cancelled" : state.delay_minutes > 0 ? "delayed" : "on-time"}
          compact
        />
      </span>
      <Link
        href={`/simulator/cascade/${flight.id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: c.link,
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Lineage <ChevronRight style={{ width: 12, height: 12 }} />
      </Link>
    </motion.div>
  )
}
