// Pure-data module (no leaflet/window imports) so it can be safely imported
// from server-rendered components and the flight-search dropdown.

export const NIMBUS_AIRPORTS: Record<
  string,
  { name: string; lat: number; lon: number; city: string; iata: string }
> = {
  KORD: { name: "O'Hare",          lat: 41.9742, lon: -87.9073, city: "Chicago",       iata: "ORD" },
  KATL: { name: "Hartsfield",      lat: 33.6407, lon: -84.4277, city: "Atlanta",       iata: "ATL" },
  KDFW: { name: "Dallas/Ft Worth", lat: 32.8998, lon: -97.0403, city: "Dallas",        iata: "DFW" },
  KLAX: { name: "Los Angeles",     lat: 33.9425, lon: -118.408, city: "Los Angeles",   iata: "LAX" },
  KDEN: { name: "Denver",          lat: 39.8561, lon: -104.6737, city: "Denver",       iata: "DEN" },
  KJFK: { name: "JFK",             lat: 40.6413, lon: -73.7781, city: "New York",      iata: "JFK" },
  KSEA: { name: "Sea-Tac",         lat: 47.4502, lon: -122.3088, city: "Seattle",      iata: "SEA" },
  KMIA: { name: "Miami",           lat: 25.7959, lon: -80.287,  city: "Miami",         iata: "MIA" },
  KPHX: { name: "Sky Harbor",      lat: 33.4373, lon: -112.0078, city: "Phoenix",      iata: "PHX" },
  KLAS: { name: "Las Vegas",       lat: 36.084,  lon: -115.1537, city: "Las Vegas",    iata: "LAS" },
  KBOS: { name: "Logan",           lat: 42.3656, lon: -71.0096, city: "Boston",        iata: "BOS" },
  KSFO: { name: "San Francisco",   lat: 37.6213, lon: -122.379, city: "San Francisco", iata: "SFO" },
  KIAH: { name: "Bush IAH",        lat: 29.9902, lon: -95.3368, city: "Houston",       iata: "IAH" },
  KDTW: { name: "Detroit Metro",   lat: 42.2162, lon: -83.3554, city: "Detroit",       iata: "DTW" },
  KMSP: { name: "MSP",             lat: 44.882,  lon: -93.2218, city: "Minneapolis",   iata: "MSP" },
}

export const HUB_AIRPORTS = new Set(["KORD", "KATL", "KDFW", "KDEN"])
