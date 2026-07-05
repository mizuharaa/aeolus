"use client"
/**
 * AgentBubble — placeholder for the future Aeolus command layer.
 *
 * A small floating pill in the dashboard's bottom-right that expands into
 * a quiet panel with example commands and a (not yet connected) input.
 * Pure frontend: nothing here talks to the backend. To remove or connect
 * later, this file + one mount line in app/simulator/page.tsx is all
 * there is. Styled with the landing's ink/beige/amber identity so the
 * brand reads consistently across pages.
 */

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CornerDownLeft, X } from "lucide-react"
import { AeolusMark } from "@/components/ds/logo"

const INK = "#1A1622"
const BONE = "#F0EBDF"
const AMBER = "#EFAF1B"

const EXAMPLES = [
  "Trigger a weather closure at KORD, severity 4",
  "Compare plans B and C by passenger impact",
  "Why was NB204 cancelled?",
]

export function AgentBubble() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 46 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 0.9, 0.28, 1] }}
            style={{
              position: "absolute",
              right: 0,
              bottom: 52,
              width: 320,
              borderRadius: 14,
              background: INK,
              color: BONE,
              border: "1px solid rgba(240,235,223,0.14)",
              boxShadow: "0 24px 64px rgba(10,6,26,0.4)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "12px 14px",
                borderBottom: "1px solid rgba(240,235,223,0.12)",
              }}
            >
              <AeolusMark size={17} style={{ color: BONE }} accent={AMBER} />
              <span style={{ fontFamily: "var(--ae-font-display)", fontWeight: 650, fontSize: 13.5 }}>
                Aeolus agent
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--ae-font-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(240,235,223,0.55)",
                }}
              >
                Preview
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close agent panel"
                style={{ background: "none", border: "none", color: BONE, cursor: "pointer", display: "inline-flex", padding: 2 }}
              >
                <X style={{ width: 14, height: 14 }} strokeWidth={2} />
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(240,235,223,0.66)", lineHeight: 1.5 }}>
                The command layer will drive the console from plain language.
                Examples of what it will take:
              </span>
              {EXAMPLES.map((e) => (
                <span
                  key={e}
                  style={{
                    fontFamily: "var(--ae-font-mono)",
                    fontSize: 11.5,
                    lineHeight: 1.45,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(240,235,223,0.14)",
                    color: "rgba(240,235,223,0.85)",
                  }}
                >
                  {e}
                </span>
              ))}
            </div>

            <div style={{ padding: "0 14px 14px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 10,
                  border: "1px solid rgba(240,235,223,0.18)",
                  padding: "9px 11px",
                }}
              >
                <input
                  disabled
                  placeholder="Ask Aeolus to trigger a disruption…"
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    fontSize: 12.5,
                    color: BONE,
                    fontFamily: "var(--ae-font-body)",
                  }}
                />
                <CornerDownLeft style={{ width: 13, height: 13, color: "rgba(240,235,223,0.4)" }} strokeWidth={2} />
              </div>
              <span style={{ display: "block", marginTop: 8, fontSize: 10.5, color: "rgba(240,235,223,0.45)" }}>
                Not connected yet — ships with the agent backend.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -2 }}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: "10px 16px",
          borderRadius: 999,
          background: INK,
          color: BONE,
          border: "1px solid rgba(240,235,223,0.16)",
          boxShadow: "0 10px 30px rgba(10,6,26,0.32)",
          cursor: "pointer",
          fontFamily: "var(--ae-font-body)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <AeolusMark size={16} style={{ color: BONE }} accent={AMBER} />
        Ask Aeolus
      </motion.button>
    </div>
  )
}
