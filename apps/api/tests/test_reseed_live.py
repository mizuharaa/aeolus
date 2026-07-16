"""Reseed-from-live-ADS-B — the smallest checks that fail if the logic breaks."""

from src.routes.simulator import _haversine_nm, _nearest_airport, _project_nm
from src.simulator.engine import SimulationEngine

AIRPORTS = [
    {"id": "KORD", "lat": 41.98, "lon": -87.90},
    {"id": "KATL", "lat": 33.64, "lon": -84.43},
    {"id": "KDEN", "lat": 39.86, "lon": -104.67},
]


def test_projection_moves_along_heading():
    lat, lon = _project_nm(40.0, -95.0, 0.0, 60.0)  # due north, 60 nm = 1° lat
    assert abs(lat - 41.0) < 0.01 and abs(lon - (-95.0)) < 0.01
    lat, lon = _project_nm(40.0, -95.0, 90.0, 60.0)  # due east
    assert abs(lat - 40.0) < 0.01 and lon > -95.0


def test_nearest_airport_and_exclusion():
    near_ord = _nearest_airport(AIRPORTS, 42.0, -88.0)
    assert near_ord is not None and near_ord["id"] == "KORD"
    second = _nearest_airport(AIRPORTS, 42.0, -88.0, exclude="KORD")
    assert second is not None and second["id"] != "KORD"


def test_haversine_ord_atl_plausible():
    d = _haversine_nm(41.98, -87.90, 33.64, -84.43)
    assert 500 < d < 550  # ORD–ATL ≈ 527 nm


def test_engine_reseed_replaces_schedule_and_state():
    eng = SimulationEngine(
        schedule=[
            {
                "id": "NB101",
                "aircraft_id": "N001NB",
                "origin": "KORD",
                "destination": "KATL",
                "scheduled_departure": "2026-07-15T08:00:00Z",
                "scheduled_arrival": "2026-07-15T10:00:00Z",
                "passengers": 150,
            }
        ],
        aircraft=[
            {
                "id": "N001NB",
                "type": "B737-800",
                "seats": 162,
                "base_airport_id": "KORD",
                "min_turn_minutes": 45,
            }
        ],
        crews=[],
    )
    eng.state.recovery_plans.append({"plan_id": "A"})
    eng.reseed(
        [
            {
                "id": "UAL123",
                "aircraft_id": "LV-UAL123",
                "origin": "KDEN",
                "destination": "KORD",
                "scheduled_departure": "2026-07-15T12:00:00Z",
                "scheduled_arrival": "2026-07-15T14:00:00Z",
                "passengers": 160,
            }
        ],
        [
            {
                "id": "LV-UAL123",
                "type": "B737-800",
                "seats": 162,
                "base_airport_id": "KDEN",
                "min_turn_minutes": 45,
            }
        ],
    )
    assert set(eng.schedule) == {"UAL123"}
    assert set(eng.state.flight_states) == {"UAL123"}
    assert eng.state.recovery_plans == []
    assert "LV-UAL123" in eng.aircraft
