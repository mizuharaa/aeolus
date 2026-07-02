"use client"
import { useMemo } from "react"
import { motion } from "framer-motion"
import { useSimulationStore } from "@/stores/simulation"
import { c, ff, r, sp, type } from "@/lib/design-tokens"
import { Eyebrow, Type } from "@/components/ds/primitives"

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00–23:00 UTC

// ─── Cascade severity → token color ───────────────────────────────────────
// Same vocabulary as the map markers and plan badges: rust = direct hit,
// amber = cascade (order 2 is a lighter step of the same amber), muted gray
// = cancelled (not operating), quiet neutral = nominal. Cancelled is never
// color-alone — the bar also renders dashed.
function getBarColor(status: string, cascadeOrder: number): { bg: string; border: string; dashed?: boolean } {
  if (status === "cancelled") {
    return { bg: "var(--ae-neutral-bg)", border: "var(--ae-line-strong)", dashed: true }
  }
  if (cascadeOrder === 0) {
    return { bg: c.cascadeDirect, border: c.cascadeDirect }      // rust — direct hit
  }
  if (cascadeOrder === 1) {
    return { bg: c.cascadeOrder1, border: c.cascadeOrder1 }      // amber
  }
  if (cascadeOrder === 2) {
    return { bg: c.cascadeOrder2, border: c.cascadeOrder2 }      // amber, soft step
  }
  return { bg: "var(--ae-surface-3)", border: c.borderStrong }   // nominal — quiet
}

function parseHourUTC(isoStr: string): number {
  if (!isoStr) return 8
  try {
    const d = new Date(isoStr)
    return d.getUTCHours() + d.getUTCMinutes() / 60
  } catch {
    return 8
  }
}

