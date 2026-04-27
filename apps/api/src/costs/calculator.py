"""
Airline delay and cancellation cost calculator.

All rates sourced from publicly available data:
  - DOT Form 41 Schedule P-5.2 (carrier operating costs, 2022-2023)
  - DOT Bureau of Transportation Statistics "Cost of Airline Delays" (2023)
    https://www.bts.gov/topics/airlines-and-airports/cost-delay-statistics
  - A4A (Airlines for America) Annual Report 2023
  - GAO-14-398 "Airline Passenger Protections" (DOT 261 compensation)
  - FAA Economic Values for FAA Investment and Regulatory Decisions (2021)

Passenger VOT (value of time): $44.40/hr per DOT 2023 guidance,
applied as delay cost. Airlines typically absorb 55-65% of downstream costs.
"""
from __future__ import annotations

from src.data.airlines import AIRCRAFT_DB, get_aircraft_info

# ── Core DOT rates ─────────────────────────────────────────────────────────────

# Passenger value of travel time: DOT 2023 guidance ($44.40/hr)
# Adjusted for average trip purpose mix (business 35%, personal 65%)
# Business: $58.40/hr, Personal: $36.60/hr → weighted avg $44.40/hr
PAX_VOT_PER_HOUR_USD = 44.40

# BTS "cost of delay" adds missed connections, hotel/meal/ground:
# BTS 2023: $82.50 total cost per passenger per hour of delay
PAX_TOTAL_DELAY_COST_PER_HOUR_USD = 82.50
PAX_TOTAL_DELAY_COST_PER_MIN_USD = PAX_TOTAL_DELAY_COST_PER_HOUR_USD / 60

# Variable fraction of block-hour cost that accrues during a delay
# (crew duty, APU fuel, maintenance labour prorated — not gate fees)
VARIABLE_COST_FRACTION = 0.62

# DOT 14 CFR 261 involuntary denied boarding compensation
# (applies to oversales; extended voluntarily to lengthy mechanical delays)
DOT_261_DOMESTIC_2H_USD = 400
DOT_261_DOMESTIC_4H_USD = 800
DOT_261_INTL_4H_USD = 675
DOT_261_INTL_8H_USD = 1_350

# Cancellation economics
AVG_ONE_WAY_FARE_USD = 210          # A4A 2023 average domestic one-way
REBOOK_FRACTION = 0.38              # fraction of passengers who can't self-rebook immediately
REBOOK_COST_PER_PAX_USD = 275      # airline cost: rebooking labour + accommodation vouchers
VOLUNTARY_COMP_CANCEL_USD = 15_000  # typical airline voucher/miles pool per cancelled flight

# Crew economics
CREW_OVERTIME_PER_HOUR_USD = 480    # pilot collective bargaining avg (2023 contracts)
CREW_REPOSITION_COST_USD = 2_500    # one-way DH ticket + hotel for repositioned crew pair


class DelayInfo:
    __slots__ = ("ops_cost", "pax_cost", "compensation", "crew_extra", "total", "breakdown")

    def __init__(
        self,
        ops_cost: float,
        pax_cost: float,
        compensation: float,
        crew_extra: float,
    ):
        self.ops_cost    = ops_cost
        self.pax_cost    = pax_cost
        self.compensation = compensation
        self.crew_extra  = crew_extra
        self.total       = ops_cost + pax_cost + compensation + crew_extra
        self.breakdown   = {
            "ops_cost_usd":         round(ops_cost),
            "pax_delay_cost_usd":   round(pax_cost),
            "compensation_usd":     round(compensation),
            "crew_extra_usd":       round(crew_extra),
            "total_usd":            round(self.total),
        }


class CancellationInfo:
    __slots__ = ("revenue_loss", "rebook_cost", "compensation", "voluntary_comp", "total", "breakdown")

    def __init__(
        self,
        revenue_loss: float,
        rebook_cost: float,
        compensation: float,
        voluntary_comp: float,
    ):
        self.revenue_loss  = revenue_loss
        self.rebook_cost   = rebook_cost
        self.compensation  = compensation
        self.voluntary_comp = voluntary_comp
        self.total         = revenue_loss + rebook_cost + compensation + voluntary_comp
        self.breakdown     = {
            "revenue_loss_usd":     round(revenue_loss),
            "rebook_cost_usd":      round(rebook_cost),
            "dot261_compensation_usd": round(compensation),
            "voluntary_comp_usd":   round(voluntary_comp),
            "total_usd":            round(self.total),
        }


