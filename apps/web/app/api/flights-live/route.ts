/**
 * Vercel-native live flights endpoint using adsb.lol.
 *
 * OpenSky blocks all cloud-provider IPs (Railway, Vercel Node.js, Vercel Edge)
 * at the TCP level. adsb.lol is a free community ADS-B aggregator that allows
 * cloud access without authentication and returns data already normalised to
 * feet / knots / fpm — no unit conversion required.
 *
 * Coverage: radius of 2500nm from the geographic centre of the contiguous US
 * (37°N, -95°W) — covers CONUS and approaches. Alaska/Hawaii are outside this
 * bounding box but the app focuses on CONUS operations.
 *
 * adsb.lol field reference:
 *   hex        ICAO 24-bit transponder code
 *   flight     callsign (may have trailing spaces)
 *   lat / lon  position
 *   alt_baro   barometric altitude in feet (string "ground" when on ground)
 *   gs         ground speed in knots
 *   track      true track / heading in degrees (0 = north, clockwise)
 *   baro_rate  vertical rate in ft/min
 *   squawk     squawk code (4-digit string)
 *   r          registration
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"
export const dynamic = "force-dynamic"

const ADSB_LOL_URL = "https://api.adsb.lol/v2/lat/37/lon/-95/dist/2500"

// ICAO callsign prefix → IATA two-letter code (from apps/api/src/data/airlines.py)
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

interface AdsbLolAircraft {
  hex?: string
  flight?: string
  lat?: number
  lon?: number
  alt_baro?: number | string
  alt_geom?: number
  gs?: number
  track?: number
  baro_rate?: number
  squawk?: string
  r?: string
}

export async function GET(_req: NextRequest) {
  let aircraft: AdsbLolAircraft[] = []

  try {
    const res = await fetch(ADSB_LOL_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Aeolus/0.2 (github.com/mizuharaa/aeolus)" },
    })
    if (res.ok) {
      const body = (await res.json()) as { ac?: AdsbLolAircraft[] }
      aircraft = body.ac ?? []
    }
  } catch {
    // Graceful degradation — return empty list if feed is unavailable
  }

  const flights = []
  for (const ac of aircraft) {
    const callsignRaw = (ac.flight ?? "").trim()
    if (!callsignRaw) continue

    const lat = ac.lat
    const lon = ac.lon
    if (lat == null || lon == null) continue

    // Skip ground traffic (alt_baro is the string "ground" when on ground)
    const onGround = ac.alt_baro === "ground" || ac.alt_baro === 0
    if (onGround) continue

    const altFt = typeof ac.alt_baro === "number" ? ac.alt_baro : null
    const icao24 = (ac.hex ?? "").toLowerCase()

    // Derive IATA airline code from the 3-letter ICAO callsign prefix
    const icaoPrefix = callsignRaw.slice(0, 3).toUpperCase()
    const iata = ICAO_TO_IATA[icaoPrefix] ?? null
    const num = callsignRaw.slice(3).replace(/\s+$/, "")
    const flightIata = iata && num ? iata + num : null
    const airlineName = iata ? (AIRLINE_NAMES[iata] ?? "Unknown") : "Unknown"

    flights.push({
      icao24,
      callsign: callsignRaw,
      flight_iata: flightIata,
      flight_icao: callsignRaw,
      airline_iata: iata,
      airline_name: airlineName,
      origin_country: "",
      lat,
      lon,
      altitude_ft: altFt,
      on_ground: false,
      velocity_kt: ac.gs != null ? Math.round(ac.gs) : null,
      heading: ac.track ?? null,
      vertical_fpm: ac.baro_rate != null ? Math.round(ac.baro_rate) : null,
      squawk: ac.squawk ?? null,
      last_contact: Math.floor(Date.now() / 1000),
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

  return NextResponse.json({ flights, total: flights.length, source: "adsb.lol" })
}
