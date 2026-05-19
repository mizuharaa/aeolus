"use client"
import { PassengerSolutions } from "@/components/simulator/passenger-solutions"
import { ContentCard } from "@/components/ds/primitives"
import { c, sp } from "@/lib/design-tokens"
import { SimulatorPageShell } from "@/components/simulator/page-shell"

/**
 * Passenger solutions — Slice 3.
 *
 * Dedicated route for the rebooking / hotel / DOT 261 compensation flow that
 * previously lived below the main simulator fold.
 */
export default function PassengersPage() {
  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Passengers" },
      ]}
      title="Passenger solutions"
      subtitle="Per-flight rebooking, hotel allocation, meal vouchers, and DOT Part 261 compensation. Compare strategies side-by-side."
    >
      <ContentCard padding={0} style={{ overflow: "hidden", background: c.canvas }}>
        <div style={{ minHeight: 480, padding: sp.md }}>
          <PassengerSolutions />
        </div>
      </ContentCard>
    </SimulatorPageShell>
  )
}
