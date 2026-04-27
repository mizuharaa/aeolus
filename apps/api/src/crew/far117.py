"""
FAR Part 117 (Flight and Duty Time Limitations) enforcement engine.
Implements 14 CFR Part 117 for passenger airline operations (2-pilot crew).

Key limits enforced:
  - Minimum rest before FDP: 10 hours
  - FDP limits by report time (Table B)
  - Max flight time per FDP: 9 hours
  - 7-day cumulative: 60 hours
  - 28-day cumulative: 100 hours
  - 365-day cumulative: 1000 hours
  - WOCL (Window of Circadian Low) restrictions
  - Minimum turn time between flights
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

WOCL_START_HOUR = 2   # 0200 local
WOCL_END_HOUR = 5     # 0559 local

# FAR 117 Table B — Maximum FDP (hours) by scheduled report time (local)
# Applies to 2-pilot crews; unaugmented operations.
FDP_TABLE: dict[int, float] = {
    0: 9.0,  1: 9.0,  2: 9.0,  3: 9.0,  4: 9.0,  5: 9.0,
    6: 13.0, 7: 13.0, 8: 14.0, 9: 14.0, 10: 14.0,
    11: 13.0, 12: 13.0, 13: 13.0, 14: 13.0, 15: 13.0,
    16: 11.0, 17: 11.0, 18: 11.0, 19: 11.0, 20: 11.0,
    21: 10.0, 22: 9.0, 23: 9.0,
}

# Extensions permitted under §117.19 (with augmented crew / rest facility)
# Not applicable for 2-pilot short-haul — kept for completeness.
FDP_EXTENSION_AUGMENTED: dict[int, float] = {
    0: 13.0, 6: 17.0, 8: 18.0, 12: 17.0, 16: 15.0, 22: 13.0,
}

# WOCL adjustment: if FDP starts or ends in WOCL, reduce max FDP by 30 min.
WOCL_FDP_REDUCTION_HOURS = 0.5

MIN_REST_HOURS = 10.0                    # §117.25(a) — minimum rest period
MIN_REST_RECOVERY_HOURS = 56.0           # §117.25(e) — monthly recovery rest
MAX_FT_PER_FDP_HOURS = 9.0              # §117.11
MAX_FT_7_DAYS_HOURS = 60.0              # §117.23(b)
MAX_FT_28_DAYS_HOURS = 100.0            # §117.23(b)
MAX_FT_365_DAYS_HOURS = 1000.0          # §117.23(b)
MIN_TURN_MINUTES = 30                    # min ground time between flights


# ──────────────────────────────────────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class LegalityResult:
    """Result of a FAR 117 legality check."""

    is_legal: bool
    violations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    flight_time_remaining_minutes: int = 0
    fdp_remaining_minutes: int = 0
    rest_required_before_minutes: int = 0

    def to_dict(self) -> dict:
        return {
            "is_legal": self.is_legal,
            "violations": self.violations,
            "warnings": self.warnings,
            "flight_time_remaining_minutes": self.flight_time_remaining_minutes,
            "fdp_remaining_minutes": self.fdp_remaining_minutes,
            "rest_required_before_minutes": self.rest_required_before_minutes,
        }


@dataclass
class CrewState:
    """
    Running duty-time state for one crew member.
    All time fields in minutes unless suffixed _dt (datetime).
    """

    id: str
    role: str  # captain | first_officer | flight_attendant

    # Rest
    last_rest_end: Optional[datetime] = None   # When last qualifying rest period ended
    last_rest_duration_hours: float = 10.0     # Duration of last rest period

    # Current FDP tracking
    current_fdp_start: Optional[datetime] = None
    current_fdp_flight_minutes: int = 0        # Accumulated flight time in current FDP

    # Cumulative flight times
    flight_time_7d_minutes: int = 0
    flight_time_28d_minutes: int = 0
    flight_time_365d_minutes: int = 0

    # Home base timezone (for WOCL determination)
    home_timezone_offset_hours: float = 0.0   # UTC offset

    def fdp_elapsed_minutes(self, at_time: datetime) -> int:
        """Minutes elapsed since FDP start."""
        if self.current_fdp_start is None:
            return 0
        return int((at_time - self.current_fdp_start).total_seconds() / 60)

    def max_fdp_hours(self, report_time: datetime, wocl_check: bool = True) -> float:
        """Compute max allowable FDP for given report time per Table B."""
        local_hour = (report_time.hour + int(self.home_timezone_offset_hours)) % 24
        base_fdp = FDP_TABLE.get(local_hour, 9.0)

        if wocl_check:
            # Reduce by 30 min if report time is in WOCL
            if WOCL_START_HOUR <= local_hour <= WOCL_END_HOUR:
                base_fdp -= WOCL_FDP_REDUCTION_HOURS

        return base_fdp


# ──────────────────────────────────────────────────────────────────────────────
# Engine
# ──────────────────────────────────────────────────────────────────────────────

class CrewLegalityEngine:
    """
    Enforces FAR Part 117 for passenger airline operations (2-pilot, unaugmented).

    Usage:
        engine = CrewLegalityEngine()
        result = engine.validate(crew_dict, proposed_pairing_dict)
    """

    MAX_FLIGHT_TIME_PER_FDP = timedelta(hours=MAX_FT_PER_FDP_HOURS)
    MIN_REST = timedelta(hours=MIN_REST_HOURS)
    MAX_FT_7D = timedelta(hours=MAX_FT_7_DAYS_HOURS)
    MAX_FT_28D = timedelta(hours=MAX_FT_28_DAYS_HOURS)
    MAX_FT_365D = timedelta(hours=MAX_FT_365_DAYS_HOURS)
    MIN_TURN = timedelta(minutes=MIN_TURN_MINUTES)

    # ─── Public API ───────────────────────────────────────────────────────────

    def validate(self, crew: dict, proposed_pairing: dict) -> LegalityResult:
        """
        Validate whether a crew member can legally operate a proposed pairing.

        crew dict keys:
            id, role, duty_start, flight_time_7d_minutes, flight_time_28d_minutes,
            flight_time_365d_minutes, last_rest_end (ISO str or datetime),
            current_fdp_start (ISO str or datetime | None),
            current_fdp_flight_minutes, home_timezone_offset_hours (default 0)

        proposed_pairing dict keys:
            departure (ISO str or datetime),
            arrival (ISO str or datetime),
            flight_time_minutes
        """
        violations: list[str] = []
        warnings: list[str] = []

        # Parse timestamps
        departure = self._to_dt(proposed_pairing.get("departure"))
        arrival = self._to_dt(proposed_pairing.get("arrival"))
        flight_time_min = int(proposed_pairing.get("flight_time_minutes", 0))

        last_rest_end = self._to_dt(crew.get("last_rest_end"))
        current_fdp_start = self._to_dt(crew.get("current_fdp_start"))
        tz_offset = float(crew.get("home_timezone_offset_hours", 0.0))

        ft_7d = int(crew.get("flight_time_7d_minutes", 0))
        ft_28d = int(crew.get("flight_time_28d_minutes", 0))
        ft_365d = int(crew.get("flight_time_365d_minutes", 0))
        fdp_ft = int(crew.get("current_fdp_flight_minutes", 0))

        if departure is None or arrival is None:
            return LegalityResult(
                is_legal=False,
                violations=["Invalid departure or arrival time"],
            )

        # ── 1. Minimum rest before new FDP ────────────────────────────────
        if last_rest_end is not None:
            rest_available = departure - last_rest_end
            if rest_available < self.MIN_REST:
                short_by = int((self.MIN_REST - rest_available).total_seconds() / 60)
                violations.append(
                    f"§117.25(a): Insufficient rest. Available: "
                    f"{rest_available.total_seconds()/3600:.1f}h, required: "
                    f"{MIN_REST_HOURS}h. Short by {short_by} minutes."
                )
            elif rest_available < timedelta(hours=10, minutes=30):
                warnings.append(
                    f"§117.25(a) WARNING: Rest margin is thin "
                    f"({rest_available.total_seconds()/3600:.1f}h available, min 10h required)."
                )

        # ── 2. FDP limit (Table B) ─────────────────────────────────────────
        fdp_start = current_fdp_start if current_fdp_start else departure
        local_report_hour = (fdp_start.hour + int(tz_offset)) % 24
        max_fdp_h = FDP_TABLE.get(local_report_hour, 9.0)

        # WOCL check
        if WOCL_START_HOUR <= local_report_hour <= WOCL_END_HOUR:
            max_fdp_h -= WOCL_FDP_REDUCTION_HOURS
            warnings.append(
                f"§117.21(c): FDP starts in WOCL (0200–0559 local). "
                f"Max FDP reduced to {max_fdp_h:.1f}h."
            )

        max_fdp = timedelta(hours=max_fdp_h)
        projected_fdp_end = arrival  # FDP ends at block-in

        if current_fdp_start:
            fdp_elapsed = arrival - fdp_start
        else:
            fdp_elapsed = arrival - departure

        if fdp_elapsed > max_fdp:
            over_by = int((fdp_elapsed - max_fdp).total_seconds() / 60)
            violations.append(
                f"§117.13: FDP exceeds Table B limit. "
                f"Projected FDP: {fdp_elapsed.total_seconds()/3600:.1f}h, "
                f"max: {max_fdp_h:.1f}h. Over by {over_by} minutes."
            )
        elif fdp_elapsed > max_fdp - timedelta(minutes=30):
            warnings.append(
                f"§117.13 WARNING: Approaching max FDP limit "
                f"({fdp_elapsed.total_seconds()/3600:.1f}h / {max_fdp_h:.1f}h)."
            )

        # ── 3. Flight time per FDP ─────────────────────────────────────────
        new_fdp_ft = fdp_ft + flight_time_min
        max_ft_per_fdp_min = int(MAX_FT_PER_FDP_HOURS * 60)

        if new_fdp_ft > max_ft_per_fdp_min:
            over_by = new_fdp_ft - max_ft_per_fdp_min
            violations.append(
                f"§117.11: Flight time per FDP exceeded. "
                f"Would be {new_fdp_ft} minutes, max {max_ft_per_fdp_min} minutes. "
                f"Over by {over_by} minutes."
            )

        # ── 4. 7-day cumulative flight time ───────────────────────────────
        new_ft_7d = ft_7d + flight_time_min
        max_7d_min = int(MAX_FT_7_DAYS_HOURS * 60)

        if new_ft_7d > max_7d_min:
            over_by = new_ft_7d - max_7d_min
            violations.append(
                f"§117.23(b)(1): 7-day flight time limit exceeded. "
                f"Would be {new_ft_7d // 60}h {new_ft_7d % 60}m, max 60h. "
                f"Over by {over_by} minutes."
            )
        elif new_ft_7d > max_7d_min - 60:
            warnings.append(
                f"§117.23 WARNING: Approaching 7-day limit "
                f"({new_ft_7d // 60}h {new_ft_7d % 60}m / 60h)."
            )

        # ── 5. 28-day cumulative flight time ──────────────────────────────
        new_ft_28d = ft_28d + flight_time_min
        max_28d_min = int(MAX_FT_28_DAYS_HOURS * 60)

        if new_ft_28d > max_28d_min:
            over_by = new_ft_28d - max_28d_min
            violations.append(
                f"§117.23(b)(2): 28-day flight time limit exceeded. "
                f"Would be {new_ft_28d // 60}h {new_ft_28d % 60}m, max 100h. "
                f"Over by {over_by} minutes."
            )
        elif new_ft_28d > max_28d_min - 120:
            warnings.append(
                f"§117.23 WARNING: Approaching 28-day limit "
                f"({new_ft_28d // 60}h {new_ft_28d % 60}m / 100h)."
            )

        # ── 6. 365-day cumulative flight time ─────────────────────────────
        new_ft_365d = ft_365d + flight_time_min
        max_365d_min = int(MAX_FT_365_DAYS_HOURS * 60)

        if new_ft_365d > max_365d_min:
            over_by = new_ft_365d - max_365d_min
            violations.append(
                f"§117.23(b)(3): 365-day flight time limit exceeded. "
                f"Would be {new_ft_365d // 60}h {new_ft_365d % 60}m, max 1000h. "
                f"Over by {over_by} minutes."
            )

        # ── 7. WOCL check for flight arrival ──────────────────────────────
        local_arrival_hour = (arrival.hour + int(tz_offset)) % 24
        if WOCL_START_HOUR <= local_arrival_hour <= WOCL_END_HOUR:
            warnings.append(
                f"§117.21: Flight arrives during WOCL "
                f"(local {local_arrival_hour:02d}:00). Consider crew rest impact."
            )

        # ── 8. Minimum turn time ──────────────────────────────────────────
        last_arrival = self._to_dt(proposed_pairing.get("last_arrival"))
        if last_arrival is not None:
            turn_time = departure - last_arrival
            if turn_time < self.MIN_TURN:
                violations.append(
                    f"Minimum turn time violated: {int(turn_time.total_seconds() / 60)} minutes "
                    f"available, {MIN_TURN_MINUTES} minutes required."
                )

        # ── Compute remaining allowances ──────────────────────────────────
        ft_remaining_in_fdp = max_ft_per_fdp_min - new_fdp_ft
        fdp_remaining = int(
            (max_fdp - (arrival - fdp_start)).total_seconds() / 60
        ) if (arrival - fdp_start) < max_fdp else 0

        rest_required = 0
        if violations:
            # How long they need to rest before being legal again
            rest_required = int(MIN_REST_HOURS * 60)

        return LegalityResult(
            is_legal=len(violations) == 0,
            violations=violations,
            warnings=warnings,
            flight_time_remaining_minutes=max(0, ft_remaining_in_fdp),
            fdp_remaining_minutes=max(0, fdp_remaining),
            rest_required_before_minutes=rest_required,
        )

    def validate_crew_pairing(
        self, crew_list: list[dict], pairing: dict
    ) -> dict[str, LegalityResult]:
        """
        Validate all crew members for a single pairing.

        Returns dict mapping crew_id -> LegalityResult.
        """
        results: dict[str, LegalityResult] = {}
        for crew in crew_list:
            crew_id = crew.get("id", "unknown")
            results[crew_id] = self.validate(crew, pairing)
        return results

    def compute_legal_pairings(
        self, available_crews: list[dict], open_flights: list[dict]
    ) -> list[dict]:
        """
        Compute all (crew_id, flight_id) pairs that are legal under FAR 117.

        Returns list of dicts: [{crew_id, flight_id, role, legality_result}]
        """
        legal_pairs = []
        for flight in open_flights:
            for crew in available_crews:
                pairing = {
                    "departure": flight.get("scheduled_departure"),
                    "arrival": flight.get("scheduled_arrival"),
                    "flight_time_minutes": flight.get("flight_time_minutes", 90),
                }
                result = self.validate(crew, pairing)
                if result.is_legal:
                    legal_pairs.append(
                        {
                            "crew_id": crew.get("id"),
                            "flight_id": flight.get("id"),
                            "role": crew.get("role"),
                            "legality": result.to_dict(),
                        }
                    )
        return legal_pairs

    def compute_required_rest(
        self, crew: dict, last_fdp_end: datetime
    ) -> datetime:
        """
        Given when the FDP ended, return the earliest time crew can start next FDP.
        §117.25(a): minimum 10-hour rest.
        """
        return last_fdp_end + self.MIN_REST

    def fdp_limit_for_report_time(
        self, report_time: datetime, tz_offset_hours: float = 0.0
    ) -> float:
        """Return max FDP hours for a given report time."""
        local_hour = (report_time.hour + int(tz_offset_hours)) % 24
        base = FDP_TABLE.get(local_hour, 9.0)
        if WOCL_START_HOUR <= local_hour <= WOCL_END_HOUR:
            base -= WOCL_FDP_REDUCTION_HOURS
        return base

    # ─── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _to_dt(value: str | datetime | None) -> datetime | None:
        """Parse ISO string or return datetime as-is."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
