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
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#F0FDFA" }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#0D9488", boxShadow: "0 4px 16px rgba(13,148,136,0.35)" }}
        >
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
        <span className="text-sm font-semibold" style={{ color: "#0D9488", fontFamily: "'DM Sans', sans-serif" }}>
          Loading map…
        </span>
      </div>
    </div>
  ),
})

const NAV_H   = 48   // slim nav height
const RAIL_L  = 308  // left control rail width
const RAIL_R  = 340  // right decision rail width
const STRIP_H = 192  // docked timeline height

const belowCard = {
  background: "#FFFFFF",
  border: "1px solid #DDDDDD",
  borderRadius: 12,
  overflow: "hidden" as const,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
} as const

export default function SimulatorPage() {
  const { flightStates, schedule, setSchedule, setSelectedLiveFlight, appliedPlanId } = useSimulationStore()
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
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>

      {/* ── Slim sticky nav ── */}
      <div className="sticky top-0 z-50">
        <SimulatorNav isConnected={isConnected} affectedCount={affectedCount} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN 3-ZONE WORKSPACE
          Left control rail | Center map hero | Right decision rail
          ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          height: `calc(100vh - ${NAV_H}px)`,
          display: "flex",
          overflow: "hidden",
          borderBottom: "1px solid #DDDDDD",
        }}
      >

        {/* LEFT: compact event control rail */}
        <aside
          style={{
            width: RAIL_L,
            flexShrink: 0,
            borderRight: "1px solid #DDDDDD",
            overflowY: "auto",
            overflowX: "hidden",
            background: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EventPanel />
        </aside>

        {/* CENTER: map + docked timeline */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "#F0EDE8" }}>

          {/* Map — fills all available height above timeline */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>

            {/* Compact search overlaid on map — shifts down when recovery banner is active */}
            <div
              style={{
                position: "absolute",
                top: appliedPlanId ? 76 : 12,
                left: 12,
                width: "min(420px, calc(100% - 200px))",
                zIndex: 500,
                transition: "top 0.2s ease",
              }}
            >
              <FlightSearch selectedFlight={selectedFlight} onSelect={handleFlightSelect} />
            </div>

            <FlightMap selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>

          {/* Docked cascade timeline strip */}
          <div
            style={{
              height: STRIP_H,
              flexShrink: 0,
              borderTop: "1px solid #DDDDDD",
              background: "#FFFFFF",
              overflow: "hidden",
            }}
          >
            <CascadeTimeline selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
          </div>
        </div>

        {/* RIGHT: recovery decision rail */}
        <aside
          style={{
            width: RAIL_R,
            flexShrink: 0,
            borderLeft: "1px solid #DDDDDD",
            overflowY: "auto",
            overflowX: "hidden",
            background: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <RecoveryPlans selectedFlight={selectedFlight} onFlightSelect={handleFlightSelect} />
        </aside>

      </div>

      {/* ══════════════════════════════════════════════════════════
          BELOW FOLD — secondary analysis panels
          ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 1760,
          margin: "0 auto",
        }}
      >
        {/* ── Below-fold section label ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "#DDDDDD" }} />
          <span style={{
            fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "#A0AEC0", whiteSpace: "nowrap",
          }}>
            Analysis Panels
          </span>
          <div style={{ flex: 1, height: 1, background: "#DDDDDD" }} />
        </div>

        <MyFlights onFlightSelect={handleFlightSelect} />
        <PlanCompare />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1.6fr)",
            gap: 20,
          }}
        >
          <div style={belowCard}><CrewOverbooking /></div>
          <div style={belowCard}><PassengerSolutions /></div>
        </div>
      </div>

    </div>
  )
}
