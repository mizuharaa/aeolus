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
      style={{ borderBottom: "1px dotted rgba(13,148,136,0.45)" }}
    >
      <span className="font-mono">{display}</span>
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
              className="inline-block whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left"
              style={{
                background: "rgba(13,38,36,0.96)",
                color: "#FFFFFF",
                border: "1px solid rgba(13,148,136,0.45)",
                boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
                backdropFilter: "blur(8px)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span className="block text-[11px] font-bold tracking-wide">
                <span className="font-mono">{ap.iata || ap.icao}</span>
                {ap.iata && ap.icao && ap.iata !== ap.icao && (
                  <span className="font-mono text-teal-200/70 ml-1.5">· {ap.icao}</span>
                )}
              </span>
              {(ap.name || ap.city) && (
                <span className="block text-[10px] text-teal-100/85 mt-0.5">
                  {[ap.name, ap.city].filter(Boolean).join(" · ")}
                </span>
              )}
              {showFAA && faa && (
                <span
                  className="block text-[10px] mt-1 font-semibold"
                  style={{ color: faa.type === "ground_stop" ? "#FCA5A5" : "#FED7AA" }}
                >
                  {faa.type === "ground_stop"
                    ? "Ground Stop in effect"
                    : faa.type === "ground_delay_program"
                    ? `GDP · +${faa.delay_minutes}m`
                    : `+${faa.delay_minutes}m dep delay`}
                </span>
              )}
              <span
                className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                style={{
                  [pos === "top" ? "bottom" : "top"]: "-4px",
                  background: "rgba(13,38,36,0.96)",
                  border: "1px solid rgba(13,148,136,0.45)",
                  borderTop: pos === "top" ? "none" : undefined,
                  borderLeft: pos === "top" ? "none" : undefined,
                  borderBottom: pos === "bottom" ? "none" : undefined,
                  borderRight: pos === "bottom" ? "none" : undefined,
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
      <span className="text-muted-foreground/70">→</span>
      <AirportCode code={destination} format={format} />
    </span>
  )
}
