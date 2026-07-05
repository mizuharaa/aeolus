/**
 * Static data for the cinematic simulator demo — the Nimbus Air CONUS
 * network projected onto a fixed "world" plane that the camera pans and
 * zooms across. Everything the timeline needs is precomputed here.
 */

// ── World plane (px) + equirectangular window over CONUS ────────────────
export const WORLD_W = 1500
export const WORLD_H = 860

const LON_MIN = -127
const LON_MAX = -65
const LAT_MIN = 23
const LAT_MAX = 51

export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WORLD_W,
    y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * WORLD_H,
  }
}

export const MASK_WINDOW = { LON_MIN, LON_MAX, LAT_MIN, LAT_MAX }

// ── Nimbus Air airports ──────────────────────────────────────────────────
const RAW: Record<string, [number, number]> = {
  KORD: [41.98, -87.9],
  KATL: [33.64, -84.43],
  KDFW: [32.9, -97.04],
  KLAX: [33.94, -118.41],
  KDEN: [39.86, -104.67],
  KJFK: [40.64, -73.78],
  KSEA: [47.45, -122.31],
  KMIA: [25.79, -80.29],
  KPHX: [33.43, -112.01],
  KLAS: [36.08, -115.15],
  KBOS: [42.36, -71.01],
  KSFO: [37.62, -122.38],
  KIAH: [29.98, -95.34],
  KDTW: [42.21, -83.35],
  KMSP: [44.88, -93.22],
}

export type Airport = { code: string; x: number; y: number; wave: 0 | 1 | 2 }

/** wave: cascade order from the KORD closure (0 = the hub itself). */
const WAVE: Record<string, 1 | 2> = {
  KATL: 1, KJFK: 1, KDEN: 1, KDFW: 1, KBOS: 1, KDTW: 1, KMSP: 1,
  KLAX: 2, KSEA: 2, KMIA: 2, KPHX: 2, KLAS: 2, KSFO: 2, KIAH: 2,
}

export const AIRPORTS: Airport[] = Object.entries(RAW).map(([code, [lat, lon]]) => ({
  code,
  ...project(lat, lon),
  wave: code === "KORD" ? 0 : WAVE[code],
}))

export const KORD = AIRPORTS.find((a) => a.code === "KORD")!

// ── Route geometry: quadratic arcs with a perpendicular arch ────────────
function arc(a: { x: number; y: number }, b: { x: number; y: number }, bow = 0.12): string {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  // perpendicular, always arching "up" (screen north-ish)
  const px = -dy / len
  const py = dx / len
  const sign = py < 0 ? 1 : -1
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${(mx + px * len * bow * sign).toFixed(1)} ${(my + py * len * bow * sign).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

const byCode = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]))

/** Cascade spokes out of KORD, split by wave for the draw stagger.
    Kept deliberately sparse — a few clean lines, not a starburst. */
export const CASCADE_W1 = ["KATL", "KJFK", "KDEN", "KDFW", "KBOS"].map((c) =>
  arc(KORD, byCode[c]),
)
export const CASCADE_W2 = ["KLAX", "KSEA", "KMIA", "KSFO"].map((c) =>
  arc(KORD, byCode[c]),
)

/** Recovery reroutes — connections re-flowed around the closed hub. */
export const REROUTES = [
  ["KDEN", "KMSP"],
  ["KATL", "KDTW"],
  ["KDFW", "KLAS"],
  ["KDEN", "KSEA"],
].map(([a, b]) => arc(byCode[a], byCode[b], 0.18))

// ── Live flight model ─────────────────────────────────────────────────────
// A small fleet flying the Nimbus network continuously. Background flights
// never touch the closed hub and keep cruising (the network stays alive);
// hub flights (arrivals into / departures out of KORD) hold when the closure
// hits, then reroute (arrivals divert to an alternate) or release (departures)
// once Plan B commits. Varied `dur` ⇒ genuinely different ground speeds.

export type Bez = { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number }

/** Quadratic arc between two airports, control point offset perpendicular. */
export function bezBetween(from: string, to: string, bow: number): Bez {
  const a = byCode[from]
  const b = byCode[to]
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const sign = py < 0 ? 1 : -1
  return { x0: a.x, y0: a.y, cx: mx + px * len * bow * sign, cy: my + py * len * bow * sign, x1: b.x, y1: b.y }
}

export function bezPoint(z: Bez, t: number): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u * u * z.x0 + 2 * u * t * z.cx + t * t * z.x1,
    y: u * u * z.y0 + 2 * u * t * z.cy + t * t * z.y1,
  }
}

