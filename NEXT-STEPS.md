# Olus — parked work

Written 2026-08-16, at the end of the UI/UX revamp on `feat/ui-revamp`.
Ordered by impact. Each item says what the defect IS, what was measured, and
what the fix would involve — so picking one up does not mean re-deriving it.

Re-measure anything here before acting on it:

```bash
cd apps/web
npm run dev                                   # localhost:3000
node scripts/ui-audit.mjs shots               # both routes, desktop + mobile
node scripts/check-contrast.mjs               # token gate, both registers
ONLY=simulator node scripts/ui-audit.mjs shots  # narrow the run
node scripts/shot.mjs http://localhost:3000/simulator 390 844 out.png 13000 close
```

Current audit baseline (all four route/viewport combinations):
**0 contrast failures · 0 collisions on mobile, 4 on desktop (all Leaflet
attribution) · 0 horizontal overflow · console clean of errors and warnings.**
Both contrast gates pass, in both themes.

## Done since this file was written (2026-08-16, second pass)

Closed by the `/impeccable critique` round — kept here so nobody re-opens them:

- **P0** "Confirm commit" was white on gold at **1.44:1** — an unreadable label
  on the confirmation step of an irreversible dispatch. Root cause was
  `--ae-on-primary: #FFFFFF` in a register whose own note says light pigments
  take ink; every call site that correctly used the token got white anyway.
- **P0** Every Recovery card was `c.canvas` on a `c.canvas` panel (**1.00:1**).
  New `--ae-raised` rung + the `--ae-edge` highlight that was declared and
  unused. Gated.
- **P1** The matrix rendered its winner **darker than the losers** (1.24:1), and
  `Math.min` crowned Plan D "best" on Pax·min *because* D cancels all 39
  flights. Pax·min / tCO₂e / Cancels are now reported, not ranked.
- **P1** `Unapply` was painted under the projection switch, unreachable.
- **P2** The globe was never re-inked in the register split — cream sphere in a
  near-black console, 39 of 39 flights present in the DOM and none legible.
- Dead controls (bookmark, "More"), missing theme switch, recovery plans not
  surfacing after a solve, banned status dots, keyboard access for the matrix
  and the delay rows, full light-mode map parity.

**P5 below is now the only original item still open**; P1–P4 were replaced by
the list further down.

---

## P1 — Cabin seat geometry reads as boxes

**What.** The opening cabin is framed and lit correctly now, but the business
pods are `BoxGeometry` primitives with hard 90° edges. At the wide FOV portrait
uses, the seat backs and shells are the largest objects in frame and their
silhouette is the weakest thing in the shot.

**Not a lighting problem.** That was the last hypothesis and it was wrong —
exposure and the shell albedo are already fixed (1.18 → 0.92, `#D8D5CF` →
`#C0BAB0`). What remains is that a cube has no bevel to catch a highlight, so
no amount of lighting will round it.

**Fix.** Bevel the pod shells and seat cushions. `ExtrudeGeometry` with
`bevelEnabled: true` on the existing `roundedRect` profile is the cheap path and
the helper is already in `cabin-opening.tsx`. Budget: the cabin already ships
~40 meshes, so prefer beveling the 6 seats nearest camera rather than all 12.

**Files.** `apps/web/components/landing/cabin-opening.tsx` (`seat()`, ~line 125).

---

## P2 — Cascade timeline empty state is mostly void

**What.** With a nominal network the timeline says "Network nominal — 142 legs,
no cascades" centred in a ~236px dock, and the rest is empty. The copy is
honest (design.md requires that) but the space is not carrying anything.

**Why it matters.** The timeline is a permanent dock. In the steady state — no
disruption running, which is most of the time — the console's second-largest
region shows one sentence.

**Fix, in preference order.** (a) Show the schedule as a quiet Gantt when there
are no cascades, so the region always displays the day's shape and cascades
overlay onto something. (b) Failing that, auto-collapse the dock to its 34px
bar when `cascadeSummary.total_affected === 0` and expand on the first event —
but note design.md's "nothing auto-opens" rule, so the expand needs to be a
notification rather than a jump.

**Files.** `apps/web/components/simulator/cascade-timeline.tsx`,
`apps/web/app/simulator/page.tsx` (the `tlOpen` dock).

---

## P2b — Generated-composition surfaces the critique named

Grouped because they share one cause: the panel's *content* is authored for an
airline OCC, its *surfaces* are not.

