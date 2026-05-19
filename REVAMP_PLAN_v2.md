# Aeolus — Revamp Plan v2
*Continuing where REVAMP_PLAN.md left off. Four new asks + suggestions.*

---

## Ask 1 — System Capabilities section feels AI-generated

### What's wrong today
Six identical `ContentCard`s in a 3-column grid. Each card has a generic Lucide icon (`CloudLightning`, `Zap`, `Shield`, `BarChart3`, `Leaf`, `Network`) on a pastel chip. The icons are the same size, color saturation, and weight as every other SaaS landing page on the internet. The card heights are uniform. *That's the AI tell.*

### The fix
Per Airtable's `{component.demo-grid-card}` rule: **"Card sizes are deliberately uneven within the grid to dodge a uniform 'spec sheet' feel. Photography-as-depth in the demo-card grid: every card carries a real product UI screenshot or mockup, contributing depth through legible artifact density rather than decorative effects."**

Replace the 6 icon-only cards with **6 hand-built mini-illustrations** that each show an actual product fragment:

| Card | Illustration |
|---|---|
| **Cascade Predictor** | Mini rotation graph: 3 flight nodes connected by arrows, the upstream one tagged red, downstream pair tagged amber. Built in SVG. |
| **CP-SAT Optimizer** | A 2-line "objective function" snippet (`min Σ α·cancel + β·pax_delay + ε·co2`) on a near-black code-tile card. |
| **FAR 117 Crew Engine** | A horizontal duty-time bar — 14h FDP with WOCL ribbon hatched red, current report time as a vertical tick. |
| **Cost Engine** | A small bar-chart fragment showing $cancel vs $delay vs $reposition stacked, real DOT BTS numbers. |
| **Plan D / Carbon** | A leaf glyph PLUS a single line: `+12.4 t · €1,054 ETS` — the ledger, not just a leaf. |
| **Stress Test** | A 6×6 monochrome heatmap fragment (12 cells filled) — recognizable as a hub vulnerability table. |

**Grid:** asymmetric — 2 large (`span-2 col span-1 row`) for the headline capabilities (Cascade + Optimizer), 4 smaller for the rest. No two cards have identical heights.

**Backgrounds:** mostly `c.canvas` with **one** signature surface per row (e.g. cascade card uses `signatureCream`, optimizer uses `surfaceDark`). Stops the "pastel rainbow" effect.

**Icons:** the lucide icon stays as a *secondary* mark in the top-right corner of each card at 14px, not the hero element.

---

## Ask 2 — Financial loss numbers should tick live as time passes

### Why this matters
The cost numbers on the dashboard are static today. In a real OCC, every second of delay accrues real dollars: passenger value-of-time accumulates, crew overtime ticks, gate hold fees compound. A motionless cost number signals "this is a screenshot, not a live system."

### Three approaches considered

| | A — Backend tick loop | B — Pure client estimator | **C — Hybrid (recommended)** |
|---|---|---|---|
| How it works | Backend has a sim-clock advancing every second; re-runs the cost calculator; re-broadcasts | Frontend animates a number upward based on elapsed real time × a hardcoded rate | Backend includes `cost_rate_usd_per_min` + `cost_anchor_at_iso` in the broadcast; frontend interpolates `displayed = anchor + rate × elapsed` on a 1s timer |
| Accuracy | Highest — true simulation | Low — drifts from reality | **High enough** — anchored by every snapshot, interpolates between |
| WS traffic | Heavy — re-broadcasts every second | None | **Same as today** — no extra messages |
| Backend complexity | New tick loop, careful with concurrency | Zero | **Minimal** — add 2 fields to the broadcast payload |
| Visual smoothness | Janky (1-second teleports) | Smooth | **Smooth** (60fps tween) |

### Recommendation: C — Hybrid
1. **Backend** (`apps/api/src/optimizer/milp.py`): cost calculator already produces per-plan totals. Add `cost_rate_usd_per_min`: derived from `delay_total_usd / total_pax_delay_minutes` × pax-count-rate, plus a constant component for crew overtime that's already accruing. Anchor timestamp = the moment the plan was solved.
2. **Frontend** (new hook `useLiveCost(plan)`): `requestAnimationFrame` loop tweens the displayed number from `anchor` toward `anchor + rate × (now − anchorTime)`. Resets cleanly when a new plan arrives.
3. **Surfaces touched:** FocusOverlay total-impact pill, every plan card's `Estimated impact` row, plan detail page header ledger.

