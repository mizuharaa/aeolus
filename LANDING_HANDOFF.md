# Aeolus landing handoff

**Last updated:** 2026-07-30 (second pass). The first pass today described a
scene set where the airliner was a hand-built procedural model, the demo was a
520vh scroll-scrubbed pin, and the identity wordmark had its own section. All
three changed — read "Second pass" below before anything else.

---

## Second pass — what changed today

| Symptom reported | Root cause | Fix |
| --- | --- | --- |
| "the plane animation is bugged, the textures are not connected" | The GLB had been replaced by `ProceduralAirliner`, a lathe-and-extrude model whose materials carried **no maps at all** — flat colours only | The shipped `aeolus-airliner.glb` is back (baked base-colour / normal / metallic-roughness / emissive, 29,911 verts). The procedural model is deleted. |
| "too many blank space beige in the landing when flying theres nothing" | The flight pin ran `+=400%` and its last three viewports had nothing in them but the aircraft | Pin is `+=200%`, and the AEOLUS wordmark now reveals **inside** it. Document height 18,567px → 10,899px. |
| "the flying trajectory of the plane must fly down and go through the aeolus text" | — | `IdentityBand` (new) paints the wordmark twice, straddling the aircraft's canvas: back copy at z 1, plane at z 3, front copy clipped to its lower 48% at z 4. `Q_PATH` was re-authored to descend through the band. |
| "when demo plays its suppose not to be a scroll trigger, its a demo video" | The 25s loop AND the lid hinge were both scrubbed by `landingScroll.scenes.demo` inside a 520vh pin | Pin deleted. An IntersectionObserver plays/pauses the timeline on its own clock; it loops; the chapter chips seek it. The lid opens on a wall-clock delay, and the hinge (not scroll) drives the title-card and caption crossfades. |
| "the laptop screen aint even on the frame, cant see anything" | The push-in scaled the composite **1.52×**, driving the lid hundreds of px above the viewport; and the 1280×800 surface was scaled to **0.56**, so 9.5px labels painted at 5.3px | Settle scale capped at 1.06, and the rig's width is derived from the stage height ÷ 1.10 to budget for the base's perspective overhang. The OCC surface renders **1:1** — the `--dm-screen-scale` machinery is gone. |
| "laptop doesnt look like a macbook, make it more roundy curved" | Proportions and radii were wrong; radii were fixed rem values, so the curve flattened as the device grew | Real 13" Air ratios (lid and base both 0.698 W), radii as a share of width via `--dm-r`, anodised side rails, a camera lens instead of a notch bar, a front lip, and a contact shadow. |
| "the globe icons, animation" read as AI slop | Five lucide weather icons on a **five-hue tone scale**, plus a `TRIGGER` chip on every inactive row | One disruption pigment everywhere (`EVENT_PIGMENT`); `kind` now only selects the marker's shape. The feed is an editorial index: mono numeral, name, ICAO, one hairline, one active row. |

Also fixed on the way through: `role="status"` with `aria-live="off"`; three
non-interactive sections carrying `tabIndex={0}`; the plan inspector's committed
metrics overflowing its panel by 115px; the toast being cut in half by that
panel; reduced motion opening on a blank screen; and the caption rail printing
on the laptop's deck (and ellipsising to "Co…" / "Ca…" at 390px).

**Two traps worth keeping:**

- `MaskedWordmark` must not use `useId()`. Two copies now mount in a subtree
  whose SSR and client markup already differ, so the ids diverged and hydration
  tore the entire page down to a blank screen. It hashes an explicit
  `instanceKey` instead. Its ribbon travel is also sampled from the shared
  landing clock, not a per-instance GSAP loop, so the two copies cannot drift.
- The pinned `#flight-intro` **must** keep a plain wrapper `<div>` around it in
  `scroll-experience.tsx`. ScrollTrigger wraps a pinned element in a pin-spacer
  React never rendered; with the section as a bare sibling, the late-mounting
  `next/dynamic` canvases threw `NotFoundError: insertBefore` and killed the
  page. The wrapper must also carry **no** `z-index`, or it traps the identity
  band's two layers in one stacking context and the pass-through is lost.

---

## Current state

### Scene set

