/**
 * AeolusMark — the Aeolus brand mark.
 *
 * A cute, friendly little airliner on a rounded gradient badge. The squircle
 * tile carries the cobalt→violet brand gradient with a soft top highlight for
 * a 3D, pettable feel; a chubby bone-white plane banks across it with an amber
 * tail and a cheerful cockpit dot. Reads warm and approachable rather than
 * corporate — the "cute pet" energy — while staying unmistakably an aircraft.
 *
 * `AeolusLogo` keeps the historical name/props so no call site churns; legacy
 * `ink` / `accent` / `radius` props are accepted for compatibility.
 */

import { useId, type CSSProperties } from "react"

export function AeolusMark({
  size = 34,
  accent = "#EFAF1B",
  ink: _ink,
  radius: _radius,
  className,
  style,
}: {
  size?: number
  accent?: string
  ink?: string
  radius?: number
  className?: string
  style?: CSSProperties
}) {
  const uid = useId().replace(/[:]/g, "")
  const tile = `ae-tile-${uid}`
  const gloss = `ae-gloss-${uid}`
  const bodyG = `ae-body-${uid}`

  return (
    <span
      className={className}
      aria-label="Aeolus"
      role="img"
      style={{ display: "inline-flex", flexShrink: 0, width: size, height: size, ...style }}
    >
      <svg viewBox="0 0 40 40" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={tile} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3A57E8" />
            <stop offset="0.55" stopColor="#5233D6" />
            <stop offset="1" stopColor="#6F3FE4" />
          </linearGradient>
          <linearGradient id={gloss} x1="20" y1="3" x2="20" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={bodyG} x1="12" y1="12" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DCE4F5" />
          </linearGradient>
        </defs>

        {/* rounded squircle tile */}
        <rect x="3" y="3" width="34" height="34" rx="11" fill={`url(#${tile})`} />
        {/* soft top gloss for a 3D, pettable feel */}
        <rect x="3" y="3" width="34" height="20" rx="11" fill={`url(#${gloss})`} />

        {/* chubby friendly plane, banking up-right */}
        <g transform="rotate(-18 20 20)">
          {/* amber tail fin */}
          <path d="M11.4 22.6 L9.2 25.2 L12.4 24.2 Z" fill={accent} />
          {/* wings (soft) */}
          <path
            d="M18 15.8 C 20 15.2 22 15.4 22.4 16.8 L 15.2 20 L 12.6 19.2 Z"
            fill="#C7D3EE"
          />
          <path
            d="M20.6 22.4 C 21 24.2 20.6 26 18.8 26.8 L 16.2 20.6 Z"
            fill="#C7D3EE"
          />
          {/* fuselage — rounded chubby body */}
          <path
            d="M12.2 20.4 C 12.2 18.9 13.6 17.9 16.2 17.6 C 22.4 16.9 27.8 18.4 29.6 20 C 30.2 20.6 30.1 21.3 29.2 21.6 C 26.6 22.6 21.4 23.4 16.2 22.9 C 13.6 22.7 12.2 21.9 12.2 20.4 Z"
            fill={`url(#${bodyG})`}
            stroke="#B9C6E6"
            strokeWidth="0.4"
          />
          {/* cheerful cockpit dot */}
          <circle cx="27.4" cy="20.3" r="1.15" fill={accent} />
          <circle cx="27.1" cy="20.0" r="0.4" fill="#FFFFFF" fillOpacity="0.9" />
        </g>
      </svg>
    </span>
  )
}

export function AeolusLogo({
  size = 34,
  radius: _radius, // kept for call-site compatibility; the mark has its own tile
  className,
  style,
}: {
  size?: number
  radius?: number
  className?: string
  style?: CSSProperties
}) {
  return <AeolusMark size={size} className={className} style={style} />
}
