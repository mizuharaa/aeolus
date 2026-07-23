"use client"
/**
 * OpsBrief — the morning report. A slide-over sheet anchored to the left
 * rail that reads like a dispatcher's daily brief: today's flights, fleet
 * status, active disruptions, FAA programs, weather alerts, and the live
 * ADS-B picture. Auto-opens once per session on dashboard boot; reopenable
 * any time from the rail's "Daily brief" item.
 */

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Plane, AlertTriangle, CloudLightning, TowerControl, Radio, ArrowRight,
} from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useSimulationStore } from "@/stores/simulation"
import { apiClient } from "@/lib/api"
import { c, ff, r } from "@/lib/design-tokens"

interface FAAProgram {
  airport_icao?: string
  type: string
  avg_delay_minutes?: number
  reason?: string
}
interface WxAlert {
  event: string
  headline?: string
  affected_nimbus_airports?: string[]
}

const EASE = [0.22, 0.9, 0.28, 1] as const

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

/** Horizontal status bar — quiet, printed, no donut charts. */
function StatBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 76, fontSize: 11.5, color: c.body, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--ae-neutral-bg)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: EASE as unknown as number[] }}
          style={{ height: "100%", borderRadius: 99, background: color }}
        />
      </div>
      <span style={{ width: 34, textAlign: "right", fontFamily: ff.mono, fontSize: 11.5, fontWeight: 600, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  )
}

function SectionHead({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ display: "inline-flex", color: c.muted }}>{icon}</span>
      <span style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: c.muted }}>
        {children}
      </span>
    </div>
  )
}

