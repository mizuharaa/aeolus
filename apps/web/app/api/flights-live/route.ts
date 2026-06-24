/**
 * Vercel-native live flights endpoint.
 *
 * Fetches OpenSky state vectors through the /api/osky relay (which runs on
 * Vercel's network, where OpenSky's IP filters don't apply) and normalises
 * the raw state vectors into the same shape as the Railway /flights/live
 * route. This bypasses Railway entirely for live plane data, which matters
 * because Railway's datacenter IPs are blocked by OpenSky.
 *
 * The frontend calls this route directly (/api/flights-live) instead of
 * going through the Railway proxy for this specific endpoint.
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ICAO callsign prefix → IATA two-letter code (ported from apps/api/src/data/airlines.py)
const ICAO_TO_IATA: Record<string, string> = {
  AAL: "AA", UAL: "UA", DAL: "DL", SWA: "WN", JBU: "B6",
  ASA: "AS", NKS: "NK", FFT: "F9", AAY: "G4", HAL: "HA",
  SXJ: "XP", SKW: "OO", RPA: "YV", PDT: "OE", ENY: "MQ",
  GJS: "G7", CPZ: "CP", ERA: "7H", ASH: "AX", BTA: "WQ",
  TSO: "KS", GPD: "G1", FDX: "FX", UPS: "5X", GTI: "GB",
  ATN: "8C", ABX: "GB", WJA: "WS", ACA: "AC", TRS: "TS",
  BAW: "BA", VIR: "VS", EZY: "U2", DLH: "LH", CFG: "DE",
  AFR: "AF", TOM: "BY", KLM: "KL", IBE: "IB", VLG: "VY",
  AZA: "AZ", SAS: "SK", JAL: "JL", ANA: "NH", KAL: "KE",
  AAR: "OZ", CPA: "CX", SIA: "SQ", QFA: "QF", UAE: "EK",
  ETD: "EY", QTR: "QR", SVA: "SV", THY: "TK", TAM: "JJ",
  GLO: "G3", AZU: "AD", AMX: "AM", VOI: "Y4", AVA: "AV",
  LAN: "LA", JKK: "JJ", EIN: "EI", ETH: "ET", MSR: "MS",
}

const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines", UA: "United Airlines", DL: "Delta Air Lines",
  WN: "Southwest Airlines", B6: "JetBlue Airways", AS: "Alaska Airlines",
  NK: "Spirit Airlines", F9: "Frontier Airlines", G4: "Allegiant Air",
  HA: "Hawaiian Airlines", OO: "SkyWest Airlines", YV: "Mesa Airlines",
  MQ: "Envoy Air", G7: "GoJet Airlines", FX: "FedEx Express",
  "5X": "UPS Airlines", AC: "Air Canada", WS: "WestJet",
  BA: "British Airways", VS: "Virgin Atlantic", LH: "Lufthansa",
  AF: "Air France", KL: "KLM", IB: "Iberia", AZ: "ITA Airways",
  SK: "SAS", JL: "Japan Airlines", NH: "All Nippon Airways",
  KE: "Korean Air", OZ: "Asiana Airlines", CX: "Cathay Pacific",
  SQ: "Singapore Airlines", QF: "Qantas", EK: "Emirates",
  EY: "Etihad Airways", QR: "Qatar Airways", SV: "Saudia",
  TK: "Turkish Airlines", ET: "Ethiopian Airlines", LA: "LATAM Airlines",
  AM: "Aeroméxico", AV: "Avianca",
}

interface LiveFlight {
  icao24: string
  callsign: string
  flight_iata: string | null
  flight_icao: string
  airline_iata: string | null
  airline_name: string
  origin_country: string
  lat: number
  lon: number
  altitude_ft: number | null
  on_ground: boolean
  velocity_kt: number | null
  heading: number | null
  vertical_fpm: number | null
  squawk: string | null
  last_contact: number
  tracking: {
    flightaware: string | null
    flightradar24: string
    adsbexchange: string
    opensky: string
  }
}

function parseCallsign(raw: string): { iata: string | null; num: string } {
  const cs = raw.trim().toUpperCase().replace(/\s+$/, "")
  const icaoPrefix = cs.slice(0, 3)
  const num = cs.slice(3).replace(/\s+$/, "")
  return { iata: ICAO_TO_IATA[icaoPrefix] ?? null, num }
}

export async function GET(req: NextRequest) {
  const sp = new URLSearchParams({
    lamin: "15", lamax: "72", lomin: "-180", lomax: "-50", extended: "1",
  })
  const relayUrl = `${req.nextUrl.origin}/api/osky/states?${sp.toString()}`

  let raw: { states?: unknown[][] } | null = null
  try {
    const res = await fetch(relayUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      raw = (await res.json()) as { states?: unknown[][] }
    }
  } catch {
    // Relay unavailable — return empty list gracefully
  }

  if (!raw?.states) {
    return NextResponse.json({ flights: [], total: 0, source: "opensky-network.org" })
  }

  const flights: LiveFlight[] = []

  for (const sv of raw.states) {
    if (!sv || sv.length < 17) continue

    const callsignRaw = ((sv[1] as string) ?? "").trim()
    if (!callsignRaw) continue

    const lat = sv[6] as number | null
    const lon = sv[5] as number | null
    if (lat == null || lon == null) continue

    const onGround = Boolean(sv[8])
    const icao24 = ((sv[0] as string) ?? "").toLowerCase()

    const velMs = sv[9] as number | null
    const altM = ((sv[7] ?? sv[13]) as number | null)
    const vertMs = sv[11] as number | null
    const timePos = ((sv[3] ?? sv[4] ?? 0) as number)
    const originCountry = (sv[2] as string) ?? ""

    const { iata, num } = parseCallsign(callsignRaw)
    const flightIata = iata && num ? iata + num : null
    const airlineName = iata
      ? (AIRLINE_NAMES[iata] ?? originCountry || "Unknown")
      : "Unknown"

    flights.push({
      icao24,
      callsign: callsignRaw,
      flight_iata: flightIata,
      flight_icao: callsignRaw,
      airline_iata: iata,
      airline_name: airlineName,
      origin_country: originCountry,
      lat,
      lon,
      altitude_ft: altM != null ? Math.round(altM * 3.281) : null,
      on_ground: onGround,
      velocity_kt: velMs != null ? Math.round(velMs * 1.944) : null,
      heading: sv[10] as number | null,
      vertical_fpm: vertMs != null ? Math.round(vertMs * 196.85) : null,
      squawk: sv[14] as string | null,
      last_contact: timePos,
      tracking: {
        flightaware: callsignRaw
          ? `https://www.flightaware.com/live/flight/${callsignRaw}`
          : null,
        flightradar24: flightIata
          ? `https://www.flightradar24.com/${flightIata}`
          : `https://www.flightradar24.com/${callsignRaw}`,
        adsbexchange: `https://globe.adsbexchange.com/?icao=${icao24}`,
        opensky: `https://opensky-network.org/aircraft-profile?icao24=${icao24}`,
      },
    })
  }

  return NextResponse.json({ flights, total: flights.length, source: "opensky-network.org" })
}
