"use client"
/**
 * AgentCommandDemo — the floating agent console inside the demo screen.
 * Purely presentational: the master timeline types into .ag-cmd, blinks
 * .ag-caret, and reveals the .ag-line response rows at story beats.
 * This is a frontend demo of a future command layer, not a live agent.
 */

import { AGENT_LINES } from "@/components/landing/demo/demo-data"
import { AeolusMark } from "@/components/ds/logo"

export function AgentCommandDemo({ staticMode }: { staticMode: boolean }) {
  return (
    <div
      className="demo-card ag-card"
      style={{
        position: "absolute",
        left: 14,
        bottom: 14,
        zIndex: 30,
        width: "min(330px, 58%)",
        padding: "12px 14px",
        backdropFilter: "blur(6px)",
        background: "rgba(255, 255, 255, 0.94)",
        boxShadow: "0 8px 28px rgba(11, 36, 52, 0.12)",
        opacity: staticMode ? 1 : 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <AeolusMark size={15} style={{ color: "var(--dk-text)" }} accent="var(--dk-amber)" />
        <span className="demo-chrome-label">Aeolus agent</span>
        <span className="demo-chrome-label" style={{ marginLeft: "auto", color: "var(--dk-teal)" }}>
          demo
        </span>
      </div>

      <div
        style={{
          fontFamily: "var(--ae-font-mono)",
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--dk-text)",
          minHeight: 36,
        }}
      >
        <span style={{ color: "var(--dk-amber)" }}>&gt; </span>
        <span className="ag-cmd" />
        <span
          className="ag-caret"
          style={{
            display: "inline-block",
            width: 7,
            height: 13,
            marginLeft: 2,
            verticalAlign: "-2px",
            background: "var(--dk-amber)",
          }}
        />
      </div>

      <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
        {AGENT_LINES.map((l, i) => (
          <div
            key={i}
            className={`ag-line ag-line-${i}`}
            style={{
              fontFamily: "var(--ae-font-mono)",
              fontSize: 11,
              color: "var(--dk-muted)",
              opacity: staticMode ? 1 : 0,
            }}
          >
            <span style={{ color: "var(--dk-teal)" }}>→ </span>
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}
