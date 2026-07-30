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
 * ── Playback is NOT scroll-driven ────────────────────────────────────────────
 * It was: the lid hinge and the recovery loop were both scrubbed by
 * `landingScroll.scenes.demo` inside a 520vh pin, which meant the demo only
 * moved while the user kept scrolling, and stopping mid-loop froze the console
 * mid-sentence. This is a demo video, so it behaves like one: it opens and plays
 * on its own clock when it comes into view, loops, and pauses off-screen. The
 * only scroll dependency left is "is it visible".
 *
 * Beats, in seconds from the moment the stage first becomes visible:
 *
 *   0.00 – 0.35   shut, the title card owns the frame
 *   0.35 – 1.45   the lid rotates up on its hinge and the screen wakes
 *   1.45 –  …     the composite settles into its playing pose; loop runs
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

const HINGE_DELAY = 0.35
const HINGE_DURATION = 1.1

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
  /** Fires with the eased hinge value (0 shut, 1 open) whenever it changes. */
  onOpenChange?: (open: number) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const rigRef = useRef<HTMLDivElement>(null)
  const lidRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const hinge = useRef(staticMode ? 1 : 0)
  const elapsed = useRef(0)
  const [visible, setVisible] = useState(false)

  /** Visibility gate — the only thing scroll still controls. */
  useEffect(() => {
    const root = rootRef.current
    if (!root || staticMode || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.35 },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [staticMode])

  useEffect(() => {
    if (staticMode) return
    return registerLandingFrame((_time, delta) => {
      const rig = rigRef.current
      const lid = lidRef.current
      if (!rig || !lid) return

      // Wall clock, not scroll position. Runs forward only while on screen, and
      // rewinds when the stage leaves so a second visit replays the open.
      elapsed.current = visible
        ? elapsed.current + delta
        : Math.max(0, elapsed.current - delta * 2.5)

      const target = smoothstep(
        HINGE_DELAY,
        HINGE_DELAY + HINGE_DURATION,
        elapsed.current,
      )
      hinge.current = landingScroll.reducedMotion
        ? target
        : damp(hinge.current, target, 9, delta)
      const open = clamp01(hinge.current)

      // −92deg is shut (lid folded flat onto the deck); 0 is fully open.
      lid.style.transform = `rotateX(${(-92 * (1 - open)).toFixed(2)}deg)`

      // The settle: a small lift and scale as the lid finishes opening. Capped
      // at 1.06 deliberately — the old 1.52x push-in drove the top of the lid
      // several hundred pixels above the viewport, which is why the screen was
      // not in frame at all. The rig is already sized to fill its stage.
      const settle = smoothstep(0.35, 1, open)
      const scale = 1 + settle * 0.06
      const shut = 1 - open
      rig.style.transform = `translate3d(0, ${(shut * 5).toFixed(2)}%, 0) scale(${scale.toFixed(4)})`

      const screen = screenRef.current
      if (screen) {
        const lit = smoothstep(0.12, 0.34, open)
        screen.style.opacity = String(lit)
        screen.style.visibility = lit < 0.01 ? "hidden" : "visible"
      }

      onOpenChange?.(open)
    })
  }, [onOpenChange, staticMode, visible])

  return (
    <div
      ref={rootRef}
      className="dm-laptop"
      data-static={staticMode}
      aria-label="Aeolus OCC dashboard on a laptop"
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
