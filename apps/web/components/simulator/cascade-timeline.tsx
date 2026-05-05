"use client"
import { useMemo } from "react"
import { motion } from "framer-motion"
import { useSimulationStore } from "@/stores/simulation"

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00–23:00 UTC

function getBarStyle(status: string, cascadeOrder: number) {
  if (status === "cancelled") {
    return "bg-gradient-to-b from-red-500 to-red-600 border-red-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
  }
  if (cascadeOrder === 0) {
    return "bg-gradient-to-b from-orange-500 to-orange-600 border-orange-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
  }
  if (cascadeOrder === 1) {
    return "bg-gradient-to-b from-amber-400 to-amber-500 border-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
  }
  if (cascadeOrder === 2) {
    return "bg-gradient-to-b from-amber-200 to-amber-300 border-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
  }
  return "bg-gradient-to-b from-emerald-500 to-emerald-600 border-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
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
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex-1 flex items-center justify-between min-w-0 gap-4">
          <div>
            <div className="section-title">Cascade Timeline</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">18-hour window · UTC</div>
          </div>

          {/* Legend */}
          <div className="hidden md:flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-700">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-6 h-3 rounded-sm bg-gradient-to-b from-orange-500 to-orange-600 border border-orange-800 shadow-sm shrink-0" />
              Direct
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-6 h-3 rounded-sm bg-gradient-to-b from-amber-200 to-amber-400 border border-amber-600 shadow-sm shrink-0" />
              Cascade
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-6 h-3 rounded-sm bg-gradient-to-b from-red-500 to-red-600 border border-red-800 shadow-sm shrink-0" />
              Cancelled
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-6 h-3 rounded-sm bg-gradient-to-b from-emerald-500 to-emerald-600 border border-emerald-800 shadow-sm shrink-0" />
              On time
            </span>
          </div>
        </div>
      </div>

      {/* Hour axis */}
      <div
        className="flex border-b border-slate-300/90 shrink-0 bg-slate-100/95 backdrop-blur-[2px]"
        style={{ boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.06)" }}
      >
        <div className="w-[112px] shrink-0 flex items-center px-3 py-2 border-r border-slate-300/80 bg-slate-100/90">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Flight
          </span>
        </div>
        <div className="flex-1 flex">
          {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
            <div
              key={h}
              className="flex-1 text-[11px] font-bold tabular-nums text-slate-700 py-2 pl-2 border-l border-slate-300/70 bg-white/80 font-mono"
            >
              {h < 24 ? `${String(h).padStart(2, "0")}:00` : `${h - 24}:00+1`}
            </div>
          ))}
        </div>
      </div>

      {/* Flight rows — generous row height + zebra striping + scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thick cascade-timeline-scroll">
        {displayFlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[180px] text-sm font-medium text-slate-600 px-8 text-center gap-2">
            <span className="text-base font-bold text-slate-700">No schedule rows yet</span>
            <span className="text-xs text-slate-500 max-w-md">
              Load the simulator or trigger a disruption — affected flights appear here with Direct vs cascade coloring.
            </span>
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
            const style = getBarStyle(flight.state.status, flight.state.cascade_order)

            return (
              <div
                key={flight.id}
                className={`flex items-stretch border-b border-slate-200 cursor-pointer transition-colors min-h-[46px] ${
                  rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/95"
                } ${isSelected ? "bg-orange-50/60 ring-inset ring-2 ring-orange-300/60 z-[1]" : "hover:bg-slate-50"}`}
                onClick={() => onFlightSelect(isSelected ? null : flight.id)}
              >
                <div className="w-[112px] shrink-0 px-3 py-2 flex flex-col justify-center border-r border-slate-200/90 bg-slate-50/80">
                  <span
                    className={`text-[12px] font-mono font-extrabold leading-tight tracking-tight ${
                      isSelected ? "text-orange-700" : "text-slate-900"
                    }`}
                  >
                    {flight.id}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-600 leading-snug mt-0.5 font-mono">
                    {flight.origin}→{flight.destination}
                  </span>
                </div>

                <div className="flex-1 relative min-h-[46px] bg-white/40">
                  {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-slate-200/90 pointer-events-none"
                      style={{ left: `${((h - 6) / 18) * 100}%` }}
                    />
                  ))}

                  {flight.state.delay_minutes > 0 && (
                    <div
                      className="absolute top-2 bottom-2 border-2 border-dashed border-orange-400/70 rounded-md bg-orange-50/70"
                      style={{
                        left: `${Math.max(0, ((depHour - 6) / 18) * 100)}%`,
                        width: `${(delayHr / 18) * 100}%`,
                      }}
                    />
                  )}

                  <motion.div
                    className={`absolute top-2 bottom-2 rounded-md border-2 ${style} ${
                      isSelected ? "ring-2 ring-offset-1 ring-orange-400/60 ring-offset-white" : ""
                    }`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 6 }}
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
