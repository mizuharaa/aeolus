"use client"
/**
 * RecoveryLoop — the pinned scroll story, rebuilt in 3D.
 *
 * The old 2D console map is gone: the story stage is the same world globe
 * as the hero in "story" mode. A 480vh scroll region drives a scrubbed
 * phase value 0..4 straight into the scene (rotate/zoom onto the US
 * network → KORD goes pink and its flights ground → dashed ghost plans
 * shimmer → the network re-routes teal). The caption rail narrates and is
 * clickable; plan chips surface in the DOM at the solve/commit beats.
 *
 * Mobile / reduced-motion: no pinning — a segmented control steps the
 * phase directly.
 */

import dynamic from "next/dynamic"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { c, ff } from "@/lib/design-tokens"
import { gsap, ScrollTrigger } from "./gsap"

const GlobeCanvas = dynamic(() => import("./globe").then((m) => m.GlobeCanvas), {
  ssr: false,
})

const STEPS = [
  {
    index: "01",
    kicker: "Monitor",
    title: "A full airline, live.",
    body: "202 flights, 40 aircraft, 15 airports — every rotation tracked in real time against the schedule.",
  },
  {
    index: "02",
    kicker: "Disrupt",
    title: "A hub drops out.",
    body: "A storm shuts Chicago O’Hare. 47 departures stop, and the delay starts cascading into every connecting rotation.",
  },
  {
    index: "03",
    kicker: "Solve",
    title: "Four plans. 8 ms.",
    body: "The optimizer returns four ranked recovery plans — cheapest, kindest to passengers, safest for tomorrow, lowest carbon.",
  },
  {
    index: "04",
    kicker: "Commit",
    title: "The cascade stops.",
    body: "Apply a plan and the network heals: 3 cancellations instead of 16, zero crew violations, every trade-off inspectable.",
  },
] as const

const PLAN_CHIPS = [
  { id: "A", name: "Min cost", cost: "$1.9M", note: "11 cxl" },
  { id: "B", name: "Min pax impact", cost: "$2.4M", note: "3 cxl" },
  { id: "C", name: "Protect tomorrow", cost: "$2.7M", note: "5 cxl" },
  { id: "D", name: "Min carbon", cost: "$2.2M", note: "8 cxl" },
]

// mid-scene phase values used by the tabbed (mobile) variant
const SCENE_PHASE = [0.5, 1.8, 2.6, 3.85]

function useIsCompact() {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)")
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return compact
}

// ── Caption rail ─────────────────────────────────────────────────────────
function CaptionRail({
  scene,
  onSelect,
}: {
  scene: number
  onSelect?: (i: number) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontFamily: ff.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.16em",
          textTransform: "uppercase", color: c.skyInk, marginBottom: 20,
        }}
      >
        The recovery loop
      </span>
      {STEPS.map((s, i) => {
        const active = i === scene
        const disrupt = i === 1
        return (
          <button
            key={s.index}
            onClick={() => onSelect?.(i)}
            style={{
              all: "unset",
              cursor: onSelect ? "pointer" : "default",
              padding: "16px 0 16px 20px",
              borderLeft: `3px solid ${active ? (disrupt ? "var(--ae-rose)" : "var(--ae-teal)") : "var(--ae-line)"}`,
              opacity: active ? 1 : 0.42,
              transition: "opacity 380ms ease, border-color 380ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: ff.mono, fontSize: 12, fontWeight: 600, color: active ? (disrupt ? c.roseInk : c.tealInk) : c.muted }}>
                {s.index}
              </span>
              <span
                className="punch punch--ink"
                style={{ fontSize: "clamp(22px, 2.2vw, 32px)", textTransform: "none", letterSpacing: "-0.02em" }}
              >
                {s.title}
              </span>
            </div>
            <p style={{ fontFamily: ff.body, fontSize: 13.5, lineHeight: 1.6, color: c.body, margin: "8px 0 0", maxWidth: 330 }}>
              {s.body}
            </p>
          </button>
        )
      })}
    </div>
  )
}

