"use client"
/**
 * LiveCostDisplay — the animated dollar number shown across plan cards.
 *
 * Reads the `useLiveCost(plan)` hook and renders the ticking total + a
 * small "rate of burn" indicator. Variant `compact` is for inline use in
 * cards / pills; default is a full label-and-number stack.
 *
 * Visual rules:
 *   - tabular-nums so digits don't wiggle as values change
 *   - mono font for the number (matches the rest of the OCC chrome)
 *   - rate-of-burn shown as `▲ $267/min` in a small caption beneath
 *   - no color on the number itself — restraint
 */
import { TrendingUp } from "lucide-react"
import { c, ff } from "@/lib/design-tokens"
import { useLiveCost, fmtUsdShort } from "@/lib/use-live-cost"
import type { RecoveryPlan } from "@/stores/simulation"

interface Props {
  plan:        RecoveryPlan | null | undefined
  size?:       "sm" | "md" | "lg"
  showRate?:   boolean
  /** Override the displayed color for the dollar number. Defaults to ink. */
  color?:      string
  /** When false, the rate-of-burn caption is hidden. Default true. */
  caption?:    boolean
}

const SIZE_MAP = {
  sm: { num: 14, rate: 10 },
  md: { num: 18, rate: 11 },
  lg: { num: 28, rate: 12 },
} as const

export function LiveCostDisplay({
  plan,
  size = "md",
  showRate = true,
  color = c.ink,
  caption = true,
}: Props) {
  const { cost, ratePerMin } = useLiveCost(plan)
  const s = SIZE_MAP[size]
  const isFresh = ratePerMin > 0
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.1 }}>
      <span
        style={{
          fontFamily: ff.mono,
          fontWeight: 600,
          fontSize: s.num,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtUsdShort(cost)}
      </span>
      {showRate && caption && isFresh && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            marginTop: 2,
            fontFamily: ff.mono,
            fontSize: s.rate,
            color: c.signatureCoral,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}
        >
          <TrendingUp style={{ width: 10, height: 10 }} />
          +${Math.round(ratePerMin)}/min
        </span>
      )}
    </span>
  )
}
