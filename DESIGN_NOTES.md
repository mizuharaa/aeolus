# Aeolus — Design System

Two worlds, one product (July 2026):

- **Landing — "control-tower editorial"**: warm beige paper, near-black ink,
  cobalt / violet / amber ribbon accents, huge editorial type with masked
  ribbons (Hanoi-mask reference), and a pinned cinematic demo of one full
  recovery loop. Animation-first, GSAP-staged.
- **Simulator app — daylight sky**: the bright, dense operational console
  (sky paper, white cards, teal identity) is unchanged. No theatrical motion
  in app chrome.

Source of truth in code:
- `apps/web/app/globals.css` — app registers **and** the `.lp` landing scope
- `apps/web/lib/design-tokens.ts` — app token objects (simulator)
- `apps/web/tailwind.config.ts` — Tailwind bridge + palette clamp (app)

---

## 1. Landing palette — the beige editorial stage

Scoped under `.lp`; GSAP ScrollTrigger **tweens these custom properties
between four registers as you scroll** (see `scroll-experience.tsx`):

| Register | When | --bg | --ink |
|---|---|---|---|
| dawn  | wordmark + hero | `#EDE6D6` warm beige | `#1A1622` |
| noon  | demo + methodology | `#F5F0E3` bright | `#141019` |
| night | final CTA + footer | `#171320` deep ink | `#F0EBDF` |

Constant accents: `--accent-blue #2C49E0` (cobalt) · `--accent-purple
#6F3FE4` · `--accent-amber #EFAF1B` (yellow-amber) · `--accent-teal #0E7C6B`
(sparing). Plus `--muted`, `--panel`, `--border` per register.

Semantics on the landing: **violet/purple = disruption energy, amber =
operational highlight/CTA, cobalt = intelligence/reference, teal = recovery**
(teal stays THE identity color inside the simulator app).

The demo console has its own fixed **light** palette (`--dk-*` on
`.demo-screen`) mirroring the real simulator — paper floor, white cards,
teal identity, **pink** disruption — so the demo previews the actual
product rather than a fictional dark cockpit.

### App registers (simulator — unchanged)

`:root` + `.register-dark` keep the daylight sky values (ink `#0B2434`,
paper `#F2F8FE`, sky `#38BDF8`, teal `#0D9488`, pink `#EC4899` disruption,
amber `#B8863C` ops status). Tailwind palette clamp still applies. Cancelled
is never a hue (gray + ✕). Map = Carto voyager, `MAP_COLORS` literal hexes.

---

## 2. Typography

- **Inter / Inter Display** (rsms.me) everywhere; JetBrains Mono for code,
  flight IDs, timestamps, tabular data.
- Landing display voice: `.ed-display` — Inter Display **800**, −0.035em,
  line-height 0.97, **mixed case** (the old all-caps `.punch` voice is gone).
- `.ed-serif` — **Fraunces italic** (Google Fonts, italic axis only): the
  editorial accent for one emphasized phrase per headline
  ("*simulated live.*", "*Auditable.*"). Landing-only; never in the app.
- `.lp-eyebrow` — JetBrains Mono 11px, 0.22em tracking, uppercase: the mono
  technical label over big statements ("01 — The premise").
- App registers keep the 11px `.section-badge` eyebrow as the one caps style.

## 3. The masked wordmark (brand moment)

`components/landing/masked-wordmark.tsx` — huge ink letterforms stretched
wall-to-wall (`textLength` + `spacingAndGlyphs`), with three sine ribbon
bands (cobalt/violet/amber) traveling horizontally through the letters. One
geometry renders twice: faint across the whole stage + vivid clipped inside
a `<clipPath><text>` — so color slithers *through* the type. GSAP loops both
copies from a single tween per ribbon (they can never drift). Used for
"AEOLUS" (opening) and "RUN A DISRUPTION." (night CTA — letters flip to bone
automatically because the fill is `var(--ink)`).

**Logo**: `ds/logo.tsx` `AeolusMark` — an abstract cyclone: three arcs of
decreasing radius spiraling into a center; outer two take `currentColor`,
the core arc is always amber. No airplane, no globe, no tile. Mirrored in
`app/icon.svg` (beige tile). `AeolusLogo` is a compat alias.

## 4. Landing structure (page.tsx → scroll-experience.tsx)

1. `OpeningWordmarkStage` — brand row, masked AEOLUS, and **paper planes**
   (`planes.tsx` DriftPlane: two-tone folded darts that travel across the
   section on scroll scrub + a gentle framer bob). No abstract shape
   clutter, no airport-code strips. Scrubbed parallax exit, no pinning.
2. `HeroStatementStage` — "Airline recovery, *simulated live.*" with an
   **amber HighlightSwipe** panning left→right under the serif phrase,
   replaying on every re-entry (`type-fx.tsx`, toggleActions restart) +
   concrete copy (cost / passengers / crew legality / carbon) + pill CTAs.
