"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
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
        <span className="text-sm font-semibold" style={{ color: "#1E8C86" }}>Loading map…</span>
      </div>
    </div>
  ),
})

const card = {
  background: "#ffffff",
  border: "1.5px solid rgba(43,168,162,0.20)",
  boxShadow: "0 2px 16px rgba(43,168,162,0.07), 0 1px 3px rgba(0,0,0,0.05)",
}

export default function SimulatorPage() {
  const { flightStates, schedule, setSchedule, setSelectedLiveFlight } = useSimulationStore()
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
    <div className="min-h-screen" style={{ background: "#F0F4F8" }}>

      {/* ── Sticky nav ── */}
      <div className="sticky top-0 z-50">
        <SimulatorNav isConnected={isConnected} affectedCount={affectedCount} />
      </div>

      {/* ── Scrollable page content ── */}
      <div className="px-6 py-6 space-y-5 max-w-[1800px] mx-auto">

        {/* ── Flight search ── */}
        <div>
          <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
        </div>

        {/* ── Main three-column row ── */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(280px,1fr) minmax(0,2.4fr) minmax(280px,1fr)" }}>

          {/* LEFT — Trigger Events */}
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ ...card, height: "72vh", minHeight: 520 }}
          >
            <EventPanel />
          </div>

          {/* CENTER — Flight Map */}
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{ ...card, height: "72vh", minHeight: 520 }}
          >
            <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>

          {/* RIGHT — Recovery Plans */}
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ ...card, height: "72vh", minHeight: 520 }}
          >
            <RecoveryPlans
              selectedFlight={selectedFlight}
              onFlightSelect={handleFlightSelect}
            />
          </div>

        </div>

        {/* ── Cascade Timeline ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ ...card, height: 200 }}
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
