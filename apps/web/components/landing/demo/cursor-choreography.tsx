"use client"
/**
 * CursorChoreography — the visible pointer the master timeline walks
 * across the demo screen (to the event selector, then to Plan B), plus a
 * click ripple. Positions are percentages of the demo canvas; the
 * orchestrator tweens `left` / `top` on .demo-cursor and fires .demo-click.
 */

export function CursorChoreography({ staticMode }: { staticMode: boolean }) {
  if (staticMode) return null
  return (
    <>
      <div className="demo-cursor" style={{ left: "70%", top: "82%", opacity: 0 }}>
        <svg viewBox="0 0 24 24" width="100%" height="100%">
          <path
            d="M 5.5 3 L 19 12.2 L 12.6 13.4 L 16 20.4 L 13.2 21.8 L 9.8 14.7 L 5.5 19 Z"
            fill="#0B2434"
            stroke="#FFFFFF"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="demo-click" style={{ left: "70%", top: "82%" }} />
    </>
  )
}
