import wing from "@/public/images/olus/wing-aerial.png"
import cabin from "@/public/images/olus/cabin-window.png"
import approach from "@/public/images/olus/airport-approach.png"
import sunset from "@/public/images/olus/sunset-departure.png"
import night from "@/public/images/olus/night-aircraft.jpg"
import stand from "@/public/images/olus/night-stand.jpg"

// User-supplied originals and provenance: docs/asset-research.md.
export const media = {
  hero: { src: wing, alt: "An aircraft wing above a coastal city and its waterways" },
  cabin: { src: cabin, alt: "A passenger looking through an aircraft window" },
  approach: { src: approach, alt: "An aircraft approaching an airport, viewed from the terminal" },
  sunset: { src: sunset, alt: "An aircraft departing against a sunset sky" },
  night: { src: night, alt: "An airliner under floodlights on a night stand" },
  stand: { src: stand, alt: "A parked aircraft and ground equipment at night" },
} as const