export function OpsBrief({ open, onClose, railWidth }: { open: boolean; onClose: () => void; railWidth: number }) {
  const { schedule, flightStates, activeEvents, liveFlights, recoveryPlans, appliedPlanId } = useSimulationStore()
  const [faa, setFaa] = useState<FAAProgram[]>([])
  const [wx, setWx] = useState<WxAlert[]>([])

  useEffect(() => {
    if (!open) return
    apiClient.get<{ programs?: FAAProgram[] }>("/live/faa-status")
      .then((res) => setFaa(res.data.programs ?? [])).catch(() => {})
    apiClient.get<{ alerts?: WxAlert[] }>("/live/weather-alerts")
      .then((res) => setWx(res.data.alerts ?? [])).catch(() => {})
  }, [open])

  // Esc closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const stats = useMemo(() => {
    const states = Object.values(flightStates)
    const total = schedule.length || states.length
    const cancelled = states.filter((f) => f.status === "cancelled").length
    const delayed = states.filter((f) => f.status !== "cancelled" && f.delay_minutes > 0).length
    return { total, cancelled, delayed, onTime: Math.max(0, total - cancelled - delayed) }
  }, [flightStates, schedule.length])

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* scrim over the workspace */}
          <motion.div
            key="brief-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 990, background: "rgba(28,20,38,0.28)" }}
          />
          <motion.aside
            key="brief"
            role="dialog"
            aria-label="Daily operations brief"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.34, ease: EASE as unknown as number[] }}
            style={{
              position: "fixed",
              left: railWidth,
              top: 0,
              bottom: 0,
              width: "min(430px, calc(100vw - 80px))",
              zIndex: 995,
              background: "var(--ae-surface)",
              borderRight: `1px solid ${c.hairline}`,
              boxShadow: "var(--ae-shadow-overlay)",
              display: "flex",
              flexDirection: "column",
              fontFamily: ff.body,
            }}
          >
            {/* header */}
            <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${c.hairline}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ae-teal-ink)" }}>
                    Daily operations brief
                  </div>
                  <h2 style={{ margin: "8px 0 2px", fontFamily: ff.display, fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em", color: c.ink }}>
                    {greeting()}, dispatcher
                  </h2>
                  <div style={{ fontSize: 12.5, color: c.muted }}>{today} · Nimbus Air network</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close brief"
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${c.hairline}`,
                    background: "transparent", color: c.muted, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  <X style={{ width: 15, height: 15 }} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* body */}
            <div className="ae-scroll-smooth" style={{ flex: 1, overflowY: "auto", padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 26 }}>

              {/* today's flights */}
              <section>
                <SectionHead icon={<Plane style={{ width: 13, height: 13 }} strokeWidth={2} />}>
                  Flights today
                </SectionHead>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontFamily: ff.display, fontSize: 38, fontWeight: 750, letterSpacing: "-0.02em", color: c.ink, lineHeight: 1 }}>
                    {stats.total.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 12.5, color: c.muted }}>scheduled legs</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <StatBar label="On time" value={stats.onTime} total={stats.total} color="var(--ae-teal)" />
                  <StatBar label="Delayed" value={stats.delayed} total={stats.total} color="var(--ae-amber)" />
                  <StatBar label="Cancelled" value={stats.cancelled} total={stats.total} color="var(--ae-line-strong)" />
                </div>
              </section>

              {/* disruptions */}
              <section>
                <SectionHead icon={<AlertTriangle style={{ width: 13, height: 13 }} strokeWidth={2} />}>
                  Disruptions
                </SectionHead>
                {activeEvents.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: c.body }}>
                    No active disruptions. The network is running to plan.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeEvents.map((e) => (
                      <div
                        key={e.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", borderRadius: r.md,
                          background: "var(--ae-rose-bg)", border: "1px solid var(--ae-rose-soft2)",
                        }}
                      >
                        <span style={{ width: 3, alignSelf: "stretch", borderRadius: 3, background: "var(--ae-rose)" }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>
                            {e.kind.replace(/_/g, " ").replace(/^./, (ch) => ch.toUpperCase())}
                          </div>
                          {e.params?.airport && (
                            <div style={{ fontFamily: ff.mono, fontSize: 11, color: "var(--ae-rose-ink)" }}>
                              {String(e.params.airport)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {recoveryPlans.length > 0 && !appliedPlanId && (
                      <Link
                        href={"/simulator/plans" as Route}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4,
                          fontSize: 12.5, fontWeight: 600, color: "var(--ae-teal-ink)", textDecoration: "none",
                        }}
                      >
                        {recoveryPlans.length} recovery plan{recoveryPlans.length !== 1 ? "s" : ""} ready — review
                        <ArrowRight style={{ width: 13, height: 13 }} strokeWidth={2.25} />
                      </Link>
                    )}
                  </div>
                )}
              </section>

              {/* FAA programs */}
              <section>
                <SectionHead icon={<TowerControl style={{ width: 13, height: 13 }} strokeWidth={2} />}>
                  FAA programs
                </SectionHead>
                {faa.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: c.body }}>No ground stops or delay programs reported.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {faa.slice(0, 6).map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}>
                        <span style={{ fontFamily: ff.mono, fontWeight: 600, color: c.ink, width: 44, flexShrink: 0 }}>
                          {p.airport_icao ?? "—"}
                        </span>
                        <span style={{ color: "var(--ae-amber-ink)", fontWeight: 550 }}>
                          {p.type.replace(/_/g, " ")}
                        </span>
                        {p.avg_delay_minutes ? (
                          <span style={{ fontFamily: ff.mono, color: c.muted }}>+{p.avg_delay_minutes}m</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* weather */}
              <section>
                <SectionHead icon={<CloudLightning style={{ width: 13, height: 13 }} strokeWidth={2} />}>
                  Weather alerts
                </SectionHead>
                {wx.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: c.body }}>No severe weather touching the network.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {wx.slice(0, 6).map((a, i) => (
                      <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600, color: c.ink }}>{a.event}</span>
                        {a.affected_nimbus_airports && a.affected_nimbus_airports.length > 0 && (
                          <span style={{ fontFamily: ff.mono, color: c.muted }}>
                            {" — "}{a.affected_nimbus_airports.join(", ")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* live picture */}
              <section>
                <SectionHead icon={<Radio style={{ width: 13, height: 13 }} strokeWidth={2} />}>
                  Live picture
                </SectionHead>
                <p style={{ margin: 0, fontSize: 13, color: c.body, lineHeight: 1.6 }}>
                  <strong style={{ color: c.ink, fontFamily: ff.mono }}>{liveFlights.length.toLocaleString()}</strong>{" "}
                  aircraft on ADS-B over CONUS right now.
                </p>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