/** Heading in degrees at parameter t (tangent of the quadratic). */
export function bezAngle(z: Bez, t: number): number {
  const u = 1 - t
  const dx = 2 * u * (z.cx - z.x0) + 2 * t * (z.x1 - z.cx)
  const dy = 2 * u * (z.cy - z.y0) + 2 * t * (z.y1 - z.cy)
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

export function bezPath(z: Bez): string {
  return `M ${z.x0.toFixed(1)} ${z.y0.toFixed(1)} Q ${z.cx.toFixed(1)} ${z.cy.toFixed(1)} ${z.x1.toFixed(1)} ${z.y1.toFixed(1)}`
}

export type Flight = {
  id: string
  from: string
  to: string
  /** how the flight relates to the closed hub */
  role: "bg" | "arr" | "dep"
  /** diversion airport for arrivals once recovery re-flows the network */
  alt?: string
  bow: number
  /** seconds for one full route traverse — the spread here is the speed spread */
  dur: number
  /** starting offset along the route, 0..1 */
  phase: number
}

export const FLIGHTS: Flight[] = [
  // background traffic — keeps flowing; proves only the hub is affected
  { id: "NB210", from: "KLAX", to: "KJFK", role: "bg", bow: 0.10, dur: 17, phase: 0.10 },
  { id: "NB214", from: "KSFO", to: "KDEN", role: "bg", bow: 0.13, dur: 10.5, phase: 0.55 },
  { id: "NB221", from: "KDFW", to: "KMIA", role: "bg", bow: 0.15, dur: 12, phase: 0.30 },
  { id: "NB233", from: "KSEA", to: "KDEN", role: "bg", bow: 0.13, dur: 9.5, phase: 0.72 },
  { id: "NB240", from: "KPHX", to: "KDTW", role: "bg", bow: 0.11, dur: 15.5, phase: 0.40 },
  { id: "NB246", from: "KATL", to: "KBOS", role: "bg", bow: 0.12, dur: 12.5, phase: 0.86 },
  { id: "NB252", from: "KLAS", to: "KMSP", role: "bg", bow: 0.14, dur: 13.5, phase: 0.20 },
  { id: "NB258", from: "KIAH", to: "KATL", role: "bg", bow: 0.16, dur: 9, phase: 0.62 },
  // arrivals into KORD — hold mid-air, then divert to an alternate
  { id: "NB101", from: "KDEN", to: "KORD", role: "arr", alt: "KMSP", bow: 0.12, dur: 12, phase: 0.34 },
  { id: "NB118", from: "KLAX", to: "KORD", role: "arr", alt: "KDTW", bow: 0.10, dur: 18.5, phase: 0.12 },
  { id: "NB126", from: "KDFW", to: "KORD", role: "arr", alt: "KMSP", bow: 0.13, dur: 12.5, phase: 0.66 },
  { id: "NB133", from: "KBOS", to: "KORD", role: "arr", alt: "KDTW", bow: 0.12, dur: 11, phase: 0.48 },
  // departures out of KORD — held on the ground, then released
  { id: "NB142", from: "KORD", to: "KATL", role: "dep", bow: 0.12, dur: 12, phase: 0.05 },
  { id: "NB150", from: "KORD", to: "KJFK", role: "dep", bow: 0.11, dur: 11.5, phase: 0.30 },
  { id: "NB165", from: "KORD", to: "KSEA", role: "dep", bow: 0.13, dur: 16, phase: 0.82 },
]

/** Precomputed geometry per flight: the primary route and (for hub flights)
 *  the rerouted path used once recovery commits. */
export type FlightGeo = Flight & { primary: Bez; reroute: Bez }

export const FLIGHT_GEO: FlightGeo[] = FLIGHTS.map((f) => {
  const primary = bezBetween(f.from, f.to, f.bow)
  let reroute = primary
  if (f.role === "arr" && f.alt) reroute = bezBetween(f.from, f.alt, f.bow + 0.06)
  // departures release on their original path; give them a slightly wider bow
  // so the re-flow reads as a new routing rather than the same held line
  if (f.role === "dep") reroute = bezBetween(f.from, f.to, f.bow + 0.05)
  return { ...f, primary, reroute }
})

/** Always-on faint route graph — every flight's primary arc. */
export const NET_PATHS: string[] = FLIGHT_GEO.map((f) => bezPath(f.primary))

/** Hub routes that flash pink as the cascade propagates. */
export const CASCADE_PATHS: string[] = FLIGHT_GEO.filter((f) => f.role !== "bg").map((f) =>
  bezPath(f.primary),
)

/** Teal reroute arcs drawn as the network re-flows. */
export const REROUTE_PATHS: string[] = FLIGHT_GEO.filter((f) => f.role !== "bg").map((f) =>
  bezPath(f.reroute),
)

// ── Script ───────────────────────────────────────────────────────────────
export const AGENT_COMMAND = "Trigger weather closure at KORD, severity 4."

export const AGENT_LINES = [
  "event: weather_closure @ KORD · sev 4",
  "cascade: 47 direct · 61 first-order",
  "4 plans solved in 8.4 ms",
  "committed plan B · 118 actions",
]

export const PLANS = [
  { id: "A", objective: "Minimize cost", cost: "$1.9M", cxl: "11 cxl", flags: "0 flags" },
  { id: "B", objective: "Minimize pax impact", cost: "$2.4M", cxl: "3 cxl", flags: "0 flags" },
  { id: "C", objective: "Protect tomorrow", cost: "$2.7M", cxl: "5 cxl", flags: "0 flags" },
  { id: "D", objective: "Minimize carbon", cost: "$2.2M", cxl: "8 cxl", flags: "0 flags" },
]

export const DEMO_STEPS = [
  {
    n: "01",
    title: "Command",
    body: "The agent takes an instruction in plain language and drives the console itself.",
  },
  {
    n: "02",
    title: "Cascade",
    body: "A severity-4 closure grounds O'Hare. 47 departures hold and the delay propagates through every downstream rotation.",
  },
  {
    n: "03",
    title: "Solve",
    body: "The optimizer returns four ranked recovery plans — cost, passengers, tomorrow's schedule, carbon.",
  },
  {
    n: "04",
    title: "Commit",
    body: "Plan B commits: 3 cancellations instead of 16, zero FAR 117 crew violations, the network re-flows around the hub.",
  },
]
