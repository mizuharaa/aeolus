"""Weather data endpoints (aviationweather.gov METAR)."""
from fastapi import APIRouter, HTTPException, Request

router = APIRouter()


@router.get("/weather/metars")
async def get_all_metars(request: Request):
    """Return cached METAR data for all Nimbus airports."""
    weather = request.app.state.weather
    if not weather:
        raise HTTPException(status_code=503, detail="Weather client not initialized")
    return {"metars": weather.get_all_cached()}


@router.get("/weather/metar/{airport_id}")
async def get_metar(airport_id: str, request: Request):
    """Return METAR for a single airport."""
    weather = request.app.state.weather
    if not weather:
        raise HTTPException(status_code=503, detail="Weather client not initialized")
    metar = weather.get_cached(airport_id.upper())
    if not metar:
        # Try to fetch live
        try:
            results = await weather.fetch_metars([airport_id.upper()])
            metar = results.get(airport_id.upper())
            if metar:
                return metar.to_dict()
        except Exception:
            pass
        raise HTTPException(status_code=404, detail=f"No METAR data for {airport_id}")
    return metar


@router.post("/weather/refresh")
async def refresh_metars(request: Request):
    """Force a fresh METAR fetch."""
    weather = request.app.state.weather
    if not weather:
        raise HTTPException(status_code=503, detail="Weather client not initialized")
    results = await weather.fetch_metars()
    return {"fetched": len(results), "airports": list(results.keys())}
