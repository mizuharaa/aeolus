"""
Community ADS-B aggregator client — the production live-aircraft feed.

Why this exists: OpenSky blocks datacenter IPs (Railway, Vercel edge + Node,
AWS all measured blocked), so `OpenSkyClient` returns nothing in production
even with valid OAuth credentials. adsb.lol and adsb.fi serve the same ADS-B
picture over keyless HTTP and allow server access.

  primary   adsb.fi   GET  /api/v2/lat/{lat}/lon/{lon}/dist/{nm} → {"aircraft": [...]}
  fallback  adsb.lol  GET  /v2/point/{lat}/{lon}/{radius_nm}   → {"ac": [...]}

Both return the same readsb/tar1090 aircraft JSON, so one parser covers both.

Coverage: these are point+radius APIs (250 nm max), not bounding boxes, so one
"US box" request is impossible. Instead we query a small set of points derived
from the Nimbus Air airport list (deduped at 200 nm), merge by ICAO hex keeping
the freshest position, and apply the same US bounding box filter OpenSky's
`/states/all` applied server-side. Requests to one provider are sequential,
spaced by one second — both providers 429 above roughly 1 request/second.

Public surface and normalised flight dict are identical to `OpenSkyClient`.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from typing import NamedTuple, Optional

import httpx

from src.data.airlines import AIRLINE_NAMES, callsign_to_iata_flight
from src.data.feed import LiveFlightFeed
from src.data.opensky import US_BBOX
from src.network import cache

logger = logging.getLogger(__name__)

# Max radius both providers accept.
QUERY_RADIUS_NM = 250
# Two query points closer than this are redundant — drop one.
POINT_MERGE_NM = 200

REQUEST_TIMEOUT_SEC = 8.0
# Whole-provider budget: 13 points at 1 req/s plus request time.
FETCH_BUDGET_SEC = 45.0

# These feeds are volunteer-run; be a polite client.
USER_AGENT = "olus-api/0.2 (+https://olus.sh)"

CACHE_TTL_SEC = 30


class _Provider(NamedTuple):
    name: str
    url: str  # .format(lat=, lon=, radius=)
    key: str  # response key holding the aircraft list
    delay: float  # seconds between sequential requests


# adsb.fi first: measured 2026-09-15, adsb.lol returned 429 on 10 of 13 points of a
# sweep even at 2 s spacing, so it only ever completed through the fallback. adsb.fi
# held at 1 request/second for the whole sweep.
PROVIDERS: tuple[_Provider, ...] = (
    _Provider(
        name="adsb.fi",
        url="https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{radius}",
        key="aircraft",
        delay=1.0,  # documented limit: ~1 request/second
    ),
    _Provider(
        name="adsb.lol",
        url="https://api.adsb.lol/v2/point/{lat}/{lon}/{radius}",
        key="ac",
        delay=2.0,  # measured: even 2 s spacing draws 429s; fallback only
    ),
)

ROUTESET_URL = "https://api.adsb.lol/api/0/routeset"

# readsb `type` → the position_source label OpenSky's parser emits.
_SOURCE_LABELS = {
    "adsb_icao": "ADS-B",
    "adsb_icao_nt": "ADS-B",
    "adsr_icao": "ADS-B",
    "adsb_other": "ADS-B",
    "adsr_other": "ADS-B",
    "mlat": "MLAT",
    "tisb_icao": "TIS-B",
    "tisb_trackfile": "TIS-B",
    "tisb_other": "TIS-B",
    "mode_s": "Mode-S",
    "mode_ac": "Mode-A/C",
}


def _nm_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in nautical miles."""
    r = 3440.065
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def hub_points(airports: Optional[list[dict]] = None) -> list[tuple[float, float]]:
    """
    Query points covering every network airport, deduped at POINT_MERGE_NM.

    Greedy: walk the airports in order, keep one only if it is further than
    POINT_MERGE_NM from every point kept so far. Every dropped airport is then
    within QUERY_RADIUS_NM of a kept point, so coverage is complete.
    """
    rows = cache.get_airports() if airports is None else airports
    points: list[tuple[float, float]] = []
    for ap in rows:
        lat, lon = ap.get("lat"), ap.get("lon")
        if lat is None or lon is None:
            continue
        if all(_nm_between(lat, lon, p[0], p[1]) > POINT_MERGE_NM for p in points):
            points.append((round(float(lat), 4), round(float(lon), 4)))
    return points


