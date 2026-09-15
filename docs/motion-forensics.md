# Olus motion forensics

Research date: 2026-09-14. References: [Joby](https://www.jobyaviation.com/) and [United Carriers](https://unitedcarriers.com/). Desktop Edge capture at 1440×900, DPR 1, default motion. Source files and their original URLs are mapped in `reference/{joby,united}/facts.json`.

## Evidence rules

**R** = recovered from delivered source; **M** = measured in this browser; **H** = hypothesis; **T** = requested Olus target. A normalized scrub timeline's `duration:1` is a fraction of scroll progress, not a one-second user journey. Sticky parent height is not identical to active ScrollTrigger distance. No runtime `window.ScrollTrigger` global was exposed by either site; therefore start/end pixel values were not read from live trigger instances. Raw source strings and measured element sizes are reported separately.

No `.pin-spacer` nodes were found. Both sites have real CSS sticky elements. The presence of `pin`, `Flip`, `Observer` or `ScrollSmoother` strings inside a library bundle does not establish active use in a specific scene.

## Actual recovered values

| Section | Trigger | Start | End | Scrub | Pin/sticky | Duration | Ease | Properties animated | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Joby hero inner | `hero-st-inner-progress-${theme}` | `top top` | `bottom bottom` | true | CSS sticky; hero wrapper M 10,800px | normalized 1; entry slice `1/(d/100)` | power1.inOut, power2.out, none | translation/radius progress, opacity, caption phase | R `joby/7-script.txt`; M facts/details |
| Joby hero exit | `hero-st-full-progress-${theme}` | `top top` | `bottom top` | true | same wrapper | normalized 1 | power2.out / power2.inOut | radius-out, inner translation, caption y/opacity | R `joby/7-script.txt` |
| Joby hero intro | hero root | mount + preloader state | completion | no | overlay/hero | 1s; delay `.2 + (preloaded ? 0 : 2)` in recovered variant | power2.inOut; overlay power1.out | intro progress, overlay | R `joby/7-script.txt`, constants in `6-script.txt` |
| Joby gallery entrance | `experience-highlights-viewport-st` | `top bottom` | `+=100lvh 0` | true | CSS sticky wrapper | normalized 1 | power1.out | title scale, intro variable, background/text color | R `joby/7-script.txt` |
| Joby gallery main | `experience-highlights-sticky-st` | `top top` | `bottom bottom` | true | M parent 5,175px; child 850px; top 25px | slide fraction `n=1/slides` mobile or `.9/slides` desktop | power1.in/out, power1.inOut | slide phase vars, transformOrigin, title scale/y, visibility | R `joby/7-script.txt`; M details |
| Joby gallery exit | `experience-highlights-section-end-st` | `top bottom` | `bottom top` | true | exit region | normalized .9 phase | power1.inOut | last-slide exit, title y/opacity | R `joby/7-script.txt` |
| Joby app | `section-app-st` | `top bottom` | `bottom bottom` | not explicit in call | ordinary 893px section | normalized 1 | power1.out; shared text ease | animate-in variable, paragraph y | R `joby/7-script.txt`; wrapper defaults not traced |
| Joby media section entry | `section-entry-${anchor}` | `top bottom` | `top top` | true | ordinary entry region | radius .5, opacity .1 at .4, translation 1 normalized | power1.in/out, none | border radius var, opacity, y-progress | R `joby/2-script.txt` |
| Joby media section exit | `section-entry-full-${anchor}` | `top top` | `bottom top` | not explicit in call | section wrapper | translation 1; optional radius .5 | none / power2.out | out-translation, optional radius/opacity | R `joby/2-script.txt` |
| Joby news | `news-section-st` | `top bottom` | `bottom bottom` | true, once | no JS pin observed | reveal .7s; card `1-r` s, `r=.15*index` | power1.out / power2.out | section/card animate-in vars, split text | R `joby/2-script.txt` |
| Joby partners | `section-partners-sticky-st` | `top top` | `bottom bottom` | true | M 900px child / 3,240px parent | normalized category progress | source callback, not recovered easing | active category/media | R `joby/8-script.txt` |
| Joby illustration entry | `section-illustration` | `top bottom` | `top top` | true | section | radius phase .5 | power2.in | radius progress | R `joby/7-script.txt` |
| Joby illustration layers | `layer-parallax-${n+1}` | `top bottom` | `bottom top` | true | independent layers | scroll-normalized | none | y from -r to +r | R: desktop r=`.15*innerHeight*weight`; weights `[0,0,.4,.3,.4,.55,0,.2,.6,.4,0]` |
| UC globe entrance | `.home-hero-globe` | reveal/init | completion | no | M 900px child / 2,250px parent | globe 1s; rim 1.2s; labels .5s stagger .05 | expo.out, circ.inOut, back.out(1.3) | scale .4→1, xPercent, opacity, blur | R `united/63-script.txt` |
| UC globe exit | `.home-hero` | `top top-=20%` | `center top` | true | CSS sticky | normalized 1 | none | autoAlpha, brightness 1→.2; stars .18→0, scale 1→1.1 | R `united/63-script.txt` |
| UC stats | `.home-intro-stats-item` | `top 85%` | not supplied; once | no | sticky adjacent intro | 1s | power1.out | numerical value counter | R `united/63-script.txt` |
| UC crane in | `.home-service-first-screen` | `top top+=50%` | `top+=100vh top` | true | CSS sticky | normalized 1 | none / linear | x, visibility, sequence | R `united/63-script.txt` |
| UC crane rotate | same | `top+=250vh top` | `top+=440vh top` | true | CSS sticky | .7/.8 normalized segments | none / linear | container x/y/scale/blur, crane rotation, truck x | R `united/63-script.txt` |
| UC road transition | `.home-service-second-screen` | `bottom-=100vh bottom` | `bottom bottom` | true | CSS sticky | normalized 1; fastScrollEnd true | none | road x, vehicle orientation/visibility | R `united/63-script.txt` |
| UC runway-equivalent vehicle placement | `.home-service-sub-list` | `top+=30vh bottom` | `top+=50vh center` | true | truck sticky wrapper | normalized 1 | none | scale, top, x/y | R `united/63-script.txt`; reference uses layout properties Olus should avoid |
| UC fly-over / overlap desktop | `.home-testi` | `top+=20vh top` | `top+=220vh top` | true | M plane 900px sticky / 2,991px parent | normalized 1; fastScrollEnd true | CustomEase `cinematicSmooth`, `.25,.1,.25,1` | overlap -60→180, plane scale 1→1.3; shadow x -5→3, y 0→2, scale .9→.5 | R `united/63-script.txt`; M detailed screenshots |
| UC fly-over mobile branch | `.home-testi` | `top bottom` | `top+=100vh top` | true | source branch only; mobile not measured | normalized 1 | none | plane y -50vh, shadow vars, content inset | R `united/63-script.txt` |

Viewport arithmetic: at 900px height, the UC desktop testimonial interval is 1,800px (**200vh**); crane rotation interval is 1,710px (**190vh**). Those are source-derived relative spans, not measured global trigger offsets. Joby's gallery sticky parent minus child gives 4,325px (**4.806 viewport heights**) of potential hold; offset/nesting affects the exact active range. Hero section height 10,800px is **12 viewport heights**, not a 12-second duration.

## Shared Joby timing constants

Recovered in `joby/6-script.txt` and root CSS: title .667s with .083s stagger, from y 1.9rem; text .5s with .083s stagger, from y 1.4rem; line .833s; stack delay .3335s; line delay .083s; intro delay 2s. CSS `--ease-snappy` is `cubic-bezier(.2,.21,0,1)`. GSAP calls refer to ease name `snappy`; its registration was not fully traced, so CSS and JS curve equivalence is not asserted.

## Libraries: confirmed vs unresolved

- Both: runtime `gsapVersions` and `lenisVersion`; source includes active ScrollTrigger constructions.
- Joby: SplitText use is explicit. `Flip.fit` is used in a delivered section module, but **not established as the preloader's logo mechanism**. Session service reads `__preloader_shown`. Full navbar opening and first-load SVG sequence were not isolated to precise source constants.
- UC: runtime `__THREE__`, active globe canvas and Three-related source; CustomEase used for testimonial overlap. Dotted globe and moving routes are visible. Exact vertex morph, route-marker mesh construction, drag damping and hub click camera math were not recovered.
- ScrollSmoother/Observer/Flip text matches in shared/vendor files are not evidence that the site intentionally mounts each plugin. No Rive/Lottie/DrawSVG requirement was established by this pass.

## Requested mechanics that are adaptations

| Original prompt statement | What was actually established | Olus decision |
|---|---|---|
| Joby uses the exact .9/1.3/2.1s logo Flip chain | Not recovered; source intro delay includes 2s | Keep ≤2.4s Olus target, implement/test original mark |
| Joby nav opens morphing media rectangles | Captured open menu is text-led on blue | Requested media-card mega-panel remains new Olus behavior |
| Hero pin 1.2× viewport is exact Joby | Current hero wrapper measures 12 viewports | Use compact Olus target, show timing comparison |
| Gallery is exactly a horizontal mapRange track | Source uses per-slide phase variables and transform origins | Preserve visual thumbnail/full-frame behavior; do not claim identical internals |
| UC stats count with scrub | Source count-up runs once at `top 85%` | Olus scrub-count is optional requested adaptation, clearly labeled |
| Fly-over is exactly 180vh, scrub .6, shadow delay .04 | Source desktop overlap is 200vh, scrub true, shadow vars on same timeline | Preserve requested Olus diagonal version; do not label constants recovered |
| Flat map definitely bends point-for-point into UC sphere | Dotted globe visually confirmed; transition internals not established | Implement proper correspondence for Olus and verify independently |
| Filters and clip-path are always compositor-only | Reference uses filters and layout properties | Profile actual paint/frame costs; transforms preferred |

## Remaining research limitations

The full numerical preloader/navbar choreography, mobile reference measurements, all media-frame URLs embedded in dynamic frame sequences, inaccessible intrinsic dimensions, globe input math, and end-to-end curve registrations are not established. The recorded 126 Joby and 169 UC DOM media elements include duplicates and unloaded entries. Their dimensions may be 0 until loaded; the manifest marks these unavailable rather than inventing sizes. Reference branch assets can be prefetched without being active on the homepage. Public bundles and screenshot timestamps must accompany any later refinement.

One Joby autoplay interruption was recorded; UC recorded no pageerror events in the initial capture. These are reference capture observations, not Olus validation results. No LCP/CLS/INP, mobile AA, keyboard-complete globe, or M1 frame-rate acceptance has been run for the rebuilt product.

## Reproduction

From the repository root, run `node docs/reference/capture.cjs`, `node docs/reference/details.cjs`, then `python docs/reference/summarize.py`. The local web dependency tree is absent in this checkout; this session reused the installed Playwright at `C:/Users/Khang/pw/ui-refinement/node_modules/playwright` through `OLUS_PLAYWRIGHT_PATH`. Edge is the browser channel. `collect-mobbin.py` uses Python/Pillow to preserve captures and create research sheets.

Review [the revised brief](OLUS-MASTER-BUILD-PROMPT.md) before Stage B. The unavailable values above are expressly unrecovered; this report does not satisfy a demand for exact values that the evidence did not expose.
