"""
Async METAR client for aviationweather.gov.
No API key required. Fetches real-time observations for Nimbus Air airports.
Refreshes every 5 minutes (configurable) via background task.
"""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Airports in the Nimbus Air network (ICAO codes)
NIMBUS_AIRPORTS: list[str] = [
    "KORD",
    "KATL",
    "KDFW",
    "KLAX",
    "KDEN",
    "KJFK",
    "KSEA",
    "KMIA",
    "KPHX",
    "KLAS",
    "KBOS",
    "KSFO",
    "KIAH",
    "KDTW",
    "KMSP",
]

BASE_URL = "https://aviationweather.gov/api/data/metar"

# Flight category IFR minima
FLIGHT_CATEGORY_THRESHOLDS = {
    # ceiling_ft, visibility_sm -> category
    "LIFR": (500, 1.0),
    "IFR": (1000, 3.0),
    "MVFR": (3000, 5.0),
    "VFR": (99999, 99.0),
}


def _safe_float(value, default: float) -> float:
    """Parse a value to float, tolerating METAR quirks like '10+' or 'M03'."""
    if value is None or value == "":
        return default
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().rstrip("+").lstrip("M").replace(",", ".")
    try:
        return float(s)
    except (ValueError, TypeError):
        return default


def _safe_int(value, default: int) -> int:
    return int(_safe_float(value, float(default)))


class MetarData:
    """Parsed METAR observation for one airport."""

    def __init__(self, raw: dict):
        self.station_id: str = raw.get("station_id", "")
        self.observation_time: str = raw.get("observation_time", "")
        self.temp_c: float = _safe_float(raw.get("temp_c"), 15.0)
        self.dewpoint_c: float = _safe_float(raw.get("dewpoint_c"), 10.0)
        self.wind_dir_degrees: int = _safe_int(raw.get("wind_dir_degrees"), 0)
        self.wind_speed_kt: int = _safe_int(raw.get("wind_speed_kt"), 5)
        gust = raw.get("wind_gust_kt")
        self.wind_gust_kt: Optional[int] = _safe_int(gust, 0) if gust else None
        self.visibility_statute_mi: float = _safe_float(raw.get("visibility_statute_mi"), 10.0)
        sky = raw.get("sky_condition", [])
        if sky and isinstance(sky, list) and len(sky) > 0:
            first = sky[0]
            if isinstance(first, dict):
                self.ceiling_ft_agl: Optional[int] = first.get("cloud_base_ft_agl")
            else:
                self.ceiling_ft_agl = None
        else:
            self.ceiling_ft_agl = None

        self.flight_category: str = raw.get("flight_category", "VFR")
        self.wx_string: Optional[str] = raw.get("wx_string")
        self.altim_in_hg: float = _safe_float(raw.get("altim_in_hg"), 29.92)
        self.raw_text: str = raw.get("raw_text", "")

    def to_dict(self) -> dict:
        return {
            "station_id": self.station_id,
            "observation_time": self.observation_time,
            "temp_c": self.temp_c,
            "dewpoint_c": self.dewpoint_c,
            "wind_dir_degrees": self.wind_dir_degrees,
            "wind_speed_kt": self.wind_speed_kt,
            "wind_gust_kt": self.wind_gust_kt,
            "visibility_sm": self.visibility_statute_mi,
            "ceiling_ft": self.ceiling_ft_agl,
            "flight_category": self.flight_category,
            "wx_string": self.wx_string,
            "altim_in_hg": self.altim_in_hg,
            "raw_text": self.raw_text,
        }

    def is_ifr(self) -> bool:
        return self.flight_category in ("IFR", "LIFR")

    def is_mvfr(self) -> bool:
        return self.flight_category == "MVFR"

    def visibility_good(self) -> bool:
        return self.visibility_statute_mi >= 3.0

    def ceiling_good(self) -> bool:
        return self.ceiling_ft_agl is None or self.ceiling_ft_agl >= 1000


