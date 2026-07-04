# Aeolus — Design System (Daylight Sky)

Rebuilt July 2026 (daylight revision). Replaces the dark five-pigment
system; before that, teal/white/red and the Airtable-editorial pass.
The product now lives in one bright, sky-blue world: the landing is an
animation-first 3D page, the simulator a dense daylight console.

Source of truth in code:
- `apps/web/lib/design-tokens.ts` — token objects every component imports
- `apps/web/app/globals.css` — CSS custom properties, both registers
- `apps/web/tailwind.config.ts` — Tailwind bridge + **palette clamp**

---

## 1. Palette — the sky vocabulary

| Color | Hex | Role |
|---|---|---|
| **ink** | `#0B2434` | deep sea-blue ink — type, dark marks, primary CTA on light |
| **paper** | `#F2F8FE` | sky-tinted white — page + surface floor |
| **gray** | `#63808F` | sea-gray mid neutral — borders, dim text, cancelled |
| **sky** | `#38BDF8` | the atmosphere — hero gradients, chrome accents, eyebrows |
| **teal** | `#0D9488` | THE identity color — actions, links, recovery, active, hubs |
| **pink** | `#EC4899` | the disruption accent — events, cascade energy (`--ae-rose*`) |
| **amber** | `#B8863C` | THE ops status color — delayed / warning (simulator only) |

**Cancelled / not operating is not a hue.** Neutral gray plus a strike,
dash, or ✕. Severity inside amber = opacity steps (`--ae-amber-soft/-soft2`),
never a second status hue. Landing semantics: **pink = disruption,
teal = recovery**. Legacy `--ae-rust*` aliases amber; don't use it.

### Derived steps (not new colors)

Each chroma has a per-register AA text step (`--ae-*-ink`), a tint
background (`--ae-*-bg`, 10–16 % alpha), and the raw pigment for marks:
`--ae-sky-ink #0369A1` · `--ae-teal-ink #0B7065` · `--ae-amber-ink #7E5A20`
· `--ae-rose-ink #BE185D`.

### Two registers, one token set — both DAYLIGHT

- `:root` — landing, docs, scenarios: bg `#F2F8FE`, white surfaces.
- `.register-dark` — historical name, **bright values**: the simulator's
  denser register (bg `#EAF4FC`, white cards, teal primary button). Kept
  so no call site churns; both registers override the shadcn HSL bridge.
