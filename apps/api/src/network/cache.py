"""
In-memory cache for the static Nimbus Air network.

The network (airports, aircraft, flights, crews) is shipped as YAML and never
changes at runtime. Before this module, every read route re-opened and
re-parsed those files on each request — `/network` alone re-parsed ~95 KB of
YAML (50 KB crews + 36 KB flights) per call. Under 25 concurrent VUs that disk
I/O + parse dominated latency and pushed `/network` p95 to ~4.3 s.

This module parses each file exactly once (lazily, then cached for the process
lifetime) and additionally pre-builds:

* the fully-assembled ``/network`` response dict,
* its serialized JSON bytes, and
* a strong ETag over those bytes,

so the hot read path is a dict / bytes lookup instead of disk work. Call
:func:`warm` once at startup to pay the parse cost before serving traffic.

All accessors return the cached objects directly. Read routes only ever
serialize or shallow-filter them, and the optimizer treats the schedule as
read-only, so sharing references is safe. Anything that needs to mutate the
network in place should use :func:`load_copy`.
"""

from __future__ import annotations

import copy
import hashlib
import json
import logging
import threading
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# apps/api/src/network/cache.py -> parents[4] == repo root
DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "network"

_AIRLINE = "Nimbus Air"

# Re-entrant: get_network_json() holds the lock while calling get_network(),
# which re-acquires it. A plain Lock would deadlock here.
_lock = threading.RLock()
_yaml_cache: dict[str, dict] = {}
_network_dict: dict[str, Any] | None = None
_network_json: bytes | None = None
_network_etag: str | None = None


def _read_yaml(filename: str) -> dict:
    """Parse a single YAML file from disk (uncached). Empty dict on absence."""
    try:
        with open(DATA_DIR / filename, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        logger.warning("Network YAML not found: %s", filename)
        return {}


def load_yaml(filename: str) -> dict:
    """Return the parsed contents of a network YAML file, cached per process."""
    cached = _yaml_cache.get(filename)
    if cached is not None:
        return cached
    with _lock:
        cached = _yaml_cache.get(filename)
        if cached is None:
            cached = _read_yaml(filename)
            _yaml_cache[filename] = cached
        return cached


# ── Typed accessors (cached references — do not mutate) ─────────────────────


def get_airports() -> list[dict]:
    return load_yaml("airports.yaml").get("airports", [])


def get_aircraft() -> list[dict]:
    return load_yaml("aircraft.yaml").get("aircraft", [])


def get_flights() -> list[dict]:
    return load_yaml("flights.yaml").get("flights", [])


def get_crew_pairings() -> list[dict]:
    return load_yaml("crews.yaml").get("crew_pairings", [])


def get_crew_members() -> list[dict]:
    return load_yaml("crews.yaml").get("crew_members", [])


def get_network() -> dict[str, Any]:
    """Return the assembled ``/network`` payload, built once and cached."""
    global _network_dict
    if _network_dict is not None:
        return _network_dict
    with _lock:
        if _network_dict is None:
            airports = get_airports()
            aircraft = get_aircraft()
            flights = get_flights()
            crews = get_crew_pairings()
            _network_dict = {
                "airline": _AIRLINE,
                "airports": airports,
                "aircraft": aircraft,
                "flights": flights,
                "crew_pairings": crews,
                "stats": {
                    "airport_count": len(airports),
                    "aircraft_count": len(aircraft),
                    "flight_count": len(flights),
                    "crew_pairing_count": len(crews),
                },
            }
        return _network_dict


def get_network_json() -> tuple[bytes, str]:
    """Return ``(json_bytes, etag)`` for the ``/network`` payload.

    Serialized once on first access; subsequent calls are a constant-time
    lookup. The ETag is a strong validator (sha256 prefix) so clients that send
    ``If-None-Match`` can be answered with a 304 instead of the full blob.
    """
    global _network_json, _network_etag
    if _network_json is not None and _network_etag is not None:
        return _network_json, _network_etag
    with _lock:
        if _network_json is None or _network_etag is None:
            payload = get_network()
            _network_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            _network_etag = '"' + hashlib.sha256(_network_json).hexdigest()[:16] + '"'
        return _network_json, _network_etag


def load_copy() -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Return deep copies of ``(flights, aircraft, crew_pairings, crew_members)``.

    For callers that need to mutate the network in place without corrupting the
    shared cache.
    """
    return (
        copy.deepcopy(get_flights()),
        copy.deepcopy(get_aircraft()),
        copy.deepcopy(get_crew_pairings()),
        copy.deepcopy(get_crew_members()),
    )


def warm() -> dict[str, int]:
    """Parse and pre-serialize the full network. Call once at startup.

    Returns the network stats so the caller can log what was loaded.
    """
    for name in ("airports.yaml", "aircraft.yaml", "flights.yaml", "crews.yaml"):
        load_yaml(name)
    get_network_json()  # forces dict assembly + serialization + etag
    return dict(get_network()["stats"])


def clear() -> None:
    """Drop all cached data — primarily for tests."""
    global _network_dict, _network_json, _network_etag
    with _lock:
        _yaml_cache.clear()
        _network_dict = None
        _network_json = None
        _network_etag = None
