# Aeolus landing handoff

## Current state

The landing page uses the established Aeolus sections with three retained
cinematic prototypes:

- the Q-path aircraft from `bd6d43d`;
- the bidirectional OCC MacBook from `e4b6d71`;
- the textured 3D globe and its safe manual event controls;
- the “Airline recovery, simulated live.” copy;
- the event feed, active-event copy, notification card, and coverage strip;
- the aircraft/Earth assets and the minimal shared scroll/render runtime.

Automatic event cycling, moving white route dots, event particle sprays, and
high-frequency cyber strobing are disabled. Events now change only after an
explicit feed selection, and the camera settles with a slower spring.

## What was rejected

Do not restore or rebuild these pieces from the reverted branch:

- the CSS-only replacement cabin;
- the procedural luxury cabin and generated cabin texture library;
- the literal reference-frame MacBook treatment;
- global card tilt, blanket blur reveals, or motion on every text block;
- multiple concurrent canvases or startup work that can freeze first paint;
- timed/random event switching, flashing scanlines, particle showers, or
  fast-moving white markers.

Reference images are direction, not production assets. The OCC dashboard must
remain the actual Aeolus interface, never a pasted frame.

## Original direction to resume

Keep the section order and existing marketing copy. Improve fidelity one scene
at a time without replacing the established Aeolus typography or page
structure.

1. Cabin: improve the original scene incrementally. Do not replace it with the
   rejected heavy procedural cabin or generated texture stack.
2. Aircraft transition: preserve the current Q-path prototype. Refine its
   pacing and shallow departure without changing its path architecture. It must
   pass the Aeolus wordmark, leave a readable dwell, recede toward the globe,
   and remain a reversible function of scroll progress.
3. Globe: preserve the current scene. Any future event treatment must be
   surface-bound, low-frequency, manually triggered, and safe under
   `prefers-reduced-motion`.
4. OCC device: preserve the current prototype MacBook and its real live
   dashboard. Refine the hinge and materials in place; never replace the screen
   with reference-frame images. Opening/closing must stay scroll-derived,
   bidirectional, and physically eased.
5. Text motion: retain the original display/serif pairing. Use vertical clip
   reveals only for key display lines; do not apply one entrance effect to
   every paragraph.

## Implementation order and gates

Work behind a feature flag and merge one scene at a time:

1. Establish a static baseline: first contentful paint under 1.5 s on local
   desktop, no long task over 100 ms, and no WebGL required above the fold.
2. Add one canvas only. Confirm the page remains keyboard-scrollable and
   responsive before adding another scene.
3. Validate each animation in both directions at 360, 768, 1280, and 1920 px.
4. Profile a full top-to-bottom scroll before merging: zero React renders in
   the scroll path, no unbounded timers, and no canvas rendering while outside
   its scene.
5. Provide a complete reduced-motion static composition and verify no flashing
   or motion pattern exceeds accessibility guidance.
6. Record every shipped asset and license in `ASSETS.md`.

## Acceptance bar

- The page loads and scrolls immediately on localhost.
- Existing Aeolus typography, wordmark, status bar, and copy remain intact.
- Reverse scrolling restores the exact prior visual state.
- Globe events never auto-advance and never flash, orbit, or emit white dots.
- Any new 3D layer must hold 60 fps on an M1-class desktop and a 30 fps floor
  on a mid-range Android before it is enabled by default.
- A failed or slow 3D asset load must leave a coherent static page, not a blank
  screen or blocked main thread.
