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
import { MyFlights } from "@/components/simulator/my-flights"
import { PlanCompare } from "@/components/simulator/plan-compare"
import { CrewOverbooking } from "@/components/simulator/crew-overbooking"
import { PassengerSolutions } from "@/components/simulator/passenger-solutions"
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
        <div
          className="grid gap-5 items-stretch min-h-0"
          style={{ gridTemplateColumns: "minmax(280px,1fr) minmax(0,2.4fr) minmax(280px,1fr)" }}
        >

          {/* LEFT — Trigger Events */}
          <div
            className="rounded-2xl overflow-hidden flex flex-col min-h-0 min-w-0"
            style={{ ...card, height: "clamp(480px, 58vh, 860px)" }}
          >
            <EventPanel />
          </div>

          {/* CENTER — Flight Map (fixed height column + clip so Leaflet never paints outside the card on scroll) */}
          <div
            className="rounded-2xl overflow-hidden relative min-h-0 min-w-0 isolate"
            style={{ ...card, height: "clamp(480px, 58vh, 860px)" }}
          >
            <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>

          {/* RIGHT — Recovery Plans */}
          <div
            className="rounded-2xl overflow-hidden flex flex-col min-h-0 min-w-0"
            style={{ ...card, height: "clamp(480px, 58vh, 860px)" }}
          >
            <RecoveryPlans
              selectedFlight={selectedFlight}
              onFlightSelect={handleFlightSelect}
            />
          </div>

        </div>

        {/* ── Cascade Timeline ── */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col min-h-0 min-w-0 shadow-[0_4px_24px_rgba(43,168,162,0.12)] border border-[rgba(43,168,162,0.22)]"
          style={{
            ...card,
            minHeight: "min(520px, 70vh)",
            height: "clamp(400px, 48vh, 720px)",
            maxHeight: "min(720px, 78vh)",
          }}
        >
          <CascadeTimeline
            selectedFlight={selectedFlight}
            onFlightSelect={handleFlightSelect}
          />
        </div>

        {/* ── My Flights ── */}
        <MyFlights onFlightSelect={handleFlightSelect} />

        {/* ── Plan Comparison (only renders when 2+ recovery plans exist) ── */}
        <PlanCompare />

        {/* ── Crew + Passenger row ── */}
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "minmax(340px,1fr) minmax(340px,1.6fr)" }}
        >
          <CrewOverbooking />
          <PassengerSolutions />
        </div>

      </div>
    </div>
  )
}
