"""
Cyber incident disruption event.
Models IT/cybersecurity incidents affecting airline systems.
"""

from datetime import timedelta

from src.events.base import DisruptionEvent, EventKind

INCIDENT_TYPES = {
    "check_in_outage": {
        "description": "Passenger check-in and boarding system outage",
        "default_duration_h": 3.0,
        "departure_delay_min": 45,
        "affects_system": "departure_control",
    },
    "weight_balance_outage": {
        "description": "Load planning and weight & balance system failure",
        "default_duration_h": 2.0,
        "departure_delay_min": 30,
        "affects_system": "weight_balance",
    },
    "crew_scheduling_outage": {
        "description": "Crew scheduling and tracking system failure",
        "default_duration_h": 4.0,
        "departure_delay_min": 60,
        "affects_system": "crew_ops",
    },
    "flight_ops_outage": {
        "description": "Flight operations and dispatch system failure",
        "default_duration_h": 4.0,
        "departure_delay_min": 90,
        "affects_system": "dispatch",
    },
    "full_it_outage": {
        "description": "Complete IT infrastructure failure (ransomware/major incident)",
        "default_duration_h": 8.0,
        "departure_delay_min": 180,
        "affects_system": "all",
    },
    "airport_system_outage": {
        "description": "Airport FIDS/CUTE/CUPPS system failure",
        "default_duration_h": 2.0,
        "departure_delay_min": 30,
        "affects_system": "airport_it",
    },
    "communication_outage": {
        "description": "ACARS or ATC datalink communication outage",
        "default_duration_h": 2.0,
        "departure_delay_min": 15,
        "affects_system": "acars",
    },
}


class CyberIncidentEvent(DisruptionEvent):
    """
    Cyber incident / IT outage disruption.
    Can affect departure control, crew scheduling, weight & balance, or all systems.
    A full IT outage is equivalent to the 2024 CrowdStrike event impact.
    """

    kind: EventKind = EventKind.CYBER_INCIDENT

    param_schema: dict = {
        "type": "object",
        "required": ["incident_type"],
        "properties": {
            "incident_type": {
                "type": "string",
                "enum": list(INCIDENT_TYPES.keys()),
                "default": "check_in_outage",
            },
            "affected_hubs": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Airports most affected (empty = all Nimbus airports)",
                "default": [],
            },
            "system_restored_at": {
                "type": "string",
                "description": "When system comes back online (relative time or ISO)",
                "default": "T+4h",
            },
            "manual_workaround": {
                "type": "boolean",
                "description": "Whether manual backup procedures are available",
                "default": True,
            },
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
            "kind": "cyber_incident",
            "label": "Departure Control System Outage (CrowdStrike-style)",
            "description": "Full IT infrastructure outage grounds Nimbus Air fleet for 3 hours; manual check-in and paper manifests required",
            "params": {
                "incident_type": "full_it_outage",
                "affected_hubs": [],
                "system_restored_at": "T+4h",
                "manual_workaround": True,
                "degradation_pct": 100,
                "severity": "extreme",
            },
        }

    def duration(self) -> timedelta:
        explicit = self.params.get("duration_hours")
        if explicit:
            return timedelta(hours=float(explicit))
        incident_type = self.params.get("incident_type", "check_in_outage")
        default_h = INCIDENT_TYPES.get(incident_type, {}).get("default_duration_h", 4.0)
        return timedelta(hours=default_h)

    def severity_label(self) -> str:
        incident_type = self.params.get("incident_type", "check_in_outage")
        desc = INCIDENT_TYPES.get(incident_type, {}).get("description", incident_type)
        workaround = (
            "manual workaround available"
            if self.params.get("manual_workaround")
            else "no workaround"
        )
        return f"Cyber Incident: {desc} ({workaround})"

    def affected_flights(self, schedule: list[dict]) -> list[dict]:
        """
        For cyber incidents, the impact depends on which systems are affected.
        Full outage (or degradation_pct >= 50) impacts ALL flights network-wide.
        Partial outage impacts flights at affected hubs.
        """
        incident_type = self.params.get("incident_type", "check_in_outage")
        incident_info = INCIDENT_TYPES.get(incident_type, {})
        affects_system = incident_info.get("affects_system", "departure_control")
        # If caller declared a degradation_pct, treat 50% or higher as system-wide.
        degradation_pct = float(self.params.get("degradation_pct", 0))
        if degradation_pct >= 50:
            affects_system = "all"
        affected_hubs = set(self.params.get("affected_hubs", []))
        start, end = self.event_window()
        affected = []

        start_naive = start.replace(tzinfo=None) if start.tzinfo else start
        end_naive = end.replace(tzinfo=None) if end.tzinfo else end

        for flight in schedule:
            dep_str = flight.get("scheduled_departure", "")
            try:
                from datetime import datetime

                dep = datetime.fromisoformat(dep_str.replace("Z", "+00:00"))
                dep = dep.replace(tzinfo=None) if dep.tzinfo else dep
            except (ValueError, AttributeError):
                continue

            in_window = start_naive <= dep <= end_naive
            if not in_window:
                continue

            if affects_system == "all":
                # Full outage: all flights affected
                affected.append(flight)
            elif affects_system in (
                "departure_control",
                "weight_balance",
                "dispatch",
                "airport_it",
            ):
                # Departing flights at affected hubs (or all hubs if no hub filter)
                departing = flight.get("origin") in affected_hubs if affected_hubs else True
                if departing:
                    affected.append(flight)
            elif affects_system == "crew_ops":
                # All flights need crew assignments confirmed
                affected.append(flight)
            elif affects_system == "acars":
                # All in-flight and departing flights
                affected.append(flight)

        return affected

    def constraints(self) -> list[dict]:
        incident_type = self.params.get("incident_type", "check_in_outage")
        incident_info = INCIDENT_TYPES.get(incident_type, {})
        dep_delay = incident_info.get("departure_delay_min", 45)
        workaround = self.params.get("manual_workaround", True)

        # Manual workaround reduces delay but doesn't eliminate it
        effective_delay = dep_delay // 2 if workaround else dep_delay

        return [
            {
                "type": "system_degradation",
                "incident_type": incident_type,
                "affected_system": incident_info.get("affects_system", "departure_control"),
                "affected_hubs": self.params.get("affected_hubs", []),
                "departure_delay_minutes": effective_delay,
                "degradation_pct": float(self.params.get("degradation_pct", 0)),
                "manual_workaround": workaround,
                "system_restored_at": self.params.get("system_restored_at", "T+4h"),
                "start": "T+0h",
                "end": self.params.get("system_restored_at", "T+4h"),
            }
        ]