export function CascadeTimeline({
  selectedFlight,
  onFlightSelect,
}: {
  selectedFlight: string | null
  onFlightSelect: (id: string | null) => void
}) {
  const { flightStates, schedule } = useSimulationStore()

  const displayFlights = useMemo(() => {
    const withState = schedule.map((f) => ({
      ...f,
      state:
        flightStates[f.id] || {
          status: "scheduled",
          delay_minutes: 0,
          cascade_order: -1,
          p_delayed: 0,
        },
    }))
    const affected = withState
      .filter((f) => f.state.cascade_order >= 0)
      .sort((a, b) => a.state.cascade_order - b.state.cascade_order)
    const others = withState.filter((f) => f.state.cascade_order < 0).slice(0, 18)
    return [...affected, ...others].slice(0, 40)
  }, [flightStates, schedule])

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: c.canvas }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: sp.sm,
          padding: `${sp.sm}px ${sp.md}px`,
          background: c.canvas,
          borderBottom: `1px solid ${c.hairline}`,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 0, gap: sp.lg }}>
          <div>
            <div style={{ ...type("titleMd", c.ink), fontSize: 16 }}>Cascade Timeline</div>
            <div style={{ ...type("caption", c.muted), fontSize: 11, marginTop: 1 }}>18-hour window · UTC</div>
          </div>

          {/* Legend — same vocabulary as the map */}
          <div className="hidden md:flex flex-wrap items-center justify-end" style={{ gap: 16, fontSize: 11, color: c.body, fontFamily: ff.body, fontWeight: 500 }}>
            <LegendSwatch color={c.cascadeDirect}          label="Direct" />
            <LegendSwatch color={c.cascadeOrder1}          label="Cascade" />
            <LegendSwatch color="var(--ae-line-strong)"    label="Cancelled" />
            <LegendSwatch color="var(--ae-surface-3)"      label="On time" />
          </div>
        </div>
      </div>

      {/* Hour axis */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${c.hairline}`,
          flexShrink: 0,
          background: c.surfaceSoft,
        }}
      >
        <div
          style={{
            width: 112,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            padding: "8px 12px",
            borderRight: `1px solid ${c.hairline}`,
            background: c.surfaceSoft,
          }}
        >
          <Eyebrow color={c.muted}>Flight</Eyebrow>
        </div>
        <div style={{ flex: 1, display: "flex" }}>
          {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
            <div
              key={h}
              style={{
                flex: 1,
                fontSize: 11,
                fontFamily: ff.mono,
                fontWeight: 500,
                color: c.body,
                padding: "8px 0 8px 8px",
                borderLeft: `1px solid ${c.hairline}`,
                background: c.canvas,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {h < 24 ? `${String(h).padStart(2, "0")}:00` : `${h - 24}:00+1`}
            </div>
          ))}
        </div>
      </div>

      {/* Flight rows */}
      <div className="cascade-timeline-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
        {displayFlights.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 180,
              padding: "24px 32px",
              textAlign: "center",
              gap: 6,
            }}
          >
            <Type as="span" role="titleSm" color={c.ink}>No schedule rows yet</Type>
            <Type as="span" role="bodyMd" color={c.muted} style={{ maxWidth: 480 }}>
              Load the simulator or trigger a disruption — affected flights appear here with direct vs cascade coloring.
            </Type>
          </div>
        ) : (
          displayFlights.map((flight, rowIdx) => {
            const depHour = parseHourUTC(flight.scheduled_departure)
            const arrHour = parseHourUTC(flight.scheduled_arrival)
            const delayHr = (flight.state.delay_minutes || 0) / 60
            const newDep = depHour + delayHr
            const newArr = arrHour + delayHr
            const leftPct = Math.max(0, ((newDep - 6) / 18) * 100)
            const widthPct = Math.max(1.2, ((newArr - newDep) / 18) * 100)
            const isSelected = selectedFlight === flight.id
            const palette = getBarColor(flight.state.status, flight.state.cascade_order)
            const zebra = rowIdx % 2 === 0 ? c.canvas : c.surfaceSoft

            return (
              <div
                key={flight.id}
                onClick={() => onFlightSelect(isSelected ? null : flight.id)}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  borderBottom: `1px solid ${c.hairline}`,
                  cursor: "pointer",
                  minHeight: 46,
                  background: isSelected ? "var(--ae-teal-bg)" : zebra,
                  boxShadow: isSelected ? "inset 0 0 0 1px var(--ae-teal)" : undefined,
                }}
              >
                <div
                  style={{
                    width: 112,
                    flexShrink: 0,
                    padding: "8px 12px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    borderRight: `1px solid ${c.hairline}`,
                    background: zebra,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: ff.mono,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: c.ink,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {flight.id}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: ff.mono,
                      fontWeight: 500,
                      color: c.muted,
                      marginTop: 2,
                    }}
                  >
                    {flight.origin}→{flight.destination}
                  </span>
                </div>

                <div style={{ flex: 1, position: "relative", minHeight: 46, background: zebra }}>
                  {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
                    <div
                      key={h}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        borderLeft: `1px solid ${c.hairline}`,
                        pointerEvents: "none",
                        left: `${((h - 6) / 18) * 100}%`,
                      }}
                    />
                  ))}

                  {flight.state.delay_minutes > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        bottom: 8,
                        border: `1.5px dashed ${c.signaturePeach}`,
                        borderRadius: r.sm,
                        background: c.statusDelayed.bg,
                        left: `${Math.max(0, ((depHour - 6) / 18) * 100)}%`,
                        width: `${(delayHr / 18) * 100}%`,
                      }}
                    />
                  )}

                  <motion.div
                    style={{
                      position: "absolute",
                      top: 8,
                      bottom: 8,
                      borderRadius: r.sm,
                      background: palette.bg,
                      border: `1px ${palette.dashed ? "dashed" : "solid"} ${palette.border}`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      minWidth: 6,
                      boxShadow: isSelected ? `0 0 0 2px ${c.canvas}, 0 0 0 3.5px var(--ae-teal)` : undefined,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    title={`${flight.id} ${flight.origin}→${flight.destination}${
                      flight.state.delay_minutes > 0 ? ` (+${flight.state.delay_minutes}m)` : ""
                    }`}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <span
        style={{
          width: 24,
          height: 12,
          borderRadius: r.sm,
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  )
}
