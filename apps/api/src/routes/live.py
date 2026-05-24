"""
Live aviation data endpoints.
Proxies FAA NAS Status and NWS Weather Alerts — no API keys required.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)

FAA_STATUS_URL = "https://nasstatus.faa.gov/api/airport-status-information"
NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"

# Nimbus Air ICAO codes
NIMBUS_ICAO: set[str] = {
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
}

IATA_TO_ICAO: dict[str, str] = {
    "ORD": "KORD",
    "ATL": "KATL",
    "DFW": "KDFW",
    "LAX": "KLAX",
    "DEN": "KDEN",
    "JFK": "KJFK",
    "SEA": "KSEA",
    "MIA": "KMIA",
    "PHX": "KPHX",
    "LAS": "KLAS",
    "BOS": "KBOS",
    "SFO": "KSFO",
    "IAH": "KIAH",
    "DTW": "KDTW",
    "MSP": "KMSP",
    # bonus coverage for FAA output
    "EWR": "KEWR",
    "LGA": "KLGA",
    "CLT": "KCLT",
    "SLC": "KSLC",
    "PDX": "KPDX",
    "MDW": "KMDW",
    "BWI": "KBWI",
    "DCA": "KDCA",
    "PHL": "KPHL",
    "MCO": "KMCO",
    "FLL": "KFLL",
    "TPA": "KTPA",
    "AUS": "KAUS",
    "HOU": "KHOU",
    "OAK": "KOAK",
    "SJC": "KSJC",
    "SAN": "KSAN",
    "DAL": "KDAL",
}

# Airport bounding boxes for NWS alert geo-matching (lat_min, lat_max, lon_min, lon_max)
AIRPORT_BOUNDS: dict[str, tuple[float, float, float, float]] = {
    "KORD": (41.5, 42.5, -88.5, -87.0),
    "KATL": (33.2, 34.2, -85.0, -83.5),
    "KDFW": (32.4, 33.4, -97.5, -96.5),
    "KLAX": (33.5, 34.5, -119.0, -117.5),
    "KDEN": (39.5, 40.5, -105.5, -104.0),
    "KJFK": (40.3, 41.2, -74.5, -73.0),
    "KSEA": (47.0, 48.0, -123.0, -121.5),
    "KMIA": (25.3, 26.3, -80.8, -79.5),
    "KPHX": (33.0, 34.0, -112.5, -111.0),
    "KLAS": (35.6, 36.6, -115.7, -114.5),
    "KBOS": (41.8, 42.6, -71.5, -70.5),
    "KSFO": (37.2, 38.0, -122.8, -121.7),
    "KIAH": (29.5, 30.5, -96.0, -94.8),
    "KDTW": (41.8, 42.6, -84.0, -82.8),
    "KMSP": (44.4, 45.4, -94.0, -92.5),
}

# City/area keywords per airport for text-based NWS matching
AIRPORT_KEYWORDS: dict[str, list[str]] = {
    "KORD": ["chicago", "cook county", "northeastern illinois"],
    "KATL": ["atlanta", "fulton county", "north georgia"],
    "KDFW": ["dallas", "fort worth", "tarrant county", "north texas"],
    "KLAX": ["los angeles", "southern california", "los angeles county"],
    "KDEN": ["denver", "adams county", "arapahoe", "denver metro", "colorado"],
    "KJFK": ["new york city", "queens", "long island", "new york metro"],
    "KSEA": ["seattle", "king county", "puget sound"],
    "KMIA": ["miami", "miami-dade", "south florida"],
    "KPHX": ["phoenix", "maricopa county", "metro phoenix", "arizona"],
    "KLAS": ["las vegas", "clark county", "southern nevada"],
    "KBOS": ["boston", "suffolk county", "eastern massachusetts"],
    "KSFO": ["san francisco", "bay area", "san francisco bay"],
    "KIAH": ["houston", "harris county", "southeast texas"],
    "KDTW": ["detroit", "wayne county", "southeast michigan"],
    "KMSP": ["minneapolis", "saint paul", "hennepin county", "twin cities"],
}

AVIATION_ALERT_EVENTS = {
    "Winter Storm Warning",
    "Winter Storm Watch",
    "Winter Weather Advisory",
    "Blizzard Warning",
    "Ice Storm Warning",
    "Freezing Rain Advisory",
    "Wind Advisory",
    "High Wind Warning",
    "High Wind Watch",
    "Dense Fog Advisory",
    "Dense Smoke Advisory",
    "Excessive Heat Warning",
    "Heat Advisory",
    "Severe Thunderstorm Warning",
    "Tornado Warning",
    "Special Weather Statement",
    "Flood Warning",
    "Flash Flood Warning",
    "Lake Effect Snow Warning",
    "Lake Effect Snow Advisory",
}


def _as_list(val: Any) -> list:
    if val is None:
        return []
    return val if isinstance(val, list) else [val]


def _parse_delay_minutes(raw: str) -> int:
    if not raw:
        return 0
    raw = raw.lower()
    hours = 0
    minutes = 0
    m = re.search(r"(\d+)\s*hour", raw)
    if m:
        hours = int(m.group(1))
    m = re.search(r"(\d+)\s*min", raw)
    if m:
        minutes = int(m.group(1))
    return hours * 60 + minutes


def _sev_rank(s: str) -> int:
    return {"Extreme": 4, "Severe": 3, "Moderate": 2, "Minor": 1}.get(s, 0)


def _nws_to_sim_severity(nws_severity: str, event_type: str) -> str:
    base = {"Extreme": "extreme", "Severe": "severe", "Moderate": "moderate", "Minor": "mild"}.get(
        nws_severity, "moderate"
    )
    if any(w in event_type.lower() for w in ["tornado", "blizzard", "ice storm"]):
        return "severe" if base == "moderate" else "extreme"
    return base


def _boxes_overlap(a: tuple, b: tuple) -> bool:
    return a[0] <= b[1] and a[1] >= b[0] and a[2] <= b[3] and a[3] >= b[2]


def _airports_in_alert(geo: dict | None, area_desc: str) -> list[str]:
    affected: list[str] = []
    area_lower = area_desc.lower()

    # Text-based match
    for icao, keywords in AIRPORT_KEYWORDS.items():
        if any(k in area_lower for k in keywords):
            affected.append(icao)

    # Geometry-based match (only Polygon for simplicity)
    if geo and geo.get("type") == "Polygon":
        coords = geo.get("coordinates", [])
        if coords:
            flat = [c for ring in coords for c in ring]
            lats = [c[1] for c in flat if len(c) >= 2]
            lons = [c[0] for c in flat if len(c) >= 2]
            if lats and lons:
                alert_bbox = (min(lats), max(lats), min(lons), max(lons))
                for icao, ab in AIRPORT_BOUNDS.items():
                    if icao not in affected and _boxes_overlap(alert_bbox, ab):
                        affected.append(icao)

    return list(dict.fromkeys(affected))  # deduplicate, preserve order


def _parse_faa_programs(raw: dict) -> tuple[list, list, list]:
    """Return (all_programs, ground_stops, departure_delays)."""
    programs: list[dict] = []
    ground_stops: list[dict] = []
    departure_delays: list[dict] = []

    info = raw.get("Airport_Status_Information") or raw
    delay_types = _as_list(info.get("Delay_type") or info.get("Delay_Type") or [])

    for dtype in delay_types:
        name = str(dtype.get("Name", ""))

        if "Ground Stop" in name:
            progs_raw = dtype.get("Programs") or {}
            items = _as_list(progs_raw.get("Program") if isinstance(progs_raw, dict) else progs_raw)
            for p in items:
                arpt = p.get("ARPT", p.get("Airport", ""))
                icao = IATA_TO_ICAO.get(arpt, f"K{arpt}" if arpt and len(arpt) == 3 else arpt)
                entry = {
                    "type": "ground_stop",
                    "airport_iata": arpt,
                    "airport_icao": icao,
                    "reason": p.get("Reason", ""),
                    "start": p.get("Start", ""),
                    "recheck": p.get("Recheck", ""),
                    "end": p.get("End", ""),
                    "in_nimbus_network": icao in NIMBUS_ICAO,
                    "sim_event": {
                        "kind": "ground_stop",
                        "params": {
                            "destination_airport": icao,
                            "duration_hours": 2,
                            "severity": "severe",
                            "reason": p.get("Reason", "weather"),
                        },
                    },
                }
                ground_stops.append(entry)
                programs.append(entry)

        elif "Ground Delay" in name or "GDP" in name:
            progs_raw = dtype.get("Programs") or {}
            items = _as_list(progs_raw.get("Program") if isinstance(progs_raw, dict) else progs_raw)
            for p in items:
                arpt = p.get("ARPT", p.get("Airport", ""))
                icao = IATA_TO_ICAO.get(arpt, f"K{arpt}" if arpt and len(arpt) == 3 else arpt)
                avg_raw = p.get("Avg_Delay", p.get("AvgDelay", ""))
                delay_min = _parse_delay_minutes(avg_raw)
                entry = {
                    "type": "ground_delay_program",
                    "airport_iata": arpt,
                    "airport_icao": icao,
                    "reason": p.get("Reason", ""),
                    "avg_delay_raw": avg_raw,
                    "avg_delay_minutes": delay_min,
                    "start": p.get("Start", ""),
                    "end": p.get("Arrival_Dep_Fix_End", p.get("End", "")),
                    "in_nimbus_network": icao in NIMBUS_ICAO,
                    "sim_event": {
                        "kind": "ground_stop",
                        "params": {
                            "destination_airport": icao,
                            "duration_hours": max(1, delay_min // 30),
                            "severity": "moderate" if delay_min < 60 else "severe",
                        },
                    },
                }
                departure_delays.append(entry)
                programs.append(entry)

        elif "Departure Delay" in name or "General Delay" in name:
            items = _as_list(
                dtype.get("ARPT_DEL") or dtype.get("Airport") or dtype.get("Airports") or []
            )
            # Some API versions wrap airports inside an "Airport" key
            unwrapped: list[dict] = []
            for item in items:
                if isinstance(item, dict) and "ARPT" not in item and "Airport" in item:
                    unwrapped.extend(_as_list(item["Airport"]))
                else:
                    unwrapped.append(item)

            for p in unwrapped:
                arpt = p.get("ARPT", p.get("Name", ""))
                icao = IATA_TO_ICAO.get(arpt, f"K{arpt}" if arpt and len(arpt) == 3 else arpt)
                avg_raw = p.get("Avg_Delay", p.get("AvgDelay", ""))
                delay_min = _parse_delay_minutes(avg_raw)
                reason = p.get("Reason", "")
                is_wx = "WEATHER" in reason.upper() or "WX" in reason.upper()
                entry = {
                    "type": "departure_delay",
                    "airport_iata": arpt,
                    "airport_icao": icao,
                    "reason": reason,
                    "avg_delay_raw": avg_raw,
                    "avg_delay_minutes": delay_min,
                    "in_nimbus_network": icao in NIMBUS_ICAO,
                    "sim_event": {
                        "kind": "weather_closure" if is_wx else "atc_staffing",
                        "params": {
                            "airport": icao,
                            "severity": "moderate" if delay_min < 60 else "severe",
                            "duration_hours": max(1, delay_min // 30),
                            **({"facility_id": "ZNY"} if not is_wx else {}),
                        },
                    },
                }
                departure_delays.append(entry)
                programs.append(entry)

    return programs, ground_stops, departure_delays


@router.get("/live/faa-status")
async def get_faa_status():
    """Current FAA traffic management initiatives — ground stops, GDPs, departure delays."""
    async with httpx.AsyncClient(timeout=12.0) as client:
        try:
            resp = await client.get(FAA_STATUS_URL, headers={"Accept": "application/json"})
            resp.raise_for_status()
            raw = resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("FAA status HTTP %s", exc.response.status_code)
            return {
                "programs": [],
                "ground_stops": [],
                "departure_delays": [],
                "us_summary": None,
                "source": "faa_error",
                "error": str(exc),
            }
        except Exception as exc:
            logger.warning("FAA status fetch failed: %s", exc)
            return {
                "programs": [],
                "ground_stops": [],
                "departure_delays": [],
                "us_summary": None,
                "source": "unavailable",
                "error": str(exc),
            }

    try:
        programs, ground_stops, departure_delays = _parse_faa_programs(raw)
    except Exception as exc:
        logger.warning("FAA parse error: %s", exc)
        programs, ground_stops, departure_delays = [], [], []

    iata_set = {p.get("airport_iata", "") for p in programs if p.get("airport_iata")}
    us_summary = {
        "concurrent_total": len(programs),
        "concurrent_ground_stops": len(ground_stops),
        "concurrent_gdps": sum(1 for p in programs if p["type"] == "ground_delay_program"),
        "concurrent_departure_delay_programs": sum(
            1 for p in programs if p["type"] == "departure_delay"
        ),
        "unique_us_airports": len(iata_set),
        "nimbus_network_overlap": sum(1 for p in programs if p["in_nimbus_network"]),
    }

    return {
        "programs": programs,
        "ground_stops": ground_stops,
        "departure_delays": departure_delays,
        "total": len(programs),
        "nimbus_affected": sum(1 for p in programs if p["in_nimbus_network"]),
        "us_summary": us_summary,
        "source": "nasstatus.faa.gov",
    }


@router.get("/live/weather-alerts")
async def get_weather_alerts():
    """Active NWS aviation-relevant weather alerts across the US."""
    async with httpx.AsyncClient(timeout=12.0) as client:
        try:
            resp = await client.get(
                NWS_ALERTS_URL,
                params={"status": "actual", "message_type": "alert", "limit": 250},
                headers={
                    "User-Agent": "AeolusOCC/1.0 (aviation-education; contact=aeolus@example.com)"
                },
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning("NWS alerts fetch failed: %s", exc)
            return {
                "alerts": [],
                "total": 0,
                "nimbus_affected": 0,
                "us_summary": None,
                "source": "unavailable",
                "error": str(exc),
            }

    raw_features = data.get("features", [])
    alerts: list[dict] = []

    for feature in raw_features:
        props = feature.get("properties", {})
        event_type = props.get("event", "")

        if event_type not in AVIATION_ALERT_EVENTS:
            continue

        area_desc = props.get("areaDesc", "")
        geo = feature.get("geometry")
        affected = _airports_in_alert(geo, area_desc)

        severity = props.get("severity", "Unknown")
        event_lower = event_type.lower()

        if "thunder" in event_lower or "tornado" in event_lower:
            sim_kind = "weather_closure"
        elif "fog" in event_lower or "smoke" in event_lower:
            sim_kind = "runway_closure"
        elif "wind" in event_lower and "thunder" not in event_lower:
            sim_kind = "ground_stop"
        elif (
            "snow" in event_lower
            or "blizzard" in event_lower
            or "ice" in event_lower
            or "winter" in event_lower
            or "freeze" in event_lower
        ):
            sim_kind = "weather_closure"
        else:
            sim_kind = "weather_closure"

        sim_event = (
            {
                "kind": sim_kind,
                "params": {
                    "airport": affected[0],
                    "severity": _nws_to_sim_severity(severity, event_type),
                    "duration_hours": 3,
                },
            }
            if affected
            else None
        )

        alerts.append(
            {
                "id": props.get("id", ""),
                "event": event_type,
                "headline": (props.get("headline") or "")[:160],
                "severity": severity,
                "area": area_desc[:140],
                "effective": props.get("effective", ""),
                "expires": props.get("expires", ""),
                "sender": props.get("senderName", ""),
                "affected_nimbus_airports": affected,
                "sim_event": sim_event,
            }
        )

    alerts.sort(key=lambda a: (-len(a["affected_nimbus_airports"]), -_sev_rank(a["severity"])))

    us_summary = {
        "nationwide_alerts_matched": len(alerts),
        "returned": min(72, len(alerts)),
        "severe_or_extreme": sum(1 for a in alerts if a["severity"] in ("Severe", "Extreme")),
        "nimbus_touched": sum(1 for a in alerts if a["affected_nimbus_airports"]),
    }

    return {
        "alerts": alerts[:72],
        "total": len(alerts),
        "nimbus_affected": sum(1 for a in alerts if a["affected_nimbus_airports"]),
        "us_summary": us_summary,
        "source": "api.weather.gov",
    }


@router.get("/live/national-snapshot")
async def get_national_snapshot():
    """
    Single round-trip: FAA national traffic programs + NWS CONUS-relevant weather alerts,
    for the Live Feed US dashboard.
    """
    faa, nws = await asyncio.gather(
        get_faa_status(),
        get_weather_alerts(),
    )
    return {
        "refreshed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "faa": faa,
        "nws": nws,
    }
