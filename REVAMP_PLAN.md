# Aeolus — Revamp Plan
*Top-3 features + UI overhaul (Airtable editorial system)*

---

## Part 1 — The Three Features

### Feature 1 — Carbon-Aware Recovery *(user-mandated)*

**Why this matters.** With CORSIA in effect and EU ETS pricing carbon at $80–100/ton, fuel burn from aircraft repositioning is no longer just an environmental footnote — it's a P&L line. No legacy recovery system surfaces it. Adding it gives Aeolus a fourth optimizer objective that's both novel and *financially defensible*.

**What we ship:**
- New `apps/api/src/costs/carbon.py` module:
  - `co2_for_flight(aircraft_type, distance_nm)` — uses ICAO emissions factors (~3.16 kg CO₂ per kg jet-A, with type-specific fuel burn rates: B737-800 ≈ 2,500 kg/hr, A320 ≈ 2,430 kg/hr, E175 ≈ 1,400 kg/hr, B757-200 ≈ 3,500 kg/hr).
  - `co2_for_ferry(aircraft_type, origin, dest)` — empty-leg repositioning emissions (the biggest carbon hit in recovery).
  - `co2_for_delay(aircraft_type, delay_min)` — APU + extended taxi (rule of thumb: ~150 kg CO₂ per delay-hour for narrow-body).
  - `monetize_carbon(tons, price_usd_per_ton=85)` — EU ETS midpoint.
- MILP objective gets a 4th term `epsilon × total_co2_tons`; new `PLAN_WEIGHTS` entry **`Plan D — Green Recovery`** (`α=4, β=4, γ=4, δ=2, ε=12`).
- Cost calculator returns `co2_tons` and `co2_cost_usd` alongside delay/cancel costs.
- UI surfaces carbon as a first-class metric in every plan card.

**Effort:** ~1 day. All constants are public, the math is linear, slots cleanly into existing cost rollup.

---

### Feature 2 — Counterfactual "Why This Plan?" Explainer

**Why this matters.** Section 6 of `AEOLUS_PITCH.md` named transparency as the moat. The optimizer currently outputs plans; it doesn't explain *why* each decision was made. A "Why this plan?" panel that re-runs the MILP with one decision flipped and reports the cost delta turns the system from black-box solver → glass-box advisor. **This is the killer feature for the plan-detail drill-down page** the user asked for.

**What we ship:**
- New endpoint `POST /api/v1/recovery/explain`:
  - Input: `plan_id`, `flight_id`, `flipped_action` (e.g., "don't cancel UA1234").
  - Process: clone plan, flip the decision, re-run cost calculator, return delta breakdown.
- Backend module `apps/api/src/optimizer/explain.py`:
  - For each of the top N decisions in a plan, computes counterfactual cost.
  - Returns plain-English rationale: *"Cancelling UA1234 saved $42K — keeping it would have triggered a FAR 117 violation that grounded a second aircraft."*
- New page `/simulator/plans/[planId]` (drill-down, see Part 2).
- LLM-free generation: rationale strings are templated from the cost delta + violation flags. No external API needed.

**Effort:** ~1.5 days. Reuses existing cost engine; no new optimization.

---

### Feature 3 — Network Vulnerability Heatmap (Monte Carlo Stress Test)

**Why this matters.** This is the *"airlines literally do not have this productized"* feature. Run 1,000 randomized disruptions against the schedule; produce a heatmap of which **rotations**, **airports**, and **crew bases** cascade the worst. Schedule planners would pay real money for this — it's chaos engineering applied to airline ops.

**What we ship:**
- New endpoint `POST /api/v1/network/stress-test`:
  - Input: `n_simulations` (default 1000), `event_type_mix`, `severity_distribution`.
  - Process: Monte Carlo loop calling cascade predictor with randomized events; aggregates downstream impact per flight/airport/aircraft.
- Background job via existing Celery setup; WebSocket progress updates (`stress_test_progress` events).
- New page `/simulator/stress-test`:
  - Top: airport heatmap on the existing Leaflet map (color intensity by total cascade-minutes-caused).
  - Middle: ranked table of "most fragile rotations" (which aircraft tails cause the most cascades when disrupted).
  - Bottom: histogram of network-wide cost outcomes across the 1,000 sims (P50, P95, P99 of recovery cost).

