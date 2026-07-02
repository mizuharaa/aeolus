# Aeolus — Design System

Five colors, one status color. Everything on every screen resolves to one
of five colors (or a documented derivation of one). Rebuilt July 2026;
replaces the teal/white/red theme and the Airtable-editorial pass before it.

Source of truth in code:
- `apps/web/lib/design-tokens.ts` — token objects every component imports
- `apps/web/app/globals.css` — CSS custom properties, both registers
- `apps/web/tailwind.config.ts` — Tailwind bridge + **palette clamp**

---

## 1. Palette — five colors, one status color

| Color | Hex | Role |
|---|---|---|
| **ink** | `#0F1412` | near-black (teal-cast) — dark surfaces, primary type on light |
| **paper** | `#F5F5F0` | warm off-white — light surfaces, type on dark |
| **gray** | `#6A716D` | the mid neutral (ink/paper derivation) — borders, dim text, cancelled |
| **teal** | `#0D9488` | THE identity color — actions, links, recovery, active/selected, hubs |
| **amber** | `#B8863C` | THE status color — delayed / warning / critical / cascade / ground stop |

**Cancelled / not operating is not a hue.** It renders as neutral gray plus
a strike, dash, or ✕ — an absence of operation. Severity inside amber is
carried by opacity steps (`--ae-amber-soft` 55 %, `--ae-amber-soft2` 30 %),
never by a second status hue. Legacy `--ae-rust*` variables still exist as
**aliases of amber** so old call sites resolve safely; don't use them.

### Derived steps (not new colors)

Status **text** needs AA at 11–13 px, so teal and amber each have a
per-register text step (`--ae-*-ink`), a tint background (`--ae-*-bg`,
10–16 % alpha), and the raw pigment for dots/bars/lines:

| Var | Light register | Dark register |
|---|---|---|
| `--ae-teal-ink` | `#0B7065` | `#45B3A5` |
| `--ae-amber-ink` | `#7E5A20` | `#CDA05E` |

Neutral roles per register:

| Var | Light (landing) | Dark (simulator) |
|---|---|---|
| `--ae-bg` | `#F5F5F0` | `#0F1412` |
| `--ae-surface` | `#FAFAF6` | `#141917` |
| `--ae-surface-2` | `#EFEFE8` | `#1A201D` |
| `--ae-surface-3` | `#E2E2D9` | `#242B27` |
| `--ae-line` | ink @ 12 % | paper @ 10 % |
| `--ae-text` / `-2` / `-3` | `#0F1412` / `#3F4642` / `#6A716D` | `#ECEEE9` / `#B9BEB7` / `#878E88` |
| `--ae-primary` (button) | ink | **teal** (label = ink) |

### Two registers, one token set

- `:root` = light register — landing, docs, scenarios.
- `.register-dark` = dark register — the entire simulator app (applied by
  `app/simulator/page.tsx` and `components/simulator/page-shell.tsx`).
  It also overrides the shadcn HSL bridge, so Tailwind semantic classes
  (`text-muted-foreground`, `border-border`, …) flip automatically.
- Components reference the same `c.*` tokens in both worlds.

### The palette clamp

`tailwind.config.ts` overrides **every** default Tailwind hue family with a
ramp generated from the pigments (red/rose/pink/orange/amber/yellow/violet/
purple→amber; green/emerald/sky/blue/indigo/cyan→teal; slate/gray/zinc/
stone→neutral). A stray `text-red-700` anywhere in the app resolves into
the vocabulary — the rainbow is structurally impossible.

### Status vocabulary (same color = same meaning, everywhere)

