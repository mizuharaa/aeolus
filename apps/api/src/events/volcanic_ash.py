"""
Volcanic ash cloud disruption event.
Models eruption-driven airspace closures affecting large regions.
"""
import math
from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

VOLCANIC_HAZARD_LEVELS = {
    "green": {
        "description": "Volcano quiet or dormant — no aviation impact",
        "capacity_reduction_pct": 0,
    },
    "yellow": {
        "description": "Volcano restless — monitor closely, no immediate impact",
        "capacity_reduction_pct": 5,
    },
    "orange": {
        "description": "Increased eruptive activity — ash cloud possible, reroute advisories",
        "capacity_reduction_pct": 30,
    },
    "red": {
        "description": "Eruption in progress — significant ash cloud, airspace closure",
        "capacity_reduction_pct": 80,
    },
}

# Known active volcanoes near aviation routes
KNOWN_VOLCANOES = {
    "Popocatepetl": {"lat": 19.023, "lon": -98.622, "country": "Mexico"},
    "Redoubt": {"lat": 60.485, "lon": -152.742, "country": "USA (Alaska)"},
    "Kilauea": {"lat": 19.421, "lon": -155.287, "country": "USA (Hawaii)"},
    "Sakurajima": {"lat": 31.585, "lon": 130.659, "country": "Japan"},
    "Etna": {"lat": 37.748, "lon": 14.999, "country": "Italy"},
    "Eyjafjallajokull": {"lat": 63.630, "lon": -19.621, "country": "Iceland"},
}


class VolcanicAshEvent(DisruptionEvent):
    """
    Volcanic ash cloud — creates large regional airspace closures
    that can affect entire route networks.
    """

    kind: EventKind = EventKind.VOLCANIC_ASH

    param_schema: dict = {
        "type": "object",
        "required": ["volcano_lat", "volcano_lon"],
        "properties": {
            "volcano_name": {
                "type": "string",
                "description": "Name of the volcano",
                "example": "Popocatepetl",
            },
            "volcano_lat": {
                "type": "number",
                "description": "Latitude of eruption source",
            },
            "volcano_lon": {
                "type": "number",
                "description": "Longitude of eruption source",
            },
            "ash_cloud_radius_nm": {
                "type": "number",
                "description": "Radius of ash cloud exclusion zone in nautical miles",
                "default": 150,
            },
            "wind_direction_deg": {
                "type": "integer",
                "description": "Wind direction for ash drift (degrees from north)",
                "default": 270,
            },
            "wind_speed_kt": {
                "type": "integer",
                "description": "Wind speed for ash drift (knots)",
                "default": 40,
            },
            "hazard_level": {
                "type": "string",
                "enum": list(VOLCANIC_HAZARD_LEVELS.keys()),
                "default": "red",
            },
            "start": {"type": "string", "default": "T+0h"},
            "end": {"type": "string", "default": "T+12h"},
            "severity": {
                "type": "string",
                "enum": ["moderate", "severe", "extreme"],
                "default": "severe",
            },
        },
    }

    @classmethod
    def default_scenario(cls) -> dict:
        return {
            "kind": "volcanic_ash",
            "label": "Popocatepetl Eruption",
            "description": "Major eruption of Popocatepetl closes airspace over central Mexico, diverting trans-Mexico City traffic",
            "params": {
                "volcano_name": "Popocatepetl",
                "volcano_lat": 19.023,
                "volcano_lon": -98.622,
                "ash_cloud_radius_nm": 150,
                "wind_direction_deg": 90,  # ash drifting east
                "wind_speed_kt": 35,
                "hazard_level": "red",
                "start": "T+0h",
                "end": "T+12h",
                "severity": "severe",
            },
        }

    def duration(self) -> timedelta:
        hazard_level = self.params.get("hazard_level", "red")
        hours = {"green": 0, "yellow": 4, "orange": 12, "red": 24}.get(hazard_level, 12)
        return timedelta(hours=hours)

    def severity_label(self) -> str:
        name = self.params.get("volcano_name", "Unknown Volcano")
        hazard = self.params.get("hazard_level", "red")
        radius = self.params.get("ash_cloud_radius_nm", 150)
        desc = VOLCANIC_HAZARD_LEVELS.get(hazard, {}).get("description", "")
        return f"{name} eruption (SIGMET {hazard.upper()}): {desc}. {radius}nm exclusion zone."

    def _ash_cloud_contains(self, lat: float, lon: float) -> bool:
        """Check if a lat/lon falls within the ash cloud envelope."""
        volcano_lat = self.params.get("volcano_lat", 0.0)
        volcano_lon = self.params.get("volcano_lon", 0.0)
        radius_nm = self.params.get("ash_cloud_radius_nm", 150.0)
        wind_dir = self.params.get("wind_direction_deg", 270)
        wind_kt = self.params.get("wind_speed_kt", 40)

        # Compute drift offset (ash cloud drifts downwind)
        drift_hours = 6  # assume 6-hour drift for peak plume
        drift_nm = wind_kt * drift_hours
        wind_rad = math.radians(wind_dir)
        # Drift vector in degrees
        drift_lat = drift_nm * math.cos(wind_rad) / 60.0
        drift_lon = drift_nm * math.sin(wind_rad) / (60.0 * math.cos(math.radians(volcano_lat)))

        # Ash cloud center drifts downwind
        cloud_center_lat = volcano_lat + drift_lat
        cloud_center_lon = volcano_lon + drift_lon

        R = 3440.065
        phi1, phi2 = math.radians(lat), math.radians(cloud_center_lat)
        dphi = math.radians(cloud_center_lat - lat)
        dlambda = math.radians(cloud_center_lon - lon)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        distance_nm = 2 * R * math.asin(math.sqrt(a))

        # Extended ellipse: wider downwind than upwind
        return distance_nm <= radius_nm

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        Flights whose routes pass through the volcanic ash exclusion zone.
        """
        start, end = self.event_window()
        affected = []

        for flight in schedule:
            if not self._flight_overlaps_window(flight, start, end):
                continue

            # Check if either endpoint or midpoint is in ash cloud
            olat = flight.get("origin_lat", 0.0)
            olon = flight.get("origin_lon", 0.0)
            dlat = flight.get("dest_lat", 0.0)
            dlon = flight.get("dest_lon", 0.0)
            mid_lat = (olat + dlat) / 2
            mid_lon = (olon + dlon) / 2

            if (
                self._ash_cloud_contains(mid_lat, mid_lon)
                or self._ash_cloud_contains(olat, olon)
                or self._ash_cloud_contains(dlat, dlon)
            ):
                affected.append(flight)

        return affected

    def constraints(self) -> list[dict]:
        hazard_level = self.params.get("hazard_level", "red")
        capacity_reduction = VOLCANIC_HAZARD_LEVELS.get(hazard_level, {}).get(
            "capacity_reduction_pct", 80
        )

        return [
            {
                "type": "airspace_unavailable",
                "subtype": "ash_exclusion",
                "volcano_name": self.params.get("volcano_name", "Unknown"),
                "center_lat": self.params.get("volcano_lat"),
                "center_lon": self.params.get("volcano_lon"),
                "radius_nm": self.params.get("ash_cloud_radius_nm", 150),
                "wind_direction_deg": self.params.get("wind_direction_deg", 270),
                "wind_speed_kt": self.params.get("wind_speed_kt", 40),
                "hazard_level": hazard_level,
                "capacity_reduction_pct": capacity_reduction,
                "start": self.params.get("start", "T+0h"),
                "end": self.params.get("end", "T+12h"),
                "reroute_penalty_minutes": 60,
            }
        ]
