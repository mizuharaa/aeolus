"""
Community ADS-B client — the checks that fail if the normalisation, the
hub point set, the bbox filter or the provider fallback break.

Fixtures are real responses recorded from a 50 nm query around 40.7,-73.9
(adsb.lol and adsb.fi), truncated to 20 aircraft. No network in CI; the one
live test is skipped unless ADSB_LIVE=1.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest

from src.data import adsb
from src.data.adsb import (
    POINT_MERGE_NM,
    PROVIDERS,
    QUERY_RADIUS_NM,
    AdsbClient,
    _nm_between,
    hub_points,
)
from src.data.opensky import OpenSkyClient
from src.network import cache

FIXTURES = Path(__file__).parent / "fixtures"


def _fixture(name: str, key: str) -> list[dict]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))[key]


LOL_ROWS = _fixture("adsblol_point.json", "ac")
FI_ROWS = _fixture("adsbfi_point.json", "aircraft")

# One OpenSky state vector (states/all, extended=1) to compare key sets against.
OPENSKY_RAW = {
    "time": 1789490835,
    "states": [
        [
            "a0a91e",  # icao24
            "UAL1343 ",  # callsign
            "United States",  # origin_country
            1789490834,  # time_position
            1789490835,  # last_contact
            -74.87,  # longitude
            40.80,  # latitude
            5007.0,  # baro_altitude (m)
            False,  # on_ground
            195.5,  # velocity (m/s)
            270.15,  # true_track
            10.08,  # vertical_rate (m/s)
            None,  # sensors
            5288.0,  # geo_altitude (m)
            "2723",  # squawk
            False,  # spi
            0,  # position_source
            4,  # category
        ]
    ],
}


def test_normalised_keys_match_opensky() -> None:
    """Callers read one flight dict shape — both parsers must produce it."""
    opensky_keys = set(OpenSkyClient._parse_states(OPENSKY_RAW)[0])
    parsed = AdsbClient._parse_states({"ac": LOL_ROWS})

    assert parsed, "fixture produced no flights"
    for flight in parsed:
        assert set(flight) == opensky_keys
        assert set(flight["tracking"]) == {
            "flightaware",
            "flightradar24",
            "adsbexchange",
            "opensky",
        }


def test_adsbfi_rows_normalise_identically() -> None:
    """Same readsb JSON from either provider → same parser, same shape."""
    opensky_keys = set(OpenSkyClient._parse_states(OPENSKY_RAW)[0])
    parsed = AdsbClient._parse_states({"ac": FI_ROWS})
    assert parsed
    assert all(set(f) == opensky_keys for f in parsed)


def test_units_are_passed_through_unconverted() -> None:
    """readsb is already knots / feet / ft-per-min — no OpenSky SI conversion."""
    row = next(r for r in LOL_ROWS if r.get("flight", "").strip().startswith("UAL"))
    flight = next(
        f for f in AdsbClient._parse_states({"ac": LOL_ROWS}) if f["icao24"] == row["hex"].lower()
    )

    assert flight["callsign"] == row["flight"].strip()
    assert flight["altitude_ft"] == round(row["alt_baro"])
    assert flight["velocity_kt"] == round(row["gs"])
    assert flight["heading"] == row["track"]
    assert flight["vertical_fpm"] == round(row["baro_rate"])
    assert flight["squawk"] == row["squawk"]
    assert flight["on_ground"] is False
    assert flight["position_source"] == "ADS-B"
    # readsb category strings ("A4") are not OpenSky's integers — see docstring.
    assert flight["category"] is None
    # time_position = now - seen_pos, so dead reckoning has a real epoch.
    assert 0 <= time.time() - flight["time_position"] < 60
    assert flight["last_contact"] == flight["time_position"]


def test_ground_aircraft() -> None:
    """alt_baro == "ground" is the only on-ground signal readsb gives."""
    row = next(r for r in LOL_ROWS if r.get("alt_baro") == "ground")
    flight = next(
        f for f in AdsbClient._parse_states({"ac": LOL_ROWS}) if f["icao24"] == row["hex"].lower()
    )
    assert flight["on_ground"] is True
    assert flight["altitude_ft"] is None
    # No `track` on the ground — heading falls back to the heading fields.
    assert flight["heading"] == row.get("track", row.get("true_heading"))


def test_bbox_filter_drops_aircraft_outside_us() -> None:
    inside = {"hex": "abc123", "flight": "AAL1 ", "lat": 40.7, "lon": -73.9, "alt_baro": 30000}
    outside = {"hex": "def456", "flight": "BAW1 ", "lat": 51.5, "lon": -0.12, "alt_baro": 30000}
    parsed = AdsbClient._parse_states({"ac": [inside, outside]})
    assert [f["icao24"] for f in parsed] == ["abc123"]


def test_rows_without_callsign_or_position_are_skipped() -> None:
    rows = [
        {"hex": "aaa111", "lat": 40.7, "lon": -73.9},  # no callsign
        {"hex": "bbb222", "flight": "AAL2 "},  # no position
    ]
    assert AdsbClient._parse_states({"ac": rows}) == []


def test_hub_points_cover_every_airport() -> None:
    airports = cache.get_airports()
    assert airports, "network YAML did not load"
    points = hub_points(airports)

    # 15 airports → 13 points today; one request each per refresh.
    assert 6 <= len(points) <= 13
    for ap in airports:
        nearest = min(_nm_between(ap["lat"], ap["lon"], p[0], p[1]) for p in points)
        assert nearest <= QUERY_RADIUS_NM, f"{ap['id']} is {nearest:.0f} nm from any query point"
    # Deduped: no two query points sit on top of each other.
    for i, a in enumerate(points):
        for b in points[i + 1 :]:
            assert _nm_between(a[0], a[1], b[0], b[1]) > POINT_MERGE_NM


# ── Fetch: fallback + merge ───────────────────────────────────────────────────


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    """Stands in for httpx.AsyncClient: one canned response per request."""

    def __init__(self, payloads: list) -> None:
        self._payloads = list(payloads)
        self.urls: list[str] = []

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *_exc: object) -> None:
        return None

    async def get(self, url: str) -> _FakeResponse:
        self.urls.append(url)
        payload = self._payloads.pop(0)
        if isinstance(payload, Exception):
            raise payload
        return _FakeResponse(payload)


async def test_falls_back_to_second_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    client = AdsbClient(points=[(40.7, -73.9)])

    async def fake_fetch(provider):
        if provider.name == PROVIDERS[0].name:
            raise RuntimeError("503 from primary")
        return {r["hex"].lower(): r for r in FI_ROWS}

    monkeypatch.setattr(AdsbClient, "_fetch_provider", staticmethod(fake_fetch))

    flights = await client.get_us_flights()
    assert flights
    assert client.status()["provider"] == PROVIDERS[1].name
    assert client.status()["cached_flights"] == len(flights)


async def test_both_providers_down_keeps_stale_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    client = AdsbClient(points=[(40.7, -73.9)])
    client._cache = [{"icao24": "stale1"}]

    async def always_fails(provider):
        raise RuntimeError("down")

    monkeypatch.setattr(AdsbClient, "_fetch_provider", staticmethod(always_fails))

    assert await client.get_us_flights(force=True) == [{"icao24": "stale1"}]
    assert client.status()["last_error"].startswith(PROVIDERS[1].name)


async def test_points_queried_sequentially_and_merged_by_hex(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Overlapping circles return the same aircraft — keep the freshest fix."""
    stale = {"hex": "a1b2c3", "flight": "AAL9 ", "lat": 40.7, "lon": -73.9, "seen_pos": 20.0}
    fresh = {**stale, "seen_pos": 1.0}
    fake = _FakeClient([{"aircraft": [stale]}, {"aircraft": [fresh]}])
    monkeypatch.setattr(adsb.httpx, "AsyncClient", lambda **_kw: fake)
    monkeypatch.setattr(adsb.asyncio, "sleep", _noop_sleep)

    client = AdsbClient(points=[(40.7, -73.9), (41.9, -87.9)])
    merged = await client._fetch_provider(PROVIDERS[0])

    assert len(fake.urls) == 2
    assert fake.urls[0].startswith("https://opendata.adsb.fi/api/v2/lat/40.7/lon/-73.9/dist/250")
    assert merged["a1b2c3"]["seen_pos"] == 1.0


