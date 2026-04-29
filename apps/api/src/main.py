"""
Aeolus FastAPI application — entry point.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.data.opensky import OpenSkyClient
from src.optimizer.milp import RecoveryOptimizer
from src.predictor.cascade import CascadePredictor
from src.routes import events, live, network, predict, recovery, simulator, weather
from src.routes.flights import router as flights_router
from src.simulator.engine import SimulationEngine
from src.weather.client import WeatherClient
from src.ws.handlers import simulation_ws_handler

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "network"


def _load_network() -> tuple[list, list, list]:
    """Load Nimbus Air network from YAML files."""
    try:
        with open(DATA_DIR / "flights.yaml") as f:
            flights = yaml.safe_load(f).get("flights", [])
        with open(DATA_DIR / "aircraft.yaml") as f:
            aircraft = yaml.safe_load(f).get("aircraft", [])
        with open(DATA_DIR / "crews.yaml") as f:
            crews = yaml.safe_load(f).get("crew_pairings", [])
        return flights, aircraft, crews
    except FileNotFoundError:
        logger.warning("Network YAML files not found — using minimal synthetic data")
        return _minimal_network()


def _minimal_network():
    """Minimal fallback when YAML files are absent."""
    aircraft_bases = [
        ("N001NB", "KORD"), ("N002NB", "KORD"), ("N003NB", "KORD"),
        ("N004NB", "KATL"), ("N005NB", "KATL"), ("N006NB", "KDFW"),
        ("N007NB", "KLAX"), ("N008NB", "KDEN"), ("N009NB", "KJFK"),
        ("N010NB", "KSEA"),
    ]
    routes = [
        ("KORD", "KATL"), ("KATL", "KMIA"), ("KMIA", "KATL"), ("KATL", "KORD"),
        ("KORD", "KDFW"), ("KDFW", "KLAX"), ("KLAX", "KDFW"), ("KDFW", "KORD"),
        ("KORD", "KDEN"), ("KDEN", "KPHX"), ("KPHX", "KDEN"), ("KDEN", "KORD"),
        ("KATL", "KJFK"), ("KJFK", "KBOS"), ("KBOS", "KJFK"), ("KJFK", "KATL"),
        ("KATL", "KIAH"), ("KIAH", "KATL"), ("KATL", "KORD"), ("KORD", "KATL"),
        ("KDFW", "KPHX"), ("KPHX", "KLAS"), ("KLAS", "KPHX"), ("KPHX", "KDFW"),
        ("KLAX", "KSFO"), ("KSFO", "KDEN"), ("KDEN", "KSFO"), ("KSFO", "KLAX"),
        ("KDEN", "KLAS"), ("KLAS", "KDEN"), ("KDEN", "KMSP"), ("KMSP", "KDEN"),
        ("KJFK", "KMIA"), ("KMIA", "KJFK"), ("KJFK", "KBOS"), ("KBOS", "KJFK"),
        ("KSEA", "KLAX"), ("KLAX", "KSEA"), ("KSEA", "KSFO"), ("KSFO", "KSEA"),
    ]
    dep_hours = [11, 13, 16, 18, 11, 13, 16, 18, 11, 14, 17, 19,
                 11, 13, 16, 18, 11, 14, 17, 19, 11, 13, 16, 18,
                 11, 14, 17, 20, 11, 13, 16, 18, 11, 14, 17, 20,
                 11, 14, 17, 20]
    flights = []
    for i, (orig, dest) in enumerate(routes):
        ac_id = aircraft_bases[i % len(aircraft_bases)][0]
        dep_h = dep_hours[i % len(dep_hours)]
        flights.append({
            "id": f"NB{101 + i}",
            "aircraft_id": ac_id,
            "origin": orig,
            "destination": dest,
            "scheduled_departure": f"2024-01-15T{dep_h:02d}:00:00Z",
            "scheduled_arrival": f"2024-01-15T{dep_h + 2:02d}:30:00Z",
            "passengers": 130 + i * 3,
            "status": "scheduled",
            "delay_minutes": 0,
        })
    aircraft = [
        {"id": aid, "type": "B737-800", "base_airport_id": base, "seats": 162, "min_turn_minutes": 45}
        for aid, base in aircraft_bases
    ]
    crews = [
        {
            "id": f"CP{i:03d}", "flight_id": f"NB{101 + i}",
            "captain_id": f"CAP{i:03d}", "first_officer_id": f"FO{i:03d}",
            "fa_ids": [f"FA{i * 2:03d}", f"FA{i * 2 + 1:03d}"],
            "duty_start": "2024-01-15T10:00:00Z", "duty_end": "2024-01-15T22:00:00Z",
            "flight_time_minutes": 150, "status": "assigned",
        }
        for i in range(len(flights))
    ]
    return flights, aircraft, crews


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    logger.info("Starting Aeolus API...")

    # Initialise components
    predictor = CascadePredictor()
    optimizer = RecoveryOptimizer(
        timeout_secs=settings.solver_timeout_secs,
        use_fallback=settings.use_heuristic_fallback,
    )
    weather_client = WeatherClient()

    # OpenSky Network — load OAuth2 credentials (JSON file or env vars)
    _client_id     = settings.opensky_client_id
    _client_secret = settings.opensky_client_secret
    if not (_client_id and _client_secret):
        # Try loading from credentials/credentials.json (repo-local, git-ignored)
        try:
            import json as _json
            _cred_path = Path(__file__).parent.parent.parent.parent / "credentials" / "credentials.json"
            if _cred_path.exists():
                _creds     = _json.loads(_cred_path.read_text())
                _client_id     = _creds.get("clientId", "")
                _client_secret = _creds.get("clientSecret", "")
                logger.info("OpenSky: loaded OAuth2 credentials from credentials.json")
        except Exception as _e:
            logger.warning("OpenSky: could not load credentials.json — %s", _e)

    opensky = OpenSkyClient(
        client_id=_client_id or None,
        client_secret=_client_secret or None,
    )

    # Load network
    flights, aircraft, crews = _load_network()
    engine = SimulationEngine(flights, aircraft, crews)

    # Attach to app state
    app.state.predictor = predictor
    app.state.optimizer = optimizer
    app.state.weather = weather_client
    app.state.engine = engine
    app.state.opensky = opensky

    # Background tasks
    asyncio.create_task(weather_client.fetch_metars())
    asyncio.create_task(weather_client.start_background_fetch(settings.weather_fetch_interval_secs))

    # Pre-warm OpenSky cache
    asyncio.create_task(_prefetch_opensky(opensky))

    logger.info(
        "Aeolus ready — %d flights, %d aircraft, %d crew pairings | OpenSky: %s",
        len(flights), len(aircraft), len(crews),
        "authenticated" if (settings.opensky_username) else "anonymous",
    )

    yield

    await weather_client.close()
    logger.info("Aeolus API shut down cleanly")


async def _prefetch_opensky(client: OpenSkyClient) -> None:
    """Pre-warm the OpenSky cache at startup so first request is fast."""
    try:
        flights = await client.get_us_flights()
        logger.info("OpenSky pre-warm: %d flights cached", len(flights))
    except Exception as exc:
        logger.warning("OpenSky pre-warm failed: %s", exc)


app = FastAPI(
    title="Aeolus API",
    description="Airline disruption simulation and recovery engine — real flight data via OpenSky Network",
    version="0.2.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers — flights_router must come before network.router because
# network.router registers GET /flights/{flight_id} which would otherwise
# shadow the explicit /flights/live and /flights/search routes.
app.include_router(flights_router,    prefix="/api/v1", tags=["flights"])
app.include_router(network.router,    prefix="/api/v1", tags=["network"])
app.include_router(events.router,     prefix="/api/v1", tags=["events"])
app.include_router(recovery.router,   prefix="/api/v1", tags=["recovery"])
app.include_router(predict.router,    prefix="/api/v1", tags=["predict"])
app.include_router(weather.router,    prefix="/api/v1", tags=["weather"])
app.include_router(simulator.router,  prefix="/api/v1", tags=["simulator"])
app.include_router(live.router,       prefix="/api/v1", tags=["live"])


@app.get("/health", tags=["health"])
async def health(request: Request):
    opensky = getattr(request.app.state, "opensky", None)
    opensky_status = opensky.status() if opensky else {"available": False}
    return {
        "status":  "ok",
        "service": "aeolus-api",
        "version": "0.2.0",
        "opensky": opensky_status,
    }


@app.websocket("/ws/simulation")
async def ws_endpoint(websocket: WebSocket):
    await simulation_ws_handler(websocket, websocket.app.state.engine)
