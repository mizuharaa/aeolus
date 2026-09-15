# Olus lower-page rebuild

This implementation replaces the old 2D GlobePlate, FourPlans, Methodology and narrow footer in the active landing route. It preserves the replay-on-reload opening and real HTML MacBook demo. Historical design notes do not override this direction.

## Reference evidence

Mobbin was queried again for Joby experience highlights and United Carriers. Exact-site captures were inspected; unrelated search results were rejected. See the existing reference teardown and motion forensics for source-bundle values. Live sites were rechecked at https://www.jobyaviation.com/ and https://unitedcarriers.com/.

The Joby gallery reference is https://mobbin.com/sites/sections/7e3bda43-641a-4ac2-8070-527cd89cfecc. The United Carriers FAQ reference is https://mobbin.com/sites/sections/1d2df52d-350b-40e4-b25e-c9a676543f9e. User-supplied captures additionally establish the large dotted globe, split stats, center track and full-width aircraft fly-over composition.

## Implemented scenes

| Scene | Construction | Reduced motion |
|---|---|---|
| Gallery | Desktop pin 400vh, scrub 1; translate track and scale cards from center distance | Static grid; mobile vertical stack |
| Recovery journey | SVG path length scrub .7, marker follows path; cluster y/opacity reveal | Complete route and visible content |
| Technology | Image translates +8% to -8%, scrub | Static image |
| Stats | Desktop headline pin, scrubbed integer counts and hairline scale | Full numbers, no pin |
| Runway | Aircraft transform and simulated-day clock scrub .6; feature reveals | Static aircraft and visible features |
| Fly-over | Foreground model render, offset blurred shadow and masked backdrop blur; scrub .6 | No fly-over; readable quotes |
| Globe | Lazy Three.js; land-mask points interpolate from flat coordinates to sphere; dual-color atmosphere; instanced aircraft; drag, inertia, hub focus and summaries | Geographic SVG; keyboard hub controls remain |
| Engineering notes | Staggered image offsets and hover transforms | Same layout, no transition |
| Sky | Layered SVG clouds and aircraft scroll parallax; three copy beats | Static composition |
| Footer | Full-height field, navigation and honest email-collection preview notice | Same controls |
| FAQ | Search, categories, deep links, expand all, arrow/Home/End header navigation | Instant panels |
| 404 | Split-flap-style digit entrance, broken route and damped pointer aircraft | Static digits and aircraft |

Each GSAP construction owns a matchMedia context with cleanup. The globe stops rendering offscreen and on hidden tabs; DPR is capped at 2. No M1 hardware frame-rate claim or measured mobile web-vitals guarantee is made.

## Content and media

The current canonical catalog contains 22 event types. Production CP-SAT search and deterministic single-worker replay are distinguished. No unmeasured solve-time or universal legality guarantee is used. Quotes and global hub traffic are explicitly illustrative.

New stock photographs: Darya Sheydel, Pexels 8949803 (https://www.pexels.com/photo/close-up-shot-of-an-airplane-8949803/), and Denniz Futalan, Pexels 6716735 (https://www.pexels.com/photo/airplane-on-runway-6716735/), listed free to use under the Pexels license. The transparent aircraft is a top-down render of the already-owned Olus GLB, using the model's existing CC BY 4.0 attribution in ASSETS.md. No Joby/United image or logo ships in the application.

## Validation

Run `npm run type-check`, `node scripts/olus-recovery-qa.mjs`, and the existing brand-storage/reload checks from apps/web. Browser outputs are stored locally under docs/verification/recovery. The shared backend database resolver intentionally retains compatibility with an existing aeolus.db and its WAL; renaming a brand must not discard saved scenarios.
