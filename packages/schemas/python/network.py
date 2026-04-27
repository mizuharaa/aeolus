from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field

AircraftType = Literal["B737-800", "A320", "E175", "B757-200"]
FlightStatus = Literal["scheduled", "delayed", "cancelled", "diverted", "airborne", "landed"]


class Airport(BaseModel):
    icao: str
    name: str
    city: str
    lat: float
    lon: float
    hourly_capacity: int
    elevation_ft: int = 0


class Aircraft(BaseModel):
    tail_number: str
    aircraft_type: AircraftType
    seat_capacity: int
    base_airport: str
    min_turn_minutes: int = 45
    current_airport: Optional[str] = None


class ScheduledFlight(BaseModel):
    id: str
    flight_number: str
    origin: str
    destination: str
    scheduled_departure: str        # ISO-8601
    scheduled_arrival: str          # ISO-8601
    tail_number: str
    aircraft_type: AircraftType
    passengers: int = 120
    status: Optional[FlightStatus] = None


class CrewPairing(BaseModel):
    id: str
    captain_id: str
    first_officer_id: str
    base: str
    flights: list[str]
    report_time: str                # ISO-8601
    release_time: str               # ISO-8601
    duty_minutes: int
    flight_time_minutes: int
