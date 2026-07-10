from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

EventKind = Literal[
    "weather_closure",
    "thunderstorm",
    "blizzard",
    "sandstorm",
    "dense_fog",
    "wind_shear",
    "hurricane",
    "ground_stop",
    "airspace_closure",
    "security_event",
    "mechanical_aog",
    "bird_strike",
    "deicing_shortage",
    "fuel_contamination",
    "crew_sickout",
    "labor_action",
    "runway_closure",
    "atc_staffing",
    "volcanic_ash",
    "cyber_incident",
    "airport_emergency",
]

Severity = Literal["mild", "moderate", "severe", "extreme"]


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]


class EventParams(BaseModel):
    airport: Optional[str] = None
    destination_airport: Optional[str] = None
    base: Optional[str] = None
    aircraft_tail: Optional[str] = None
    sector_or_airport: Optional[str] = None
    airline: Optional[str] = None
    severity: Optional[Severity] = None
    duration_hours: Optional[float] = None
    runway_id: Optional[str] = None
    capacity_cut_pct: Optional[float] = None
    capacity_pct: Optional[float] = None
    percent_affected: Optional[float] = None
    degradation_pct: Optional[float] = None
    snowfall_rate: Optional[float] = None
    visibility_sm: Optional[float] = None
    wind_speed_kt: Optional[float] = None
    category: Optional[int] = None
    ash_cloud_radius_nm: Optional[float] = None
    facility_id: Optional[str] = None
    staffing_pct: Optional[float] = None
    queue_length: Optional[int] = None
    polygon: Optional[GeoJSONPolygon] = None

    model_config = {"extra": "allow"}


class ActiveEvent(BaseModel):
    id: str
    kind: EventKind
    params: dict[str, Any] = Field(default_factory=dict)
    triggered_at: Optional[str] = None
    expires_at: Optional[str] = None


class TriggerEventRequest(BaseModel):
    kind: EventKind
    params: dict[str, Any] = Field(default_factory=dict)