**Effort:** ~2 days. Predictor already deterministic + seeded → trivially batchable.

---

## Part 2 — New Route Structure

Today: one mega-route `/simulator` containing everything.

**Proposed:**

| Route | Purpose | What it solves |
|---|---|---|
| `/simulator` | **Command center** — map + event trigger + plan summaries only | Drastically less scroll; matches an actual OCC view |
| `/simulator/plans/[planId]` | **Plan detail & counterfactual** — full breakdown, cost decomposition, "Why this?" panel | User's "click plan → opens another screen" ask |
| `/simulator/plans/compare` | **Side-by-side A vs B vs C vs D** comparison | Moves `PlanCompare` off the main dashboard |
| `/simulator/cascade` | **Cascade timeline & flight drill-down** — full chain visualization | User's "endpoint to view cascade delays" ask |
| `/simulator/cascade/[flightId]` | **Single flight's cascade chain** — upstream cause + downstream impact tree | Operations needs this for press conferences |
| `/simulator/crew` | **Crew legality & FAR 117 violations** | Moves `CrewOverbooking` off the main dashboard |
| `/simulator/passengers` | **Passenger re-accommodation queue** | Moves `PassengerSolutions` off the main dashboard |
| `/simulator/stress-test` | **Network vulnerability heatmap** *(Feature 3)* | Brand-new capability |
| `/simulator/carbon` | **Carbon impact dashboard** *(Feature 1)* | Brand-new capability |

**Implementation note.** Next.js 15 App Router → each is a folder with `page.tsx`. Shared `layout.tsx` for the sub-routes carries the secondary nav. Zustand store survives navigation, so state already persists across routes.

---

## Part 3 — Design System Migration: Teal → Airtable Editorial

### The strategic choice

The user's spec is Airtable's editorial system: **white canvas, near-black ink, signature surface cards for voltage**. Aeolus today is teal-dominant — primary color used everywhere as buttons, accents, gradients. That's the AI-generated tell.

**Recommendation:** Adopt the Airtable system *literally* — near-black `#181d26` as the primary, white canvas as the floor — and **reassign teal `#0D9488` to the `signature-forest` slot** (replacing forest green). Teal becomes a brand voltage moment, not the wallpaper.

This preserves Aeolus's identity (teal still appears) while gaining editorial discipline.

### Token mapping

Add `apps/web/lib/design-tokens.ts`:

```ts
export const tokens = {
  colors: {
    primary:           "#181d26",  // near-black ink (was teal-600)
    primaryActive:     "#0d1218",
    canvas:            "#ffffff",
    surfaceSoft:       "#f8fafc",
    surfaceStrong:     "#e0e2e6",
    surfaceDark:       "#181d26",
    hairline:          "#dddddd",
    ink:               "#181d26",
    body:              "#333840",
    muted:             "#41454d",
    onPrimary:         "#ffffff",
    // Signature surfaces (brand voltage)
    signatureTeal:     "#0D9488",  // Aeolus brand color, repurposed
    signatureCoral:    "#aa2d00",  // disruption / cancelled
    signatureForest:   "#0a2e0e",  // on-time / nominal
    signatureCream:    "#f5e9d4",  // info callouts
    signaturePeach:    "#fcab79",  // delayed
    signatureMint:     "#a8d8c4",  // recovered
    // Semantic
    link:              "#1b61c9",
    info:              "#254fad",
    success:           "#006400",
  },
  radius: { xs: 2, sm: 6, md: 10, lg: 12, pill: 9999 },
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, section: 96 },
  fontFamily: {
    display: '"Haas Grot Disp", "Inter Display", -apple-system, BlinkMacSystemFont, sans-serif',
    body:    '"Haas Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    mono:    '"JetBrains Mono", monospace',
  },
}
```

Update `apps/web/app/globals.css` to load Inter Display from Google Fonts (open-source Haas substitute).

### Replace these patterns globally

