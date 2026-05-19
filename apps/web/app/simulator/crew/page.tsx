"use client"
import { CrewOverbooking } from "@/components/simulator/crew-overbooking"
import { ContentCard } from "@/components/ds/primitives"
import { c, sp } from "@/lib/design-tokens"
import { SimulatorPageShell } from "@/components/simulator/page-shell"

/**
 * Crew dashboard — Slice 3.
 *
 * Lifts the previously below-fold `CrewOverbooking` panel into a dedicated
 * route. The whole crew-shortage MILP analysis fits one page now.
 */
export default function CrewPage() {
  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Crew" },
      ]}
      title="Crew shortage analysis"
      subtitle="FAR Part 117 legal-crew coverage MILP. Trigger a crew sickout and see the maximum-coverage reassignment, plus DOT 261 compensation cost on every uncovered flight."
    >
      <ContentCard padding={0} style={{ overflow: "hidden", background: c.canvas }}>
        <div style={{ minHeight: 480, padding: sp.md }}>
          <CrewOverbooking />
        </div>
      </ContentCard>
    </SimulatorPageShell>
  )
}
