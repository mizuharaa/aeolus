# Design — Aeolus

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

**Decision record (2026-07-15):** the old "two worlds" split (beige editorial
landing vs. white daylight simulator) is retired. ONE world: the landing's
control-tower editorial paper carries through the simulator. Semantic pigments
keep their jobs everywhere.

**Decision record (2026-08-05):** in the simulator the CASCADE TIMELINE is the
hero and the map is a locator. The map previously held the largest region on
screen while spending ~97% of its marks on other carriers' ADS-B traffic, and
the Gantt — the only surface where cause, propagation and time are legible at
once — showed 1.96 of 18 rows identically at every viewport. Side panels are
docked grid tracks, not floating overlays: as overlays they covered 62.4% of the
map at 1280 and overlapped each other at 200% zoom. The console shell is fixed
(`100dvh`, `overflow: hidden`); it must not be able to scroll away mid-incident.

**Decision record (2026-08-05):** VISUAL WEIGHT FOLLOWS CONSEQUENCE. A committed
or applied state owns the filled/inverted treatment; selecting, inspecting or
hovering gets an outline or a tint. This was inverted in two places and both
read as "already decided": the inspected plan tab was an ink slab while the
applied plan had a 3px border, and the selected row of a 21-item event picker
was the darkest object on the console.

## Genre
editorial (control-tower editorial — dense operational surfaces on warm paper)

## Macrostructure family
- Marketing pages (`/`): staged scroll experience (opening wordmark → hero →
  cinematic demo → methodology → night CTA). Owned by `scroll-experience.tsx`.
- App pages (`/simulator/*`): Workbench — a FIXED shell (`100dvh`,
  `overflow: hidden`, every region scrolling internally) laid out as
  `icon rail · [Events track] · (map over cascade timeline) · [Recovery track]`.
  The timeline is the hero and takes the remaining height; the map is a
  resizable locator above it (default 300px, persisted). Side panels are docked
  tracks that take width — never overlays over the map — and become overlays
  only below 900px, where a docked panel would starve the map. No theatrical
  motion in app chrome; functional motion only.
  - Nothing auto-opens. A panel that opens itself and pre-selects an option
    reads as a decision the operator did not make; collapsed launchers carry a
    count badge instead.
- Content pages (`/docs`, legal): Long Document, typography only.

## Colors

Authoritative source: `apps/web/app/globals.css` (`--ae-*`, two registers:
`:root` and `.register-dark`) surfaced through `apps/web/lib/design-tokens.ts`.

An earlier revision of this section documented a `--color-*` family that **does
not exist anywhere in the codebase**, with values that did not match the real
tokens. Those names are gone; the table below is the shipped set. Verify any
change with `node apps/web/scripts/check-contrast.mjs`, which fails the build
on a contrast regression.

### Surfaces and type
| Token | Light (`:root`) | Job |
|---|---|---|
| `--ae-bg` | `#F5F1E8` | page floor |
| `--ae-surface` | `#FFFEF9` | card / panel |
| `--ae-surface-2` | `#EFE9DB` | recessed well, tab bar |
| `--ae-surface-3` | `#E5DCC8` | track fill, deep recess |
| `--ae-line` | `rgba(28,20,38,0.12)` | hairline |
| `--ae-text` | `#1C1426` | headings, emphasis |
| `--ae-text-2` | `#5A5147` | running text |
| `--ae-text-3` | `#675E4E` | captions, labels — **AA on every surface** |
| `--ae-focus` | `#5B3FA8` | focus ring — **solid, ≥3:1 as a non-text mark** |

`--ae-text-3` and `--ae-focus` were `#8C8272` and `rgba(91,63,168,0.35)`. The
first produced 14 of the 15 WCAG failures on the console at 3.13–3.75:1; the
second composited to 1.80:1, under the 3:1 non-text minimum. Do not lighten
either without re-running the contrast gate.

### Pigments — semantic, never decorative
| Pigment | Value | Job |
|---|---|---|
| plum | `--ae-teal #5B3FA8` | identity, action, recovery, active state (name kept, value re-inked) |
| lavender | `--ae-sky #8B6FD0` | atmosphere |
| gold | `--ae-amber #B8863C` | events, ops status, delayed |
| rose | `--ae-rose #C13A6B` | disruption energy |
| ops blue | `#1C6FA8` (map literal) | a flight that is OPERATING — in the air, on its trajectory |

- **Cancelled is NEVER a hue**: neutral + strike / ✕ / dashed edge. It is a PALE
  GHOST (`#C9CCC9` disc, dark dashed border, dark glyph), not a solid mid-grey
  disc — "no longer operating" should recede, and the old mid-grey sat at 1.14:1
  against the operating blue, i.e. separable by hue but identical in lightness.
