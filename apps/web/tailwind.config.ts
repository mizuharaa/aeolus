import type { Config } from "tailwindcss"

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
        /* ── Nimbus Teal palette ── */
        coral:   { DEFAULT: "#0D9488", hover: "#0F766E", light: "#14B8A6" },
        teal:    { DEFAULT: "#0D9488", light: "#14B8A6", dark: "#0F766E", bg: "#F0FDFA" },
        gold:    { DEFAULT: "#F59E0B", light: "#FCD34D", dark: "#D97706" },

        /* ember-* aliases (used in components) */
        ember: {
          primary:  "#0D9488",
          hover:    "#0F766E",
          accent:   "#F59E0B",
          bg:       "#FFFFFF",
          surface:  "#F7F7F7",
          raised:   "#EBEBEB",
          border:   "#DDDDDD",
          text:     "#222222",
          text2:    "#717171",
          neutral:  "#767676",
          success:  "#008A05",
          warning:  "#E07912",
          error:    "#C13515",
        },

        /* Tailwind semantic */
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

        /* Legacy aliases */
        ink:     { DEFAULT: "#222222", cream: "#F7F7F7" },
        canvas:  { DEFAULT: "#F7F7F7" },
        lifted:  { DEFAULT: "#FFFFFF" },
        link:    { DEFAULT: "#0D9488" },
      },

      fontFamily: {
        display: ["Nunito Sans", "sans-serif"],
        sans:    ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
        code:    ["JetBrains Mono", "ui-monospace", "monospace"],
      },

      borderRadius: {
        lg:      "12px",
        md:      "8px",
        sm:      "6px",
        btn:     "8px",
        pill:    "9999px",
        stadium: "2.5rem",
      },

      boxShadow: {
        card:         "0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
        "card-hover": "0 2px 4px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)",
        modal:        "0 6px 20px rgba(0,0,0,0.12), 0 16px 40px rgba(0,0,0,0.16)",
        nav:          "0 1px 0 #DDDDDD",
        "coral-glow": "0 4px 16px rgba(255,90,95,0.30)",
        "teal-glow":  "0 4px 16px rgba(0,166,153,0.28)",
        "gold-glow":  "0 4px 16px rgba(224,121,18,0.30)",
        "sky-glow":   "0 4px 16px rgba(93,173,226,0.28)",
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