- Hero/intro/CTA use the `.sky-gradient` / `.sky-gradient--deep` washes
  (#4BA6EC → #E4F3FE band) with white punched type on top.

### The palette clamp

`tailwind.config.ts` overrides every default Tailwind hue family:
red/rose/pink/fuchsia→pink · orange/amber/yellow→amber ·
green/emerald/lime/teal→teal · sky/blue/cyan/indigo/violet/purple→sky ·
slate/gray/zinc/stone→neutral. The rainbow stays structurally impossible.

### Status vocabulary (same color = same meaning, everywhere)

- nominal / on-time → quiet neutral (nominal doesn't shout)
- delayed / warning / GDP / WX / ground stop / cascade → amber (+ opacity steps)
- cancelled / not operating → neutral gray + ✕ / dash (never color-alone)
- recovered / rerouted / applied plan / live-ok → teal
- disruption events & cascade narrative on the landing → pink
- Plans A–D have **no per-plan colors**; only the applied plan wears teal.
- Map colors live as literal hex in `flight-map.tsx` (`MAP_COLORS`) —
  Leaflet's canvas renderer can't read CSS vars. Tiles: Carto **voyager**
  (light); `.leaflet-container` floor `#CBE3F5`.

---

## 2. Typography

**Inter / Inter Display** (rsms.me) + **JetBrains Mono** for code, flight
IDs, timestamps, tabular ops data. Scale unchanged in `tokens.typography`.

**The punched voice (landing only):** `.punch` — Inter Display 700,
−0.028em, uppercase, line-height 0.98. Variants: `--white` (on sky),
`--ink`, `--ghost` (transparent fill, 1.5px ink stroke — marquee strips).
Hero headline runs ~7vw. In the app registers the old caps policy holds:
`eyebrow` (11/550/0.14em) is the one uppercase style.

---

## 3. Spacing, radius, elevation

- Spacing 4/8/12/16/24/32/48; landing section rhythm 96–128 px.
- Radius: 2/6/10/12/pill; landing CTAs are **pill** buttons.
- Shadows are blue-cast (`rgba(11,36,52,…)`), flat-first; hero/CTA float
  on `0 10px 36px rgba(10,48,82,0.28)`. No colored glows.

---

## 4. Iconography

`lucide-react` only, `strokeWidth={1.75}`. Landing chips may set the icon
in a tinted circular well (`.sky-chip-icon`); app chrome stays monochrome
with teal on active. No emoji in chrome.

**Logo** (`components/ds/logo.tsx` + `app/icon.svg`): sky→teal gradient
tile, white globe + orbiting jet — the hero motif in miniature. Static.

---

## 5. Motion — the landing is animation-first

Stack: **GSAP ScrollTrigger + SplitText** (`components/landing/gsap.ts`,
`punch.tsx`) for scrubbed/pinned sequences, **Framer Motion** for
entrances/chips, **react-three-fiber** for the world.

- `LogoIntro` — 170vh brand curtain: full-screen mark + AEOLUS wordmark
  (SplitText chars), scroll scrubs the stage smaller/away (sticky stage,
  no GSAP pinning → no pin-spacer jank).
- `SkyHero` — punched white headline (SplitText line slam), globe crests
  from the bottom, glass chips float (gentle y-loop), scroll adds spin +
  parallax via a mutable `phaseRef` (never re-renders React).
- `GhostMarquee` — outlined display strip, x scrubbed by scroll.
- `RecoveryLoop` — 480vh pinned story driving `phase 0..4` into the story
  globe: rotate/zoom to US → KORD pink + flights ground (epicenter
  ripples) → dashed ghost plans shimmer → network re-routes teal. DOM plan
  chips sync at scene granularity (AnimatePresence). Mobile/reduced-motion
  → tabbed variant, no pinning.
- `CountUp` stats band; capability/methodology keep Framer `Rise`/stagger.
- The simulator stays functional-motion-only; its connection indicator is
  **text** ("LIVE"/"OFFLINE", mono, underlined teal/amber) — the status
  dot-in-a-pill pattern is retired everywhere.
- `prefers-reduced-motion` collapses all of it (GSAP skipped, spin frozen).

---

## 6. The world (hero asset)

`components/landing/globe.tsx` — react-three-fiber. Dotted-land sphere
(land points sampled client-side from `/textures/earth-mask.png`, polarity
auto-detected), quadratic-bezier great-circle tube arcs, paper-jet meshes
riding them (`up` = surface normal), ripple rings firing on every landing,
KORD epicenter ripple during the disrupt beat. No additive "atmosphere"
shell — over a transparent canvas it composites as a gray dome; the halo
is CSS behind the canvas. Loaded via `next/dynamic({ ssr: false })`; two
instances (hero + story) share the implementation via `mode` + `phaseRef`.

---

## 7. Layout rules

- Landing flow: curtain → hero → marquee → pinned loop → stats → 7/5 +
  4/4/4 capability panels → methodology ledger → sky-gradient CTA with the
  solve transcript → footer. Never the same card grid twice.
- Filters/tabs are underline tabs (teal rule); simulator keeps the 3-zone
  workspace (event rail / map+timeline / plans rail) on voyager tiles.

## 8. Copy rules

Concrete nouns, mechanisms, numbers. The hero states the promise plainly
("Put airline recovery on autopilot"); the loop narrates one incident in
four beats without airport in-jokes. No negation-framed marketing, no
adjective stacks.

---

## shadcn/ui

Button, Card, Input, Select, Tabs, Badge, Dialog, Tooltip, Separator,
Skeleton — themed through the CSS-variable bridge in both (daylight)
registers.
