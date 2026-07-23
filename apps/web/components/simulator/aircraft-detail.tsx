"use client"
/**
 * AircraftDetail — centered modal with a top-down aircraft seat map.
 *
 * Opens from the flight inspector's "Aircraft & seating" action. Light
 * register, teal accents. Occupancy is PLACEHOLDER data — deterministic
 * per flight (seeded by flight id) so the same flight always shows the
 * same cabin, but not wired to a real PNR store yet.
 */

import { motion } from "framer-motion"
import { X } from "lucide-react"
import { useMemo } from "react"
import type { ScheduledFlight } from "@/stores/simulation"
import { NIMBUS_AIRPORTS } from "./airports"
import { c, ff } from "@/lib/design-tokens"

// Deterministic tiny hash → [0,1). Same flight+seat ⇒ same occupancy.
function seeded(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

const TEAL = "#5B3FA8"
const SEAT_EMPTY_STROKE = "rgba(15,20,18,0.28)"

type CabinRow = { cols: number[]; aisleAfter: number; cls: "F" | "Y"; exit?: boolean }

function buildCabin(): CabinRow[] {
  const rows: CabinRow[] = []
  for (let r = 0; r < 4; r++) rows.push({ cols: [0, 1, 2, 3], aisleAfter: 1, cls: "F" })
  for (let r = 0; r < 20; r++) rows.push({ cols: [0, 1, 2, 3, 4, 5], aisleAfter: 2, cls: "Y", exit: r === 7 })
  return rows
}
const CABIN = buildCabin()

function fmtTime(iso: string): string {
  try { return new Date(iso).toISOString().slice(11, 16) + "Z" } catch { return "—" }
}

export function AircraftDetail({ flight, onClose }: { flight: ScheduledFlight; onClose: () => void }) {
  const oAp = NIMBUS_AIRPORTS[flight.origin]
  const dAp = NIMBUS_AIRPORTS[flight.destination]

  const { seats, occupied, loadFactor } = useMemo(() => {
    const lf = 0.62 + seeded(flight.id) * 0.33 // 62–95%
    let total = 0
    let occ = 0
    const map: boolean[][] = CABIN.map((row, ri) =>
      row.cols.map((ci) => {
        total++
        const on = seeded(`${flight.id}:${ri}:${ci}`) < lf
        if (on) occ++
        return on
      })
    )
    return { seats: { total, map }, occupied: occ, loadFactor: occ / total }
  }, [flight.id])

  // seat-map geometry
  const SEAT = 13
  const GAP = 4
  const AISLE = 14
  const rowsY: number[] = []
  let y = 78
  CABIN.forEach((row, i) => {
    rowsY.push(y)
    y += SEAT + GAP + (i === 3 ? 16 : 0) // galley break after first class
  })
  const fuseH = y + 96
  const maxCols = 6
  const rowW = maxCols * (SEAT + GAP) + AISLE
  const fuseW = rowW + 56
  const svgW = fuseW + 140 // room for wing hints
  const cx = svgW / 2

  const seatX = (row: CabinRow, ci: number) => {
    const n = row.cols.length
    const w = n * (SEAT + GAP) + AISLE - GAP
    const start = cx - w / 2
    const idx = row.cols[ci]
    // insert aisle gap after aisleAfter
    const before = idx <= row.aisleAfter ? 0 : AISLE
    // first class seats are wider-spaced: spread 4 across economy width
    if (row.cls === "F") {
      const fw = SEAT + 8
      const total = 4 * fw + AISLE - 8
      const s = cx - total / 2
      return s + idx * fw + (idx >= 2 ? AISLE : 0)
    }
    return start + idx * (SEAT + GAP) + before
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        background: "rgba(15,20,18,0.38)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "min(880px, 100%)",
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          background: "var(--ae-surface)",
          border: "1px solid var(--ae-line)",
          boxShadow: "var(--ae-shadow-overlay)",
          fontFamily: ff.body,
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--ae-line)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: ff.mono, fontSize: 17, fontWeight: 600, color: c.ink }}>{flight.id}</span>
              <span style={{ fontSize: 12, color: c.muted }}>{flight.aircraft_id} · B737-800</span>
            </div>
            <div style={{ fontSize: 12, color: c.body, marginTop: 3 }}>
              {flight.origin} {oAp ? `(${oAp.city})` : ""} → {flight.destination} {dAp ? `(${dAp.city})` : ""}
              <span style={{ fontFamily: ff.mono, color: c.muted, marginLeft: 10 }}>
                {fmtTime(flight.scheduled_departure)} – {fmtTime(flight.scheduled_arrival)}
              </span>
            </div>
          </div>
          <span
            style={{
              marginLeft: "auto", fontSize: 10, fontWeight: 550, letterSpacing: "0.08em",
              textTransform: "uppercase", color: c.muted,
              padding: "3px 9px", borderRadius: 999, border: "1px solid var(--ae-line)",
            }}
          >
            placeholder manifest
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 8, cursor: "pointer",
              background: "transparent", border: "1px solid var(--ae-line)",
              display: "flex", alignItems: "center", justifyContent: "center", color: c.body,
            }}
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        <div style={{ display: "flex", minHeight: 0 }}>
          {/* stats column */}
          <div style={{ width: 250, flexShrink: 0, padding: 20, borderRight: "1px solid var(--ae-line)", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { l: "Passengers", v: `${occupied} / ${seats.total}` },
              { l: "Load factor", v: `${Math.round(loadFactor * 100)}%` },
              { l: "First class", v: "16 seats · 2–2" },
              { l: "Economy", v: "120 seats · 3–3" },
              { l: "Bags checked", v: `${Math.round(occupied * 0.8)}` },
              { l: "Cargo", v: `${(1.4 + seeded(flight.id + "c") * 2.2).toFixed(1)} t` },
            ].map((s) => (
              <div key={s.l} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--ae-surface-2)", border: "1px solid var(--ae-line)" }}>
                <div style={{ fontSize: 10.5, color: c.muted, marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontFamily: ff.mono, fontSize: 14, fontWeight: 600, color: c.ink }}>{s.v}</div>
              </div>
            ))}

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
              {[
                { l: "Occupied", sw: { background: TEAL } },
                { l: "Available", sw: { border: `1.5px solid ${SEAT_EMPTY_STROKE}` } },
              ].map((k) => (
                <span key={k.l} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, color: c.body }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, ...k.sw }} />
                  {k.l}
                </span>
              ))}
            </div>
          </div>

          {/* seat map */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 12px", display: "flex", justifyContent: "center", background: "var(--ae-surface-2)" }}>
            <svg width={svgW * 0.78} viewBox={`0 0 ${svgW} ${fuseH}`} style={{ display: "block" }}>
              {/* wing hints */}
              <path d={`M ${cx - fuseW / 2} ${fuseH * 0.42} L 8 ${fuseH * 0.58} L 8 ${fuseH * 0.62} L ${cx - fuseW / 2} ${fuseH * 0.52} Z`} fill="rgba(15,20,18,0.05)" />
              <path d={`M ${cx + fuseW / 2} ${fuseH * 0.42} L ${svgW - 8} ${fuseH * 0.58} L ${svgW - 8} ${fuseH * 0.62} L ${cx + fuseW / 2} ${fuseH * 0.52} Z`} fill="rgba(15,20,18,0.05)" />

              {/* fuselage */}
              <path
                d={`M ${cx} 6
                    C ${cx + fuseW * 0.32} 16 ${cx + fuseW / 2} 52 ${cx + fuseW / 2} 96
                    L ${cx + fuseW / 2} ${fuseH - 70}
                    C ${cx + fuseW / 2} ${fuseH - 34} ${cx + fuseW * 0.26} ${fuseH - 12} ${cx} ${fuseH - 8}
                    C ${cx - fuseW * 0.26} ${fuseH - 12} ${cx - fuseW / 2} ${fuseH - 34} ${cx - fuseW / 2} ${fuseH - 70}
                    L ${cx - fuseW / 2} 96
                    C ${cx - fuseW / 2} 52 ${cx - fuseW * 0.32} 16 ${cx} 6 Z`}
                fill="var(--ae-surface)"
                stroke="rgba(15,20,18,0.22)"
                strokeWidth="1.5"
              />
              {/* cockpit divider */}
              <line x1={cx - fuseW / 2 + 10} y1={62} x2={cx + fuseW / 2 - 10} y2={62} stroke="rgba(15,20,18,0.12)" />
              <text x={cx} y={44} textAnchor="middle" fontFamily={ff.mono} fontSize="10" fill={c.muted as string}>FLIGHT DECK</text>

              {/* class labels */}
              <text x={cx - fuseW / 2 + 14} y={rowsY[0] - 8} fontFamily={ff.mono} fontSize="9" fill={c.muted as string}>FIRST</text>
              <text x={cx - fuseW / 2 + 14} y={rowsY[4] - 8} fontFamily={ff.mono} fontSize="9" fill={c.muted as string}>ECONOMY</text>

              {/* seats */}
              {CABIN.map((row, ri) => (
                <g key={ri}>
                  {row.exit && (
                    <>
                      <rect x={cx - fuseW / 2 - 3} y={rowsY[ri] + 1} width={6} height={SEAT - 2} rx={2} fill={TEAL} />
                      <rect x={cx + fuseW / 2 - 3} y={rowsY[ri] + 1} width={6} height={SEAT - 2} rx={2} fill={TEAL} />
                    </>
                  )}
                  {row.cols.map((_, ci) => {
                    const on = seats.map[ri][ci]
                    const w = row.cls === "F" ? SEAT + 4 : SEAT
                    return (
                      <rect
                        key={ci}
                        x={seatX(row, ci)}
                        y={rowsY[ri]}
                        width={w}
                        height={SEAT}
                        rx={3.5}
                        fill={on ? TEAL : "var(--ae-surface)"}
                        fillOpacity={on ? (row.cls === "F" ? 0.95 : 0.8) : 1}
                        stroke={on ? "none" : SEAT_EMPTY_STROKE}
                        strokeWidth={1.2}
                      />
                    )
                  })}
                  <text
                    x={cx + fuseW / 2 + 14}
                    y={rowsY[ri] + SEAT - 3}
                    fontFamily={ff.mono}
                    fontSize="8.5"
                    fill="rgba(15,20,18,0.35)"
                  >
                    {ri + 1}
                  </text>
                </g>
              ))}

              {/* tail */}
              <text x={cx} y={fuseH - 22} textAnchor="middle" fontFamily={ff.mono} fontSize="9" fill={c.muted as string}>GALLEY</text>
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
