"use client"
/**
 * LaptopStage — the OCC dashboard inside a laptop, composited in the DOM.
 *
 * The screen is a DESCENDANT of the lid, so every transform that moves the lid
 * moves the screen with it; misalignment is not fixed here, it is impossible.
 * (The previous three.js version projected the chassis through the WebGL frustum
 * and the screen through CSS perspective, the two disagreed, and the screen
 * painted ~110px off its own aperture.)
 *
 * ── Scroll choreographs the device; the demo plays itself ────────────────────
 * Two clocks, deliberately. SCROLL drives the physical object — the lid angle
 * and the push-in — because those are the beats the visitor should feel
 * themselves causing. The recovery loop inside the screen runs on its own wall
 * clock, because a 25s narrative scrubbed by a scroll wheel just freezes the
 * agent mid-word whenever someone stops moving.
 *
 * Beats, as a function of `landingScroll.scenes.demo`:
 *
 *   0.00 – 0.10   shut. The title card owns the frame.
 *   0.10 – 0.34   the lid rotates up on its hinge; the screen wakes.
 *   0.34 – 0.52   the push-in: the camera closes on the panel until the OCC
 *                 surface nearly fills the viewport, and playback starts.
 *   0.52 – 0.80   held wide open at full size — the loop plays here.
 *   0.80 – 0.94   pull back out, then the lid rotates shut.
 *   0.94 – 1.00   closed, and the section hands off to what follows.
 *
 * Proportions are a 13" MacBook Air normalised to the body width (30.41cm wide,
 * 21.24cm deep): lid and base are both 0.698 of the width, and the 16:10 panel
 * sits behind a ~1.6% side bezel with a slightly deeper chin. Those numbers are
 * what make it read as a MacBook rather than a generic slab.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { landingScroll, registerLandingFrame } from "@/lib/scroll"
import { damp } from "@/lib/spring"

/**
 * Where the panel sits inside the lid, as a fraction of the lid box.
 * width 96.8% ⇒ a 1.6% bezel each side; height 86.7% of a 0.698W-tall lid is
 * exactly 16:10, so the aperture cannot letterbox the dashboard.
 */
const APERTURE = { left: 0.016, top: 0.043, width: 0.968, height: 0.867 }

/** Scroll-progress breakpoints for the choreography above. */
const LID_OPEN_FROM = 0.1
const LID_OPEN_TO = 0.34
const PUSH_FROM = 0.34
const PUSH_TO = 0.52
const PULL_FROM = 0.8
const PULL_TO = 0.9
const LID_SHUT_FROM = 0.86
const LID_SHUT_TO = 0.96

/**
 * How far the composite scales at full push-in. 2.35 puts the ~950px-wide
 * panel near the full width of a 1440 viewport — the point of the move is that
 * the OCC surface becomes readable, and at the previous 1.06 it never did.
 * The rig's transform-origin sits on the screen's centre (see the module CSS)
 * so the growth happens around the panel and not around the deck.
 */
const PUSH_SCALE = 1.62

/**
 * Fraction of the rig's height to lift the composite by at full push, so the
 * PANEL ends up centred in the viewport rather than the rig.
 *
 * Geometrically the aperture's centre is at 0.374 of the rig (4.3% + 86.7%/2 of
 * a lid that is 78.4% of the rig), which would make this 0.5 − 0.374 = 0.126.
 * Measured, the panel still landed ~30px high: the stage carries a 2600px
 * `perspective` with its origin at 50% 46%, and that projection shifts the lid
 * relative to its own layout box by an amount the flat geometry does not
 * predict. This is the measured value, not the derived one — retune it by
 * reading `.dm-laptop-aperture`'s box at full push if the perspective changes.
 */
