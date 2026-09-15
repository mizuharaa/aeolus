"use client"
/**
 * Aircraft plan-view silhouettes, drawn per aircraft FAMILY.
 *
 * ── Why plan view, and why drawn rather than photographed or modelled ──────
 *
 * The reference detail card shows a 3/4 photograph of the airframe. Two
 * reasons this does not: Olus flies a synthetic carrier (Nimbus Air) so no
 * such photograph exists, and design.md's honest-copy rule means a stock photo
 * of a real Southwest 737 standing in for a simulated Nimbus leg would be
 * asserting something false about the data. Mounting the landing's GLB in an
 * R3F canvas was the other option and was rejected too: it is one generic
 * airliner, so it would render identically for a CRJ-900 and a 777 while
 * costing the console a WebGL context — decoration at the price of a
 * framerate, on a page design.md says must not carry enrichment.
 *
 * A drawn plan view instead carries INFORMATION. The three families differ in
 * the ways an operator actually distinguishes them — a regional jet's engines
 * are on the rear fuselage under a T-tail, a widebody's span and engine
 * diameter are visibly larger relative to its fuselage — so the picture tells
 * you something the type code beside it also tells you, redundantly, which is
 * exactly what a good instrument does. It is also vector, so it stays sharp at
 * any size and takes the register's colours without a second asset.
 */

export type AircraftFamily = "narrowbody" | "widebody" | "regional"

/**
 * Map an aircraft type string to a family.
 *
 * Deliberately conservative: an unrecognised type returns "narrowbody", which
 * is both the modal airframe in a domestic fleet and the least assertive guess.
 * The type CODE is always displayed beside the drawing, so a mis-classified
 * silhouette costs recognition speed, never correctness.
 */
export function aircraftFamily(type: string | undefined | null): AircraftFamily {
  if (!type) return "narrowbody"
  const t = type.toUpperCase().replace(/[\s-]/g, "")
  // Regional: rear-mounted engines, T-tail.
  if (/^(CRJ|CL6|E1[357]|E7[57]|ERJ|EMB|AT[47]|DH8|Q4|SF3|BE\d)/.test(t)) return "regional"
  // Widebody twins and quads.
  if (/^(B7[4678]|B77|B78|A3[345]|A30|A31|A33|A34|A35|A38|IL9|MD11)/.test(t)) return "widebody"
  if (/(747|767|777|787|330|340|350|380|300ER)/.test(t)) return "widebody"
  return "narrowbody"
}

type Props = {
  family: AircraftFamily
  /** Rendered size in px (square). */
  size?: number
  /** Fill for the airframe body. */
  fill?: string
  /** Stroke for panel lines and the outline. */
  line?: string
  className?: string
}

/**
 * Geometry per family, in a 200×200 box with the nose at 12 o'clock.
 * All three share a centreline at x=100 so they can be swapped in place.
 */
const GEOM: Record<AircraftFamily, { body: string; wing: string; tail: string; engines: string; fin: string }> = {
  narrowbody: {
    // Slim tube, moderate span, engines under the wing roots.
    body: "M100 12c3 0 5.2 4.4 6 11.2l2 39.4 1.4 62.8 4.6 3.2.6 20.4 9.8 8.4v6.2L100 158l-24.4 5.6v-6.2l9.8-8.4.6-20.4 4.6-3.2 1.4-62.8 2-39.4C94.8 16.4 97 12 100 12z",
    wing: "M92 60 L18 108 L18 118 L92.6 100 L107.4 100 L182 118 L182 108 L108 60 Z",
    tail: "M93 132 L58 148 L58 154 L93.4 145 L106.6 145 L142 154 L142 148 L107 132 Z",
    engines: "M62 88h10a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H62a3 3 0 0 1-3-3V91a3 3 0 0 1 3-3z M128 88h10a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3h-10a3 3 0 0 1-3-3V91a3 3 0 0 1 3-3z",
    fin: "M100 124 L96 158 L104 158 Z",
  },
  widebody: {
    // Longer, visibly fatter fuselage; greater span; large-diameter engines
    // set further outboard — the cues that read as "widebody" at a glance.
    body: "M100 8c3.8 0 6.6 5 7.6 12.6l2.6 42.6 1.8 68.4 5.2 3.6.8 21.8 11 9v6.6L100 166l-29 6.6V166l11-9 .8-21.8 5.2-3.6 1.8-68.4 2.6-42.6C93.4 13 96.2 8 100 8z",
    wing: "M90.5 58 L8 112 L8 124 L91 102 L109 102 L192 124 L192 112 L109.5 58 Z",
    tail: "M92 136 L50 154 L50 161 L92.6 150 L107.4 150 L150 161 L150 154 L108 136 Z",
    engines: "M46 86h13a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H46a4 4 0 0 1-4-4V90a4 4 0 0 1 4-4z M141 86h13a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4h-13a4 4 0 0 1-4-4V90a4 4 0 0 1 4-4z",
    fin: "M100 128 L95 166 L105 166 Z",
  },
  regional: {
    // Short fuselage, modest span, and the two identifying cues: engines
    // mounted on the REAR FUSELAGE rather than the wings, under a T-TAIL whose
    // horizontal surface sits at the top of the fin.
    body: "M100 22c2.6 0 4.6 3.8 5.2 9.6l1.6 34 1.2 54.6 4 2.8.6 17.8 8.4 7.2v5.4L100 148l-21 5.4V148l8.4-7.2.6-17.8 4-2.8 1.2-54.6 1.6-34C95.4 25.8 97.4 22 100 22z",
    wing: "M93.5 66 L34 104 L34 113 L93.8 99 L106.2 99 L166 113 L166 104 L106.5 66 Z",
    // T-tail: the horizontal surface is drawn at the TOP of the fin, wider and
    // further forward than a conventional tailplane would sit.
    tail: "M100 128 L66 136 L66 142 L100 138 L134 142 L134 136 Z",
    engines: "M82 112h8a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-15a3 3 0 0 1 3-3z M110 112h8a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-15a3 3 0 0 1 3-3z",
    fin: "M100 122 L96 140 L104 140 Z",
  },
}

export function AircraftSilhouette({
  family, size = 150, fill = "var(--ae-text-2)", line = "var(--ae-surface)", className,
}: Props) {
  const g = GEOM[family]
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${family} airliner, plan view`}
    >
      <g fill={fill} stroke={line} strokeWidth={1.1} strokeLinejoin="round">
        <path d={g.wing} />
        <path d={g.tail} />
        <path d={g.engines} />
        <path d={g.body} />
      </g>
      {/* Fin catches a highlight so the tail reads as raised rather than as a
          notch cut out of the fuselage. */}
      <path d={g.fin} fill={line} opacity={0.5} />
    </svg>
  )
}
