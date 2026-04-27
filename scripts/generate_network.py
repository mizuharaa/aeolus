#!/usr/bin/env python3
"""
Generate Nimbus Air synthetic airline network.
Produces airports, aircraft, flights (valid rotations), and crew pairings.
Output: data/network/{airports,aircraft,flights,crews}.yaml

All rotations are self-consistent:
  - Each flight's origin matches the previous flight's destination.
  - Minimum ground time >= aircraft.min_turn_minutes between consecutive legs.
  - Flight durations are drawn from a realistic route-time table.
  - Aircraft return to their base airport at the end of the day.

Usage:
    python scripts/generate_network.py
    python scripts/generate_network.py --output-dir /tmp/network
"""

import yaml
import random
import argparse
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

random.seed(42)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_DATE = datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc)

# UTC offset (hours to subtract from local 06:00 to get UTC departure)
# e.g. Chicago is UTC-6 in winter, so 06:00 CST = 12:00 UTC
UTC_OFFSETS: dict[str, int] = {
    "KORD": 6, "KDFW": 6, "KMSP": 6, "KIAH": 6,
    "KJFK": 5, "KATL": 5, "KMIA": 5, "KBOS": 5, "KDTW": 5,
    "KDEN": 7,
    "KPHX": 7,
    "KLAX": 8, "KSEA": 8, "KSFO": 8, "KLAS": 8,
}

# ---------------------------------------------------------------------------
# Route time table (minutes, one-way, block time)
# ---------------------------------------------------------------------------

ROUTE_TIMES: dict[tuple[str, str], int] = {
    # ORD hub spokes
    ("KORD", "KATL"): 135, ("KATL", "KORD"): 135,
    ("KORD", "KDFW"): 160, ("KDFW", "KORD"): 155,
    ("KORD", "KLAX"): 270, ("KLAX", "KORD"): 255,
    ("KORD", "KDEN"): 155, ("KDEN", "KORD"): 145,
    ("KORD", "KJFK"): 135, ("KJFK", "KORD"): 130,
    ("KORD", "KSEA"): 255, ("KSEA", "KORD"): 240,
    ("KORD", "KMIA"): 185, ("KMIA", "KORD"): 175,
    ("KORD", "KBOS"): 130, ("KBOS", "KORD"): 125,
    ("KORD", "KSFO"): 275, ("KSFO", "KORD"): 260,
    ("KORD", "KIAH"): 170, ("KIAH", "KORD"): 165,
    ("KORD", "KDTW"):  70, ("KDTW", "KORD"):  70,
    ("KORD", "KMSP"):  70, ("KMSP", "KORD"):  70,
    ("KORD", "KPHX"): 230, ("KPHX", "KORD"): 220,
    ("KORD", "KLAS"): 265, ("KLAS", "KORD"): 250,
    # ATL spokes
    ("KATL", "KMIA"):  75, ("KMIA", "KATL"):  75,
    ("KATL", "KJFK"): 150, ("KJFK", "KATL"): 150,
    ("KATL", "KDFW"): 160, ("KDFW", "KATL"): 155,
    ("KATL", "KLAX"): 270, ("KLAX", "KATL"): 260,
    ("KATL", "KDEN"): 220, ("KDEN", "KATL"): 210,
    ("KATL", "KBOS"): 160, ("KBOS", "KATL"): 155,
    ("KATL", "KIAH"): 140, ("KIAH", "KATL"): 135,
    ("KATL", "KSEA"): 320, ("KSEA", "KATL"): 305,
    ("KATL", "KSFO"): 320, ("KSFO", "KATL"): 305,
    ("KATL", "KPHX"): 250, ("KPHX", "KATL"): 240,
    ("KATL", "KLAS"): 290, ("KLAS", "KATL"): 275,
    ("KATL", "KDTW"): 100, ("KDTW", "KATL"):  95,
    ("KATL", "KMSP"): 165, ("KMSP", "KATL"): 160,
    # DFW spokes
    ("KDFW", "KLAX"): 195, ("KLAX", "KDFW"): 185,
    ("KDFW", "KDEN"): 120, ("KDEN", "KDFW"): 115,
    ("KDFW", "KLAS"): 175, ("KLAS", "KDFW"): 165,
    ("KDFW", "KPHX"): 135, ("KPHX", "KDFW"): 130,
    ("KDFW", "KIAH"):  60, ("KIAH", "KDFW"):  60,
    ("KDFW", "KMIA"): 175, ("KMIA", "KDFW"): 165,
    ("KDFW", "KJFK"): 225, ("KJFK", "KDFW"): 215,
    ("KDFW", "KBOS"): 235, ("KBOS", "KDFW"): 225,
    ("KDFW", "KSEA"): 240, ("KSEA", "KDFW"): 230,
    ("KDFW", "KSFO"): 220, ("KSFO", "KDFW"): 210,
    # LAX spokes
    ("KLAX", "KSEA"): 150, ("KSEA", "KLAX"): 145,
    ("KLAX", "KSFO"):  60, ("KSFO", "KLAX"):  60,
    ("KLAX", "KDEN"): 170, ("KDEN", "KLAX"): 165,
    ("KLAX", "KLAS"):  65, ("KLAS", "KLAX"):  65,
    ("KLAX", "KPHX"):  75, ("KPHX", "KLAX"):  75,
    ("KLAX", "KMIA"): 330, ("KMIA", "KLAX"): 315,
    ("KLAX", "KJFK"): 320, ("KJFK", "KLAX"): 305,
    ("KLAX", "KIAH"): 210, ("KIAH", "KLAX"): 200,
    # JFK/BOS spokes
    ("KJFK", "KBOS"):  60, ("KBOS", "KJFK"):  60,
    ("KJFK", "KMIA"): 165, ("KMIA", "KJFK"): 160,
    ("KJFK", "KSFO"): 370, ("KSFO", "KJFK"): 355,
    ("KJFK", "KLAX"): 320, ("KLAX", "KJFK"): 305,
    ("KJFK", "KDEN"): 270, ("KDEN", "KJFK"): 260,
    # SEA / SFO spokes
    ("KSEA", "KDEN"): 180, ("KDEN", "KSEA"): 175,
    ("KSEA", "KSFO"): 120, ("KSFO", "KSEA"): 115,
    ("KSFO", "KDEN"): 175, ("KDEN", "KSFO"): 170,
    # DEN short hops
    ("KDEN", "KPHX"): 115, ("KPHX", "KDEN"): 115,
    ("KDEN", "KLAS"): 125, ("KLAS", "KDEN"): 120,
    # MSP / DTW short hops
    ("KMSP", "KDTW"):  80, ("KDTW", "KMSP"):  80,
    ("KMSP", "KORD"):  70, ("KORD", "KMSP"):  70,
    # MIA / IAH
    ("KMIA", "KIAH"): 175, ("KIAH", "KMIA"): 170,
    ("KMIA", "KBOS"): 190, ("KBOS", "KMIA"): 185,
    ("KIAH", "KPHX"): 160, ("KPHX", "KIAH"): 155,
    ("KIAH", "KLAS"): 200, ("KLAS", "KIAH"): 195,
    ("KIAH", "KDEN"): 150, ("KDEN", "KIAH"): 145,
    # PHX / LAS
    ("KPHX", "KLAS"):  55, ("KLAS", "KPHX"):  55,
    ("KPHX", "KSFO"): 115, ("KSFO", "KPHX"): 110,
    ("KPHX", "KSEA"): 195, ("KSEA", "KPHX"): 190,
}