- **nominal / on-time** → quiet neutral (no color; nominal doesn't shout)
- **delayed / warning / critical / GDP / WX / ground stop / cascade** → amber;
  severity/generation = amber opacity steps + size/halo at marks
- **cancelled / not operating** → neutral gray + ✕ / dash / strikethrough (never color-alone)
- **recovered / rerouted / applied plan / live-ok** → teal
- Live ADS-B traffic → neutral gray (background context, not a status)
- Recovery **plans A–D have no per-plan colors** — they differ by data; only
  the *applied* plan carries teal.
- Text wears text tokens; the pigment goes on the dot/bar/swatch next to it.

Map colors are the same pigments **inlined as literal hex** in
`flight-map.tsx` (`MAP_COLORS`) because Leaflet's canvas renderer can't read
CSS variables. Keep them in sync by hand.

---

## 2. Typography — one family

**Inter** (+ **Inter Display**, its optical-size variant, for headlines) via
rsms.me; **JetBrains Mono** strictly for code blocks, flight IDs,
timestamps, and tabular ops data. No secondary display font.

Scale (from `tokens.typography`):

| Role | Spec |
|---|---|
| displayXl | 56 / 600 / 1.04 / −0.022em — landing h1 |
| displayLg | 40 / 600 / 1.10 — CTA band |
| displayMd | 28 / 600 / 1.16 — section h2 |
| titleLg / titleMd / titleSm | 20 / 16 / 14 @ 550 — cards, panels, rows |
| bodyMd | 14 / 400 / 1.55 — running text |
| caption | 12 / 450 — meta |
| **eyebrow** | **11 / 550 / 0.14em tracking / UPPERCASE / text-3** |

**Caps policy:** `eyebrow` is the ONE sanctioned uppercase style — max 1–2
per screen. Nothing else uppercases. `font-black`/`font-bold` label styling
is retired in favor of 500–600 weights.

---

## 3. Spacing, radius, elevation

- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48; landing section rhythm **112 px**.
- Radius: 2 / 6 / 10 / 12 / pill. Buttons 10 px.
- Shadows: flat-first. `cardSoft` 0 1 2 @ 5 %, `cardElev` 0 6 24 @ 10 %,
  `overlay` 0 16 48 @ 16 %. **No colored glows anywhere** (legacy
  `*-glow` shadow names resolve to flat elevation).

---

## 4. Iconography

`lucide-react` only, `strokeWidth={1.75}`, monochrome (`text-3`) at rest;
teal only on active/selected state. No icon-in-colored-circle chips. No
emoji in UI chrome (map banners/popups use lucide via `EventIcon`).

---

## 5. Motion

Two motion systems, both in `components/landing/scroll-fx.tsx` +
`hero-section.tsx`:

- **Assembly intro** (podium.global-inspired): on mount, the hero is built
  from scattered product fragments — the render, the plan card, the cascade
  readout, data tags, the headline lines — that spring in from offset
  positions and scaffold toward their final placement (~1.2 s, once).
- **Scroll-scrubbed panning** (`PanIn`): section entrances are pure
  functions of scroll position — panels pan in from left/right and reverse
  when the user scrolls back. No IntersectionObserver, no one-shot
  triggers; content can never be stranded at opacity 0.
- **The scroll plane** (`ScrollPlane`): a huge top-view jet (the map-marker
  silhouette, teal wing) flies a fixed flight plan across the page, its
  position/heading/scale/color all driven by scroll progress — down flies
  the route, up flies it in reverse. It switches ink→paper as it crosses
  into the dark CTA band. Desktop only; removed under reduced motion.
- **No continuous decorative animation.** No pulsing live dots, no glow
  loops, no idle floats. The one live indicator (simulator nav) is a small
  **static** dot: teal = connected, amber = offline.
- Functional motion is allowed: the map's flowing dash on swap routes
  encodes "actively rerouting"; plan-apply remounts the route layer for a
  one-time fade-in. `prefers-reduced-motion` collapses everything.
- The hero render sways ±3°; it never spins or pulses, pauses offscreen,
  and renders a single static frame under reduced motion.

---

## 6. The hero asset

`components/landing/hero-cascade.tsx` — a real-time Three.js render (not a
screenshot mockup): the 15 Nimbus airports at true projected coordinates on
an ink slab, teal route arcs, the ORD epicenter glowing amber with its
first-generation cascade edges. One directional key light with PCF-soft
shadows + hemisphere fill + RoomEnvironment reflections + ACES tone
mapping; contact shadow grounds the slab. Two genuine UI fragments (plan
card, cascade readout) overlay it. Loaded via `next/dynamic` so three.js
stays out of the first-load bundle; a flat ink slab holds the composition
while it streams.

---

## 7. Layout rules

- Landing sections vary structure: hero+render → ruled stat band → two
  asymmetric anchor panels + plain-text grid on hairlines → horizontal
  timeline (dots on one rule, small mono numerals — the ghost-numeral motif
  is retired) → full-bleed ink CTA. Never the same card grid twice.
- Filters/tabs are **underline tabs** (teal rule on active), not boxed pills
  — simulator nav routes and the event-panel tabs both follow this.
- Simulator keeps the 3-zone workspace (event rail / map+timeline / plans
  rail); the map is the hero surface on Carto **dark_all** tiles.

## 8. Copy rules

Concrete nouns, mechanisms, and numbers ("propagates the cascade through
every aircraft rotation", "DOT Form 41 block-hour rates", "<10 ms").
No negation-framed marketing ("not a black box", "no filler"), no
adjective stacks, no glow words.

---

## shadcn/ui

Still used for Button, Card, Input, Select, Tabs, Badge, Dialog, Tooltip,
Separator, Skeleton — all themed through the CSS-variable bridge in both
registers. Skeletons (`animate-pulse`) are legitimate loading feedback and
remain.