| Scene | File | State |
| --- | --- | --- |
| Cabin opening | `cabin-opening.tsx` (634) | **Untouched / problematic** — see Known defects |
| Airliner descent | `hero-plane-3d.tsx` | Rebuilt on the textured GLB, flies through the wordmark |
| Identity band | `identity-band.tsx` (new) | Two stacked wordmark layers inside the flight pin; replaces the deleted `opening-stage.tsx` |
| Globe event theatre | `globe-plate.tsx` (new) + `live-globe-stage.tsx` | Interactive vector globe — drag, momentum, scroll zoom, flight nodes; `earth-globe-3d.tsx` **deleted** |
| Laptop demo | `demo/laptop-stage.tsx` | DOM composite, autoplaying, MacBook proportions |

### Palette: paper/ink, no beige

The beige register is retired. The decision that matters for anyone editing
colour: **`--color-*` is never defined anywhere in the codebase**, so the
`--flight-*` *fallbacks* in `landing-experience.module.css` are the real
palette. They were warm beige (chroma 0.014–0.025 at hue 78–86); they are now
near-neutral (trace chroma at hue 270–280). Three other places carry the same
register and must stay in step:

- `app/globals.css` → `.lp` scope (`--bg #FAFAF8`, `--ink #101014`)
- `scroll-experience.tsx` → `NOON` / `NIGHT` register objects
- `landing-nav.tsx` → the `.lp-nav-fill` inline background

Semantic accents (amber / cobalt / violet / pink) are unchanged and still carry
all the meaning. They are **not** for decoration: the atmosphere waves used to
be amber-tinted and were the most visible remaining beige, so the warm band is
now a neutral ink wash.

### Typography

Fraunces italic is gone — an italic display serif in a sans landing was reading
as an AI-generated-page tell. `.ed-serif`, `.ae-highlight-script` and
`.ae-globe-script` now render the display family roman at weight 800. Fraunces
is also dropped from the Google Fonts request (two families, not three, and one
fewer blocking stylesheet).

All seven numbered section kickers are removed, including a duplicate "05" that
proved the sequence was never tracked. Section headlines carry their own labels.

### Airliner departure — the shake fix

The "violent shaking" had two authored causes, both fixed:

1. **The path weaved.** `y` ran 0.06 → 1.32 → −0.5 → +0.2 → −0.92 and `x` swung
   −0.1 → 0.92 → −1.52 → 0.46 → 1.58. The aircraft was flying a weave exactly as
   specified. `Q_PATH` is now monotone by construction — every control point
   advances in the same sense.
2. **Bank was derived from quantisation noise.** The rig took a ±0.008 finite
   difference of `getTangentAt` and multiplied it by **42**. `getTangentAt` reads
   an arc-length table with 200 divisions, so a ±0.008 step lands about one
   division apart and the estimate quantises; amplified 42× and clamped at ±55°,
   the roll snapped between extremes every frame. Bank and pitch are now
   **closed-form functions of path progress** (`bankAt` / `pitchAt`), which
   cannot jitter however the curve is sampled.

Also removed a `Spring(82)` that sat on top of Lenis's lerp *and* a 1.2
ScrollTrigger scrub — three filters in series read as rubber-banding. One
frame-rate-independent `damp(…, 14, dt)` replaces it.

**Exit choreography:** turns right, crests, then descends at ~42° and leaves
through the **bottom of the frame** at readable scale (0.52), so the exit reads
as the aircraft pulling the page down. It is not faded out; the fade at 0.975 is
only a safety net for a fast flick past the pin.

The model is now the **hand-built `ProceduralAirliner`** (lathed fuselage,
splined swept wings, nacelles, plum tail, lit cabin windows). The Meshy GLB path
is deleted — `GeneratedAirliner`, `physicalFromStandard`, the `useGLTF` import
and its `preload` all went, so the 488K model is no longer fetched.

### Laptop demo — DOM composite

`macbook-stage.tsx` (522 lines of three.js) is **deleted**, replaced by
`demo/laptop-stage.tsx`.

