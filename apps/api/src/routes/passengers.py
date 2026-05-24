"""
Passenger solutions endpoints.

GET /passengers/impact          — delay estimates + compensation eligibility
GET /passengers/hotels/{airport} — 3 nearby hotels for a stranded airport
GET /passengers/rebooking        — alternative flights for disrupted passengers
GET /passengers/compensation-policy — airline fault classification rules
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import yaml
from fastapi import APIRouter, Request

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent.parent.parent / "data" / "network"

# Events where the airline bears full operational responsibility
AIRLINE_FAULT_EVENTS = {"crew_sickout", "mechanical_aog", "cyber_incident"}

# Static hotel data keyed to Nimbus Air airport codes (3 per airport)
AIRPORT_HOTELS: dict[str, list[dict]] = {
    "KORD": [
        {"name": "Hilton Chicago O'Hare Airport", "distance_mi": 0.2, "shuttle": True,
         "price_usd": 189, "stars": 4, "phone": "+1-773-686-8000"},
        {"name": "Hyatt Regency O'Hare Chicago", "distance_mi": 0.5, "shuttle": True,
         "price_usd": 164, "stars": 4, "phone": "+1-847-696-1234"},
        {"name": "Marriott Chicago O'Hare", "distance_mi": 1.2, "shuttle": True,
         "price_usd": 149, "stars": 3, "phone": "+1-773-693-4444"},
    ],
    "KATL": [
        {"name": "Renaissance Concourse Atlanta Airport Hotel", "distance_mi": 0.1, "shuttle": False,
         "price_usd": 179, "stars": 4, "phone": "+1-404-209-9999"},
        {"name": "Westin Atlanta Airport", "distance_mi": 0.2, "shuttle": False,
         "price_usd": 169, "stars": 4, "phone": "+1-404-762-7676"},
        {"name": "Courtyard Atlanta Airport North", "distance_mi": 1.8, "shuttle": True,
         "price_usd": 129, "stars": 3, "phone": "+1-404-559-1043"},
    ],
    "KDFW": [
        {"name": "Grand Hyatt DFW", "distance_mi": 0.1, "shuttle": False,
         "price_usd": 199, "stars": 4, "phone": "+1-972-973-1234"},
        {"name": "Hyatt Regency DFW", "distance_mi": 0.3, "shuttle": False,
         "price_usd": 172, "stars": 4, "phone": "+1-972-453-1234"},
        {"name": "Marriott DFW Airport South", "distance_mi": 2.1, "shuttle": True,
         "price_usd": 139, "stars": 3, "phone": "+1-972-929-8800"},
    ],
    "KLAX": [
        {"name": "Marriott Los Angeles Airport", "distance_mi": 0.5, "shuttle": True,
         "price_usd": 219, "stars": 4, "phone": "+1-310-641-5700"},
        {"name": "Sheraton Gateway Los Angeles Hotel", "distance_mi": 0.8, "shuttle": True,
         "price_usd": 179, "stars": 4, "phone": "+1-310-642-1111"},
        {"name": "Courtyard Los Angeles LAX/Century Boulevard", "distance_mi": 1.1, "shuttle": True,
         "price_usd": 149, "stars": 3, "phone": "+1-310-649-1400"},
    ],
    "KDEN": [
        {"name": "Westin Denver International Airport", "distance_mi": 0.1, "shuttle": False,
         "price_usd": 189, "stars": 4, "phone": "+1-303-317-1800"},
        {"name": "Gaylord Rockies Resort", "distance_mi": 2.5, "shuttle": True,
         "price_usd": 249, "stars": 5, "phone": "+1-720-452-6900"},
        {"name": "Doubletree by Hilton Denver Airport", "distance_mi": 3.1, "shuttle": True,
         "price_usd": 139, "stars": 3, "phone": "+1-303-576-6000"},
    ],
    "KJFK": [
        {"name": "TWA Hotel", "distance_mi": 0.1, "shuttle": False,
         "price_usd": 249, "stars": 4, "phone": "+1-212-806-9000"},
        {"name": "JFK Airport Marriott", "distance_mi": 0.3, "shuttle": True,
         "price_usd": 199, "stars": 4, "phone": "+1-718-848-6000"},
        {"name": "Hampton Inn JFK Airport", "distance_mi": 1.2, "shuttle": True,
         "price_usd": 159, "stars": 3, "phone": "+1-718-322-7500"},
    ],
    "KSEA": [
        {"name": "Marriott Seattle Airport", "distance_mi": 0.5, "shuttle": True,
         "price_usd": 169, "stars": 4, "phone": "+1-206-241-2000"},
        {"name": "Doubletree by Hilton Seattle Airport", "distance_mi": 0.8, "shuttle": True,
         "price_usd": 149, "stars": 3, "phone": "+1-206-246-8600"},
        {"name": "Hilton Seattle Airport & Conference Center", "distance_mi": 1.0, "shuttle": True,
         "price_usd": 159, "stars": 4, "phone": "+1-206-244-4800"},
    ],
    "KMIA": [
        {"name": "Miami International Airport Hotel", "distance_mi": 0.1, "shuttle": False,
         "price_usd": 189, "stars": 4, "phone": "+1-305-871-4100"},
        {"name": "Hilton Miami Airport Blue Lagoon", "distance_mi": 1.5, "shuttle": True,
         "price_usd": 169, "stars": 4, "phone": "+1-305-262-1000"},
        {"name": "Courtyard Miami Airport", "distance_mi": 2.0, "shuttle": True,
         "price_usd": 129, "stars": 3, "phone": "+1-305-642-8200"},
    ],
    "KPHX": [
        {"name": "The Phoenician, Scottsdale (shuttle)", "distance_mi": 8.0, "shuttle": True,
         "price_usd": 299, "stars": 5, "phone": "+1-480-941-8200"},
        {"name": "Crowne Plaza Phoenix Airport", "distance_mi": 0.7, "shuttle": True,
         "price_usd": 139, "stars": 3, "phone": "+1-602-273-7778"},
        {"name": "Marriott Phoenix Airport", "distance_mi": 1.0, "shuttle": True,
         "price_usd": 149, "stars": 4, "phone": "+1-602-952-0420"},
    ],
    "KLAS": [
        {"name": "The Cosmopolitan of Las Vegas", "distance_mi": 3.5, "shuttle": False,
         "price_usd": 249, "stars": 5, "phone": "+1-702-698-7000"},
        {"name": "Marriott Las Vegas", "distance_mi": 2.8, "shuttle": True,
         "price_usd": 179, "stars": 4, "phone": "+1-702-650-2000"},
        {"name": "Hampton Inn Las Vegas Airport", "distance_mi": 1.2, "shuttle": True,
         "price_usd": 119, "stars": 3, "phone": "+1-702-948-8100"},
    ],
    "KBOS": [
        {"name": "Hilton Boston Logan Airport", "distance_mi": 0.2, "shuttle": False,
         "price_usd": 199, "stars": 4, "phone": "+1-617-568-6700"},
        {"name": "Marriott Boston Long Wharf", "distance_mi": 3.5, "shuttle": False,
         "price_usd": 229, "stars": 4, "phone": "+1-617-227-0800"},
        {"name": "Holiday Inn Express Boston Airport", "distance_mi": 1.8, "shuttle": True,
         "price_usd": 139, "stars": 3, "phone": "+1-617-569-5250"},
    ],
    "KSFO": [
        {"name": "SFO Grand Hyatt", "distance_mi": 0.1, "shuttle": False,
         "price_usd": 219, "stars": 4, "phone": "+1-650-347-1234"},
        {"name": "Marriott San Francisco Airport Waterfront", "distance_mi": 0.5, "shuttle": True,
         "price_usd": 189, "stars": 4, "phone": "+1-650-692-9100"},
        {"name": "Hampton Inn San Francisco Airport", "distance_mi": 1.5, "shuttle": True,
         "price_usd": 149, "stars": 3, "phone": "+1-650-697-0400"},
    ],
    "KIAH": [
        {"name": "Marriott Houston Airport at George Bush Intercontinental", "distance_mi": 0.3,
         "shuttle": True, "price_usd": 159, "stars": 4, "phone": "+1-281-443-2310"},
        {"name": "Hilton Houston NASA Clear Lake", "distance_mi": 1.0, "shuttle": True,
         "price_usd": 139, "stars": 3, "phone": "+1-281-333-9300"},
        {"name": "Doubletree by Hilton Houston IAH", "distance_mi": 2.0, "shuttle": True,
         "price_usd": 129, "stars": 3, "phone": "+1-281-449-2311"},
    ],
    "KDTW": [
        {"name": "Westin Detroit Metropolitan Airport", "distance_mi": 0.1, "shuttle": False,
         "price_usd": 169, "stars": 4, "phone": "+1-734-942-6500"},
        {"name": "Marriott Detroit Airport", "distance_mi": 0.5, "shuttle": True,
         "price_usd": 149, "stars": 4, "phone": "+1-734-729-7555"},
        {"name": "Hampton Inn Detroit Airport", "distance_mi": 1.2, "shuttle": True,
         "price_usd": 119, "stars": 3, "phone": "+1-734-721-1100"},
    ],
    "KMSP": [
        {"name": "Crowne Plaza Minneapolis Airport", "distance_mi": 0.5, "shuttle": True,
         "price_usd": 149, "stars": 4, "phone": "+1-952-854-9000"},
        {"name": "Marriott Minneapolis Airport", "distance_mi": 0.8, "shuttle": True,
         "price_usd": 139, "stars": 4, "phone": "+1-952-854-7441"},
        {"name": "Courtyard Minneapolis Airport", "distance_mi": 1.5, "shuttle": True,
         "price_usd": 119, "stars": 3, "phone": "+1-952-876-1400"},
    ],
}

AVG_DOMESTIC_FARE_USD = 350.0   # Nimbus Air average one-way fare


def _load_flights() -> list[dict]:
    try:
        with open(DATA_DIR / "flights.yaml") as f:
            return yaml.safe_load(f).get("flights", [])
    except Exception:
        return []


def _is_airline_fault(event_kind: str) -> bool:
    return event_kind in AIRLINE_FAULT_EVENTS


def _compensation_for_flight(
    flight: dict,
    delay_minutes: int,
    is_cancelled: bool,
    event_kind: str,
    p_delayed: float,
) -> dict:
    fault = _is_airline_fault(event_kind)
    pax   = max(1, flight.get("passengers", 150))

    comp: dict = {
        "is_airline_fault":    fault,
        "event_category":      "Airline Operational Fault" if fault else "Force Majeure / Extraordinary Circumstance",
        "legal_basis":         "14 CFR §250 / DOT Enforcement Policy" if fault else "No DOT-mandated cash compensation",
        "meal_voucher_usd":    0,
        "hotel_required":      False,
        "hotel_transport_usd": 0,
        "travel_credit_usd":   0,
        "dot261_cash_usd":     0,
        "rebooking":           "none",
        "estimated_total_usd": 0,
        "actions":             [],
        "goodwill_notes":      [],
    }

    if fault:
        comp["rebooking"] = "required"

        if delay_minutes >= 120:
            comp["meal_voucher_usd"] = 15
            comp["actions"].append("Issue $15 meal voucher (2h+ delay — DOT required)")

        if delay_minutes >= 240:
            comp["hotel_required"]      = True
            comp["hotel_transport_usd"] = 30   # estimated ground transport
            comp["actions"].append("Arrange hotel accommodation + $30 ground transport (4h+ delay)")

        if is_cancelled:
            comp["dot261_cash_usd"]   = min(1_550, AVG_DOMESTIC_FARE_USD * 4)
            comp["travel_credit_usd"] = 200
            comp["actions"].append(
                f"Involuntary denied boarding: offer ${comp['dot261_cash_usd']:.0f} cash "
                f"OR full refund + $200 travel credit"
            )

        comp["estimated_total_usd"] = (
            comp["meal_voucher_usd"] * pax
            + (comp["hotel_transport_usd"] + 150) * pax * int(comp["hotel_required"])
            + comp["dot261_cash_usd"]
            + comp["travel_credit_usd"]
        )

    else:
        comp["rebooking"] = "goodwill_no_fee"
        comp["goodwill_notes"].append("Rebook on next available Nimbus Air flight — no change fee")

        if delay_minutes >= 180:
            comp["meal_voucher_usd"] = 10
            comp["goodwill_notes"].append("Offer $10 goodwill meal voucher (not legally required)")

        if is_cancelled:
            comp["goodwill_notes"].append(
                "Offer full refund or rebooking; no cash DOT compensation required"
            )

        comp["estimated_total_usd"] = comp["meal_voucher_usd"] * pax

    return comp


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/passengers/impact")
async def passenger_impact(request: Request):
    """
    Returns per-flight delay estimates + compensation obligations for all
    currently disrupted flights.
    """
    engine = getattr(request.app.state, "engine", None)

    flights = _load_flights()
    flights_by_id = {f["id"]: f for f in flights}

    active_events: list[dict] = engine.state.active_events if engine else []
    flight_states: dict       = engine.state.flight_states if engine else {}
    event_kind = active_events[0].get("kind", "") if active_events else ""

    results = []
    for fid, fstate in flight_states.items():
        if fstate.get("cascade_order", -1) < 0:
            continue

        flight    = flights_by_id.get(fid, {})
        delay_min = max(0, int(fstate.get("delay_minutes", 0)))
        p_delayed = fstate.get("p_delayed", 0.5)
        is_cancelled  = fstate.get("status") == "cancelled"
        cascade_order = fstate.get("cascade_order", 0)

        # Confidence interval: ±15% of delay estimate, minimum ±10 min
        ci_half    = max(10, int(delay_min * 0.15))
        ci_low     = max(0, delay_min - ci_half)
        ci_high    = delay_min + ci_half

        new_dep = fstate.get("new_departure") or flight.get("scheduled_departure", "")

        comp = _compensation_for_flight(
            flight, delay_min, is_cancelled, event_kind, p_delayed
        )

        # Ground transport alternative (for routes under 400 mi)
        origin      = fstate.get("origin") or flight.get("origin", "")
        destination = fstate.get("destination") or flight.get("destination", "")
        ground_alt  = None
        if origin and destination:
            # Rough city-pair distance check (simplified — flag KORD↔KDTW etc.)
            short_haul_pairs = {
                frozenset(["KORD", "KDTW"]), frozenset(["KORD", "KMSP"]),
                frozenset(["KJFK", "KBOS"]), frozenset(["KATL", "KMIA"]),
                frozenset(["KLAX", "KSFO"]), frozenset(["KPHX", "KLAS"]),
                frozenset(["KDFW", "KIAH"]),
            }
            if frozenset([origin, destination]) in short_haul_pairs:
                ground_alt = {
                    "mode": "rental_car",
                    "note": "Short-haul route — rental car or train may be faster given delay",
                    "estimated_drive_hrs": 4.5,
                }

        results.append({
            "flight_id":        fid,
            "origin":           origin,
            "destination":      destination,
            "status":           fstate.get("status", "delayed"),
            "cascade_order":    cascade_order,
            "delay_minutes":    delay_min,
            "p_delayed":        round(p_delayed, 2),
            "confidence_interval": {"low_min": ci_low, "high_min": ci_high},
            "new_departure":    new_dep,
            "passengers":       flight.get("passengers", 0),
            "compensation":     comp,
            "ground_transport_alternative": ground_alt,
        })

    # Sort: directly impacted first, then by delay descending
    results.sort(key=lambda r: (r["cascade_order"], -r["delay_minutes"]))

    return {
        "event_kind":      event_kind,
        "is_airline_fault": _is_airline_fault(event_kind),
        "total_affected":  len(results),
        "flights":         results,
    }


@router.get("/passengers/hotels/{airport_code}")
async def nearby_hotels(airport_code: str):
    """Return 3 nearby hotels for a stranded airport."""
    code   = airport_code.upper()
    hotels = AIRPORT_HOTELS.get(code, [])
    if not hotels:
        return {"airport": code, "hotels": [], "message": "No hotel data for this airport"}

    return {
        "airport": code,
        "hotels":  hotels,
        "note":    "Prices are estimated nightly rack rates. Nimbus Air will cover hotel + $30 transport for airline-fault cancellations/4h+ delays.",
    }


@router.get("/passengers/rebooking")
async def rebooking_options(request: Request):
    """
    For each disrupted flight, suggest the next 2 alternative Nimbus Air
    flights on the same city-pair.
    """
    engine = getattr(request.app.state, "engine", None)
    flights = _load_flights()
    flight_states: dict = engine.state.flight_states if engine else {}

    disrupted = {
        fid: fs for fid, fs in flight_states.items()
        if fs.get("cascade_order", -1) >= 0
        and fs.get("status") in ("delayed", "cancelled")
    }

    flights_by_id = {f["id"]: f for f in flights}

    rebooking: list[dict] = []
    for fid, fstate in disrupted.items():
        orig_flight = flights_by_id.get(fid, {})
        origin      = fstate.get("origin") or orig_flight.get("origin", "")
        destination = fstate.get("destination") or orig_flight.get("destination", "")
        orig_dep    = orig_flight.get("scheduled_departure", "")

        # Find next 2 Nimbus Air flights on same city-pair
        alternatives = []
        for f in flights:
            if f["id"] == fid:
                continue
            if f.get("origin") != origin or f.get("destination") != destination:
                continue
            if f.get("status") == "cancelled":
                continue
            # Only suggest flights after the original scheduled departure
            try:
                orig_dt  = datetime.fromisoformat(orig_dep.replace("Z", "+00:00"))
                f_dt     = datetime.fromisoformat(f["scheduled_departure"].replace("Z", "+00:00"))
                if f_dt <= orig_dt:
                    continue
                delta_h  = round((f_dt - orig_dt).total_seconds() / 3600, 1)
            except (ValueError, AttributeError):
                delta_h  = 0.0

            alternatives.append({
                "flight_id":   f["id"],
                "departure":   f["scheduled_departure"],
                "arrival":     f["scheduled_arrival"],
                "aircraft_id": f.get("aircraft_id", ""),
                "seats_avail": max(0, f.get("passengers", 150) - 120),  # rough available seats
                "delay_vs_original_hrs": delta_h,
            })
            if len(alternatives) >= 2:
                break

        rebooking.append({
            "disrupted_flight_id": fid,
            "origin":              origin,
            "destination":         destination,
            "original_departure":  orig_dep,
            "alternatives":        alternatives,
            "has_options":         len(alternatives) > 0,
        })

    return {"disrupted_count": len(rebooking), "rebooking_options": rebooking}


@router.get("/passengers/compensation-policy")
async def compensation_policy():
    """Airline compensation policy: fault-based classification and obligations."""
    return {
        "airline": "Nimbus Air",
        "policy_version": "2024-A",
        "legal_framework": "14 CFR Part 250 / DOT Order 2024-1",
        "fault_classification": {
            "airline_fault_events": sorted(AIRLINE_FAULT_EVENTS),
            "force_majeure_events": sorted(
                {"weather_closure", "ground_stop", "airspace_closure",
                 "security_event", "volcanic_ash", "atc_staffing", "runway_closure"}
            ),
        },
        "airline_fault_obligations": {
            "2h_delay": {
                "required": True,
                "action": "Meal voucher $15/person",
                "basis": "DOT Enforcement Policy / Airline Customer Service Plan",
            },
            "4h_delay": {
                "required": True,
                "action": "Hotel accommodation + $30 ground transport per person",
                "basis": "DOT Enforcement Policy",
            },
            "cancellation": {
                "required": True,
                "action": "Choice: (A) involuntary denied boarding cash — 400% one-way fare max $1,550; OR (B) full refund + $200 travel credit",
                "basis": "14 CFR §250.5 / DOT Order 2024-1",
            },
        },
        "force_majeure_goodwill": {
            "policy": "Nimbus Air goodwill protocol",
            "actions": [
                "Rebook on next available Nimbus Air flight — no change fee",
                "Meal voucher $10/person if gate delay exceeds 3 hours (goodwill)",
                "Hotel arranged if overnight stay required due to last-flight-of-day cancellation (goodwill)",
            ],
            "not_required": [
                "Cash compensation for delays",
                "Compensation beyond rebooking for weather / ATC / airspace events",
            ],
        },
        "passenger_rights_link": "https://www.transportation.gov/airconsumer/fly-rights",
    }
