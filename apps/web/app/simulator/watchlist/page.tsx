"use client"
/**
 * Watchlist — the flights this operator is tracking.
 *
 * This used to live below the fold of the main dashboard, where it forced the
 * ops surface into a scrolling document: reaching it scrolled the map AND the
 * cascade timeline completely out of view (measured: 552px of 1352px, 40.8% of
 * the document, below the fold at 1280x800). An ops console must not be able
 * to scroll away mid-incident, so the dashboard shell is now fixed and this
 * moved to a route of its own, reachable from the rail.
 */

import { useRouter } from "next/navigation"
import { SimulatorPageShell } from "@/components/simulator/page-shell"
import { MyFlights } from "@/components/simulator/my-flights"

export default function WatchlistPage() {
  const router = useRouter()
  return (
    <SimulatorPageShell
      breadcrumbs={[{ label: "Live map", href: "/simulator" }, { label: "Watchlist" }]}
      title="Watchlist"
      subtitle="Flights you are tracking, with live status and delay"
    >
      {/* Selecting a flight hands off to the live map, which owns flight
          inspection — the watchlist is a way in, not a second inspector. */}
      <MyFlights onFlightSelect={() => router.push("/simulator")} />
    </SimulatorPageShell>
  )
}