The reason is correctness, not performance. With drei's `Html transform` the
chassis was projected by the WebGL frustum and the screen by CSS perspective;
the two disagreed and the screen painted ~110px off its own aperture.
`getBoundingClientRect()` reported it aligned while it painted misaligned. Camera
pinning, containment changes and aperture maths all failed to fix it.

In the composite the **screen is a descendant of the lid element**, so every
transform that moves the lid moves the screen. Misalignment is not fixed, it is
impossible. Verified: aperture layout 673 × 414, screen `1280 × 0.5258 = 673`.

Beats, all pure functions of `landingScroll.scenes.demo` so reverse scroll
replays them exactly:

```
0.00 – 0.08   shut, title card owns the frame
0.08 – 0.28   lid rotates up on its hinge, screen wakes
0.28 – 0.72   composite scales 1.52x (the push-in), loop plays
0.72 – 0.92   lid rotates back down
```

Two traps found while building it, both worth remembering:

- `--dm-screen-scale` must come from **`offsetWidth`**, not
  `getBoundingClientRect()`. The rect is post-transform, so during the push-in it
  reports the magnified size and the dashboard gets scaled twice and clipped.
- The `.demo-screen` 1280×800 sizing rule lived in the old `.dm-screen-html`
  block. Deleting that block collapsed the dashboard to content height and left
  the lower half of the aperture empty.

### The CSS-scope bug (fixed, but read this before touching the module CSS)

38 selectors were written `.experience:global(.ae-landing-experience) …`, a
compound needing **both** classes on one element — and nothing in the repo ever
applied `ae-landing-experience`. Every one was dead: the whole demo section
layout, the landing nav styling, and **every `:focus-visible` ring on the
landing**. The class now sits on `<main>` in `scroll-experience.tsx`, chosen
because the nav, marquee and CTA buttons live outside the per-scene wrappers and
would still have missed it.

Consequence: those rules had never rendered, so `.dm-headline`,
`.dm-headline-title`, `.dm-headline-sub`, `.dm-captions-row`, `.dm-cap`,
`.dm-cap-n` and `.dm-cap-title` had **no base styling at all** and were written
from scratch. Treat any other rule in that file as unverified until seen
rendering.

### Globe — flashing removed

Deleted from the event decal: three expanding rings on a `fract()` loop, a
1.7 rad/s swirl, a scanline, a hash plume re-rolling ~2×/s, and rotating dots.
What remains is a static disc plus one edge ring with **`uAeEventTime` pinned to
0** — no time input, so it cannot flash, and it is identical under
`prefers-reduced-motion`. Also off: the aurora (permanently, prop removed), star
twinkle, a `step(0.82, fract(uTime * 2.4 …))` particle strobe, the arc "trains"
of travelling dots, and the marker scale pulse.

---

## What needs to be done

### 1. Higgsfield plates — laptop chassis (decided, blocked on auth)

MCP server registered at `https://mcp.higgsfield.ai/mcp` in
`C:\Users\user\.claude.json`, scoped to this project. It reported
**Needs authentication**; run `/mcp` → `higgsfield` and complete OAuth, then
restart if the tools do not appear.

Chosen approach: **generated chassis plates + the live screen composited in.**
The screen must stay the real OCC DOM — a baked frame is banned (see Rules).

- Generate transparent-background chassis plates: **shut** and **open**.
- In `landing-experience.module.css`, give `.dm-laptop-lid-shell` and
  `.dm-laptop-base` a `background-image` and delete the gradient `background`
  values they replace. Swap points are commented in both files.
- Keep the plate's screen aperture matching `APERTURE` in `laptop-stage.tsx`
  (`left 3.1% · top 3.6% · width 93.8% · height 90%`), or retune those four
  numbers to the render.
- Log every shipped plate and its licence in `ASSETS.md`.

The current chassis is a **CSS stand-in**, not the chosen deliverable. Its
keyboard is deliberately a plain recessed well rather than a fake key grid.

### 2. Globe rebuild — DONE. Interactive vector globe, no textures

`earth-globe-3d.tsx` (955 lines) and 13 Earth texture files (**4.7 MB**) are
deleted. The replacement is `globe-plate.tsx`.

It went through two shapes and the second is what shipped:

