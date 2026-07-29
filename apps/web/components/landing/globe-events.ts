export type GlobeEventKind = "closure" | "storm" | "cyber" | "ash" | "crew"

export type GlobeEvent = {
  id: string
  kind: GlobeEventKind
  city: string
  airport: string
  lat: number
  lon: number
  title: string
  effect: string
  response: string
  tone: "amber" | "violet" | "rose" | "cyan" | "paper"
}

/**
 * Kept outside the WebGL module so the event feed does not eagerly load
 * Three.js, the Earth renderer, or its texture stack.
 */
export const GLOBE_EVENTS: GlobeEvent[] = [
  {
    id: "ord-closure",
    kind: "closure",
    city: "Chicago",
    airport: "KORD",
    lat: 41.9742,
    lon: -87.9073,
    title: "Hub closure",
    effect: "Departure bank held",
    response: "Recovery plans recomputing",
    tone: "rose",
  },
  {
    id: "mnl-storm",
    kind: "storm",
    city: "Manila",
    airport: "RPLL",
    lat: 14.5086,
    lon: 121.0198,
    title: "Convective storm",
    effect: "Arrival flow compressed",
    response: "Weather alternates active",
    tone: "cyan",
  },
  {
    id: "sin-cyber",
    kind: "cyber",
    city: "Singapore",
    airport: "WSSS",
    lat: 1.3644,
    lon: 103.9915,
    title: "Cyber disruption",
    effect: "Dispatch link isolated",
    response: "Manual control channel open",
    tone: "violet",
  },
  {
    id: "kef-ash",
    kind: "ash",
    city: "Keflavík",
    airport: "BIKF",
    lat: 63.985,
    lon: -22.6056,
    title: "Volcanic ash",
    effect: "North Atlantic tracks constrained",
    response: "Route exposure recalculating",
    tone: "amber",
  },
  {
    id: "lhr-crew",
    kind: "crew",
    city: "London",
    airport: "EGLL",
    lat: 51.47,
    lon: -0.4543,
    title: "Crew displacement",
    effect: "Legality window tightening",
    response: "Reserve pairings ranked",
    tone: "paper",
  },
]

export const globeEventRuntime = {
  activeIndex: 0,
  version: 0,
}

export function setGlobeEventIndex(index: number) {
  const next =
    ((index % GLOBE_EVENTS.length) + GLOBE_EVENTS.length) %
    GLOBE_EVENTS.length
  if (next === globeEventRuntime.activeIndex) return
  globeEventRuntime.activeIndex = next
  globeEventRuntime.version += 1
}
