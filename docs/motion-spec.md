# Olus opening — motion implementation

Stage B, 2026-09-14. Implemented values below are Olus targets, not recovered reference constants. The original reference evidence remains in `motion-forensics.md`.

| Motion | Trigger | Start/end | Scrub/pin | Duration/ease | Properties | Reduced motion |
| --- | --- | --- | --- | --- | --- | --- |
| Intro SVG draw | Every landing-page load | 0–0.85 s | None | 0.85 s, power2.inOut | stroke dash offset | Final mark immediately |
| Stroke to fill | Intro | 0.85–1.2 s | None | 0.35 s | fill/stroke opacity | Final fill |
| Same-node logo FLIP | Intro | 1.2–2.0 s | None | 0.8 s, expo.inOut | FLIP position/scale | Navbar placement |
| Wordmark reveal | Intro | 1.4–2.0 s | None | 0.6 s, power3.out | clip-path | Visible |
| Cover reveals downward | Intro | 1.2–2.0 s | None | 0.8 s, expo.inOut | inset clip-path | No cover |
| Nav chrome | Intro | 1.85–2.2 s | None | 0.25 s, stagger 0.05 | y/opacity | Visible |
| Headline line masks | Intro | 1.85–2.28 s | None | 0.35 s, stagger 0.08, power3.out | yPercent | Visible |
| Hero settle | Hero top | top top → +120vh | scrub 0.8, pin | linear progress | scale 1→0.94, radius 28→56, brightness 1→0.8 | Normal flow, static image |
| Hero caption | Opening top | top top → top -35% | scrub 0.8 | linear progress | opacity 0.65→1 | Fully visible |
| Nav background | Scroll position | 80px → max | toggleClass | CSS 0.3 s | background/backdrop | Static class follows position |
| Menu panel | Mouse hover or click | Open/close | None | 0.5 s expo.out; reverse speed 0.85 | clip-path/opacity | Immediate native dialog |
| Menu media slivers | Menu open | 0.08 s onward | None | 0.7 s expo.out, stagger 0.06 | scaleY/clip-path | Full media cards |
| Menu gradient change | Pointer/focus on link | Active link | None | CSS 0.4 s | Layer opacity | Immediate |
| Button wipe | Hover | Enter/leave | None | 260 ms cubic-bezier(.22,1,.36,1) | clip-path | Immediate |
| MacBook lid/push | Demo top | top top → +320vh desktop | scrub 1.1, pin | Existing hinge easing | DOM transforms | Open static MacBook + narrative summary |
| Recovery playback | Demo progress 0.36–0.88 | 25-second loop | Independent timeline | Existing chapter timings | Existing console choreography | No autoplay |

Lenis uses lerp 0.085, wheelMultiplier 1, syncTouch false, GSAP ticker integration and the existing shared render loop. Opening/menu constructions use matchMedia with cleanup; the demo retains its scoped construction. A 2.4-second intro failsafe releases scrolling. Browser preference migration precedes theme initialization. Pre-hydration styling masks the hero on every load. The intro replays on reload, including when the browser restores a scrolled position; reduced motion still skips it. This supersedes the original once-per-session requirement.

## Review evidence

`verification/opening/results.json` contains the browser assertions and scoped axe output. `opening-desktop.webm` and `opening-mobile.webm` show the opening and menu; desktop also shows the MacBook playback controls. PNGs show desktop, 320px/mobile, navigation, MacBook and reduced motion.

Axe covers the new opening and native menu only. It is not a WCAG certification or an audit of the retained dashboard. Current full landing first-load JavaScript is 274 KB according to Next build, above the 180 KB brief target. LCP/CLS/INP under throttled hardware and M1 globe FPS are not measured in this stage. The retained globe and other existing sections still need the requested rebuild and deferred loading.