- **Operating is blue; grey belongs to cancelled alone.** Grey previously meant
  three different things — owned nominal, ambient traffic, and cancelled — so
  "not flying" had no colour of its own. Hue 204 was chosen against the rest of
  the palette, not by eye: 52 degrees off plum, 31 off the airport teals, 168 off
  the amber cascade ramp. Operating stays LIGHTER than cascade-direct (5.10 vs
  7.05 on the basemap) so a nominal flight can never out-weigh a disrupted one.
  Ambient other-carrier traffic is the same family one step quieter (`#8FB0C9`,
  2.15:1) and must stay >=3:1 clear of the faintest airport tier.
- **Cascade severity has ONE source**: the `cascade` ramp in
  `lib/design-tokens.ts`, imported by both the timeline and the map. It varies
  LIGHTNESS, not alpha — an alpha ramp faint enough to read as "less severe"
  also falls under 3:1, and where a step must stay pale its BORDER carries the
  contrast so severity is never colour-alone. Never redeclare these locally:
  the map and timeline once disagreed by a full cascade order under a comment
  claiming they matched.
- Map marks are canvas literals (`MAP_COLORS`, `pigment.*`) — Leaflet's canvas
  renderer cannot read a CSS variable. Anything carrying SHARED meaning is
  imported from `design-tokens`, not restated.
- Airport tiers follow the network's own `hub_type` from `GET /api/v1/airports`
  (hub / focus_city / spoke) — never a hand-maintained list, which was wrong in
  both directions and hid 11 of 15 airports.

## Typography
- Display: Inter Display 600–800, −0.01…−0.035em, roman only (no italic headers)
- Body: Inter 400/500
- Mono: JetBrains Mono — flight IDs, timestamps, tabular ops data, eyebrows
- Eyebrow: 10.5px mono, 600, 0.14em tracking, uppercase — THE one caps style,
  and the `Eyebrow` primitive in `components/ds/primitives.tsx` is its only
  correct implementation. An audit measured 8 competing uppercase treatments on
  one screen; 7 inline ones remain and should migrate to the primitive.
- No display serif anywhere. Fraunces is retired — an italic display serif
  dropped into a sans landing is a recognisable generated-page tell, and the
  stylesheet is no longer loaded. Emphasis comes from weight and size.

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

## Components

Shared primitives live in `apps/web/components/ds/primitives.tsx`; simulator
chrome in `apps/web/components/simulator/`. Reuse before adding — the drift in
this system has come from re-implementing, not from gaps.

| Component | Where | Contract |
|---|---|---|
| `Eyebrow` | `ds/primitives.tsx` | the ONE caps style. Mono, 10.5px, 600, 0.14em. |
| `StatusBadge` | `ds/primitives.tsx` | pigment UNDERLINE + text. Never a dot. |
| `Type`, `Hairline`, `CreamCallout` | `ds/primitives.tsx` | type roles, rules, inset notes. |
| `FloatingPanel` | `simulator/workspace-chrome.tsx` | side panel. `docked` (default true) = grid track; `docked={false}` = overlay. Collapses to an edge-rail launcher with an optional count badge. |
| `useResizable` / `ResizeHandle` | `simulator/workspace-chrome.tsx` | pointer-drag sizing with min/max clamp and localStorage persistence. |
| `SimulatorPageShell` | `simulator/page-shell.tsx` | wrapper for every secondary `/simulator/*` route (breadcrumbs, title, actions). Note the name — not `PageShell`. |
| `SimulatorRail` | `simulator/rail.tsx` | the persistent left icon rail. **Canonical for route↔icon pairing** — any other surface linking the same route uses the rail's glyph. |
| `AgentBubble` | `simulator/agent-bubble.tsx` | "Ask Aeolus". Lives in the top bar, not floating over the workspace. |

Every interactive component ships default, hover, focus-visible, active,
disabled, loading and empty. Half a set is not a component.

- **Empty states state the truth**, they do not draw nothing and they do not
  draw filler. The timeline says "Network nominal — N legs, no cascades" rather
  than back-filling 18 undifferentiated grey rows.
- **Empty-state copy must name a control that exists.** The Recovery panel once
  said "trigger an event from the left rail"; the rail is route navigation and
  has no trigger.
- **Irreversible actions arm before they fire.** Commit and Reset both take two
  clicks, and the first states the consequence in the operator's own units
  ("67 delayed · 14 FAR 117 flags · $3.18M"). Inline, not a modal.
- **Targets are ≥24px** (WCAG 2.5.8), ≥44px for primary actions.
- **Overlay lanes on the map are owned, one each**: disruption card top-left,
  search top-centre, zoom top-right, layers+key bottom-centre. A new overlay
  claims a lane or joins an existing cluster; it does not stack.

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
