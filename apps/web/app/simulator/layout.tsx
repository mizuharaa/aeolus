import type { ReactNode } from "react"
import { SimulatorRail } from "@/components/simulator/rail"

/**
 * Shared shell for every /simulator route: a collapsible left icon-rail
 * (primary section nav) with the page to its right. The rail is sticky and
 * full-height; page content flexes into the remaining width.
 */
export default function SimulatorLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", minHeight: "100vh", background: "var(--ae-bg)" }}>
      <SimulatorRail />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
