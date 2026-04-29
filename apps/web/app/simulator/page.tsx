"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2, AlertTriangle } from "lucide-react"
import { useSimulationStore, type ScheduledFlight } from "@/stores/simulation"
import { useWebSocket } from "@/lib/websocket"
import { EventPanel } from "@/components/simulator/event-panel"
import { CascadeTimeline } from "@/components/simulator/cascade-timeline"
import { RecoveryPlans } from "@/components/simulator/recovery-plans"
import { SimulatorNav } from "@/components/simulator/nav"
import { FlightSearch } from "@/components/simulator/flight-search"
import { apiClient } from "@/lib/api"

const FlightMap = dynamic(() => import("@/components/simulator/flight-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#E8F6F5" }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "#2BA8A2", boxShadow: "0 4px 20px rgba(43,168,162,0.40)" }}
        >
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
        <span className="text-sm font-semibold" style={{ color: "#1E8C86" }}>
          Loading map…
        </span>
      </div>
    </div>
  ),
})

export default function SimulatorPage() {
  const { flightStates, schedule, setSchedule, appliedPlanId, setSelectedLiveFlight } =
    useSimulationStore()
  const { isConnected } = useWebSocket()
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null)

  const handleFlightSelect = (id: string | null) => {
    setSelectedFlight(id)
    if (id) setSelectedLiveFlight(null)
  }

  const affectedCount = Object.values(flightStates).filter((f) => f.cascade_order >= 0).length

  useEffect(() => {
    apiClient
      .get<{ flights?: ScheduledFlight[] } | ScheduledFlight[]>("/simulator/schedule")
      .then((res) => {
        const d = res.data
        const list = Array.isArray(d) ? d : d?.flights
        setSchedule(list ?? [])
      })
      .catch(() => {})
  }, [setSchedule])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ── Navigation header ── */}
      <SimulatorNav isConnected={isConnected} affectedCount={affectedCount} />

      {/* ── Content area ── */}
      <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">

        {/* Search bar — full width */}
        <div className="shrink-0">
          <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
        </div>

        {/* Main panels grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">

          {/* ── Left: Flight map (fills full column height) ── */}
          <div className="lg:col-span-8 surface-card overflow-hidden relative min-h-[300px]">
            <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />

            {/* Applied plan banner — floating overlay */}
            {appliedPlanId && (
              <div
                className="absolute bottom-4 right-4 z-[450] surface-floating px-4 py-2.5 flex items-center gap-2.5"
                style={{ borderLeft: "3px solid #EF6C4A" }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#EF6C4A" }} />
                <div>
                  <div className="text-xs font-bold" style={{ color: "#D45233" }}>
                    Plan {appliedPlanId} applied
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Showing revised schedule
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Event panel + Recovery plans (scrollable column) ── */}
          <div className="lg:col-span-4 flex flex-col gap-4 min-h-0 overflow-y-auto">
            <div className="shrink-0 surface-card overflow-hidden" style={{ height: "460px" }}>
              <EventPanel />
            </div>
            <div className="shrink-0 surface-card overflow-hidden" style={{ height: "620px" }}>
              <RecoveryPlans
                selectedFlight={selectedFlight}
                onFlightSelect={handleFlightSelect}
              />
            </div>
          </div>
        </div>

        {/* ── Cascade timeline — full width strip at bottom ── */}
        <div
          className="shrink-0 surface-card overflow-hidden"
          style={{ height: "10.5rem" }}
        >
          <CascadeTimeline
            selectedFlight={selectedFlight}
            onFlightSelect={handleFlightSelect}
          />
        </div>
      </div>
    </div>
  )
}
