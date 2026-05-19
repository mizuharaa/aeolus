/**
 * Aeolus Design System — Airtable Editorial Palette
 *
 * Source: DESIGN.md spec. White canvas + near-black ink as the floor; brand
 * voltage lives in full-bleed signature surface cards (coral / forest / cream /
 * peach / mint / yellow / mustard) that punctuate the page every 2–3 screens.
 *
 * Hex values are the canonical truth — never inline a hex anywhere else in the
 * web app. Always reference `tokens.colors.X`.
 */

export const tokens = {
  colors: {
    // ── Brand & action ────────────────────────────────────────────────
    primary:        "#181d26",  // near-black ink. The primary CTA color.
    primaryActive:  "#0d1218",  // primary CTA pressed state

    // ── Surfaces ──────────────────────────────────────────────────────
    canvas:              "#FFFFFF",  // the page floor
    surfaceSoft:         "#F8FAFC",  // tabbed cards, featured pricing tier
    surfaceStrong:       "#E0E2E6",  // light gray CTA banner near footer
    surfaceDark:         "#181d26",  // dark navy mid-page CTA card
    surfaceDarkElevated: "#1d1f25",  // articles hero base
    hairline:            "#DDDDDD",  // 1px borders, dividers, secondary outlines

    // ── Type ──────────────────────────────────────────────────────────
    ink:           "#181d26",  // h1/h2 display, primary button text-on-light
    body:          "#333840",  // default running text
    muted:         "#41454D",  // captions, footer links, breadcrumbs
    borderStrong:  "#9297A0",  // disabled secondary button outline
    onPrimary:     "#FFFFFF",  // text on dark surfaces / primary buttons

    // ── Signature card surfaces (the brand voltage) ───────────────────
    signatureCoral:   "#AA2D00",  // dark oxide red — biggest signature card
    signatureForest:  "#0A2E0E",  // deep green
    signatureCream:   "#F5E9D4",  // soft beige callout band
    signaturePeach:   "#FCAB79",  // demo-card surface (warm pastel)
    signatureMint:    "#A8D8C4",  // demo-card surface (cool pastel)
    signatureYellow:  "#F4D35E",  // demo-card surface
    signatureMustard: "#D9A441",  // demo-card surface

    // ── Semantic ──────────────────────────────────────────────────────
    link:        "#1B61C9",
    linkActive:  "#1A3866",
    info:        "#254FAD",
    infoBorder:  "#458FFF",
    success:     "#006400",
    successBorder: "#39BF45",

    // ── Status palette (Aeolus extension — maps semantic ops state) ───
    // Same color = same meaning everywhere on the app. Use these tokens for
    // map markers, cascade bars, status badges, plan cards.
    statusOnTime: {
      ink: "#0A2E0E",  // signatureForest as type color
      bg:  "#E8F1E9",  // forest tinted 92% white
      dot: "#0A2E0E",
    },
    statusDelayed: {
      ink: "#7A3E0F",  // peach-ink — readable
      bg:  "#FDEBD9",  // peach tinted
      dot: "#FCAB79",  // signaturePeach
    },
    statusCancelled: {
      ink: "#AA2D00",  // signatureCoral
      bg:  "#F8E3D9",  // coral tinted
      dot: "#AA2D00",
    },
    statusRecovered: {
      ink: "#0A2E0E",
      bg:  "#DDEFE5",  // mint tinted
      dot: "#A8D8C4",  // signatureMint
    },

    // ── Cascade severity (direct → order-1 → order-2 → unaffected) ────
    // Warmth = severity. Coral hottest, mustard mid, yellow lightest.
    cascadeDirect:  "#AA2D00",   // signatureCoral
    cascadeOrder1:  "#D9A441",   // signatureMustard
    cascadeOrder2:  "#F4D35E",   // signatureYellow
    cascadeNone:    "#DDDDDD",   // hairline
  },

  radius: {
    xs:   2,    // legal / cookie CTAs (system-required)
    sm:   6,    // text inputs, small inline buttons
    md:   10,   // secondary content cards, article cards, cream callouts
    lg:   12,   // primary CTAs, signature surface cards, tabbed feature cards
    pill: 9999, // pricing sub-system only
    full: 9999, // circular icon buttons, avatars
  },

  spacing: {
    xxs:     4,
    xs:      8,
    sm:     12,
    md:     16,
    lg:     24,
    xl:     32,
    xxl:    48,
    section: 96,  // universal vertical rhythm between editorial bands
  },

  fontFamily: {
    // Inter Display is the open-source substitute for Haas Groot Disp / Haas Grotesk.
    // Per DESIGN.md, adjust line-height ~5% tighter to match Haas's cap-height.
    display: '"Inter Display", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    body:    '"Inter", "Inter Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },

  // Typography roles — size / weight / line-height / letter-spacing.
  // Reference these everywhere instead of inlining font CSS.
  typography: {
    displayXl:        { size: 48,   weight: 500, lh: 1.10, ls: "0" },        // articles h2
    displayLg:        { size: 40,   weight: 400, lh: 1.20, ls: "0" },        // homepage h1 hero
    displayMd:        { size: 32,   weight: 400, lh: 1.20, ls: "0" },        // platform h2 / section heads
    titleLg:          { size: 24,   weight: 400, lh: 1.35, ls: "0.12px" },   // section titles
    titleMd:          { size: 20,   weight: 400, lh: 1.50, ls: "0" },        // sub-section titles
    titleSm:          { size: 18,   weight: 500, lh: 1.40, ls: "0" },        // article-card titles
    labelMd:          { size: 16,   weight: 500, lh: 1.40, ls: "0" },        // demo-card titles
    button:           { size: 16,   weight: 500, lh: 1.40, ls: "0" },        // CTA button labels
    bodyMd:           { size: 14,   weight: 400, lh: 1.25, ls: "0" },        // body copy, nav items
    caption:          { size: 14,   weight: 500, lh: 1.35, ls: "0.16px" },   // meta text, breadcrumbs
    legal:            { size: 13.12,weight: 600, lh: 1.20, ls: "0" },        // ToS / cookie banner only
    monoSm:           { size: 12,   weight: 500, lh: 1.30, ls: "0" },        // small mono labels
    monoMd:           { size: 14,   weight: 500, lh: 1.30, ls: "0" },        // delay min, flight IDs
  },

  shadow: {
    // Color-block first, shadow second. Use sparingly.
    flat:        "none",
    buttonRest:  "0 1px 2px rgba(24,29,38,0.08)",
    buttonFocus: "0 0 0 3px rgba(27,97,201,0.35)",
    cardSoft:    "0 1px 2px rgba(24,29,38,0.06)",
    cardElev:    "0 4px 16px rgba(24,29,38,0.08)",
    overlay:     "0 12px 36px rgba(24,29,38,0.12)",
  },
} as const

export type Tokens = typeof tokens

// Convenience aliases used by inline-style call sites that want shorter names.
export const c  = tokens.colors
export const r  = tokens.radius
export const sp = tokens.spacing
export const ty = tokens.typography
export const ff = tokens.fontFamily
export const sh = tokens.shadow

// ── Typography helpers ────────────────────────────────────────────────
// Apply a typography role as inline styles. Avoids repeating 4 fields each call.
export function type(role: keyof typeof tokens.typography, color?: string) {
  const t = tokens.typography[role]
  return {
    fontSize: t.size,
    fontWeight: t.weight,
    lineHeight: t.lh,
    letterSpacing: t.ls,
    fontFamily: role.startsWith("display") || role.startsWith("title") ? ff.display : ff.body,
    color: color ?? c.body,
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
