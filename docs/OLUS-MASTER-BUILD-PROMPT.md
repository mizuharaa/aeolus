# olus — landing page and dispatcher workspace rebuild

## Mandate

Rebuild the existing airline disruption recovery simulator's marketing site and dispatcher dashboard. Rename the product from Aeolus to **olus**. Preserve the MacBook display with its real HTML recovery demo and the expressive oversized wordmark. Replace the cramped, art-led presentation with a modern operational product: immediate product understanding, readable interfaces, clear decisions, and cinematic aviation visuals where they help explain the network.

This is a full redesign in the existing repository, not a new scaffold. Read the actual implementation before editing. Use existing helpers and dependencies. Complete the work in the review stages below. Do not claim that a stage is complete because a placeholder looks finished.

### Precedence and resolved conflicts

1. This revised brief supersedes earlier visual instructions. Product facts come from verified implementation and measured results, not old marketing prose.
2. `olus` is the displayed wordmark; use `Olus` at the beginning of prose when grammar needs it. Rename source identifiers and owned assets coherently. Historical external URLs and persisted data need migration, not blind replacement.
3. “Compact” means economical navigation and clear grouping. Default dashboard density is **Comfortable**, with larger readable type and spacing. It does not mean smaller controls or more panels in one viewport.
4. Keep the MacBook demo as part of the opening hero sequence. Aviation photography establishes context; the working product is the payoff. Do not bury it behind the gallery or globe.
5. Globe direction: **flat dotted map morphs into a dotted 3D sphere**, with atmospheric lighting and actual small plane meshes on routes. This wins over earlier photoreal Earth/Spline texture requests. Texture/detail belongs to the planes, rim light and spatial layers. Reuse Three.js; no Spline runtime is needed merely for a premium appearance.
6. Use all four supplied photographs in suitable compositions. Image 1 is the primary hero still/poster. Images 2–4 are supporting aviation imagery. Missing slots get explicit placeholders during construction. No generated final imagery is authorized.
7. Strict reference fidelity means observed navigation behavior, composition and scroll choreography. Record differences between the current references and this brief. Proposed Olus values are **design targets**, never “recovered” timings.
8. Accessibility, truthful data and an operable dashboard override decorative motion. If a requested effect misses the performance budget, show the measured cost and proposed alternative before dropping it.

## 1. Preflight and review stages

### Stage A — research, before components

Read repository instructions, Git status, product documentation, landing composition, demo, scroll manager, dashboard stores, API schemas and optimizer path. Preserve unrelated edits.

Search Mobbin flows first for Joby Aviation and United Carriers on web. Validate result identity. Use website-section search when flow search returns unrelated apps. Paginate to exhaustion, retain exact-site matches, and save the metadata and captures. Search ranking is not scroll order. Group homepage captures in live DOM order; index subpages separately. Do not claim access to unexposed archived frames.

Inspect https://www.jobyaviation.com/ and https://unitedcarriers.com/ in a browser. Save loading, navigation-open, and 0–100% scroll captures at 10% increments, plus missed journey/news/plane states. Record viewport, actual scroll positions, sticky ancestors, geometry, fonts, colors, media crops and script URLs. Read public bundles as evidence; library name strings alone do not prove plugin use. For each timing distinguish **source-recovered**, **runtime-measured**, **hypothesis**, and **Olus target**. Use “unrecovered” for unknown constants.

Deliver and show:

- `docs/reference-teardown.md`: scroll-ordered storyboard, screenshot IDs, layout/type/spacing/color/crop evidence and `motion_hypothesis`.
- `docs/motion-forensics.md`: `section | trigger | start | end | scrub | pin/sticky | duration | ease | properties | evidence`.
- Reference media manifest with URL, intrinsic dimensions or unavailable status, displayed dimensions, aspect ratios and crop. Reference media is research material, not production imagery.
- This build brief and a factual discrepancy list.

**Stop at this review boundary until the user has reviewed these documents.** This boundary comes from the user's working agreement, not an inferred deployment approval rule.

### Subsequent stages

B. Implement the rebrand and opening: loader → navigation → aviation hero → existing MacBook product demo. Show a desktop and mobile recording, repeat-visit behavior and reduced motion. Iterate on this before proceeding.

C. Build the dotted globe on a separate branch from the accepted opening. Reuse existing scene infrastructure. Demonstrate morph, routes, aircraft, drag, hub selection and fallbacks; integrate after review.

