# Aeolus — Airline Disruption Simulation & Recovery Engine

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![OR-Tools](https://img.shields.io/badge/OR--Tools-9.10-4285F4?logo=google&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![TimescaleDB](https://img.shields.io/badge/TimescaleDB-2.x-FDB515?logo=timescale&logoColor=black)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## The Problem

Airline operational disruptions — weather, mechanical failures, crew duty limits, and ATC ground stops — cost the global aviation industry an estimated **$34 billion per year**. When a single hub airport closes for three hours, the ripple effect can ground hundreds of flights, strand thousands of passengers, and cascade crew duty-time violations across an entire network for days.

Traditional airline operations control (AOC) systems rely on manual recovery decisions made under extreme time pressure with incomplete information. Dispatchers juggle spreadsheets, phone calls, and aging ARINC-linked terminals to reassign aircraft, reroute crews, and reaccommodate passengers — often optimising one constraint while unknowingly violating another.

**Aeolus** gives operations engineers, researchers, and airline strategists a platform to:

- **Simulate** realistic disruption scenarios across a full flight network
- **Predict** cascade failures before they propagate
- **Optimise** recovery plans that satisfy FAR 117 crew-duty regulations and MILP cost objectives simultaneously
- **Replay** historical events to validate recovery strategies

---

## Architecture

```
+---------------------------------------------------------------+
|                        Browser / Client                        |
|                  Next.js 14 (App Router, TypeScript)           |
|           Mapbox GL JS  |  Recharts  |  Zustand  |  TanStack  |
+---------------------------+-----------------------------------+
                            |  REST + WebSocket (WS)
+---------------------------v-----------------------------------+
|                      FastAPI (Python 3.12)                     |
|                                                                |
|   /api/v1/flights     /api/v1/disruptions  /api/v1/optimizer  |
|   /api/v1/crew        /api/v1/weather      /api/v1/simulate   |
|                                                                |
|  +------------------+  +----------------+  +--------------+   |
|  | Disruption Engine|  | FAR 117 Engine |  | MILP Solver  |   |
|  | (10 event types) |  | (duty limits)  |  | (OR-Tools)   |   |
|  +------------------+  +----------------+  +--------------+   |
|                                                                |
|  +------------------+  +----------------+  +--------------+   |
|  | Cascade Predictor|  | Weather Ingest |  | Heuristic    |   |
|  | (GNN / sklearn)  |  | (awy.gov METAR)|  | Fallback     |   |
|  +------------------+  +----------------+  +--------------+   |
+-------+---------------+---------------+------+----------------+
        |               |               |      |
+-------v----+  +-------v----+  +-------v----+ |
| PostgreSQL |  |  Redis 7   |  |  S3 / FSx  | |
| 16 +       |  | Streams /  |  | (model     | |
| TimescaleDB|  | Pub-Sub /  |  | artifacts) | |
| (timeseries|  | Rate-limit |  |            | |
|  METAR,    |  +------------+  +------------+ |
|  positions)|                                 |
+------------+      AWS Cognito (auth) <--------+
```

---

## Features

### Disruption Simulation (10 Event Types)

| Event Type | Description |
|---|---|
| `WEATHER_GROUND_STOP` | ATC-issued ground stop due to destination weather |
| `WEATHER_DIVERT` | En-route diversion to alternate airport |
| `MECHANICAL_AOG` | Aircraft-on-ground — unscheduled maintenance |
| `MECHANICAL_DELAY` | Maintenance delay with probabilistic duration |
| `CREW_ILLEGALITY` | FAR 117 duty-time violation detected pre-departure |
| `CREW_NOSHOW` | Flight crew fails to report for duty |
| `ATC_GROUND_DELAY` | GDP / EDCT slot delays at congested TRACON |
| `AIRPORT_CLOSURE` | Temporary runway / airport closure |
| `CREW_REASSIGN` | Recovery event: crew swap between flights |
| `AIRCRAFT_SWAP` | Recovery event: tail swap between scheduled flights |

### MILP Recovery Optimizer (OR-Tools)

- Mixed-integer linear program minimising weighted delay cost + cancellation penalty + crew disruption cost
- Hard constraints: FAR 117 rest periods, airport slot availability, aircraft type compatibility
- Soft constraints: passenger connection protection, hub bank integrity
- Configurable solver timeout with automatic heuristic fallback
- Multi-scenario parallel solve via Python multiprocessing

### Cascade Predictor

- Graph Neural Network (GNN) trained on historical disruption sequences
- Predicts probability of secondary and tertiary disruptions within a 6-hour window
- Airport hub centrality features derived from schedule graph
- Outputs ranked list of at-risk flights with confidence scores

### FAR 117 Duty-Time Engine

- Full implementation of FAR Part 117 rest and duty-limit tables
- Tracks Cumulative Flight Time Limitations (CFTL): 100 hr/28 days, 1,000 hr/365 days
- Augmented crew detection and reduced-rest provisions
- Real-time legality checks integrated into the MILP constraint layer

### Live Weather Integration

- METAR / TAF ingestion from aviationweather.gov (no API key required)
- SIGMET / AIRMET polygon overlay on the live map
- Automated weather-triggered disruption injection into running simulations
- TimescaleDB continuous aggregates for weather trend queries

---

## Quick Start

### Prerequisites

- Docker >= 24.0
- Docker Compose >= 2.20
- Git

### 1. Clone the repository

```bash
git clone https://github.com/your-org/aeolus.git
cd aeolus
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env — at minimum set MAPBOX_TOKEN and JWT_SECRET
```

### 3. Start the full stack

```bash
docker compose up --build
```

Services will start in dependency order:
1. PostgreSQL 16 + TimescaleDB (port 5432)
2. Redis 7 (port 6379)
3. FastAPI backend (port 8000) — runs Alembic migrations on startup
4. Next.js frontend (port 3000)

### 4. Access the application

| Service | URL |
|---|---|
| Web UI | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| API docs (ReDoc) | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |
| Health check | http://localhost:8000/health |

### 5. Seed sample data (optional)

```bash
docker compose exec aeolus-api python -m aeolus.scripts.seed_demo
```

This loads a US domestic schedule with ~1,200 daily flights across 30 airports, 80 aircraft, and 400 crew pairings.

### Local Development (without Docker)

```bash
# Backend
cd apps/api
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn aeolus.main:app --reload --port 8000

# Frontend (separate terminal)
cd apps/web
npm install
npm run dev
```

---

## API Documentation

### Core Resources

#### Flights

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/flights` | List flights with filters (date, airport, status) |
| GET | `/api/v1/flights/{id}` | Get single flight detail |
| PATCH | `/api/v1/flights/{id}/status` | Update flight operational status |
| GET | `/api/v1/flights/{id}/connections` | Downstream connections at risk |

#### Disruptions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/disruptions` | List active and historical disruptions |
| POST | `/api/v1/disruptions` | Inject a new disruption event |
| GET | `/api/v1/disruptions/{id}` | Get disruption detail with cascade predictions |
| POST | `/api/v1/disruptions/{id}/resolve` | Mark disruption resolved |

#### Optimizer

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/optimizer/solve` | Submit recovery optimisation request |
| GET | `/api/v1/optimizer/jobs/{job_id}` | Poll async job status |
| GET | `/api/v1/optimizer/jobs/{job_id}/solution` | Retrieve optimised recovery plan |
| POST | `/api/v1/optimizer/jobs/{job_id}/apply` | Apply solution to live schedule |

#### Crew

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/crew` | List crew members with current duty state |
| GET | `/api/v1/crew/{id}/legality` | FAR 117 legality check for proposed assignment |
| GET | `/api/v1/crew/{id}/pairings` | Scheduled and modified pairings |

#### Simulation

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/simulate` | Run Monte Carlo disruption simulation |
| GET | `/api/v1/simulate/{run_id}` | Poll simulation progress |
| GET | `/api/v1/simulate/{run_id}/results` | Download simulation results |

#### Weather

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/weather/metars` | Current METARs for monitored airports |
| GET | `/api/v1/weather/tafs/{icao}` | TAF for a specific airport |
| GET | `/api/v1/weather/sigmets` | Active SIGMETs and AIRMETs |

### WebSocket Events

Connect to `ws://localhost:8000/ws/events` to receive real-time updates:

```json
{
  "type": "FLIGHT_STATUS_UPDATE",
  "payload": {
    "flight_id": "AA1234",
    "previous_status": "ON_TIME",
    "new_status": "DELAYED",
    "delay_minutes": 47,
    "cause": "WEATHER_GROUND_STOP",
    "timestamp": "2024-12-01T14:32:00Z"
  }
}
```

Event types: `FLIGHT_STATUS_UPDATE`, `DISRUPTION_CREATED`, `DISRUPTION_RESOLVED`, `OPTIMIZER_JOB_COMPLETE`, `CREW_ILLEGALITY_DETECTED`, `WEATHER_ALERT`

---

## Tech Stack

### Backend

| Component | Technology | Purpose |
|---|---|---|
| Language | Python 3.12 | Core runtime |
| Web framework | FastAPI 0.111 | REST API + WebSocket server |
| ASGI server | Uvicorn + Gunicorn | Production HTTP server |
| ORM | SQLAlchemy 2.0 (async) | Database access layer |
| Migrations | Alembic | Schema version control |
| Data validation | Pydantic v2 | Request/response models |
| Task queue | Celery + Redis | Async background jobs |
| Optimiser | Google OR-Tools 9.10 | MILP solver |
| ML framework | scikit-learn + PyTorch | Cascade predictor |
| Serialisation | msgpack | High-throughput event streaming |

### Database & Storage

| Component | Technology | Purpose |
|---|---|---|
| Primary DB | PostgreSQL 16 | Relational data, schedules, crew |
| Time-series ext | TimescaleDB 2.x | METAR history, position tracks |
| Cache / Streams | Redis 7 | Pub/sub, rate limiting, job cache |
| Object storage | AWS S3 | Model artifacts, simulation exports |
| Search | PostgreSQL FTS | Flight/airport full-text search |

### Frontend

| Component | Technology | Purpose |
|---|---|---|
| Framework | Next.js 14 (App Router) | React server components + SSR |
| Language | TypeScript 5 | Type safety |
| Map | Mapbox GL JS 3 | Live flight map |
| Charts | Recharts 2 | Disruption analytics |
| State | Zustand 4 | Global client state |
| Server state | TanStack Query 5 | API data fetching + caching |
| Styling | Tailwind CSS 3 | Utility-first CSS |
| Components | shadcn/ui | Radix UI primitives |
| Forms | React Hook Form + Zod | Validated forms |
| Real-time | Native WebSocket | Event stream display |

### Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Containerisation | Docker + Compose | Local and CI environments |
| IaC | Terraform | AWS ECS / RDS / ElastiCache |
| CI/CD | GitHub Actions | Lint, test, build, deploy |
| Monitoring | Prometheus + Grafana | Metrics + dashboards |
| Tracing | OpenTelemetry + Jaeger | Distributed tracing |
| Logging | structlog + CloudWatch | Structured log aggregation |
| Secrets | AWS Secrets Manager | Production secret rotation |

---

## Project Structure

```
aeolus/
├── apps/
│   ├── api/                       # FastAPI backend
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── alembic/               # Database migrations
│   │   └── aeolus/
│   │       ├── main.py            # FastAPI application entry point
│   │       ├── core/              # Config, auth, DB session
│   │       ├── models/            # SQLAlchemy ORM models
│   │       ├── schemas/           # Pydantic request/response schemas
│   │       ├── api/v1/            # Route handlers
│   │       ├── services/          # Business logic layer
│   │       ├── disruption/        # Disruption event engine
│   │       ├── optimizer/         # OR-Tools MILP + heuristics
│   │       ├── far117/            # FAR Part 117 duty-time engine
│   │       ├── predictor/         # Cascade GNN predictor
│   │       ├── weather/           # METAR / TAF / SIGMET ingest
│   │       ├── simulation/        # Monte Carlo engine
│   │       └── scripts/           # Seed data, utilities
│   └── web/                       # Next.js 14 frontend
│       ├── Dockerfile
│       ├── package.json
│       ├── next.config.ts
│       └── src/
│           ├── app/               # App Router pages & layouts
│           ├── components/        # Shared UI components
│           ├── features/          # Feature-sliced modules
│           │   ├── map/           # Live flight map
│           │   ├── disruptions/   # Disruption board
│           │   ├── optimizer/     # Recovery plan viewer
│           │   ├── crew/          # Crew duty timeline
│           │   └── simulation/    # Simulation runner
│           ├── lib/               # API client, WS hook, utils
│           └── store/             # Zustand global stores
├── infra/
│   ├── db/
│   │   └── init.sql               # TimescaleDB hypertable setup
│   └── terraform/                 # AWS ECS + RDS + ElastiCache
├── packages/
│   └── shared-types/              # Shared TypeScript types (monorepo)
├── tests/
│   ├── integration/               # Pytest + HTTPX async tests
│   └── e2e/                       # Playwright end-to-end tests
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Screenshots

> Screenshots will be added as the UI stabilises.

| View | Description |
|---|---|
| Live Map | Real-time flight positions with disruption overlays and weather polygons |
| Disruption Board | Kanban-style board of active, predicted, and resolved disruptions |
| Recovery Plan | Side-by-side original vs. optimised schedule with cost breakdown |
| Crew Timeline | Gantt view of crew pairings with FAR 117 duty bars |
| Simulation Runner | Monte Carlo configuration panel and results histogram |

---

## Development

### Running Tests

```bash
# Backend unit + integration tests
cd apps/api
pytest --cov=aeolus --cov-report=html -v

# Frontend unit tests
cd apps/web
npm run test

# End-to-end tests (requires running stack)
cd tests/e2e
npx playwright test
```

### Linting & Formatting

```bash
# Python
ruff check apps/api/
ruff format apps/api/
mypy apps/api/aeolus/

# JavaScript / TypeScript
cd apps/web
npm run lint
npm run type-check
```

### Database Migrations

```bash
# Generate a new migration
docker compose exec aeolus-api alembic revision --autogenerate -m "add crew rest table"

# Apply migrations
docker compose exec aeolus-api alembic upgrade head

# Rollback one migration
docker compose exec aeolus-api alembic downgrade -1
```

### Adding a New Disruption Event Type

1. Add the event constant to `apps/api/aeolus/disruption/event_types.py`
2. Implement the event handler in `apps/api/aeolus/disruption/handlers/`
3. Register the handler in `apps/api/aeolus/disruption/registry.py`
4. Add the event type to the Pydantic schema in `apps/api/aeolus/schemas/disruption.py`
5. Write handler unit tests in `tests/unit/disruption/`

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository and create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Ensure all tests pass and linting is clean before opening a PR.

3. Follow the existing code style:
   - Python: PEP 8, typed (mypy strict), docstrings on public APIs
   - TypeScript: strict mode, no `any`, JSDoc on exported functions

4. Write or update tests for any changed behaviour.

5. Keep PRs focused — one logical change per pull request.

6. Update `CHANGELOG.md` under the `[Unreleased]` section.

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(optimizer): add augmented-crew FAR 117 path
fix(weather): handle malformed METAR station codes
docs(api): document /crew/legality endpoint
chore(deps): bump OR-Tools to 9.10
```

---

## Roadmap

- [ ] Passenger reaccommodation optimiser (rebooking cost minimisation)
- [ ] ATC slot credit trading simulation
- [ ] Integration with FlightAware AeroAPI for live position data
- [ ] Reinforcement learning agent for sequential recovery decisions
- [ ] Airline-specific rule engine (CBA provisions, bidline constraints)
- [ ] Multi-airline codeshare disruption propagation
- [ ] iOS / Android companion app for crew self-service

---

## License

MIT License — Copyright (c) 2025 Aeolus Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

*Named after Aeolus, keeper of the winds in Greek mythology — because in aviation, the wind always has the final say.*
