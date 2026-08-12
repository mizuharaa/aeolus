"use client"
import { useEffect } from "react"
import { Radar, X } from "lucide-react"
import { useSimulationStore } from "@/stores/simulation"
import { c, ff, r, sp } from "@/lib/design-tokens"

/**
 * Feature announcement, dismissible and stays dismissed (localStorage, via the
 * simulation store). Sits in the same slot as the degraded-feed banner and
 * borrows its shape, but takes the teal identity rather than amber: this is
 * news, not a warning, and the two must never be mistaken for each other.
 *
 * role="status", not "alert" — nothing is wrong, so it must not seize focus
 * mid-task.
 */
export function AnnouncementBanner() {
  const { announcementDismissed, hydrateAnnouncement, dismissAnnouncement } = useSimulationStore()

  // Read the persisted flag after mount: the store starts `false` on both
  // server and client so the first paint can't mismatch.
  useEffect(() => { hydrateAnnouncement() }, [hydrateAnnouncement])

  if (announcementDismissed) return null

  return (
    <div
      role="status"
      style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: sp.sm,
        padding: `${sp.xs}px ${sp.md}px`,
        background: "var(--ae-teal-bg)",
        borderBottom: "1px solid var(--ae-teal)",
        color: c.ink, fontFamily: ff.body, fontSize: 13,
      }}
    >
      <Radar style={{ width: 15, height: 15, color: "var(--ae-teal-ink)", flexShrink: 0 }} strokeWidth={2} />
      <span>
        <strong style={{ fontWeight: 650 }}>New: Drone Incursion Response.</strong>{" "}
        Runway suspensions with an unknown end time — recovery plans are solved across
        sampled closure lengths and report an expected cost with a regret band.
      </span>
      <button
        type="button"
        onClick={dismissAnnouncement}
        aria-label="Dismiss announcement"
        style={{
          marginLeft: "auto", minHeight: 32, minWidth: 32,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: `0 ${sp.xs}px`,
          fontSize: 12.5, fontWeight: 600, fontFamily: ff.body,
          borderRadius: r.sm, border: "1px solid var(--ae-teal-ink)",
          background: "transparent", color: "var(--ae-teal-ink)", cursor: "pointer",
        }}
      >
        <X style={{ width: 13, height: 13 }} strokeWidth={2} /> Dismiss
      </button>
    </div>
  )
}
