"use client"
import Link from "next/link"
import { Plane, Wifi, WifiOff, RotateCcw } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { useMemo } from "react"

interface SimulatorNavProps {
  isConnected: boolean
  affectedCount: number
}

export function SimulatorNav({ isConnected }: SimulatorNavProps) {
  const { reset, flightStates, schedule } = useSimulationStore()

  const stats = useMemo(() => {
    const states = Object.values(flightStates)
    const total     = schedule.length || states.length
    const cancelled = states.filter((f) => f.status === "cancelled").length
    const delayed   = states.filter(
      (f) => f.status === "delayed" || (f.status !== "cancelled" && f.delay_minutes > 0),
    ).length
    return { total, onTime: Math.max(0, total - cancelled - delayed), delayed, cancelled }
  }, [flightStates, schedule.length])

  const handleReset = async () => {
    try {
      await apiClient.post("/simulator/reset")
      reset()
      toast.success("Simulation reset", { description: "All flights restored to scheduled state." })
    } catch {
      reset()
      toast.info("Local state reset")
    }
  }

  return (
    <nav
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 16,
        paddingRight: 16,
        background: "linear-gradient(135deg, #042F2E 0%, #0F766E 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* ── Brand + stats ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}
          className="hover:opacity-80 transition-opacity"
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "#F59E0B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plane style={{ width: 13, height: 13, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 800, fontSize: 14, lineHeight: 1, color: "#ffffff", letterSpacing: "-0.01em" }}>
              Aeolus
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1, marginTop: 2 }}>
              Nimbus Air OCC
            </div>
          </div>
        </Link>

        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.18)", flexShrink: 0 }} />

        {stats.total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <StatPill dot="#008A05" value={stats.onTime} label="on-time" />
            {stats.delayed > 0 && <StatPill dot="#E07912" value={stats.delayed} label="delayed" accent />}
            {stats.cancelled > 0 && <StatPill dot="#C13515" value={stats.cancelled} label="cancelled" danger />}
          </div>
        )}
      </div>

      {/* ── Right controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            padding: "3px 9px", borderRadius: 6,
            background: isConnected ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
            color:      isConnected ? "#6EE7B7" : "#FCA5A5",
            border:    `1px solid ${isConnected ? "rgba(52,211,153,0.30)" : "rgba(248,113,113,0.30)"}`,
          }}
        >
          {isConnected ? <Wifi style={{ width: 11, height: 11 }} /> : <WifiOff style={{ width: 11, height: 11 }} />}
          {isConnected ? "Live" : "Offline"}
        </div>

        <button
          onClick={handleReset}
          className="btn-primary"
          style={{ height: 30, fontSize: 12, paddingLeft: 12, paddingRight: 12, gap: 5 }}
        >
          <RotateCcw style={{ width: 11, height: 11 }} />
          Reset
        </button>
      </div>
    </nav>
  )
}

function StatPill({ dot, value, label, accent, danger }: {
  dot: string; value: number; label: string; accent?: boolean; danger?: boolean
}) {
  const bg     = danger ? "rgba(239,68,68,0.15)"  : accent ? "rgba(251,146,60,0.15)"  : "rgba(52,211,153,0.12)"
  const border = danger ? "rgba(239,68,68,0.28)"  : accent ? "rgba(251,146,60,0.28)"  : "rgba(52,211,153,0.28)"
  const text   = danger ? "#FCA5A5"               : accent ? "#FCD34D"                : "#6EE7B7"

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: bg, border: `1px solid ${border}`, color: text }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ opacity: 0.7 }}>{label}</span>
    </div>
  )
}
