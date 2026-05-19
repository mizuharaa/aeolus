import type { Config } from "tailwindcss"

/**
 * Tailwind config — Airtable Editorial Palette
 *
 * Source of truth: apps/web/lib/design-tokens.ts and globals.css.
 * Legacy color tokens (`teal`, `coral`, `gold`, `ember.*`) are kept as
 * Tailwind aliases pointing at the new palette so existing utility
 * classes (e.g. `bg-teal-DEFAULT`) automatically pick up the Airtable
 * system without a giant find-and-replace.
 */

const AIRTABLE = {
  primary:        "#181d26",
  primaryActive:  "#0d1218",
  canvas:         "#FFFFFF",
  surfaceSoft:    "#F8FAFC",
  surfaceStrong:  "#E0E2E6",
  surfaceDark:    "#181d26",
  hairline:       "#DDDDDD",
  ink:            "#181d26",
  body:           "#333840",
  muted:          "#41454D",
  borderStrong:   "#9297A0",
  onPrimary:      "#FFFFFF",
  signatureCoral:   "#AA2D00",
  signatureForest:  "#0A2E0E",
  signatureCream:   "#F5E9D4",
  signaturePeach:   "#FCAB79",
  signatureMint:    "#A8D8C4",
  signatureYellow:  "#F4D35E",
  signatureMustard: "#D9A441",
  link:           "#1B61C9",
  info:           "#254FAD",
  success:        "#006400",
} as const

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Airtable signature palette ── */
        airtable: {
          primary:       AIRTABLE.primary,
          ink:           AIRTABLE.ink,
          body:          AIRTABLE.body,
          muted:         AIRTABLE.muted,
          canvas:        AIRTABLE.canvas,
          "surface-soft":     AIRTABLE.surfaceSoft,
          "surface-strong":   AIRTABLE.surfaceStrong,
          "surface-dark":     AIRTABLE.surfaceDark,
          hairline:      AIRTABLE.hairline,
          coral:   AIRTABLE.signatureCoral,
          forest:  AIRTABLE.signatureForest,
          cream:   AIRTABLE.signatureCream,
          peach:   AIRTABLE.signaturePeach,
          mint:    AIRTABLE.signatureMint,
          yellow:  AIRTABLE.signatureYellow,
          mustard: AIRTABLE.signatureMustard,
          link:    AIRTABLE.link,
        },

        /* ── Legacy aliases — point at Airtable so old utility classes
              keep working until the components get rewritten. ── */
        coral:   { DEFAULT: AIRTABLE.signatureCoral,  hover: "#7E2100", light: "#C44A1F" },
        teal:    { DEFAULT: AIRTABLE.primary,         light: AIRTABLE.body,  dark: AIRTABLE.primaryActive, bg: AIRTABLE.surfaceSoft },
        gold:    { DEFAULT: AIRTABLE.signatureMustard, light: AIRTABLE.signatureYellow, dark: "#B58632" },

        ember: {
          primary:  AIRTABLE.primary,
          hover:    AIRTABLE.primaryActive,
          accent:   AIRTABLE.signatureMustard,
          bg:       AIRTABLE.canvas,
          surface:  AIRTABLE.surfaceSoft,
          raised:   AIRTABLE.surfaceStrong,
          border:   AIRTABLE.hairline,
          text:     AIRTABLE.ink,
          text2:    AIRTABLE.muted,
          neutral:  AIRTABLE.borderStrong,
          success:  AIRTABLE.success,
          warning:  AIRTABLE.signatureMustard,
          error:    AIRTABLE.signatureCoral,
        },

        /* ── Tailwind / shadcn semantic bridge ── */
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border:  "hsl(var(--border))",
        input:   "hsl(var(--input))",
        ring:    "hsl(var(--ring))",

        /* ── Legacy aliases ── */
        ink:     { DEFAULT: AIRTABLE.ink,    cream: AIRTABLE.signatureCream },
        canvas:  { DEFAULT: AIRTABLE.canvas },
        lifted:  { DEFAULT: AIRTABLE.canvas },
        link:    { DEFAULT: AIRTABLE.link },
      },

      fontFamily: {
        display: ['"Inter Display"', "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        sans:    ["Inter", '"Inter Display"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        code:    ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },

      borderRadius: {
        /* Airtable radius scale — see DESIGN.md */
        xs:      "2px",
        sm:      "6px",
        md:      "10px",
        lg:      "12px",
        pill:    "9999px",
        full:    "9999px",
        btn:     "12px",   /* legacy alias — was 8px, now matches primary CTA */
        stadium: "2.5rem", /* legacy alias */
      },

      spacing: {
        /* Airtable spacing scale */
        "xxs":     "4px",
        "xs":      "8px",
        "sm":      "12px",
        "md":      "16px",
        "lg":      "24px",
        "xl":      "32px",
        "xxl":     "48px",
        "section": "96px",
      },

      boxShadow: {
        /* Airtable shadow language — sparse, color-block-first */
        button:        "0 1px 2px rgba(24,29,38,0.08)",
        card:          "0 1px 2px rgba(24,29,38,0.06)",
        "card-elev":   "0 4px 16px rgba(24,29,38,0.08)",
        overlay:       "0 12px 36px rgba(24,29,38,0.12)",
        focus:         "0 0 0 3px rgba(27,97,201,0.35)",
        nav:           "0 1px 0 #DDDDDD",
        /* Legacy aliases */
        "card-hover":  "0 4px 16px rgba(24,29,38,0.08)",
        modal:         "0 12px 36px rgba(24,29,38,0.12)",
        "coral-glow":  "0 4px 16px rgba(170,45,0,0.22)",
        "teal-glow":   "0 4px 16px rgba(24,29,38,0.10)",
        "gold-glow":   "0 4px 16px rgba(217,164,65,0.26)",
        "sky-glow":    "0 4px 16px rgba(27,97,201,0.22)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