| Today | Replace with |
|---|---|
| Teal gradient hero (`#020D0B → #042F2E → #0D9488`) | White canvas, 96px vertical padding, no gradient |
| Teal `#0D9488` buttons everywhere | `button-primary`: near-black `#181d26`, 12px radius, one per viewport |
| Teal nav strip with white text | White nav strip with `#181d26` text + hairline bottom border |
| All cards: white + `#DDDDDD` border + 12px radius | Tiered: signature cards use brand colors (full-bleed 48px padding), content cards use white + hairline (24-32px padding) |
| All headings same weight | Display 400, sub-titles 500, body 400 — *never* 700 |
| Status colors ad-hoc (`#10B981` / `#F59E0B` / `#EF4444` scattered) | Single semantic system: on-time=`signatureForest`, delayed=`signaturePeach`, cancelled=`signatureCoral` |

---

## Part 4 — Fixing the Four Specific Complaints

### Complaint 1: *"Left rail is a wall of identical pill-shaped event tiles — reads like a settings menu"*

**Fix:** Replace pill list with **3 mode tabs** at the top (Quick Trigger / Scenarios / Live Feed) + a **single contextual form** below.
- "Quick Trigger" mode shows the 10 event types as an icon **grid** (3×4), each tile uses the signature color matching its severity domain (weather → coral, mechanical → near-black, crew → forest, etc.). When clicked, the form below morphs to that event's parameters. *One screen, no scrolling through 10 identical pills.*
- "Scenarios" mode shows pre-built named scenarios as cream-callout cards (`signatureCream`).
- "Live Feed" mode shows real FAA NAS ground stops + NWS alerts as actionable rows (uses the `/live/faa-status` endpoint already in the codebase).

### Complaint 2: *"Empty state is a giant decorative sparkle — marketing-page energy"*

**Fix:** Replace with a **cream-callout band** (`signatureCream` background, `signatureForest` ink) that contains: a 14px label `"AWAITING DISRUPTION"`, a 32px headline `"All 200 flights operating nominally."`, three live operational stats (on-time count, fuel burn rate, on-time arrival %), and a single hairline `button-secondary` *"Run stress test"* CTA linking to the new `/simulator/stress-test` page. **Functional, not decorative.**

### Complaint 3: *"Color is doing nothing — green badge / orange toast / map legends don't share a system"*

**Fix:** Define a **single semantic palette** (in `design-tokens.ts`) used everywhere:
- `status.onTime` → `signatureForest` `#0a2e0e` on light forest tint background
- `status.delayed` → `signaturePeach` `#fcab79` on cream tint background
- `status.cancelled` → `signatureCoral` `#aa2d00` on light coral tint background
- `status.recovered` → `signatureMint` `#a8d8c4` background with forest ink
- `cascade.direct / order1 / order2` → coral / peach / yellow gradient (severity = warmth)

Apply to: flight markers on map, cascade timeline bars, status badges, table rows, plan-card cost highlights. **Same color = same meaning everywhere.**

### Complaint 4: *"One font, one weight, evenly sized — no information hierarchy"*

**Fix:** Adopt the Airtable type stack from the spec:
- Display (h1 hero, plan-detail page titles): Inter Display 40px / 400
- Display-md (section heads on main dashboard): 32px / 400
- Title-lg (card titles): 24px / 400, +0.12px tracking
- Title-md (sub-section titles): 20px / 400
- Title-sm (small card titles): 18px / 500
- Label-md (badge labels, list items): 16px / 500
- Body-md (running text): 14px / 400
- Caption (meta, footnotes): 14px / 500, +0.16px tracking, `muted` color
- Mono (delay times, costs): JetBrains Mono 12-14px / 600 tabular

Emphasis comes from **size and color**, never from weight ≥ 600 (except legal/system surfaces).

---

## Part 5 — New Main Dashboard Layout

Current main dashboard scrolls forever. Proposed shorter version:

```
┌────────────────────────────────────────────────────────────────────┐
│ TOP NAV — Aeolus wordmark · Simulator · Plans · Cascade · Stress  │
│ Test · Crew · Passengers · Carbon  ·························· ⚡    │
├──────────────┬─────────────────────────────────┬───────────────────┤
│              │                                 │                   │
│  EVENT       │  FLIGHT MAP                     │  RECOVERY PLANS   │
│  CONTROLS    │  (Leaflet, full canvas)         │  (4 plan cards    │
│              │                                 │   A/B/C/D summary │
│  ▪ Mode tabs │  Floating: search overlay       │   each clickable  │
│  ▪ 3×4 grid  │  Floating: focus-mode pill      │   → opens detail  │
│  ▪ Form      │  Cascade legend bottom-right    │   page)           │
│              │                                 │                   │
│              ├─────────────────────────────────┤   "View all       │
│              │ CASCADE STRIP (compact, 96px)   │    plans →"       │
│              │ Click row → /simulator/cascade  │   secondary CTA   │
└──────────────┴─────────────────────────────────┴───────────────────┘
```

