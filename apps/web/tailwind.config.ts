import type { Config } from "tailwindcss"

/**
 * Tailwind config — Aeolus five-pigment system.
 *
 * Source of truth: apps/web/lib/design-tokens.ts + globals.css.
 *
 *   ink #0F1412 · paper #F5F5F0 · teal #0D9488 · amber #B8863C · rust #C4674A
 *
 * PALETTE CLAMP: every default Tailwind hue family is overridden with a
 * ramp generated from one of the three chromatic pigments (or the neutral
 * gray). A stray `text-red-700` or `bg-sky-50` anywhere in the app can only
 * ever resolve into the restrained vocabulary — the rainbow is structurally
 * impossible, not just discouraged.
 *
 *   red / rose / pink / orange / amber / yellow / violet / purple → amber
 *   green / emerald / lime / teal / sky / blue / cyan / indigo    → teal
 *   slate / gray / zinc / neutral / stone                         → neutral
 *
 * Amber is the ONLY status hue; cancelled/critical-off states are neutral.
 */

const INK   = "#0F1412"
const PAPER = "#F5F5F0"
const TEAL  = "#0D9488"
const AMBER = "#B8863C"
const GRAY  = "#6A716D"

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}
/** Linear sRGB mix of two hexes; t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}
/** 50–900 ramp: light steps mix toward paper, dark steps toward ink. */
function ramp(base: string) {
  return {
    50:  mix(base, PAPER, 0.92),
    100: mix(base, PAPER, 0.84),
    200: mix(base, PAPER, 0.68),
    300: mix(base, PAPER, 0.50),
    400: mix(base, PAPER, 0.26),
    500: base,
    600: mix(base, INK, 0.14),
    700: mix(base, INK, 0.32),
    800: mix(base, INK, 0.50),
    900: mix(base, INK, 0.64),
    950: mix(base, INK, 0.76),
    DEFAULT: base,
  }
}

const amberRamp   = ramp(AMBER)
const tealRamp    = ramp(TEAL)
const neutralRamp = ramp(GRAY)
const rustRamp    = amberRamp // rust retired — legacy classes resolve to amber

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
        /* ── The five pigments, by name ── */
        ink:   { DEFAULT: INK, cream: PAPER },
        paper: { DEFAULT: PAPER },
        rust:  rustRamp,
        // amber + teal defined below via the clamp (same object)

        /* ── Palette clamp — every Tailwind hue → vocabulary ramp ── */
        red:     amberRamp,
        rose:    amberRamp,
        pink:    amberRamp,
        fuchsia: amberRamp,
        orange:  amberRamp,
        amber:   amberRamp,
        yellow:  amberRamp,
        violet:  amberRamp,
        purple:  amberRamp,
        lime:    tealRamp,
        green:   tealRamp,
        emerald: tealRamp,
        cyan:    tealRamp,
        sky:     tealRamp,
        blue:    tealRamp,
        indigo:  tealRamp,
        slate:   neutralRamp,
        gray:    neutralRamp,
        zinc:    neutralRamp,
        stone:   neutralRamp,

        teal: {
          ...tealRamp,
          /* legacy aliases still referenced by old utility classes */
          light: mix(TEAL, PAPER, 0.3),
          dark:  mix(TEAL, INK, 0.3),
          bg:    "var(--ae-teal-bg)",
        },

        /* ── Legacy alias families → vocabulary ── */
        coral: { DEFAULT: AMBER, hover: mix(AMBER, INK, 0.25), light: mix(AMBER, PAPER, 0.35) },
        gold:  { DEFAULT: AMBER, light: mix(AMBER, PAPER, 0.35), dark: mix(AMBER, INK, 0.25) },

        airtable: {
          primary: "var(--ae-primary)",
          ink: "var(--ae-text)",
          body: "var(--ae-text-2)",
          muted: "var(--ae-text-3)",
          canvas: "var(--ae-surface)",
          "surface-soft": "var(--ae-surface-2)",
          "surface-strong": "var(--ae-surface-3)",
          "surface-dark": INK,
          hairline: "var(--ae-line)",
          coral: AMBER,
          forest: "var(--ae-teal-ink)",
          cream: "var(--ae-surface-2)",
          peach: AMBER,
          mint: TEAL,
          yellow: AMBER,
          mustard: AMBER,
          link: "var(--ae-teal-ink)",
        },

        ember: {
          primary: "var(--ae-primary)",
          hover: "var(--ae-primary-active)",
          accent: TEAL,
          bg: "var(--ae-bg)",
          surface: "var(--ae-surface)",
          raised: "var(--ae-surface-2)",
          border: "var(--ae-line)",
          text: "var(--ae-text)",
          text2: "var(--ae-text-3)",
          neutral: "var(--ae-line-strong)",
          success: "var(--ae-teal-ink)",
          warning: AMBER,
          error: AMBER,
        },

        /* ── Tailwind / shadcn semantic bridge ── */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        /* Misc legacy aliases */
        canvas: { DEFAULT: "var(--ae-surface)" },
        lifted: { DEFAULT: "var(--ae-surface-2)" },
        link:   { DEFAULT: "var(--ae-teal-ink)" },
      },

      fontFamily: {
        display: ['"Inter Display"', "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        sans:    ["Inter", '"Inter Display"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        code:    ['"JetBrains Mono"', "ui-monospace", "monospace"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },

      borderRadius: {
        xs: "2px",
        sm: "6px",
        md: "10px",
        lg: "12px",
        pill: "9999px",
        full: "9999px",
        btn: "10px",
        stadium: "2.5rem",
      },

      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "112px",
      },

      boxShadow: {
        button: "var(--ae-shadow-button)",
        card: "var(--ae-shadow-card)",
        "card-elev": "var(--ae-shadow-card-elev)",
        overlay: "var(--ae-shadow-overlay)",
        focus: "var(--ae-shadow-focus)",
        nav: "0 1px 0 var(--ae-line)",
        /* Legacy aliases — glows retired; resolve to flat elevation */
        "card-hover": "var(--ae-shadow-card-elev)",
        modal: "var(--ae-shadow-overlay)",
        "coral-glow": "var(--ae-shadow-card-elev)",
        "teal-glow": "var(--ae-shadow-card-elev)",
        "gold-glow": "var(--ae-shadow-card-elev)",
        "sky-glow": "var(--ae-shadow-card-elev)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
