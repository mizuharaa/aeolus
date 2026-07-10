/**
 * Aeolus Design System — canonical tokens. CONTROL-TOWER EDITORIAL edition (landing palette).
 *
 * The vocabulary:
 *
 *   ink    #141019   warm ink          — type, dark marks, primary CTA
 *   paper  #F5F0E3   warm beige         — surfaces
 *   sky    #6F3FE4   the atmosphere     — gradients, chrome accents
 *   teal   #2C49E0   the identity color — actions, links, recovery, active
 *   pink   #EC4899   the disruption     — events, cascade energy (landing)
 *   amber  #EFAF1B   THE status color   — delayed / warning (simulator ops)
 *
 * "Cancelled / not operating" is NOT a hue: it renders as neutral gray with
 * a strike, dash, or x. Severity within amber is carried by opacity steps.
 *
 * TWO REGISTERS, ONE TOKEN SET. `:root` carries the landing/docs register;
 * `.register-dark` (name kept for call-site stability — its values are now
 * BRIGHT) carries the denser simulator app register. Components reference
 * the same `c.*` token in both worlds.
 *
 * Chromatic constants that must survive *outside* CSS (Leaflet's canvas
 * renderer resolves colors in JS) live in `pigment.*` as literal hex.
 */

// ── Literal pigments (canvas-safe; identical in both registers) ─────────
export const pigment = {
  ink:   "#141019",
  paper: "#F5F0E3",
  gray:  "#8A8270", // warm-gray mid neutral
  sky:   "#6F3FE4",
  teal:  "#2C49E0",
  amber: "#EFAF1B",
  rose:  "#EC4899", // disruption pink (landing narrative; teal = recovery)
} as const

