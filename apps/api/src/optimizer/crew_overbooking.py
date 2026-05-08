"""
Crew Overbooking Optimizer — OR-Tools CP-SAT.

When a disruption (crew_sickout, mechanical_aog, etc.) leaves flights without
legal crew assignments, this module finds the maximum-coverage reassignment of
available crew members to open flights subject to:
  - FAR Part 117 duty-time limits
  - Aircraft type certification
  - One crew captain per flight
  - Each captain on at most one flight (simplified: single-leg per duty period)

Returns a CrewOverbookingResult with:
  - covered_assignments: {flight_id → assigned_captain_id}
  - uncovered_flights:   flights that cannot be staffed
  - cancelled_recommended: subset of uncovered_flights recommended for cancellation
  - compensation_obligations: per-flight DOT 261 / goodwill obligations
  - coverage_pct, pax_covered, pax_uncovered
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from ortools.sat.python import cp_model

from src.crew.far117 import CrewLegalityEngine

logger = logging.getLogger(__name__)

CPSAT_TIMEOUT = 10   # seconds
MIN_CERT_MATCH = True  # enforce aircraft type certification

# Events where the airline is legally at fault → full DOT 261 obligations
AIRLINE_FAULT_EVENTS = {"crew_sickout", "mechanical_aog", "cyber_incident"}

# Events treated as force majeure → goodwill-only
FORCE_MAJEURE_EVENTS = {
    "weather_closure", "ground_stop", "airspace_closure",
    "security_event", "volcanic_ash", "atc_staffing",
    "runway_closure",
}


@dataclass
class CrewAssignment:
    flight_id:   str
    captain_id:  str
    captain_name: str
    fo_id:       str
    fo_name:     str
    is_reassigned: bool   # True if different crew from original pairing
    far117_legal:  bool
    violations:    list[str] = field(default_factory=list)


@dataclass
class CompensationObligation:
    flight_id:      str
    event_kind:     str
    is_airline_fault: bool
    delay_minutes:  int
    is_cancelled:   bool
    pax:            int

    meal_voucher_usd: float        = 0.0
    hotel_required:   bool         = False
    travel_credit_usd: float       = 0.0
    dot261_cash_usd:   float       = 0.0
    rebooking:        str          = "none"   # "required" | "goodwill_no_fee" | "none"
    legal_basis:      str          = ""
    notes:            list[str]    = field(default_factory=list)


@dataclass
class CrewOverbookingResult:
    solved:             bool
    solve_time_ms:      int
    solver_status:      str     # "optimal" | "feasible" | "heuristic" | "infeasible"

    total_open_flights: int
    total_covered:      int
    total_uncovered:    int
    coverage_pct:       float

    pax_covered:        int
    pax_uncovered:      int

    covered_assignments:   list[CrewAssignment]
    uncovered_flights:     list[str]
    cancelled_recommended: list[str]

    compensation_obligations: list[CompensationObligation]
    summary: str

    def to_dict(self) -> dict:
        from dataclasses import asdict
        return asdict(self)


class CrewOverbookingOptimizer:
    """
    Solves crew overbooking via MILP when disruptions leave flights without crew.
    """

    def __init__(self) -> None:
        self.legality = CrewLegalityEngine()

    def solve(
        self,
        open_flights:        list[dict],   # flights missing crew
        crew_members:        list[dict],   # all crew_members from YAML
        existing_pairings:   list[dict],   # all crew_pairings from YAML
        available_crew_ids:  set[str],     # crew IDs that are NOT on sickout/unavailable
        event_kind:          str,
        disrupted_flight_ids: list[str],   # flights impacted by the disruption
        predictions:         dict[str, dict],
    ) -> CrewOverbookingResult:
        t0 = time.monotonic()

        if not open_flights:
            return self._empty_result(int((time.monotonic() - t0) * 1000))

        # Index crew members by id
        crew_by_id: dict[str, dict] = {c["id"]: c for c in crew_members}

        # Captains available for reassignment
        available_captains = [
            c for c in crew_members
            if c["id"] in available_crew_ids and c.get("role") == "captain"
        ]
        available_fos = [
            c for c in crew_members
            if c["id"] in available_crew_ids and c.get("role") == "first_officer"
        ]

        # Pre-compute legal (flight, captain) pairs
        legal_pairs: dict[tuple[str, str], bool] = {}
        for flight in open_flights:
            fid       = flight["id"]
            ac_type   = flight.get("aircraft_type", "B737-800")
            dep_str   = flight.get("scheduled_departure", "")
            arr_str   = flight.get("scheduled_arrival", "")

            try:
                dep = datetime.fromisoformat(dep_str.replace("Z", "+00:00"))
                arr = datetime.fromisoformat(arr_str.replace("Z", "+00:00"))
                ft_min = int((arr - dep).total_seconds() / 60)
            except (ValueError, AttributeError):
                dep = datetime.now(timezone.utc)
                arr = dep + timedelta(hours=2)
                ft_min = 120

            for cap in available_captains:
                # Type certification check
                if MIN_CERT_MATCH:
                    certs = cap.get("cert_types", [])
                    if certs and not any(ac_type.startswith(c.split("-")[0]) for c in certs):
                        legal_pairs[(fid, cap["id"])] = False
                        continue

                # FAR 117 legality check
                crew_snapshot = self._build_crew_snapshot(cap, dep)
                proposed = {"departure": dep, "arrival": arr, "flight_time_minutes": ft_min}
                try:
                    result = self.legality.validate(crew_snapshot, proposed)
                    legal_pairs[(fid, cap["id"])] = result.is_legal
                except Exception:
                    legal_pairs[(fid, cap["id"])] = False

        # ── CP-SAT model ──────────────────────────────────────────────────────
        model  = cp_model.CpModel()
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = CPSAT_TIMEOUT
        solver.parameters.num_search_workers  = 4
        solver.parameters.log_search_progress = False

        flight_ids = [f["id"] for f in open_flights]
        cap_ids    = [c["id"] for c in available_captains]

        # assign[fid][cid] = 1 → captain cid covers flight fid
        assign: dict[str, dict[str, cp_model.IntVar]] = {}
        for fid in flight_ids:
            assign[fid] = {}
            for cid in cap_ids:
                if legal_pairs.get((fid, cid), False):
                    assign[fid][cid] = model.new_bool_var(f"a_{fid}_{cid}")

        # covered[fid] = 1 → flight fid has at least one captain
        covered: dict[str, cp_model.IntVar] = {}
        for fid in flight_ids:
            covered[fid] = model.new_bool_var(f"cov_{fid}")
            legal_vars = list(assign[fid].values())
            if legal_vars:
                # covered ↔ sum(legal_vars) >= 1
                model.add(sum(legal_vars) >= 1).only_enforce_if(covered[fid])
                model.add(sum(legal_vars) == 0).only_enforce_if(covered[fid].negated())
                model.add_at_most_one(legal_vars)
            else:
                # No legal captain for this flight → cannot be covered
                model.add(covered[fid] == 0)

        # Each captain on at most one flight
        for cid in cap_ids:
            cap_uses = [assign[fid][cid] for fid in flight_ids if cid in assign.get(fid, {})]
            if len(cap_uses) > 1:
                model.add_at_most_one(cap_uses)

        # Maximize passenger-weighted coverage
        pax_map = {f["id"]: max(1, f.get("passengers", 150)) for f in open_flights}
        model.maximize(sum(pax_map[fid] * covered[fid] for fid in flight_ids))

        status_code = solver.solve(model)
        solved = status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        solver_status = (
            "optimal"   if status_code == cp_model.OPTIMAL   else
            "feasible"  if status_code == cp_model.FEASIBLE  else
            "infeasible"
        )

        # ── Extract assignments ────────────────────────────────────────────────
        covered_assignments: list[CrewAssignment] = []
        uncovered_flights:   list[str]            = []

        if solved:
            for fid in flight_ids:
                if solver.value(covered[fid]) == 1:
                    # Find which captain was assigned
                    assigned_cap_id = next(
                        (cid for cid in cap_ids
                         if cid in assign.get(fid, {}) and solver.value(assign[fid][cid]) == 1),
                        None,
                    )
                    if assigned_cap_id:
                        cap_info = crew_by_id.get(assigned_cap_id, {})
                        # Pick any available FO (simplified)
                        fo_info  = available_fos[0] if available_fos else {}

                        # Determine if this is a reassignment
                        original_pairing = next(
                            (p for p in existing_pairings if p.get("flight_id") == fid), None
                        )
                        is_reassigned = (
                            original_pairing is None or
                            original_pairing.get("captain_id") != assigned_cap_id
                        )

                        covered_assignments.append(CrewAssignment(
                            flight_id=fid,
                            captain_id=assigned_cap_id,
                            captain_name=cap_info.get("name", assigned_cap_id),
                            fo_id=fo_info.get("id", ""),
                            fo_name=fo_info.get("name", ""),
                            is_reassigned=is_reassigned,
                            far117_legal=True,
                        ))
                else:
                    uncovered_flights.append(fid)
        else:
            uncovered_flights = list(flight_ids)

        # Flights with no legal captain at all → recommended cancellation
        cancelled_recommended = [
            fid for fid in uncovered_flights
            if not any(legal_pairs.get((fid, cid), False) for cid in cap_ids)
        ]

        # ── Compensation obligations ───────────────────────────────────────────
        compensation = self._compute_compensation(
            open_flights, uncovered_flights, predictions, event_kind
        )

        pax_covered   = sum(pax_map[a.flight_id] for a in covered_assignments)
        pax_uncovered = sum(pax_map[fid] for fid in uncovered_flights)
        coverage_pct  = (
            100.0 * len(covered_assignments) / len(flight_ids)
            if flight_ids else 100.0
        )

        n_cov   = len(covered_assignments)
        n_uncov = len(uncovered_flights)
        summary = (
            f"{n_cov}/{len(flight_ids)} flights staffed "
            f"({coverage_pct:.0f}% coverage), "
            f"{n_uncov} uncovered, "
            f"{len(cancelled_recommended)} recommended for cancellation"
        )

        return CrewOverbookingResult(
            solved=solved,
            solve_time_ms=int((time.monotonic() - t0) * 1000),
            solver_status=solver_status,
            total_open_flights=len(flight_ids),
            total_covered=n_cov,
            total_uncovered=n_uncov,
            coverage_pct=round(coverage_pct, 1),
            pax_covered=pax_covered,
            pax_uncovered=pax_uncovered,
            covered_assignments=covered_assignments,
            uncovered_flights=uncovered_flights,
            cancelled_recommended=cancelled_recommended,
            compensation_obligations=compensation,
            summary=summary,
        )

    # ── Compensation logic ────────────────────────────────────────────────────

    def _compute_compensation(
        self,
        open_flights:     list[dict],
        uncovered_ids:    list[str],
        predictions:      dict[str, dict],
        event_kind:       str,
    ) -> list[CompensationObligation]:
        is_airline_fault = event_kind in AIRLINE_FAULT_EVENTS
        obligations: list[CompensationObligation] = []

        for flight in open_flights:
            fid  = flight["id"]
            pax  = max(1, flight.get("passengers", 150))
            pred = predictions.get(fid, {})
            delay_min   = max(0, int(pred.get("expected_delay_min", 60)))
            is_cancelled = fid in uncovered_ids

            ob = CompensationObligation(
                flight_id=fid,
                event_kind=event_kind,
                is_airline_fault=is_airline_fault,
                delay_minutes=delay_min,
                is_cancelled=is_cancelled,
                pax=pax,
            )

            if is_airline_fault:
                ob.legal_basis = "14 CFR §250 / DOT Enforcement Policy"
                ob.rebooking   = "required"

                if delay_min >= 120:
                    ob.meal_voucher_usd = 15.0
                    ob.notes.append("Meal voucher required for 2h+ departure delay")

                if delay_min >= 240:
                    ob.hotel_required = True
                    ob.notes.append("Hotel + ground transport required for 4h+ delay")

                if is_cancelled:
                    ob.travel_credit_usd = 200.0
                    # DOT 261: involuntary denied boarding — 400% one-way fare, max $1,550
                    est_one_way = 350.0  # Nimbus Air avg domestic fare
                    ob.dot261_cash_usd = min(1_550.0, est_one_way * 4)
                    ob.notes.append(
                        f"Involuntary denied boarding: DOT §250 — ${ob.dot261_cash_usd:.0f} cash "
                        f"OR full refund + $200 travel credit"
                    )

            else:
                ob.legal_basis = "Force majeure — no DOT-mandated compensation"
                ob.rebooking   = "goodwill_no_fee"

                if delay_min >= 180:
                    ob.meal_voucher_usd = 10.0
                    ob.notes.append("Goodwill meal voucher (not legally required)")

                if is_cancelled:
                    ob.notes.append(
                        "Goodwill: rebook on next available flight at no fee. "
                        "No cash compensation legally required."
                    )

            obligations.append(ob)

        return obligations

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _build_crew_snapshot(self, cap: dict, report_time: datetime) -> dict:
        return {
            "id":                         cap["id"],
            "role":                       "captain",
            "current_fdp_start":          report_time,
            "current_fdp_flight_minutes": 0,
            "last_rest_end":              report_time - timedelta(hours=11),
            "flight_time_7d_minutes":     int(cap.get("flight_hours_7d", 0) * 60),
            "flight_time_28d_minutes":    int(cap.get("flight_hours_28d", 0) * 60),
            "flight_time_365d_minutes":   int(cap.get("flight_hours_365d", 0) * 60),
            "home_timezone_offset_hours": 0,
        }

    def _empty_result(self, ms: int) -> CrewOverbookingResult:
        return CrewOverbookingResult(
            solved=True, solve_time_ms=ms, solver_status="optimal",
            total_open_flights=0, total_covered=0, total_uncovered=0,
            coverage_pct=100.0, pax_covered=0, pax_uncovered=0,
            covered_assignments=[], uncovered_flights=[], cancelled_recommended=[],
            compensation_obligations=[], summary="No open flights requiring crew reassignment",
        )
