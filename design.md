# Design — Aeolus

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

**Decision record (2026-07-15):** the old "two worlds" split (beige editorial
landing vs. white daylight simulator) is retired. ONE world: the landing's
control-tower editorial paper carries through the simulator. Semantic pigments
keep their jobs everywhere.

**Decision record (2026-07-28):** the marketing opening is now a cinematic
Feature Stack: cabin interior → full airframe → AEOLUS wordmark interlude →
interactive Earth event theatre → direct OCC product surface. Motion is
reversible and selective; the aircraft climb is the single authored autoplay
beat. WebGL is functional enrichment, because cabin, airframe and event effects
communicate the simulation model. WebGL loops pause outside their visible stage.

**Decision record (2026-07-28, refinement):** the authored flight follows a
slow, shallow Q-shaped bank, then advances through the AEOLUS identity with a
deliberate dwell before leaving the globe idle at its split-view entrance. The
Earth keeps natural blue/green raster detail and physical relief; restrained
amber country outlines and event pulses carry the futuristic register. The demo
uses a transform-built physical laptop whose inertial hinge opens directly onto
the actual live OCC surface; there is no raster frame playback or product
crossfade. One pinned ScrollTrigger owns hinge targets, screen dolly, playback,
and reverse travel so those states cannot diverge. The globe's hub-closure mark
is an operational crossed-runway beacon with hold bars, bearing arcs and a
directional sweep, not a generic radar target. Phones and reduced-motion clients
use the open live console in normal flow.

## Genre
editorial (control-tower editorial — dense operational surfaces on warm paper)

## Macrostructure family
- Marketing pages (`/`): staged scroll experience (cabin → airframe/Q-climb →
  opening wordmark → interactive Earth → cinematic demo → methodology → night
  CTA). Owned by `scroll-experience.tsx`.
- App pages (`/simulator/*`): Workbench — three-zone resizable console
  (control rail · map hero · decision rail · docked timeline). No theatrical
  motion in app chrome; functional motion only.
- Content pages (`/docs`, legal): Long Document, typography only.

## Theme (from `apps/web/app/globals.css` — `--ae-*` registers + `.lp` scope)
- `--color-paper`   #F5F0E3 (landing noon / app bg)
- `--color-paper-2` #EFE8D6 (recessed wells)
- `--color-ink`     #141019 (warm ink)
- `--color-ink-2`   #55503F (running text)
- `--color-rule`    rgba(20,16,25,0.12)
- Accents — semantic, never decorative:
  - amber  #EFAF1B  events / ops status / CTA highlight
  - cobalt #2C49E0  intelligence / reference / recovery-teal register in app
  - violet #6F3FE4  disruption energy (landing narrative)
  - pink   #EC4899  disruption (map cascade)
  - Cancelled is NEVER a hue: neutral gray + strike/✕.
- Map colors are canvas literals (`MAP_COLORS`, `pigment.*`) — do not var() them.

## Typography
- Display: Inter Display 600–800, −0.01…−0.035em, roman only (no italic headers)
- Body: Inter 400/500
- Mono: JetBrains Mono — flight IDs, timestamps, tabular ops data, eyebrows
- Eyebrow: 10–11px mono, 0.14em tracking, uppercase — THE one caps style
- Fraunces italic is a legacy landing-only identity option. The established
  “simulated live.” highlight and existing editorial statements may retain it;
  new landing statements use roman Inter Display so emphasis comes from scale,
  colour and clipping.

## Spacing
4-pt scale via `tokens.spacing` (`lib/design-tokens.ts`). Named tokens only.

## Motion
- Easings: cubic-bezier(0.22, 0.9, 0.28, 1) for UI state; GSAP staging is
  landing-only. App chrome: ≤240ms functional transitions, transform/opacity.
- Reduced-motion: landing collapses to static dawn; app transitions ≤150ms fade.

## Microinteractions stance
- Silent success over celebratory toasts (sonner toasts carry data, not confetti)
- Status is TEXT, never dots: "LIVE"/"OFFLINE" pill, counts with pigment
  underline. Status dots are banned everywhere (landing + app).
- Focus ring: 3px `var(--ae-focus)`, instant, never animated.

## CTA voice
- Primary: ink fill (landing) / register primary (app), 8–10px radius, verb-led
- Secondary: hairline outline, ink text
- Map tools: 40px paper squares with hairline border, one vertical instrument
  column at the map's top-right — the column is the ONLY owner of that corner.
  Floating overlays (banners, tickets) must clear it: `right ≥ 64px`.

