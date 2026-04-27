"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Plane, Clock, AlertTriangle, MapPin, Loader2 } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { useWebSocket } from "@/lib/websocket"
import { EventPanel } from "@/components/simulator/event-panel"
import { CascadeTimeline } from "@/components/simulator/cascade-timeline"
import { RecoveryPlans } from "@/components/simulator/recovery-plans"
import { SimulatorNav } from "@/components/simulator/nav"
import { FlightSearch } from "@/components/simulator/flight-search"
import { apiClient } from "@/lib/api"

// Leaflet must run client-side only — uses `window`.
const FlightMap = dynamic(() => import("@/components/simulator/flight-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-secondary/40">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Loading map…
      </div>
    </div>
  ),
})

export default function SimulatorPage() {
  const { flightStates, schedule, setSchedule, recoveryPlans, appliedPlanId, setSelectedLiveFlight } = useSimulationStore()
  const { isConnected } = useWebSocket()
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null)

  // When a simulated flight is selected, clear any live flight selection
  const handleFlightSelect = (id: string | null) => {
    setSelectedFlight(id)
    if (id) setSelectedLiveFlight(null)
  }

  const affectedCount = Object.values(flightStates).filter((f) => f.cascade_order >= 0).length

  useEffect(() => {
    apiClient
      .get("/simulator/schedule")
      .then((res) => setSchedule(res.data.flights || res.data || []))
      .catch(() => {
        // Schedule will populate once an event fires
      })
  }, [setSchedule])

  const selectedState = selectedFlight ? flightStates[selectedFlight] : null
  const selected = selectedFlight ? schedule.find((f) => f.id === selectedFlight) : null

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <SimulatorNav isConnected={isConnected} affectedCount={affectedCount} />

      {/* Search bar across the top */}
      <div className="px-3 pt-3 pb-2 shrink-0 max-w-3xl">
        <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
      </div>

      {/* Main grid */}
      <div className="flex-1 grid gap-3 p-3 pt-1 min-h-0 grid-cols-1 lg:grid-cols-12">
        {/* Map + cascade timeline (left, 8/12) */}
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
          <div className="flex-[3] min-h-[320px] rounded-xl overflow-hidden border border-border surface-card relative">
            <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />

            {/* Floating selected-flight detail */}
            {selected && (
              <div className="absolute top-3 right-3 left-3 sm:left-auto z-[450] surface-floating p-3 max-w-xs sm:max-w-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Plane className="w-4 h-4 text-primary" />
                      <span className="font-mono font-bold text-sm">{selected.id}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{selected.aircraft_id}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="font-mono font-medium text-foreground">{selected.origin}</span>
                      <span>→</span>
                      <span className="font-mono font-medium text-foreground">{selected.destination}</span>
                    </div>
                    {selectedState && (
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Status: </span>
                          <span className={
                            selectedState.status === "cancelled" ? "text-red-700 font-semibold" :
                            selectedState.delay_minutes > 0 ? "text-orange-700 font-semibold" :
                            "text-emerald-700 font-semibold"
                          }>{selectedState.status}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cascade: </span>
                          <span className="text-foreground font-medium">
                            {selectedState.cascade_order < 0 ? "—" :
                              selectedState.cascade_order === 0 ? "Direct" :
                              `Order ${selectedState.cascade_order}`}
                          </span>
                        </div>
                        {selectedState.delay_minutes > 0 && (
                          <div className="flex items-center gap-1 text-orange-700 font-medium">
                            <Clock className="w-3 h-3" /> +{selectedState.delay_minutes} min
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">P(delay): </span>
                          <span className="text-foreground font-medium">{(selectedState.p_delayed * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedFlight(null)}
                    className="text-muted-foreground hover:text-foreground text-lg leading-none w-5 h-5 flex items-center justify-center"
                    aria-label="Close"
                  >×</button>
                </div>
              </div>
            )}

            {/* Applied plan banner */}
            {appliedPlanId && (
              <div className="absolute bottom-3 right-3 z-[450] surface-floating px-3 py-2 text-[11px]">
                <div className="text-primary font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Plan {appliedPlanId} applied
                </div>
                <div className="text-muted-foreground text-[10px] mt-0.5">
                  Rendering revised schedule on map
                </div>
              </div>
            )}
          </div>

          {/* Cascade timeline */}
          <div className="flex-[2] min-h-[180px] rounded-xl border border-border surface-card overflow-hidden">
            <CascadeTimeline selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>
        </div>

        {/* Right: event panel + recovery plans (4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-3 min-h-0 min-h-[60vh]">
          <div className="flex-[5] min-h-[320px] rounded-xl border border-border surface-card overflow-hidden">
            <EventPanel />
          </div>
          <div className="flex-[7] min-h-[320px] rounded-xl border border-border surface-card overflow-hidden">
            <RecoveryPlans selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>
        </div>
      </div>
    </div>
  )
}
