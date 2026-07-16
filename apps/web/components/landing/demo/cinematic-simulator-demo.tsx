"use client"
/**
 * CinematicSimulatorDemo — the landing's centerpiece, played like a video.
 *
 * A ~25s GSAP timeline loops one full recovery loop on a light console
 * that mirrors the real simulator (paper floor, white cards, teal
 * identity, pink disruption):
 *
 *   1. the agent box types "Trigger weather closure at KORD, severity 4."
 *   2. the cursor opens the event selector and clicks Weather closure
 *   3. the camera flies to KORD; the marker pulses; the cascade draws out
 *   4. the plan inspector slides in; the cursor commits Plan B
 *   5. metrics count down, teal reroutes re-flow, toast lands, camera
 *      pulls back to the start framing so the loop cuts cleanly
 *
 * No scroll scrubbing and no pinning: a ScrollTrigger only plays/pauses
 * the loop while the section is on screen. Caption steps auto-advance
 * with the playback; clicking one seeks the video. The "camera" is a
 * translate/scale transform over a fixed 1500×860 world plane (DemoMap);
 * values are function-based and re-invalidated on resize. Reduced-motion
 * renders the final recovered frame as a static figure.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { CloudLightning, FileText, LayoutGrid, Leaf, Route, Users } from "lucide-react"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"
import { AeolusMark } from "@/components/ds/logo"
import { EASE } from "@/components/landing/motion"
import { DemoMap } from "@/components/landing/demo/demo-map"
import { AgentCommandDemo } from "@/components/landing/demo/agent-command-demo"
import { CursorChoreography } from "@/components/landing/demo/cursor-choreography"
import {
  AGENT_COMMAND,
  DEMO_STEPS,
  FLIGHT_GEO,
  KORD,
  PLANS,
  WORLD_H,
  WORLD_W,
  bezAngle,
  bezPoint,
} from "@/components/landing/demo/demo-data"

const STATUS = [
  { label: "Nominal", color: "var(--dk-teal)" },
  { label: "Disrupted", color: "var(--dk-rose)" },
  { label: "Recovering", color: "#EFAF1B" },
  { label: "Stable", color: "var(--dk-teal)" },
]

const RAIL_ICONS = [LayoutGrid, CloudLightning, Route, Users, Leaf, FileText]
/** which rail icon is "active" per scene */
const RAIL_ACTIVE = [0, 1, 2, 5]

// Mirrors the real simulator's event LEDGER (mono index + name — see
// event-panel.tsx), so the demo previews the product that actually ships.
const EVENT_ROWS = [
  { label: "Weather closure", hot: true },
  { label: "Ground stop" },
  { label: "Runway closure" },
  { label: "Crew sick-out" },
]

/** loop length in seconds + where each caption scene starts */
const TOTAL = 25
const SCENE_STARTS = [0, 7.8, 15.2, 18.4]

