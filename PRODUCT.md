# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the duty dispatcher in an airline operations control centre.** They are
recovering a network that is already breaking — a hub has closed, crews are timing
out, aircraft are out of position — and they are deciding under time pressure with
incomplete information. Their job on this surface is to see what broke, see how far
it will spread, compare the recovery options, and commit one.

**Secondary: people evaluating Olus** — reached through the marketing landing at
`/`, not the console. The landing carries the persuasion; the console does not.
Confirmed 2026-08-17: *"Landing is for visuals, but dashboard … still is a genuine
ops tool for dispatcher."*

Operations researchers and airline strategists also use the secondary
`/simulator/*` routes (stress test, playtest, carbon, crew) to explore model
behaviour rather than to run a recovery.

## Product Purpose

Simulate airline operational disruptions across a full flight network, predict the
cascade before it propagates, optimise recovery plans that satisfy FAR 117
crew-duty law and a cost objective at the same time, and let an operator compare
competing recovery strategies side by side.

Success is that the operator can answer four questions without leaving the console:
what happened, what it will cost, what the alternatives trade against each other,
and which one they are committing to.

## Positioning

- **Four competing objectives, solved simultaneously and reported honestly.**
  Minimize Cost, Minimize Passenger Impact, Protect Tomorrow's Schedule, Green
  Recovery. The console reports Pax·min, tCO₂e and Cancels rather than ranking
  them, because cancelling a flight drives all three down and a naive `min()`
  crowns the most destructive plan "best".
- **Uncertain horizon with regret.** `drone_incursion` has no known end time at
  trigger; it carries a log-normal closure distribution, so plans report an
  expected cost, a cost band, and regret against hindsight.
- **Deterministic and in-memory.** No database, no queue, no auth tier. Every run
  is reproducible, which is what makes the simulation defensible.
- **FAR 117 is a hard constraint inside the solver**, not a warning printed after.

## Operating Context

- Runs on a synthetic carrier, **Nimbus Air**, loaded from YAML at API startup.
- Optionally overlays live public feeds: OpenSky ADS-B positions, NWS weather
  alerts, FAA NAS ground stops and GDPs, METARs. Degrades to synthetic when feeds
  are unavailable — degradation must stay visible, never silent.
- Scenario state persists to SQLite (`apps/api/state/olus.db`) so a restart
  mid-incident does not lose the timeline.
- Real-time updates arrive over `ws://…/ws/simulation`.
- The console is a fixed shell: `100dvh`, `overflow: hidden`, every region
  scrolling internally. It must not be able to scroll away mid-incident.

## Capabilities and Constraints

- **11 disruption event types**, 11 canned scenarios.
- **Cascade prediction** in three generations: direct → 1st order → 2nd order.
- **MILP recovery optimizer** (OR-Tools CP-SAT) with heuristic fallback.
- **FAR 117 duty-time engine** flagging crew-legality violations per plan.
- Passenger impact, rebooking, hotel reaccommodation, compensation policy.
- Crew overbooking analysis; network stress test; interactive cascade playtest.
- Two map projections: flat Leaflet basemap (*where is this airport*) and a globe
  (*what shape does this disruption have*). The flat map is the accessible surface;
  the globe carries a text summary and keyboard camera controls.
- **Terminology is load-bearing and must not be softened:** cascade generation,
  FAR 117, Pax·min, tCO₂e, regret, hub / focus city / spoke, direct hit.
- Airport tiers come from `GET /api/v1/airports` (`hub_type`), never a
  hand-maintained list — the hardcoded duplicate was wrong in both directions.

## Brand Commitments

- Product name **Olus**. Console chrome carries the **plain "Olus" wordmark as
  type only — no logo mark**. The cyclone OlusMark is retired from the console
  and from the browser tab; the favicon becomes a plain letterform.
  *(Decision 2026-08-17, reversing DESIGN.md's "all pages must share the OlusMark".)*
- **Only universally recognised icons.** No bespoke glyph vocabulary; an icon that
  needs a legend is not an icon.
- **Honest copy.** No invented metrics, no fabricated customers or benchmarks.
  Simulated data is labelled as simulated ("Illustrative events · no claim of
  current real-world disruption").
- **Silent success over celebratory toasts.** Toasts carry data, not confetti.

## Evidence on Hand

- Synthetic network: `data/network/` (airports, aircraft, flights, crews YAML).
- 11 scenarios: `data/scenarios/`.
- Live public feeds, no API key required: OpenSky, NWS `api.weather.gov`, FAA
  `nasstatus.faa.gov`.
- Deployed at `https://olus.sh/`.
- **No real airline customer, no testimonial, no benchmark, no case study exists.**
  Future work must not invent one. Nimbus Air is fictional and must never be
  presented as a real carrier.

## Product Principles

1. **The screen must have a figure and a ground.** An audit once reported zero WCAG
   failures on a console that was unreadable, because every text pair passed against
   its own background while all four surfaces sat inside a 4% lightness band.
   Surface separation is asserted, not eyeballed.
2. **Visual weight follows consequence.** Committed and applied states own the
   filled treatment; selecting, inspecting and hovering get outline or tint.
3. **Report, don't rank, when the metrics disagree.** Where a single objective would
   crown a destructive plan, show the trade-off instead of a winner.
4. **Nothing auto-opens and nothing pre-decides.** A panel that opens itself and
   pre-selects an option reads as a decision the operator did not make.
5. **Encoding is never colour alone.** Cascade generation carries its digit; status
   carries text. Redundant channels survive monochrome, glare and colour blindness.
6. **Density is the job; clutter is the enemy.** Confirmed 2026-08-17: the console
   should stay compact and show full essential information, with secondary controls
   reachable in one more click rather than all present at once.

## Accessibility & Inclusion

- **WCAG 2.1 AA is a build blocker**, enforced by `apps/web/scripts/check-contrast.mjs`.
  The gate asserts text contrast, ≥3:1 for non-text marks, ≥3:1 between adjacent
  cascade ramp steps, and **≥1.12:1 between consecutive elevation steps** in both
  registers.
- Confirmed 2026-08-17: translucent (glass) surfaces must pass that gate on their
  **composited** result over the real backdrop, not on their nominal colour.
- Targets ≥24px (WCAG 2.5.8), ≥44px for primary actions.
- The flat map is the accessible projection: every mark is a focusable DOM node
  with a full-sentence name. A canvas-only view of the network is not shippable.
- Reduced motion: app transitions collapse to ≤150ms fades.

## Current rebuild — 2026-09-14

Brand: olus (Olus in prose). The opening is an aviation photograph followed by the live MacBook recovery demo. `docs/OLUS-MASTER-BUILD-PROMPT.md` is the accepted rebuild direction; `docs/opening-handoff.md` separates implemented work from later stages. Marketing examples are illustrative, not customer or benchmark claims. The dispatcher dashboard remains the next major product workstream after the globe.

