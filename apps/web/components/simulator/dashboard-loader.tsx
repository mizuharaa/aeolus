"use client"
/**
 * DashboardLoader — a branded overlay shown while the OCC boots and the live
 * ADS-B fleet is still being fetched (the map is empty for a beat on first
 * load). It reads liveFlights from the store and lifts once planes are on the
 * map, with a minimum on-screen time so it never flashes and a hard timeout so
 * it never hangs if the live feed is slow.
 */

import { useEffect, useRef, useState } from "react"
import { Plane } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { c, ff } from "@/lib/design-tokens"

const STEPS = ["Connecting to ADS-B feed", "Loading Nimbus network", "Placing live traffic"]

/**
 * 4s, was 14s.
 *
 * This overlay is `position: fixed; inset: 0; z-index: 4000` and fully opaque,
 * so while it is up it swallows every click on the console — `elementFromPoint`
 * over any button returns this div. Fourteen seconds of that is not a loading
 * state, it is an outage, and it was reachable whenever the ADS-B feed was slow
 * or blocked (measured: `/api/flights-live` aborting kept it up for 63s+ in one
 * environment).
 *
 * It also waited on the wrong thing. `liveFlights` is OTHER CARRIERS' ambient
 * traffic; the operator's own network is `schedule`. Blocking the console until
 * a competitor's aircraft are painted had the priority exactly backwards.
 */
const CAP_MS = 4000

export function DashboardLoader() {
  const liveFlights = useSimulationStore((s) => s.liveFlights)
  const schedule = useSimulationStore((s) => s.schedule)
  const [visible, setVisible] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [step, setStep] = useState(0)
  const mountedAt = useRef<number>(0)
  const capFired = useRef(false)

  useEffect(() => {
    // Date.now via a ref set on mount (client only)
    mountedAt.current = performance.now()
    const cycle = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 900)
    // hard cap so a slow/failed live feed never traps the operator behind the
    // boot screen forever (backend/ADS-B degraded case).
    const cap = window.setTimeout(() => {
      capFired.current = true
      setLeaving(true)
      window.setTimeout(() => setVisible(false), 460)
    }, CAP_MS)
    return () => { clearInterval(cycle); clearTimeout(cap) }
  }, [])

  useEffect(() => {
    // Dismiss ONLY once the live fleet is actually on the map (not merely when
    // the schedule loads) — otherwise the map sits empty with no loader and
    // the operator thinks it's broken. A short paint delay lets the ~400
    // markers render before we fade out.
    // EITHER feed is enough to show a useful console: the owned schedule is
    // what the operator works on, ambient traffic is context. Requiring the
    // ambient feed meant a healthy backend with a blocked ADS-B relay sat
    // behind a full-screen blocker for the whole cap.
    const ready = liveFlights.length > 0 || schedule.length > 0
    if (!ready || capFired.current) return
    const elapsed = performance.now() - mountedAt.current
    const wait = Math.max(600, 900 - elapsed) // min on-screen + let markers paint
    const t = window.setTimeout(() => {
      setLeaving(true)
      window.setTimeout(() => setVisible(false), 460)
    }, wait)
    return () => clearTimeout(t)
  }, [liveFlights.length, schedule.length])

  if (!visible) return null

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", inset: 0, zIndex: 4000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22,
        background: "linear-gradient(160deg, #F7F3E8, #F5F0E3 45%, #FFFDF6)",
        opacity: leaving ? 0 : 1,
        // Stop swallowing clicks the moment the fade starts — the console is
        // already interactive underneath, and 460ms of an invisible full-screen
        // click blocker is 460ms of the app appearing dead.
        pointerEvents: leaving ? "none" : "auto",
        transition: "opacity 440ms ease",
        fontFamily: ff.body,
      }}
    >
      {/* animated radar + plane */}
      <div style={{ position: "relative", width: 132, height: 132, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="dl-ring" />
        <span className="dl-ring dl-ring--2" />
        <span
          style={{
            position: "relative", width: 58, height: 58, borderRadius: 18,
            background: "var(--ae-text)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 30px -10px rgba(28,20,38,0.5)",
          }}
        >
          <Plane className="dl-plane" style={{ width: 28, height: 28, color: "#fff" }} strokeWidth={2} />
        </span>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: ff.display, fontWeight: 700, fontSize: 20, color: c.ink, letterSpacing: "-0.01em" }}>
          Spinning up the operations center
        </div>
        <div style={{ marginTop: 8, fontFamily: ff.mono, fontSize: 12, color: "var(--ae-teal-ink)", letterSpacing: "0.04em" }}>
          {STEPS[step]}
          <span className="dl-dots" />
        </div>
      </div>

      {/* progress shimmer bar */}
      <div style={{ width: 220, height: 4, borderRadius: 99, background: "rgba(44,73,224,0.15)", overflow: "hidden" }}>
        <span className="dl-bar" />
      </div>

      {/* An escape hatch. Any blocking overlay on an ops console needs one:
          the operator, not the feed, decides when they have waited long
          enough. It is also the only focusable thing here, so Tab-then-Enter
          clears the boot screen. */}
      <button
        type="button"
        onClick={() => { capFired.current = true; setLeaving(true); window.setTimeout(() => setVisible(false), 460) }}
        style={{
          minHeight: 44, padding: "0 18px", borderRadius: 8,
          border: `1px solid ${c.hairline}`, background: "transparent",
          color: c.body, fontFamily: ff.body, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        Skip and open the console
      </button>

      <style jsx>{`
        .dl-ring {
          position: absolute; inset: 0; border-radius: 999px;
          border: 2px solid rgba(44,73,224,0.35);
          animation: dl-radar 1.8s ease-out infinite;
        }
        .dl-ring--2 { animation-delay: 0.9s; }
        @keyframes dl-radar { 0% { transform: scale(0.42); opacity: 0.9; } 100% { transform: scale(1); opacity: 0; } }
        .dl-plane { animation: dl-bob 1.6s ease-in-out infinite; }
        @keyframes dl-bob { 0%,100% { transform: translateY(-1px) rotate(-4deg); } 50% { transform: translateY(2px) rotate(4deg); } }
        .dl-bar {
          display: block; width: 45%; height: 100%; border-radius: 99px;
          background: var(--ae-teal);
          animation: dl-slide 1.2s ease-in-out infinite;
        }
        @keyframes dl-slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
        .dl-dots::after { content: "…"; animation: dl-blink 1.2s steps(4) infinite; }
        @keyframes dl-blink { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
        @media (prefers-reduced-motion: reduce) {
          .dl-ring, .dl-plane, .dl-bar, .dl-dots::after { animation: none; }
        }
      `}</style>
    </div>
  )
}
