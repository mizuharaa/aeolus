/**
 * Vercel-native live national airspace status: FAA traffic-management programs
 * (ground stops / GDPs / departure delays) + NWS aviation weather alerts.
 *
 * Mirrors the backend `/live/national-snapshot` response shape so the Live Feed
 * and notification bell can use it as a drop-in — crucially, it works even when
 * the Railway API is unavailable (the backend was the only path to this data
 * before, so with it down the operator saw an empty weather/delay feed).
 *
 * Sources (both public, no key):
 *   FAA  https://nasstatus.faa.gov/api/airport-status-information
 *   NWS  https://api.weather.gov/alerts/active
 */
import { NextResponse } from "next/server"

export const runtime = "edge"
export const dynamic = "force-dynamic"

const FAA_URL = "https://nasstatus.faa.gov/api/airport-status-information"
// api.weather.gov rejects a `limit` param (400); keep only supported filters.
const NWS_URL = "https://api.weather.gov/alerts/active?status=actual&message_type=alert"

const NIMBUS_ICAO = new Set([
  "KORD", "KATL", "KDFW", "KLAX", "KDEN", "KJFK", "KSEA", "KMIA",
  "KPHX", "KLAS", "KBOS", "KSFO", "KIAH", "KDTW", "KMSP",
])

const IATA_TO_ICAO: Record<string, string> = {
  ORD: "KORD", ATL: "KATL", DFW: "KDFW", LAX: "KLAX", DEN: "KDEN",
  JFK: "KJFK", SEA: "KSEA", MIA: "KMIA", PHX: "KPHX", LAS: "KLAS",
  BOS: "KBOS", SFO: "KSFO", IAH: "KIAH", DTW: "KDTW", MSP: "KMSP",
  EWR: "KEWR", LGA: "KLGA", CLT: "KCLT", SLC: "KSLC", PDX: "KPDX",
  MDW: "KMDW", BWI: "KBWI", DCA: "KDCA", PHL: "KPHL", MCO: "KMCO",
}

const AIRPORT_BOUNDS: Record<string, [number, number, number, number]> = {
  KORD: [41.5, 42.5, -88.5, -87.0], KATL: [33.2, 34.2, -85.0, -83.5],
  KDFW: [32.4, 33.4, -97.5, -96.5], KLAX: [33.5, 34.5, -119.0, -117.5],
  KDEN: [39.5, 40.5, -105.5, -104.0], KJFK: [40.3, 41.2, -74.5, -73.0],
  KSEA: [47.0, 48.0, -123.0, -121.5], KMIA: [25.3, 26.3, -80.8, -79.5],
  KPHX: [33.0, 34.0, -112.5, -111.0], KLAS: [35.6, 36.6, -115.7, -114.5],
  KBOS: [41.8, 42.6, -71.5, -70.5], KSFO: [37.2, 38.0, -122.8, -121.7],
  KIAH: [29.5, 30.5, -96.0, -94.8], KDTW: [41.8, 42.6, -84.0, -82.8],
  KMSP: [44.4, 45.4, -94.0, -92.5],
}

const AIRPORT_KEYWORDS: Record<string, string[]> = {
  KORD: ["chicago", "cook county", "northeastern illinois"],
  KATL: ["atlanta", "fulton county", "north georgia"],
  KDFW: ["dallas", "fort worth", "tarrant county", "north texas"],
  KLAX: ["los angeles", "southern california"],
  KDEN: ["denver", "adams county", "arapahoe", "colorado"],
  KJFK: ["new york city", "queens", "long island", "new york metro"],
  KSEA: ["seattle", "king county", "puget sound"],
  KMIA: ["miami", "miami-dade", "south florida"],
  KPHX: ["phoenix", "maricopa county", "arizona"],
  KLAS: ["las vegas", "clark county", "southern nevada"],
  KBOS: ["boston", "suffolk county", "eastern massachusetts"],
  KSFO: ["san francisco", "bay area"],
  KIAH: ["houston", "harris county", "southeast texas"],
  KDTW: ["detroit", "wayne county", "southeast michigan"],
  KMSP: ["minneapolis", "saint paul", "hennepin county", "twin cities"],
}

