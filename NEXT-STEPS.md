# Aeolus — parked work

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

Current audit baseline (all four combinations): **0 contrast failures,
0 collisions on mobile, 3 on desktop, 0 horizontal overflow.**

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

## P3 — Three desktop collisions, all in the map's bottom-right corner

**What.** `ui-audit` reports 3 overlapping pairs at 1440, all involving the
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

## P4 — Hydration mismatch warning on the console

**What.** `ui-audit` surfaces a React hydration warning on `/simulator`
("A tree hydrated but some attributes of the server rendered HTML didn't match").
It is not currently breaking anything visible.

**Likely cause.** A component branching on `window`/`localStorage` during the
first render rather than in an effect. The rail reads
`localStorage["aeolus-rail-pinned"]` and the page reads several `aeolus-*` keys;
both gate on a `mounted` flag, so the culprit is probably elsewhere — a
`matchMedia` read, or `notification-bell`'s time formatting.

**Fix.** Bisect by commenting out the client-only reads one at a time under a
dev build; the warning names no component, which is why this is P4 rather than
a quick fix.

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