Everything else (MyFlights, PlanCompare, CrewOverbooking, PassengerSolutions) **moves off this page** to dedicated routes. **Main dashboard fits in one viewport at 1440×900. No scroll required for the core demo.**

Below the workspace: a **cream-band CTA strip** (`signatureCream`) — *"Want to see how the schedule holds up under 1,000 disruptions? → Run stress test"*. That's it. No more analysis panels stacked vertically.

---

## Part 6 — Execution Order

**Slice 1 — Design foundation (small, fast).**
- Add `design-tokens.ts`, update `globals.css` (Inter Display), add Airtable button components (`<ButtonPrimary>`, `<ButtonSecondary>`, `<SignatureCard>`, `<CreamCallout>`).
- Rewrite top nav to white canvas + near-black ink + hairline border.
- *Outcome: every existing page already looks 40% less AI-generated.*

**Slice 2 — Carbon feature (Feature 1).**
- `costs/carbon.py` + integrate into rollup.
- Add `co2_tons` to `RecoveryPlan` schema.
- Add Plan D to optimizer.
- New `/simulator/carbon` page.

**Slice 3 — Restructure main dashboard.**
- Move below-fold components out to dedicated routes (`/plans/compare`, `/crew`, `/passengers`).
- Redesign event panel to mode-tabs + 3×4 icon grid.
- Redesign empty state to cream-callout.
- Apply semantic status palette across map + cascade timeline.

**Slice 4 — Plan detail page (Feature 2).**
- `/simulator/plans/[planId]` with cost-breakdown waterfall + counterfactual panel.
- `POST /api/v1/recovery/explain` endpoint.

**Slice 5 — Cascade drill-down page.**
- `/simulator/cascade` overview + `/simulator/cascade/[flightId]` for individual chain.

**Slice 6 — Stress-test (Feature 3).**
- Monte Carlo backend + heatmap UI.

---

## Decisions I Need From You

1. **Teal repositioning:** Confirm — repurpose teal as one of the signature card colors (replacing `signatureForest`), and adopt near-black `#181d26` as the new primary? Or keep teal as primary and only borrow Airtable's *layout/typography* rules?
2. **Execution order:** Start with Slice 1 (design foundation) for maximum visual lift fast? Or start with Slice 3 (restructure) so the new pages have somewhere to point to before they're styled?
3. **Plan D weighting:** Comfortable with `Plan D — Green Recovery` at `ε=12` (heaviest weight on carbon), or want it tuned differently?
4. **Stress-test scope:** Is 1,000 Monte Carlo runs the right default, or should I expose it as a slider (100 / 1,000 / 10,000)?

---

## Execution Log

### Slice 1 — Design foundation ✅
- `apps/web/lib/design-tokens.ts` defines the canonical palette (status, cascade, signature surfaces) with `c / r / sp / ty / ff / sh` aliases plus `type()` and `statusTokens()` helpers.
- `apps/web/components/ds/primitives.tsx` provides `ButtonPrimary`, `ButtonSecondary`, `ButtonIconCircular`, `SignatureCard`, `CreamCallout`, `ContentCard`, `DemoGridCard`, `Container`, `Section`, `Type`, `Eyebrow`, `StatusBadge`, `Hairline`, `Stat`.
- `globals.css` + Tailwind config wired to the new tokens; layout/nav switched to white canvas + near-black ink + hairline.

### Slice 2 — Apply tokens across simulator dashboard ✅
All simulator components migrated to design tokens + primitives. **No teal `#0D9488` remaining anywhere in `apps/web/components/simulator/` or `apps/web/app/simulator/page.tsx`.** Files touched:

