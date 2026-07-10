"""Canonical disruption catalog shared by API routes and the simulator."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


EVENT_DEFAULTS: dict[str, dict[str, Any]] = {
    "weather_closure": {"airport": "KORD", "severity": "severe", "duration_hours": 4},
    "thunderstorm": {"airport": "KORD", "severity": "severe", "duration_hours": 3},
    "blizzard": {
        "airport": "KORD",
        "severity": "severe",
        "snowfall_rate": 2,
        "duration_hours": 6,
    },
    "sandstorm": {
        "airport": "KPHX",
        "severity": "severe",
        "visibility_sm": 0.25,
        "duration_hours": 4,
    },
    "dense_fog": {
        "airport": "KSFO",
        "severity": "moderate",
        "visibility_sm": 0.25,
        "duration_hours": 4,
    },
    "wind_shear": {
        "airport": "KDFW",
        "severity": "severe",
        "wind_speed_kt": 35,
        "duration_hours": 2,
    },
    "hurricane": {
        "airport": "KMIA",
        "category": 3,
        "severity": "severe",
        "duration_hours": 48,
    },
    "volcanic_ash": {
        "volcano_name": "Mount St. Helens",
        "volcano_lat": 46.2,
        "volcano_lon": -122.18,
        "ash_cloud_radius_nm": 200,
        "severity": "severe",
        "duration_hours": 18,
    },
    "ground_stop": {
        "airport": "KATL",
        "destination_airport": "KATL",
        "severity": "moderate",
        "duration_hours": 2,
    },
    "airspace_closure": {
        "airport": "KDEN",
        "airports": ["KDEN"],
        "center_lat": 39.856,
        "center_lon": -104.674,
        "radius_nm": 40,
        "severity": "severe",
        "duration_hours": 6,
    },
    "atc_staffing": {
        "facility_id": "ZAU",
        "sector_or_airport": "ZAU",
        "staffing_pct": 60,
        "average_delay_minutes": 48,
        "severity": "moderate",
        "duration_hours": 6,
    },
    "mechanical_aog": {
        "aircraft_tail": "N001NB",
        "airport": "KATL",
        "location_airport": "KATL",
        "duration_hours": 8,
    },
    "bird_strike": {
        "aircraft_tail": "N005NB",
        "airport": "KJFK",
        "location_airport": "KJFK",
        "severity": "severe",
        "duration_hours": 8,
    },
    "deicing_shortage": {
        "airport": "KORD",
        "queue_length": 20,
        "capacity_cut_pct": 40,
        "severity": "moderate",
        "duration_hours": 3,
    },
    "runway_closure": {
        "airport": "KDFW",
        "runway_id": "17L",
        "capacity_cut_pct": 45,
        "severity": "moderate",
        "duration_hours": 6,
    },
    "fuel_contamination": {
        "airport": "KATL",
        "severity": "extreme",
        "duration_hours": 6,
    },
    "crew_sickout": {
        "base": "KORD",
        "affected_bases": ["KORD"],
        "percent_affected": 30,
        "duration_hours": 8,
    },
    "labor_action": {
        "base": "KORD",
        "affected_bases": ["KORD"],
        "percent_affected": 40,
        "severity": "moderate",
        "duration_hours": 12,
    },
    "security_event": {"airport": "KATL", "severity": "severe", "duration_hours": 3},
    "airport_emergency": {"airport": "KATL", "severity": "extreme", "duration_hours": 6},
    "cyber_incident": {
        "airline": "NimbusAir",
        "degradation_pct": 60,
        "severity": "severe",
        "duration_hours": 12,
    },
}


EVENT_DESCRIPTIONS: dict[str, str] = {
    "weather_closure": "Airport closure or severe capacity reduction caused by weather.",
    "thunderstorm": "Convective cells reduce arrival rates and force route deviations.",
    "blizzard": "Snow, low visibility, and ramp restrictions disrupt airport operations.",
    "sandstorm": "Dust and low visibility restrict approaches and require inspections.",
    "dense_fog": "Low visibility restricts the airport to CAT II/III operations.",
    "wind_shear": "Low-level wind shear increases spacing and missed approaches.",
    "hurricane": "A tropical cyclone drives evacuations and multi-day cancellations.",
    "volcanic_ash": "An ash exclusion zone forces cancellations and long reroutes.",
    "ground_stop": "Departures to a destination are held at their origin airports.",
    "airspace_closure": "A closed sector forces traffic onto longer adjacent routes.",
    "atc_staffing": "Reduced controller staffing lowers regional throughput.",
    "mechanical_aog": "A specific aircraft is grounded until maintenance release.",
    "bird_strike": "An aircraft is grounded for inspection after a bird or FOD strike.",
    "deicing_shortage": "Deicing queues constrain winter departure throughput.",
    "runway_closure": "A runway outage cuts airport arrival and departure capacity.",
    "fuel_contamination": "Fuel supply restrictions halt departures at an airport.",
    "crew_sickout": "Crew absences leave a percentage of flights without legal staffing.",
    "labor_action": "A workforce slowdown reduces turn and dispatch capacity.",
    "security_event": "A security incident closes or restricts an airport.",
    "airport_emergency": "An airfield emergency diverts arrivals and stops departures.",
    "cyber_incident": "System degradation adds manual processing delays network-wide.",
}


CONSTRAINT_KIND_BY_EVENT = {
    "thunderstorm": "weather_closure",
    "blizzard": "weather_closure",
    "sandstorm": "weather_closure",
    "dense_fog": "weather_closure",
    "wind_shear": "weather_closure",
    "hurricane": "weather_closure",
    "bird_strike": "mechanical_aog",
    "deicing_shortage": "runway_closure",
    "fuel_contamination": "weather_closure",
    "labor_action": "crew_sickout",
    "airport_emergency": "security_event",
}


def supported_event_kinds() -> tuple[str, ...]:
    return tuple(EVENT_DEFAULTS)


def constraint_kind_for(kind: str) -> str:
    return CONSTRAINT_KIND_BY_EVENT.get(kind, kind)


def normalize_event_params(kind: str, params: dict[str, Any] | None) -> dict[str, Any]:
    """Merge defaults, normalize aliases, and reject invalid control values."""
    if kind not in EVENT_DEFAULTS:
        valid = ", ".join(EVENT_DEFAULTS)
        raise ValueError(f"Unknown event kind ''{kind}''. Valid kinds: {valid}")

    merged = deepcopy(EVENT_DEFAULTS[kind])
    merged.update(params or {})

    duration = float(merged.get("duration_hours", 1))
    if not 0 < duration <= 168:
        raise ValueError("duration_hours must be greater than 0 and at most 168")
    merged["duration_hours"] = duration

    if "airport" in merged and isinstance(merged["airport"], str):
        merged["airport"] = merged["airport"].upper()
    if "base" in merged and isinstance(merged["base"], str):
        merged["base"] = merged["base"].upper()
    if "aircraft_tail" in merged and isinstance(merged["aircraft_tail"], str):
        merged["aircraft_tail"] = merged["aircraft_tail"].upper()

    if kind == "ground_stop":
        destination = str(merged.get("destination_airport") or merged.get("airport") or "").upper()
        merged["destination_airport"] = destination
        merged["airport"] = destination

    if kind == "airspace_closure":
        airport = merged.get("airport")
        if airport and not (params or {}).get("airports"):
            merged["airports"] = [airport]

    if kind == "atc_staffing":
        facility = str(merged.get("facility_id") or merged.get("sector_or_airport") or "").upper()
        merged["facility_id"] = facility
        merged["sector_or_airport"] = facility
        staffing = float(merged.get("staffing_pct", 60))
        if not 0 <= staffing <= 100:
            raise ValueError("staffing_pct must be between 0 and 100")
        merged["staffing_pct"] = staffing
        if not (params or {}).get("average_delay_minutes"):
            merged["average_delay_minutes"] = max(10, round((100 - staffing) * 1.2))

    if kind in {"mechanical_aog", "bird_strike"}:
        merged["location_airport"] = merged.get("airport", merged.get("location_airport", ""))

    if kind in {"crew_sickout", "labor_action"}:
        percent = float(merged.get("percent_affected", merged.get("callout_pct", 30)))
        if not 0 <= percent <= 100:
            raise ValueError("percent_affected must be between 0 and 100")
        merged["percent_affected"] = percent
        merged["callout_pct"] = percent
        if merged.get("base"):
            merged["affected_bases"] = [merged["base"]]

    if kind == "hurricane":
        category = int(merged.get("category", 3))
        if category not in range(1, 6):
            raise ValueError("category must be between 1 and 5")
        merged["category"] = category
        merged["severity"] = (
            "extreme" if category >= 4 else ("severe" if category >= 2 else "moderate")
        )

    # The UI historically used operational terms for this event. Normalize
    # them to the predictor''s shared severity scale.
    if kind == "fuel_contamination":
        severity = str(merged.get("severity", "extreme")).lower()
        merged["severity"] = {"partial": "moderate", "critical": "extreme"}.get(severity, severity)

    for field in ("capacity_cut_pct", "percent_affected", "degradation_pct"):
        if field in merged:
            value = float(merged[field])
            if not 0 <= value <= 100:
                raise ValueError(f"{field} must be between 0 and 100")
            merged[field] = value

    return merged
