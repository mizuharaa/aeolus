"use client"
import { useMemo } from "react"
import { motion } from "framer-motion"
import { useSimulationStore } from "@/stores/simulation"

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00–23:00 UTC

function getBarStyle(status: string, cascadeOrder: number) {
  if (status === "cancelled") return "bg-red-400/80 border-red-500"
  if (cascadeOrder === 0)     return "bg-orange-400/80 border-orange-500"
  if (cascadeOrder === 1)     return "bg-orange-300/80 border-orange-400"
  if (cascadeOrder === 2)     return "bg-orange-200/80 border-orange-300"
  return "bg-teal/40 border-teal/60"
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
  selectedFlight, onFlightSelect,
}: {
  selectedFlight: string | null
  onFlightSelect: (id: string | null) => void
}) {
  const { flightStates, schedule } = useSimulationStore()

  const displayFlights = useMemo(() => {
    const withState = schedule.map((f) => ({
      ...f,
      state: flightStates[f.id] || { status: "scheduled", delay_minutes: 0, cascade_order: -1, p_delayed: 0 },
    }))
    const affected = withState
      .filter((f) => f.state.cascade_order >= 0)
      .sort((a, b) => a.state.cascade_order - b.state.cascade_order)
    const others = withState.filter((f) => f.state.cascade_order < 0).slice(0, 18)
    return [...affected, ...others].slice(0, 40)
  }, [flightStates, schedule])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex-1 flex items-center justify-between min-w-0">
          <div>
            <div className="section-title">Cascade Timeline</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">18-hour window (UTC)</div>
          </div>

          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 rounded-sm bg-orange-400 inline-block" />
              Direct
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 rounded-sm bg-orange-200 inline-block" />
              Cascade
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 rounded-sm bg-red-400 inline-block" />
              Cancelled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 rounded-sm inline-block" style={{ background: "rgba(43,168,162,0.50)" }} />
              On time
            </span>
          </div>
        </div>
      </div>

      {/* Hour axis */}
      <div className="flex border-b border-border/40 shrink-0" style={{ background: "rgba(43,168,162,0.04)" }}>
        <div className="w-[84px] shrink-0" />
        <div className="flex-1 flex">
          {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
            <div
              key={h}
              className="flex-1 text-[9px] text-muted-foreground py-1 pl-1.5 border-l border-border/30 font-mono"
            >
              {h < 24 ? `${String(h).padStart(2, "0")}:00` : `${h - 24}:00+1`}
            </div>
          ))}
        </div>
      </div>

      {/* Flight rows */}
      <div className="flex-1 overflow-y-auto bg-white">
        {displayFlights.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-6 text-center">
            No flights loaded — trigger a disruption to populate the cascade.
          </div>
        ) : (
          displayFlights.map((flight) => {
            const depHour = parseHourUTC(flight.scheduled_departure)
            const arrHour = parseHourUTC(flight.scheduled_arrival)
            const delayHr = (flight.state.delay_minutes || 0) / 60
            const newDep   = depHour + delayHr
            const newArr   = arrHour + delayHr
            const leftPct  = Math.max(0, ((newDep - 6) / 18) * 100)
            const widthPct = Math.max(1.0, ((newArr - newDep) / 18) * 100)
            const isSelected = selectedFlight === flight.id
            const style = getBarStyle(flight.state.status, flight.state.cascade_order)

            return (
              <div
                key={flight.id}
                className={`flex items-center border-b border-border/30 hover:bg-teal-bg/40 cursor-pointer transition-colors h-[26px] ${
                  isSelected ? "bg-teal-bg/60" : ""
                }`}
                onClick={() => onFlightSelect(isSelected ? null : flight.id)}
              >
                <div className="w-[84px] shrink-0 px-2.5 flex flex-col justify-center">
                  <span
                    className={`text-[10px] font-mono font-semibold leading-none ${
                      isSelected ? "text-teal" : "text-foreground/80"
                    }`}
                    style={isSelected ? { color: "#2BA8A2" } : {}}
                  >
                    {flight.id}
                  </span>
                  <span className="text-[9px] text-muted-foreground/60 leading-none mt-0.5 font-mono">
                    {flight.origin}→{flight.destination}
                  </span>
                </div>

                <div className="flex-1 relative h-full">
                  {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-border/20"
                      style={{ left: `${((h - 6) / 18) * 100}%` }}
                    />
                  ))}

                  {flight.state.delay_minutes > 0 && (
                    <div
                      className="absolute top-2 bottom-2 border border-orange-300/40 border-dashed rounded-sm bg-orange-100/30"
                      style={{
                        left:  `${Math.max(0, ((depHour - 6) / 18) * 100)}%`,
                        width: `${(delayHr / 18) * 100}%`,
                      }}
                    />
                  )}

                  <motion.div
                    className={`absolute top-1.5 bottom-1.5 rounded-sm border ${style} ${
                      isSelected ? "ring-1 ring-teal/50" : ""
                    }`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 4 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    title={`${flight.id} ${flight.origin}→${flight.destination}${flight.state.delay_minutes > 0 ? ` (+${flight.state.delay_minutes}m)` : ""}`}
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
