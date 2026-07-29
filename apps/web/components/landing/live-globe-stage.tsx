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
import {
  GLOBE_EVENTS,
  globeEventRuntime,
  setGlobeEventIndex,
  type GlobeEvent,
  type GlobeEventKind,
} from "@/components/landing/earth-globe-3d"
import { gsap, ScrollTrigger } from "@/components/landing/gsap"
import { HighlightSwipe, SplitReveal } from "@/components/landing/type-fx"
import {
  landingScroll,
  registerLandingFrame,
  resetLandingScene,
  setLandingSceneActive,
} from "@/lib/scroll"

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
  eventIndex,
  onSelect,
}: {
  event: GlobeEvent
  eventIndex: number
  onSelect: (eventIndex: number) => void
}) {
  const Icon = EVENT_ICONS[event.kind]
  const active = eventIndex === 0

  return (
    <button
      type="button"
      className="ae-event-feed-button"
      data-event-button
      data-event-index={eventIndex}
      data-tone={event.tone}
      data-active={active}
      aria-pressed={active}
      onClick={() => onSelect(eventIndex)}
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

function syncEventUi(root: HTMLElement) {
  const activeIndex = globeEventRuntime.activeIndex
  root.dataset.activeEvent = String(activeIndex)

  root.querySelectorAll<HTMLElement>("[data-event-button]").forEach((element) => {
    const active = Number(element.dataset.eventIndex) === activeIndex
    element.dataset.active = String(active)
    element.setAttribute("aria-pressed", String(active))
    const status = element.querySelector("i")
    if (status) status.textContent = active ? "Viewing" : "Trigger"
  })

  root.querySelectorAll<HTMLElement>("[data-event-view]").forEach((element) => {
    const active = Number(element.dataset.eventIndex) === activeIndex
    element.hidden = !active
    element.dataset.active = String(active)
  })
}

export function LiveGlobeStage() {
  const rootRef = useRef<HTMLElement>(null)
  const pauseUntilRef = useRef(0)
  const feedInteractingRef = useRef(false)
  const lastEventVersionRef = useRef(globeEventRuntime.version)
  const [globeReady, setGlobeReady] = useState(false)
  const markGlobeReady = useCallback(() => setGlobeReady(true), [])

  const selectEvent = useCallback((next: number) => {
    pauseUntilRef.current = Date.now() + 12_000
    setGlobeEventIndex(next)
    if (rootRef.current) syncEventUi(rootRef.current)
  }, [])

  useEffect(() => {
    if (rootRef.current) syncEventUi(rootRef.current)
    const timer = window.setInterval(() => {
      if (
        landingScroll.reducedMotion ||
        landingScroll.scenes.globe < 0.26
      ) {
        return
      }
      if (feedInteractingRef.current || Date.now() < pauseUntilRef.current) return
      setGlobeEventIndex(globeEventRuntime.activeIndex + 1)
      if (rootRef.current) syncEventUi(rootRef.current)
    }, 6_400)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return registerLandingFrame(() => {
      if (lastEventVersionRef.current !== globeEventRuntime.version) {
        lastEventVersionRef.current = globeEventRuntime.version
        syncEventUi(root)
      }
      const eventsActive =
        landingScroll.reducedMotion || landingScroll.scenes.globe >= 0.26
      root.dataset.eventsActive = String(eventsActive)
      const notification = root.querySelector<HTMLElement>(
        ".ae-globe-notification",
      )
      if (notification) {
        notification.dataset.active = String(eventsActive)
      }
    })
  }, [])

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

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "+=165%",
            scrub: 1.2,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
            onToggle: (self) => {
              setLandingSceneActive("globe", self.isActive)
            },
            onEnterBack: () => setLandingSceneActive("globe", true),
            onLeave: () => setLandingSceneActive("globe", false),
            onLeaveBack: () => setLandingSceneActive("globe", false),
          },
        })

        timeline
          .to(landingScroll.scenes, { globe: 1, duration: 1 }, 0)
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
          timeline.scrollTrigger?.kill()
          timeline.kill()
          resetLandingScene("globe")
          setLandingSceneActive("globe", false)
        }
      },
    )

    mm.add(
      "(max-width: 39.99rem) and (prefers-reduced-motion: no-preference)",
      () => {
        const tween = gsap.fromTo(
          landingScroll.scenes,
          { globe: 0 },
          {
            globe: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: "+=130%",
              scrub: 1.2,
              pin: true,
              pinSpacing: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              fastScrollEnd: true,
              onToggle: (self) =>
                setLandingSceneActive("globe", self.isActive),
              onLeave: () => setLandingSceneActive("globe", false),
              onEnterBack: () => setLandingSceneActive("globe", true),
              onLeaveBack: () => setLandingSceneActive("globe", false),
            },
          },
        )
        return () => {
          tween.kill()
          resetLandingScene("globe")
          setLandingSceneActive("globe", false)
        }
      },
    )

    mm.add("(prefers-reduced-motion: reduce)", () => {
      landingScroll.scenes.globe = 1
      const trigger = ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "bottom top",
        invalidateOnRefresh: true,
        fastScrollEnd: true,
        onToggle: (self) => {
          setLandingSceneActive("globe", self.isActive)
        },
      })
      return () => {
        trigger.kill()
        setLandingSceneActive("globe", false)
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <section
      id="network"
      ref={rootRef}
      className="ae-globe-section"
      data-events-active="false"
      aria-label="Live simulated network events"
      tabIndex={0}
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
              <HighlightSwipe coverage={1} height="94%">
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
          {GLOBE_EVENTS.map((event, eventIndex) => (
            <div
              key={event.id}
              className="ae-event-copy-swap"
              data-event-view
              data-event-index={eventIndex}
              data-active={eventIndex === 0}
              data-tone={event.tone}
              hidden={eventIndex !== 0}
            >
              <span className="ae-live-label">
                Active scenario · {event.airport}
              </span>
              <h3>
                {event.title}
                <span>{event.city}</span>
              </h3>
              <p>
                {event.effect}. {event.response}.
              </p>
            </div>
          ))}
        </div>

        <div className="ae-globe-orbit" data-ready={globeReady}>
          <div className="ae-globe-fallback" aria-hidden>
            <span />
          </div>
          <EarthGlobe3D onReady={markGlobeReady} />
          <div
            className="ae-globe-notification"
            data-active="false"
            role="status"
            aria-live="off"
          >
            {GLOBE_EVENTS.map((event, eventIndex) => (
              <div
                key={event.id}
                className="ae-event-notification-swap"
                data-event-view
                data-event-index={eventIndex}
                data-active={eventIndex === 0}
                hidden={eventIndex !== 0}
              >
                <span data-tone={event.tone}>{event.title}</span>
                <strong>
                  {event.airport} · {event.city}
                </strong>
                <p>{event.effect}</p>
                <small>{event.response}</small>
              </div>
            ))}
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
            {GLOBE_EVENTS.map((event, eventIndex) => (
              <EventFeedButton
                key={event.id}
                event={event}
                eventIndex={eventIndex}
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