def _in_us_bbox(lat: float, lon: float) -> bool:
    return (
        US_BBOX["lamin"] <= lat <= US_BBOX["lamax"] and US_BBOX["lomin"] <= lon <= US_BBOX["lomax"]
    )


class AdsbClient(LiveFlightFeed):
    """
    Keyless community ADS-B client — same public surface as `OpenSkyClient`.

    Usage:
        client = AdsbClient()
        flights = await client.get_us_flights()
    """

    def __init__(self, points: Optional[list[tuple[float, float]]] = None) -> None:
        super().__init__(cache_ttl=CACHE_TTL_SEC)
        self._points = points if points is not None else hub_points()
        self._provider: Optional[str] = None
        logger.info(
            "ADS-B: %s primary, %s fallback — %d query points at %d nm",
            PROVIDERS[0].name,
            PROVIDERS[1].name,
            len(self._points),
            QUERY_RADIUS_NM,
        )

    # ── Public API ────────────────────────────────────────────────────────────
    #
    # get_us_flights / search / get_by_icao24 and the stale-while-revalidate
    # cache live in LiveFlightFeed; this client only supplies the fetch.

    async def _fetch_flights(self) -> Optional[list[dict]]:
        for provider in PROVIDERS:
            try:
                merged = await asyncio.wait_for(
                    self._fetch_provider(provider), timeout=FETCH_BUDGET_SEC
                )
            except Exception as exc:
                self._last_error = f"{provider.name}: {exc}"
                logger.warning("ADS-B: %s failed — %s", provider.name, exc)
                continue
            self._provider = provider.name
            return self._parse_states({"ac": list(merged.values())})
        return None

    async def _fetch_provider(self, provider: _Provider) -> dict[str, dict]:
        """
        Query every point sequentially; merge by hex keeping the freshest.

        One bad point (a 429, a blip) costs that circle, not the whole refresh.
        But a provider that drops most of the circles would leave half the map
        empty and still look "up", so once more than half the points have
        failed the provider counts as down and the fallback takes over.
        """
        merged: dict[str, dict] = {}
        failures = 0
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SEC, headers={"User-Agent": USER_AGENT}
        ) as client:
            for i, (lat, lon) in enumerate(self._points):
                if i:
                    await asyncio.sleep(provider.delay)
                try:
                    resp = await client.get(
                        provider.url.format(lat=lat, lon=lon, radius=QUERY_RADIUS_NM)
                    )
                    resp.raise_for_status()
                except Exception as exc:
                    failures += 1
                    logger.warning(
                        "ADS-B: %s point %s,%s failed — %s", provider.name, lat, lon, exc
                    )
                    if failures * 2 > len(self._points):
                        raise
                    continue
                for ac in resp.json().get(provider.key) or []:
                    hexid = (ac.get("hex") or "").lower()
                    if not hexid:
                        continue
                    prev = merged.get(hexid)
                    if prev is None or _seen_pos(ac) < _seen_pos(prev):
                        merged[hexid] = ac
        return merged

    async def get_route(self, icao24: str, hours_back: int = 36) -> Optional[dict]:
        """
        Resolve the current leg's departure/arrival airports via adsb.lol's
        routeset lookup. Same response shape as `OpenSkyClient.get_route`,
        except the timestamps: routeset describes the *scheduled route* of the
        callsign, not a flown leg, so departure_time/arrival_time are None and
        `hours_back` has no meaning here.

        adsb.fi has no route endpoint — when it is the active provider this
        returns None.
        """
        if self._provider == PROVIDERS[1].name:
            return None
        flight = await self.get_by_icao24(icao24)
        if flight is None or not flight["callsign"]:
            return None

        try:
            async with httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT_SEC, headers={"User-Agent": USER_AGENT}
            ) as client:
                resp = await client.post(
                    ROUTESET_URL,
                    json={
                        "planes": [
                            {
                                "callsign": flight["callsign"],
                                "lat": flight["lat"],
                                "lng": flight["lon"],
                            }
                        ]
                    },
                )
                resp.raise_for_status()
                rows = resp.json() or []
        except Exception as exc:
            self._last_error = f"routeset_error: {exc}"
            logger.debug("ADS-B get_route(%s) failed: %s", icao24, exc)
            return None

        if not rows:
            return None
        airports = rows[0].get("_airports") or []
        if len(airports) < 2:
            return None
        return {
            "icao24": flight["icao24"],
            "callsign": flight["callsign"],
            "departure_icao": airports[0].get("icao"),
            "arrival_icao": airports[-1].get("icao"),
            "departure_time": None,
            "arrival_time": None,
        }

    def status(self) -> dict:
        return {
            **super().status(),
            "provider": self._provider or PROVIDERS[0].name,
            # Keyless public feeds — no credential to be valid or not, but
            # /flights/live and /health read this key from OpenSky's status.
            "authenticated": False,
            "query_points": len(self._points),
        }

    # ── Private ───────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_states(raw: dict) -> list[dict]:
        """
        Convert merged readsb/tar1090 aircraft JSON to the same normalised
        dicts `OpenSkyClient._parse_states` produces.

        readsb field → flight dict:
          hex        → icao24 (lower)
          flight     → callsign (stripped; rows without one are skipped)
          lat / lon  → lat / lon        (rows outside US_BBOX are dropped)
          alt_baro   → altitude_ft      (already feet; "ground" → on_ground)
          gs         → velocity_kt      (already knots)
          track      → heading          (degrees true; true_heading on ground)
          baro_rate  → vertical_fpm     (already ft/min; geom_rate fallback)
          squawk     → squawk
          seen_pos   → time_position = now - seen_pos (seconds since fix)
          type       → position_source label

        `category` stays None: readsb reports "A1".."C5" strings while OpenSky
        reports integers, and nothing in the API or the web app reads the field
        (grep: only written, never consumed), so translating it would be
        inventing a mapping no caller checks.
        """
        now = time.time()
        flights: list[dict] = []

        for ac in raw.get("ac", []) or []:
            callsign_raw = (ac.get("flight") or "").strip()
            if not callsign_raw:
                continue

            lat, lon = ac.get("lat"), ac.get("lon")
            if lat is None or lon is None or not _in_us_bbox(lat, lon):
                continue

            icao24 = (ac.get("hex") or "").lower()

            alt_baro = ac.get("alt_baro")
            on_ground = alt_baro == "ground"
            alt_ft = round(alt_baro) if isinstance(alt_baro, (int, float)) else None

            gs = ac.get("gs")
            vel_kt = round(gs) if isinstance(gs, (int, float)) else None

            # track is absent on the ground; the heading fields stand in.
            heading = ac.get("track")
            if heading is None:
                heading = ac.get("true_heading", ac.get("mag_heading"))

            vert = ac.get("baro_rate", ac.get("geom_rate"))
            vert_fpm = round(vert) if isinstance(vert, (int, float)) else None

            # seen_pos = seconds since the position was received.
            time_position = int(now - _seen_pos(ac, default=0.0))

            iata_airline, flight_num = callsign_to_iata_flight(callsign_raw)
            flight_iata = (iata_airline + flight_num) if iata_airline and flight_num else None
            airline_name = AIRLINE_NAMES.get(iata_airline, "Unknown") if iata_airline else "Unknown"

            tracking = {
                "flightaware": f"https://www.flightaware.com/live/flight/{callsign_raw}",
                "flightradar24": (
                    f"https://www.flightradar24.com/{flight_iata}"
                    if flight_iata
                    else f"https://www.flightradar24.com/{callsign_raw}"
                ),
                "adsbexchange": f"https://globe.adsbexchange.com/?icao={icao24}",
                "opensky": f"https://opensky-network.org/aircraft-profile?icao24={icao24}",
            }

            flights.append(
                {
                    "icao24": icao24,
                    "callsign": callsign_raw,
                    "flight_iata": flight_iata,
                    "flight_icao": callsign_raw,
                    "airline_iata": iata_airline or None,
                    "airline_name": airline_name,
                    # readsb carries no registration country — the feed knows
                    # the tail (`r`) but not the state of registry.
                    "origin_country": "",
                    "lat": lat,
                    "lon": lon,
                    "altitude_ft": alt_ft,
                    "on_ground": on_ground,
                    "velocity_kt": vel_kt,
                    "heading": heading,
                    "vertical_fpm": vert_fpm,
                    "squawk": ac.get("squawk"),
                    "time_position": time_position,
                    "last_contact": time_position,  # frontend uses last_contact for DR
                    "position_source": _SOURCE_LABELS.get(ac.get("type", ""), "unknown"),
                    "category": None,
                    "tracking": tracking,
                }
            )

        return flights


def _seen_pos(ac: dict, default: float = float("inf")) -> float:
    """Seconds since this aircraft's position fix (smaller = fresher)."""
    value = ac.get("seen_pos")
    return float(value) if isinstance(value, (int, float)) else default
