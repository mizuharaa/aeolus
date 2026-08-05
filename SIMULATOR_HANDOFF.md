# Aeolus simulator — handoff

**Written:** 2026-08-05
**Branch:** `fix/scroll-reveals-and-dashboard-a11y` (off `main` @ `3470ef3`)
**Scope of this document:** the ops console at `/simulator`, plus the landing
scroll fix that shares the branch. For the landing's scene set read
`LANDING_HANDOFF.md`; for the locked design system read `DESIGN.md`. Neither is
superseded by this file.

---

## 1. Current state

### Branch

| | |
|---|---|
| Branch | `fix/scroll-reveals-and-dashboard-a11y` |
| Base | `main` @ `3470ef3` |
| Pushed | **No.** Local only, no PR. |
| Commits ahead | 3 |
| Uncommitted | none (see below) |

Three commits are landed, oldest first:

- `3cffe3a` — `fix(landing): drive card reveals from scroll position, not thresholds`
- `128b90c` — `fix(simulator): real airport tiers, one cascade vocabulary, guarded commit`
- `083c37c` — `refactor(simulator): make the cascade timeline the hero, dock the panels`

`083c37c` is the layout pass this document mostly describes — 11 files,
+401 / −245, including the new `app/simulator/watchlist/` route.

The working tree is clean apart from **`.github/hooks/`**, which is untracked
and is the impeccable detector's hook config. It is **not part of this work** —
left deliberately for its owner to decide on.

### Verification status (all re-run at time of writing)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | 1 warning — pre-existing `no-page-custom-font` in `app/layout.tsx:81` |
| `node apps/web/scripts/check-contrast.mjs` | all pairs pass (exit 0) |
| impeccable detector | 7 findings, all pre-existing (5 `side-tab`, 2 `layout-transition`) |
| Console errors at `/simulator` | 0 |
| Horizontal overflow @ 1280/1440/1920/720 | 0 |

### Servers

Both were already running and are **not managed by this work**:
- web `http://localhost:3000` — `next dev`
- api `http://localhost:8000` — uvicorn, `aeolus-api 0.2.0`

⚠️ **Never run `npm run build` while the dev server is up** — it rewrites
`.next` and the dev server then 404s on `layout.css`/`main-app.js`. Kill dev,
clear `.next`, then build. **A production build has not been run since any of
this work.** That is the single biggest untested risk.

⚠️ The API is in-memory and stateful. Triggering an event during verification
leaves it applied until reset. Reset with:
```bash
curl -s -X POST http://localhost:8000/api/v1/simulator/reset
```
I left a committed plan in there once during this session; don't repeat it.

---

## 2. The five most important changes

### FRONTEND

**F1 — Workspace topology inverted: the cascade timeline is the hero, the map is a locator.**
`apps/web/app/simulator/page.tsx`
The map held the largest region (653,528px² @1280) spending ~97% of its marks on
*other airlines'* ADS-B traffic, while the cascade Gantt — the only surface where
cause, propagation and time are legible at once — showed **1.96 of 18 rows**,
identically at 1280/1440/1920, because every extra viewport pixel went to the
basemap. Now the map is a resizable fixed height (`MAP_H = 300`, persisted under
`aeolus-map-h`) and the timeline takes the remainder.
Measured: **1.96 → 10 rows @1440, 14 @1920.**
*Gotcha:* the timeline must use `flex: 1 1 0%`, **not** `1 1 auto`. With `auto`
it claims its 871px of content as flex basis, the row overflows, and the map
collapses to its 140px floor at every viewport. This bit me once.

**F2 — Side panels are docked grid tracks, not floating overlays.**
`apps/web/components/simulator/workspace-chrome.tsx` (`FloatingPanel`, new
`docked` prop, default `true`)
As z-640 overlays they covered **62.4%** of the map at 1280 with both open — the
steady state during a live disruption — **75.8%** at 200% zoom, and at 200% they
**overlapped each other by 128px** (each was capped against the viewport, never
against its sibling; Recovery painted over Events). Docking removes the
occlusion, the overlap, the z-index arbitration, and the
`selecting-a-flight-force-closes-both-panels` workaround that existed only
because the topology couldn't show a flight and its recovery options together.
Below 900px they revert to overlays (`docked={!tight}`) — at a 720px viewport a
docked 392px panel left the map 227px.