D. Build the remaining landing sections in order, FAQ and 404. Start the dashboard workstream after the globe integrates; independent agent work is allowed for that workstream. Avoid simultaneous ownership of shared tokens/toast/schema files.

E. Verify the complete dispatcher journey, responsive layout, accessibility and performance. Report local implementation, checks, Git changes and deployment as separate statuses. Do not publish or submit external forms as part of reference research.

## 2. Product truth and rebrand

Olus simulates airline disruptions and computes recovery alternatives with OR-Tools CP-SAT and a crew-legality model. The primary audience is OCC duty dispatchers and operations leaders; engineers and operations researchers need provenance and inspectable results.

The checked-out product already has Next.js 15, React 19, FastAPI, GSAP, Lenis, Three.js/R3F, Radix dialogs, Sonner, cmdk, Recharts, Zustand and React Query. It currently uses Tailwind 3. Do not force a Tailwind 4 migration solely to match the old prompt. Use the existing version unless a separately scoped migration has a concrete benefit.

Trace and preserve the synthetic carrier, scenario lifecycle, public-feed degradation states, SQLite persistence and WebSocket updates. Label fictional Nimbus Air and simulated runs. Distinguish synthetic schedule/recovery data from optional live public weather or aircraft-position overlays. Do not say “no live data” if those overlays are enabled.

Verify disruption types from the canonical event catalog. Verify test counts by collection/execution, determinism claims by the configured solver/replay behavior, and benchmark claims from reproducible runs with hardware, network size, parameters, commit and sample count. A wall-clock cutoff, multiple workers or a heuristic fallback can change the guarantee. Do not publish “111 green tests,” “nine sources pinned,” “38 seconds,” or “optimal” without matching evidence.

Distinguish **optimal**, **feasible**, **heuristic**, **infeasible**, **cancelled** and **failed**. Model legality is legality against the implemented rules and inputs; do not imply regulatory certification or exhaustive Part 117 coverage. Preserve explicit warnings when a fallback cannot provide the same evidence.