export const tokens = {
  colors: {
    // ── Brand & action ────────────────────────────────────────────────
    // Light register: ink button, paper label. Dark register: teal button,
    // ink label. One primary action color per register.
    primary:        "var(--ae-primary)",
    primaryActive:  "var(--ae-primary-active)",

    // ── Surfaces ──────────────────────────────────────────────────────
    canvas:              "var(--ae-surface)",    // card / panel floor
    surfaceSoft:         "var(--ae-surface-2)",  // recessed panel, tab well
    surfaceStrong:       "var(--ae-surface-3)",  // track fills, deep recess
    surfaceDark:         pigment.ink,            // ink card (both registers)
    surfaceDarkElevated: "#123349",              // raised step on ink
    hairline:            "var(--ae-line)",       // 1px borders, dividers

    // ── Type ──────────────────────────────────────────────────────────
    ink:           "var(--ae-text)",    // headings, emphasis
    body:          "var(--ae-text-2)",  // running text
    muted:         "var(--ae-text-3)",  // captions, labels
    borderStrong:  "var(--ae-line-strong)",
    onPrimary:     "var(--ae-on-primary)",

    // ── Chromatic accents (register-aware text steps) ────────────────
    sky:       "var(--ae-sky)",        // atmosphere accent
    skyInk:    "var(--ae-sky-ink)",
    skyBg:     "var(--ae-sky-bg)",
    teal:      "var(--ae-teal)",       // graphic teal (dots, bars, borders)
    tealInk:   "var(--ae-teal-ink)",   // teal as small text — AA per register
    amber:     "var(--ae-amber)",
    amberInk:  "var(--ae-amber-ink)",
    rose:      "var(--ae-rose)",      // disruption pink
    roseInk:   "var(--ae-rose-ink)",
    roseBg:    "var(--ae-rose-bg)",
    roseSoft:  "var(--ae-rose-soft)",
    roseSoft2: "var(--ae-rose-soft2)",
    // Legacy names — rust was retired; both alias amber. Do not use.
    rust:      "var(--ae-rust)",
    rustInk:   "var(--ae-rust-ink)",

    // ── Legacy signature aliases — every old call site snaps into the
    //    five-color system through these. Do not use in new code. ────
    signatureCoral:   "var(--ae-amber)",
    signatureForest:  "var(--ae-teal-ink)",
    signatureCream:   "var(--ae-surface-2)",
    signaturePeach:   "var(--ae-amber)",
    signatureMint:    "var(--ae-teal)",
    signatureYellow:  "var(--ae-amber)",
    signatureMustard: "var(--ae-amber)",

    // ── Semantic ──────────────────────────────────────────────────────
    link:          "var(--ae-teal-ink)",
    linkActive:    "var(--ae-teal-ink)",
    info:          "var(--ae-teal-ink)",
    infoBorder:    "var(--ae-teal)",
    success:       "var(--ae-teal-ink)",
    successBorder: "var(--ae-teal)",

    // ── Status palette — same color = same meaning everywhere ────────
    // dot = graphic pigment (markers, swatches); ink = AA text step;
    // bg = 10–16% tint of the pigment on the register surface.
    // On-time is deliberately QUIET (neutral) — nominal state shouldn't shout.
    statusOnTime: {
      ink: "var(--ae-text-2)",
      bg:  "var(--ae-neutral-bg)",
      dot: "var(--ae-teal)",
    },
    statusDelayed: {
      ink: "var(--ae-amber-ink)",
      bg:  "var(--ae-amber-bg)",
      dot: "var(--ae-amber)",
    },
    // Cancelled = not operating = NEUTRAL. Always pairs with a strike,
    // dash, or x — never a status hue, never color-alone.
    statusCancelled: {
      ink: "var(--ae-text-2)",
      bg:  "var(--ae-neutral-bg)",
      dot: "var(--ae-line-strong)",
    },
    statusRecovered: {
      ink: "var(--ae-teal-ink)",
      bg:  "var(--ae-teal-bg)",
      dot: "var(--ae-teal)",
    },

    // ── Cascade severity — ONE hue, three opacity steps. Direct hit is
    //    full amber (plus size/halo secondary encoding at marks). ──
    cascadeDirect:  "var(--ae-amber)",
    cascadeOrder1:  "var(--ae-amber-soft)",
    cascadeOrder2:  "var(--ae-amber-soft2)",
    cascadeNone:    "var(--ae-line-strong)",
  },

  radius: {
    xs:   2,
    sm:   6,
    md:   10,
    lg:   12,
    pill: 9999,
    full: 9999,
  },

  spacing: {
    xxs:     4,
    xs:      8,
    sm:     12,
    md:     16,
    lg:     24,
    xl:     32,
    xxl:    48,
    section: 112, // vertical rhythm between landing sections
  },

  fontFamily: {
    // ONE typeface family. Inter Display is Inter's optical-size variant —
    // same family, tuned cap-height for headlines. Mono is reserved for
    // code blocks, flight IDs, timestamps, and tabular ops data only.
    display: '"Inter Display", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    body:    '"Inter", "Inter Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },

  // Typography roles. Three real tiers — display, body, label — with a
  // couple of intermediate sizes for dense panel UI. No five-near-identical
  // sizes; no default uppercase anywhere except `eyebrow`.
  typography: {
    displayXl:  { size: 56,  weight: 600, lh: 1.04, ls: "-0.022em" }, // landing h1
    displayLg:  { size: 40,  weight: 600, lh: 1.10, ls: "-0.018em" }, // CTA band h2
    displayMd:  { size: 28,  weight: 600, lh: 1.16, ls: "-0.012em" }, // section h2
    titleLg:    { size: 20,  weight: 550, lh: 1.30, ls: "-0.008em" }, // card titles
    titleMd:    { size: 16,  weight: 550, lh: 1.40, ls: "0" },        // panel titles
    titleSm:    { size: 14,  weight: 550, lh: 1.40, ls: "0" },        // row titles
    labelMd:    { size: 14,  weight: 500, lh: 1.40, ls: "0" },
    button:     { size: 14,  weight: 500, lh: 1.40, ls: "0" },
    bodyMd:     { size: 14,  weight: 400, lh: 1.55, ls: "0" },        // running text
    caption:    { size: 12,  weight: 450, lh: 1.45, ls: "0" },        // meta text
    legal:      { size: 12,  weight: 450, lh: 1.45, ls: "0" },
    eyebrow:    { size: 11,  weight: 550, lh: 1.2,  ls: "0.14em" },   // THE caps style
    monoSm:     { size: 11.5,weight: 450, lh: 1.5,  ls: "0" },
    monoMd:     { size: 13,  weight: 500, lh: 1.5,  ls: "0" },
  },

  shadow: {
    flat:        "none",
    buttonRest:  "0 1px 2px rgba(11,36,52,0.10)",
    buttonFocus: "0 0 0 3px var(--ae-focus)",
    cardSoft:    "0 1px 2px rgba(11,36,52,0.05)",
    cardElev:    "0 6px 24px rgba(11,36,52,0.10)",
    overlay:     "0 16px 48px rgba(11,36,52,0.16)",
  },
} as const

export type Tokens = typeof tokens

// Convenience aliases used by inline-style call sites.
export const c  = tokens.colors
export const r  = tokens.radius
export const sp = tokens.spacing
export const ty = tokens.typography
export const ff = tokens.fontFamily
export const sh = tokens.shadow

// ── Typography helper ────────────────────────────────────────────────
export function type(role: keyof typeof tokens.typography, color?: string) {
  const t = tokens.typography[role]
  return {
    fontSize: t.size,
    fontWeight: t.weight,
    lineHeight: t.lh,
    letterSpacing: t.ls,
    fontFamily: role.startsWith("display") ? ff.display : role.startsWith("mono") ? ff.mono : ff.body,
    color: color ?? c.body,
    ...(role === "eyebrow" ? { textTransform: "uppercase" as const } : {}),
  } as const
}

// Status badge background + ink for a flight state.
export function statusTokens(state: "on-time" | "delayed" | "cancelled" | "recovered") {
  switch (state) {
    case "on-time":    return c.statusOnTime
    case "delayed":    return c.statusDelayed
    case "cancelled":  return c.statusCancelled
    case "recovered":  return c.statusRecovered
  }
}
