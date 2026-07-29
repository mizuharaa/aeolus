"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  CloudLightning,
  CloudOff,
  Mountain,
  ShieldAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { GLOBE_EVENTS, type GlobeEvent, type GlobeEventKind } from "@/components/landing/earth-globe-3d"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"
import { HighlightSwipe, SplitReveal } from "@/components/landing/type-fx"

const EarthGlobe3D = dynamic(
  () => import("@/components/landing/earth-globe-3d").then((module) => module.EarthGlobe3D),
  { ssr: false },
)

const EVENT_ICONS: Record<GlobeEventKind, LucideIcon> = {
  closure: CloudOff,
  storm: CloudLightning,
  cyber: ShieldAlert,
  ash: Mountain,
  crew: UsersRound,
}

function EventFeedButton({
  event,
  active,
  onSelect,
}: {
  event: GlobeEvent
  active: boolean
  onSelect: (event: GlobeEvent) => void
}) {
  const Icon = EVENT_ICONS[event.kind]

  return (
    <button
      type="button"
      className="ae-event-feed-button"
      data-tone={event.tone}
      data-active={active}
      aria-pressed={active}
      onClick={() => onSelect(event)}
    >
      <Icon aria-hidden size={18} strokeWidth={1.8} />
      <span>
        <b>{event.title}</b>
        <small>
          {event.airport} · {event.city}
        </small>
      </span>
      <i aria-hidden>{active ? "Viewing" : "Trigger"}</i>
    </button>
  )
}