class WeatherClient:
    """
    Async client for aviationweather.gov METAR data.
    Maintains an in-memory cache; updates automatically in the background.
    """

    def __init__(
        self,
        airports: list[str] = NIMBUS_AIRPORTS,
        timeout: float = 10.0,
    ):
        self.airports = airports
        self.timeout = timeout
        self._cache: dict[str, MetarData] = {}
        self._last_fetch: Optional[datetime] = None
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def fetch_metars(self, airport_ids: list[str] | None = None) -> dict[str, MetarData]:
        """Fetch METAR observations for the given airports (or all Nimbus airports)."""
        ids = airport_ids or self.airports
        ids_str = ",".join(ids)
        client = self._get_client()

        try:
            response = await client.get(
                BASE_URL,
                params={
                    "ids": ids_str,
                    "format": "json",
                    "hours": 1,
                    "taf": "false",
                },
            )
            response.raise_for_status()
            data = response.json()

            result: dict[str, MetarData] = {}
            for item in data:
                # API returns different field name variants across versions
                station = item.get("icaoId") or item.get("stationId") or item.get("station_id", "")
                if station:
                    metar = self._parse_metar_response(item)
                    result[station] = metar
                    self._cache[station] = metar

            self._last_fetch = datetime.now(timezone.utc)
            logger.info("Fetched METARs for %d airports", len(result))
            return result

        except httpx.TimeoutException:
            logger.warning("METAR fetch timed out — returning cached data")
            return self._cache
        except httpx.HTTPStatusError as exc:
            logger.error("METAR fetch HTTP error: %s", exc)
            return self._cache or self._generate_dummy_metars(ids)
        except Exception as exc:
            logger.error("METAR fetch failed: %s", exc)
            return self._cache or self._generate_dummy_metars(ids)

    def _parse_metar_response(self, raw: dict) -> MetarData:
        """Normalise the aviationweather.gov JSON response into a MetarData object."""
        # Map various API field names to a canonical dict
        normalized: dict = {
            "station_id": raw.get("icaoId") or raw.get("stationId") or raw.get("station_id", ""),
            "observation_time": raw.get("reportTime") or raw.get("observation_time", ""),
            "temp_c": raw.get("temp") if raw.get("temp") is not None else raw.get("temp_c", 15.0),
            "dewpoint_c": raw.get("dewp")
            if raw.get("dewp") is not None
            else raw.get("dewpoint_c", 10.0),
            "wind_dir_degrees": raw.get("wdir")
            if raw.get("wdir") is not None
            else raw.get("wind_dir_degrees", 0),
            "wind_speed_kt": raw.get("wspd")
            if raw.get("wspd") is not None
            else raw.get("wind_speed_kt", 5),
            "wind_gust_kt": raw.get("wgst") or raw.get("wind_gust_kt"),
            "visibility_statute_mi": (
                raw.get("visib")
                if raw.get("visib") is not None
                else raw.get("visibility_statute_mi", 10.0)
            ),
            "flight_category": raw.get("fltcat") or raw.get("flight_category", "VFR"),
            "wx_string": raw.get("wxString") or raw.get("wx_string"),
            "altim_in_hg": raw.get("altim")
            if raw.get("altim") is not None
            else raw.get("altim_in_hg", 29.92),
            "raw_text": raw.get("rawOb") or raw.get("raw_text", ""),
        }

        # Sky condition / ceiling
        clouds = raw.get("clouds") or raw.get("sky_condition", [])
        if clouds and isinstance(clouds, list) and len(clouds) > 0:
            first_layer = clouds[0]
            if isinstance(first_layer, dict):
                base = first_layer.get("base") or first_layer.get("cloud_base_ft_agl")
                normalized["sky_condition"] = [{"cloud_base_ft_agl": base}]
            else:
                normalized["sky_condition"] = []
        else:
            normalized["sky_condition"] = []

        return MetarData(normalized)

    def _generate_dummy_metars(self, airport_ids: list[str]) -> dict[str, MetarData]:
        """Return plausible synthetic METARs when the API is unreachable."""
        result: dict[str, MetarData] = {}
        rng = random.Random(42)
        for aid in airport_ids:
            result[aid] = MetarData(
                {
                    "station_id": aid,
                    "observation_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "temp_c": rng.uniform(5.0, 28.0),
                    "dewpoint_c": rng.uniform(0.0, 18.0),
                    "wind_dir_degrees": rng.randint(0, 359),
                    "wind_speed_kt": rng.randint(3, 18),
                    "wind_gust_kt": None,
                    "visibility_statute_mi": 10.0,
                    "sky_condition": [],
                    "flight_category": "VFR",
                    "wx_string": None,
                    "altim_in_hg": 29.92,
                    "raw_text": f"{aid} AUTO METAR (SIMULATED)",
                }
            )
        return result

    async def start_background_fetch(self, interval_secs: int = 300) -> None:
        """Continuously refresh METAR data in the background."""
        while True:
            try:
                await self.fetch_metars()
            except Exception as exc:
                logger.error("Background METAR fetch error: %s", exc)
            await asyncio.sleep(interval_secs)

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ─── Cache accessors ──────────────────────────────────────────────────

    def get_cached(self, airport_id: str) -> Optional[dict]:
        """Return cached METAR dict for one airport, or None if not yet fetched."""
        metar = self._cache.get(airport_id)
        return metar.to_dict() if metar else None

    def get_all_cached(self) -> dict[str, dict]:
        """Return all cached METARs as plain dicts."""
        return {k: v.to_dict() for k, v in self._cache.items()}

    def cache_age_seconds(self) -> Optional[float]:
        """Return how many seconds ago the cache was last populated."""
        if self._last_fetch is None:
            return None
        return (datetime.now(timezone.utc) - self._last_fetch).total_seconds()
