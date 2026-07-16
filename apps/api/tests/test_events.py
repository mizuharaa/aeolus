"""Tests for all 10 disruption event types."""

import random
from datetime import datetime, timedelta

from src.events.airspace_closure import AirspaceClosureEvent
from src.events.atc_staffing import ATCStaffingEvent
from src.events.base import EventKind
from src.events.crew_sickout import CrewSickoutEvent
from src.events.cyber_incident import CyberIncidentEvent
from src.events.ground_stop import GroundStopEvent
from src.events.mechanical_aog import MechanicalAOGEvent
from src.events.runway_closure import RunwayClosureEvent
from src.events.security_event import SecurityEvent
from src.events.volcanic_ash import VolcanicAshEvent
from src.events.weather_closure import WeatherClosureEvent

NOW = datetime(2024, 1, 15, 12, 0, 0)

SAMPLE_SCHEDULE = [
    {
        "id": "NB101",
        "aircraft_id": "N001NB",
        "origin": "KORD",
        "destination": "KATL",
        "scheduled_departure": "2024-01-15T13:00:00Z",
        "scheduled_arrival": "2024-01-15T15:30:00Z",
        "passengers": 148,
        "status": "scheduled",
    },
    {
        "id": "NB102",
        "aircraft_id": "N001NB",
        "origin": "KATL",
        "destination": "KMIA",
        "scheduled_departure": "2024-01-15T16:30:00Z",
        "scheduled_arrival": "2024-01-15T17:45:00Z",
        "passengers": 135,
        "status": "scheduled",
    },
    {
        "id": "NB103",
        "aircraft_id": "N002NB",
        "origin": "KORD",
        "destination": "KDFW",
        "scheduled_departure": "2024-01-15T14:00:00Z",
        "scheduled_arrival": "2024-01-15T16:40:00Z",
        "passengers": 150,
        "status": "scheduled",
    },
    {
        "id": "NB104",
        "aircraft_id": "N002NB",
        "origin": "KDFW",
        "destination": "KLAX",
        "scheduled_departure": "2024-01-15T17:45:00Z",
        "scheduled_arrival": "2024-01-15T20:00:00Z",
        "passengers": 142,
        "status": "scheduled",
    },
]


def _make_event(cls, params: dict):
    # model_fields is Pydantic v2; fall back to __fields__ for v1 compat
    fields = getattr(cls, "model_fields", None) or cls.__fields__
    kind_default = fields["kind"].default
    return cls(id="test-1", kind=kind_default, triggered_at=NOW, params=params)


class TestWeatherClosure:
    def test_kind(self):
        ev = _make_event(
            WeatherClosureEvent, {"airport": "KORD", "severity": "severe", "duration_hours": 4}
        )
        assert ev.kind == EventKind.WEATHER_CLOSURE

    def test_affected_flights_departing(self):
        ev = _make_event(
            WeatherClosureEvent, {"airport": "KORD", "severity": "severe", "duration_hours": 4}
        )
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        ids = [f["id"] for f in affected]
        assert "NB101" in ids
        assert "NB103" in ids

    def test_affected_flights_not_at_other_airports(self):
        ev = _make_event(
            WeatherClosureEvent, {"airport": "KMSP", "severity": "severe", "duration_hours": 4}
        )
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        assert len(affected) == 0

    def test_constraints_structure(self):
        ev = _make_event(
            WeatherClosureEvent, {"airport": "KORD", "severity": "severe", "duration_hours": 4}
        )
        constraints = ev.constraints()
        assert len(constraints) > 0
        assert constraints[0]["type"] == "airport_unavailable"

    def test_duration(self):
        ev = _make_event(
            WeatherClosureEvent, {"airport": "KORD", "severity": "severe", "duration_hours": 4}
        )
        assert ev.duration().total_seconds() == 4 * 3600

    def test_default_scenario(self):
        default = WeatherClosureEvent.default_scenario_dict()
        assert "kind" in default
        assert "params" in default


