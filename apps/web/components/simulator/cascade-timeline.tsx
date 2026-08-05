"use client"
import { useMemo } from "react"
import { motion } from "framer-motion"
import { useSimulationStore } from "@/stores/simulation"
import { c, cascade, ff, r, sp, type } from "@/lib/design-tokens"
import { Eyebrow, Type } from "@/components/ds/primitives"

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00–23:00 UTC

// ─── Cascade severity → shared ramp ───────────────────────────────────────
// Resolved from `cascade` in design-tokens, which the map imports too. The
// previous version of this function hardcoded its own steps under a comment
// claiming they were "the same vocabulary as the map markers" — they were
// not, and that mismatch is why the legend taught the wrong key.
function getBarColor(status: string, cascadeOrder: number): { bg: string; border: string; dashed?: boolean } {
  // Cancelled is never a hue (DESIGN.md) — neutral fill plus a dashed edge.
  if (status === "cancelled") {
    return { bg: cascade.cancelled.fill, border: cascade.cancelled.border, dashed: true }
  }
  if (cascadeOrder === 0) return { bg: cascade.direct.fill, border: cascade.direct.border }
  if (cascadeOrder === 1) return { bg: cascade.order1.fill, border: cascade.order1.border }
  if (cascadeOrder === 2) return { bg: cascade.order2.fill, border: cascade.order2.border }
  return { bg: cascade.none.fill, border: cascade.none.border } // nominal — quiet
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

  // Is anything actually disrupted? The back-fill above always supplies 18
  // nominal rows, so `displayFlights.length === 0` never fired and the nominal
  // network rendered as 18 identical grey bars — noise where a statement
  // belongs. This distinguishes "nothing wrong" from "no data".
  const affectedCount = useMemo(
    () => Object.values(flightStates).filter((f) => (f.cascade_order ?? -1) >= 0).length,
    [flightStates],
  )
  const nominal = affectedCount === 0 && schedule.length > 0

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: c.canvas }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: sp.sm,
          padding: `${sp.xs}px ${sp.md}px`,
          background: c.canvas,
          borderBottom: `1px solid ${c.hairline}`,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 0, gap: sp.lg }}>
          {/* One line, not two. This is the hero surface now, so its header
              spends as little height as possible — the two-line title block
              plus a 5-swatch legend cost 64px of a 192px dock, i.e. a third of
              the region, before a single flight row. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: sp.xs, minWidth: 0 }}>
            <span style={{ ...type("titleMd", c.ink), fontSize: 14.5, whiteSpace: "nowrap" }}>Cascade Timeline</span>
            <span style={{ ...type("caption", c.muted), fontSize: 10.5, fontFamily: ff.mono, whiteSpace: "nowrap" }}>18h · UTC</span>
          </div>

          {/* Legend — literally the same ramp object the bars and the map
              markers read from, and it now shows all three cascade steps.
              Showing only two was how "Direct" ended up labelling the colour
              the map uses for first-order. `paddingRight` reserves the lane
              the collapse button occupies, which used to clip "On time". */}
          <div
            className="hidden md:flex flex-wrap items-center justify-end"
            style={{ gap: 16, fontSize: 11, color: c.body, fontFamily: ff.body, fontWeight: 500, paddingRight: 34 }}
          >
            <LegendSwatch step={cascade.direct} label="Direct hit" />
            <LegendSwatch step={cascade.order1} label="1st order" />
            <LegendSwatch step={cascade.order2} label="2nd order" />
            <LegendSwatch step={cascade.cancelled} label="Cancelled" dashed />
            <LegendSwatch step={cascade.none} label="On time" />
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
        {nominal ? (
          // The DEFAULT state of this console, so it states the network's
          // condition rather than drawing 18 undifferentiated grey bars.
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", minHeight: 140,
              padding: `${sp.lg}px ${sp.xl}px`, textAlign: "center", gap: sp.xxs,
            }}
          >
            <Type as="span" role="titleSm" color={c.ink}>
              Network nominal — {schedule.length} legs, no cascades
            </Type>
            <Type as="span" role="bodyMd" color={c.muted} style={{ maxWidth: 460 }}>
              Trigger a disruption from the Events panel and affected flights will
              appear here, ordered by cascade generation.
            </Type>
          </div>
        ) : displayFlights.length === 0 ? (
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

/** A swatch takes the same {fill,border} pair the bars do, so the key and the
 *  thing it explains cannot describe different colours. The border is what
 *  keeps the lighter steps above the 3:1 non-text minimum. */
function LegendSwatch({
  step,
  label,
  dashed,
}: {
  step: { fill: string; border: string }
  label: string
  dashed?: boolean
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <span
        style={{
          width: 24,
          height: 12,
          borderRadius: r.sm,
          background: step.fill,
          border: `1px ${dashed ? "dashed" : "solid"} ${step.border}`,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  )
}
