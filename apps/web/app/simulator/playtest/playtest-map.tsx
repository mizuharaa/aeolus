"use client"
/**
 * Playtest map — minimal Leaflet renderer for the sandbox.
 *
 * Why this is separate from the main `flight-map.tsx`:
 *   • The main map mounts the canonical Zustand store and the live OpenSky
 *     feed. Mounting that here would interleave dashboard state with the
 *     sandbox — exactly the contamination playtest is meant to avoid.
 *   • The sandbox needs FEWER features: route lines + endpoint markers
 *     coloured by cascade order. No real aircraft, no METAR overlay, no
 *     event polygons. Keeping it stripped speeds up the demo.
 */
import { useEffect, useRef } from "react"
import L from "leaflet"
import { NIMBUS_AIRPORTS } from "@/components/simulator/airports"
import { c } from "@/lib/design-tokens"
import type { PlaytestFlight, PlaytestFlightState } from "@/stores/playtest"

interface Props {
  flights:      PlaytestFlight[]
  flightStates: Record<string, PlaytestFlightState>
}

const US_CENTER:  [number, number] = [39.5, -98.5]
const INITIAL_ZOOM = 4

export function PlaytestMap({ flights, flightStates }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const layerRef     = useRef<L.LayerGroup | null>(null)

  // ── Bootstrap the map once ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: US_CENTER,
      zoom:   INITIAL_ZOOM,
      zoomControl: true,
      preferCanvas: true,
      worldCopyJump: false,
    })
    // Carto Positron — matches the rest of the dashboard.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap · © CARTO",
      maxZoom: 18,
      subdomains: "abcd",
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current   = map

    return () => {
      map.remove()
      mapRef.current   = null
      layerRef.current = null
    }
  }, [])

  // ── Redraw routes + endpoints whenever the input changes ────────────────
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return
    layerRef.current.clearLayers()

    if (flights.length === 0) return

    // Track the union of all visited airports so we can auto-fit bounds.
    const visited = new Set<string>()
    const points: [number, number][] = []

    for (const f of flights) {
      const o = NIMBUS_AIRPORTS[f.origin]
      const d = NIMBUS_AIRPORTS[f.destination]
      if (!o || !d) continue
      visited.add(f.origin)
      visited.add(f.destination)
      points.push([o.lat, o.lon])
      points.push([d.lat, d.lon])

      const state = flightStates[f.id]
      const stroke = routeColor(state)
      const weight = state?.status === "cancelled" ? 1.2 : 1.8
      const dash   = state?.status === "cancelled" ? "4 4" : undefined

      // Route line — straight geodesic between endpoints (Leaflet handles
      // wrap; great-circle bending is overkill for CONUS distances).
      L.polyline(
        [[o.lat, o.lon], [d.lat, d.lon]],
        { color: stroke, weight, opacity: 0.85, dashArray: dash, lineCap: "round" },
      ).addTo(layerRef.current)
    }

    // Airport endpoint markers (one per unique ICAO).
    for (const icao of visited) {
      const ap = NIMBUS_AIRPORTS[icao]
      if (!ap) continue
      L.circleMarker([ap.lat, ap.lon], {
        radius: 5,
        color: c.ink,
        weight: 1.5,
        fillColor: c.canvas,
        fillOpacity: 1,
      })
        .bindTooltip(`${ap.iata} — ${ap.city}`, { direction: "top", offset: [0, -4], opacity: 0.95 })
        .addTo(layerRef.current)
    }

    // Auto-fit once the user has at least one flight, otherwise stay on CONUS.
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points)
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 })
    }
  }, [flights, flightStates])

  return <div ref={containerRef} className="simulator-map-shell" style={{ width: "100%", height: "100%" }} />
}

function routeColor(state: PlaytestFlightState | undefined): string {
  if (!state)                          return c.muted
  if (state.status === "cancelled")    return c.signatureCoral
  if (state.cascade_order === 0)       return c.signatureCoral
  if (state.cascade_order === 1)       return c.signatureMustard
  if (state.cascade_order === 2)       return c.signatureYellow
  if ((state.delay_minutes ?? 0) > 0)  return c.signaturePeach
  return c.signatureMint
}