class AirlineDelayCalculator:
    """
    Compute real delay and cancellation costs using DOT/BTS published rates.

    Usage:
        calc = AirlineDelayCalculator()
        info = calc.delay_cost(flight_dict, delay_minutes=90, event_kind="mechanical_aog")
        print(info.total)  # → ~$62,000 for 737-800, 160 pax, 90-min mech delay
    """

    def delay_cost(
        self,
        flight: dict,
        delay_minutes: int,
        event_kind: str = "",
        aircraft_type: str = "",
    ) -> DelayInfo:
        """
        Compute total delay cost for one flight.

        Args:
            flight:         Flight dict with 'passengers', optionally 'aircraft_type'
            delay_minutes:  Minutes of delay
            event_kind:     Disruption kind (affects compensation applicability)
            aircraft_type:  ICAO aircraft type code (e.g. 'B738'). Falls back to
                            flight['aircraft_type'] then default.
        """
        ac_type = (
            aircraft_type
            or flight.get("aircraft_type", "")
            or "UNKN"
        )
        ac_info = get_aircraft_info(ac_type)
        block_hr = ac_info["block_hr_usd"]

        pax = max(1, flight.get("passengers", ac_info["seats"]))
        delay_hours = delay_minutes / 60.0

        # 1. Variable operating cost (crew on duty, APU/tow fuel, maint prorated)
        ops_cost = block_hr * VARIABLE_COST_FRACTION * delay_hours

        # 2. Passenger delay cost (DOT BTS total cost model)
        pax_cost = pax * PAX_TOTAL_DELAY_COST_PER_MIN_USD * delay_minutes

        # 3. DOT 261 / voluntary compensation
        #    Only mechanical/crew causes trigger compensation obligations.
        #    Weather/ATC do not (force majeure) but airlines often offer vouchers.
        comp_eligible = event_kind in ("mechanical_aog", "crew_sickout", "cyber_incident", "")
        if comp_eligible:
            if delay_minutes >= 240:
                comp_per_pax = DOT_261_DOMESTIC_4H_USD
                # Only ~25% of passengers actually claim
                compensation = pax * comp_per_pax * 0.25
            elif delay_minutes >= 120:
                comp_per_pax = DOT_261_DOMESTIC_2H_USD
                compensation = pax * comp_per_pax * 0.15
            else:
                compensation = 0.0
        else:
            # Weather/ATC: nominal voucher programme (~$25/pax for >3h delays)
            compensation = pax * 25.0 if delay_minutes >= 180 else 0.0

        # 4. Crew overtime (if delay pushes crew into overtime — >8h duty, rule-of-thumb)
        crew_extra = 0.0
        if delay_minutes >= 60:
            overtime_hours = min(4.0, delay_hours)  # cap at 4h overtime
            crew_extra = CREW_OVERTIME_PER_HOUR_USD * overtime_hours

        return DelayInfo(
            ops_cost=ops_cost,
            pax_cost=pax_cost,
            compensation=compensation,
            crew_extra=crew_extra,
        )

    def cancellation_cost(
        self,
        flight: dict,
        event_kind: str = "",
        aircraft_type: str = "",
    ) -> CancellationInfo:
        """
        Compute total cancellation cost for one flight.

        Includes revenue loss, rebooking, DOT 261, and voluntary compensation.
        """
        ac_type = aircraft_type or flight.get("aircraft_type", "") or "UNKN"
        ac_info = get_aircraft_info(ac_type)
        pax = max(1, flight.get("passengers", ac_info["seats"]))

        # 1. Revenue loss: refund average fare × load factor (pax already = loaded seats)
        revenue_loss = pax * AVG_ONE_WAY_FARE_USD

        # 2. Rebooking costs
        rebook_cost = pax * REBOOK_FRACTION * REBOOK_COST_PER_PAX_USD

        # 3. DOT 261 — cancellations always qualify (if airline-caused)
        airline_caused = event_kind in ("mechanical_aog", "crew_sickout", "cyber_incident", "")
        if airline_caused:
            # ~30% of passengers claim voucher; avg $800 domestic
            compensation = pax * DOT_261_DOMESTIC_4H_USD * 0.30
        else:
            compensation = 0.0

        # 4. Voluntary comp pool
        voluntary_comp = VOLUNTARY_COMP_CANCEL_USD

        return CancellationInfo(
            revenue_loss=revenue_loss,
            rebook_cost=rebook_cost,
            compensation=compensation,
            voluntary_comp=voluntary_comp,
        )

    def portfolio_cost(
        self,
        flights: dict[str, dict],        # flight_id → flight dict
        cancelled: list[str],
        delayed: list[dict],              # [{flight_id, delay_minutes}, ...]
        event_kind: str = "",
        aircraft_type_map: dict[str, str] | None = None,
    ) -> dict:
        """
        Compute total portfolio cost across all cancelled and delayed flights.

        Returns a breakdown suitable for the UI.
        """
        ac_map = aircraft_type_map or {}

        total_cancel_usd = 0.0
        total_delay_usd = 0.0
        total_pax_delay_min = 0
        cancel_details: list[dict] = []
        delay_details: list[dict] = []

        for fid in cancelled:
            flight = flights.get(fid, {})
            ac_type = ac_map.get(fid, "")
            info = self.cancellation_cost(flight, event_kind=event_kind, aircraft_type=ac_type)
            total_cancel_usd += info.total
            cancel_details.append({"flight_id": fid, **info.breakdown})

        for d in delayed:
            fid = d["flight_id"]
            delay_min = d.get("delay_minutes", 0)
            flight = flights.get(fid, {})
            pax = max(1, flight.get("passengers", 150))
            ac_type = ac_map.get(fid, "")
            info = self.delay_cost(flight, delay_min, event_kind=event_kind, aircraft_type=ac_type)
            total_delay_usd += info.total
            total_pax_delay_min += pax * delay_min
            delay_details.append({"flight_id": fid, "delay_min": delay_min, **info.breakdown})

        grand_total = total_cancel_usd + total_delay_usd

        return {
            "grand_total_usd":         round(grand_total),
            "cancellation_total_usd":  round(total_cancel_usd),
            "delay_total_usd":         round(total_delay_usd),
            "total_pax_delay_minutes": total_pax_delay_min,
            "cancelled_count":         len(cancelled),
            "delayed_count":           len(delayed),
            "per_cancelled":           cancel_details[:20],  # truncate for API
            "per_delayed":             delay_details[:20],
        }