1. **Raster** — an orthographic projection rasterised per pixel from
   `earth-mask.png`. Correct, cheap to write, and a dead end: one inverse
   projection plus four neighbour lookups per pixel is ~1.5M mask reads for a
   560px disc, so it could never be dragged, zoomed or given inertia.
2. **Vector (shipped)** — projects 273 coastline rings / 10,468 points from
   `world-coastline.json` every frame. That is ~10k sin/cos pairs, about a
   millisecond, so rotation, zoom and momentum are all free and the coastline
   stays crisp at any zoom because it is stroked rather than sampled.

`world-coastline.json` (109KB) is generated from the Natural Earth countries
file already in `public/data` by `scripts/generate_coastline.py` — flat lon/lat
arrays rounded to 1 decimal, which at the rendered size is a third of a pixel.
No Higgsfield generation and no new licensed asset.

**Motion model.** One damped system on the shared landing clock: drag sets
angular velocity and releases with exponential decay; scroll damps toward a
target zoom; selection eases the globe around to face the event; flight nodes
travel great-circle arcs between twelve stations. Verified by pixel-sampling
the canvas — drag 3,391 changed / momentum 2,648 / settled 4 of 10,000; zoom
carries the painted sphere 533px → 583px across the pin.

Four things to know before touching it:

- **The right→centre morph is the section's one structural move.** The globe
  enters right-aligned beside the intro copy and travels to the centre as the
  event theatre takes over (`xPercent: 42 → 0`, `scale: 0.86 → 1.06`, in
  `live-globe-stage.tsx`). An earlier pass deleted the x tween after mistaking
  it for a layout bug and left the globe parked in the middle from frame one
  with nothing to reveal. It reads `+42 → 0` rather than the old `0 → −39`
  because the grid now resolves the END state — 0 *is* centred, so the offset
  belongs on the `from`. If the grid's column widths change, retune the `from`.
- **The plate must measure `offsetWidth`, never `getBoundingClientRect`.** The
  orbit above it is scaled by that morph, so the rect fed the tween's scale back
  into the disc's own size and the sphere changed size for two reasons at once.
- **`makeProjector` axis order is load-bearing.** The yaw produces three axes:
  `along` (toward the viewer), `side` (screen-horizontal), `up` (polar). An
  earlier version returned `along` as screen-x and used `side` as depth — the
  two swapped — so the globe faced 90° away from the requested longitude and
  every mark projected outside the disc. The symptom looks like a data problem
  and is not.
- **`BASE_RADIUS` must leave headroom for `ZOOM_MAX`.** Radius is
  `(canvas / 2) × BASE_RADIUS × zoom`. At `0.94 × 1.85` that came to 539px in a
  620px canvas — a 1078px sphere clipped to a grey disc.
- **The projection is deliberately off-centre** (`lon0 = event.lon + 24`,
  `lat0 = event.lat × 0.4 + 20`). Centring on the active event put its mark at
  the exact middle of the disc, which is where the event headline sits.
- **Marks need their layer at `z-index: 3`.** A leftover rule,
  `.ae-globe-orbit canvas { position: relative; z-index: 2 }`, keeps the plate
  above `.ae-globe-fallback` and also covers anything at `auto` — which is why
  the marks had correct geometry, correct hit-testing and resolved colours and
  still painted nothing.

Dragging is back, and better than the orbit controls it replaced: the marks are
real `<button>`s over the canvas, so the interaction is keyboard-reachable and
announced. Idle drift and flight motion both stop under `prefers-reduced-motion`.

### 3. Globe section layout (mostly done)

The event feed is the editorial index (mono numeral, name, ICAO, one hairline,
one active row, no colour rainbow), the coverage strip is no longer cut off, and
the disc is capped at 560px so it no longer bleeds off every edge of the pin.

Still open: the event headline still sits **over** the disc. It is legible
(white and rose on a near-black globe) and the marks now dodge it, but a layout
that put the type beside the globe rather than on it would be better.

### 4. Cabin scene — never rebuilt

Chosen in an earlier round and still outstanding: replace the vintage-hotel
business class (cognac leather pods, brass table lamps, walnut dado rails,
breathing candle glow) with an accurate modern narrow-body cabin — 3-3 economy,
correct pitch, curved sidewall, real PSU strip, daylight on approach, trim
matching the exterior livery.

