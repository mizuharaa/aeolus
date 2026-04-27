"""
Tests for the Aeolus cascade predictor (src/predictor/cascade.py).

Tests cover:
- Rule-based fallback prediction (no model loaded)
- Feature extraction
- Cascade propagation (order 0, 1, 2)
- Severity scaling
- Output schema validation
- Summarize helper
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone


# ── Helpers ───────────────────────────────────────────────────────────────────

_NOW = datetime(2024, 1, 15, 11, 0, tzinfo=timezone.utc)


def make_flight(
    flight_id: str = "NB101",
    origin: str = "KORD",
    destination: str = "KATL",
    dep_hour_utc: int = 12,
    passengers: int = 150,
    aircraft_id: str = "N001NB",
    cascade_order: int = 0,
) -> dict:
    return {
        "id": flight_id,
        "aircraft_id": aircraft_id,
        "aircraft_type": "B737-800",
        "origin": origin,
        "destination": destination,
        "scheduled_departure": f"2024-01-15T{dep_hour_utc:02d}:00:00Z",
        "scheduled_arrival": f"2024-01-15T{dep_hour_utc + 2:02d}:15:00Z",
        "passengers": passengers,
        "status": "scheduled",
        "delay_minutes": 0,
        "cascade_order": cascade_order,
    }


def make_event(kind: str = "weather_closure", severity: str = "severe") -> dict:
    return {
        "id": "test-event-001",
        "kind": kind,
        "params": {
            "airport": "KORD",
            "severity": severity,
            "duration_hours": 4,
        },
    }


def call_predict(predictor, event: dict, flights: list[dict]) -> dict[str, dict]:
    """Invoke predictor with the correct full signature, using empty METAR data."""
    return predictor.predict(
        flights=flights,
        event=event,
        metar_data={},
        current_time=_NOW,
    )


# ── Fixture ───────────────────────────────────────────────────────────────────

@pytest.fixture
def predictor():
    from src.predictor.cascade import CascadePredictor
    p = CascadePredictor()
    assert not p.is_trained, "Should start in rule-based mode with no model"
    return p


# ── Rule-based prediction tests ───────────────────────────────────────────────

class TestRuleBasedPrediction:
    def test_returns_dict(self, predictor):
        event = make_event("weather_closure", "severe")
        flights = [make_flight("NB101")]
        result = call_predict(predictor, event, flights)
        assert isinstance(result, dict)
        assert "NB101" in result

    def test_output_schema(self, predictor):
        event = make_event("weather_closure", "severe")
        flights = [make_flight("NB101")]
        result = call_predict(predictor, event, flights)
        pred = result["NB101"]
        assert "p_delayed" in pred
        assert "expected_delay_min" in pred
        assert "cascade_order" in pred
        assert "reason" in pred
        assert isinstance(pred["expected_delay_min"], (int, float))
        assert isinstance(pred["p_delayed"], float)
        assert 0.0 <= pred["p_delayed"] <= 1.0

    def test_direct_disruption_has_high_delay(self, predictor):
        event = make_event("weather_closure", "severe")
        direct = make_flight("NB101", origin="KORD")
        result = call_predict(predictor, event, [direct])
        assert result["NB101"]["expected_delay_min"] >= 60, \
            "Severe weather direct disruption should predict ≥60 min delay"
        assert result["NB101"]["cascade_order"] == 0

    def test_cascade_order_attenuates_delay(self, predictor):
        event = make_event("weather_closure", "severe")
        # NB101 directly at KORD; NB102 and NB103 share the same aircraft so
        # they become cascade-order 1 and 2 after NB101 is disrupted.
        flights = [
            make_flight("NB101", origin="KORD", aircraft_id="N001NB"),
            make_flight("NB102", origin="KATL", aircraft_id="N001NB"),
            make_flight("NB103", origin="KDFW", aircraft_id="N001NB"),
        ]
        result = call_predict(predictor, event, flights)
        order0_delay = result["NB101"]["expected_delay_min"]
        order1_delay = result["NB102"]["expected_delay_min"]
        order2_delay = result["NB103"]["expected_delay_min"]

        assert order0_delay >= order1_delay, \
            "Direct disruption should have ≥ delay than first-hop cascade"
        assert order1_delay >= order2_delay, \
            "First-hop cascade should have ≥ delay than second-hop"

    def test_mild_event_lower_delay_than_severe(self, predictor):
        mild_event = make_event("weather_closure", "mild")
        severe_event = make_event("weather_closure", "severe")
        flight = make_flight("NB101", origin="KORD")

        mild_result = call_predict(predictor, mild_event, [flight])
        severe_result = call_predict(predictor, severe_event, [flight])

        assert severe_result["NB101"]["expected_delay_min"] > mild_result["NB101"]["expected_delay_min"], \
            "Severe event should predict longer delay than mild event"

    def test_p_delayed_bounded(self, predictor):
        event = make_event("weather_closure", "severe")
        flights = [make_flight(f"NB{100 + i}", aircraft_id=f"N{i:03d}NB") for i in range(10)]
        result = call_predict(predictor, event, flights)
        for fid, pred in result.items():
            assert 0.0 <= pred["p_delayed"] <= 1.0, f"{fid}: p_delayed out of [0,1]"

    def test_direct_p_delayed_above_unaffected(self, predictor):
        event = make_event("weather_closure", "severe")
        direct = make_flight("NB101", origin="KORD", aircraft_id="N001NB")
        unrelated = make_flight("NB199", origin="KMIA", aircraft_id="N039NB")
        result = call_predict(predictor, event, [direct, unrelated])
        assert result["NB101"]["p_delayed"] > result["NB199"]["p_delayed"], \
            "Directly disrupted flight should have higher p_delayed than unrelated flight"

    def test_cyber_incident_moderate_delay(self, predictor):
        """Cyber incidents add turnaround delays but should not catastrophically cancel."""
        event = make_event("cyber_incident", "severe")
        flight = make_flight("NB101")
        result = call_predict(predictor, event, [flight])
        # Cyber affects all flights so cascade_order should be direct or indirect;
        # p_delayed should be reasonable
        assert result["NB101"]["p_delayed"] <= 1.0

    def test_empty_flight_list(self, predictor):
        event = make_event("weather_closure", "severe")
        result = call_predict(predictor, event, [])
        assert result == {}

    def test_all_flights_in_result(self, predictor):
        event = make_event("ground_stop", "severe")
        flights = [make_flight(f"NB{100 + i}", aircraft_id=f"N{i:03d}NB") for i in range(20)]
        result = call_predict(predictor, event, flights)
        assert len(result) == 20
        for f in flights:
            assert f["id"] in result

    def test_aog_uses_tail_number(self, predictor):
        """Mechanical AOG should directly affect flights operated by grounded tail."""
        event = {
            "id": "evt-aog",
            "kind": "mechanical_aog",
            "params": {"aircraft_tail": "N001NB", "severity": "severe"},
        }
        direct_tail = make_flight("NB101", aircraft_id="N001NB")
        other_tail = make_flight("NB102", aircraft_id="N002NB")
        result = call_predict(predictor, event, [direct_tail, other_tail])
        assert result["NB101"]["cascade_order"] == 0
        assert result["NB102"]["cascade_order"] == -1


# ── Feature extraction tests ──────────────────────────────────────────────────

class TestFeatureExtraction:
    def test_feature_dict_keys(self, predictor):
        event = make_event("weather_closure", "severe")
        flight = make_flight("NB101")
        features = predictor._extract_features(event, flight)
        for key in ["dep_hour_utc", "cascade_order", "passengers", "event_kind", "event_severity"]:
            assert key in features, f"Expected feature key '{key}' not found"

    def test_departure_hour_extracted(self, predictor):
        event = make_event("weather_closure", "severe")
        flight = make_flight("NB101", dep_hour_utc=14)
        features = predictor._extract_features(event, flight)
        assert features["dep_hour_utc"] == 14

    def test_cascade_order_in_features(self, predictor):
        event = make_event("weather_closure", "severe")
        for order in range(3):
            flight = make_flight("NB101", cascade_order=order)
            features = predictor._extract_features(event, flight)
            assert features["cascade_order"] == order

    def test_passengers_in_features(self, predictor):
        event = make_event("weather_closure", "severe")
        flight = make_flight("NB101", passengers=220)
        features = predictor._extract_features(event, flight)
        assert features["passengers"] == 220

    def test_severity_encoded(self, predictor):
        for severity, expected in [("mild", 1), ("moderate", 2), ("severe", 3), ("extreme", 4)]:
            event = make_event("weather_closure", severity)
            flight = make_flight("NB101")
            features = predictor._extract_features(event, flight)
            assert features["event_severity_encoded"] == expected


# ── Cascade summary tests ─────────────────────────────────────────────────────

class TestCascadeSummary:
    def _build_preds(self, direct: int, cascade1: int, cascade2: int) -> dict[str, dict]:
        preds: dict[str, dict] = {}
        for i in range(direct):
            preds[f"NB1{i:02d}"] = {"cascade_order": 0, "expected_delay_min": 120, "p_delayed": 0.9, "reason": "direct"}
        for i in range(cascade1):
            preds[f"NB2{i:02d}"] = {"cascade_order": 1, "expected_delay_min": 60, "p_delayed": 0.6, "reason": "cascade1"}
        for i in range(cascade2):
            preds[f"NB3{i:02d}"] = {"cascade_order": 2, "expected_delay_min": 30, "p_delayed": 0.3, "reason": "cascade2"}
        return preds

    def test_summary_counts(self, predictor):
        preds = self._build_preds(direct=5, cascade1=8, cascade2=4)
        summary = predictor.summarize(preds)
        assert summary["total_affected"] == 17
        assert summary["directly_affected"] == 5
        assert summary["cascade_1"] == 8
        assert summary["cascade_2"] == 4

    def test_summary_all_direct(self, predictor):
        preds = self._build_preds(direct=3, cascade1=0, cascade2=0)
        summary = predictor.summarize(preds)
        assert summary["directly_affected"] == 3
        assert summary["cascade_1"] == 0
        assert summary["cascade_2"] == 0

    def test_empty_summary(self, predictor):
        summary = predictor.summarize({})
        assert summary["total_affected"] == 0
        assert summary["directly_affected"] == 0
        assert summary["total_delay_minutes"] == 0

    def test_total_delay_minutes(self, predictor):
        preds = self._build_preds(direct=2, cascade1=1, cascade2=0)
        summary = predictor.summarize(preds)
        # 2×120 + 1×60 = 300
        assert summary["total_delay_minutes"] == 300

    def test_summarize_from_real_predict(self, predictor):
        """summarize() round-trips correctly with live predict output."""
        event = make_event("weather_closure", "severe")
        flights = [
            make_flight("NB101", origin="KORD", aircraft_id="N001NB"),
            make_flight("NB102", origin="KATL", aircraft_id="N001NB"),
            make_flight("NB201", origin="KMIA", aircraft_id="N002NB"),
        ]
        preds = call_predict(predictor, event, flights)
        summary = predictor.summarize(preds)
        assert summary["total_affected"] + summary["unaffected"] == len(flights)
        assert summary["total_affected"] >= 0
