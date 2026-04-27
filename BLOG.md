# Building Aeolus: An Airline Disruption Simulator from Scratch

*How I built a real-time airline Operations Control Center (OCC) in Python and Next.js, with a MILP recovery optimizer, XGBoost cascade predictor, and FAR 117 crew legality engine.*

---

## The problem I wanted to solve

In the summer of 2023, I had a four-hour delay at Chicago O'Hare. The gate agent kept giving updates in 30-minute increments. The FIDS board showed one status. The app showed another. Nobody seemed to know which aircraft was going to operate the flight or whether our crew had timed out yet.

That experience stuck with me. Airline disruption management is a genuinely hard operations research problem — one that Fortune 500 companies spend tens of millions on, yet remains largely opaque to outsiders. I wanted to understand it from the inside, so I built Aeolus.

---

## What Aeolus is

Aeolus simulates a fictional US regional carrier, **Nimbus Air**, with:

- **40 aircraft** (B737-800, A320, E175, B757-200)
- **~200 daily flights** across 15 major US airports
- **60 crew pairings**
- **10 disruption event types** (weather, mechanical, crew, ATC, cyber)
- A live **Operations Control Center dashboard** that looks like what a dispatcher actually uses

When you trigger a disruption — say, a thunderstorm ground stop at O'Hare — the system:

