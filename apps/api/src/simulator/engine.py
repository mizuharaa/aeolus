"""
Aeolus simulation engine.

Manages the simulation clock, applies disruption events, tracks schedule
state changes, coordinates between the cascade predictor and recovery
optimizer, and broadcasts real-time updates to WebSocket subscribers.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import WebSocket

    from src.optimizer.milp import RecoveryOptimizer
    from src.predictor.cascade import CascadePredictor
    from src.weather.client import WeatherClient

logger = logging.getLogger(__name__)


@dataclass
class SimulationState:
    """Mutable simulation state — mutated in place as events are triggered."""

    sim_time: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc).replace(hour=6, minute=0, second=0, microsecond=0)
    )
    active_events: list[dict] = field(default_factory=list)
    flight_states: dict[str, dict] = field(default_factory=dict)
    recovery_plans: list[dict] = field(default_factory=list)
    # Persisted so fresh WS clients (page navigation, deep-link, refresh) can
    # rebuild the cascade panel without re-triggering the event. Previously
    # only sent inline on broadcast and lost on reconnect.
    cascade_summary: dict = field(default_factory=dict)
    ws_subscribers: set = field(default_factory=set)
    is_running: bool = False
    event_history: list[dict] = field(default_factory=list)


class SimulationEngine:
    """
    Core simulation engine for Aeolus.

    Owns:
      - The canonical schedule (dict of flight dicts)
      - Per-flight state (status, delay, cascade info)
      - Active events list
      - WebSocket subscriber set

    Does NOT own the predictor, optimizer, or weather client —
    these are injected at trigger time to allow clean dependency injection.
    """

    # ─── Built-in scenarios ───────────────────────────────────────────────

    BUILT_IN_SCENARIOS: dict[str, dict] = {
        "ord_thunderstorm": {
            "name": "Chicago O'Hare Thunderstorm",
            "description": "Severe convective activity closes ORD for 4 hours.",
            "event": {
                "kind": "weather_closure",
                "params": {
                    "airport": "KORD",
                    "start": "T+0h",
                    "end": "T+4h",
                    "severity": "severe",
                    "conditions": "thunderstorm",
                },
            },
        },
        "atl_ground_stop": {
            "name": "Atlanta Ground Stop",
            "description": "FAA GS at KATL due to volume — holds all inbounds 2 hours.",
            "event": {
                "kind": "ground_stop",
                "params": {
                    "destination_airport": "KATL",
                    "start": "T+0h",
                    "end": "T+2h",
                    "reason": "weather",
                    "severity": "moderate",
                },
            },
        },
        "n042nb_engine_aog": {
            "name": "Engine AOG at Denver",
            "description": "Engine defect grounds N042NB at KDEN cascading 4 downstream flights.",
            "event": {
                "kind": "mechanical_aog",
                "params": {
                    "aircraft_tail": "N042NB",
                    "defect_category": "engine",
                    "location_airport": "KDEN",
                    "duration_hours": 8,
                    "severity": "severe",
                },
            },
        },
        "dfw_runway_incident": {
            "name": "DFW Runway 18L Incident",
            "description": "Aircraft incident closes runway 18L reducing DFW capacity 40%.",
            "event": {
                "kind": "runway_closure",
                "params": {
                    "airport": "KDFW",
                    "runway": "18L",
                    "reason": "incident",
                    "capacity_cut_pct": 40,
                    "start": "T+0h",
                    "end": "T+3h",
                    "severity": "moderate",
                },
            },
        },
        "crowdstrike_outage": {
            "name": "IT Outage (CrowdStrike-style)",
            "description": "Full IT infrastructure failure grounds Nimbus Air fleet for 3 hours.",
            "event": {
                "kind": "cyber_incident",
                "params": {
                    "incident_type": "full_it_outage",
                    "affected_hubs": [],
                    "system_restored_at": "T+4h",
                    "manual_workaround": True,
                    "severity": "extreme",
                },
            },
        },
    }

    def __init__(
        self,
        schedule: list[dict],
        aircraft: list[dict],
        crews: list[dict],
    ):
        # Immutable network data (aircraft/crews)
        self.aircraft: dict[str, dict] = {a["id"]: a.copy() for a in aircraft}
        self.crews: dict[str, dict] = {c["id"]: c.copy() for c in crews}

        # Mutable schedule
        self.schedule: dict[str, dict] = {f["id"]: f.copy() for f in schedule}

        # Simulation state
        self.state = SimulationState()

        # Initialise per-flight state
        for fid in self.schedule:
            self.state.flight_states[fid] = self._default_flight_state(fid)

    # ─── Public API ───────────────────────────────────────────────────────

    async def trigger_event(
        self,
        event: dict,
        predictor: "CascadePredictor",
        optimizer: "RecoveryOptimizer",
        weather_client: "WeatherClient",
    ) -> dict:
        """
        Trigger a disruption event and compute cascade predictions + recovery plans.

        Returns the full simulation update payload that is also broadcast to
        all connected WebSocket clients.
        """
        # Stamp the event
        event = {
            **event,
            "id": event.get("id") or str(uuid.uuid4()),
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        }
        self.state.active_events.append(event)
        self.state.event_history.append(event)

        logger.info(
            "Triggering event kind=%s id=%s", event.get("kind"), event["id"]
        )

        # Gather weather context
        metar_data = weather_client.get_all_cached()

        # Run cascade predictor
        flights_list = list(self.schedule.values())
        logger.info(
            "CASCADE DEBUG — schedule_size=%d, event_kind=%s, params=%s",
            len(flights_list), event.get("kind"), event.get("params"),
        )
        if flights_list:
            sample = flights_list[0]
            logger.info(
                "CASCADE DEBUG — sample flight keys=%s, origin=%s, dest=%s",
                list(sample.keys()), sample.get("origin"), sample.get("destination"),
            )

        predictions = predictor.predict(
            flights=flights_list,
            event=event,
            metar_data=metar_data,
            current_time=datetime.now(timezone.utc),
        )

        orders = [p.get("cascade_order", -1) for p in predictions.values()]
        logger.info(
            "CASCADE DEBUG — predictions=%d, direct=%d, cascade1=%d, cascade2=%d, unaffected=%d",
            len(predictions),
            orders.count(0),
            orders.count(1),
            orders.count(2),
            orders.count(-1),
        )

        # Update per-flight states
        for fid, pred in predictions.items():
            order = pred.get("cascade_order", -1)
            if order >= 0:
                delay_min = pred.get("expected_delay_min", 0)
                self.state.flight_states[fid].update(
                    {
                        "status": "cancelled"
                        if delay_min > 180
                        else ("delayed" if delay_min > 0 else "scheduled"),
                        "delay_minutes": delay_min,
                        "cascade_order": order,
                        "p_delayed": pred.get("p_delayed", 0.0),
                        "last_event_id": event["id"],
                    }
                )

        # Build disrupted flight list for optimizer
        disrupted = [
            fid for fid, pred in predictions.items() if pred.get("cascade_order", -1) >= 0
        ]
        logger.info("CASCADE DEBUG — disrupted_flights=%d, running optimizer", len(disrupted))

        # Build optimizer constraints from event
        constraints = self._event_to_constraints(event)

        # Run recovery optimizer
        plans = optimizer.solve(
            schedule=flights_list,
            aircraft=list(self.aircraft.values()),
            crews=list(self.crews.values()),
            events=constraints,
            disrupted_flights=disrupted,
            cascade_predictions=predictions,
        )

        self.state.recovery_plans = [
            p.to_dict() if hasattr(p, "to_dict") else self._plan_to_dict(p)
            for p in plans
        ]

        # Compute cascade summary and persist it on state so that secondary
        # pages (carbon, cascade, plans, etc.) hitting the WS for the first
        # time can rebuild the same view without re-triggering the event.
        cascade_summary = self._compute_cascade_summary(predictions)
        self.state.cascade_summary = cascade_summary

        # Build broadcast payload
        update: dict = {
            "type": "simulation_update",
            "event": event,
            "flight_states": self.state.flight_states,
            "cascade_summary": cascade_summary,
            "recovery_plans": self.state.recovery_plans,
            "predictions": predictions,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self._broadcast(update)
        return update

    def reset(self) -> None:
        """Reset simulation to clean initial state (no events, no delays)."""
        for fid in self.schedule:
            self.state.flight_states[fid] = self._default_flight_state(fid)
        self.state.active_events.clear()
        self.state.recovery_plans.clear()
        self.state.cascade_summary = {}
        # Keep event_history for audit log
        logger.info("Simulation state reset")

    def add_subscriber(self, ws: "WebSocket") -> None:
        self.state.ws_subscribers.add(ws)
        logger.debug("WebSocket subscriber added (total: %d)", len(self.state.ws_subscribers))

    def remove_subscriber(self, ws: "WebSocket") -> None:
        self.state.ws_subscribers.discard(ws)
        logger.debug("WebSocket subscriber removed (total: %d)", len(self.state.ws_subscribers))

    def get_schedule_snapshot(self) -> list[dict]:
        """Return merged schedule + current state for each flight."""
        result = []
        for fid, flight in self.schedule.items():
            state = self.state.flight_states.get(fid, {})
            result.append({**flight, **state})
        return result

    def get_state_summary(self) -> dict:
        """Return a summary of the current simulation state."""
        statuses = [s.get("status", "scheduled") for s in self.state.flight_states.values()]
        return {
            "sim_time": self.state.sim_time.isoformat(),
            "is_running": self.state.is_running,
            "active_events": len(self.state.active_events),
            "total_flights": len(self.schedule),
            "status_breakdown": {
                "scheduled": statuses.count("scheduled"),
                "delayed": statuses.count("delayed"),
                "cancelled": statuses.count("cancelled"),
                "diverted": statuses.count("diverted"),
            },
            "recovery_plans_available": len(self.state.recovery_plans),
            "ws_subscribers": len(self.state.ws_subscribers),
        }

    # ─── Internal helpers ─────────────────────────────────────────────────

    def _default_flight_state(self, fid: str) -> dict:
        return {
            "flight_id": fid,
            "status": "scheduled",
            "delay_minutes": 0,
            "cascade_order": -1,
            "p_delayed": 0.0,
            "last_event_id": None,
        }

    def _event_to_constraints(self, event: dict) -> list[dict]:
        """Convert a triggered event dict into optimizer constraint dicts."""
        kind = event.get("kind", "")
        params = event.get("params", {})
        constraints: list[dict] = []

        if kind in ("weather_closure", "security_event"):
            constraints.append(
                {
                    "type": "airport_unavailable",
                    "airport": params.get("airport", ""),
                    "start": params.get("start", "T+0h"),
                    "end": params.get("end", "T+4h"),
                    "severity": params.get("severity", "moderate"),
                }
            )

        elif kind == "ground_stop":
            constraints.append(
                {
                    "type": "ground_stop",
                    "destination_airport": params.get("destination_airport", ""),
                    "affected_origins": params.get("affected_origins", []),
                    "start": params.get("start", "T+0h"),
                    "end": params.get("end", "T+2h"),
                }
            )

        elif kind == "mechanical_aog":
            constraints.append(
                {
                    "type": "aircraft_grounded",
                    "aircraft_tail": params.get("aircraft_tail", ""),
                    "duration_hours": params.get("duration_hours", 6),
                    "location_airport": params.get("location_airport", ""),
                }
            )

        elif kind == "runway_closure":
            constraints.append(
                {
                    "type": "capacity_reduced",
                    "airport": params.get("airport", ""),
                    "capacity_reduction_pct": params.get("capacity_cut_pct", 40),
                    "start": params.get("start", "T+0h"),
                    "end": params.get("end", "T+3h"),
                }
            )

        elif kind == "atc_staffing":
            constraints.append(
                {
                    "type": "atc_gdp",
                    "facility_id": params.get("facility_id", ""),
                    "affected_airports": params.get("affected_airports", []),
                    "average_delay_minutes": params.get("average_delay_minutes", 30),
                    "start": params.get("start", "T+0h"),
                    "end": params.get("end", "T+6h"),
                }
            )

        elif kind == "crew_sickout":
            constraints.append(
                {
                    "type": "crew_unavailable",
                    "affected_bases": params.get("affected_bases", []),
                    # UI sends "percent_affected"; YAML scenarios use "callout_pct"
                    "callout_pct": params.get("callout_pct", params.get("percent_affected", 15)),
                    "duration_hours": params.get("duration_hours", 24),
                }
            )

        elif kind == "airspace_closure":
            constraints.append(
                {
                    "type": "airspace_unavailable",
                    "center_lat": params.get("center_lat"),
                    "center_lon": params.get("center_lon"),
                    "radius_nm": params.get("radius_nm", 30),
                    "start": params.get("start", "T+0h"),
                    "end": params.get("end", "T+3h"),
                }
            )

        elif kind == "volcanic_ash":
            constraints.append(
                {
                    "type": "airspace_unavailable",
                    "subtype": "ash_exclusion",
                    "center_lat": params.get("volcano_lat"),
                    "center_lon": params.get("volcano_lon"),
                    "radius_nm": params.get("ash_cloud_radius_nm", 150),
                    "start": params.get("start", "T+0h"),
                    "end": params.get("end", "T+12h"),
                }
            )

        elif kind == "cyber_incident":
            constraints.append(
                {
                    "type": "system_degradation",
                    "incident_type": params.get("incident_type", "check_in_outage"),
                    "affected_hubs": params.get("affected_hubs", []),
                    "degradation_pct": float(params.get("degradation_pct", 0)),
                    "end": params.get("system_restored_at", "T+4h"),
                }
            )

        return constraints

    def _compute_cascade_summary(self, predictions: dict[str, dict]) -> dict:
        orders = [p.get("cascade_order", -1) for p in predictions.values()]
        delays = [p.get("expected_delay_min", 0) for p in predictions.values() if p.get("cascade_order", -1) >= 0]
        return {
            "directly_affected": orders.count(0),
            "cascade_1": orders.count(1),
            "cascade_2": orders.count(2),
            "total_affected": sum(1 for o in orders if o >= 0),
            "unaffected": orders.count(-1),
            "total_delay_minutes": sum(delays),
        }

    def _plan_to_dict(self, plan: Any) -> dict:
        """Convert a RecoveryPlan to a plain dict (handles both dataclass and object)."""
        try:
            from dataclasses import asdict
            return asdict(plan)
        except Exception:
            attrs = [
                "plan_id", "objective_label", "status", "solve_time_ms",
                "cancelled_flights", "delayed_flights", "aircraft_swaps",
                "crew_reassignments", "total_cost_usd",
                "total_passenger_delay_minutes", "crew_violations",
                "aircraft_out_of_position", "summary",
            ]
            return {attr: getattr(plan, attr, None) for attr in attrs}

    async def _broadcast(self, message: dict) -> None:
        """Send a JSON message to all active WebSocket subscribers."""
        if not self.state.ws_subscribers:
            return

        payload = json.dumps(message, default=str)
        dead: set = set()

        for ws in self.state.ws_subscribers:
            try:
                await ws.send_text(payload)
            except Exception as exc:
                logger.debug("WebSocket send failed: %s", exc)
                dead.add(ws)

        self.state.ws_subscribers -= dead