const AVIATION_ALERT_EVENTS = new Set([
  "Winter Storm Warning", "Winter Storm Watch", "Winter Weather Advisory",
  "Blizzard Warning", "Ice Storm Warning", "Freezing Rain Advisory",
  "Wind Advisory", "High Wind Warning", "High Wind Watch",
  "Dense Fog Advisory", "Dense Smoke Advisory", "Excessive Heat Warning",
  "Heat Advisory", "Severe Thunderstorm Warning", "Tornado Warning",
  "Special Weather Statement", "Flood Warning", "Flash Flood Warning",
  "Lake Effect Snow Warning", "Lake Effect Snow Advisory",
])

const asList = (v: unknown): any[] => (v == null ? [] : Array.isArray(v) ? v : [v])
const icaoFor = (arpt: string) => IATA_TO_ICAO[arpt] ?? (arpt && arpt.length === 3 ? `K${arpt}` : arpt)
const sevRank = (s: string) => ({ Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 }[s] ?? 0)

function parseDelayMinutes(raw: string): number {
  if (!raw) return 0
  const r = raw.toLowerCase()
  const h = r.match(/(\d+)\s*hour/)
  const m = r.match(/(\d+)\s*min/)
  return (h ? +h[1] : 0) * 60 + (m ? +m[1] : 0)
}

function boxesOverlap(a: number[], b: number[]) {
  return a[0] <= b[1] && a[1] >= b[0] && a[2] <= b[3] && a[3] >= b[2]
}

function airportsInAlert(geo: any, areaDesc: string): string[] {
  const out: string[] = []
  const area = (areaDesc || "").toLowerCase()
  for (const [icao, keys] of Object.entries(AIRPORT_KEYWORDS)) {
    if (keys.some((k) => area.includes(k))) out.push(icao)
  }
  if (geo?.type === "Polygon" && Array.isArray(geo.coordinates)) {
    const flat = geo.coordinates.flat()
    const lats = flat.map((c: number[]) => c[1]).filter((n: number) => typeof n === "number")
    const lons = flat.map((c: number[]) => c[0]).filter((n: number) => typeof n === "number")
    if (lats.length && lons.length) {
      const bbox = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)]
      for (const [icao, ab] of Object.entries(AIRPORT_BOUNDS)) {
        if (!out.includes(icao) && boxesOverlap(bbox, ab)) out.push(icao)
      }
    }
  }
  return [...new Set(out)]
}

const xmlTag = (block: string, tag: string): string => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))
  return m ? m[1].trim() : ""
}

// The FAA endpoint returns XML (application/xml); the Edge runtime has no
// DOMParser, so parse the small, well-formed document with regex.
function parseFaaXml(xml: string) {
  const programs: any[] = []
  const groundStops: any[] = []
  const blocks = xml.match(/<Delay_type>([\s\S]*?)<\/Delay_type>/gi) ?? []

  for (const block of blocks) {
    const name = xmlTag(block, "Name")
    let type: string
    if (/Ground Stop/i.test(name)) type = "ground_stop"
    else if (/Ground Delay|GDP/i.test(name)) type = "ground_delay_program"
    else if (/Departure Delay|General Delay/i.test(name)) type = "departure_delay"
    else if (/Closure/i.test(name)) type = "closure"
    else continue

    // each affected airport is an <Airport>…</Airport> or <Program>…</Program>
    const entries = block.match(/<(?:Airport|Program)>([\s\S]*?)<\/(?:Airport|Program)>/gi) ?? []
    for (const ent of entries) {
      const arpt = xmlTag(ent, "ARPT") || xmlTag(ent, "Name")
      if (!arpt) continue
      const icao = icaoFor(arpt)
      const reason = xmlTag(ent, "Reason")
      const dm = parseDelayMinutes(xmlTag(ent, "Avg_Delay") || xmlTag(ent, "AvgDelay"))
      const isWx = /WEATHER|WX|THUNDER|SNOW|FOG|WIND|ICE/i.test(reason)
      const e: any = {
        type: type === "closure" ? "ground_stop" : type,
        airport_iata: arpt, airport_icao: icao,
        reason: reason.slice(0, 160), avg_delay_minutes: dm || undefined,
        recheck: xmlTag(ent, "Recheck") || undefined,
        in_nimbus_network: NIMBUS_ICAO.has(icao),
        sim_event:
          type === "departure_delay"
            ? { kind: isWx ? "weather_closure" : "atc_staffing", params: { airport: icao, severity: dm < 60 ? "moderate" : "severe", duration_hours: Math.max(1, Math.floor(dm / 30)) || 2, ...(isWx ? {} : { facility_id: "ZNY" }) } }
            : { kind: "ground_stop", params: { destination_airport: icao, duration_hours: 2, severity: type === "closure" ? "extreme" : "severe" } },
      }
      programs.push(e)
      if (type === "ground_stop" || type === "closure") groundStops.push(e)
    }
  }
  const iataSet = new Set(programs.map((p) => p.airport_iata).filter(Boolean))
  return {
    programs, ground_stops: groundStops,
    total: programs.length,
    nimbus_affected: programs.filter((p) => p.in_nimbus_network).length,
    us_summary: {
      concurrent_total: programs.length,
      concurrent_ground_stops: groundStops.length,
      concurrent_gdps: programs.filter((p) => p.type === "ground_delay_program").length,
      concurrent_departure_delay_programs: programs.filter((p) => p.type === "departure_delay").length,
      unique_us_airports: iataSet.size,
      nimbus_network_overlap: programs.filter((p) => p.in_nimbus_network).length,
    },
    source: "nasstatus.faa.gov",
  }
}

