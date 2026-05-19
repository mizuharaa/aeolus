"use client"
import { PlanCompare } from "@/components/simulator/plan-compare"
import { SimulatorPageShell, NoActiveDisruptionState } from "@/components/simulator/page-shell"
import { useSimulationStore, useHasActiveDisruption } from "@/stores/simulation"
import { ContentCard, Eyebrow } from "@/components/ds/primitives"
import { c, ff, sp } from "@/lib/design-tokens"

/**
 * Plan compare — Slice 3.
 *
 * Lifts the previously below-fold `PlanCompare` panel into a dedicated route
 * so the main simulator stays the operator focus surface.
 */
export default function PlansComparePage() {
  const { recoveryPlans } = useSimulationStore()
  const hasDisruption = useHasActiveDisruption()

  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Recovery plans", href: "/simulator/plans" },
        { label: "Compare" },
      ]}
      title="Compare plans side-by-side"
      subtitle="Pick any two plans and see exactly where they diverge — cost, pax impact, FAR 117 flags, repositioning, carbon."
    >
      {!hasDisruption ? (
        <NoActiveDisruptionState
          title="Need at least two plans to compare."
          description="Trigger a disruption from the simulator. The optimizer will produce four plans — Plan A through D — that you can compare here."
        />
      ) : recoveryPlans.length < 2 ? (
        // Disruption active but the solver hasn't returned enough plans yet.
        // Brief solving placeholder so the page doesn't blank out.
        <ContentCard padding={sp.xl} style={{ textAlign: "center" }}>
          <Eyebrow color={c.signatureForest}>Solving</Eyebrow>
          <div style={{ marginTop: 8, fontFamily: ff.body, fontSize: 14, color: c.body }}>
            Waiting for at least two plans to land&hellip;
          </div>
        </ContentCard>
      ) : (
        <PlanCompare />
      )}
    </SimulatorPageShell>
  )
}