| File | What changed |
|---|---|
| `app/simulator/page.tsx` | Loading state, focus toggle, `FocusOverlay`, section dividers → tokens + `Eyebrow` + `Hairline`. |
| `components/simulator/event-panel.tsx` | **Complaints 1 + 3 fix.** Replaced 16-hue `COLOR_CLASSES` rainbow with 5 `EVENT_TONES` (mint / coral / mustard / peach / forest-on-cream) keyed to category. Selected tile inverts to dark ink (Airtable editorial). All teal Sim buttons → near-black primary CTA. |
| `components/simulator/recovery-plans.tsx` | `PLAN_META` colors → signature surfaces; `SolverStatus` pill uses status palette; empty state → `CreamCallout`. |
| `components/simulator/cascade-timeline.tsx` | `getBarColor` mapped to `cascadeDirect / Order1 / Order2` + `statusOnTime`. |
| `components/simulator/my-flights.tsx` | `getStatusMeta` returns `c.status*` palettes; empty state → `CreamCallout`. |
| `components/simulator/plan-compare.tsx` | `PLAN_META`, `CompareCell`, `VerdictColumn` use signature + status tokens. |
| `components/simulator/airport-code.tsx` | Popover styled from `c.surfaceDark` / `c.onPrimary` / `ff.mono`. |
| `components/simulator/flight-search.tsx` | Inputs, dropdowns, live/scheduled accents, status dots → tokens. |
| `components/simulator/flight-map.tsx` | New token-driven `MAP_COLORS` const drives `cascColor`, `selArcColor`, `liveIcon`, `airportIcon`, event-epicenter circles, live trails. Same semantic palette as cascade-timeline + recovery-plans. |
| `components/simulator/crew-overbooking.tsx` | Solver pill, coverage meter, stat cells, compensation cards, assignment cards → status palette. Empty state → `CreamCallout` (Complaint 2 pattern). |
| `components/simulator/passenger-solutions.tsx` | Delay tab, hotels tab, rebooking tab, compensation strategy table → tokens + primitives. Empty/loading states → `CreamCallout`. |

Net result: the simulator dashboard now reads as one coherent semantic palette (`status*` for ops state, `cascade*` for severity, signature surfaces for brand voltage) with five event-category tones replacing the 21-color event rainbow. No file kept inline teal hex.

### Slice 3 — Restructure routes ✅
Below-fold panels lifted out of the main `/simulator` page into dedicated routes. Main dashboard now ends with a deep-link strip into the analysis surfaces; everything else lives behind its own URL.

| New route | Purpose | Components |
|---|---|---|
| `/simulator/plans` | Full grid of 4 plan cards with carbon row | `app/simulator/plans/page.tsx` |
| `/simulator/plans/[planId]` | Plan detail + counterfactual explainer | `app/simulator/plans/[planId]/page.tsx` |
| `/simulator/plans/compare` | Side-by-side comparison | `app/simulator/plans/compare/page.tsx` |
| `/simulator/cascade` | Filterable cascade timeline + ranked table | `app/simulator/cascade/page.tsx` |
| `/simulator/cascade/[flightId]` | Single-flight rotation lineage drill-down | `app/simulator/cascade/[flightId]/page.tsx` |
| `/simulator/crew` | FAR 117 + crew-overbooking MILP analysis | `app/simulator/crew/page.tsx` |
| `/simulator/passengers` | Rebooking · hotel · DOT 261 vouchers | `app/simulator/passengers/page.tsx` |
| `/simulator/carbon` | Net CO₂ ledger and EU-ETS pricing dashboard | `app/simulator/carbon/page.tsx` |
| `/simulator/stress-test` | Monte Carlo network vulnerability heatmap | `app/simulator/stress-test/page.tsx` |

Shared shell `components/simulator/page-shell.tsx` carries the sticky `SimulatorNav`, breadcrumb / title / actions row, and the `NoActiveDisruptionState` cream-callout used by every route's empty state. Main `app/simulator/page.tsx` now keeps only `MyFlights` plus a `DeepLinkStrip` of five signature-surface tiles linking to each new route. `recovery-plans.tsx` right-rail card got a small `Open plan detail →` deep-link plus a Carbon mini-row showing tCO₂e on every plan.