**F3 — The shell no longer scrolls away.**
`apps/web/app/simulator/page.tsx`, `apps/web/app/simulator/layout.tsx`
Was `minHeight: 100vh` on a scrolling document with **552px (40.8%)** below the
fold; reaching it took the map *and* the timeline entirely off screen. Now
`height: 100dvh; overflow: hidden` with every region scrolling internally. The
two things that lived below the fold moved out — see §3.1.

### BACKEND / DATA

**F4 — Airport tiers come from the API; the hardcoded duplicate was wrong.**
`apps/web/components/simulator/airports.ts`, `apps/api/src/routes/network.py:46`
(committed in `128b90c`)
`airports.ts` hardcoded `HUB_AIRPORTS = {KORD, KATL, KDFW, KDEN}`. The real list
from `data/network/airports.yaml` is `{KORD, KATL, KDFW, KLAX}` — **LAX is a hub
and was drawn as a spoke; KDEN is a focus city and was drawn as a hub.** The map
was misrepresenting the network to the operator. It also flattened the API's
three tiers to a binary, so 11 airports collapsed into one weight at 8px
`#7B8A80`, sitting **1.36:1** against 650 ambient glyphs that were *larger* than
them — the reported "only 4 blue dots". `hydrateAirportTiers()` now reads
`GET /api/v1/airports`, with the bundled tiers as first-paint fallback.

**F5 — `/network/aircraft` 404'd on every single load, silently.**
`apps/api/src/routes/network.py`, `apps/web/app/simulator/page.tsx:174`,
`apps/web/components/simulator/page-shell.tsx:55` (committed in `128b90c`)
The router is mounted **without a prefix**, so its paths are `/api/v1/aircraft`,
`/api/v1/airports`, … — but one route is declared `@router.post("/network/stress-test")`,
i.e. the file is internally inconsistent. The frontend called `/network/aircraft`
and got a 404 swallowed by `.catch(() => {})`, so **the dashboard ran on empty
fleet data indefinitely**. Fixed to `/aircraft`. See §3.4 — the inconsistency
itself is still open.

---

## 3. What needs to be done next

Ranked. Items 1–3 are blocking-ish; 4–7 are real but schedulable.

### 3.1 Decide whether `watchlist` is the right home, and push
The layout pass is committed (`083c37c`) but **nothing is pushed and there is no
PR**. Before that happens, one product call is outstanding: the new route
`app/simulator/watchlist/page.tsx` exists because `MyFlights` lived below the
dashboard fold, and removing the fold would otherwise have stranded a real
feature. It is now a rail entry (`rail.tsx`, `Bookmark` icon, "Operations"
group) and uses `SimulatorPageShell` (note: **`SimulatorPageShell`, not
`PageShell`**). The deleted `DeepLinkStrip` was pure duplication — 4 of its 5
tiles were second copies of always-visible rail entries — so that removal needs
no decision. If the watchlist belongs somewhere else, move it; **do not simply
delete it**, the feature has no other home.

### 3.2 Run a production build
Never done since any of this work. `next build` exercises code paths dev does
not. Kill dev → clear `.next` → build → restart dev.

### 3.3 Verify the docked panels against a real disruption at every width
I verified 1280/1440/1920/720 with a live event at 1440 only. The panel-track
widths (356 / 392) are still fixed pixel values that never scale — that is
unchanged from before and is a known weakness, not a regression.

### 3.4 Fix the API prefix inconsistency at the source
`apps/api/src/routes/network.py` declares 9 bare paths and 1 prefixed
(`/network/stress-test`, line 118). `apps/web/app/simulator/stress-test/page.tsx:63`
correctly calls `/network/stress-test`, so it works today **by luck**. Either
mount the router with `prefix="/network"` and update all callers, or drop
`/network` from line 118. Leaving it is how F5 happened.

### 3.5 Spacing system — the weakest remaining result
Measured: **40 distinct spacing values** in use against a healthy 6–8, **77.6%
hardcoded** (667 of 859 declarations). `sp.xxs` (4) and `sp.xl` (32) are *never
referenced* while raw `4` appears 68× and `32` twice. Near-duplicate clusters:
`9,10,11,12,13,14` inside a 5px band; `20,21,22,23,24,26` inside 6px. I only
normalised the regions I restructured. This is a mechanical sweep across ~38
files and would visibly tighten the whole console.

