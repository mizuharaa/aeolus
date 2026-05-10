// Display-helper module — turns raw ICAO airport codes and aircraft tail
// numbers into something a human can read at a glance. The simulator UI
// dropped raw codes (KORD, N001NB) into cards and lists, leaving anyone
// who isn't an airline ops engineer with no idea what they were looking at.
import { NIMBUS_AIRPORTS } from "@/components/simulator/airports"

export interface AirportLabel {
  /** Original ICAO code as stored in the schedule (e.g. "KORD") */
  icao: string
  /** 3-letter IATA code (e.g. "ORD"); falls back to the ICAO if unknown */
  iata: string
  /** Common airport name (e.g. "O'Hare"); empty when unknown */
  name: string
  /** City the airport serves (e.g. "Chicago"); empty when unknown */
  city: string
  /** Combined "City Name" label suitable for subtitles, may be empty */
  contextLine: string
}

export function airportLabel(icao?: string | null): AirportLabel {
  const code = (icao ?? "").toUpperCase()
  const ap = NIMBUS_AIRPORTS[code]
  if (!ap) {
    return { icao: code, iata: code, name: "", city: "", contextLine: "" }
  }
  const contextLine = [ap.city, ap.name].filter(Boolean).join(" ").trim()
  return {
    icao: code,
    iata: ap.iata,
    name: ap.name,
    city: ap.city,
    contextLine,
  }
}

export interface AircraftLabel {
  tail: string
  /** Aircraft type code as the API delivers it (e.g. "B737-800"); empty when unknown */
  type: string
  /** Friendly type label (e.g. "Boeing 737-800") — currently same as `type`
   *  but normalised through this helper so future formatters can swap it */
  typeLabel: string
  seats: number | null
  base: string
}

interface FleetEntry {
  id?: string
  type?: string
  seats?: number
  base_airport_id?: string
}

/** Resolve a tail number against a fleet roster (typically the list returned
 *  by GET /network/aircraft). Returns sensible empty values when the tail
 *  isn't in the roster so callers can still render. */
export function aircraftLabel(
  tail?: string | null,
  fleet?: ReadonlyArray<FleetEntry> | null,
): AircraftLabel {
  const t = (tail ?? "").toUpperCase()
  if (!t) return { tail: "", type: "", typeLabel: "", seats: null, base: "" }

  const entry = fleet?.find((a) => (a.id ?? "").toUpperCase() === t)

  const type = (entry?.type ?? "").toString()
  return {
    tail: t,
    type,
    typeLabel: prettifyAircraftType(type),
    seats: entry?.seats ?? null,
    base: (entry?.base_airport_id ?? "").toString().toUpperCase(),
  }
}

/** Friendly name for common aircraft type codes. Falls through to the raw
 *  code for anything unknown so we never hide the underlying identifier. */
function prettifyAircraftType(type: string): string {
  if (!type) return ""
  const map: Record<string, string> = {
    "B737-700":  "Boeing 737-700",
    "B737-800":  "Boeing 737-800",
    "B737-900":  "Boeing 737-900ER",
    "B737MAX8":  "Boeing 737 MAX 8",
    "B737MAX9":  "Boeing 737 MAX 9",
    "B757-200":  "Boeing 757-200",
    "B767-300":  "Boeing 767-300",
    "B777-200":  "Boeing 777-200",
    "B787-8":    "Boeing 787-8",
    "B787-9":    "Boeing 787-9",
    "A319":      "Airbus A319",
    "A320":      "Airbus A320",
    "A321":      "Airbus A321",
    "A330-200":  "Airbus A330-200",
    "A350-900":  "Airbus A350-900",
    "E170":      "Embraer 170",
    "E175":      "Embraer 175",
    "E190":      "Embraer 190",
    "CRJ-700":   "Bombardier CRJ-700",
    "CRJ-900":   "Bombardier CRJ-900",
  }
  return map[type] ?? type
}