class TestGroundStop:
    def test_kind(self):
        ev = _make_event(GroundStopEvent, {"airport": "KORD", "duration_hours": 2})
        assert ev.kind == EventKind.GROUND_STOP

    def test_affects_departures_only(self):
        ev = _make_event(GroundStopEvent, {"airport": "KORD", "duration_hours": 2})
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        # Should affect departures from KORD
        for f in affected:
            assert f["origin"] == "KORD"

    def test_constraints_type(self):
        ev = _make_event(GroundStopEvent, {"airport": "KORD", "duration_hours": 2})
        c = ev.constraints()
        assert any(con["type"] in ("ground_stop", "airport_unavailable") for con in c)


class TestAirspaceClosure:
    def test_kind(self):
        ev = _make_event(
            AirspaceClosureEvent,
            {
                "polygon": {
                    "type": "Polygon",
                    "coordinates": [[[44, 25], [63, 25], [63, 40], [44, 40], [44, 25]]],
                },
                "duration_hours": 24,
            },
        )
        assert ev.kind == EventKind.AIRSPACE_CLOSURE

    def test_constraints_structure(self):
        ev = _make_event(
            AirspaceClosureEvent,
            {
                "polygon": {
                    "type": "Polygon",
                    "coordinates": [[[44, 25], [63, 25], [63, 40], [44, 40], [44, 25]]],
                },
                "duration_hours": 24,
            },
        )
        c = ev.constraints()
        assert len(c) > 0
        assert c[0]["type"] == "airspace_unavailable"


class TestSecurityEvent:
    def test_kind(self):
        ev = _make_event(
            SecurityEvent, {"airport": "KATL", "severity": "severe", "duration_hours": 3}
        )
        assert ev.kind == EventKind.SECURITY_EVENT

    def test_affects_all_at_airport(self):
        ev = _make_event(
            SecurityEvent, {"airport": "KORD", "severity": "severe", "duration_hours": 3}
        )
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        ids = [f["id"] for f in affected]
        assert "NB101" in ids

    def test_duration(self):
        ev = _make_event(
            SecurityEvent, {"airport": "KATL", "severity": "severe", "duration_hours": 3}
        )
        assert ev.duration() == timedelta(hours=3)


class TestMechanicalAOG:
    def test_kind(self):
        ev = _make_event(
            MechanicalAOGEvent, {"aircraft_tail": "N001NB", "airport": "KATL", "duration_hours": 8}
        )
        assert ev.kind == EventKind.MECHANICAL_AOG

    def test_affects_only_that_aircraft(self):
        ev = _make_event(
            MechanicalAOGEvent, {"aircraft_tail": "N001NB", "airport": "KATL", "duration_hours": 8}
        )
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        for f in affected:
            assert f["aircraft_id"] == "N001NB"

    def test_does_not_affect_other_aircraft(self):
        ev = _make_event(
            MechanicalAOGEvent, {"aircraft_tail": "N999NB", "airport": "KORD", "duration_hours": 4}
        )
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        assert len(affected) == 0

    def test_constraints(self):
        ev = _make_event(
            MechanicalAOGEvent, {"aircraft_tail": "N001NB", "airport": "KATL", "duration_hours": 8}
        )
        c = ev.constraints()
        assert any(con["type"] == "aircraft_grounded" for con in c)


class TestCrewSickout:
    def test_kind(self):
        ev = _make_event(
            CrewSickoutEvent, {"base": "KORD", "percent_affected": 30, "duration_hours": 8}
        )
        assert ev.kind == EventKind.CREW_SICKOUT

    def test_constraints_crew_unavailable(self):
        ev = _make_event(
            CrewSickoutEvent, {"base": "KORD", "percent_affected": 30, "duration_hours": 8}
        )
        c = ev.constraints()
        assert any(con["type"] in ("crew_unavailable", "crew_reduction") for con in c)

    def test_duration(self):
        ev = _make_event(
            CrewSickoutEvent, {"base": "KORD", "percent_affected": 30, "duration_hours": 8}
        )
        assert ev.duration() == timedelta(hours=8)