def get_flight_time(origin: str, dest: str) -> int:
    """Return block time in minutes, with symmetric fallback then haversine estimate."""
    if (origin, dest) in ROUTE_TIMES:
        return ROUTE_TIMES[(origin, dest)]
    if (dest, origin) in ROUTE_TIMES:
        return ROUTE_TIMES[(dest, origin)] + 10   # westbound headwind penalty
    # crude fallback: 150 min
    log.warning("No route time found for %s->%s, using 150 min", origin, dest)
    return 150


# ---------------------------------------------------------------------------
# Airport data (replicated from airports.yaml for Python use)
# ---------------------------------------------------------------------------

AIRPORTS = [
    {"id": "KORD", "name": "Chicago O'Hare International",               "city": "Chicago",       "state": "IL", "lat": 41.9742,  "lon": -87.9073,  "timezone": "America/Chicago",     "hub_type": "hub",        "gates": 190, "runways": 8, "hourly_capacity": 110},
    {"id": "KATL", "name": "Hartsfield-Jackson Atlanta International",    "city": "Atlanta",       "state": "GA", "lat": 33.6407,  "lon": -84.4277,  "timezone": "America/New_York",    "hub_type": "hub",        "gates": 192, "runways": 5, "hourly_capacity": 100},
    {"id": "KDFW", "name": "Dallas/Fort Worth International",             "city": "Dallas",        "state": "TX", "lat": 32.8998,  "lon": -97.0403,  "timezone": "America/Chicago",     "hub_type": "hub",        "gates": 165, "runways": 7, "hourly_capacity":  95},
    {"id": "KLAX", "name": "Los Angeles International",                   "city": "Los Angeles",   "state": "CA", "lat": 33.9425,  "lon": -118.408,  "timezone": "America/Los_Angeles", "hub_type": "hub",        "gates": 133, "runways": 4, "hourly_capacity":  85},
    {"id": "KDEN", "name": "Denver International",                        "city": "Denver",        "state": "CO", "lat": 39.8561,  "lon": -104.6737, "timezone": "America/Denver",      "hub_type": "focus_city", "gates": 115, "runways": 6, "hourly_capacity":  80},
    {"id": "KJFK", "name": "John F. Kennedy International",               "city": "New York",      "state": "NY", "lat": 40.6413,  "lon": -73.7781,  "timezone": "America/New_York",    "hub_type": "focus_city", "gates": 128, "runways": 4, "hourly_capacity":  60},
    {"id": "KSEA", "name": "Seattle-Tacoma International",                "city": "Seattle",       "state": "WA", "lat": 47.4502,  "lon": -122.3088, "timezone": "America/Los_Angeles", "hub_type": "focus_city", "gates":  90, "runways": 3, "hourly_capacity":  55},
    {"id": "KMIA", "name": "Miami International",                         "city": "Miami",         "state": "FL", "lat": 25.7959,  "lon": -80.287,   "timezone": "America/New_York",    "hub_type": "focus_city", "gates": 131, "runways": 4, "hourly_capacity":  60},
    {"id": "KPHX", "name": "Phoenix Sky Harbor International",            "city": "Phoenix",       "state": "AZ", "lat": 33.4373,  "lon": -112.0078, "timezone": "America/Phoenix",     "hub_type": "spoke",      "gates": 120, "runways": 3, "hourly_capacity":  65},
    {"id": "KLAS", "name": "Harry Reid International",                    "city": "Las Vegas",     "state": "NV", "lat": 36.084,   "lon": -115.1537, "timezone": "America/Los_Angeles", "hub_type": "spoke",      "gates":  96, "runways": 4, "hourly_capacity":  60},
    {"id": "KBOS", "name": "Boston Logan International",                  "city": "Boston",        "state": "MA", "lat": 42.3656,  "lon": -71.0096,  "timezone": "America/New_York",    "hub_type": "spoke",      "gates": 102, "runways": 4, "hourly_capacity":  55},
    {"id": "KSFO", "name": "San Francisco International",                 "city": "San Francisco", "state": "CA", "lat": 37.6213,  "lon": -122.379,  "timezone": "America/Los_Angeles", "hub_type": "spoke",      "gates": 115, "runways": 4, "hourly_capacity":  60},
    {"id": "KIAH", "name": "George Bush Intercontinental",                "city": "Houston",       "state": "TX", "lat": 29.9902,  "lon": -95.3368,  "timezone": "America/Chicago",     "hub_type": "spoke",      "gates": 131, "runways": 5, "hourly_capacity":  65},
    {"id": "KDTW", "name": "Detroit Metropolitan Wayne County",           "city": "Detroit",       "state": "MI", "lat": 42.2162,  "lon": -83.3554,  "timezone": "America/Detroit",     "hub_type": "spoke",      "gates": 129, "runways": 6, "hourly_capacity":  70},
    {"id": "KMSP", "name": "Minneapolis-Saint Paul International",        "city": "Minneapolis",   "state": "MN", "lat": 44.882,   "lon": -93.2218,  "timezone": "America/Chicago",     "hub_type": "spoke",      "gates": 132, "runways": 4, "hourly_capacity":  65},
]