## Per-page allowances
- Landing MAY use enrichment (interactive WebGL cabin, aircraft and Earth;
  CSS-art demo console; SVG ribbons).
- App pages MUST NOT use enrichment — function carries the page.
- Content pages: typography only.

## What pages MUST share
- The AeolusMark cyclone logo (no airplane, no globe in brand marks)
- Paper/ink registers + semantic pigments above
- Inter/Inter Display + JetBrains Mono pairing
- Eyebrow style, focus ring, no-status-dots rule, honest-copy rule
  (no invented metrics; simulation data is labeled as simulation)

## What pages MAY differ on
- The landing runs GSAP-staged registers (dawn/noon/night); the app stays on
  its bright paper register end to end.
- Map/timeline data-viz uses canvas-literal pigments.

## Exports

`tokens.css` at the project root is the source of truth. These snapshots make
the same system portable without changing the locked visual decisions above.

### 1. tokens.css

```css
:root {
  --color-paper: oklch(95.5% 0.018 82);
  --color-paper-2: oklch(91.5% 0.025 78);
  --color-paper-3: oklch(88% 0.03 78);
  --color-ink: oklch(17% 0.026 307);
  --color-ink-2: oklch(36% 0.024 78);
  --color-muted: oklch(54% 0.02 78);
  --color-neutral: oklch(38% 0.018 78);
  --color-rule: oklch(84% 0.018 78);
  --color-rule-2: oklch(76% 0.02 78);
  --color-accent: oklch(72% 0.15 77);
  --color-accent-ink: oklch(14% 0.025 307);
  --color-focus: oklch(73% 0.16 77);
  --color-night: oklch(14% 0.032 307);
  --color-night-2: oklch(20% 0.042 303);
  --color-night-rule: oklch(72% 0.035 290 / 0.22);
  --color-plum: oklch(48% 0.19 298);
  --color-violet: oklch(61% 0.16 300);
  --color-rose: oklch(58% 0.18 9);
  --color-blue: oklch(68% 0.12 242);
  --color-error: oklch(60% 0.2 24);
  --color-success: oklch(62% 0.13 155);

  --font-display: "Inter Display", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter", "Inter Display", ui-sans-serif, system-ui, sans-serif;
  --font-outlier: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  --display-weight: 800;
  --display-style: normal;
  --tracking-display: -0.045em;
  --tracking-label: 0.1em;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1.125rem;
  --text-lg: 1.375rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.25rem;
  --text-display: clamp(3rem, 6vw + 1rem, 6.5rem);

  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  --space-2xl: 4.5rem;
  --space-3xl: 7rem;
  --space-4xl: 11rem;
  --space-5xl: 14rem;
  --space-fluid-gutter: clamp(1rem, 4vw, 3.5rem);

  --rule-hair: 0.5px;
  --rule-fine: 1px;
  --radius-card: 0.625rem;
  --radius-pill: 999px;
  --radius-input: 0.5rem;
  --shadow-card: 0 1.5rem 4rem -2rem oklch(3% 0.02 300 / 0.38);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-micro: 120ms;
  --dur-short: 220ms;
  --dur-long: 420ms;

  --banner-height: 64px;
  --z-sticky: 20;
  --z-sticky-nav: 60;
}
```

### 2. Tailwind v4 @theme