async def _noop_sleep(_seconds: float) -> None:
    return None


@pytest.mark.skipif(os.environ.get("ADSB_LIVE") != "1", reason="set ADSB_LIVE=1 for live feeds")
async def test_live_feed_returns_flights() -> None:
    client = AdsbClient(points=[(40.7, -73.9)])
    flights = await client.get_us_flights()
    assert flights, "live feed returned nothing"
    assert client.status()["provider"] in {p.name for p in PROVIDERS}
    assert all(f["icao24"] and f["callsign"] for f in flights)


async def test_one_failing_point_does_not_lose_the_others(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A 429 on one circle costs that circle, not the whole refresh."""
    ok = {"hex": "a1b2c3", "flight": "AAL9 ", "lat": 40.7, "lon": -73.9, "seen_pos": 1.0}
    other = {**ok, "hex": "d4e5f6"}
    fake = _FakeClient([{"aircraft": [ok]}, RuntimeError("429"), {"aircraft": [other]}])
    monkeypatch.setattr(adsb.httpx, "AsyncClient", lambda **_kw: fake)
    monkeypatch.setattr(adsb.asyncio, "sleep", _noop_sleep)

    client = AdsbClient(points=[(40.7, -73.9), (41.9, -87.9), (33.6, -84.4)])
    merged = await client._fetch_provider(PROVIDERS[0])
    assert sorted(merged) == ["a1b2c3", "d4e5f6"]


async def test_most_points_failing_raises_to_trigger_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """adsb.lol 429s most circles in practice — half a map is not a feed."""
    fake = _FakeClient([RuntimeError("429"), RuntimeError("429")])
    monkeypatch.setattr(adsb.httpx, "AsyncClient", lambda **_kw: fake)
    monkeypatch.setattr(adsb.asyncio, "sleep", _noop_sleep)

    client = AdsbClient(points=[(40.7, -73.9), (41.9, -87.9), (33.6, -84.4)])
    with pytest.raises(RuntimeError):
        await client._fetch_provider(PROVIDERS[0])