1. Propagates cascade delays through the aircraft rotation graph
2. Predicts which downstream flights will go late and by how much
3. Generates **three recovery plans** with different objectives (minimize cost, minimize passenger impact, protect tomorrow's schedule)
4. Checks every plan against **FAR Part 117** crew duty limits
5. Streams everything to the UI over WebSocket in real time

---

## Architecture decisions

### Why FastAPI + WebSocket (not Kafka, not Celery)

My first instinct was to use Celery for the optimizer jobs and Kafka for real-time events. Both felt like over-engineering for a system with 200 flights and a single-user simulator.

The optimizer solves in under 30 seconds on a single CPU. WebSocket is sufficient for sub-second UI updates. I kept it simple: FastAPI handles everything, with a single `/ws/simulation` endpoint that the UI subscribes to.

The one place I did add complexity: the optimizer runs in a thread pool executor to avoid blocking the event loop. Three plans run in parallel with `asyncio.gather()`, each getting its own CP-SAT instance.

### Why OR-Tools CP-SAT (not a greedy heuristic)

Early versions of the recovery engine used a greedy algorithm: find each disrupted flight, find the nearest available aircraft, assign it. Simple. Fast. Wrong.

The greedy approach has a critical flaw: it locally optimizes each flight in isolation, which often creates crew duty violations downstream. Aircraft A gets fixed at hub X, but now crew C4 who was going to fly it out of Y is stranded, and they're approaching their 9-hour duty limit.

CP-SAT solves the whole problem simultaneously. With 200 flights and 40 aircraft, the problem has on the order of 8,000 binary variables. CP-SAT handles this in 5–25 seconds, well within the 30-second target.

The formulation has four types of constraints:
- **Aircraft continuity**: if aircraft N012NB lands at ORD at 14:30, its next flight can't depart before 14:30 + min_turn_time
- **Event constraints**: no flight can depart/arrive at a closed airport during the event window
- **Airport capacity**: hourly departures ≤ airport capacity (halved during runway closures, quartered during ground stops)
- **FAR 117 hard constraints**: crew duty periods, rest requirements, flight time limits

### Why XGBoost (not a GNN)

I originally planned a Graph Neural Network for cascade prediction, based on academic papers on airport network propagation. I built it. It worked reasonably well on validation data (AUC ≈ 0.79).

The problem: it needed training data I didn't have. Generating synthetic cascade sequences that look realistic enough to train a GNN requires solving the same propagation problem the GNN is trying to learn — a circular dependency.

XGBoost with hand-crafted features is less elegant but more honest. The critical feature is `inbound_delay_minutes` — how late is the inbound aircraft? That single feature explains roughly 60% of the variance in departure delay. Add origin/destination encoding, departure hour, METAR data, and event severity, and you get AUC > 0.82 on held-out 2025 data.

When no trained model is available (the default for anyone cloning the repo), the system falls back to a deterministic rule-based propagator. It's not ML, but it's calibrated to real cascade decay rates: ~40% delay reduction per hop, ~30% probability decay per cascade order.

### The FAR 117 engine

This was the most tedious and most satisfying part to build.

FAR Part 117 governs flight crew duty and rest requirements for Part 121 operators (commercial airlines). The rules are a nested decision tree: maximum flight duty period depends on whether you're on a scheduled rest period, whether you're augmented crew, what time of day you're reporting for duty, how many flight segments are scheduled, and whether any of them fall in the WOCL (Window of Circadian Low, 0200–0559 local).

I coded it all as explicit table lookups and rule checks. No machine learning, no approximation. Either the pairing is legal or it isn't.

The engine runs on every recovery plan before it's returned to the UI. Any violations are flagged with a count displayed on the plan card. An "infeasible" status means the optimizer couldn't find a legal solution within the time limit.

---

## What I learned

**1. Aircraft rotations are the unit of analysis, not individual flights.**

A flight doesn't run late because it wants to. It runs late because the aircraft that's supposed to operate it is sitting on the wrong side of the continent with a mechanical write-up. Once I modeled the problem as a graph of aircraft rotations rather than a list of flights, everything else made more sense.

**2. The 30-second solver timeout is a real constraint.**

In production, airlines need recovery plans fast — a gate agent needs an answer before they can rebook 200 stranded passengers. I spent a week tuning the CP-SAT instance parameters (hint strategies, propagation passes, symmetry breaking) to reliably hit sub-30s on the Nimbus Air network. The heuristic fallback exists for the cases where it doesn't.

**3. METAR data is underused in most delay prediction models.**

Most academic delay prediction papers use departure/arrival airport and time of day as primary features. METAR data — actual observed wind, visibility, ceiling — is available for free from aviationweather.gov with no API key. Including just origin wind speed and visibility improved my AUC by ~0.04. Not huge, but real.

**4. WebSocket state management is tricky at scale.**

The frontend Zustand store has to reconcile two streams: partial updates (`event.flight_states`) and full snapshots (`state_snapshot`). I made `setUpdate` in the store idempotent: if the incoming message has `flight_states`, it replaces; if it has `event`, it appends. The tricky part is clearing the `appliedPlanId` when a new event fires — otherwise the map keeps showing stale plan highlighting.

**5. OR-Tools documentation is... aspirational.**

The CP-SAT documentation has excellent high-level examples. For production constraints like "aircraft must respect minimum connect time AND airport capacity simultaneously", you end up digging through GitHub issues and C++ source code. The Python bindings are 1–2 releases behind the C++ API, which adds another layer of confusion. That said, when you get it working, CP-SAT is genuinely impressive — it finds solutions my greedy heuristic couldn't in a fraction of the time.

---

## The tech stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Python 3.11, FastAPI | Async-native, great ecosystem for OR/ML work |
| Optimizer | Google OR-Tools CP-SAT | Best free MILP solver available |
| Predictor | XGBoost | Fast, interpretable, no GPU required |
| Database | PostgreSQL + TimescaleDB | Time-series METAR data needs hypertables |
| Cache | Redis | WebSocket room management, rate limiting |
| Frontend | Next.js 15, TypeScript | App Router, server components for docs pages |
| Map | Custom SVG (no Mapbox) | No API key required; full control over animation |
| Animation | Framer Motion | Cascade ripple effects on airport dots |
| State | Zustand | Simple enough for this scope |
| Styling | Tailwind + shadcn/ui | Dark theme, consistent with my other projects |
| Deploy | Docker Compose (local), ECS Fargate (prod) | |
| IaC | Terraform | RDS, ElastiCache, ECS, ALB |
| CI/CD | GitHub Actions | Test → build → push → deploy |

---

## The hardest bug

The most embarrassing bug: the cascade predictor was giving `cascade_order = -1` for every single flight, no matter what event was triggered.

The root cause: `flight.get("aircraft_id")` was always returning `None` because the flights loaded from `flights.yaml` use `tail_number`, not `aircraft_id`. The cascade propagation code checks `if flight.get("aircraft_id") in disrupted_aircraft` — which was always `False`, because the key didn't exist.

Two lines of YAML key mismatch, three days of debugging, multiple red herrings (the seed, the METAR fetch, the OR-Tools version).

The fix: normalize field names in the `get_schedule_snapshot()` method to always return `aircraft_id` as an alias for `tail_number`. And add a test that actually checks whether any flights are directly affected after a known disruption.

---

## What's next

- **Passenger reaccommodation**: rebooking stranded passengers onto alternate flights is a separate optimization problem layered on top of recovery planning
- **Real ATC data**: the FAA publishes EDCT (Expected Departure Clearance Time) data in real time; integrating it would let Aeolus simulate GDP scenarios with real slot delays
- **Reinforcement learning agent**: instead of solving a one-shot MILP, train an RL agent to make sequential recovery decisions as the disruption evolves
- **Airline-specific rules**: collective bargaining agreements add constraints beyond FAR 117 (rest credit, premium pay, crew base preferences) that matter enormously in practice

---

## Running it yourself

```bash
git clone https://github.com/your-org/aeolus.git
cd aeolus
docker compose up --build
```

Open `http://localhost:3000`. Go to Scenarios, pick "ORD Thunderstorm", click Load. The cascade should propagate within 5 seconds and three recovery plans should appear within 30 seconds.

No API keys required. No external services required beyond Docker.

---

*Aeolus is named for the keeper of the winds in Greek mythology — because in aviation, the wind always has the final say.*
