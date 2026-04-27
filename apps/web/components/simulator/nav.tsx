"use client"
import Link from "next/link"
import { Plane, Wifi, WifiOff, RotateCcw, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    const delayed = states.filter((f) => f.status === "delayed" || (f.status !== "cancelled" && f.delay_minutes > 0)).length
    const onTime = total - cancelled - delayed
    return { total, onTime: Math.max(0, onTime), delayed, cancelled }
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
    <header className="border-b border-border bg-card/80 backdrop-blur-md px-4 h-14 flex items-center justify-between shrink-0 z-40 shadow-sm">
      {/* Left: brand + stats */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg gradient-peach flex items-center justify-center shadow-sm">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-base">Aeolus</span>
        </Link>
        <span className="hidden sm:inline text-border">|</span>
        <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Nimbus Air OCC</span>

        {stats.total > 0 && (
          <>
            <span className="hidden md:inline text-border">|</span>
            <div className="hidden md:flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-semibold">{stats.onTime}</span>
                <span className="text-muted-foreground">on-time</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span className="text-orange-700 font-semibold">{stats.delayed}</span>
                <span className="text-muted-foreground">delayed</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-red-700 font-semibold">{stats.cancelled}</span>
                <span className="text-muted-foreground">cancelled</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: connection + reset + docs */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-full border ${
            isConnected
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-700 bg-red-50 border-red-200"
          }`}
        >
          {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="font-medium">{isConnected ? "Live" : "Offline"}</span>
        </div>

        <Link href="/docs">
          <Button variant="ghost" size="sm" className="h-7 text-xs hidden sm:inline-flex">
            <BookOpen className="w-3 h-3 mr-1" />
            Docs
          </Button>
        </Link>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleReset}
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>
    </header>
  )
}