- The `Strategy` block is ~360 characters of template prose at 12px in a 364px
  column, with `${count} flight${s}` interpolation. It reads as filler because
  it is structurally filler. `buildNarrative` also has branches for plans A, B
  and C and falls through to a generic string for **D**.
- 26 cancellation chips in one undifferentiated grid; no sort, no filter.
- Sonner toasts render **cream cards in the dark register**, and their copy is
  broken: *"KE214 arrived — Touched down at KE214"* names a flight as an
  airport. They also fire for other carriers' ADS-B arrivals during an active
  disruption, which is noise on top of a wrong string.
- `recovery-plans.tsx` still `export { Sparkles }` — an unused re-export of the
  AI-sparkle icon. `event-panel.tsx` imports 30 lucide glyphs, one per
  disruption type, chosen by dictionary lookup.
- "Solve time 140ms" is a first-class impact tile beside "7 FAR 117 flags".
- `PLAN_META` short labels use `Tmrw` — a text-message abbreviation on a
  flight-dispatch console.

---

## P3 — Remaining desktop collisions, in the map's bottom-right corner

**What.** `ui-audit` reports 4 overlapping pairs at 1440, all involving the
Leaflet attribution (`a "Leaflet"`, `a "CARTO"`) against the layers/key
disclosure and the panel launcher. Overlap fractions 0.35–0.36, so partial.

**Also.** Both attribution links measure 43×11 and 34×11 — under the 24px
WCAG 2.5.8 floor. They are Leaflet's own markup; the fix is padding on
`.leaflet-control-attribution a`, not replacing the control (the attribution is
a licence requirement and must stay legible and clickable).

**Fix.** Give the attribution its own lane. design.md already assigns the map's
corners one owner each — bottom-centre is layers+key, so attribution should
move to bottom-right and the layers disclosure should clear it.

**Files.** `apps/web/app/globals.css` (`.leaflet-control-attribution`,
`.ae-map-legend`), `apps/web/components/simulator/flight-map.tsx`.

---

## ~~P4 — Hydration mismatch warning~~ — CLOSED

Resolved. The cause was the pre-paint theme script stamping
`data-console-theme` on `<html>`, which React correctly reports as a client/
server difference. `<html suppressHydrationWarning>` is the documented pattern
for theme scripts and suppresses exactly one level, so real mismatches inside
the app still surface. Console now reports **zero** errors and warnings.

---

## P5 — Off-canvas rail on phones

**What.** The rail is 52px at ≤880px. That is 13% of a 390px viewport spent on
an unlabelled icon column, permanently.

**Deliberately not done.** Collapsing it to zero needs a hamburger, which trades
a visible 52px for a hidden menu plus a new control — on an ops console, section
nav staying on screen is worth the width. Revisit only if phone use turns out to
be a real usage mode rather than a responsive-correctness requirement.

**Files.** `apps/web/components/simulator/rail.tsx` (`RAIL_PHONE`).

---

## Notes for whoever picks these up

- **`check-contrast.mjs` gates surface SEPARATION, not just text.** Adding a
  token means adding it to the right register block in that file. The reason is
  in its header comment: every text pair passed AA while the console was
  unreadable, because nothing asserted that surfaces differ from each other.
- **`ui-audit.mjs` reports `unmeasurable` separately.** Gradient backgrounds and
  `background-clip: text` cannot be measured from computed style. Those counts
  (11 on the landing) are not failures and not passes — check them by eye.
- **Backticks break two files.** `rail.tsx`'s styled-jsx block and
  `ui-audit.mjs`'s `PROBE` are template literals; a backtick or a bare `>` in a
  comment inside them fails the build. Both cost a debugging cycle already.
- **`inert` must be `inert={true}`, not `inert=""`.** React coerces the empty
  string to false and silently drops it.
- **`.ae-sr-only` is now global** (`globals.css`). It used to exist only inside
  the landing's CSS module, so using it anywhere else produced *visible* text —
  which is how a caption added for screen readers became a contrast defect.
- **The map's icon cache is keyed by `THEME_KEY + "|" + key`.** The factories
  close over a module-level palette and the cache never expires, so any new
  cache key must keep that prefix or a theme switch will serve stale marks for
  the rest of the session.
- **`ui-audit.mjs` separates `marker crowding` from `collisions`.** Map marks
  overlapping each other is density; a control landing on a control is a bug.
  Don't merge the two counts back together.
- **PowerShell `Set-Content` mangles UTF-8 in these files.** It has corrupted
  box-drawing characters in source comments twice. Use the editor, not shell
  rewrites, on anything containing non-ASCII.
