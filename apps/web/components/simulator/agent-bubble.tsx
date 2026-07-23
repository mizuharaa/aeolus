"use client"
/**
 * AgentBubble — "Ask Aeolus", the grounded OCC copilot.
 *
 * A floating pill in the dashboard's bottom-right that expands into a chat
 * panel. Every question is answered by the backend /agent/ask route, which
 * snapshots the live engine state (events, cascade, plans, fleet) and asks
 * Gemini to answer grounded in those exact numbers — so answers cite the
 * console's own figures instead of hallucinating.
 *
 * Rate limit: the backend allows ~10 questions/min per IP; a 429 shows as a
 * quiet inline notice, not an error wall.
 */

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CornerDownLeft, X } from "lucide-react"
import { AeolusMark } from "@/components/ds/logo"
import { apiClient } from "@/lib/api"

const INK = "#1A1622"
const BONE = "#F0EBDF"
const AMBER = "#B8863C"

const EXAMPLES = [
  "What's the state of the network right now?",
  "Compare the recovery plans by passenger impact",
  "Which flights are hit worst, and why?",
]

type Msg = { role: "user" | "model"; text: string; error?: boolean }

export function AgentBubble() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // keep the newest message in view
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    setInput("")
    setBusy(true)
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))
    setMsgs((m) => [...m, { role: "user", text: question }])
    try {
      const res = await apiClient.post<{ answer: string }>("/agent/ask", { question, history })
      setMsgs((m) => [...m, { role: "model", text: res.data.answer }])
    } catch (e) {
      const text = e instanceof Error ? e.message : "Copilot unavailable"
      setMsgs((m) => [...m, { role: "model", text, error: true }])
    } finally {
      setBusy(false)
    }
  }

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
              width: "min(390px, calc(100vw - 40px))",
              borderRadius: 14,
              background: INK,
              color: BONE,
              border: "1px solid rgba(240,235,223,0.14)",
              boxShadow: "0 24px 64px rgba(10,6,26,0.4)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "12px 14px",
                borderBottom: "1px solid rgba(240,235,223,0.12)",
                flexShrink: 0,
              }}
            >
              <AeolusMark size={17} style={{ color: BONE }} accent={AMBER} />
              <span style={{ fontFamily: "var(--ae-font-display)", fontWeight: 650, fontSize: 13.5 }}>
                Aeolus copilot
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
                Grounded · live state
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close copilot panel"
                style={{ background: "none", border: "none", color: BONE, cursor: "pointer", display: "inline-flex", padding: 2 }}
              >
                <X style={{ width: 14, height: 14 }} strokeWidth={2} />
              </button>
            </div>

            {/* conversation */}
            <div
              ref={scrollRef}
              className="ae-scroll-smooth"
              style={{
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                overflowY: "auto",
                maxHeight: "min(46vh, 420px)",
                minHeight: 120,
              }}
            >
              {msgs.length === 0 && (
                <>
                  <span style={{ fontSize: 12, color: "rgba(240,235,223,0.66)", lineHeight: 1.5 }}>
                    Ask about the live network — events, cascades, recovery plans,
                    costs. Answers cite the console&apos;s own numbers.
                  </span>
                  {EXAMPLES.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => ask(e)}
                      style={{
                        fontFamily: "var(--ae-font-mono)",
                        fontSize: 11.5,
                        lineHeight: 1.45,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(240,235,223,0.14)",
                        color: "rgba(240,235,223,0.85)",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 150ms ease, background 150ms ease",
                      }}
                      onMouseEnter={(ev) => { (ev.currentTarget.style.borderColor = "rgba(240,235,223,0.4)") }}
                      onMouseLeave={(ev) => { (ev.currentTarget.style.borderColor = "rgba(240,235,223,0.14)") }}
                    >
                      {e}
                    </button>
                  ))}
                </>
              )}

              {msgs.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "8px 11px",
                    borderRadius: m.role === "user" ? "11px 11px 3px 11px" : "11px 11px 11px 3px",
                    background: m.role === "user" ? "rgba(240,235,223,0.12)" : "rgba(240,235,223,0.05)",
                    border: `1px solid ${m.error ? "rgba(193,58,107,0.5)" : "rgba(240,235,223,0.10)"}`,
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    color: m.error ? "#E8A2BC" : BONE,
                  }}
                >
                  {m.text}
                </div>
              ))}

              {busy && (
                <div
                  aria-label="Copilot is thinking"
                  style={{
                    alignSelf: "flex-start",
                    padding: "8px 12px",
                    borderRadius: "11px 11px 11px 3px",
                    background: "rgba(240,235,223,0.05)",
                    border: "1px solid rgba(240,235,223,0.10)",
                    fontFamily: "var(--ae-font-mono)",
                    fontSize: 11,
                    color: "rgba(240,235,223,0.6)",
                  }}
                >
                  <span className="ab-dots">reading the ops state</span>
                </div>
              )}
            </div>

            {/* input */}
            <form
              onSubmit={(e) => { e.preventDefault(); ask(input) }}
              style={{ padding: "0 14px 14px", flexShrink: 0 }}
            >
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
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={busy}
                  placeholder={busy ? "Thinking…" : "Ask about events, plans, costs…"}
                  aria-label="Ask the Aeolus copilot"
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    fontSize: 12.5,
                    color: BONE,
                    fontFamily: "var(--ae-font-body)",
                    opacity: busy ? 0.6 : 1,
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  style={{
                    background: "none", border: "none", cursor: busy || !input.trim() ? "default" : "pointer",
                    display: "inline-flex", padding: 2,
                    color: input.trim() && !busy ? AMBER : "rgba(240,235,223,0.4)",
                  }}
                >
                  <CornerDownLeft style={{ width: 14, height: 14 }} strokeWidth={2} />
                </button>
              </div>
            </form>

            <style jsx>{`
              .ab-dots::after { content: "…"; animation: ab-blink 1.2s steps(4) infinite; }
              @keyframes ab-blink { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
            `}</style>
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