export function LiveGlobeStage() {
  const rootRef = useRef<HTMLElement>(null)
  const pauseUntilRef = useRef(0)
  const feedInteractingRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [globeReady, setGlobeReady] = useState(false)
  const [eventsActive, setEventsActive] = useState(false)
  const activeEvent = GLOBE_EVENTS[activeIndex]
  const markGlobeReady = useCallback(() => setGlobeReady(true), [])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEventsActive(true)
    }
  }, [])

  const selectEvent = useCallback((event: GlobeEvent) => {
    const next = GLOBE_EVENTS.findIndex((item) => item.id === event.id)
    if (next < 0) return
    pauseUntilRef.current = Date.now() + 12_000
    setEventsActive(true)
    setActiveIndex(next)
  }, [])

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced || !eventsActive) return

    const timer = window.setInterval(() => {
      if (feedInteractingRef.current || Date.now() < pauseUntilRef.current) return
      setActiveIndex((index) => (index + 1) % GLOBE_EVENTS.length)
    }, 6_400)

    return () => window.clearInterval(timer)
  }, [eventsActive])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const mm = gsap.matchMedia()
    mm.add(
      "(min-width: 40rem) and (prefers-reduced-motion: no-preference)",
      () => {
        const copy = root.querySelector(".ae-globe-copy")
        const orbit = root.querySelector(".ae-globe-orbit")
        const eventCopy = root.querySelector(".ae-globe-event-copy")
        const notification = root.querySelector(".ae-globe-notification")
        const feed = root.querySelector(".ae-event-feed")
        const dashboard = root.querySelector(".ae-globe-dashboard")
        const cue = root.querySelector(".ae-globe-cue")
        if (!copy || !orbit || !eventCopy || !notification || !feed || !dashboard) return

        let activated = false

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "+=165%",
            scrub: 0.45,
            pin: root.querySelector(".ae-globe-pin"),
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const next = self.progress >= 0.26
              if (next === activated) return
              activated = next
              setEventsActive(next)
            },
          },
        })

        timeline
          .to(copy, { yPercent: -14, opacity: 0, duration: 0.16 }, 0.08)
          .to(orbit, { xPercent: -39, yPercent: 3, scale: 1.12, duration: 0.38 }, 0.04)
          .fromTo(
            eventCopy,
            { yPercent: 18, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.12 },
            0.24,
          )
          .fromTo(
            notification,
            { yPercent: 18, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.1 },
            0.3,
          )
          .fromTo(feed, { xPercent: 10, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.12 }, 0.3)
          .fromTo(dashboard, { yPercent: 16, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.12 }, 0.34)
          .to({}, { duration: 0.22 }, 0.46)

        if (cue) timeline.to(cue, { opacity: 0, duration: 0.18 }, 0.2)

        return () => {
          setEventsActive(false)
          timeline.scrollTrigger?.kill()
          timeline.kill()
        }
      },
    )

    mm.add(
      "(max-width: 39.99rem) and (prefers-reduced-motion: no-preference)",
      () => {
        const trigger = ScrollTrigger.create({
          trigger: root,
          start: "top 45%",
          onEnter: () => setEventsActive(true),
          onEnterBack: () => setEventsActive(true),
          onLeaveBack: () => setEventsActive(false),
        })
        return () => trigger.kill()
      },
    )

    return () => mm.revert()
  }, [])

  return (
    <section
      id="network"
      ref={rootRef}
      className="ae-globe-section"
      data-events-active={eventsActive}
      aria-label="Live simulated network events"
    >
      <div className="ae-globe-pin">
        <div className="ae-globe-surface" aria-hidden />

        <div className="ae-globe-copy">
          <span className="ae-live-label">Simulated live · event theatre</span>
          <SplitReveal
            as="h2"
            className="ae-globe-title"
            mode="reversible"
            start="top 82%"
            stagger={0.075}
          >
            Airline recovery,
            <em className="ed-serif ae-globe-script">
              {" "}
              <HighlightSwipe coverage={1} height="62%">
                simulated live.
              </HighlightSwipe>
            </em>
          </SplitReveal>
          <p>
            Trigger one disruption and watch its operational footprint touch the
            planet. The globe shows local weather, cyber, ash, hub and crew effects
            — not a decorative route-node layer.
          </p>
          <div className="ae-globe-actions">
            <Link href="/simulator" className="lp-btn lp-btn--amber">
              Launch simulator
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
            <a href="#demo" className="ae-type-link">
              Watch recovery
              <ArrowDown aria-hidden size={16} strokeWidth={2} />
            </a>
          </div>
        </div>

        <div className="ae-globe-event-copy" aria-live="polite">
          <div key={activeEvent.id} className="ae-event-copy-swap">
            <span className="ae-live-label">
              Active scenario · {activeEvent.airport}
            </span>
            <h3>
              {activeEvent.title}
              <span>{activeEvent.city}</span>
            </h3>
            <p>
              {activeEvent.effect}. {activeEvent.response}.
            </p>
          </div>
        </div>

        <div className="ae-globe-orbit" data-ready={globeReady}>
          <div className="ae-globe-fallback" aria-hidden>
            <span />
          </div>
          <EarthGlobe3D
            activeEvent={activeEvent}
            eventsActive={eventsActive}
            onReady={markGlobeReady}
          />
          <div
            className="ae-globe-notification"
            data-active={eventsActive}
            role="status"
            aria-live="off"
          >
            <div key={activeEvent.id} className="ae-event-notification-swap">
              <span data-tone={activeEvent.tone}>{activeEvent.title}</span>
              <strong>
                {activeEvent.airport} · {activeEvent.city}
              </strong>
              <p>{activeEvent.effect}</p>
              <small>{activeEvent.response}</small>
            </div>
          </div>
          <span className="ae-globe-drag-hint">Drag to inspect</span>
        </div>

        <aside
          className="ae-event-feed"
          aria-label="Synthetic event feed"
          onPointerEnter={() => {
            feedInteractingRef.current = true
          }}
          onPointerLeave={(event) => {
            if (!event.currentTarget.contains(document.activeElement)) {
              feedInteractingRef.current = false
            }
          }}
          onFocusCapture={() => {
            feedInteractingRef.current = true
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              feedInteractingRef.current = false
            }
          }}
        >
          <header>
            <span>Synthetic event feed</span>
            <b>Watching</b>
          </header>
          <div>
            {GLOBE_EVENTS.map((event) => (
              <EventFeedButton
                key={event.id}
                event={event}
                active={event.id === activeEvent.id}
                onSelect={selectEvent}
              />
            ))}
          </div>
        </aside>

        <div className="ae-globe-dashboard" aria-label="Simulation model coverage">
          <span>
            <b>05</b>
            event classes
          </span>
          <span>
            <b>04</b>
            recovery plans
          </span>
          <span>
            <b>01</b>
            shared scenario clock
          </span>
          <p>Illustrative events · no claim of current real-world disruption</p>
        </div>

        <span className="ae-globe-cue" aria-hidden>
          Scroll to open the global view
          <ArrowDown size={15} strokeWidth={1.8} />
        </span>
      </div>
      <div className="ae-globe-exit" aria-hidden />
    </section>
  )
}
