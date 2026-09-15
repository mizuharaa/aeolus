"""Run from apps/api: python tests/check_brand_storage.py."""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.store.repository import ScenarioRepository, default_db_path

with tempfile.TemporaryDirectory() as temp:
    state = Path(temp)
    assert default_db_path(state).name == "olus.db"
    old = ScenarioRepository(state / "aeolus.db")
    old.create_scenario("retained", "weather_closure", 42)
    old.snapshot("retained", {"flight_states": {"2291": "delayed"}})
    # Keep the old WAL writer open: choosing an empty new file would lose this data.
    assert default_db_path(state) == old.db_path
    reopened = ScenarioRepository(default_db_path(state))
    record = reopened.load("retained")
    assert record and record.state["flight_states"]["2291"] == "delayed"
    reopened.close()
    old.close()
print("PASS: new Olus database and existing scenario/WAL compatibility")
