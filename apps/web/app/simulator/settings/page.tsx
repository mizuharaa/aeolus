"use client"
/**
 * SETTINGS — /simulator/settings.
 *
 * This route did not exist. The account menu carried two links to it and both
 * were dead, so "Settings" and "Keyboard shortcuts" 404'd from a console that
 * commits schedule changes.
 *
 * It also does the job the rebuild asked of it: the board stays compact by
 * moving everything that is set ONCE off the board and one click away. The
 * test applied to each control was "how often does a dispatcher touch this
 * during a shift" — per-incident controls stayed on the board, per-operator
 * and per-install controls came here.
 *
 * What moved here, and from where:
 *   · the three-state register switch (bar keeps a light/dark toggle)
 *   · map defaults — projection, basemap labels, ambient traffic
 *   · layout defaults, plus a reset for the persisted column/rail sizes
 *   · the keyboard map, which was previously written down nowhere
 *
 * Everything reads and writes the same localStorage keys the board already
 * uses, so a change here is the same change the board would have made. No
 * second source of truth: a settings screen that keeps its own copy of a
 * preference is how two surfaces start disagreeing about the same value.
 */

import { useCallback, useEffect, useState } from "react"
import { Monitor, Moon, Sun, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { SimulatorPageShell, BackToSimulator } from "@/components/simulator/page-shell"
import { useConsoleTheme, type ThemeChoice } from "@/lib/use-theme"
import { c, ff, r, sp } from "@/lib/design-tokens"
import { RULE, Module, Chip, Mark } from "@/components/simulator/board"

/* ── A settings row. Label, description, control — one grammar throughout. ── */
function Row({
  label,
  help,
  htmlFor,
  children,
}: {
  label: string
  help?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: sp.md,
        padding: `${sp.sm}px ${sp.md}px`,
        borderBottom: RULE,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <label
          htmlFor={htmlFor}
          style={{ display: "block", fontFamily: ff.body, fontSize: 13, fontWeight: 600, color: c.ink }}
        >
          {label}
        </label>
        {help && (
          <p style={{ margin: "3px 0 0", fontFamily: ff.body, fontSize: 12, lineHeight: 1.45, color: c.muted, maxWidth: 620 }}>
            {help}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: sp.xs, paddingTop: 1 }}>
        {children}
      </div>
    </div>
  )
}

/* ── A real switch, not a styled checkbox. Keyboard-operable, labelled, and
      it states its state in text for screen readers rather than by colour. ── */
function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="ae-bar-btn"
      style={{
        position: "relative",
        width: 40,
        height: 24,
        flexShrink: 0,
        borderRadius: 999,
        border: `1px solid ${checked ? c.teal : c.borderStrong}`,
        background: checked ? "var(--ae-teal-bg)" : "transparent",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: checked ? c.teal : c.borderStrong,
          transition: "left 140ms cubic-bezier(0.22, 0.9, 0.28, 1), background 140ms",
        }}
      />
    </button>
  )
}

/** Persisted boolean backed by the same localStorage key the board reads. */
function useStoredFlag(key: string, fallback: boolean) {
  const [on, setOn] = useState(fallback)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === "0") setOn(false)
      else if (raw === "1") setOn(true)
    } catch {}
  }, [key])
  const set = useCallback(
    (next: boolean) => {
      setOn(next)
      try { localStorage.setItem(key, next ? "1" : "0") } catch {}
    },
    [key],
  )
  return [on, set] as const
}

const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: "[", does: "Show or hide the working column" },
  { keys: "]", does: "Show or hide the cascade rail" },
  { keys: "← →", does: "Resize the focused divider by 16px" },
  { keys: "Shift + ← →", does: "Resize the focused divider by 64px" },
  { keys: "Home / End", does: "Send the focused divider to its minimum or maximum" },
  { keys: "Esc", does: "Close the account menu or an open overlay" },
  { keys: "Tab", does: "Move through the board; Skip to workspace is the first stop" },
]