export function CinematicSimulatorDemo() {
  const rootRef = useRef<HTMLElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const [scene, setScene] = useState(0)
  const [staticMode, setStaticMode] = useState(false)
  const sceneRef = useRef(0)
  // 0 nominal · 1 disrupted/hold · 2 recovering · 3 stable — drives the plane loop
  const phaseRef = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    setStaticMode(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || staticMode) return

    const q = gsap.utils.selector(root)
    const mm = gsap.matchMedia()

    mm.add(
      {
        desktop: "(min-width: 961px) and (prefers-reduced-motion: no-preference)",
        mobile: "(max-width: 960px) and (prefers-reduced-motion: no-preference)",
      },
      (mctx) => {
        const mobile = Boolean(mctx.conditions?.mobile)
        const canvas = q(".dm-canvas")[0] as HTMLElement
        const world = q(".dm-world")[0] as HTMLElement
        if (!canvas || !world) return

        const fit = () => {
          const r = canvas.getBoundingClientRect()
          const s = Math.max(r.width / WORLD_W, r.height / WORLD_H) * 1.05
          return { s, x: (r.width - WORLD_W * s) / 2, y: (r.height - WORLD_H * s) / 2 }
        }
        /** camera transform putting world point (wx,wy) at canvas fraction (ox,oy) */
        const cam = (wx: number, wy: number, zoom: number, ox = 0.5, oy = 0.5) => {
          const r = canvas.getBoundingClientRect()
          const s = fit().s * zoom
          return { scale: s, x: r.width * ox - wx * s, y: r.height * oy - wy * s }
        }

        const kordZoom = mobile ? 2.15 : 1.8
        const typeProxy = { n: 0 }
        const heldProxy = { v: 0 }
        const cxlProxy = { v: 16 }
        const paxProxy = { v: 0 }
        const costProxy = { v: 0 }

        const cmdEl = q(".ag-cmd")[0] as HTMLElement
        const heldEl = q(".dm-held-n")[0] as HTMLElement
        const mCxl = q(".dm-m-cxl")[0] as HTMLElement
        const mPax = q(".dm-m-pax")[0] as HTMLElement
        const mCost = q(".dm-m-cost")[0] as HTMLElement

        // ── live flight loop ──────────────────────────────────────────
        // One rAF pass moves every plane along its arc at its own speed.
        // Background flights always cruise; hub flights freeze amber while
        // the closure holds (phase 1), then re-flow teal on their reroute
        // arcs once recovery commits (phase ≥ 2). Independent of the GSAP
        // timeline, gated to on-screen by the ScrollTrigger below.
        const geo = FLIGHT_GEO
        const planes = q(".dm-plane") as HTMLElement[]
        const glyphs = planes.map((p) => p.querySelector(".dm-plane-glyph") as HTMLElement)
        const holds = planes.map((p) => p.querySelector(".dm-plane-hold") as HTMLElement)
        const rt = geo.map((f) => ({ t: f.phase, speed: 1, color: "" }))
        // thin out background traffic on small screens for headroom
        if (mobile) geo.forEach((f, i) => { if (f.role === "bg" && i % 2 === 1 && planes[i]) planes[i].style.display = "none" })

        let raf = 0
        let last = 0
        let running = false
        const paint = (i: number, c: string) => {
          if (rt[i].color !== c) { rt[i].color = c; if (planes[i]) planes[i].style.color = c }
        }
        const frame = (now: number) => {
          if (!running) return
          if (!last) last = now
          let dt = (now - last) / 1000
          last = now
          if (dt > 0.1) dt = 0.1 // clamp after a tab-away
          const phase = phaseRef.current
          for (let i = 0; i < geo.length; i++) {
            const el = planes[i]
            if (!el || el.style.display === "none") continue
            const f = geo[i]
            const s = rt[i]
            const hub = f.role !== "bg"
            const onReroute = hub && phase >= 2
            const held = hub && phase === 1
            const path = onReroute ? f.reroute : f.primary
            const target = held ? 0 : 1
            s.speed += (target - s.speed) * Math.min(1, dt * 2.2) // eased accel/decel
            s.t += (dt / f.dur) * s.speed
            if (s.t >= 1) s.t -= 1
            const pt = bezPoint(path, s.t)
            const bob = held ? Math.sin(now / 240 + i * 1.3) * 2.2 : 0
            el.style.transform = `translate(${pt.x}px, ${(pt.y + bob).toFixed(2)}px)`
            glyphs[i].style.transform = `rotate(${bezAngle(path, s.t).toFixed(1)}deg)`
            paint(i, held ? "var(--dk-amber)" : onReroute && phase === 2 ? "var(--dk-amber)" : "#2C49E0")
            if (holds[i]) holds[i].style.opacity = held ? "1" : "0"
          }
          raf = requestAnimationFrame(frame)
        }
        const startFlights = () => { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame) } }
        const stopFlights = () => { running = false; if (raf) cancelAnimationFrame(raf) }

        const tl = gsap.timeline({
          paused: true,
          repeat: -1,
          repeatDelay: 2.4,
          defaults: { ease: "power2.inOut" },
          onUpdate: () => {
            const t = tl.time()
            // network phase drives the live plane loop; derived from time so
            // seeking the captions keeps the fleet in the right state.
            phaseRef.current = t < 9.3 ? 0 : t < 18.1 ? 1 : t < 21.5 ? 2 : 3
            const s = t < SCENE_STARTS[1] ? 0 : t < SCENE_STARTS[2] ? 1 : t < SCENE_STARTS[3] ? 2 : 3
            if (s !== sceneRef.current) {
              sceneRef.current = s
              setScene(s)
            }
          },
        })
        tlRef.current = tl
        // dev-only handle so the loop can be seeked deterministically in tests
        if (process.env.NODE_ENV !== "production") {
          ;(window as unknown as { __demoTL?: gsap.core.Timeline }).__demoTL = tl
        }

        // ── 0s · reset framing ─────────────────────────────────────────
        tl.set(world, { scale: () => fit().s, x: () => fit().x, y: () => fit().y }, 0)
        tl.fromTo(q(".dm-playhead"), { scaleX: 0 }, { scaleX: 1, duration: TOTAL, ease: "none" }, 0)

        // ── 0.3–4.6s · the agent types ────────────────────────────────
        tl.fromTo(q(".ag-card"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.3)
        tl.set(q(".ag-caret"), { opacity: 1 }, 0.9)
        tl.to(
          typeProxy,
          {
            n: AGENT_COMMAND.length,
            duration: 3.2,
            ease: "none",
            onUpdate: () => {
              if (cmdEl) cmdEl.textContent = AGENT_COMMAND.slice(0, Math.round(typeProxy.n))
            },
          },
          1.2,
        )
        tl.set(q(".ag-caret"), { opacity: 0 }, 4.6)

        // ── 4.7–8s · cursor opens the event selector, clicks the storm ─
        const evTarget = { left: mobile ? "22%" : "13%", top: "26%" }
        tl.fromTo(q(".dm-events"), { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, 4.7)
        tl.fromTo(q(".demo-cursor"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 4.7)
        tl.to(q(".demo-cursor"), { left: evTarget.left, top: evTarget.top, duration: 1.5, ease: "power2.inOut" }, 5.0)
        tl.to(q(".demo-cursor"), { scale: 0.82, duration: 0.18, yoyo: true, repeat: 1 }, 6.6)
        tl.fromTo(
          q(".demo-click"),
          { left: evTarget.left, top: evTarget.top, scale: 0.4, opacity: 0.9 },
          { scale: 1.9, opacity: 0, duration: 0.7 },
          6.6,
        )
        tl.to(q(".dm-evrow-hot"), { backgroundColor: "rgba(236, 72, 153, 0.10)", borderColor: "rgba(236, 72, 153, 0.55)", duration: 0.4 }, 6.7)
        tl.fromTo(q(".dm-sev-fill"), { opacity: 0.15 }, { opacity: 1, duration: 0.25, stagger: 0.12 }, 7.0)
        tl.to(q(".demo-cursor"), { opacity: 0, duration: 0.4 }, 7.6)
        tl.to(q(".dm-events"), { x: -14, opacity: 0, duration: 0.6, ease: "power2.in" }, 7.9)

        // ── 8–15s · fly to KORD, cascade spreads ──────────────────────
        tl.to(q(".st-0"), { opacity: 0, duration: 0.4 }, 8.0)
        tl.to(q(".st-1"), { opacity: 1, duration: 0.4 }, 8.2)
        tl.to(world, {
          scale: () => cam(KORD.x, KORD.y, kordZoom, 0.47, 0.4).scale,
          x: () => cam(KORD.x, KORD.y, kordZoom, 0.47, 0.4).x,
          y: () => cam(KORD.x, KORD.y, kordZoom, 0.47, 0.4).y,
          duration: 2.6,
          ease: "power3.inOut",
        }, 8.0)
        tl.fromTo(q(".ag-line-0"), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.5 }, 8.8)
        tl.to(q(".dm-kord-dot"), { borderColor: "#EC4899", background: "#FCE1EF", duration: 0.5 }, 9.4)
        tl.to(q(".dm-kord-rings"), { opacity: 1, duration: 0.5 }, 9.7)

        tl.fromTo(q(".dm-held"), { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 10.4)
        tl.to(
          heldProxy,
          {
            v: 47,
            duration: 3.2,
            ease: "power1.inOut",
            onUpdate: () => {
              if (heldEl) heldEl.textContent = String(Math.round(heldProxy.v))
            },
          },
          10.4,
        )
        tl.to(q(".dm-c1"), { strokeDashoffset: 0, duration: 1.7, stagger: 0.16, ease: "sine.inOut" }, 10.5)
        tl.to(q('[data-wave="1"] .dm-ap-dot'), { borderColor: "#EFAF1B", background: "#F7EAD5", duration: 0.6, stagger: 0.08 }, 11.4)
        tl.to(q('[data-wave="2"] .dm-ap-dot'), { borderColor: "#EFAF1B", background: "#F7EAD5", duration: 0.6, stagger: 0.08 }, 13.2)
        tl.fromTo(q(".ag-line-1"), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.5 }, 12.9)
        tl.to(world, { x: "-=26", y: "-=12", duration: 6, ease: "none" }, 10.8)

        // ── 15.2–18.4s · four plans, cursor commits B ─────────────────
        tl.to(q(".dm-held"), { opacity: 0, y: -8, duration: 0.6 }, 15.0)
        // x:0 in both states: GSAP parses the React inline translateX(108%)
        // into a PIXEL x cache, which would otherwise survive the xPercent
        // tween and keep the panel offscreen.
        tl.fromTo(q(".dm-plans"), { xPercent: 108, x: 0 }, { xPercent: 0, x: 0, duration: 1.0, ease: "power3.out" }, 15.2)
        tl.fromTo(q(".dm-plan"), { y: 12, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15, duration: 0.6, ease: "power3.out" }, 15.5)
        tl.fromTo(q(".ag-line-2"), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.5 }, 16.1)

        const planTarget = { left: mobile ? "72%" : "84%", top: "36%" }
        tl.set(q(".demo-cursor"), { left: "58%", top: "72%" }, 16.3)
        tl.to(q(".demo-cursor"), { opacity: 1, duration: 0.4 }, 16.4)
        tl.to(q(".demo-cursor"), { left: planTarget.left, top: planTarget.top, duration: 1.3, ease: "power2.inOut" }, 16.5)
        tl.to(q(".demo-cursor"), { scale: 0.82, duration: 0.18, yoyo: true, repeat: 1 }, 17.9)
        tl.fromTo(
          q(".demo-click"),
          { left: planTarget.left, top: planTarget.top, scale: 0.4, opacity: 0.9 },
          { scale: 1.9, opacity: 0, duration: 0.7 },
          17.9,
        )
        tl.to(q(".dm-plan-b"), { borderColor: "#2C49E0", backgroundColor: "rgba(44, 73, 224, 0.08)", duration: 0.4 }, 18.1)
        tl.to(q(".dm-plan:not(.dm-plan-b)"), { opacity: 0.5, duration: 0.5 }, 18.3)
        tl.to(q(".demo-cursor"), { opacity: 0, duration: 0.4 }, 18.9)

        // ── 18.4–25s · commit: metrics, reroutes, toast, pull back ────
        tl.to(q(".st-1"), { opacity: 0, duration: 0.4 }, 18.6)
        tl.to(q(".st-2"), { opacity: 1, duration: 0.4 }, 18.8)
        tl.fromTo(q(".dm-metrics"), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, 18.5)
        tl.to(cxlProxy, {
          v: 3, duration: 3.0, ease: "power1.inOut",
          onUpdate: () => { if (mCxl) mCxl.textContent = String(Math.round(cxlProxy.v)) },
        }, 18.8)
        tl.to(paxProxy, {
          v: 4860, duration: 3.0, ease: "power1.inOut",
          onUpdate: () => { if (mPax) mPax.textContent = Math.round(paxProxy.v).toLocaleString("en-US") },
        }, 18.8)
        tl.to(costProxy, {
          v: 1.7, duration: 3.0, ease: "power1.inOut",
          onUpdate: () => { if (mCost) mCost.textContent = `−$${costProxy.v.toFixed(1)}M` },
        }, 18.8)
        tl.to(q(".dm-rr"), { strokeDashoffset: 0, duration: 1.8, stagger: 0.3, ease: "sine.inOut" }, 18.9)
        tl.to(q(".dm-cascade"), { opacity: 0.22, duration: 1.5 }, 19.0)
        tl.to(q(".dm-ap-dot"), { borderColor: "#7E98A8", background: "#FFFFFF", duration: 1.2, stagger: 0.05 }, 19.8)
        tl.to(q(".dm-ring"), { borderColor: "#2C49E0", duration: 0.6 }, 21.2)
        tl.fromTo(q(".ag-line-3"), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.5 }, 21.9)
        tl.fromTo(q(".dm-toast"), { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, 22.5)
        tl.to(q(".st-2"), { opacity: 0, duration: 0.4 }, 23.0)
        tl.to(q(".st-3"), { opacity: 1, duration: 0.4 }, 23.2)
        // return exactly to the start framing so the loop cuts cleanly
        tl.to(world, {
          scale: () => fit().s,
          x: () => fit().x,
          y: () => fit().y,
          duration: 2.2,
          ease: "power3.inOut",
        }, 22.8)
        tl.set({}, {}, TOTAL)

        // play + fly while on screen, pause + halt off screen
        const st = ScrollTrigger.create({
          trigger: root,
          start: "top 75%",
          end: "bottom 25%",
          onToggle: (self) => {
            if (self.isActive) {
              tl.play()
              startFlights()
            } else {
              tl.pause()
              stopFlights()
            }
          },
        })

        const onResize = () => tl.invalidate()
        window.addEventListener("resize", onResize)

        return () => {
          window.removeEventListener("resize", onResize)
          stopFlights()
          st.kill()
          tl.kill()
          if (tlRef.current === tl) tlRef.current = null
        }
      },
      root,
    )

    return () => mm.revert()
  }, [staticMode])

  const seekTo = (i: number) => {
    const tl = tlRef.current
    if (!tl) return
    tl.play(SCENE_STARTS[i] + 0.05)
  }

  return (
    <section
      id="demo"
      ref={rootRef}
      aria-label="Simulator demo"
      style={{ position: "relative", padding: "clamp(80px, 11vh, 140px) clamp(16px, 3.5vw, 48px)" }}
    >
      <div
        className="dm-stage-grid"
        style={{
          width: "100%",
          maxWidth: 1560,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(240px, 300px) minmax(0, 1fr)",
          gap: "clamp(24px, 3vw, 48px)",
          alignItems: "center",
        }}
      >
        {/* caption rail — auto-advances with playback; click to seek */}
        <aside className="dm-captions">
          <span className="lp-eyebrow" style={{ display: "block", marginBottom: 20 }}>
            02 — One recovery loop
          </span>
          <div className="dm-step-list" style={{ display: "grid", gap: 4 }}>
            {DEMO_STEPS.map((s, i) => {
              const active = staticMode || scene === i
              return (
                <button
                  key={s.n}
                  className="dm-step"
                  onClick={() => !staticMode && seekTo(i)}
                  style={{
                    borderColor: active ? "var(--accent-amber)" : "var(--border)",
                    cursor: staticMode ? "default" : "pointer",
                    opacity: active ? 1 : 0.45,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span className="lp-eyebrow" style={{ color: active ? "var(--accent-amber)" : undefined }}>{s.n}</span>
                    <span
                      className="ed-display"
                      style={{ fontSize: "clamp(20px, 1.8vw, 27px)", letterSpacing: "-0.02em" }}
                    >
                      {s.title}
                    </span>
                  </span>
                  <span
                    className="dm-step-body"
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: "var(--muted)",
                      maxWidth: 260,
                    }}
                  >
                    {s.body}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* the console — one-shot entrance, then the loop plays inside */}
        <motion.div
          style={{ perspective: 1600 }}
          initial={reduce || staticMode ? false : { opacity: 0, y: 48, rotateX: 7 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.0, ease: EASE }}
        >
          <div
            className="demo-screen dm-frame"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "clamp(400px, 68vh, 720px)",
            }}
          >
            {/* top bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 14px",
                height: 42,
                borderBottom: "1px solid var(--dk-line)",
                background: "var(--dk-panel)",
                flexShrink: 0,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <AeolusMark size={16} style={{ color: "var(--dk-text)" }} />
                <span className="demo-chrome-label" style={{ color: "var(--dk-text)" }}>Aeolus OCC</span>
              </span>
              <span className="demo-chrome-label lp-hide-mobile">Nimbus Air · 202 flights</span>
              <span className="demo-chrome-label" style={{ marginLeft: "auto" }}>14:31Z</span>
              <span style={{ position: "relative", width: 86, height: 16 }}>
                {STATUS.map((s, i) => (
                  <span
                    key={s.label}
                    className={`st-${i} demo-chrome-label`}
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      color: s.color,
                      borderBottom: `2px solid ${s.color}`,
                      paddingBottom: 2,
                      opacity: staticMode ? (i === 3 ? 1 : 0) : i === 0 ? 1 : 0,
                    }}
                  >
                    {s.label}
                  </span>
                ))}
              </span>
            </div>

            {/* body */}
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              {/* icon rail */}
              <div
                className="lp-hide-mobile"
                style={{
                  width: 46,
                  borderRight: "1px solid var(--dk-line)",
                  background: "var(--dk-panel)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  paddingTop: 12,
                  flexShrink: 0,
                }}
              >
                {RAIL_ICONS.map((Icon, i) => {
                  const active = RAIL_ACTIVE[staticMode ? 3 : scene] === i
                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-flex",
                        padding: 7,
                        borderRadius: 8,
                        color: active ? "var(--dk-teal)" : "var(--dk-muted)",
                        background: active ? "rgba(44, 73, 224, 0.10)" : "transparent",
                        transition: "color 300ms ease, background 300ms ease",
                      }}
                    >
                      <Icon style={{ width: 15, height: 15 }} strokeWidth={1.75} />
                    </span>
                  )
                })}
              </div>

              {/* map canvas */}
              <div className="dm-canvas" style={{ position: "relative", flex: 1, overflow: "hidden", minWidth: 0 }}>
                <DemoMap staticMode={staticMode} />

                {/* event selector */}
                <div
                  className="demo-card dm-events"
                  style={{
                    position: "absolute",
                    left: 14,
                    top: 14,
                    zIndex: 25,
                    width: 216,
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.96)",
                    boxShadow: "0 8px 28px rgba(11, 36, 52, 0.12)",
                    opacity: 0,
                    visibility: staticMode ? "hidden" : undefined,
                  }}
                >
                  <span className="demo-chrome-label" style={{ display: "block", marginBottom: 10 }}>
                    Trigger event
                  </span>
                  <div style={{ display: "grid", gap: 5 }}>
                    {EVENT_ROWS.map((r, i) => (
                      <span
                        key={r.label}
                        className={r.hot ? "dm-evrow-hot" : undefined}
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 9,
                          padding: "7px 9px",
                          borderRadius: 7,
                          border: "1px solid transparent",
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--dk-text)",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--ae-font-mono)",
                            fontSize: 9.5,
                            letterSpacing: "0.06em",
                            color: "var(--dk-muted)",
                            width: 16,
                            flexShrink: 0,
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {r.label}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
                    <span className="demo-chrome-label">Severity</span>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={n <= 4 ? "dm-sev-fill" : undefined}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 3,
                            background: n <= 4 ? "var(--dk-rose)" : "rgba(11, 36, 52, 0.12)",
                            opacity: n <= 4 ? 0.15 : 1,
                          }}
                        />
                      ))}
                    </span>
                  </div>
                </div>

                {/* departures-held chip */}
                <div
                  className="demo-card dm-held"
                  style={{
                    position: "absolute",
                    top: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 26,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 14px",
                    background: "rgba(255, 255, 255, 0.96)",
                    borderColor: "rgba(236, 72, 153, 0.45)",
                    boxShadow: "0 8px 28px rgba(11, 36, 52, 0.10)",
                    opacity: 0,
                    visibility: staticMode ? "hidden" : undefined,
                  }}
                >
                  <span className="demo-chrome-label" style={{ color: "var(--dk-rose)" }}>
                    Departures held
                  </span>
                  <span
                    className="dm-held-n"
                    style={{ fontFamily: "var(--ae-font-mono)", fontSize: 15, fontWeight: 600, color: "var(--dk-text)" }}
                  >
                    0
                  </span>
                </div>

                {/* toast */}
                <div
                  className="demo-card dm-toast"
                  style={{
                    position: "absolute",
                    top: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 27,
                    padding: "9px 16px",
                    background: "rgba(255, 255, 255, 0.96)",
                    borderColor: "rgba(44, 73, 224, 0.5)",
                    boxShadow: "0 8px 28px rgba(11, 36, 52, 0.10)",
                    fontSize: 12.5,
                    fontWeight: 550,
                    whiteSpace: "nowrap",
                    color: "var(--dk-text)",
                    opacity: staticMode ? 1 : 0,
                  }}
                >
                  Recovery plan applied
                  <span style={{ color: "var(--dk-muted)", fontWeight: 450 }}> — 118 actions committed</span>
                </div>

                <AgentCommandDemo staticMode={staticMode} />

                {/* plan inspector */}
                <div
                  className="dm-plans"
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 28,
                    width: "min(238px, 52%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.97)",
                    borderLeft: "1px solid var(--dk-line)",
                    transform: staticMode ? undefined : "translateX(108%)",
                    overflow: "hidden",
                  }}
                >
                  <span className="demo-chrome-label">Recovery plans · A–D</span>
                  <div style={{ display: "grid", gap: 7 }}>
                    {PLANS.map((p) => (
                      <div
                        key={p.id}
                        className={`dm-plan${p.id === "B" ? " dm-plan-b" : ""}`}
                        style={{
                          border: `1px solid ${staticMode && p.id === "B" ? "#2C49E0" : "var(--dk-line)"}`,
                          background: staticMode && p.id === "B" ? "rgba(44, 73, 224, 0.08)" : "var(--dk-panel-2)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          opacity: staticMode ? (p.id === "B" ? 1 : 0.55) : 0,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontFamily: "var(--ae-font-display)", fontWeight: 700, fontSize: 14, color: "var(--dk-text)" }}>
                            {p.id}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--dk-muted)", fontWeight: 500 }}>{p.objective}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            marginTop: 4,
                            fontFamily: "var(--ae-font-mono)",
                            fontSize: 10.5,
                            color: "var(--dk-text)",
                          }}
                        >
                          <span>{p.cost}</span>
                          <span style={{ color: "var(--dk-muted)" }}>{p.cxl}</span>
                          <span style={{ color: "var(--dk-teal)" }}>{p.flags}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* committed metrics */}
                  <div
                    className="dm-metrics"
                    style={{
                      marginTop: "auto",
                      borderTop: "1px solid var(--dk-line)",
                      paddingTop: 10,
                      display: "grid",
                      gap: 6,
                      opacity: staticMode ? 1 : 0,
                    }}
                  >
                    <span className="demo-chrome-label" style={{ color: "var(--dk-teal)" }}>
                      Plan B — committed
                    </span>
                    {[
                      ["Cancellations", <span key="v" className="dm-m-cxl">{staticMode ? "3" : "16"}</span>, "was 16"],
                      ["Pax reaccommodated", <span key="v" className="dm-m-pax">{staticMode ? "4,860" : "0"}</span>, ""],
                      ["Crew legality", <span key="v">0 flags</span>, "FAR 117"],
                      ["Cost vs no action", <span key="v" className="dm-m-cost">{staticMode ? "−$1.7M" : "−$0.0M"}</span>, ""],
                    ].map(([label, value, note], i) => (
                      <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 11 }}>
                        <span style={{ color: "var(--dk-muted)", fontWeight: 500 }}>{label}</span>
                        <span
                          style={{
                            marginLeft: "auto",
                            fontFamily: "var(--ae-font-mono)",
                            fontSize: 11.5,
                            color: "var(--dk-text)",
                          }}
                        >
                          {value}
                        </span>
                        {note ? (
                          <span style={{ fontFamily: "var(--ae-font-mono)", fontSize: 9.5, color: "var(--dk-muted)" }}>{note}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <CursorChoreography staticMode={staticMode} />
              </div>
            </div>

            {/* bottom timeline — doubles as the video's progress bar */}
            <div
              style={{
                position: "relative",
                height: 30,
                borderTop: "1px solid var(--dk-line)",
                background: "var(--dk-panel)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
                flexShrink: 0,
              }}
            >
              {["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"].map((t) => (
                <span key={t} className="demo-chrome-label" style={{ fontSize: 9 }}>
                  {t}
                </span>
              ))}
              <span
                className="dm-playhead"
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  height: 2,
                  width: "100%",
                  background: "var(--dk-teal)",
                  transformOrigin: "0 50%",
                  transform: staticMode ? undefined : "scaleX(0)",
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
