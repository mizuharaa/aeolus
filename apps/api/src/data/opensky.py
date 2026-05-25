"""
OpenSky Network real-time flight data client.

Authentication: OAuth2 client_credentials flow (preferred).
Falls back to anonymous if no credentials are supplied.

Authenticated rate: 5-second ADS-B resolution, credit-based (no hard cap).
Anonymous rate: 10-second resolution, very limited.

Token is fetched once and cached for 25 minutes (tokens expire in 30 min).
US + approaches bounding box: CONUS + Alaska + Hawaii.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

import httpx

from src.data.airlines import (
    AIRLINE_NAMES,
    callsign_to_iata_flight,
    parse_flight_query,
)

logger = logging.getLogger(__name__)

OPENSKY_BASE = "https://opensky-network.org/api"
OPENSKY_TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network" "/protocol/openid-connect/token"
)

# Bounding box: CONUS + Alaska + Hawaii
US_BBOX = {"lamin": 15.0, "lamax": 72.0, "lomin": -180.0, "lomax": -50.0}

# Cache TTL: 15s authenticated (5s ADS-B resolution + headroom), 30s anonymous
CACHE_TTL_AUTHENTICATED = 15
CACHE_TTL_ANONYMOUS = 30

# Token refresh 5 min before expiry (tokens last 30 min)
TOKEN_REFRESH_BUFFER_SEC = 300


class OpenSkyClient:
    """
    Async OpenSky Network client with OAuth2 Bearer token auth.

    Usage:
        client = OpenSkyClient(client_id="...", client_secret="...")
        flights = await client.get_us_flights()
    """

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        # Legacy basic-auth params (kept for backwards compat — ignored now)
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self._client_id = client_id or ""
        self._client_secret = client_secret or ""
        self._has_oauth = bool(client_id and client_secret)

        # OAuth2 token cache
        self._token: Optional[str] = None
        self._token_expires: float = 0.0
        self._token_lock = asyncio.Lock()

        # Flight state cache
        self._cache: list[dict] = []
        self._cache_ts: float = 0.0
        self._lock = asyncio.Lock()
        self._last_error: Optional[str] = None

        if self._has_oauth:
            logger.info("OpenSky: OAuth2 client_credentials mode (client_id=%s)", client_id)
        else:
            logger.info("OpenSky: anonymous mode (set OPENSKY_CLIENT_ID/SECRET for better limits)")

    # ── Token management ──────────────────────────────────────────────────────

    async def _get_token(self) -> Optional[str]:
        """Return a valid Bearer token, refreshing if needed."""
        if not self._has_oauth:
            return None

        async with self._token_lock:
            if self._token and time.monotonic() < self._token_expires:
                return self._token

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        OPENSKY_TOKEN_URL,
                        data={
                            "grant_type": "client_credentials",
                            "client_id": self._client_id,
                            "client_secret": self._client_secret,
                        },
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    self._token = data["access_token"]
                    expires_in = data.get("expires_in", 1800)
                    self._token_expires = time.monotonic() + expires_in - TOKEN_REFRESH_BUFFER_SEC
                    logger.info("OpenSky: OAuth2 token obtained (expires in %ds)", expires_in)
                    return self._token
            except Exception as exc:
                logger.warning("OpenSky: token fetch failed — %s", exc)
                self._last_error = f"token_error: {exc}"
                return None

    # ── Public API ────────────────────────────────────────────────────────────

    async def get_us_flights(self, force: bool = False) -> list[dict]:
        """
        Return all tracked flights over US airspace.
        Cached for CACHE_TTL seconds. Returns normalised flight dicts.
        """
        ttl = CACHE_TTL_AUTHENTICATED if self._has_oauth else CACHE_TTL_ANONYMOUS

        async with self._lock:
            age = time.monotonic() - self._cache_ts
            if not force and self._cache and age < ttl:
                return self._cache

            raw = await self._fetch_states(**US_BBOX)
            if raw is not None:
                self._cache = self._parse_states(raw)
                self._cache_ts = time.monotonic()
                self._last_error = None
                logger.debug(
                    "OpenSky: cached %d US flights (auth=%s)", len(self._cache), self._has_oauth
                )
            elif self._cache:
                logger.debug("OpenSky fetch failed — returning stale cache (%d)", len(self._cache))
            else:
                logger.warning("OpenSky fetch failed — no cache available")

            return self._cache

    async def search(self, query: str) -> list[dict]:
        """Search live flights by IATA/ICAO flight number (e.g. 'AA123', 'UAL456')."""
        flights = await self.get_us_flights()
        q = query.strip().upper()
        if not q:
            return []

        icao_prefix, iata_code, num = parse_flight_query(q)
        results: list[dict] = []

        if icao_prefix:
            target = icao_prefix + num
            results = [f for f in flights if f["callsign"].startswith(target)]

        if not results and iata_code:
            target = iata_code + num
            results = [f for f in flights if (f.get("flight_iata") or "").startswith(target)]

        if not results:
            results = [f for f in flights if q in f["callsign"]]

        return results[:20]

    async def get_by_icao24(self, icao24: str) -> Optional[dict]:
        """Look up a single aircraft by ICAO 24-bit transponder hex."""
        flights = await self.get_us_flights()
        target = icao24.lower().strip()
        return next((f for f in flights if f["icao24"] == target), None)

    async def get_route(self, icao24: str, hours_back: int = 36) -> Optional[dict]:
        """
        Resolve the most recent flight leg for an aircraft — including its
        ICAO departure / arrival airports — via OpenSky's `/flights/aircraft`
        endpoint.

        The basic `/states/all` feed (used by `get_us_flights`) carries only
        live position vectors, NOT route info. Operators looking up "AA123"
        want to see WHERE the plane is going, not just its altitude. This
        endpoint backs that drill-down by returning the most recent flight
        leg (or `None` if the aircraft hasn't flown in `hours_back` hours).

        Note: OpenSky's flights endpoint is a separate rate-limit budget
        from states/all and can be slow (~1–3 s). Results are cached on
        the client by callers (see routes/flights.py).

        Response shape:
            {
              "icao24":           "abc123",
              "callsign":         "AAL123  ",
              "departure_icao":   "KLAX",
              "arrival_icao":     "KJFK",
              "departure_time":   1715632245,
              "arrival_time":     1715648100,
            }
        """
        target = icao24.lower().strip()
        if not target:
            return None
        now = int(time.time())
        begin = now - hours_back * 3600
        params: dict = {"icao24": target, "begin": begin, "end": now}
        headers: dict = {}
        token = await self._get_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{OPENSKY_BASE}/flights/aircraft",
                    params=params,
                    headers=headers,
                )
                if resp.status_code == 404:
                    # OpenSky returns 404 when there are no flights in the window
                    return None
                if resp.status_code in (401, 429):
                    self._token = None
                    self._token_expires = 0.0
                    self._last_error = "flights_endpoint_rate_or_auth"
                    return None
                resp.raise_for_status()
                rows = resp.json() or []
        except httpx.TimeoutException:
            self._last_error = "flights_route_timeout"
            return None
        except Exception as exc:
            self._last_error = f"flights_route_error: {exc}"
            logger.debug("OpenSky get_route(%s) failed: %s", icao24, exc)
            return None

        if not rows:
            return None
        # Pick the most recent leg (highest lastSeen).
        leg = max(rows, key=lambda r: r.get("lastSeen", 0))
        return {
            "icao24": (leg.get("icao24") or target).lower(),
            "callsign": (leg.get("callsign") or "").strip(),
            "departure_icao": leg.get("estDepartureAirport"),
            "arrival_icao": leg.get("estArrivalAirport"),
            "departure_time": leg.get("firstSeen"),
            "arrival_time": leg.get("lastSeen"),
        }

    def status(self) -> dict:
        return {
            "cached_flights": len(self._cache),
            "cache_age_sec": round(time.monotonic() - self._cache_ts, 1),
            "authenticated": self._has_oauth,
            "token_valid": bool(self._token and time.monotonic() < self._token_expires),
            "last_error": self._last_error,
        }

    # ── Private ───────────────────────────────────────────────────────────────

    async def _fetch_states(
        self, lamin: float, lamax: float, lomin: float, lomax: float
    ) -> Optional[dict]:
        params: dict = {
            "lamin": lamin,
            "lamax": lamax,
            "lomin": lomin,
            "lomax": lomax,
            "extended": 1,
        }
        headers: dict = {}

        token = await self._get_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{OPENSKY_BASE}/states/all",
                    params=params,
                    headers=headers,
                )
                if resp.status_code == 401:
                    # Token may have expired mid-flight — force refresh next call
                    self._token = None
                    self._token_expires = 0.0
                    self._last_error = "auth_expired"
                    logger.warning("OpenSky: 401 — token expired, will refresh on next call")
                    return None
                if resp.status_code == 429:
                    self._last_error = "rate_limited"
                    logger.warning("OpenSky: rate-limited (429)")
                    return None
                resp.raise_for_status()
                return resp.json()
        except httpx.TimeoutException:
            self._last_error = "timeout"
            logger.warning("OpenSky: request timed out")
            return None
        except Exception as exc:
            self._last_error = str(exc)
            logger.warning("OpenSky: fetch error — %s", exc)
            return None

    @staticmethod
    def _parse_states(raw: dict) -> list[dict]:
        """
        Convert raw OpenSky states/all response to normalised dicts.

        State vector field indices:
          0  icao24          str
          1  callsign        str | None
          2  origin_country  str
          3  time_position   int | None  ← actual ADS-B position timestamp
          4  last_contact    int         ← last time we heard from this transponder
          5  longitude       float | None
          6  latitude        float | None
          7  baro_altitude   float | None  (metres)
          8  on_ground       bool
          9  velocity        float | None  (m/s ground speed)
          10 true_track      float | None  (degrees, 0=north, CW)
          11 vertical_rate   float | None  (m/s, + = climbing)
          12 sensors         list | None
          13 geo_altitude    float | None  (metres)
          14 squawk          str | None
          15 spi             bool
          16 position_source int (0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM)
          17 category        int (only when extended=1)
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

            # Use time_position (sv[3]) for dead-reckoning — it's when the
            # position was actually observed. Fall back to last_contact (sv[4]).
            time_position = sv[3] or sv[4] or 0
            sv[4] or 0

            # velocity: m/s → knots (1 m/s = 1.944 kt)
            vel_ms = sv[9]
            vel_kt = round(vel_ms * 1.944) if vel_ms is not None else None

            # altitude: metres → feet (1 m = 3.281 ft)
            alt_m = sv[7] if sv[7] is not None else sv[13]
            alt_ft = round(alt_m * 3.281) if alt_m is not None else None

            # vertical rate: m/s → ft/min (1 m/s = 196.85 fpm)
            vert_ms = sv[11]
            vert_fpm = round(vert_ms * 196.85) if vert_ms is not None else None

            heading = sv[10]
            squawk = sv[14]
            pos_src = sv[16] if len(sv) > 16 else 0
            category = sv[17] if len(sv) > 17 else None

            # Derive IATA airline code and flight number from ICAO callsign
            iata_airline, flight_num = callsign_to_iata_flight(callsign_raw)
            flight_iata = (iata_airline + flight_num) if iata_airline and flight_num else None
            airline_name = (
                AIRLINE_NAMES.get(iata_airline, sv[2] or "Unknown") if iata_airline else "Unknown"
            )

            # Tracking URLs — use IATA flight number for FR24/FA when available
            tracking = {
                "flightaware": (
                    f"https://www.flightaware.com/live/flight/{callsign_raw}"
                    if callsign_raw
                    else None
                ),
                "flightradar24": (
                    f"https://www.flightradar24.com/{flight_iata}"
                    if flight_iata
                    else f"https://www.flightradar24.com/{callsign_raw}"
                ),
                "adsbexchange": f"https://globe.adsbexchange.com/?icao={icao24}",
                "opensky": f"https://opensky-network.org/aircraft-profile?icao24={icao24}",
            }

            # position_source label for debugging
            src_label = {0: "ADS-B", 1: "ASTERIX", 2: "MLAT", 3: "FLARM"}.get(pos_src, "unknown")

            flights.append(
                {
                    "icao24": icao24,
                    "callsign": callsign_raw,
                    "flight_iata": flight_iata,
                    "flight_icao": callsign_raw,
                    "airline_iata": iata_airline or None,
                    "airline_name": airline_name,
                    "origin_country": sv[2] or "",
                    "lat": lat,
                    "lon": lon,
                    "altitude_ft": alt_ft,
                    "on_ground": on_ground,
                    "velocity_kt": vel_kt,
                    "heading": heading,
                    "vertical_fpm": vert_fpm,
                    "squawk": squawk,
                    # time_position is what dead reckoning should use
                    "time_position": time_position,
                    "last_contact": time_position,  # frontend uses last_contact for DR
                    "position_source": src_label,
                    "category": category,
                    "tracking": tracking,
                }
            )

        return flights
