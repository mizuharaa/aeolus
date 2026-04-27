"""Quick end-to-end smoke test for the Aeolus simulator without HTTP."""
import asyncio
import sys
sys.path.insert(0, ".")

from src.main import _load_network
from src.simulator.engine import SimulationEngine
from src.predictor.cascade import CascadePredictor
from src.optimizer.milp import RecoveryOptimizer
from src.weather.client import WeatherClient


async def main() -> None:
    flights, aircraft, crews = _load_network()
    print(f"Loaded network: {len(flights)} flights, {len(aircraft)} aircraft, {len(crews)} crew pairings")

    engine = SimulationEngine(flights, aircraft, crews)
    predictor = CascadePredictor()
    optimizer = RecoveryOptimizer(timeout_secs=10, use_fallback=True)
    weather = WeatherClient()
    print("All components instantiated")

    event = {
        "kind": "weather_closure",
        "params": {"airport": "KORD", "severity": "severe", "duration_hours": 4},
    }
    result = await engine.trigger_event(event, predictor, optimizer, weather)

    cs = result["cascade_summary"]
    print(f"Cascade: direct={cs['directly_affected']}, c1={cs['cascade_1']}, c2={cs['cascade_2']}, total={cs['total_affected']}")

    for p in result["recovery_plans"]:
        print(
            f"  Plan {p['plan_id']} [{p['objective_label']}]: "
            f"status={p['status']}, cancelled={len(p['cancelled_flights'])}, "
            f"delayed={len(p['delayed_flights'])}, "
            f"cost=${p['total_cost_usd']:.0f}, "
            f"FAR117 violations={p['crew_violations']}"
        )

    print("END-TO-END SMOKE TEST PASSED")


if __name__ == "__main__":
    asyncio.run(main())
