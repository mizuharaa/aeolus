from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel

FlightCategory = Literal["VFR", "MVFR", "IFR", "LIFR"]


class MetarObservation(BaseModel):
    icao: str
    raw_text: Optional[str] = None
    observation_time: Optional[str] = None
    temp_c: Optional[float] = None
    dewpoint_c: Optional[float] = None
    wind_dir_deg: Optional[int] = None
    wind_speed_kt: Optional[float] = None
    wind_gust_kt: Optional[float] = None
    visibility_sm: Optional[float] = None
    ceiling_ft: Optional[int] = None
    altimeter_in: Optional[float] = None
    flight_category: Optional[FlightCategory] = None
    wx_string: Optional[str] = None
