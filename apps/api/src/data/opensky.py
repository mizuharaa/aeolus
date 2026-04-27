"""
OpenSky Network real-time flight data client.

Free API — anonymous requests are rate-limited (100 req/10min).
Authenticated access (600 req/10min) via OPENSKY_USERNAME/OPENSKY_PASSWORD.

US + approaches bounding box covers the continental US, Alaska, and Hawaii.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

import httpx

from src.data.airlines import (
    ICAO_TO_IATA,
    IATA_TO_ICAO,
    AIRLINE_NAMES,
    callsign_to_iata_flight,
    parse_flight_query,
    get_aircraft_info,
)

logger = logging.getLogger(__name__)

OPENSKY_BASE = "https://opensky-network.org/api"

# Bounding box: covers CONUS + Alaska + Hawaii approaches
US_BBOX = {"lamin": 15.0, "lamax": 72.0, "lomin": -180.0, "lomax": -50.0}

# Cache TTL in seconds — OpenSky anonymous limit is 10 credits/10 min
CACHE_TTL_SEC = 30


class OpenSkyClient:
    """
    Async client for the OpenSky Network REST API.

    Maintains a 30-second cache of US flight states to respect rate limits.
    Thread/task-safe via asyncio.Lock.
    """

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self._auth = (username, password) if username and password else None
        self._cache: list[dict] = []
        self._cache_ts: float = 0.0
        self._lock = asyncio.Lock()
        self._last_error: Optional[str] = None

    # ── Public API ────────────────────────────────────────────────────────────

    async def get_us_flights(self, force: bool = False) -> list[dict]:
        """
        Return all tracked flights over US airspace.
        Cached for CACHE_TTL_SEC seconds.
        Returns normalised flight dicts (see _normalise_state).
        """
        async with self._lock:
            age = time.monotonic() - self._cache_ts
            if not force and self._cache and age < CACHE_TTL_SEC:
                return self._cache

            raw = await self._fetch_states(**US_BBOX)
            if raw is not None:
                self._cache = self._parse_states(raw)
                self._cache_ts = time.monotonic()
                self._last_error = None
                logger.debug("OpenSky: cached %d US flights", len(self._cache))
            elif self._cache:
                logger.debug("OpenSky fetch failed — returning stale cache (%d flights)", len(self._cache))
            else:
                logger.warning("OpenSky fetch failed — no cache available")

            return self._cache

    async def search(self, query: str) -> list[dict]:
        """
        Search live flights by IATA/ICAO flight number (e.g. 'AA123', 'UAL456').
        Returns up to 20 matching flights.
        """
        flights = await self.get_us_flights()
        q = query.strip().upper()
        if not q:
            return []

        icao_prefix, iata_code, num = parse_flight_query(q)

        results: list[dict] = []

        # 1. Exact ICAO callsign prefix match (e.g. 'AAL123')
        if icao_prefix:
            target = icao_prefix + num
            results = [f for f in flights if f["callsign"].startswith(target)]

        # 2. IATA callsign prefix (e.g. 'AA123')
        if not results and iata_code:
            target = iata_code + num
            results = [f for f in flights if
                       f.get("flight_iata", "").startswith(target)]

        # 3. Substring in callsign
        if not results:
            results = [f for f in flights if q in f["callsign"]]

        return results[:20]

    async def get_by_icao24(self, icao24: str) -> Optional[dict]:
        """Look up a single aircraft by its 24-bit ICAO transponder hex."""
        flights = await self.get_us_flights()
        target = icao24.lower().strip()
        for f in flights:
            if f["icao24"] == target:
                return f
        return None

    def status(self) -> dict:
        """Return cache status — useful for health checks."""
        return {
            "cached_flights": len(self._cache),
            "cache_age_sec": round(time.monotonic() - self._cache_ts, 1),
            "authenticated": self._auth is not None,
            "last_error": self._last_error,
        }

    # ── Private ───────────────────────────────────────────────────────────────

    async def _fetch_states(
        self,
        lamin: float,
        lamax: float,
        lomin: float,
        lomax: float,
    ) -> Optional[dict]:
        params: dict = {
            "lamin": lamin,
            "lamax": lamax,
            "lomin": lomin,
            "lomax": lomax,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{OPENSKY_BASE}/states/all",
                    params=params,
                    auth=self._auth,
                )
                if resp.status_code == 429:
                    self._last_error = "rate_limited"
                    logger.warning("OpenSky: rate-limited (429). Use credentials to increase quota.")
                    return None
                if resp.status_code == 401:
                    self._last_error = "auth_error"
                    logger.warning("OpenSky: auth error (401).")
                    return None
                resp.raise_for_status()
                return resp.json()
        except httpx.TimeoutException:
            self._last_error = "timeout"
            logger.warning("OpenSky: request timed out.")
            return None
        except Exception as exc:
            self._last_error = str(exc)
            logger.warning("OpenSky: fetch error — %s", exc)
            return None

    @staticmethod
    def _parse_states(raw: dict) -> list[dict]:
        """
        Convert raw OpenSky states/all response to normalised dicts.

        OpenSky state vector indices:
          0  icao24          str
          1  callsign        str | None
          2  origin_country  str
          3  time_position   int | None  (unix ts of last position)
          4  last_contact    int
          5  longitude       float | None
          6  latitude        float | None
          7  baro_altitude   float | None  (metres)
          8  on_ground       bool
          9  velocity        float | None  (m/s true airspeed)
          10 true_track      float | None  (degrees, 0=north, clockwise)
          11 vertical_rate   float | None  (m/s, + = climbing)
          12 sensors         list | None
          13 geo_altitude    float | None  (metres)
          14 squawk          str | None
          15 spi             bool
          16 position_source int (0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM)
        """
        flights: list[dict] = []

        for sv in raw.get("states", []) or []:
            if not sv or len(sv) < 17:
                continue

            callsign_raw = (sv[1] or "").strip()
            if not callsign_raw:
                continue

            lat = sv[6]
            lon = sv[5]
            if lat is None or lon is None:
                continue

            icao24 = (sv[0] or "").lower()
            on_ground = bool(sv[8])

            # Velocity: m/s → knots
            vel_ms = sv[9]
            vel_kt = round(vel_ms * 1.944) if vel_ms is not None else None

            # Altitude: metres → feet
            alt_m = sv[7] if sv[7] is not None else sv[13]
            alt_ft = round(alt_m * 3.281) if alt_m is not None else None

            # Vertical rate: m/s → ft/min
            vert_ms = sv[11]
            vert_fpm = round(vert_ms * 196.85) if vert_ms is not None else None

            heading = sv[10]  # degrees
            squawk = sv[14]
            last_contact = sv[4]

            # Derive IATA flight number
            iata_airline, flight_num = callsign_to_iata_flight(callsign_raw)
            flight_iata = (iata_airline + flight_num) if iata_airline else None
            airline_name = AIRLINE_NAMES.get(iata_airline, sv[2] or "Unknown")

            # Tracking URLs
            tracking = {
                "flightaware": (
                    f"https://flightaware.com/live/flight/{callsign_raw.rstrip()}"
                    if callsign_raw else None
                ),
                "flightradar24": (
                    f"https://www.flightradar24.com/{flight_iata}"
                    if flight_iata else f"https://www.flightradar24.com/{callsign_raw.rstrip()}"
                ),
                "adsbexchange": f"https://globe.adsbexchange.com/?icao={icao24}",
                "opensky": f"https://opensky-network.org/aircraft-profile?icao24={icao24}",
            }

            flights.append({
                "icao24":        icao24,
                "callsign":      callsign_raw,
                "flight_iata":   flight_iata,
                "flight_icao":   callsign_raw.rstrip(),
                "airline_iata":  iata_airline or None,
                "airline_name":  airline_name,
                "origin_country":sv[2] or "",
                "lat":           lat,
                "lon":           lon,
                "altitude_ft":   alt_ft,
                "on_ground":     on_ground,
                "velocity_kt":   vel_kt,
                "heading":       heading,
                "vertical_fpm":  vert_fpm,
                "squawk":        squawk,
                "last_contact":  last_contact,
                "position_source": sv[16],
                "tracking":      tracking,
            })

        return flights
