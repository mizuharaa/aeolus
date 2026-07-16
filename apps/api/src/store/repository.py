"""
SQLite-backed scenario persistence.

The API previously kept every disruption scenario in ``SimulationEngine``
instance attributes only — a restart wiped the timeline and any pending
recovery decisions. This module gives the engine somewhere durable to write
to: one row per scenario (kind + RNG seed), one row per disruption event in
the scenario's timeline, and a single upserted state snapshot (flight
states, recovery plans, applied plan) taken after every transition.

Schema:
  scenarios          — id, kind, seed, status, timestamps
  scenario_events    — the ordered disruption-event timeline + the METAR
                        snapshot each event was predicted against (weather
                        is a live external feed, so replay must pin it)
  scenario_snapshots — latest flight_states / recovery_plans / cascade
                        summary / applied_plan_id, one row per scenario
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    seed INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenario_events (
    scenario_id TEXT NOT NULL REFERENCES scenarios(id),
    seq INTEGER NOT NULL,
    event_json TEXT NOT NULL,
    metar_json TEXT NOT NULL,
    PRIMARY KEY (scenario_id, seq)
);

CREATE TABLE IF NOT EXISTS scenario_snapshots (
    scenario_id TEXT PRIMARY KEY REFERENCES scenarios(id),
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


@dataclass
class ScenarioRecord:
    id: str
    kind: str
    seed: int
    status: str
    events: list[dict] = field(default_factory=list)
    state: dict | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ScenarioRepository:
    """Small, synchronous repository — one connection, WAL off (single
    process, low write volume; not worth the extra moving part)."""

    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    # ── writes ──────────────────────────────────────────────────────────

    def create_scenario(self, scenario_id: str, kind: str, seed: int) -> None:
        now = _now()
        self._conn.execute(
            "INSERT INTO scenarios (id, kind, seed, status, created_at, updated_at) "
            "VALUES (?, ?, ?, 'open', ?, ?)",
            (scenario_id, kind, seed, now, now),
        )
        self._conn.commit()

    def record_event(self, scenario_id: str, seq: int, event: dict, metar: dict) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO scenario_events (scenario_id, seq, event_json, metar_json) "
            "VALUES (?, ?, ?, ?)",
            (scenario_id, seq, json.dumps(event, default=str), json.dumps(metar, default=str)),
        )
        self._conn.execute(
            "UPDATE scenarios SET updated_at = ? WHERE id = ?", (_now(), scenario_id)
        )
        self._conn.commit()

    def snapshot(self, scenario_id: str, state: dict) -> None:
        now = _now()
        self._conn.execute(
            "INSERT INTO scenario_snapshots (scenario_id, state_json, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(scenario_id) DO UPDATE SET state_json = excluded.state_json, "
            "updated_at = excluded.updated_at",
            (scenario_id, json.dumps(state, default=str), now),
        )
        self._conn.execute("UPDATE scenarios SET updated_at = ? WHERE id = ?", (now, scenario_id))
        self._conn.commit()

    def close_scenario(self, scenario_id: str) -> None:
        self._conn.execute(
            "UPDATE scenarios SET status = 'closed', updated_at = ? WHERE id = ?",
            (_now(), scenario_id),
        )
        self._conn.commit()

    # ── reads ───────────────────────────────────────────────────────────

    def load(self, scenario_id: str) -> ScenarioRecord | None:
        row = self._conn.execute(
            "SELECT id, kind, seed, status FROM scenarios WHERE id = ?", (scenario_id,)
        ).fetchone()
        if row is None:
            return None
        events = [
            json.loads(r[0])
            for r in self._conn.execute(
                "SELECT event_json FROM scenario_events WHERE scenario_id = ? ORDER BY seq",
                (scenario_id,),
            ).fetchall()
        ]
        snap_row = self._conn.execute(
            "SELECT state_json FROM scenario_snapshots WHERE scenario_id = ?", (scenario_id,)
        ).fetchone()
        state = json.loads(snap_row[0]) if snap_row else None
        return ScenarioRecord(
            id=row[0], kind=row[1], seed=row[2], status=row[3], events=events, state=state
        )

    def load_metars(self, scenario_id: str) -> list[dict]:
        return [
            json.loads(r[0])
            for r in self._conn.execute(
                "SELECT metar_json FROM scenario_events WHERE scenario_id = ? ORDER BY seq",
                (scenario_id,),
            ).fetchall()
        ]

    def load_latest_open_scenario(self) -> ScenarioRecord | None:
        row = self._conn.execute(
            "SELECT id FROM scenarios WHERE status = 'open' ORDER BY updated_at DESC LIMIT 1"
        ).fetchone()
        return self.load(row[0]) if row else None

    def list_scenarios(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT id, kind, seed, status, created_at, updated_at FROM scenarios "
            "ORDER BY updated_at DESC"
        ).fetchall()
        cols = ("id", "kind", "seed", "status", "created_at", "updated_at")
        return [dict(zip(cols, r)) for r in rows]