It also has three real defects:

- It reads **raw `window.scrollY`** (`cabin-opening.tsx:477`) while the rest of
  the page is on Lenis + ScrollTrigger. The two halves of one continuous shot
  cannot stay in sync.
- Its `<Canvas>` is the only one **without `frameloop="never"`** and the only one
  not registered via `registerThreeRoot`, so a full-viewport WebGL scene renders
  for the entire page life — it is only hidden with `autoAlpha`.
- The intended flow was never built: forward through the cabin → **90° turn** →
  zoom out off the skin → hand off to the airliner.

### 5. Responsive and a11y pass — partly done

Done this pass: reduced motion no longer opens on a blank screen (the identity
band becomes ordinary content and the flight section stops being full-height);
the three stray `tabIndex={0}` are removed; `.ae-globe-notification` is a
`role="status"` that is actually `polite`; and 390px was checked for the demo
(title card no longer fades into dead space, chapter rail wraps 2×2).

Still open: 768 / 1280 / 1920, both scroll directions, and the globe and cabin
scenes at 390. Dead CSS referencing removed components also remains:
`.ae-flight-lite-*`, `.co-intro-*`, and now `.ae-identity-*`.

### 6. Stale asset register — done

`ASSETS.md` was right all along and the code was wrong: the GLB is the shipped
model again, and its entry now says so.

### 7. Out of scope here, tracked in `FULLSTACK_AUDIT.md`

Three competing token systems, 228 raw hex literals, status dots still shipping
in `ds/primitives.tsx` and `event-panel.tsx`, unlabelled metrics in
`four-plans.tsx` / pricing / CTA, the fictional carriers behind "Trusted by the
best", and the scenarios page template. None were touched.

---

## Rules that still hold

- The laptop screen is the **real OCC interface**, never a pasted frame or baked
  video. This is why Higgsfield output is a chassis, not a scene.
- Globe events never auto-advance, never flash, never emit travelling white dots.
- No status dots anywhere, landing or app.
- Accents are semantic. If something is decorative, it does not get an accent.
- Reference images are direction, not production assets.
- Record every shipped asset and its licence in `ASSETS.md`.

## Environment gotchas that cost real time

- **Never run `npm run build` while the dev server is running.** It rewrites
  `.next` and the dev server then 404s on `layout.css` and `main-app.js`. Kill
  dev, clear `.next`, restart.
- **Two dev servers sharing one `.next` corrupts the build manifest** — the
  symptom is `TypeError: Cannot read properties of undefined (reading
  'experimental')`. Only run one.
- `ScrollTrigger.getAll()` can return **several triggers for the same element**
  across matchMedia contexts, including stale ones with a wrong span (a 430px
  reading against a real 3994px pin). Select the one with the largest span.
- Under OneDrive a cold compile throws one benign `Invalid or unexpected token`;
  it self-heals on reload.
- `RoundedBox` `radius` must stay **under half the smallest dimension**, or the
  solid bulges past its own face and swallows anything sitting on it. This cost
  a long debugging session on the old laptop deck.
- `RoundedBox` wraps **one UV set around the whole solid**, so a mapped texture
  draws at a fraction of the intended size on the top face. Use a plain
  `boxGeometry` when a face needs a map.
- Verify scene beats by driving `landingScroll.scenes.*` or seeking the timeline,
  not by wall-clock waits — Playwright throttles rAF while idle.
- For a plain screenshot, prefer the Edge that already ships with Windows over
  spinning up Playwright:
  `& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --window-size=1440,900 --screenshot=out.png http://localhost:3000/`
  Playwright is only worth it when the check needs scroll position, pointer
  input or canvas pixel sampling — which the globe and demo scenes do.

## Verification status

`tsc --noEmit` clean · `npm run lint` clean (one pre-existing
`no-page-custom-font` warning in `layout.tsx`) · zero console errors at 1440×900
and 390×844 · flight, globe and demo scenes verified by seeking
`landingScroll.scenes.*` and `window.__demoTL` and screenshotting each beat.

**Production build has NOT been re-run since this pass** — the dev server was
live throughout and running `next build` against it corrupts `.next`. Kill dev,
clear `.next`, then build.