```css
@theme {
  --color-paper: oklch(95.5% 0.018 82);
  --color-paper-2: oklch(91.5% 0.025 78);
  --color-paper-3: oklch(88% 0.03 78);
  --color-ink: oklch(17% 0.026 307);
  --color-ink-2: oklch(36% 0.024 78);
  --color-muted: oklch(54% 0.02 78);
  --color-neutral: oklch(38% 0.018 78);
  --color-rule: oklch(84% 0.018 78);
  --color-rule-2: oklch(76% 0.02 78);
  --color-accent: oklch(72% 0.15 77);
  --color-focus: oklch(73% 0.16 77);
  --color-night: oklch(14% 0.032 307);
  --color-plum: oklch(48% 0.19 298);
  --color-violet: oklch(61% 0.16 300);
  --color-rose: oklch(58% 0.18 9);
  --color-blue: oklch(68% 0.12 242);

  --font-display: "Inter Display", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-outlier: "JetBrains Mono", ui-monospace, monospace;

  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --spacing-2xl: 4.5rem;
  --spacing-3xl: 7rem;
  --spacing-4xl: 11rem;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1.125rem;
  --text-lg: 1.375rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.25rem;

  --radius-card: 0.625rem;
  --radius-input: 0.5rem;
  --radius-pill: 999px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### 3. DTCG tokens.json

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(95.5% 0.018 82)", "$type": "color" },
    "paper-2": { "$value": "oklch(91.5% 0.025 78)", "$type": "color" },
    "paper-3": { "$value": "oklch(88% 0.03 78)", "$type": "color" },
    "ink": { "$value": "oklch(17% 0.026 307)", "$type": "color" },
    "ink-2": { "$value": "oklch(36% 0.024 78)", "$type": "color" },
    "muted": { "$value": "oklch(54% 0.02 78)", "$type": "color" },
    "rule": { "$value": "oklch(84% 0.018 78)", "$type": "color" },
    "rule-2": { "$value": "oklch(76% 0.02 78)", "$type": "color" },
    "accent": { "$value": "oklch(72% 0.15 77)", "$type": "color" },
    "focus": { "$value": "oklch(73% 0.16 77)", "$type": "color" },
    "night": { "$value": "oklch(14% 0.032 307)", "$type": "color" },
    "plum": { "$value": "oklch(48% 0.19 298)", "$type": "color" },
    "violet": { "$value": "oklch(61% 0.16 300)", "$type": "color" },
    "rose": { "$value": "oklch(58% 0.18 9)", "$type": "color" },
    "blue": { "$value": "oklch(68% 0.12 242)", "$type": "color" }
  },
  "font": {
    "display": {
      "$value": "Inter Display, Inter, ui-sans-serif, system-ui, sans-serif",
      "$type": "fontFamily"
    },
    "body": {
      "$value": "Inter, ui-sans-serif, system-ui, sans-serif",
      "$type": "fontFamily"
    },
    "outlier": {
      "$value": "JetBrains Mono, ui-monospace, monospace",
      "$type": "fontFamily"
    }
  },
  "size": {
    "text-xs": { "$value": "0.75rem", "$type": "dimension" },
    "text-sm": { "$value": "0.875rem", "$type": "dimension" },
    "text-md": { "$value": "1.125rem", "$type": "dimension" },
    "text-lg": { "$value": "1.375rem", "$type": "dimension" },
    "text-xl": { "$value": "1.75rem", "$type": "dimension" },
    "text-2xl": { "$value": "2.25rem", "$type": "dimension" },
    "text-display": { "$value": "6rem", "$type": "dimension" }
  },
  "space": {
    "3xs": { "$value": "0.25rem", "$type": "dimension" },
    "2xs": { "$value": "0.5rem", "$type": "dimension" },
    "xs": { "$value": "0.75rem", "$type": "dimension" },
    "sm": { "$value": "1rem", "$type": "dimension" },
    "md": { "$value": "1.5rem", "$type": "dimension" },
    "lg": { "$value": "2rem", "$type": "dimension" },
    "xl": { "$value": "3rem", "$type": "dimension" },
    "2xl": { "$value": "4.5rem", "$type": "dimension" },
    "3xl": { "$value": "7rem", "$type": "dimension" },
    "4xl": { "$value": "11rem", "$type": "dimension" }
  },
  "duration": {
    "micro": { "$value": "120ms", "$type": "duration" },
    "short": { "$value": "220ms", "$type": "duration" },
    "long": { "$value": "420ms", "$type": "duration" }
  }
}
```

### 4. shadcn/ui CSS variables

```css
:root {
  --background: 95.5% 0.018 82;
  --foreground: 17% 0.026 307;
  --card: 91.5% 0.025 78;
  --card-foreground: 17% 0.026 307;
  --popover: 91.5% 0.025 78;
  --popover-foreground: 17% 0.026 307;
  --primary: 72% 0.15 77;
  --primary-foreground: 14% 0.025 307;
  --secondary: 88% 0.03 78;
  --secondary-foreground: 36% 0.024 78;
  --muted: 84% 0.018 78;
  --muted-foreground: 54% 0.02 78;
  --accent: 72% 0.15 77;
  --accent-foreground: 14% 0.025 307;
  --destructive: 60% 0.2 24;
  --destructive-foreground: 95.5% 0.018 82;
  --border: 84% 0.018 78;
  --input: 84% 0.018 78;
  --ring: 73% 0.16 77;
  --radius: 0.625rem;
}
```