function parseNws(data: any) {
  const alerts: any[] = []
  for (const f of data?.features ?? []) {
    const props = f.properties ?? {}
    const event = props.event ?? ""
    if (!AVIATION_ALERT_EVENTS.has(event)) continue
    const affected = airportsInAlert(f.geometry, props.areaDesc ?? "")
    const severity = props.severity ?? "Unknown"
    alerts.push({
      id: props.id ?? "", event, headline: (props.headline ?? "").slice(0, 160),
      severity, area: (props.areaDesc ?? "").slice(0, 140),
      effective: props.effective ?? "", expires: props.expires ?? "",
      sender: props.senderName ?? "", affected_nimbus_airports: affected,
      sim_event: affected.length ? { kind: "weather_closure", params: { airport: affected[0], severity: severity === "Extreme" ? "extreme" : severity === "Severe" ? "severe" : "moderate", duration_hours: 3 } } : null,
    })
  }
  alerts.sort((a, b) => (b.affected_nimbus_airports.length - a.affected_nimbus_airports.length) || (sevRank(b.severity) - sevRank(a.severity)))
  return {
    alerts: alerts.slice(0, 72), total: alerts.length,
    nimbus_affected: alerts.filter((a) => a.affected_nimbus_airports.length).length,
    us_summary: {
      nationwide_alerts_matched: alerts.length,
      returned: Math.min(72, alerts.length),
      severe_or_extreme: alerts.filter((a) => a.severity === "Severe" || a.severity === "Extreme").length,
      nimbus_touched: alerts.filter((a) => a.affected_nimbus_airports.length).length,
    },
    source: "api.weather.gov",
  }
}

async function fetchFaa() {
  try {
    const r = await fetch(FAA_URL, { headers: { Accept: "application/xml" } })
    if (!r.ok) throw new Error(`FAA ${r.status}`)
    return parseFaaXml(await r.text())
  } catch (e) {
    return { programs: [], ground_stops: [], total: 0, nimbus_affected: 0, us_summary: null, source: "unavailable", error: String(e) }
  }
}

async function fetchNws() {
  try {
    const r = await fetch(NWS_URL, { headers: { "User-Agent": "(aeolus-occ.app, ops@aeolus-occ.app)", Accept: "application/geo+json" } })
    if (!r.ok) throw new Error(`NWS ${r.status}`)
    return parseNws(await r.json())
  } catch (e) {
    return { alerts: [], total: 0, nimbus_affected: 0, us_summary: null, source: "unavailable", error: String(e) }
  }
}

export async function GET() {
  const [faa, nws] = await Promise.all([fetchFaa(), fetchNws()])
  return NextResponse.json(
    { refreshed_at: new Date().toISOString(), faa, nws },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } },
  )
}