Engineering reference: [Google's CP-SAT status documentation](https://developers.google.com/optimization/cp/cp_solver) distinguishes a feasible solution from a proven optimum. Preserve that distinction in the UI and published copy.

Rebrand checklist:

- Search tracked source and filenames case-insensitively for the old name. Include wordmarks, metadata, favicon, OG, accessible names, docs, package names/lockfiles, imports, tests, fixtures, Docker service references, environment examples, asset names and storage keys.
- Change canonical identifiers and every caller together. Handle case-only paths safely on Windows.
- Migrate browser preference keys by reading the legacy value once and writing the new key; preserve user choices.
- Existing `aeolus.db` requires a backup-safe SQLite migration including any active WAL state. Do not point to an empty new database and silently lose scenarios. Keep a documented compatibility read/migration where necessary.
- Do not rewrite credentials, third-party identifiers, registered deployment URLs, Git history or vendored dependencies. Inventory external resources that still need a real rename. Legacy names in migrations are expected until migration support can retire.
- Leave one focused runnable migration check proving existing state survives. Scan residual old-name matches and explain each allowed legacy reference.

Voice: precise, calm, useful. Lead with the operating task: “Understand the disruption. Compare the recovery.” The thesis is disorder resolving into a defensible plan. Never invent customers, endorsements, partnerships, testimonials or performance claims.

## 3. Visual system

Marketing: United Carriers' operational structure and dark/white contrast, with Joby's image scale, rounded framing and carefully staged transitions. Dashboard: a readable tool with clear surfaces and immediate actions. No cinematic scroll or decorative perspective in the dashboard.

Retain the supplied token names and values in one canonical token file, exposed from `:root`; consume variables elsewhere:

```css
:root {
  --ink-900:#05070A; --ink-800:#0A0E14; --ink-700:#11161E;
  --ink-600:#1A222D; --ink-500:#27323F;
  --bone-050:#F7F5F1; --bone-100:#ECE8E1; --bone-200:#D8D2C8;
  --text-hi:#F4F2ED; --text-mid:#9AA5B1; --text-lo:#6B7785; --text-inv:#0A0E14;
  --disrupt:#FF7A1A; --disrupt-dim:#C2560F;
  --recover:#2FE3A0; --recover-dim:#17A874;
  --critical:#FF4757; --neutral-arc:#4C82F7;
  --grad-recovery:linear-gradient(135deg,#FF7A1A 0%,#FFB020 38%,#2FE3A0 100%);
  --grad-night:linear-gradient(180deg,#05070A 0%,#0A1420 55%,#12283A 100%);
  --grad-dawn:linear-gradient(180deg,#12283A 0%,#3A4F63 40%,#ECE8E1 100%);
  --grad-atmos:radial-gradient(circle at 50% 55%,rgba(76,130,247,.45),rgba(255,122,26,.18) 55%,transparent 72%);
}
```

Add measured semantic foreground/focus/control-border variants for light and dark surfaces. The original jade, grey and hairline tokens do not automatically pass every contrast pairing. Structural separators can be subtle; essential input boundaries and focus indicators must remain perceivable. Resolve CSS colors once for Three.js/Canvas instead of duplicating hex palettes in scene code.

Amber means disrupted, jade means recovered/verified, red means violation/cancelled, blue means unaffected. Include text, icons or patterns. Keep purely decorative atmosphere and nav gradients on separate named tokens; only display an amber-to-jade status transition when the accompanying scenario changes accordingly.

Typography: licensed PP Neue Montreal/Suisse if available; otherwise Space Grotesk for display, Inter for prose/UI, JetBrains Mono for identifiers, times and metrics. No paid font downloads without a license. Tabular numbers. Preserve the large `olus` typographic treatment.

| Role | Size |
|---|---|
| Marketing display XL | `clamp(3.5rem,9vw,11rem)`, line-height .9, tracking -.03em |
| Display L | `clamp(2.5rem,5.5vw,5.5rem)` |
| H1/H2 section | `clamp(2rem,3.2vw,3.25rem)` / `clamp(1.5rem,2.2vw,2.125rem)` |
| Marketing lead/body | 20px / 1.7 and 17px / 1.65 |
| Dashboard body/cells/labels | 16px / at least 14px / at least 13px |

Allow headline wrapping at 320px; giant type cannot clip essential words. Content max 1440px, prose max 68ch; gutters 24/48/80px with responsive limits. Marketing section spacing is generous but purposeful: use the supplied 6–12rem range without manufacturing blank scroll. Dashboard uses an 8px grid, card padding at least 24px and gaps at least 32px.

Cards 12px radius, media 20px, pill buttons. Static grain at 3–4% on appropriate dark fields. Buttons use a 260ms clip wipe and readable label crossfade. All targets at least 44×44px.

## 4. Shared motion contract

Use the existing GSAP registration entry and single Lenis owner. Register only plugins actually used: ScrollTrigger, Flip, SplitText, optionally MotionPath. SVG dash animation is sufficient for drawn paths; no extra drawing library is needed. Do not run Lenis and ScrollSmoother together. Target Lenis `lerp:.085`, wheel multiplier 1, native touch scrolling; wire updates and ticker once. Dashboard does not mount this scroll manager.

```ts
export const EASE = { out:'power3.out', inOut:'power2.inOut', expo:'expo.out', spring:'elastic.out(1, 0.75)', css:'cubic-bezier(0.22,1,0.36,1)' } as const;
export const DUR = { xs:.18, sm:.32, md:.6, lg:.9, xl:1.4 } as const;
```

Each construction lives in a scoped GSAP context plus `gsap.matchMedia`; revert listeners, animations and scene resources on unmount. Preserve the existing render budget and refresh ordering. Scroll drives spatial composition; the MacBook demo has its own pausable playback clock so it remains understandable when scrolling stops.

Prefer transform, opacity and clip-path. Avoid layout animation of width/height/top/left: gallery cards use fixed geometry with nested scaled media; accordions change layout through native disclosure and animate only interior content. Treat filter/backdrop blur as paint costs to profile, not guaranteed compositor work. Apply will-change temporarily. Auto-refresh after media/fonts settle without invalidating restored scroll.

Reduced motion: ≤200ms loader fade, no pin/scrub/spatial autoplay, static globe and planes, portrait gallery in a vertical stack, visible final content, posters instead of autoplay video. Static meaningful content and primary links render before enhancement; JS/WebGL failure never leaves a blocking loader.

## 5. Landing page, exact content order

### 5.1 Loader and logo-to-nav transition

On every landing-page load/reload (updated user instruction), a near-black full-screen cover draws an original single-path wind/vector mark in roughly .9s, fills by 1.3s, then FLIPs that **same DOM node** into its nav slot by 2.1s. Clip-reveal `olus` beside it. Simultaneously reveal the hero using inset clipping and rounded lower corners. Nav items stagger .05s and headline lines .08s; total target ≤2.4s. Proceed with Image 1 if media is not ready by 1.8s. Do not gate playback with sessionStorage. Always release scroll on completion, skip, error and unmount. Reduced motion starts in the final state. A preloader cover must not delay fetching/rendering the actual hero.

### 5.2 Fixed navigation and reveal panel

Left menu control; centered mark/wordmark; right Docs and primary access/demo action. Transparent over photography; at 80px use ScrollTrigger toggleClass for dark 72% fill, blur 14px and saturation 1.2. Expose Platform, Solver, Scenarios, Benchmarks, Docs, About and a clear path into the product.

The mega-panel emerges behind the bar. Media rectangles expand visually from 4px slivers with scale/clip, .06s stagger, .7s expo.out. Nav gradient fields crossfade over .4s. Hovered media scales to 1.06; siblings desaturate/dim. Close reverses at .85 speed. Support pointer hover and click/touch, keyboard opening, Escape, focus containment and focus return. The mobile sheet fills the screen with 24px item entrances. Mouse travel from trigger to panel must not close it accidentally. Do not apply ARIA application-menu roles to ordinary website links.

### 5.3 Hero and preserved MacBook demo

Use Image 1 as the immediate hero image; later verified licensed airport video may enhance it. Deep navy overlay with preserved photographic detail, full-height rounded-bottom frame. Bottom-centered headline: **“Disruption happens. Recovery is solved.”** Add concise explanatory copy identifying this as a simulated airline recovery tool and visible product/docs actions.

Initial Olus target: over about 1.2 viewport heights, gently scale the media toward .94, grow its radius, lower brightness and reveal a left-rule caption (`scrub:.8`). This is an adaptation; the live Joby hero has a much longer sequence.

**The MacBook is the second beat of the hero, before the gallery.** Reuse `demo/laptop-stage.tsx` and `cinematic-simulator-demo.tsx`: preserve the hinged lid, shared CSS perspective and aligned 16:10 DOM screen. Introduce it from the aviation frame, settle it front-facing, and bring the dispatcher workflow to readable scale. Keep the large `olus` wordmark as a composed background/transition element without obscuring controls. No replacement with a screenshot, generic laptop mockup or rendered video.

Demonstrate one truthful synthetic scenario: disruption → affected flights → alternative plans → explanation → operator decision. Provide pause/replay and open-product controls. On mobile, use a front-facing readable crop or full-width interface presentation within a shallow device frame. Pointer/keyboard interaction inside the demo must not fight page scroll or browser gestures. Mark illustrative state explicitly.

### 5.4 Clarity gallery

Light bone surface, oversized **“Chaos, Solved.”**, five portrait compositions with scene captions: storm radar, OCC screens, wet night stand, crew jetbridge, departure board. Thumbnail → central 3:4 full frame → thumbnail transitions; pinned headline and scrubbed track, initial desktop target ~400vh and scrub 1. Match reference center-distance growth with transforms and reserved geometry. Progress hairline resolves jade only alongside an explicitly recovered scenario. Provide manual card navigation; mobile/reduced motion stacks vertically.

### 5.5 Recovery journey

Left wide 16:9 image with an HTML glass recovery card and route arc; right portrait media and explanatory copy; statement below. Show scenario ID, UTC timestamps and a segmented Detect / Solve / Review-or-Publish duration bar. Source all values from the same example; displayed segments must sum to the displayed elapsed time. The earlier “4min + 38s + 6min” and “under a minute” combination is prohibited. An animated aircraft follows the arc as state resolves amber → jade. Use .12 stagger, y 40→0 and `top 70%` entrance. Do not imply a live airline publishing integration unless it exists.

### 5.6 Solver technology

Full-bleed 21:9 nacelle/wing/radome macro, “The engine behind the plan,” Explore CTA, three rule-separated facts: CP-SAT model; implemented crew-legality checks; reproducible scenario replay where verified. Image parallax up to -12%; text x -24→0. Link the actual model docs.

### 5.7 Evidence and stats

Light surface; small aviation thumbnail; two-tone giant “WE MODEL DISRUPTION. WE RETURN THE PLAN.” Left headline stays readable while right stat blocks pass. Four possible evidence slots: disruption coverage, test count, benchmark latency, determinism audit. Publish only verified values with units and links to methodology; otherwise display qualitative coverage and clearly mark pending measurements in the build sandbox. Count-up/scrub and line draws are presentation only; final metric remains accessible. The current UC reference uses entry-triggered count-up; scrub is an explicit Olus adaptation.

### 5.8 Runway constraints

Three columns: two-tone “RECOVERY AT EVERY CONSTRAINT,” central dark runway on the bone field, and explanatory feature blocks. A top-down plane moves along runway marks as scroll progresses. Synthetic day clock 00:00Z→23:59Z is labeled as a simulated timeline. Legality/violation counts reflect the chosen scenario, never a hardcoded universal zero. Feature subjects: constraint tracking, crew-rule evidence, deterministic replay scope and disruption coverage. Use the actual event catalog and model rules. Dotted-square motifs may decorate labels but cannot replace understandable icons.

### 5.9 Validation with aircraft fly-over

Bone background, title revealed by a blue/grey/ink text-gradient wipe; stacked role-and-quote blocks with hairlines. Only clearly illustrative roles and quotes are permitted absent real customer evidence; put “Illustrative” beside each attribution, not just a distant footnote.

Use a licensed transparent top-down narrowbody with restrained amber/jade livery. Requested Olus path: lower left → upper right over ~180vh, scrub .6, tangent-aligned and gently banked. Offset soft shadow follows at roughly .04 progress lag, 18px blur, .22 opacity. A small masked backdrop-blur overlay may follow beneath the plane if profiling passes. Decorative layers are pointer-events:none and aria-hidden, never cover focus targets. Note: the live UC implementation uses a different 200vh overlap/scale construction; this diagonal flight is an intentional requested adaptation.

### 5.10 Dotted world → 3D network globe

State A is an intentional visible composition, not an indefinite loading gate: 9k–14k land-mask dots in a flat map, labeled hub highlights, edge-aligned region/capability lists and a counter derived from the dataset. Never invent 214 nodes or departure/disruption counts.

Keep **the same sampled point set** across both states. Interpolate equirectangular positions to spherical positions using a shader morph uniform. This preserves correspondence and prevents a point-count pop. Morph target 1.6s power2.inOut; combine with scroll entry scale .82→1. Point budget stays below 28k; the initial 9k–14k may remain the complete globe. Additional detail must fade coherently rather than replace the geometry.

Sphere: custom point shader, circular points, subdued land detail, amber and blue rim directions, additive atmosphere and sparse stars. Distinguish atmospheric lighting from operational route colors. No photo-Earth texture. Globe occupies right ~55% on desktop; labels and content stay inside usable bounds.

Routes: great-circle paths, 6–10 visible concurrently, amber → jade only for example recovery transitions; blue unaffected. Animate path progress and bounded trail length. 8–14 lightweight instanced plane meshes, tangent orientation with globe-relative up vector, no floating-dot substitutes. Reuse the owned model where appropriate; tiny route aircraft use simplified geometry rather than many copies of a heavy GLB.

Scroll speed can add bounded apparent plane speed and a small globe rotation impulse, easing back to baseline when scrolling stops. State the mapping in `motion-spec.md`; clamp spikes and frame delta. It must remain readable and frame-rate independent. Operational flight speed is not inferred from browser wheel velocity.

Drag spin with inertia, damping equivalent to .94 per 60Hz frame (`pow(.94, dt*60)`), polar clamp ±60°. Auto-rotate .06 rad/s, pause during interaction, resume after ~1.5s with a ramp. Separate scroll-controlled parent transform from user-controlled rotation to prevent snap/jitter. Keyboard alternatives rotate/reset/select hubs; touch interaction leaves vertical page scrolling available.

Hub markers/labels: ATL, DFW, ORD, LHR, NRT, SYD, GRU only when present in the demonstration dataset. Hide back-side labels by facing dot product. Hover or focus highlights connected routes and dims unrelated ones to .15. Click/keyboard selection centers a hub with quaternion slerp over 1.2s and opens an accessible simulated summary panel. Preserve focus and selection when pointer leaves the canvas. Use actual supplied counts or mark illustrative values clearly.

Left copy: **EVERY / MINUTE OF THE / DISRUPTION**; lead describes detection, recovery alternatives and legality evidence. CTAs Run a scenario / Read the model. Top ticker uses real dated engineering updates; no fake LIVE BENCHMARKS status.

Dynamic-load near viewport, DPR≤2, prefer high-performance, pause rendering when offscreen or document hidden, dispose resources. One draw call per instanced layer where practical, no React state update per frame. Static poster plus equivalent hub list when low capability, reduced motion or WebGL unavailable. Test frame pacing on named hardware; never assert M1/60fps from an unrelated machine.

### 5.11 Build log

Light three-column grid, left rules, dates, titles, media with deliberately staggered vertical offsets; View all action. Use verified commits/releases as articles. Do not invent warm-start milestones or test additions. Hover media 1.04 and card y -4; title underline draws. Mobile preserves chronological reading order.

### 5.12 Sky interlude

Dawn gradient, flat SVG clouds in 2–3 parallax layers, large **“Wind, Bound.”** and a small scroll-linked aircraft. Three short beats explain disruption → constraints → plan. Describe wind as brand inspiration, not a false etymology claiming “olus” is the Greek god's name. Finish by transitioning into the footer; no empty waiting scroll.

### 5.13 Footer

Full-height dark composition on desktop, content-sized on constrained screens. Top recovery hairline, legal links and three columns: Discover / Explore / Connect. Large `olus` lockup below. Underlined email field and arrow submit; real label, validation and feedback. Use existing lawful contact/newsletter plumbing. If no subscription endpoint exists, provide an honest unavailable/contact state; never issue a success toast for an unsaved address. Links must resolve to real destinations; no dummy `#` links or invented social accounts.

## 6. Notifications, FAQ and 404

### Shared toast system

Extend installed Sonner and existing components before writing a new notification engine. Desktop bottom-right 24px, mobile safe-area top-center; max three displayed, overflow count. Dark panel, 1px boundary, 12px radius, left variant accent, icon/title, optional description/action, accessible dismiss button and progress hairline. Info/success 4s, warning 6s, errors sticky, solving indeterminate. Pause timers on hover/focus and do not lose pending messages. Animate entry y16/scale.97/opacity to rest in .32s, exit x24/opacity in .18s; use existing layout transitions or Flip for stack movement.

Notifications region; routine updates polite, critical warnings/errors assertive with no duplicated announcements. Icons/text duplicate semantic color. Use for real solve lifecycle, validation, copy and subscription results. WebGL fallback notice is informative and nonblocking. Do not double-announce every solver event.

### `/faq`

Dark “Questions, answered.” hero; live question search with safely rendered substring highlights and dynamic result count; six categories Product / Solver & Math / Regulatory / Data & Privacy / Engineering / Access. Sticky desktop rail and horizontal mobile chips. Sticky offset accounts for nav; active category follows reading position.

Question rows have mono index, readable heading and plus→cross .32s toggle, active background and drawn separator. One open by default; expand/collapse all. Deep-linked hashes open and scroll to the answer; back/forward restores state. Search and category filtering compose; no-results has a clear reset.

Use real buttons with aria-expanded/controls and labeled answer regions. Arrow keys, Home/End and Enter/Space work without hijacking text inputs. Render final layout without GSAP height tweens; animate answer content y8/opacity. Focus stays visible. Ambient globe is static under reduced motion.

Write 60–120 word factual answers for at least: product definition, disruption recovery, actual event catalog, CP-SAT choice and feasible/optimal distinction, implemented crew rules and limits, determinism controls, benchmark methodology, required schedule/fleet/roster/maintenance/curfew inputs, simulated data vs live public overlays, tests and golden scenarios, self-hosting, stack, access, privacy/persistence and verified roadmap. Unknowns are stated as unknowns. Include Still stuck/contact and global footer.

### 404

Implement App Router `not-found.tsx` correctly, without swallowing real API/static routes. Dark field; plane on a broken route arc, mono departure-board `404`, “Flight not found.” and concise route guidance. Decorative split-flap resolves after 3–5 characters, .08s stagger; retain static accessible text throughout. Real list links to Home, Platform, Docs and FAQ. Pointer-follow is decorative with damping equivalent to .04 at 60Hz, disabled for touch/reduced motion. Static arc and readable links always work.

## 7. Asset contract

Centralize actual media in `apps/web/lib/media.ts` with type, path, intrinsic dimensions, crop/focal point, alt, poster where applicable, source URL and license status. Track originals and rights in the existing asset register. Use supplied photography now; the low resolution of Images 2–4 limits them to supporting placements until better originals exist.

| Slot | Type/aspect | Use |
|---|---|---|
| HERO_IMAGE / HERO_VIDEO_POSTER | Image 1, 1280×720 | Immediate aviation hero |
| HERO_VIDEO | optional mp4/webm, 16:9 ≥1920px | 8–14s loop, poster required |
| GALLERY_01…05 | image, portrait 3:4 crop | Weather/OCC/night stand/crew/departure board |
| JOURNEY_BG / JOURNEY_SIDE | 16:9 / portrait | Airport aerial + operational context |
| TECH_HERO | image, 21:9 | Aircraft engineering macro |
| PLANE_TOPDOWN | licensed alpha image, about 3:2 | Fly-over and 404 |
| RUNWAY_AIRCRAFT | SVG | Runway progression |
| STATS_THUMB / NEWS_01…03 | 16:10 | Supporting imagery |
| GLOBE_POSTER | image with known dimensions | Static fallback |
| OG_IMAGE | 1200×630 | Olus sharing metadata |

Image 2: passenger/window support. Image 3: airport-approach support. Image 4: small sunset transition. Do not present the passenger as an OCC dispatcher. Do not upscale thumbnails and call them high-resolution assets.

Use next/image, dimensions/sizes and blur placeholders where supported. Eager-load only the actual LCP hero. Videos preload metadata only after near-viewport mounting, are muted/inline/looping with pause where needed; avoid video requests entirely when Save-Data/reduced-data/reduced-motion disables them. Use licensed stills for missing media; otherwise labeled placeholders remain in the sandbox and explicitly block final asset acceptance.

## 8. Dispatcher dashboard

### Information architecture

Reuse existing APIs, stores, primitives and route ownership. Build the target routes while keeping old `/simulator/*` links working via tested redirects or equivalent preserved routes. Do not maintain two independent scenario stores.

```text
/app/overview
/app/scenarios
/app/scenarios/[id]/setup
/app/scenarios/[id]/solve
/app/scenarios/[id]/plan
/app/scenarios/[id]/legality
/app/scenarios/[id]/explain
/app/scenarios/[id]/compare
/app/benchmarks
/app/settings
```

Carry selected scenario, run, dataset version, time zone and solve status through navigation. Retain specialist crew/passenger/carbon/cascade/stress-test/playtest/watchlist functionality in a discoverable secondary area unless its replacement is explicit.

Default body 16px, table cells≥14px, labels≥13px. Comfortable/Default/Compact densities persist locally when there is no user account; do not invent auth. All default rows≥44px; interactive targets remain≥44px in every density. Numbers always have labels/units and a provenance affordance. Summary → detail → raw JSON is available for every operational entity. Design loading, empty, error, partial/stale and success states.

### Required screens

**Overview:** no more than six competing primary groups in the first viewport: network disruption summary, affected banks, accessible network map/list, recent five runs, selected scenario context and prominent Run recovery. Show stale-feed provenance and timestamps. Do not auto-select or apply a plan.

**Scenario library:** search/filter, create, duplicate and select runs for comparison. Preserve scenario identity and actual saved state. Explain empty library and failed loads.

**Setup:** Schedule → Fleet → Crew → Constraints → Disruptions → Review. One step at a time, right-hand explanation and persistent configuration summary. Autosave only if supported and accurately reported. Weather/event placement uses a drag timeline plus an equivalent form/keyboard workflow, previewing affected flights. Validate on both client and API; final review exposes assumptions and UTC/local time context.

**Solve:** elapsed time, actual solver status, objective with unit, observed incumbent count and objective trace, rule/constraint telemetry only if the backend emits it, and a real event log. If telemetry is unavailable, add an explicitly scoped backend event contract; never animate fake progress as a real solve. Show indeterminate progress honestly when completion percentage is unknowable. Cancel must actually stop the worker and transition persisted state safely; aborting a fetch alone is not solver cancellation. Prevent late completion from overwriting a cancelled run. Mirror lifecycle in a solving toast and polite announcement.

**Plan:** readable tails×UTC-time Gantt, horizontal pan/zoom, sticky tail labels, time cursor, baseline/recovered distinction and meaningful reassignment arrows. Use patterns/text in addition to color. Minimum readable row height, visible flight IDs and selected state. Keyboard moves between blocks and opens a focus-managed drawer: flight, tail, crew, duty clock, binding model rules, changes vs baseline and raw result. Table alternative, no unlabeled canvas-only plan. A plan commit remains an explicit deliberate action.

**Legality:** real table of crew×applicable rule with computed value, limit, unit, remaining margin, result and source version. Expand exact inputs/computation, filter by crew/rule/margin. Show unknown/not evaluated distinctly from pass. Explain whether a constraint binds and what the model covers; provide links to the implemented rule and authoritative reference.

**Explain:** derive narrative from actual changes and constraint evidence. Example prose may only name a rest requirement or causal delay when backed by solver/domain evidence; otherwise label association or hypothesis. Show objective contribution waterfall with units and cancellation penalties; avoid claiming fewer passenger-minutes always means a better plan. CP-SAT does not directly furnish LP shadow prices. Rank binding rules by measured margin or validated counterfactual rerun impact, explicitly labeled, not invented dual values. “Relax X” starts a new scenario/run and retains the original; uncertainty and infeasibility remain visible.

**Compare:** baseline/run pair with shared time scale, synced Gantts, list of changes, trade-offs and regressions. Handle differing network horizons/versions and missing comparison data without inventing alignment. Never silently pick a winner across incompatible objectives.

**Benchmarks:** measured distributions and regression history with hardware, scenario size, timeout/workers/seed, commit and sample count. A truthful empty state exists until measurements are available.

**Settings:** density, theme, timezone and motion preferences that reflect real supported behavior; no fake account/integration controls.

### Interaction requirements

Command palette on Ctrl/Cmd+K using installed cmdk; navigation/search/actions fully keyboard reachable. Reuse Radix for drawers/dialogs, focus containment and return. Tables use captions, scoped headers, aria-sort and screen-reader filter summaries. Every chart has caption and table alternative. Persistent errors offer a next action without claiming an unknown cause. No long marketing transitions; use .18/.32s maximum. No surprise auto-opening or automatically committed plans.

## 9. Verification and completion

- Before final acceptance, a new operator can open a scenario, add weather, run recovery, inspect the plan and explain a real delay using its provenance.
- Add focused runnable checks for nontrivial new logic: brand-state migration, scenario validation, safe cancellation races, objective explanation and keyboard plan navigation. Reuse existing test tooling; no new framework for these checks.
- Test 320, 768, 1024, 1440, 1920 and 2560px; both scroll directions, reload in mid-scroll, browser back/forward, repeat visits, keyboard-only, reduced motion, touch, Save-Data and WebGL failure. No horizontal document overflow or inaccessible offscreen controls.
- WCAG 2.2 AA target: measured contrast, one H1, correct landmarks/headings, visible focus, skip link, 44px controls. Run axe; include report scope and manual findings. A clean automated result does not establish full compliance.
- Target LCP<2s, CLS<.02, INP<150ms on a documented mobile/4G profile, initial JS≤180KB gzip excluding deferred globe. Measure font/asset effects and the retained demo; report any missed budget. Lab interaction traces are not field INP. Do not claim field metrics or M1 hardware results without those measurements.
- Record globe frame pacing and resource counts; cap DPR, offscreen work and GPU lifetime. Record first load, menu interaction, hero→MacBook, globe, fly-over and keyboard Plan use.
- Keep `docs/motion-spec.md` current: per effect trigger/start/end/scrub/pin/properties/duration/ease/reduced-motion/cleanup and measurement links.
- Reuse existing folder structure (`components/landing`, `components/simulator`, `components/ds`, `lib`) instead of mechanically moving every file into the old prompt's speculative tree. Add an internal sandbox only where needed to isolate opening/globe tests.
- Acceptance explicitly includes all thirteen landing sections plus preserved MacBook, rebrand/migration, notifications, FAQ, 404, every dashboard route and every panel state. Unavailable assets, telemetry or evidence remain visible blockers, not checked boxes.
- Final handoff: what changed, evidence and checks, remaining gaps, exact branch/commit if any, and deployment status. Keep it concise and honest.