### 3.6 Deferred design-system sweeps (both fixed at the primitive, not the call sites)
- **8 uppercase styles** against DESIGN.md's "THE one caps style". I fixed
  `Eyebrow` in `components/ds/primitives.tsx` (it hardcoded `ff.body` while the
  spec says mono). **7 inline implementations remain** — `nav.tsx:112-128`,
  `nav.tsx:177-194`, `rail.tsx` group headings, `workspace-chrome.tsx`,
  `globals.css:993-997`, `flight-map.tsx`, `recovery-plans.tsx` column heads.
- **Status dots** are banned by DESIGN.md and shipped in 13 places. I fixed
  `StatusBadge` in `primitives.tsx` (the design system's own component violated
  the design system). **12 call sites remain.** Deleting the `dot:` key from
  `design-tokens.ts:98-119` turns them into type errors, which is the cheap way
  to find them.

### 3.7 Not done, deliberately
`bolder` / `quieter` are direct opposites; `init` / `document` write context
files rather than touch UI; `overdrive` / `delight` / `colorize` / `animate`
were skipped because this is an **Operate** surface where expression yields to
scanability. If someone wants those, it is a product decision, not a gap.

---

## 4. Traps that cost real time — do not rediscover these

1. **`flex: 1 1 auto` on the timeline collapses the map.** See F1. Basis must be `0%`.
2. **Leaflet drops `alt` on divIcons.** `L.Marker._initIcon` only assigns `alt`
   when the element is an `<img>`. For a `divIcon` it is silently discarded — so
   passing `alt` *looks* right and does nothing. Use the `named()` helper in
   `flight-map.tsx`, which writes `aria-label` on the `add` event.
3. **framer-motion injects `tabindex="0"`** onto anything with
   `whileHover`/`whileTap`. That made 9 rail icons their own tab stops, so every
   nav item was hit twice. Fixed with `aria-hidden` + `tabIndex={-1}`.
4. **Leaflet's own controls are z800/z1000**, above the app's overlay tier. This
   is why docking the panels (F2) was the right fix rather than raising z-indexes.
5. **`ScrollTrigger.sort()` before `refresh()`** on the landing, or every trigger
   below the pinned scenes is measured against a document missing ~4,900px of
   pin-spacer. Full note in `LANDING_HANDOFF.md`.
6. **The impeccable detector matches inside comments.** Writing `<img>` in a
   code comment produced a `broken-image` finding. Reword rather than suppress.
7. **`--scope layout` on the detector only runs static rules.** Five of the 13
   layout rules are DOM rules that need a URL target; a clean static scan is not
   evidence of clean layout.
8. **Playwright MCP resolves relative screenshot paths to `C:\Users\user\`**, not
   the repo. Pass absolute paths or expect to hunt for the file.

---

## 5. Reference

| Artifact | Path | What it is |
|---|---|---|
| Design system | `DESIGN.md` | Locked. Read before any UI edit. Its bans (no status dots, cancelled is never a hue, no enrichment in app pages, one caps style) are all currently violated somewhere — see §3.6. |
| Landing handoff | `LANDING_HANDOFF.md` | Scene set, plus scroll/GSAP traps. Updated this session. |
| Critique snapshot | `.impeccable/critique/2026-08-04T03-35-26Z__apps-web-app-simulator-page-tsx.md` | Full Nielsen scoring (19/40), P0/P1 list, persona red flags. Most P0/P1s are now fixed; use it as the before-state record. |
| Contrast gate | `apps/web/scripts/check-contrast.mjs` | Run after touching any `--ae-*` colour. Exits non-zero on failure. |

**Measured deltas from this session**, for anyone checking whether a change regressed:

| Metric | Before | Now |
|---|---|---|
| Gantt rows visible @1440 | 1.96 | 10 |
| Map covered by panels @1280 | 62.4% | 0% |
| Panel-on-panel overlap @200% zoom | 128px | 0 |
| Ops surface below fold | 552px | 0 |
| WCAG text failures | 14 | 0 |
| Sub-24px hit targets | 16 | 0 |
| Console errors | 1 | 0 |
| Map overlay collisions | 3 | 0 |
