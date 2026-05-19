"use client"
// AirportCode — inline span that renders an airport code (default IATA)
// and shows a polished hover popover with the full airport name + city.
//
// Most users on the simulator have no idea what "KBOS" means; the dashboard
// was scattered with bare ICAO/IATA codes that gave non-experts no context.
// Wrap any user-facing airport code in this component to surface the city
// and airport name on hover with a smooth framer-motion fade/scale.

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { airportLabel } from "@/lib/labels"
import { c, ff, r, sh } from "@/lib/design-tokens"

export type AirportCodeFormat = "iata" | "icao"

export function AirportCode({
  code,
  format = "iata",
  className = "",
  showFAA,
  faa,
}: {
  code: string
  format?: AirportCodeFormat
  className?: string
  /** Optional "GS" / "GDP+45m" badge surfaced inside the popover */
  showFAA?: boolean
  faa?: { type: string; delay_minutes: number; reason?: string }
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<"top" | "bottom">("top")
  const ref = useRef<HTMLSpanElement | null>(null)
  const ap = airportLabel(code)
  const display = format === "icao" ? ap.icao : (ap.iata || ap.icao)

  // Decide whether to flip below the trigger when there isn't enough space above
  const handleEnter = () => {
    setOpen(true)
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos(rect.top < 80 ? "bottom" : "top")
    }
  }

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
      onFocus={handleEnter}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      className={`relative inline-flex items-center cursor-help outline-none ${className}`}
      style={{ borderBottom: `1px dotted ${c.muted}` }}
    >
      <span style={{ fontFamily: ff.mono, fontVariantNumeric: "tabular-nums" }}>{display}</span>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: pos === "top" ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: pos === "top" ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute z-[1000] left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              [pos === "top" ? "bottom" : "top"]: "calc(100% + 6px)",
            } as React.CSSProperties}
          >
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                borderRadius: r.md,
                padding: "8px 12px",
                textAlign: "left",
                background: c.surfaceDark,
                color: c.onPrimary,
                border: `1px solid ${c.surfaceDark}`,
                boxShadow: sh.overlay,
                fontFamily: ff.body,
              }}
            >
              <span style={{ display: "block", fontSize: 11, fontWeight: 500, letterSpacing: "0.02em" }}>
                <span style={{ fontFamily: ff.mono, fontWeight: 600 }}>{ap.iata || ap.icao}</span>
                {ap.iata && ap.icao && ap.iata !== ap.icao && (
                  <span style={{ fontFamily: ff.mono, color: "rgba(255,255,255,0.55)", marginLeft: 6 }}>
                    · {ap.icao}
                  </span>
                )}
              </span>
              {(ap.name || ap.city) && (
                <span style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.78)", marginTop: 2 }}>
                  {[ap.name, ap.city].filter(Boolean).join(" · ")}
                </span>
              )}
              {showFAA && faa && (
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 500,
                    marginTop: 4,
                    color: faa.type === "ground_stop" ? c.statusCancelled.dot : c.signaturePeach,
                  }}
                >
                  {faa.type === "ground_stop"
                    ? "Ground Stop in effect"
                    : faa.type === "ground_delay_program"
                    ? `GDP · +${faa.delay_minutes}m`
                    : `+${faa.delay_minutes}m dep delay`}
                </span>
              )}
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%) rotate(45deg)",
                  width: 8,
                  height: 8,
                  background: c.surfaceDark,
                  border: `1px solid ${c.surfaceDark}`,
                  borderTop: pos === "top" ? "none" : undefined,
                  borderLeft: pos === "top" ? "none" : undefined,
                  borderBottom: pos === "bottom" ? "none" : undefined,
                  borderRight: pos === "bottom" ? "none" : undefined,
                  [pos === "top" ? "bottom" : "top"]: "-4px",
                } as React.CSSProperties}
              />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Convenience: renders "KBOS → KORD" (or IATA equivalents) with both
 *  endpoints individually wrapped so each gets its own popover. */
export function RoutePair({
  origin,
  destination,
  format = "iata",
  className = "",
}: {
  origin: string
  destination: string
  format?: AirportCodeFormat
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <AirportCode code={origin} format={format} />
      <span style={{ color: c.muted }}>→</span>
      <AirportCode code={destination} format={format} />
    </span>
  )
}