class TestRunwayClosure:
    def test_kind(self):
        ev = _make_event(
            RunwayClosureEvent,
            {"airport": "KDFW", "runway_id": "17L", "capacity_cut_pct": 45, "duration_hours": 6},
        )
        assert ev.kind == EventKind.RUNWAY_CLOSURE

    def test_affects_flights_at_airport(self):
        ev = _make_event(
            RunwayClosureEvent,
            {"airport": "KORD", "runway_id": "10L", "capacity_cut_pct": 50, "duration_hours": 4},
        )
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        for f in affected:
            assert f["origin"] == "KORD" or f["destination"] == "KORD"

    def test_simulation_evaluation_does_not_touch_global_random_state(self):
        ev = _make_event(
            RunwayClosureEvent,
            {"airport": "KORD", "runway_id": "10L", "capacity_cut_pct": 50, "duration_hours": 4},
        )
        state_before_test = random.getstate()
        try:
            random.seed(918273)
            state_before_tick = random.getstate()

            first_tick = ev.affected_flights(SAMPLE_SCHEDULE)
            second_tick = ev.affected_flights(SAMPLE_SCHEDULE)

            assert random.getstate() == state_before_tick
            assert [flight["id"] for flight in first_tick] == [
                flight["id"] for flight in second_tick
            ]
        finally:
            random.setstate(state_before_test)

    def test_constraints_capacity(self):
        ev = _make_event(
            RunwayClosureEvent,
            {"airport": "KDFW", "runway_id": "17L", "capacity_cut_pct": 45, "duration_hours": 6},
        )
        c = ev.constraints()
        assert any(con["type"] == "capacity_reduced" for con in c)


class TestATCStaffing:
    def test_kind(self):
        ev = _make_event(
            ATCStaffingEvent, {"sector_or_airport": "KLAS", "capacity_pct": 40, "duration_hours": 5}
        )
        assert ev.kind == EventKind.ATC_STAFFING

    def test_constraints(self):
        ev = _make_event(
            ATCStaffingEvent, {"sector_or_airport": "KLAS", "capacity_pct": 40, "duration_hours": 5}
        )
        c = ev.constraints()
        assert len(c) > 0

    def test_default_scenario(self):
        default = ATCStaffingEvent.default_scenario_dict()
        assert default["params"]["capacity_pct"] < 100


class TestVolcanicAsh:
    def test_kind(self):
        ev = _make_event(
            VolcanicAshEvent,
            {
                "polygon": {
                    "type": "Polygon",
                    "coordinates": [[[-125, 44], [-117, 44], [-117, 50], [-125, 50], [-125, 44]]],
                },
                "duration_hours": 18,
                "severity": "severe",
            },
        )
        assert ev.kind == EventKind.VOLCANIC_ASH

    def test_constraints_airspace(self):
        ev = _make_event(
            VolcanicAshEvent,
            {
                "polygon": {
                    "type": "Polygon",
                    "coordinates": [[[-125, 44], [-117, 44], [-117, 50], [-125, 50], [-125, 44]]],
                },
                "duration_hours": 18,
                "severity": "severe",
            },
        )
        c = ev.constraints()
        assert any(con["type"] in ("airspace_unavailable", "reroute_required") for con in c)


class TestCyberIncident:
    def test_kind(self):
        ev = _make_event(
            CyberIncidentEvent,
            {"airline": "NimbusAir", "degradation_pct": 60, "duration_hours": 12},
        )
        assert ev.kind == EventKind.CYBER_INCIDENT

    def test_affects_all_flights(self):
        ev = _make_event(
            CyberIncidentEvent,
            {"airline": "NimbusAir", "degradation_pct": 60, "duration_hours": 12},
        )
        affected = ev.affected_flights(SAMPLE_SCHEDULE)
        assert len(affected) == len(SAMPLE_SCHEDULE)

    def test_constraints_degradation(self):
        ev = _make_event(
            CyberIncidentEvent,
            {"airline": "NimbusAir", "degradation_pct": 60, "duration_hours": 12},
        )
        c = ev.constraints()
        assert any(con["type"] in ("turnaround_delay", "system_degradation") for con in c)

    def test_default_scenario(self):
        default = CyberIncidentEvent.default_scenario_dict()
        assert "degradation_pct" in default["params"]