// ── Plan chips overlay (solve + commit beats) ───────────────────────────
function PlanOverlay({ scene }: { scene: number }) {
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, bottom: 18,
        display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap",
        pointerEvents: "none", zIndex: 5, padding: "0 12px",
      }}
    >
      <AnimatePresence mode="popLayout">
        {scene === 2 &&
          PLAN_CHIPS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, y: 14, transition: { duration: 0.25 } }}
              style={{
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${p.id === "B" ? "var(--ae-teal)" : "var(--ae-line)"}`,
                borderRadius: 12,
                padding: "10px 14px",
                boxShadow: "0 10px 32px rgba(11,36,52,0.14)",
                display: "flex", alignItems: "baseline", gap: 10,
                fontFamily: ff.body,
              }}
            >
              <span style={{ fontFamily: ff.mono, fontSize: 12, fontWeight: 600, color: p.id === "B" ? c.tealInk : c.muted }}>
                {p.id}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>{p.name}</span>
              <span style={{ fontFamily: ff.mono, fontSize: 12, color: c.body }}>{p.cost}</span>
              <span style={{ fontFamily: ff.mono, fontSize: 11.5, color: c.muted }}>{p.note}</span>
            </motion.div>
          ))}

        {scene === 3 && (
          <motion.div
            key="committed"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, y: 14, transition: { duration: 0.25 } }}
            style={{
              background: "var(--ae-teal)",
              color: "#FFFFFF",
              borderRadius: 12,
              padding: "12px 20px",
              boxShadow: "0 12px 40px rgba(13,148,136,0.4)",
              display: "flex", alignItems: "baseline", gap: 12,
              fontFamily: ff.body, fontSize: 13.5, fontWeight: 600,
            }}
          >
            Plan B committed
            <span style={{ fontFamily: ff.mono, fontSize: 12, fontWeight: 500, opacity: 0.9 }}>
              118 actions · 480 connections saved
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Pinned (desktop) variant ─────────────────────────────────────────────
function PinnedLoop() {
  const rootRef = useRef<HTMLElement>(null)
  const phaseRef = useRef(0)
  const [scene, setScene] = useState(0)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress * 4
          phaseRef.current = p
          const s = Math.min(3, Math.floor(p))
          setScene((prev) => (prev === s ? prev : s))
        },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  const scrollToScene = (i: number) => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const start = window.scrollY + rect.top
    const range = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: start + ((i + 0.5) / 4) * range, behavior: "smooth" })
  }

  return (
    <section
      id="loop"
      ref={rootRef}
      style={{ height: "480vh", position: "relative" }}
      aria-label="The recovery loop"
    >
      <div
        style={{
          position: "sticky", top: 0, height: "100vh",
          display: "flex", alignItems: "center", overflow: "hidden",
        }}
      >
        {/* soft sky wash behind the stage */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(58% 68% at 68% 50%, rgba(56,189,248,0.16) 0%, rgba(56,189,248,0) 70%)",
          }}
        />
        <div style={{ width: "100%", maxWidth: 1480, margin: "0 auto", padding: "0 40px", position: "relative" }}>
          <div className="lp-story-grid">
            <CaptionRail scene={scene} onSelect={scrollToScene} />
            <div style={{ position: "relative", height: "min(78vh, 760px)" }}>
              <GlobeCanvas
                mode="story"
                phaseRef={phaseRef}
                style={{ position: "absolute", inset: 0 }}
              />
              <PlanOverlay scene={scene} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Tabbed (mobile / reduced-motion) variant ─────────────────────────────
function TabbedLoop() {
  const phaseRef = useRef(SCENE_PHASE[0])
  const [scene, setScene] = useState(0)
  const active = STEPS[scene]

  const select = (i: number) => {
    setScene(i)
    phaseRef.current = SCENE_PHASE[i]
  }

  return (
    <section id="loop" style={{ padding: "72px 20px" }} aria-label="The recovery loop">
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <span
          style={{
            fontFamily: ff.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.16em",
            textTransform: "uppercase", color: c.skyInk,
          }}
        >
          The recovery loop
        </span>
        <div style={{ display: "flex", gap: 8, margin: "20px 0 16px", flexWrap: "wrap" }}>
          {STEPS.map((s, i) => {
            const on = i === scene
            return (
              <button
                key={s.index}
                onClick={() => select(i)}
                style={{
                  fontFamily: ff.body, fontSize: 12.5, fontWeight: 550,
                  padding: "7px 13px", borderRadius: 999, cursor: "pointer",
                  background: on ? "var(--ae-teal-bg)" : "transparent",
                  border: `1px solid ${on ? "var(--ae-teal)" : "var(--ae-line)"}`,
                  color: on ? c.tealInk : c.body,
                  transition: "all 200ms ease",
                }}
              >
                {s.kicker}
              </button>
            )
          })}
        </div>
        <h3 className="punch punch--ink" style={{ fontSize: 30, textTransform: "none", margin: "0 0 8px" }}>
          {active.title}
        </h3>
        <p style={{ fontFamily: ff.body, fontSize: 13.5, lineHeight: 1.6, color: c.body, maxWidth: 560, margin: "0 0 12px" }}>
          {active.body}
        </p>
        <div style={{ position: "relative", height: "min(70vw, 440px)" }}>
          <GlobeCanvas mode="story" phaseRef={phaseRef} style={{ position: "absolute", inset: 0 }} />
          <PlanOverlay scene={scene} />
        </div>
      </div>
    </section>
  )
}

export function RecoveryLoop() {
  const compact = useIsCompact()
  const reduce = useReducedMotion()
  if (compact || reduce) return <TabbedLoop />
  return <PinnedLoop />
}