const PUSH_RECENTRE = 0.165

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp01((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

export function LaptopStage({
  children,
  staticMode,
  onOpenChange,
}: {
  children: ReactNode
  staticMode: boolean
  /** Eased hinge (0 shut, 1 open) and push-in (0 wide, 1 closed on the panel). */
  onOpenChange?: (open: number, pushed: number) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const rigRef = useRef<HTMLDivElement>(null)
  const lidRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const hinge = useRef(staticMode ? 1 : 0)
  const push = useRef(staticMode ? 1 : 0)

  useEffect(() => {
    if (staticMode) return
    return registerLandingFrame((_time, delta) => {
      const rig = rigRef.current
      const lid = lidRef.current
      if (!rig || !lid) return

      const progress = landingScroll.scenes.demo
      const reduced = landingScroll.reducedMotion

      // Lid: opens on the way in, shuts on the way out. Both edges are pure
      // functions of scroll, so reversing the wheel reverses the hinge exactly.
      const lidTarget =
        smoothstep(LID_OPEN_FROM, LID_OPEN_TO, progress) *
        (1 - smoothstep(LID_SHUT_FROM, LID_SHUT_TO, progress))
      hinge.current = reduced ? lidTarget : damp(hinge.current, lidTarget, 10, delta)
      const open = clamp01(hinge.current)

      // Push-in: closes on the panel and holds, then pulls back before the lid
      // starts to shut. Damped rather than read raw so a flick of the wheel
      // arrives as a move rather than a jump.
      const pushTarget =
        smoothstep(PUSH_FROM, PUSH_TO, progress) *
        (1 - smoothstep(PULL_FROM, PULL_TO, progress))
      push.current = reduced ? pushTarget : damp(push.current, pushTarget, 7, delta)
      const pushed = clamp01(push.current)

      // −92deg is shut (lid folded flat onto the deck); 0 is fully open.
      lid.style.transform = `rotateX(${(-92 * (1 - open)).toFixed(2)}deg)`

      const scale = 1 + pushed * (PUSH_SCALE - 1)
      const shut = 1 - open

      // Re-centre the panel as it grows. The transform origin sits on the
      // screen, not on the rig's middle, so scaling about it leaves the panel
      // above centre — at full push that put the top of the screen out of the
      // viewport. The translate is in screen px and composes before the scale,
      // so it is not itself magnified.
      const recentre = pushed * PUSH_RECENTRE * rig.offsetHeight
      rig.style.transform =
        `translate3d(0, calc(${shut * 5}% + ${recentre.toFixed(1)}px), 0) ` +
        `scale(${scale.toFixed(4)})`

      const screen = screenRef.current
      if (screen) {
        const lit = smoothstep(0.12, 0.34, open)
        screen.style.opacity = String(lit)
        screen.style.visibility = lit < 0.01 ? "hidden" : "visible"
      }

      onOpenChange?.(open, pushed)
    })
  }, [onOpenChange, staticMode])

  return (
    <div
      ref={rootRef}
      className="dm-laptop"
      data-static={staticMode}
      aria-label="Olus OCC dashboard on a laptop"
    >
      <div ref={rigRef} className="dm-laptop-rig">
        <div ref={lidRef} className="dm-laptop-lid">
          <div className="dm-laptop-lid-shell" aria-hidden />
          <div className="dm-laptop-aperture">
            <div
              ref={screenRef}
              className="dm-laptop-screen"
              data-testid="occ-dashboard-screen"
              style={{ opacity: staticMode ? 1 : 0 }}
            >
              {children}
            </div>
            <span className="dm-laptop-glare" aria-hidden />
          </div>
          <span className="dm-laptop-notch" aria-hidden />
        </div>
        <div className="dm-laptop-base" aria-hidden>
          <span className="dm-laptop-keyboard" />
          <span className="dm-laptop-trackpad" />
          <span className="dm-laptop-lip" />
        </div>
        <span className="dm-laptop-shadow" aria-hidden />
      </div>
    </div>
  )
}

export const LAPTOP_APERTURE = APERTURE