### Slice 4 — Carbon-Aware Recovery (Feature 1) ✅
- `apps/api/src/costs/carbon.py` — ICAO-grounded carbon math: per-category block-hour fuel burn (regional / narrowbody / widebody / cargo), APU burn rates, 3.16 kg CO₂/kg Jet-A factor, EU ETS pricing at $95/tonne. Functions: `carbon_for_delay`, `carbon_for_cancellation`, `carbon_for_ferry`, `portfolio_carbon`. Cancellations book a *negative* ledger (saved fuel); delays + ferries are positive.
- `apps/api/src/optimizer/milp.py` — added `Plan D — Green Recovery` to `PLAN_WEIGHTS`. CP-SAT objective for D minimises EU-ETS-priced net CO₂ with a soft passenger-impact dampener so it doesn't degenerate into "cancel everything". Heuristic fallback (`_decide_cancel`) handles plan_id "D" using the same carbon module. Every plan now carries `total_co2_kg`, `eu_ets_cost_usd`, and a `carbon_breakdown` dict regardless of objective.
- `apps/api/src/routes/recovery.py` — JSON response now includes the carbon fields on every plan.
- `apps/web/stores/simulation.ts` — `RecoveryPlan` interface extended with the carbon ledger.
- `apps/web/app/simulator/carbon/page.tsx` — full dashboard: greenest-plan summary band, ranked carbon-plan cards with burned-vs-saved bars, methodology callout. Plan D card highlighted as "Greenest" when applicable.

### Slice 5 — Counterfactual "Why this plan?" Explainer (Feature 2) ✅
- `apps/api/src/optimizer/explain.py` — `explain_plan(plan, flights, aircraft, predictions, event_kind, top_n)` re-evaluates each high-impact decision with a single flip ("cancel→keep" or "keep→cancel"), returning per-flight Δcost / Δpax-min / ΔCO₂ / ΔEU-ETS. Sorted by absolute cost-delta. Includes templated rationale builder so the UI gets a plain-English paragraph with no LLM call.
- `apps/api/src/routes/recovery.py` — `POST /api/v1/recovery/explain` endpoint with `ExplainRequest` (plan_id, top_n).
- `apps/web/app/simulator/plans/[planId]/page.tsx` — "Why this plan?" cream-callout with the rationale paragraph + counterfactual table showing TrendingDown/TrendingUp deltas in cost, pax-min, and CO₂ for each flip. Re-run button to recompute on demand.

### Slice 6 — Network Vulnerability Stress Test (Feature 3) ✅
- `apps/api/src/network/stress_test.py` — Monte Carlo sweep across 12 default Nimbus hubs × randomised event kinds (weather closure, ground stop, thunderstorm, ATC staffing) × triangular severity distribution. Reuses the cascade predictor on `app.state` so each scenario is sub-50ms; whole sweep finishes in well under one request. Composite vulnerability score = pax-delay-min + 4h-equivalent × cancellations. Returns ranked airports + heatmap matrix (airport × event_kind → max score).
- `apps/api/src/routes/network.py` — `POST /api/v1/network/stress-test` with `StressTestRequest` (airports, event_kinds, iterations_per_airport, seed). Synchronous in-memory; no Celery dependency added.
- `apps/web/app/simulator/stress-test/page.tsx` — full page: cream "Run stress test" empty state, Monte Carlo runner button, summary band (scenarios / schedule / fleet / worst hub), coral-intensity heatmap (12 airports × 4 event kinds), ranked airport table with avg/p95 columns.

### Landing-page revamp ✅
`apps/web/app/page.tsx` rewritten on the Airtable editorial palette. Replaced the all-teal hero gradient with white canvas + near-black ink, `SignatureCard` mid-page bands (forest + dark variants), `CreamCallout` highlights, and `ContentCard` feature tiles using semantic tones (mint / coral / mustard / peach / forest / cream) keyed to the six system pillars. Stats row drops the four "ad-hoc brand colors" for tokens (`signatureCoral`, `signatureMustard`, `link`, `statusOnTime.ink`). New "Carbon, counterfactuals, and chaos engineering" promo band markets Slices 4-6. Footer keeps teal `#0D9488` only on the small wordmark badge — teal preserved as a *secondary* brand voltage, never as wallpaper, exactly as requested.
