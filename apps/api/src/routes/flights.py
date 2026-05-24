"""
Real-time flight data endpoints.

Backed by OpenSky Network (free, no API key required for anonymous access).
Provides live US flight positions, flight search, and tracking URL generation.

Rate limiting note: OpenSky anonymous = 100 req/10 min.
The client caches responses for 30 s to keep well within the limit.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/flights/live")
async def get_live_flights(
    request: Request,
    limit: int = Query(default=500, ge=1, le=2000),
    on_ground: Optional[bool] = Query(default=False),
    airline: Optional[str] = Query(
        default=None, description="Filter by IATA airline code (e.g. 'AA')"
    ),
):
    """
    Return live US flight positions from OpenSky Network.

    Filters:
    - on_ground=false  (default) — airborne only
    - airline=AA       — filter by IATA airline prefix
    """
    opensky = getattr(request.app.state, "opensky", None)
    if opensky is None:
        return {
            "flights": [],
            "total": 0,
            "source": "unavailable",
            "error": "OpenSky client not initialised",
        }

    flights = await opensky.get_us_flights()

    # Apply filters
    if on_ground is False:
        flights = [f for f in flights if not f.get("on_ground", False)]
    elif on_ground is True:
        flights = [f for f in flights if f.get("on_ground", False)]

    if airline:
        airline_upper = airline.upper()
        flights = [f for f in flights if f.get("airline_iata", "") == airline_upper]

    status = opensky.status()

    return {
        "flights": flights[:limit],
        "total": len(flights),
        "limit": limit,
        "cache_age_sec": status["cache_age_sec"],
        "authenticated": status["authenticated"],
        "source": "opensky-network.org",
    }


@router.get("/flights/search")
async def search_flights(
    request: Request,
    q: str = Query(..., min_length=2, description="Flight code (e.g. 'AA123', 'UAL456', 'N12345')"),
):
    """
    Search live flights by IATA or ICAO flight number.

    Examples:
      ?q=AA123   → American Airlines flight 123
      ?q=UAL456  → United Airlines flight 456 (ICAO prefix)
      ?q=DAL     → All Delta flights currently airborne
    """
    opensky = getattr(request.app.state, "opensky", None)
    if opensky is None:
        raise HTTPException(status_code=503, detail="OpenSky client not available")

    results = await opensky.search(q)
    return {
        "query": q,
        "results": results,
        "count": len(results),
        "source": "opensky-network.org",
    }


@router.get("/flights/status/opensky")
async def opensky_status(request: Request):
    """Return OpenSky client cache status — useful for health dashboards."""
    opensky = getattr(request.app.state, "opensky", None)
    if opensky is None:
        return {"available": False, "error": "client not initialised"}
    return {"available": True, **opensky.status()}


@router.get("/flights/{icao24}")
async def get_flight_by_icao24(
    icao24: str,
    request: Request,
):
    """
    Get a specific aircraft's current state by ICAO 24-bit transponder hex (e.g. 'a4f4b2').

    Returns full state including tracking URLs for FlightAware, Flightradar24,
    and ADSBExchange.
    """
    opensky = getattr(request.app.state, "opensky", None)
    if opensky is None:
        raise HTTPException(status_code=503, detail="OpenSky client not available")

    flight = await opensky.get_by_icao24(icao24.lower())
    if flight is None:
        raise HTTPException(
            status_code=404,
            detail=f"Aircraft {icao24} not currently tracked in US airspace",
        )

    return flight