3. `StoryMarquee` — Hub closure · Delay cascade · Four plans · Recovery,
   alternating solid/outline, scroll-scrubbed.
4. `CinematicSimulatorDemo` (`landing/demo/`) — **the centerpiece**, below.
5. `MethodologySection` — editorial systems ledger: mono amber indices,
   display-weight names, cobalt tags, hard rules; six systems incl. audit
   trail. High contrast on the noon register.
6. `FinalCTAStage` — masked "RUN A DISRUPTION.", amber CTA, solve transcript
   in `--panel`. + `LandingFooter`.

## 5. The cinematic demo — played like a video

**No pinning, no scroll scrub.** A ~25s GSAP timeline (paused, repeat −1,
repeatDelay 2.4) loops inside a normal section; a ScrollTrigger only
plays/pauses it while on screen. The camera ends back at the start framing
so the loop cuts cleanly. Caption steps auto-advance with playback;
clicking one **seeks** the video (`tl.play(t)`). Sparse route work — 5+4
pink cascade arcs, 4 teal reroutes, no graticule, no vignette.

The story on the light console: agent box **types** "Trigger weather
closure at KORD, severity 4." → visible cursor opens the event selector
and clicks → camera (translate/scale over a fixed 1500×860 world plane)
flies to KORD → pink cascade arcs draw (`pathLength={1}` dash trick),
airports tint amber, "departures held" counts → plan inspector slides in
(A–D) → cursor commits Plan B (teal select) → metrics count down (16→3
cancellations, −$1.7M), teal reroutes re-flow, toast lands, camera pulls
back. Status walks Nominal→Disrupted→Recovering→Stable; the bottom ops
strip doubles as the video progress bar (teal playhead).

Mobile plays the same loop full-width; `prefers-reduced-motion` renders
the final recovered frame as a static figure. AI behavior is a **frontend
state machine only** — nothing talks to the backend. (Headless captures
play slow — background-tab rAF throttling + GSAP lagSmoothing; real
foreground browsers run 1:1.)

### Hard-won gotchas (do not relearn)

- **GSAP parses React inline `translateX(108%)` into a PIXEL `x` cache.** If
  you then tween only `xPercent`, the leftover `x` keeps the element
  offscreen. Set `x: 0` in both fromTo states (see `.dm-plans`).
- **Fixed nav + retinting vars**: inline `var()` colors on a fixed element
  don't reliably repaint in Chromium when the variables change. The nav gets
  vars written inline by GSAP *and* colors via classes (`.lp-nav`,
  `.lp-nav-link`), and its bar fill is a child span whose `backgroundColor`
  is tweened as a literal. (Residual light-bar renders in *headless
  screenshots* are a capture artifact — the DOM/computed values are correct
  and real browsers paint fine; verify by un-fixing the element.)
- **`1fr` grid tracks are `minmax(auto,1fr)`** — the mobile step strip's
  min-content inflated the track past the viewport. Use `minmax(0,1fr)` +
  `min-width: 0` on horizontal scrollers.
- A theme-shift scrub tween chain on one target needs
  `immediateRender: false` on each later tween.
- Dev-server file watching under OneDrive is flaky: if SSR serves stale
  components (hydration mismatch diffs that look like old code), restart
  `next dev` with a fresh `.next`.

## 6. Motion rules

- GSAP ScrollTrigger + SplitText (registered once in `landing/gsap.ts`);
  `SplitReveal`/`TickerNumber` in `type-fx.tsx`; framer for entrances/floats
  (`motion.tsx`, `shapes.tsx`). gsap.context cleanup everywhere.
- The simulator keeps functional motion only; connection state is text
  ("LIVE"/"OFFLINE" underlined) — status dots stay banned everywhere.
- `prefers-reduced-motion` collapses the whole landing to static dawn.

## 7. Dashboard AI placeholder

`components/simulator/agent-bubble.tsx`, mounted once in
`app/simulator/page.tsx`: an ink "Ask Aeolus" pill (bottom-right) expanding
to a panel with example commands and a disabled input — honest copy ("Not
connected yet — ships with the agent backend"). Landing identity (ink/bone/
amber) so the brand reads across pages. One file + one mount line to remove
or wire up later.

## 8. Copy rules

Concrete aviation nouns: disruption, delay cascade, hub closure, recovery
plan, passenger impact, crew legality, cost delta, carbon, reroute, audit
trail. Banned: AI-powered, seamless, revolutionary, next-gen, unlock,
supercharge, status dots, fake "active" pills, emoji labels.

---

Retired components (dark sky landing: globe, sky-hero, intro, recovery-loop,
plane, capability-sections, punch) live in `reference/retired-landing-sky/`.
three.js / @react-three/* are uninstalled — the 3D feel is CSS perspective +
GSAP camera transforms + SVG. No Spline (no real scene URL exists).
