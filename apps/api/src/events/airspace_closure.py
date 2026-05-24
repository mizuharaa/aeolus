"""
Airspace closure disruption event.
Covers TFRs, NOTAM-based closures, military exercises, and VIP movements.
"""

from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

CLOSURE_TYPES = {
    "tfr_vip": "Temporary Flight Restriction — VIP Movement",
    "tfr_military": "Temporary Flight Restriction — Military Exercise",
    "tfr_stadium": "Temporary Flight Restriction — Stadium Event",
    "volcanic_tfr": "TFR due to volcanic activity",
    "drone_incident": "Airspace closure due to drone incursion",
    "satellite_debris": "Airspace closure for satellite debris re-entry",
    "wildfire_tfr": "TFR over active wildfire suppression operations",
}


class AirspaceClosureEvent(DisruptionEvent):
    """
    Airspace closure restricts flights through a defined region.
    Affects routes transiting the closed region, requiring rerouts.
    """

    kind: EventKind = EventKind.AIRSPACE_CLOSURE

    param_schema: dict = {
        "type": "object",
        "required": ["center_lat", "center_lon", "radius_nm"],
        "properties": {
            "center_lat": {"type": "number", "description": "Latitude of closure center"},
            "center_lon": {"type": "number", "description": "Longitude of closure center"},
            "radius_nm": {
                "type": "number",
                "description": "Radius of closure in nautical miles",
                "default": 30,
            },
            "floor_ft": {
                "type": "integer",
                "description": "Lower altitude limit of closure (ft MSL)",
                "default": 0,
            },
            "ceiling_ft": {
                "type": "integer",
                "description": "Upper altitude limit of closure (ft MSL)",
                "default": 60000,
            },
            "closure_type": {
                "type": "string",
                "enum": list(CLOSURE_TYPES.keys()),
                "default": "tfr_vip",
            },
            "start": {"type": "string", "default": "T+0h"},
            "end": {"type": "string", "default": "T+3h"},
            "severity": {
                "type": "string",
                "enum": ["mild", "moderate", "severe"],
                "default": "moderate",
            },
        },
    }

    @classmethod
    def default_scenario(cls) -> dict:
        return {
            "kind": "airspace_closure",
            "label": "Denver Airspace TFR — Military Exercise",
            "description": "Large-scale military exercise closes airspace around Denver creating widespread rerouting",
            "params": {
                "center_lat": 39.856,
                "center_lon": -104.674,
                "radius_nm": 40,
                "floor_ft": 0,
                "ceiling_ft": 45000,
                "closure_type": "tfr_military",
                "start": "T+0h",
                "end": "T+6h",
                "severity": "severe",
            },
        }

    def duration(self) -> timedelta:
        closure_type = self.params.get("closure_type", "tfr_vip")
        hours_map = {
            "tfr_vip": 2.0,
            "tfr_military": 6.0,
            "tfr_stadium": 4.0,
            "volcanic_tfr": 12.0,
            "drone_incident": 1.5,
            "satellite_debris": 1.0,
            "wildfire_tfr": 8.0,
        }
        return timedelta(hours=hours_map.get(closure_type, 3.0))

    def severity_label(self) -> str:
        closure_type = self.params.get("closure_type", "tfr_vip")
        return CLOSURE_TYPES.get(closure_type, "Airspace Closure")

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Flights whose routes pass through the closed airspace region.
        Uses great-circle proximity check to closure center.
        """
        import math

        center_lat = self.params.get("center_lat", 0.0)
        center_lon = self.params.get("center_lon", 0.0)
        radius_nm = self.params.get("radius_nm", 30.0)
        start, end = self.event_window()
        affected = []

        def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
            R = 3440.065  # Earth radius in nautical miles
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlambda = math.radians(lon2 - lon1)
            a = (
                math.sin(dphi / 2) ** 2
                + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
            )
            return 2 * R * math.asin(math.sqrt(a))

        def _route_passes_through(flight: dict) -> bool:
            # Approximate: check midpoint of great-circle path
            olat = flight.get("origin_lat", center_lat)
            olon = flight.get("origin_lon", center_lon)
            dlat = flight.get("dest_lat", center_lat)
            dlon = flight.get("dest_lon", center_lon)
            mid_lat = (olat + dlat) / 2
            mid_lon = (olon + dlon) / 2
            return _haversine_nm(mid_lat, mid_lon, center_lat, center_lon) <= radius_nm * 1.5

        for flight in schedule:
            if not self._flight_overlaps_window(flight, start, end):
                continue
            if _route_passes_through(flight):
                affected.append(flight)

        return affected

    def constraints(self) -> list[dict]:
        return [
            {
                "type": "airspace_unavailable",
                "center_lat": self.params.get("center_lat"),
                "center_lon": self.params.get("center_lon"),
                "radius_nm": self.params.get("radius_nm", 30),
                "floor_ft": self.params.get("floor_ft", 0),
                "ceiling_ft": self.params.get("ceiling_ft", 60000),
                "start": self.params.get("start", "T+0h"),
                "end": self.params.get("end", "T+3h"),
                "closure_type": self.params.get("closure_type", "tfr_vip"),
                "add_time_minutes": 25,  # typical reroute penalty
            }
        ]
