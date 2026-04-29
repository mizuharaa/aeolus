"use client"
import Link from "next/link"
import { Plane, Wifi, WifiOff, RotateCcw, BookOpen } from "lucide-react"
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
    const total = schedule.length || states.length
    const cancelled = states.filter((f) => f.status === "cancelled").length
    const delayed = states.filter(
      (f) => f.status === "delayed" || (f.status !== "cancelled" && f.delay_minutes > 0)
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
    <div
      className="shrink-0 z-40 flex items-center justify-between px-5 h-14"
      style={{
        background: "linear-gradient(135deg, #1E8C86 0%, #2BA8A2 100%)",
        boxShadow: "0 2px 12px rgba(30,140,134,0.28)",
      }}
    >
      {/* ── Brand + stats ── */}
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-85 transition-opacity min-w-0 shrink-0"
        >
          {/* Logo icon — gold circle */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#FFD23F", boxShadow: "0 2px 10px rgba(255,210,63,0.50)" }}
          >
            <Plane className="w-[18px] h-[18px]" style={{ color: "#1E8C86" }} />
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-[15px] leading-none tracking-wide">
              Aeolus
            </div>
            <div
              className="text-[10px] font-medium leading-none mt-0.5 hidden sm:block"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              Nimbus Air OCC
            </div>
          </div>
        </Link>

        {/* Flight status summary pills */}
        {stats.total > 0 && (
          <div className="hidden md:flex items-center gap-1.5">
            <div
              className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold"
              style={{ background: "rgba(255,255,255,0.14)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-white">{stats.onTime}</span>
              <span style={{ color: "rgba(255,255,255,0.68)" }}>on-time</span>
            </div>
            {stats.delayed > 0 && (
              <div
                className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold"
                style={{ background: "rgba(255,255,255,0.14)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-white">{stats.delayed}</span>
                <span style={{ color: "rgba(255,255,255,0.68)" }}>delayed</span>
              </div>
            )}
            {stats.cancelled > 0 && (
              <div
                className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold"
                style={{ background: "rgba(239,108,74,0.38)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-white">{stats.cancelled}</span>
                <span style={{ color: "rgba(255,255,255,0.78)" }}>cancelled</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right controls ── */}
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold border ${
            isConnected
              ? "border-emerald-400/40"
              : "border-red-400/40"
          }`}
          style={{
            background: isConnected
              ? "rgba(52,211,153,0.18)"
              : "rgba(248,113,113,0.18)",
            color: "white",
          }}
        >
          {isConnected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span>{isConnected ? "Live" : "Offline"}</span>
        </div>

        {/* Docs link */}
        <Link href="/docs">
          <button
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.14)", color: "white" }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Docs
          </button>
        </Link>

        {/* Reset — gold CTA */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: "#FFD23F",
            color: "#1E8C86",
            boxShadow: "0 2px 10px rgba(255,210,63,0.42)",
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>
    </div>
  )
}