# ---------------------------------------------------------------------------
# Aircraft data (replicated for Python use)
# ---------------------------------------------------------------------------

AIRCRAFT = [
    # ORD fleet
    {"id": "N001NB", "type": "B737-800", "base_airport_id": "KORD", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N002NB", "type": "B737-800", "base_airport_id": "KORD", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N003NB", "type": "A320",     "base_airport_id": "KORD", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N004NB", "type": "A320",     "base_airport_id": "KORD", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N005NB", "type": "B757-200", "base_airport_id": "KORD", "seats": 199, "range_nm": 3900, "min_turn_minutes": 55},
    {"id": "N006NB", "type": "B737-800", "base_airport_id": "KORD", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N007NB", "type": "E175",     "base_airport_id": "KORD", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
    {"id": "N008NB", "type": "E175",     "base_airport_id": "KORD", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
    {"id": "N009NB", "type": "A320",     "base_airport_id": "KORD", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N010NB", "type": "B737-800", "base_airport_id": "KORD", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    # ATL fleet
    {"id": "N011NB", "type": "B737-800", "base_airport_id": "KATL", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N012NB", "type": "B737-800", "base_airport_id": "KATL", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N013NB", "type": "A320",     "base_airport_id": "KATL", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N014NB", "type": "B757-200", "base_airport_id": "KATL", "seats": 199, "range_nm": 3900, "min_turn_minutes": 55},
    {"id": "N015NB", "type": "E175",     "base_airport_id": "KATL", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
    {"id": "N016NB", "type": "B737-800", "base_airport_id": "KATL", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N017NB", "type": "A320",     "base_airport_id": "KATL", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N018NB", "type": "E175",     "base_airport_id": "KATL", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
    # DFW fleet
    {"id": "N019NB", "type": "B737-800", "base_airport_id": "KDFW", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N020NB", "type": "A320",     "base_airport_id": "KDFW", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N021NB", "type": "B757-200", "base_airport_id": "KDFW", "seats": 199, "range_nm": 3900, "min_turn_minutes": 55},
    {"id": "N022NB", "type": "B737-800", "base_airport_id": "KDFW", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N023NB", "type": "E175",     "base_airport_id": "KDFW", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
    {"id": "N024NB", "type": "A320",     "base_airport_id": "KDFW", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    # LAX fleet
    {"id": "N025NB", "type": "B737-800", "base_airport_id": "KLAX", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N026NB", "type": "A320",     "base_airport_id": "KLAX", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N027NB", "type": "B757-200", "base_airport_id": "KLAX", "seats": 199, "range_nm": 3900, "min_turn_minutes": 55},
    {"id": "N028NB", "type": "B737-800", "base_airport_id": "KLAX", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N029NB", "type": "E175",     "base_airport_id": "KLAX", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
    # DEN fleet
    {"id": "N030NB", "type": "B737-800", "base_airport_id": "KDEN", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N031NB", "type": "A320",     "base_airport_id": "KDEN", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N032NB", "type": "E175",     "base_airport_id": "KDEN", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
    {"id": "N033NB", "type": "B737-800", "base_airport_id": "KDEN", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    # JFK fleet
    {"id": "N034NB", "type": "B757-200", "base_airport_id": "KJFK", "seats": 199, "range_nm": 3900, "min_turn_minutes": 55},
    {"id": "N035NB", "type": "A320",     "base_airport_id": "KJFK", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N036NB", "type": "B737-800", "base_airport_id": "KJFK", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    # Outlier bases
    {"id": "N037NB", "type": "B737-800", "base_airport_id": "KSEA", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N038NB", "type": "A320",     "base_airport_id": "KMIA", "seats": 150, "range_nm": 3300, "min_turn_minutes": 45},
    {"id": "N039NB", "type": "B737-800", "base_airport_id": "KIAH", "seats": 162, "range_nm": 2935, "min_turn_minutes": 45},
    {"id": "N040NB", "type": "E175",     "base_airport_id": "KMSP", "seats":  76, "range_nm": 2100, "min_turn_minutes": 35},
]

# ---------------------------------------------------------------------------
# Rotation definitions  (origin, dest) chains — aircraft MUST end at base
# ---------------------------------------------------------------------------

# Each entry is (aircraft_id, [(orig, dest), ...])
# The chain must start and end at the aircraft's base airport.
ROTATIONS: list[tuple[str, list[tuple[str, str]]]] = [
    # ---- ORD fleet ----
    # N001NB  ORD-ATL-MIA-ATL-ORD  (4 legs)
    ("N001NB", [("KORD","KATL"), ("KATL","KMIA"), ("KMIA","KATL"), ("KATL","KORD")]),
    # N002NB  ORD-DFW-LAX-DFW-ORD  (4 legs)
    ("N002NB", [("KORD","KDFW"), ("KDFW","KLAX"), ("KLAX","KDFW"), ("KDFW","KORD")]),
    # N003NB  ORD-DEN-PHX-DEN-ORD  (4 legs)
    ("N003NB", [("KORD","KDEN"), ("KDEN","KPHX"), ("KPHX","KDEN"), ("KDEN","KORD")]),
    # N004NB  ORD-JFK-BOS-JFK-ORD  (4 legs)
    ("N004NB", [("KORD","KJFK"), ("KJFK","KBOS"), ("KBOS","KJFK"), ("KJFK","KORD")]),
    # N005NB  ORD-LAX-SFO-LAX-ORD  (4 legs, 757)
    ("N005NB", [("KORD","KLAX"), ("KLAX","KSFO"), ("KSFO","KLAX"), ("KLAX","KORD")]),
    # N006NB  ORD-ATL-IAH-ATL-ORD  (4 legs)
    ("N006NB", [("KORD","KATL"), ("KATL","KIAH"), ("KIAH","KATL"), ("KATL","KORD")]),
    # N007NB  ORD-DTW-ORD-MSP-ORD  (4 legs, E175)
    ("N007NB", [("KORD","KDTW"), ("KDTW","KORD"), ("KORD","KMSP"), ("KMSP","KORD")]),
    # N008NB  ORD-DTW-ORD-DTW-ORD  (4 legs, E175)
    ("N008NB", [("KORD","KDTW"), ("KDTW","KORD"), ("KORD","KDTW"), ("KDTW","KORD")]),
    # N009NB  ORD-MSP-DEN-MSP-ORD  (4 legs)
    ("N009NB", [("KORD","KMSP"), ("KMSP","KDEN"), ("KDEN","KMSP"), ("KMSP","KORD")]),
    # N010NB  ORD-MIA-ORD-ATL-ORD  (4 legs)
    ("N010NB", [("KORD","KMIA"), ("KMIA","KORD"), ("KORD","KATL"), ("KATL","KORD")]),

    # ---- ATL fleet ----
    # N011NB  ATL-JFK-ATL-BOS-ATL  (4 legs)
    ("N011NB", [("KATL","KJFK"), ("KJFK","KATL"), ("KATL","KBOS"), ("KBOS","KATL")]),
    # N012NB  ATL-DFW-PHX-DFW-ATL  (4 legs)
    ("N012NB", [("KATL","KDFW"), ("KDFW","KPHX"), ("KPHX","KDFW"), ("KDFW","KATL")]),
    # N013NB  ATL-ORD-MSP-ORD-ATL  (4 legs)
    ("N013NB", [("KATL","KORD"), ("KORD","KMSP"), ("KMSP","KORD"), ("KORD","KATL")]),
    # N014NB  ATL-IAH-ATL-MIA-ATL  (4 legs, 757)
    ("N014NB", [("KATL","KIAH"), ("KIAH","KATL"), ("KATL","KMIA"), ("KMIA","KATL")]),
    # N015NB  ATL-DTW-ATL-DTW-ATL  (4 legs, E175)
    ("N015NB", [("KATL","KDTW"), ("KDTW","KATL"), ("KATL","KDTW"), ("KDTW","KATL")]),
    # N016NB  ATL-DEN-LAS-DEN-ATL  (4 legs)
    ("N016NB", [("KATL","KDEN"), ("KDEN","KLAS"), ("KLAS","KDEN"), ("KDEN","KATL")]),
    # N017NB  ATL-LAX-LAS-LAX-ATL  (4 legs)
    ("N017NB", [("KATL","KLAX"), ("KLAX","KLAS"), ("KLAS","KLAX"), ("KLAX","KATL")]),
    # N018NB  ATL-MIA-ATL-MIA-ATL  (4 legs, E175 short hop)
    ("N018NB", [("KATL","KMIA"), ("KMIA","KATL"), ("KATL","KMIA"), ("KMIA","KATL")]),

    # ---- DFW fleet ----
    # N019NB  DFW-LAX-SEA-LAX-DFW  (4 legs)
    ("N019NB", [("KDFW","KLAX"), ("KLAX","KSEA"), ("KSEA","KLAX"), ("KLAX","KDFW")]),
    # N020NB  DFW-DEN-LAS-DEN-DFW  (4 legs)
    ("N020NB", [("KDFW","KDEN"), ("KDEN","KLAS"), ("KLAS","KDEN"), ("KDEN","KDFW")]),
    # N021NB  DFW-ATL-MIA-ATL-DFW  (4 legs, 757)
    ("N021NB", [("KDFW","KATL"), ("KATL","KMIA"), ("KMIA","KATL"), ("KATL","KDFW")]),
    # N022NB  DFW-ORD-JFK-ORD-DFW  (4 legs)
    ("N022NB", [("KDFW","KORD"), ("KORD","KJFK"), ("KJFK","KORD"), ("KORD","KDFW")]),
    # N023NB  DFW-IAH-DFW-IAH-DFW  (4 legs, E175)
    ("N023NB", [("KDFW","KIAH"), ("KIAH","KDFW"), ("KDFW","KIAH"), ("KIAH","KDFW")]),
    # N024NB  DFW-PHX-LAX-PHX-DFW  (4 legs)
    ("N024NB", [("KDFW","KPHX"), ("KPHX","KLAX"), ("KLAX","KPHX"), ("KPHX","KDFW")]),

    # ---- LAX fleet ----
    # N025NB  LAX-ORD-ATL-ORD-LAX  (4 legs)
    ("N025NB", [("KLAX","KORD"), ("KORD","KATL"), ("KATL","KORD"), ("KORD","KLAX")]),
    # N026NB  LAX-SFO-DEN-SFO-LAX  (4 legs)
    ("N026NB", [("KLAX","KSFO"), ("KSFO","KDEN"), ("KDEN","KSFO"), ("KSFO","KLAX")]),
    # N027NB  LAX-LAS-PHX-LAS-LAX  (4 legs, 757)
    ("N027NB", [("KLAX","KLAS"), ("KLAS","KPHX"), ("KPHX","KLAS"), ("KLAS","KLAX")]),
    # N028NB  LAX-DFW-IAH-DFW-LAX  (4 legs)
    ("N028NB", [("KLAX","KDFW"), ("KDFW","KIAH"), ("KIAH","KDFW"), ("KDFW","KLAX")]),
    # N029NB  LAX-SEA-LAX-DEN-LAX  (4 legs, E175)
    ("N029NB", [("KLAX","KSEA"), ("KSEA","KLAX"), ("KLAX","KDEN"), ("KDEN","KLAX")]),

    # ---- DEN fleet ----
    # N030NB  DEN-ORD-DTW-ORD-DEN  (4 legs)
    ("N030NB", [("KDEN","KORD"), ("KORD","KDTW"), ("KDTW","KORD"), ("KORD","KDEN")]),
    # N031NB  DEN-LAX-SFO-LAX-DEN  (4 legs)
    ("N031NB", [("KDEN","KLAX"), ("KLAX","KSFO"), ("KSFO","KLAX"), ("KLAX","KDEN")]),
    # N032NB  DEN-PHX-LAS-PHX-DEN  (4 legs, E175)
    ("N032NB", [("KDEN","KPHX"), ("KPHX","KLAS"), ("KLAS","KPHX"), ("KPHX","KDEN")]),
    # N033NB  DEN-DFW-IAH-DFW-DEN  (4 legs)
    ("N033NB", [("KDEN","KDFW"), ("KDFW","KIAH"), ("KIAH","KDFW"), ("KDFW","KDEN")]),

    # ---- JFK fleet ----
    # N034NB  JFK-LAX-SFO-LAX-JFK  (4 legs, 757)
    ("N034NB", [("KJFK","KLAX"), ("KLAX","KSFO"), ("KSFO","KLAX"), ("KLAX","KJFK")]),
    # N035NB  JFK-BOS-JFK-MIA-JFK  (4 legs)
    ("N035NB", [("KJFK","KBOS"), ("KBOS","KJFK"), ("KJFK","KMIA"), ("KMIA","KJFK")]),
    # N036NB  JFK-ORD-ATL-ORD-JFK  (4 legs)
    ("N036NB", [("KJFK","KORD"), ("KORD","KATL"), ("KATL","KORD"), ("KORD","KJFK")]),

    # ---- Outlier bases ----
    # N037NB  SEA-LAX-SFO-LAX-SEA  (4 legs, SEA-based)
    ("N037NB", [("KSEA","KLAX"), ("KLAX","KSFO"), ("KSFO","KLAX"), ("KLAX","KSEA")]),
    # N038NB  MIA-ATL-ORD-ATL-MIA  (4 legs, MIA-based)
    ("N038NB", [("KMIA","KATL"), ("KATL","KORD"), ("KORD","KATL"), ("KATL","KMIA")]),
    # N039NB  IAH-DFW-LAX-DFW-IAH  (4 legs, IAH-based)
    ("N039NB", [("KIAH","KDFW"), ("KDFW","KLAX"), ("KLAX","KDFW"), ("KDFW","KIAH")]),
    # N040NB  MSP-ORD-DTW-ORD-MSP  (4 legs, MSP-based, E175)
    ("N040NB", [("KMSP","KORD"), ("KORD","KDTW"), ("KDTW","KORD"), ("KORD","KMSP")]),
]

# ---------------------------------------------------------------------------
# Crew member pool definitions
# ---------------------------------------------------------------------------

CAPTAIN_CERTS = {
    "B737-800": ["B737-800"],
    "A320":     ["A320"],
    "B757-200": ["B757-200"],
    "E175":     ["E175"],
}

# Shared type-rating packages (realistic)
CERT_PACKAGES = [
    ["B737-800"],
    ["B737-800", "B757-200"],
    ["A320"],
    ["A320", "B737-800"],
    ["B757-200"],
    ["E175"],
    ["E175", "B737-800"],
]


def _base_for_aircraft(acid: str) -> str:
    for a in AIRCRAFT:
        if a["id"] == acid:
            return a["base_airport_id"]
    raise ValueError(f"Unknown aircraft id: {acid}")


def _min_turn(acid: str) -> int:
    for a in AIRCRAFT:
        if a["id"] == acid:
            return a["min_turn_minutes"]
    return 45


def _seats(acid: str) -> int:
    for a in AIRCRAFT:
        if a["id"] == acid:
            return a["seats"]
    return 150


# ---------------------------------------------------------------------------
# Flight generation
# ---------------------------------------------------------------------------

def build_flights() -> list[dict]:
    """Build all flights from ROTATIONS, enforcing valid chaining."""
    flights: list[dict] = []
    flight_counter = 101

    for acid, legs in ROTATIONS:
        base = _base_for_aircraft(acid)
        min_turn = _min_turn(acid)
        seats = _seats(acid)
        utc_offset = UTC_OFFSETS.get(base, 6)

        # First departure ~ 06:00 local → convert to UTC, add random jitter
        local_depart_hour = 6
        utc_hour = local_depart_hour + utc_offset
        jitter_minutes = random.randint(0, 60)
        current_time = BASE_DATE.replace(
            hour=utc_hour % 24,
            minute=jitter_minutes,
            second=0,
            microsecond=0,
        )
        if utc_hour >= 24:
            current_time += timedelta(days=1)

        # Verify chain starts at base
        if legs[0][0] != base:
            log.warning(
                "Aircraft %s rotation does not start at base %s — skipping",
                acid, base,
            )
            continue

        for origin, dest in legs:
            block = get_flight_time(origin, dest) + random.randint(-3, 8)
            departure = current_time
            arrival = departure + timedelta(minutes=block)
            pax = random.randint(int(seats * 0.55), int(seats * 0.95))

            flights.append({
                "id": f"NB{flight_counter}",
                "aircraft_id": acid,
                "origin": origin,
                "destination": dest,
                "scheduled_departure": departure.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "scheduled_arrival":   arrival.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "passengers": pax,
                "status": "scheduled",
                "delay_minutes": 0,
            })
            flight_counter += 1
            # Next departure = this arrival + min turn + random ground buffer
            current_time = arrival + timedelta(minutes=min_turn + random.randint(5, 25))

    return flights


def validate_rotations(flights: list[dict]) -> bool:
    """Assert that no two consecutive flights for the same aircraft violate continuity."""
    by_aircraft: dict[str, list[dict]] = {}
    for f in flights:
        by_aircraft.setdefault(f["aircraft_id"], []).append(f)

    ok = True
    for acid, flist in by_aircraft.items():
        # Sort by scheduled departure
        flist.sort(key=lambda x: x["scheduled_departure"])
        for i in range(1, len(flist)):
            prev, curr = flist[i - 1], flist[i]
            if prev["destination"] != curr["origin"]:
                log.error(
                    "Continuity violation for %s: flight %s dest=%s but flight %s origin=%s",
                    acid, prev["id"], prev["destination"], curr["id"], curr["origin"],
                )
                ok = False
            min_turn = _min_turn(acid)
            prev_arr = datetime.fromisoformat(prev["scheduled_arrival"].replace("Z", "+00:00"))
            curr_dep = datetime.fromisoformat(curr["scheduled_departure"].replace("Z", "+00:00"))
            ground = (curr_dep - prev_arr).total_seconds() / 60
            if ground < min_turn:
                log.error(
                    "Turn violation for %s: only %.0f min ground between %s and %s (min=%d)",
                    acid, ground, prev["id"], curr["id"], min_turn,
                )
                ok = False
    return ok


# ---------------------------------------------------------------------------
# Crew generation
# ---------------------------------------------------------------------------

def _ac_type(acid: str) -> str:
    for a in AIRCRAFT:
        if a["id"] == acid:
            return a["type"]
    return "B737-800"


def build_crew_members() -> tuple[list[dict], list[dict], list[dict]]:
    """Return (captains, first_officers, flight_attendants)."""
    bases = [a["base_airport_id"] for a in AIRCRAFT]
    # weighted by fleet size at each base
    base_pool = (
        ["KORD"] * 10 + ["KATL"] * 8 + ["KDFW"] * 6 +
        ["KLAX"] * 5 + ["KDEN"] * 4 + ["KJFK"] * 3 +
        ["KSEA", "KMIA", "KIAH", "KMSP"]
    )

    captains = []
    for i in range(1, 21):
        base = base_pool[(i - 1) % len(base_pool)]
        cert_pkg = random.choice(CERT_PACKAGES)
        captains.append({
            "id": f"CAP{i:03d}",
            "role": "captain",
            "base_airport_id": base,
            "cert_types": cert_pkg,
            "flight_time_7d_minutes":   random.randint(200, 480),
            "flight_time_28d_minutes":  random.randint(1200, 2000),
            "flight_time_365d_minutes": random.randint(35000, 52000),
        })

    first_officers = []
    for i in range(1, 21):
        base = base_pool[(i + 4) % len(base_pool)]
        cert_pkg = random.choice(CERT_PACKAGES)
        first_officers.append({
            "id": f"FO{i:03d}",
            "role": "first_officer",
            "base_airport_id": base,
            "cert_types": cert_pkg,
            "flight_time_7d_minutes":   random.randint(180, 420),
            "flight_time_28d_minutes":  random.randint(900, 1800),
            "flight_time_365d_minutes": random.randint(20000, 42000),
        })

    flight_attendants = []
    for i in range(1, 21):
        base = base_pool[(i + 9) % len(base_pool)]
        flight_attendants.append({
            "id": f"FA{i:03d}",
            "role": "flight_attendant",
            "base_airport_id": base,
            "cert_types": [],
            "flight_time_7d_minutes":   random.randint(150, 480),
            "flight_time_28d_minutes":  random.randint(800, 2000),
            "flight_time_365d_minutes": random.randint(18000, 48000),
        })

    return captains, first_officers, flight_attendants


def build_crew_pairings(
    flights: list[dict],
    captains: list[dict],
    first_officers: list[dict],
    flight_attendants: list[dict],
) -> list[dict]:
    """
    Build 60 crew pairings.

    Strategy:
      - Group flights by aircraft into ordered legs.
      - Assign 1-2 consecutive legs to one pairing (multi-leg pairings).
      - Cycle through crew pool, respecting a simple duty-time budget
        (max 9 flight hours / pairing, FAR 117 long-call).
    """
    # Sort flights by aircraft then departure
    by_aircraft: dict[str, list[dict]] = {}
    for f in flights:
        by_aircraft.setdefault(f["aircraft_id"], []).append(f)
    for acid in by_aircraft:
        by_aircraft[acid].sort(key=lambda x: x["scheduled_departure"])

    pairings: list[dict] = []
    pairing_counter = 1
    cap_idx = fo_idx = fa_idx = 0

    for acid, legs in by_aircraft.items():
        i = 0
        while i < len(legs) and pairing_counter <= 60:
            # Decide how many legs to bundle (1 or 2)
            bundle_size = 1
            if i + 1 < len(legs):
                # Check if adding the next leg keeps duty ≤ 9h flight time
                ft1 = (
                    datetime.fromisoformat(legs[i]["scheduled_arrival"].replace("Z", "+00:00"))
                    - datetime.fromisoformat(legs[i]["scheduled_departure"].replace("Z", "+00:00"))
                ).total_seconds() / 60
                ft2 = (
                    datetime.fromisoformat(legs[i + 1]["scheduled_arrival"].replace("Z", "+00:00"))
                    - datetime.fromisoformat(legs[i + 1]["scheduled_departure"].replace("Z", "+00:00"))
                ).total_seconds() / 60
                if ft1 + ft2 <= 540:   # 9 hours total flight time
                    bundle_size = 2 if random.random() < 0.6 else 1

            bundle = legs[i: i + bundle_size]

            # Duty start = 1 hour before first departure (pre-flight)
            duty_start_dt = datetime.fromisoformat(
                bundle[0]["scheduled_departure"].replace("Z", "+00:00")
            ) - timedelta(hours=1)
            # Duty end = 30 min after last arrival (post-flight)
            duty_end_dt = datetime.fromisoformat(
                bundle[-1]["scheduled_arrival"].replace("Z", "+00:00")
            ) + timedelta(minutes=30)

            total_flight_min = sum(
                (
                    datetime.fromisoformat(f["scheduled_arrival"].replace("Z", "+00:00"))
                    - datetime.fromisoformat(f["scheduled_departure"].replace("Z", "+00:00"))
                ).total_seconds() / 60
                for f in bundle
            )

            cap = captains[cap_idx % len(captains)]
            fo  = first_officers[fo_idx % len(first_officers)]
            # Narrow-body needs 2 FAs; wide / regional may vary
            seats = _seats(acid)
            n_fas = 2 if seats <= 150 else (3 if seats <= 175 else 4)
            fa_ids = [
                flight_attendants[(fa_idx + k) % len(flight_attendants)]["id"]
                for k in range(n_fas)
            ]

            # One pairing per bundle (if bundle has 2 legs, both are in the same pairing)
            # We create one pairing record per leg so flight_id is unique, but
            # captain/FO/FAs are shared across legs of the same bundle.
            for leg_idx, f in enumerate(bundle):
                if pairing_counter > 60:
                    break
                pairings.append({
                    "id": f"CP{pairing_counter:03d}",
                    "flight_id": f["id"],
                    "captain_id": cap["id"],
                    "first_officer_id": fo["id"],
                    "fa_ids": fa_ids,
                    "duty_start": duty_start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "duty_end":   duty_end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "rest_start": None,
                    "flight_time_minutes": int(total_flight_min),
                    "status": "assigned",
                })
                pairing_counter += 1

            cap_idx += 1
            fo_idx  += 1
            fa_idx  += n_fas
            i += bundle_size

    return pairings[:60]


# ---------------------------------------------------------------------------
# YAML serialisation helpers
# ---------------------------------------------------------------------------

def _str_representer(dumper: yaml.Dumper, data: str) -> yaml.ScalarNode:
    """Force double-quoted strings for datetime fields to preserve Z suffix."""
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style='"')


class NimbusYamlDumper(yaml.Dumper):
    """Custom dumper: block style, quoted strings where needed, None -> null."""
    pass


NimbusYamlDumper.add_representer(type(None), lambda d, _: d.represent_scalar("tag:yaml.org,2002:null", "null"))


def dump_yaml(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        yaml.dump(data, fh, Dumper=NimbusYamlDumper, allow_unicode=True,
                  default_flow_style=False, sort_keys=False, width=120)
    log.info("Wrote %s (%d bytes)", path, path.stat().st_size)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Nimbus Air network YAML files")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Root output directory (default: project root data/network/)",
    )
    args = parser.parse_args()

    # Resolve output directory relative to this script's project root
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    out_dir = Path(args.output_dir) if args.output_dir else project_root / "data" / "network"
    out_dir.mkdir(parents=True, exist_ok=True)

    log.info("Output directory: %s", out_dir)

    # ---- airports.yaml ----
    airports_data = {"airports": AIRPORTS}
    dump_yaml(airports_data, out_dir / "airports.yaml")

    # ---- aircraft.yaml ----
    aircraft_data = {"aircraft": AIRCRAFT}
    dump_yaml(aircraft_data, out_dir / "aircraft.yaml")

    # ---- flights.yaml ----
    log.info("Building flight rotations for %d aircraft...", len(ROTATIONS))
    flights = build_flights()
    log.info("Generated %d flights", len(flights))

    if not validate_rotations(flights):
        log.error("Rotation validation FAILED — check output above")
    else:
        log.info("All rotations valid (continuity + turn times OK)")

    flights_data = {"flights": flights}
    dump_yaml(flights_data, out_dir / "flights.yaml")

    # ---- crews.yaml ----
    captains, first_officers, flight_attendants = build_crew_members()
    pairings = build_crew_pairings(flights, captains, first_officers, flight_attendants)
    log.info("Generated %d crew pairings", len(pairings))

    crews_data = {
        "crew_members": captains + first_officers + flight_attendants,
        "crew_pairings": pairings,
    }
    dump_yaml(crews_data, out_dir / "crews.yaml")

    log.info("Done. Files written to %s", out_dir)


if __name__ == "__main__":
    main()