The "tick" gives the system aliveness without any backend tick loop or extra WS chatter — the integrator runs entirely on the client.

---

## Ask 3 — Free flight simulator / playtest sandbox

### Scope
New route `/simulator/playtest`. A clean-room sandbox where the user can:

1. **Build flights** — pick origin & destination airport from the existing 15-airport network (or any Nimbus Air destination), choose aircraft type (`B738`, `A320`, `E175`, `B757`), set departure time. Click "Add flight" — appears on the map as a planned route line.
2. **Add multiple flights** — build a mini-network from scratch.
3. **Run simulation** — animated planes traverse the great-circle route at type-appropriate speeds. The simulation respects real flight times (e.g. ORD→LAX ≈ 4h, scaled to ~40 seconds at 360× speed).
4. **Inject disruptions mid-flight** — trigger any of the 10 event kinds; the existing cascade predictor runs on the sandbox flights and shows the impact.
5. **See live cost ticker** — same hybrid mechanism as Ask 2, ticking on the sandbox flights.

### Architecture
- **New Zustand slice** `apps/web/stores/playtest.ts` — separate from canonical simulation state so playtest doesn't pollute the dashboard.
- **New API endpoints** `POST /api/v1/playtest/flights` (CRUD on user-built flights), `POST /api/v1/playtest/disrupt` (run cascade against playtest flights only).
- **Backend reuse** — cascade predictor and cost calculator are stateless; we just call them with a different flight set.
- **No DB persistence** — playtest state is per-session, lives in the user's tab. Reset on refresh.

### What this unlocks
- Airlines can stress-test scenarios that aren't in Nimbus Air's schedule
- Sales demos become much more powerful — "watch what happens if YOUR hub has a thunderstorm"
- Capstone evaluators can play with the system without learning the Nimbus network

---

## Ask 4 — Dashboard color palette looks AI-generated

### Diagnosis
We applied the Airtable system correctly **for editorial surfaces** (landing page, signature cards). But we over-applied it to the **operational dashboard**, where every plan card has a pastel surface, every status badge has a tinted background, and every drill-down page has its own colored hero band. **Real OCC consoles are not pastel.** They're white + hairline + near-black, with color used SPARINGLY as semantic dots/pills.

### The fix — chromatic restraint on dashboard, voltage preserved on landing

| Surface | Today | After |
|---|---|---|
| Plan card body | Pastel surface (cream/peach/mint) | White canvas. Accent only as a 4px left stripe + the small Plan A/B/C/D eyebrow |
| Applied plan card | Pastel surface | Keep the surface — this is the ONE voltage moment per viewport |
| Status badges | Pill with tinted bg + dot | Pill with HAIRLINE outline + dot, transparent background |
| Header bands on drill-down pages | Pastel hero card | White canvas, accent stripe on the left, no surface tint |
| Eyebrows | Colored ink (forest/coral/mustard) | Always `c.muted` for consistency; color reserved for *content*, not labels |

### Shared module
PLAN_META is currently duplicated in **6 files**. Consolidating to `apps/web/lib/plan-meta.ts` and pruning the `surface` field so every card defaults to white. The `surface` color becomes an OPTIONAL field used only when a card is the applied plan.

---

## Execution Order

1. ✅ This plan doc
2. **System Capabilities revamp** (visual impact, isolated to one section)
3. **Dashboard chromatic restraint** (touches 6 files but each change is mechanical)
4. **Live cost ticker** (backend payload extension + new `useLiveCost` hook)
5. **Playtest sandbox** (largest — new route, store slice, animated map overlay, new endpoints)

I'll proceed in this order. Tasks 2–3 are ~2–3 hours each; task 4 ~3 hours; task 5 is a multi-hour build by itself.

---

## Suggestions on the live cost ticker (since you asked)

Beyond "make the number go up," here are three concrete enhancements the ticker enables:

1. **Rate-of-burn indicator.** Display the per-minute rate next to the total: `$23.7K ▲ $267/min`. Operators immediately see the *velocity* of the crisis — useful for deciding when to commit to a recovery plan vs. wait.
2. **Plan-divergence flash.** When you apply a plan, animate the ticker to recalibrate (it slows or stops accumulating, depending on the plan's strategy). Operationally satisfying — you SEE the recovery taking effect.
3. **Cumulative pax-minutes counter.** Same hybrid mechanism on the passenger-delay-minutes total. Watching `1.2K → 1.4K → 1.6K` pax-min tick up makes the cost of indecision visceral.

All three come essentially free once the hybrid ticker hook exists.
