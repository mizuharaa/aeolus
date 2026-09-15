"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useNearViewport } from "@/lib/use-near-viewport"
import { gsap } from "./gsap"
import s from "./recovery-story.module.css"

const Scene = dynamic(() => import("./network-scene"), { ssr: false })
export const hubs = [
  { id: "ATL", name: "Atlanta", lat: 33.64, lon: -84.43, flights: 214, affected: 12, issue: "Thunderstorm across the afternoon departure bank." },
  { id: "DFW", name: "Dallas–Fort Worth", lat: 32.9, lon: -97.04, flights: 186, affected: 8, issue: "Wind shear reduces the arrival rate." },
  { id: "ORD", name: "Chicago O’Hare", lat: 41.98, lon: -87.9, flights: 192, affected: 24, issue: "Deicing queues constrain aircraft turnarounds." },
  { id: "LHR", name: "London Heathrow", lat: 51.47, lon: -.45, flights: 148, affected: 6, issue: "Late arrivals compress the remaining crew duty window." },
  { id: "NRT", name: "Tokyo Narita", lat: 35.77, lon: 140.39, flights: 96, affected: 4, issue: "An aircraft inspection affects the next rotation." },
  { id: "SYD", name: "Sydney", lat: -33.94, lon: 151.18, flights: 82, affected: 5, issue: "A delayed inbound approaches the night curfew." },
  { id: "GRU", name: "São Paulo", lat: -23.43, lon: -46.47, flights: 104, affected: 7, issue: "Ground congestion delays the evening bank." },
] as const

export function NetworkGlobe() {
  const ref = useRef<HTMLElement>(null)
  const near = useNearViewport(ref, "700px 0px")
  const [reduced, setReduced] = useState(true)
  const [paused, setPaused] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const progress = useRef({ value: 0, velocity: 0 })
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches || (navigator as Navigator & { deviceMemory?: number }).deviceMemory! < 4)
    update(); mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    if (!near) return
    const mm = gsap.matchMedia()
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(progress.current, { value: 1, ease: "none", scrollTrigger: { trigger: ref.current, start: "top 75%", end: "top -35%", scrub: .8, onUpdate: self => { progress.current.velocity = Math.min(4, Math.abs(self.getVelocity()) / 900) } } })
    })
    return () => mm.revert()
  }, [near])
  const active = selected === null ? null : hubs[selected]
  return <section ref={ref} id="network" className={s.network} aria-labelledby="network-title">
    <div className={s.edgeBar}><span>NETWORK STUDY / ILLUSTRATIVE ROUTES</span><Link href="/simulator/stress-test">SOLVER STATUS ↗</Link></div>
    <div className={s.globeCanvas}>
      {/* A geographic static rendering remains visible until WebGL paints. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={s.globePoster} src="/images/olus/globe-static.svg" alt="Dotted world globe with connecting airline routes" />
      {near && !reduced && !failed && <Scene progress={progress} paused={paused} selected={selected} hovered={hovered} onHover={setHovered} onSelect={setSelected} onFailure={() => setFailed(true)} />}
    </div>
    <div className={s.networkCopy}>
      <span className={s.eyebrow}>ONE NETWORK. EVERY CONSEQUENCE.</span>
      <h2 id="network-title">EVERY<br />MINUTE OF<br />THE IRROP.</h2>
      <p>A delay never stays in one place. Follow the aircraft, the crew, and the decisions that put the network back within reach.</p>
      <div className={s.actions}><Link className={s.button} href="/scenarios">Run a scenario ↗</Link><Link className={s.outlineButton} href="/docs#optimizer">Read the model</Link></div>
    </div>
    <div className={s.networkControls}>
      <div><span className={s.eyebrow}>EXPLORE A HUB</span><div className={s.hubRail}>{hubs.map((hub,i) => <button key={hub.id} aria-pressed={selected === i} onClick={() => setSelected(i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}>{hub.id}</button>)}</div></div>
      <button className={s.outlineButton} onClick={() => setPaused(!paused)} disabled={reduced || failed}>{reduced || failed ? "Static globe" : paused ? "Resume flight paths" : "Pause flight paths"}</button>
      <span className={s.small}>{failed ? "Simplified globe — WebGL is unavailable." : reduced ? "Static view · reduced motion" : "Drag to rotate · select a hub"}</span>
    </div>
    {hovered !== null && !active && <div className={s.hubTooltip} role="status">{hubs[hovered].id} · {hubs[hovered].flights} departures · {hubs[hovered].affected} affected flights<br /><small>Illustrative network</small></div>}
    {active && <aside className={s.hubSummary} aria-label={`${active.id} simulated disruption summary`}>
      <button className={s.close} onClick={() => setSelected(null)} aria-label="Close hub summary">×</button>
      <span className={s.eyebrow}>ILLUSTRATIVE HUB / {active.id}</span><h3>{active.name}</h3><p>{active.issue}</p>
      <dl><div><dt>Scheduled departures</dt><dd>{active.flights}</dd></div><div><dt>Affected flights</dt><dd>{active.affected}</dd></div></dl><Link href="/scenarios">Explore scenarios ↗</Link>
    </aside>}
  </section>
}
