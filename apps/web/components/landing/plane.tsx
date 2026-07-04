/**
 * Aircraft artwork shared across the landing page.
 *
 * JET_PATH — compact 24×24 silhouette (nose up) used for the small
 * traveling glyphs on route arcs (same silhouette family as the
 * simulator's map markers).
 *
 * AirlinerTopDown — a larger, more detailed top-down airliner drawn for
 * the hero: swept wings, tailplane, engine nacelles, window line. Pure
 * SVG, monochrome + one teal accent, no gradients or glow.
 */

export const JET_PATH =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"

export function AirlinerTopDown({
  width = 420,
  line = "rgba(241,243,238,0.5)",
  fill = "rgba(241,243,238,0.05)",
  accent = "#2FB6A6",
  style,
  className,
}: {
  width?: number
  line?: string
  fill?: string
  accent?: string
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 240 232"
      width={width}
      height={(width * 232) / 240}
      style={style}
      className={className}
      aria-hidden
    >
      {/* airframe */}
      <path
        d="M120 6
           C126 13 130 24 130 40
           L130 94
           L224 146
           L224 159
           L131 124
           L131 176
           L170 202
           L170 211
           L128 200
           C126 212 124 218 120 224
           C116 218 114 212 112 200
           L70 211
           L70 202
           L109 176
           L109 124
           L16 159
           L16 146
           L110 94
           L110 40
           C110 24 114 13 120 6 Z"
        fill={fill}
        stroke={line}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* window line */}
      <line x1="120" y1="30" x2="120" y2="192" stroke={line} strokeWidth="0.8" strokeDasharray="2.5 4" opacity="0.7" />
      {/* engine nacelles */}
      <rect x="76" y="112" width="12" height="27" rx="5" fill="none" stroke={accent} strokeWidth="1.3" opacity="0.8" />
      <rect x="152" y="112" width="12" height="27" rx="5" fill="none" stroke={accent} strokeWidth="1.3" opacity="0.8" />
      {/* winglets */}
      <path d="M16 146 L10 138 L16 152 Z" fill={accent} opacity="0.85" />
      <path d="M224 146 L230 138 L224 152 Z" fill={accent} opacity="0.85" />
      {/* nose marker */}
      <circle cx="120" cy="14" r="1.8" fill={accent} />
    </svg>
  )
}