export default function SettingsPage() {
  const { choice, resolved, set } = useConsoleTheme()

  const [ambient, setAmbient] = useStoredFlag("aeolus-map-ambient", true)
  const [labels, setLabels] = useStoredFlag("aeolus-map-labels", true)
  const [announce, setAnnounce] = useStoredFlag("aeolus-announce", true)

  const REGISTERS: { id: ThemeChoice; label: string; Icon: typeof Sun; help: string }[] = [
    { id: "light", label: "Light", Icon: Sun, help: "The white board" },
    { id: "dark", label: "Dark", Icon: Moon, help: "The night register" },
    { id: "system", label: "System", Icon: Monitor, help: "Follow the OS" },
  ]

  const resetLayout = () => {
    try {
      for (const k of ["aeolus-col-w", "aeolus-tl-h", "aeolus-col-open", "aeolus-tl-open"]) {
        localStorage.removeItem(k)
      }
    } catch {}
    toast.success("Layout reset", { description: "Column width and rail height return to their defaults on the next load." })
  }

  return (
    <SimulatorPageShell
      breadcrumbs={[{ label: "Simulator", href: "/simulator" }, { label: "Settings" }]}
      title="Settings"
      subtitle="Everything here is set once and remembered on this browser. Controls used during an incident stay on the board."
      actions={<BackToSimulator />}
      maxWidth={880}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: sp.md }}>
        {/* ── Register ── */}
        <Module title="Register" fringe="spectral" style={{ border: RULE, borderRadius: r.sm }} bodyStyle={{ overflow: "visible" }}>
          <Row
            label="Console register"
            help="The board is read for a whole shift in a room whose lighting you do not control, so 'follow the OS' is a real answer rather than a power-user extra. The bar keeps a light/dark toggle for switching mid-shift; this is where the third state lives."
          >
            <div role="radiogroup" aria-label="Console register" style={{ display: "flex", gap: 4 }}>
              {REGISTERS.map(({ id, label, Icon, help }) => {
                const on = choice === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${label} — ${help}`}
                    title={help}
                    onClick={() => set(id)}
                    className="ae-bar-btn"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      height: 30, padding: `0 ${sp.xs}px`, borderRadius: r.xs,
                      border: `1px solid ${on ? c.teal : c.hairline}`,
                      background: on ? "var(--ae-teal-bg)" : "transparent",
                      color: on ? c.tealInk : c.body,
                      fontFamily: ff.body, fontSize: 12, fontWeight: on ? 600 : 500,
                      cursor: "pointer",
                    }}
                  >
                    <Icon aria-hidden style={{ width: 13, height: 13 }} strokeWidth={2} />
                    {label}
                  </button>
                )
              })}
            </div>
          </Row>
          <Row label="Currently showing" help="The register in effect right now, after resolving 'System' against this device.">
            <Chip tone="teal">{resolved === "dark" ? "DARK" : "LIGHT"}</Chip>
          </Row>
        </Module>

        {/* ── Map ── */}
        <Module title="Map" style={{ border: RULE, borderRadius: r.sm }} bodyStyle={{ overflow: "visible" }}>
          <Row
            label="Other carriers' ADS-B traffic"
            help="Ambient live traffic that is not Nimbus Air. It is context, not your network — roughly 97% of the marks on screen when it is on."
            htmlFor="set-ambient"
          >
            <Toggle id="set-ambient" checked={ambient} onChange={setAmbient} label="Show other carriers' ADS-B traffic" />
          </Row>
          <Row
            label="Basemap place labels"
            help="City and region names on the tiles. Turning them off leaves only your own marks and the coastlines."
            htmlFor="set-labels"
          >
            <Toggle id="set-labels" checked={labels} onChange={setLabels} label="Show basemap place labels" />
          </Row>
          <Row
            label="Basemap follows the register"
            help="The tiles flip with the console: CARTO Positron on the light board, dark_all on the night register. This is not optional — a light basemap under a dark console is the single loudest thing on the screen."
          >
            <Mark kind="applied" label="Always" />
          </Row>
        </Module>

        {/* ── Board ── */}
        <Module title="Board" style={{ border: RULE, borderRadius: r.sm }} bodyStyle={{ overflow: "visible" }}>
          <Row
            label="Product announcements"
            help="Feature notes in the working column. They never take a full-width row on the board."
            htmlFor="set-announce"
          >
            <Toggle id="set-announce" checked={announce} onChange={setAnnounce} label="Show product announcements" />
          </Row>
          <Row
            label="Reset the layout"
            help="Clears the remembered column width, cascade-rail height, and which regions were open. Takes effect on the next load of the board."
          >
            <button
              type="button"
              onClick={resetLayout}
              className="ae-bar-btn"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 30, padding: `0 ${sp.xs}px`, borderRadius: r.xs,
                border: RULE, background: "transparent", color: c.body,
                fontFamily: ff.body, fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >
              <RotateCcw aria-hidden style={{ width: 13, height: 13 }} strokeWidth={2} />
              Reset layout
            </button>
          </Row>
        </Module>

        {/* ── Keyboard ── */}
        <Module title="Keyboard" style={{ border: RULE, borderRadius: r.sm }} bodyStyle={{ overflow: "visible" }}>
          <div id="shortcuts" style={{ scrollMarginTop: 64 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <caption style={{ textAlign: "left", padding: `${sp.xs}px ${sp.md}px 0`, fontFamily: ff.body, fontSize: 12, color: c.muted }}>
                The board is fully keyboard-operable. Dividers are real separator widgets, so they take arrow keys once focused.
              </caption>
              <tbody>
                {SHORTCUTS.map((s) => (
                  <tr key={s.keys} style={{ borderBottom: RULE }}>
                    <th
                      scope="row"
                      style={{
                        width: 160, textAlign: "left", verticalAlign: "top",
                        padding: `${sp.xs}px ${sp.md}px`,
                        fontFamily: ff.mono, fontSize: 11.5, fontWeight: 600, color: c.ink,
                      }}
                    >
                      {s.keys}
                    </th>
                    <td style={{ padding: `${sp.xs}px ${sp.md}px`, fontFamily: ff.body, fontSize: 12.5, color: c.body }}>
                      {s.does}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Module>

        {/* ── Session ── */}
        <Module title="Session" style={{ border: RULE, borderRadius: r.sm }} bodyStyle={{ overflow: "visible" }}>
          <Row
            label="Nimbus Air"
            help="A synthetic carrier loaded from YAML at API startup. It is not a real airline and its network is not a real schedule."
          >
            <Chip>SIMULATED</Chip>
          </Row>
          <Row
            label="Signed in as"
            help="The demo operator this in-memory session runs as. There is no auth tier — the API holds no accounts."
          >
            <Chip>DUTY DISPATCHER</Chip>
          </Row>
        </Module>
      </div>
    </SimulatorPageShell>
  )
}
