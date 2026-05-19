/**
 * Plan A/B/C/D presentation metadata — single source of truth.
 *
 * Was duplicated across 6 dashboard files (with subtly different colors and
 * labels), which made the dashboard feel inconsistent and "AI-generated".
 * Consolidated here. Every consumer reads from this map.
 *
 * Design rule (per REVAMP_PLAN_v2.md Ask 4 — chromatic restraint):
 *   Plan cards default to WHITE canvas. The signature `surface` color is
 *   used ONLY when the card is the applied plan — that's the one voltage
 *   moment per viewport. Other plan cards get a 4px accent stripe + the
 *   eyebrow ink; no full-surface tinting.
 *
 *   The `surface` and `surfaceMuted` fields are still exported (so the
 *   applied-plan and carbon-page heroes can use them), but the dashboard
 *   default is now `bg: c.canvas`.
 */
import { c } from "@/lib/design-tokens"

export type PlanId = "A" | "B" | "C" | "D"

export interface PlanMeta {
  /** Display name shown on cards and headers. */
  label:        string
  /** One-line elaboration; shows under the label. */
  sublabel:     string
  /** Accent color used as the 4px left stripe + eyebrow ink. */
  accent:       string
  /** Ink color for the eyebrow label (often slightly darker than accent). */
  ink:          string
  /** Signature surface — applied to the card body ONLY when the plan is
   *  the currently applied plan. Otherwise the card stays white canvas. */
  surface:      string
  /** Muted version of the surface, used for small inline ledger pills
   *  (e.g. the "Estimated impact" chip inside an otherwise-white card). */
  surfaceMuted: string
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  A: {
    label:        "Minimize Cost",
    sublabel:     "Lowest financial exposure",
    accent:       c.signatureMustard,
    ink:          "#5C3D0F",
    surface:      c.signatureCream,
    surfaceMuted: "rgba(217,164,65,0.10)",
  },
  B: {
    label:        "Min. Pax Impact",
    sublabel:     "Best passenger experience",
    accent:       c.signatureMint,
    ink:          c.signatureForest,
    surface:      c.statusRecovered.bg,
    surfaceMuted: "rgba(168,216,196,0.18)",
  },
  C: {
    label:        "Protect Tomorrow",
    sublabel:     "Minimizes next-day cascades",
    accent:       c.signaturePeach,
    ink:          c.statusDelayed.ink,
    surface:      c.statusDelayed.bg,
    surfaceMuted: "rgba(252,171,121,0.16)",
  },
  D: {
    label:        "Green Recovery",
    sublabel:     "Lowest CO₂ footprint (EU ETS)",
    accent:       c.signatureForest,
    ink:          c.signatureForest,
    surface:      c.statusOnTime.bg,
    surfaceMuted: "rgba(10,46,14,0.10)",
  },
}

/** Convenience accessor with safe fallback (some pages parse the planId
 *  from the URL where users can put garbage). */
export function planMeta(planId: string | undefined | null): PlanMeta {
  const key = (planId || "A").toUpperCase()
  return PLAN_META[key as PlanId] ?? PLAN_META.A
}

/** Optimizer status → pill background/ink. Lifted out of plan-meta because
 *  these are SOLVER states, not plan strategies. */
export const STATUS_TONE: Record<string, { ink: string; bg: string }> = {
  optimal:    { ink: c.statusOnTime.ink,    bg: c.statusOnTime.bg },
  feasible:   { ink: c.statusRecovered.ink, bg: c.statusRecovered.bg },
  heuristic:  { ink: c.statusDelayed.ink,   bg: c.statusDelayed.bg },
  infeasible: { ink: c.statusCancelled.ink, bg: c.statusCancelled.bg },
}
