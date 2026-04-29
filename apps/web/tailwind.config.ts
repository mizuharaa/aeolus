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
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",

        /* Flip7 primary palette */
        teal: {
          DEFAULT: "#2BA8A2",
          light:   "#3CC4BD",
          dark:    "#1E8C86",
          bg:      "#E8F6F5",
        },
        coral: {
          DEFAULT: "#EF6C4A",
          light:   "#FF8A6A",
          dark:    "#D45233",
        },
        gold: {
          DEFAULT: "#FFD23F",
          light:   "#FFE47A",
          dark:    "#E6B800",
        },
        cream: { DEFAULT: "#FFF8E7" },

        /* Legacy aliases — keeps existing classes working */
        ink: {
          DEFAULT: "#1F2937",
          cream:   "#EFF8F7",
        },
        canvas:        { DEFAULT: "#EFF8F7" },
        lifted:        { DEFAULT: "#FFFFFF" },
        "signal-light": "#FFD23F",
        link:          { DEFAULT: "#2BA8A2" },

        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft:       "hsl(var(--primary-soft))",
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
          warm:       "hsl(var(--accent-warm))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",

        "status-on-time":   "hsl(var(--status-on-time))",
        "status-delayed":   "hsl(var(--status-delayed))",
        "status-cancelled": "hsl(var(--status-cancelled))",
        "status-swapped":   "hsl(var(--status-swapped))",
        "status-airborne":  "hsl(var(--status-airborne))",
      },
      borderRadius: {
        lg:      "var(--radius)",
        md:      "calc(var(--radius) - 4px)",
        sm:      "calc(var(--radius) - 6px)",
        btn:     "9999px",        /* pill shape (Flip7) */
        stadium: "2.5rem",
        pill:    "9999px",
      },
      fontFamily: {
        sans:    ['"Sofia Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ['"Sofia Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      boxShadow: {
        nav:          "0 2px 8px rgba(0,0,0,0.08)",
        lift:         "0 4px 16px rgba(0,0,0,0.12)",
        card:         "0 4px 20px rgba(43,168,162,0.10)",
        "teal-glow":  "0 4px 20px rgba(43,168,162,0.30)",
        "coral-glow": "0 4px 20px rgba(239,108,74,0.35)",
        "gold-glow":  "0 4px 20px rgba(255,210,63,0.40)",
        "sky-glow":   "0 4px 16px rgba(93,173,226,0.30)",
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
