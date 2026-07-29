# Design — Aeolus

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

**Decision record (2026-07-15):** the old "two worlds" split (beige editorial
landing vs. white daylight simulator) is retired. ONE world: the landing's
control-tower editorial paper carries through the simulator. Semantic pigments
keep their jobs everywhere.

## Genre
editorial (control-tower editorial — dense operational surfaces on warm paper)

## Macrostructure family
- Marketing pages (`/`): staged scroll experience (opening wordmark → hero →
  cinematic demo → methodology → night CTA). Owned by `scroll-experience.tsx`.
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
- Fraunces italic: landing-only accent phrase; never in the app

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
- Landing MAY use enrichment (CSS-art demo console, 3D paper dart, SVG ribbons).
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
