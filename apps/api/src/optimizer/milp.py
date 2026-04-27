"""
Recovery optimizer — fast deterministic heuristic.

Produces 3 recovery plans with distinct strategic objectives:
  Plan A — Minimize Cost        (cancel when economically justified)
  Plan B — Minimize Pax Impact  (prefer delays over cancellations)
  Plan C — Protect Tomorrow     (aggressive cancellations to free aircraft rotations)

Each plan runs in <5 ms, always returns non-zero output when disruptions exist.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from src.crew.far117 import CrewLegalityEngine
from src.costs.calculator import AirlineDelayCalculator

logger = logging.getLogger(__name__)

# Ferry / reposition flight (not in calculator — airline-specific ops cost)
AIRCRAFT_REPOSITION_COST = 8_000

# Weight configs kept for API compatibility / external callers
PLAN_WEIGHTS = {
    "A": {"label": "Minimize Cost",             "alpha": 10.0, "beta": 1.0,  "gamma": 5.0, "delta": 2.0},
    "B": {"label": "Minimize Passenger Impact", "alpha": 1.0,  "beta": 10.0, "gamma": 2.0, "delta": 1.0},
    "C": {"label": "Protect Tomorrow's Schedule","alpha": 2.0,  "beta": 3.0,  "gamma": 2.0, "delta": 10.0},
}


@dataclass
class RecoveryPlan:
    """Output of one optimizer run."""

    plan_id: str
    objective_label: str
    status: str                           # "optimal" | "feasible" | "heuristic" | "infeasible"
    solve_time_ms: int

    cancelled_flights: list[str]          = field(default_factory=list)
    delayed_flights: list[dict]           = field(default_factory=list)
    aircraft_swaps: list[dict]            = field(default_factory=list)
    crew_reassignments: list[dict]        = field(default_factory=list)

    total_cost_usd: float                 = 0.0
    total_passenger_delay_minutes: int    = 0
    crew_violations: int                  = 0
    aircraft_out_of_position: int         = 0
    cost_breakdown: dict                  = field(default_factory=dict)

    summary: str                          = ""

    def to_dict(self) -> dict:
        from dataclasses import asdict
        return asdict(self)


class RecoveryOptimizer:
    """
    Airline disruption recovery optimizer.

    Uses a fast plan-differentiated heuristic — no CP-SAT timeout issues.
    Produces three meaningfully distinct plans in milliseconds.
    """

    PLAN_WEIGHTS = PLAN_WEIGHTS

    def __init__(self, timeout_secs: int = 30, use_fallback: bool = True):
        # timeout_secs and use_fallback kept for API compatibility
        self.legality_engine = CrewLegalityEngine()
        self.calc = AirlineDelayCalculator()

    # ── Public API ────────────────────────────────────────────────────────────

    def solve(
        self,
        schedule: list[dict],
        aircraft: list[dict],
        crews: list[dict],
        events: list[dict],
        disrupted_flights: list[str],
        cascade_predictions: dict[str, dict],
    ) -> list[RecoveryPlan]:
        """
        Main entry point. Returns list of 3 RecoveryPlans (A, B, C).

        Args:
            schedule:             Flight dicts (id, aircraft_id, origin, destination,
                                  scheduled_departure, scheduled_arrival, passengers)
            aircraft:             Aircraft dicts (id, type, base_airport_id, seats)
            crews:                Crew pairing dicts
            events:               Optimizer constraint dicts from active events
            disrupted_flights:    Flight IDs directly or cascade-impacted
            cascade_predictions:  {flight_id: {p_delayed, expected_delay_min, cascade_order}}
        """
        flights_map  = {f["id"]: f for f in schedule}
        aircraft_map = {a["id"]: a for a in aircraft}

        # Aircraft used by directly disrupted flights (possible AOG / unavailable)
        direct_disrupted_ac: set[str] = {
            flights_map[fid]["aircraft_id"]
            for fid in disrupted_flights
            if fid in flights_map
            and cascade_predictions.get(fid, {}).get("cascade_order", -1) == 0
        }

        # Spare pool: aircraft NOT used by directly disrupted flights
        spare_pool = [
            ac_id for ac_id in aircraft_map
            if ac_id not in direct_disrupted_ac
        ]

        plans: list[RecoveryPlan] = []
        for plan_id, weights in PLAN_WEIGHTS.items():
            t0 = time.monotonic()
            plan = self._compute_plan(
                plan_id=plan_id,
                weights=weights,
                flights=flights_map,
                aircraft_map=aircraft_map,
                spare_pool=list(spare_pool),      # fresh copy per plan
                disrupted=disrupted_flights,
                predictions=cascade_predictions,
                crews=crews,
                events=events,
            )
            plan.solve_time_ms = max(1, int((time.monotonic() - t0) * 1000))
            plans.append(plan)
            logger.info(
                "Plan %s (%s): %d cancelled, %d delayed, $%.0f — %dms",
                plan_id, weights["label"],
                len(plan.cancelled_flights), len(plan.delayed_flights),
                plan.total_cost_usd, plan.solve_time_ms,
            )

        return plans

    # ── Plan computation ──────────────────────────────────────────────────────

    def _compute_plan(
        self,
        plan_id: str,
        weights: dict,
        flights: dict[str, dict],
        aircraft_map: dict[str, dict],
        spare_pool: list[str],
        disrupted: list[str],
        predictions: dict[str, dict],
        crews: list[dict],
        events: list[dict],
    ) -> RecoveryPlan:
        cancelled: list[str]  = []
        delayed:   list[dict] = []
        swaps:     list[dict] = []

        # Event-derived constraints (e.g., mechanical AOG grounded tails)
        grounded_tails: set[str] = self._extract_grounded_tails(events)
        event_kind: str = self._extract_event_kind(events)

        # Build aircraft type map for cost calculations
        ac_type_map: dict[str, str] = {
            fid: aircraft_map.get(f.get("aircraft_id", ""), {}).get("type", "")
            for fid, f in flights.items()
        }

        for fid in disrupted:
            if fid not in flights:
                continue

            flight         = flights[fid]
            pred           = predictions.get(fid, {})
            expected_delay = max(0, pred.get("expected_delay_min", 60))
            p_delayed      = pred.get("p_delayed", 0.5)
            cascade_order  = pred.get("cascade_order", -1)
            original_ac    = flight.get("aircraft_id", "")
            ac_type        = ac_type_map.get(fid, "")

            # Skip unaffected flights (should not appear in disrupted list, but guard)
            if cascade_order < 0:
                continue

            should_cancel = self._decide_cancel(
                plan_id, flight, expected_delay, p_delayed, cascade_order, event_kind, ac_type
            )

            if should_cancel:
                cancelled.append(fid)
            else:
                if expected_delay > 0:
                    dep_str = flight.get("scheduled_departure", "")
                    try:
                        orig_dep = datetime.fromisoformat(dep_str.replace("Z", "+00:00"))
                        new_dep  = orig_dep + timedelta(minutes=expected_delay)
                        new_dep_str = new_dep.isoformat()
                    except (ValueError, AttributeError):
                        new_dep_str = dep_str

                    delayed.append({
                        "flight_id":          fid,
                        "delay_minutes":      expected_delay,
                        "new_departure":      new_dep_str,
                        "original_departure": dep_str,
                    })

                    # Aircraft swap: if the flight's original aircraft is grounded (AOG)
                    # or has been freed by a cancellation in Plan C, swap with a spare
                    ac_is_grounded = original_ac in grounded_tails
                    if ac_is_grounded and spare_pool:
                        spare = spare_pool.pop(0)
                        swaps.append({
                            "flight_id":    fid,
                            "old_aircraft": original_ac,
                            "new_aircraft": spare,
                            "aircraft_type": aircraft_map.get(spare, {}).get("type", ""),
                        })

        # Plan C — add repositioning swaps for cascade flights whose aircraft
        # was freed by an upstream cancellation in the same plan
        if plan_id == "C":
            cancelled_ac = {flights[fid]["aircraft_id"] for fid in cancelled if fid in flights}
            for info in delayed:
                fid = info["flight_id"]
                if fid not in flights:
                    continue
                orig_ac = flights[fid].get("aircraft_id", "")
                if orig_ac in cancelled_ac and spare_pool:
                    spare = spare_pool.pop(0)
                    swaps.append({
                        "flight_id":    fid,
                        "old_aircraft": orig_ac,
                        "new_aircraft": spare,
                        "aircraft_type": aircraft_map.get(spare, {}).get("type", ""),
                    })
                    cancelled_ac.discard(orig_ac)  # only swap once per aircraft

        # ── Cost computation (real DOT/BTS rates) ─────────────────────────────
        cost_data     = self.calc.portfolio_cost(
            flights=flights,
            cancelled=cancelled,
            delayed=delayed,
            event_kind=event_kind,
            aircraft_type_map=ac_type_map,
        )
        swap_cost     = len(swaps) * AIRCRAFT_REPOSITION_COST
        total_cost    = cost_data["grand_total_usd"] + swap_cost
        total_pax_delay_min = cost_data["total_pax_delay_minutes"]
        cost_breakdown = {
            **cost_data,
            "reposition_cost_usd": swap_cost,
            "grand_total_usd": round(total_cost),
        }

        # ── Summary ───────────────────────────────────────────────────────────
        n_can = len(cancelled)
        n_del = len(delayed)
        avg_delay = (
            sum(d["delay_minutes"] for d in delayed) // n_del if n_del > 0 else 0
        )
        summary = (
            f"{n_can} cancelled, {n_del} delayed "
            f"(avg {avg_delay} min), {len(swaps)} aircraft swaps"
        )

        crew_violations = self._count_far117_violations(
            crews=crews,
            flights=flights,
            cancelled=cancelled,
            delayed=delayed,
        )

        return RecoveryPlan(
            plan_id=plan_id,
            objective_label=weights["label"],
            status="heuristic",
            solve_time_ms=0,                  # filled in by caller
            cancelled_flights=cancelled,
            delayed_flights=delayed,
            aircraft_swaps=swaps,
            crew_reassignments=[],
            total_cost_usd=round(total_cost, 2),
            total_passenger_delay_minutes=total_pax_delay_min,
            crew_violations=crew_violations,
            aircraft_out_of_position=len(swaps),
            cost_breakdown=cost_breakdown,
            summary=summary,
        )

    def _decide_cancel(
        self,
        plan_id: str,
        flight: dict,
        expected_delay: int,
        p_delayed: float,
        cascade_order: int,
        event_kind: str,
        aircraft_type: str = "",
    ) -> bool:
        """
        Return True if this flight should be cancelled under the given plan's strategy.

        Plan A — Cost minimization
            Cancel when total delay cost (ops + pax + compensation + crew OT) exceeds
            cancellation cost (revenue loss + rebook + DOT 261 + voluntary comp).
            Minimum delay: 60 min (short delays always cheaper to absorb).

        Plan B — Passenger-impact minimization
            Strongly prefer delays — passengers hate cancellations.
            Only cancel extreme cases (delay > 8h with very high p_delayed).

        Plan C — Schedule integrity / protect tomorrow
            Aggressively cancel direct-impact flights to free aircraft early.
            This prevents cascade into tomorrow's rotations.
        """
        if plan_id == "A":
            if expected_delay < 60:
                return False
            delay_info  = self.calc.delay_cost(flight, expected_delay, event_kind, aircraft_type)
            cancel_info = self.calc.cancellation_cost(flight, event_kind, aircraft_type)
            return delay_info.total > cancel_info.total

        elif plan_id == "B":
            return expected_delay > 480 and p_delayed > 0.85

        elif plan_id == "C":
            if cascade_order == 0 and expected_delay >= 120:
                return True
            if cascade_order == 1 and expected_delay >= 150:
                return True
            return False

        return expected_delay > 180

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _extract_grounded_tails(self, events: list[dict]) -> set[str]:
        """Pull grounded aircraft tails from optimizer constraint dicts."""
        grounded: set[str] = set()
        for ev in events:
            if ev.get("type") == "aircraft_grounded":
                tail = ev.get("aircraft_tail", "")
                if tail:
                    grounded.add(tail)
        return grounded

    def _extract_event_kind(self, events: list[dict]) -> str:
        """Return the primary disruption event kind from optimizer constraints."""
        for ev in events:
            kind = ev.get("kind") or ev.get("event_type") or ev.get("type", "")
            if kind and kind != "aircraft_grounded":
                return kind
        return ""

    def _count_far117_violations(
        self,
        crews: list[dict],
        flights: dict[str, dict],
        cancelled: list[str],
        delayed: list[dict],
    ) -> int:
        """Count FAR Part 117 violations introduced by this recovery plan."""
        if not crews:
            return 0

        pairing_by_flight: dict[str, dict] = {
            p["flight_id"]: p for p in crews if p.get("flight_id")
        }
        delays_by_flight = {d["flight_id"]: d["delay_minutes"] for d in delayed}
        violations = 0

        for fid, flight in flights.items():
            if fid in cancelled:
                continue
            pairing = pairing_by_flight.get(fid)
            if not pairing:
                continue

            delay_min = delays_by_flight.get(fid, 0)
            try:
                dep = datetime.fromisoformat(
                    flight["scheduled_departure"].replace("Z", "+00:00")
                ) + timedelta(minutes=delay_min)
                arr = datetime.fromisoformat(
                    flight["scheduled_arrival"].replace("Z", "+00:00")
                ) + timedelta(minutes=delay_min)
            except (KeyError, ValueError, AttributeError):
                continue

            duty_start = pairing.get("duty_start")
            try:
                duty_start_dt = (
                    datetime.fromisoformat(str(duty_start).replace("Z", "+00:00"))
                    if duty_start else dep
                )
            except (ValueError, AttributeError):
                duty_start_dt = dep

            crew_snapshot = {
                "id":                        pairing.get("captain_id", "?"),
                "role":                      "captain",
                "current_fdp_start":         duty_start_dt,
                "current_fdp_flight_minutes": 0,
                "last_rest_end":             duty_start_dt - timedelta(hours=11),
                "flight_time_7d_minutes":    0,
                "flight_time_28d_minutes":   0,
                "flight_time_365d_minutes":  0,
                "home_timezone_offset_hours": 0,
            }
            proposed = {
                "departure":           dep,
                "arrival":             arr,
                "flight_time_minutes": int((arr - dep).total_seconds() / 60),
            }
            try:
                result = self.legality_engine.validate(crew_snapshot, proposed)
                if not result.is_legal:
                    violations += len(result.violations)
            except Exception as exc:
                logger.debug("FAR 117 check failed for %s: %s", fid, exc)

        return violations

    def _infeasible_plan(self, plan_id: str, weights: dict | None = None) -> RecoveryPlan:
        label = (weights or {}).get("label", PLAN_WEIGHTS.get(plan_id, {}).get("label", "Unknown"))
        return RecoveryPlan(
            plan_id=plan_id,
            objective_label=label,
            status="infeasible",
            solve_time_ms=0,
            summary="No feasible solution found — check event constraints",
        )
