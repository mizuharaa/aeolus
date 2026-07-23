<!-- hallmark: genre=technical audit · tone=evidence-led · anchor=warm-paper/ink · fingerprint=ranked failure register → target architecture → delivery roadmap -->

# Aeolus full-stack audit

**Audit date:** 2026-07-22  
**Repository:** `aeolus-work`  
**Baseline:** current working tree at `da0a125` (`chore: Persistence engineer`, 2026-07-17), including the local uncommitted changes present during the audit  
**Audit mode:** read-only inspection and verification; no application code was changed  

## Executive verdict

Aeolus is an unusually convincing **operations-research prototype** with a real FastAPI domain model, an OR-Tools recovery engine, replay-oriented tests, a visually ambitious control surface, and a deployable AWS outline. It is not yet a safe or truthful multi-user full-stack product.

The biggest problem is architectural, not cosmetic: the deployed API exposes a single anonymous, process-wide simulation to every visitor. Any visitor can mutate, reset, reseed, solve, or apply recovery actions to that shared state. That state is then partly persisted through a synchronous SQLite connection mounted on EFS, while the browser intentionally preserves stale optimistic state over authoritative empty server snapshots. This makes isolation, concurrency, recovery, auditability, and horizontal scaling unreliable.

The second release blocker is trust. Public methodology and marketing copy describe an integrated airline optimizer, XGBoost prediction, Postgres/Timescale, Redis, Fargate, specific model metrics, and customer-like outcomes that the current implementation does not provide. The actual solver is a useful cancellation/swap prototype, but several operational constraints are absent or calculated after optimization. Those claims must be narrowed immediately or the implementation must be expanded and independently validated.

**Recommendation:** treat the current build as a private, explicitly labeled research demo. Do not open mutation endpoints to public traffic or market it as operational decision support until the P0 gates below pass.

## Release-readiness scorecard

| Area | Score | Release assessment |
|---|---:|---|
| Domain concept and demo value | 4/5 | Strong idea, credible event catalog, useful recovery narrative |
| Core optimization correctness | 2/5 | Real CP-SAT work, but narrower than claimed and missing integrated feasibility constraints |
| Data/state integrity | 1/5 | Shared singleton, weak transaction boundaries, stale optimistic client state |
| Security and tenant isolation | 0/5 | No auth/security scheme; public destructive and compute-heavy routes |
| API and contract quality | 2/5 | Clear route organization, but contract drift and one confirmed fleet-route break |
| Frontend product quality | 3/5 | Impressive desktop presentation; loading, mobile, accessibility, and state failure modes need work |
| Test confidence | 2/5 | 116 API tests pass; only 38% API coverage and no frontend test layer |
| Deployment and operations | 2/5 | Useful Terraform baseline; single host/task, mutable releases, no rollback or readiness discipline |
| Legal, privacy, and claims | 1/5 | License/version/privacy/product claims contradict repository behavior |
| Overall public-production readiness | **1.7/5** | **No-go** |

## What is already working well

- The API test suite is fast and deterministic: **116/116 tests passed**. Golden replay and cascade behavior provide a good base for stronger regression testing.
- The recovery engine is not a mock. It contains meaningful OR-Tools CP-SAT modeling, event application, cost decomposition, and scenario mechanics.
- The repository has a coherent monorepo layout, typed TypeScript, Ruff/mypy discipline, non-root containers, an AWS OIDC deployment path, ECR scanning, and IMDSv2 enforcement.
- The web production build succeeds, reduced-motion behavior is present, and the simulator has substantially more information density than a generic dashboard.
- The design concept—warm operational paper, ink, and controlled semantic pigments—is distinctive enough to become a strong product identity once the competing token systems and decorative patterns are removed.

These strengths justify hardening the existing codebase rather than rebuilding it from scratch.

## Ranked failure register

Priority means release impact, not just implementation difficulty.

| Rank | ID | Priority | Failure | Why it matters | First corrective move |
|---:|---|---|---|---|---|
| 1 | AEO-001 | P0 | Anonymous users share and mutate one global engine | Cross-user data corruption, denial of service, no tenant boundary | Put mutations behind identity and create isolated workspace/scenario/run records |
| 2 | AEO-002 | P0 | Solver and ML claims exceed implementation | Unsafe recommendations and material credibility risk | Publish an implementation-backed capability matrix; label the current engine as a prototype scorer |
| 3 | AEO-003 | P0 | Non-transactional concurrent state plus SQLite-on-EFS | Races, partial scenarios, lost updates, no safe scale-out | Move durable state to Postgres and serialize commands per run |
| 4 | AEO-004 | P0 | Privacy, license, version, metric, and trust claims conflict | Public release creates legal and buyer-trust risk | Establish one claims/license/version source of truth and remove invented proof points |
| 5 | AEO-005 | P1 | Client rejects authoritative empty server state | Reset/restart/apply failures leave a false UI | Replace merge heuristics with revisioned authoritative snapshots and rollback |
| 6 | AEO-006 | P1 | Fleet API route is broken | Core simulator metadata returns 404 | Align `/aircraft` naming and add a web-to-API contract test |
| 7 | AEO-007 | P1 | No API/WS abuse controls or web security headers | Public relay and solver can be abused; browser defenses are weak | Add auth, origin checks, rate/body/connection limits, CSP/HSTS/nosniff |
| 8 | AEO-008 | P1 | Solver blocks the async event loop | One solve can stall health, API, and websocket work | Run solver jobs in a worker queue; use `to_thread` only as an interim patch |
| 9 | AEO-009 | P1 | No frontend tests; backend route/WS coverage is near zero | Critical regressions are invisible to CI | Add Playwright, component/contract tests, and integration tests around mutation and concurrency |
| 10 | AEO-010 | P1 | Production dependency and lockfile discipline is weak | Known advisories and non-reproducible Python deploys | Commit a supported lockfile/SBOM and remove runtime `shadcn` tooling |
| 11 | AEO-011 | P1 | Deployment is single-host, mutable, and non-atomic | Downtime and difficult rollback during failure | Deploy immutable digests/task revisions with circuit breaker, smoke gate, and rollback |
| 12 | AEO-012 | P1 | Simulator blocks up to 14 seconds on optional live data | The product looks down when an upstream feed is slow or empty | Render the OCC shell immediately and progressively hydrate live flights |
| 13 | AEO-013 | P2 | Mobile simulator overflows and key accessibility semantics are absent | Excludes keyboard, screen-reader, and small-screen use | Responsive workbench mode, landmarks, labels, dialog focus trap, contrast pass |
| 14 | AEO-014 | P2 | Three competing design systems and many raw colors | Visual drift, inaccessible states, slow iteration | Generate all web tokens from `design.md`; ban raw semantic color literals |
| 15 | AEO-015 | P2 | Observability and health checks are superficial | Failures cannot be detected, explained, or recovered quickly | Readiness checks, structured tracing, metrics, alarms, longer log retention |
| 16 | AEO-016 | P2 | Duplicate route/data logic and static cache behavior | Inconsistent FAA/NWS/prediction results and stale data | Centralize adapters server-side and version/cache responses explicitly |
| 17 | AEO-017 | P2 | Large client modules and widespread `any` | High change risk and expensive rendering/debugging | Split by domain boundary and generate shared API types |
| 18 | AEO-018 | P3 | Landing motion, canvases, fonts, and ornamental UI are overused | Dilutes product credibility and performance | Keep one signature visual; replace the rest with evidence-rich product UI |

## P0 — public-release blockers

### AEO-001 — the application is one anonymous shared simulation

**Evidence**

- `apps/api/aeolus_api/main.py:227-238` installs one `app.state.engine` for the entire process.
- The generated OpenAPI document has no security schemes. Fourteen state-changing endpoints are public, including event deletion/triggering, recovery application, solving, simulator reset/reseed, scenario load, weather refresh, and stress/cascade playtests.
- `apps/api/aeolus_api/main.py:326-328` and `apps/api/aeolus_api/ws/handlers.py:49-65` accept websocket connections without authentication, authorization, origin validation, or a workspace/run boundary.
- The same singleton supplies events, recovery plans, flight state, and websocket snapshots to all connected browsers.

**Failure mode**

Visitor A can reset or apply a plan while visitor B is evaluating a different disruption. A scripted anonymous client can repeatedly run the optimizer or stress tests. There is no owner, organization, immutable command log, idempotency key, or safe way to answer who changed a plan.

**Required change**

1. Separate the public demo from the product API. The demo should be read-only or receive an isolated, short-lived sandbox with strict quotas.
2. Add identity, organization membership, and RBAC. Suggested roles: viewer, dispatcher, optimizer, administrator.
3. Make `workspace_id`, `scenario_id`, and `run_id` mandatory resources, derived from the authenticated principal rather than trusted request fields.
4. Require idempotency keys for event creation, solve, apply, reset, and external-ingestion commands.
5. Authorize websocket subscription to a specific run and reject invalid `Origin`, oversized messages, excess connections, and slow consumers.
6. Record every command and resulting state revision in an append-only audit log.

**Acceptance gate:** two organizations can run simultaneous conflicting scenarios under load without observing, changing, or subscribing to each other's data; anonymous clients cannot reach mutation or expensive-compute routes.

### AEO-002 — optimizer and model claims are not implementation-backed

**Evidence**

- `apps/web/app/docs/page.tsx:107-179` describes three recovery plans and decision variables/constraints for operation, delay, aircraft, crew, continuity, FAR 117, capacity, closures, and crew legality.
- `apps/api/aeolus_api/optimizer/milp.py:111-122` explicitly describes the present decision space as cancellation and swap; delay is a fixed predicted input. The model construction at `:260-283` creates cancellation variables and AOG-related swaps, not the full advertised network model.
- Crew legality is evaluated after the solve at `milp.py:641-655`; `crew_reassignments` remains empty. The counting path at `:681-745` uses placeholder-like accumulated duty/rest values rather than an authoritative crew roster and pairing model.
- Spare aircraft can be selected without a complete time/position/type/availability network.
- `apps/api/aeolus_api/main.py:195` initializes `CascadePredictor()` without a trained model. The predictor describes a deterministic physics path with optional XGBoost, while `apps/web/app/docs/page.tsx:194-245` presents XGBoost performance and training claims as current capability.
- The methodology page at `apps/web/app/docs/page.tsx:347-370` says Postgres 16/Timescale, Redis 7, XGBoost, Fargate, and an SVG map. The repository currently uses SQLite/in-memory state, no Redis, an EC2-backed ECS service, and Leaflet.

**Failure mode**

A returned low-cost plan may violate an airport, aircraft, crew, time, or network constraint that is not in the objective model. A buyer or evaluator cannot distinguish implemented behavior from roadmap language. Specific AUC, MAE, latency, savings, and cancellation claims are not reproducibly connected to a versioned dataset and benchmark.

**Required change**

- Immediately publish a generated capability matrix with four states: implemented, post-solve diagnostic, simulated, and planned. Use it to drive docs and UI labels.
- Rename current outputs to “prototype recovery options” and show a prominent “not operationally validated” boundary until the validator passes.
- Implement an independent feasibility validator before expanding the optimizer. A plan should fail closed if aircraft continuity, maintenance/AOG, airport closures/capacity, minimum turn, time propagation, passenger capacity, crew legality, or data completeness cannot be proven.
- Then move toward a time-expanded aircraft/flight network, interval-aware resources, delay decision variables, and real crew pairing/reassignment constraints. Keep prediction and optimization versions separately identifiable.
- Create a versioned benchmark bundle: dataset hash, train/test split, model artifact hash, solver settings, hardware, run distribution, confidence interval, and reproducible command. UI metrics must link to that evidence.

**Acceptance gate:** every public capability and metric maps to a passing automated evidence artifact; every recommended plan passes an independent feasibility validator on production-shaped fixtures.

### AEO-003 — mutations are not safely serialized or durably transacted

**Evidence**

- The engine has an `_event_lock` around only one trigger path (`apps/api/aeolus_api/simulator/engine.py:167,236-245`). Cancel, reset, reseed, apply, and unapply paths at `:382-569` mutate the same state outside that lock.
- The reset route (`apps/api/aeolus_api/routes/simulator.py:51-57`) mutates state without broadcasting a new authoritative snapshot, leaving existing websocket clients stale.
- Scenario load resets and triggers multiple events as a sequence rather than a single transactional command; a mid-sequence failure leaves a partial scenario.
- `apps/api/aeolus_api/persistence/repository.py:68-120` uses one synchronous `sqlite3` connection with `check_same_thread=False` and per-operation commits from async request paths.
- `infra/terraform/main.tf:606-643` places the SQLite file on EFS. SQLite locking/latency over a network filesystem, a process singleton, and one ECS task prevent safe horizontal scaling.

**Required change**

- Use Postgres for users, workspaces, scenarios, runs, input snapshots, commands, events, solutions, applied actions, revisions, and audit records.
- Execute state changes as serializable commands per run, using optimistic revision checks or a per-run advisory lock.
- Write the command result and an outbox event in the same transaction; publish websocket updates from the outbox through Redis/NATS/SNS+SQS or an equivalent broker.
- Store large immutable input/output artifacts in object storage, with hashes referenced from Postgres.
- Run optimization in bounded workers. Persist job state and make retries idempotent.

**Acceptance gate:** concurrency tests prove no lost update or partial scenario; process restart and task replacement preserve a consistent run; at least two API tasks can safely serve the same workspace.

### AEO-004 — product truth, privacy, and legal metadata disagree

**Evidence**

- `README.md` says there is intentionally no database/cache/queue/auth even though SQLite persistence now exists.
- `apps/web/app/privacy/page.tsx:27-45` says simulation state remains in memory or the user's session; the server can persist scenarios in SQLite.
- Cookie copy enumerates an outdated subset of keys. The current UI uses additional local/session storage for pane positions, rail state, watched flights, arrival popups, schedule/fleet/live caches, and other preferences. `apps/web/components/legal/cookie-consent.tsx:31-37` records “Accept all” or “Essential only,” but the choice does not gate any behavior or external font request.
- Repository copy identifies both MIT and Apache-2.0, but no root `LICENSE` file resolves the contradiction. API/schema/web/footer versions also disagree.
- Landing content includes precise simulated dollar, cancellation, passenger, and latency claims not derived from a visible versioned run (`four-plans.tsx`, `pricing.tsx`, `cinematic-simulator-demo.tsx`, final CTA content).
- `apps/web/components/landing/trusted-by.tsx:15,44,86` uses fictional airline names beneath “Trusted by the best”; a small illustrative footnote does not neutralize the headline.

**Required change**

- Add one root license and generate badges, terms, package metadata, API version, schema version, release UI, and footer copy from explicit release metadata.
- Create a data inventory covering server persistence, browser storage, logs, third-party fonts/maps/feeds, retention, deletion, and subprocessors; rewrite privacy/cookie notices from that inventory.
- Either implement consent gating or remove the false choice and classify only genuinely necessary storage.
- Replace all fixed outcome metrics with either live run-derived values or clearly labeled “illustrative scenario” values with scenario/version provenance.
- Remove fake trust language. Use verifiable pilots/testimonials or describe the intended user category without implying adoption.

**Acceptance gate:** legal review finds one consistent license, privacy inventory, consent behavior, version, and claim ledger; every numeric product claim is reproducible or explicitly illustrative.

## P1 — correctness, security, and delivery failures

### AEO-005 — browser state can remain confidently wrong

`apps/web/stores/simulation.ts:189-238` treats the websocket snapshot as a hint: `pickArray`, object, and record helpers refuse an authoritative empty value when the client already has data. At `:287-304`, a server `appliedPlanId: null` does not reliably clear local state. At `:367-391`, plan application is optimistic and deliberately retained after a failed request. Static schedule/fleet caches at `:317-352` have no explicit TTL or schema version.

Use a monotonic server `revision`, make complete snapshots authoritative even when empty/null, and reject out-of-order messages. Mutations should have pending/succeeded/failed state, rollback on failure, surface the error, and reconcile against the returned revision. Version and expire caches; never merge incompatible scenario/run identities.

### AEO-006 — the fleet endpoint contract is broken

The web requests `/network/aircraft` in `apps/web/app/simulator/page.tsx:136` and `components/simulator/page-shell.tsx:55`; the backend defines `/aircraft` in `apps/api/aeolus_api/routes/network.py:59` under `/api/v1`. A rendered simulator request returned 404, so fleet labels can silently degrade.

Choose one resource path, generate the client from OpenAPI, and add a contract smoke test that boots API + web and exercises every server-side proxy call. The currently unused `packages/schemas` is not a contract solution: the web does not import it and CI does not validate it.

### AEO-007 — API, websocket, relay, and browser hardening are absent

- `apps/api/aeolus_api/config.py:16,21-25,58` defaults debug on, CORS to `*`, and retains a `change-me` JWT setting even though auth is not implemented.
- `apps/api/aeolus_api/main.py:291-297` allows wildcard methods/headers. Websockets lack auth, origin, message size, connection, backpressure, and slow-send limits; broadcast is sequential at `main.py:785-800`.
- Stress, reseed, and playtest payload collections are not bounded before parsing/work begins.
- `apps/web/app/api/flights-live/route.ts:64-93` makes the OpenSky relay public whenever `OSKY_RELAY_KEY` is unset and may spend server-side OAuth quota.
- The Next response has no explicit CSP, HSTS, frame, referrer, permissions, MIME-sniffing, or cross-origin isolation policy. The inline global error suppressor in `apps/web/app/layout.tsx:33-64` also forces a CSP exception and hides some failures.

Add central principal-aware authorization, allowlisted CORS/origins, per-principal and per-IP budgets, request/body/collection/time limits, solver concurrency quotas, websocket backpressure and timeouts, proxy authentication, and structured request IDs. Add a strict nonce/hash CSP plus HSTS, `nosniff`, frame-ancestors, referrer and permissions policies. Remove global console interception; filter known extension noise only in telemetry.

### AEO-008 — expensive solving can stall the API process

`apps/api/aeolus_api/routes/recovery.py:101-108` calls synchronous `optimizer.solve` directly inside an async route. By contrast, event triggering already uses `asyncio.to_thread`. One long solve can occupy the event loop that also serves health, REST, and websocket clients.

Interim: use a bounded executor, a timeout, and a global concurrency semaphore. Product architecture: enqueue immutable solve jobs, process them in isolated workers with CPU/memory/time limits, persist progress, and stream job status. Cancellation must terminate work, not merely hide a result.

### AEO-009 — CI gives false confidence around the highest-risk surfaces

The API suite passed, but measured line coverage was **38%**. `main.py`, websocket handling, and most HTTP/live-data routes were at or near 0%; the engine measured 61% and optimizer 67%. There are no web unit, component, Playwright, visual-regression, Lighthouse, or axe tests.

The CI frontend lint command (`npx eslint . --ext .ts,.tsx --max-warnings 0`) fails under ESLint 9 because no flat `eslint.config.*` exists, and the workflow marks that step `continue-on-error: true`. `npm run lint` currently passes with one external-font warning, but Next's integrated lint path is deprecated and does not repair the CI gate.

Build the quality pyramid around actual risk:

1. Contract tests generated from OpenAPI, including the fleet route and error envelopes.
2. API integration tests with Postgres, identity, tenancy, mutations, rollback, idempotency, reconnect, and concurrent commands.
3. Property/golden tests for feasibility, cost accounting, deterministic replay, and infeasible inputs.
4. Web component tests for authoritative reconciliation and mutation rollback.
5. Playwright happy/degraded/error flows at desktop and mobile, with automated axe checks.
6. A deploy smoke suite and rollback drill. Make every gate mandatory.

### AEO-010 — dependency graph and builds are not reproducible enough

`npm audit --omit=dev` reported **8 runtime advisories (4 high, 4 moderate)**; the full graph reported 9 (5 high, 4 moderate). The runtime `shadcn` CLI dependency pulls tooling and transitive MCP/Hono/YAML/URI packages into the production graph. The project also combines React 19 with React 18 type packages and `react-leaflet` peer expectations, requiring `--legacy-peer-deps`; `eslint-config-next` trails the installed Next version.

The local Python `poetry.lock` is ignored by `.gitignore`, so clean repository/CI builds cannot reproduce the audited graph even though the Dockerfile attempts to copy a lockfile. A local environment scan found advisories, but that environment also contains undeclared residual packages, so its total must not be presented as the deploy graph. Relevant declared/transitive packages should be rescanned from a clean locked image.

Move CLI-only tools to dev dependencies, align React/type/Next/ESLint versions, remove the legacy peer bypass, commit a supported lockfile, and generate an SBOM for both images. Run `npm audit`/OSV and `pip-audit`/OSV against clean production artifacts, set a documented severity policy, and automate update PRs.

### AEO-011 — deploys are mutable and recovery is weak

`infra/terraform/main.tf:189-202` allows mutable ECR tags; Terraform defaults images to `latest` (`variables.tf:42-45`). The deploy workflow pushes SHA and `latest`, but the ECS service is force-redeployed from a task definition that references `latest`. API and web are built sequentially without an atomic release manifest, the workflow is manually triggered independently of CI, and there is no smoke/rollback gate.

The cluster is one EC2 host (`main.tf:348-377`), ECS managed scaling is disabled, desired count is 0/1, and deployment health settings at `:728-729` allow zero healthy tasks. There is no deployment circuit breaker. EFS encryption, ECR scanning, non-root containers, OIDC, and IMDSv2 are good foundations but do not provide availability.

Deploy image digests in a versioned task revision, require CI artifacts, run database migrations as an explicit compatible step, enable circuit breaker/rollback, keep at least one healthy task during rollout, and add post-deploy smoke tests. For production, use at least two tasks across availability zones and a managed relational database. Add an EFS/RDS backup and restore drill before claiming disaster recovery.

### AEO-012 — optional live data blocks the core product

`apps/web/components/simulator/dashboard-loader.tsx:29-52` holds the entire OCC behind a loader until live flights exist or a hard 14-second timer expires. The upstream relay can itself wait through long request timeouts. During browser verification with an empty/degraded ADS-B result, the shell remained blocked for roughly 14 seconds.

Render navigation, schedule, event controls, and the static scenario immediately. Load live flights as an optional panel with explicit connecting/stale/empty/rate-limited/error states, last-success time, retry, and cached fallback. No non-critical integration should control first meaningful render.

## P2 — product quality and maintainability

### Accessibility and responsive workbench

At 390 px, the simulator document measured roughly 437 px wide; navigation, reset controls, and timeline overflowed. The simulator has no `<main>` landmark and no page-level `<h1>`. One My Flights chevron control was unnamed. Dialog-like surfaces use a role/scrim but do not consistently implement `aria-modal`, focus entry/trap/return, Escape handling, or background inertness. A computed-style sampling found multiple small text pairs in the approximate **2.8–3.75:1** range, below the usual 4.5:1 target for normal text. This sampling is directional, not a substitute for axe plus human review.

Create a deliberate compact mode rather than squeezing the desktop OCC: full-screen map or primary task, bottom-sheet details, collapsible timeline, and reachable 44 px targets. Add landmarks/headings, accessible names, robust dialogs, visible focus, contrast-safe tokens, keyboard map controls or an equivalent table, screen-reader announcements for solve/apply progress, and axe gates. Reduced-motion sampling showed no continuing animation and should be preserved.

### Code shape and contracts

The source tree contains about **36,000 lines** across 78 TSX, 73 Python, and 29 TypeScript files. Several client modules exceed a practical review boundary: `flight-map.tsx` is about 1,814 lines, `event-panel.tsx` 1,361, `globals.css` 1,052, and multiple feature modules 600–840 lines. There are 68 client modules, 41 explicit TypeScript `any` patterns, and 228 raw hex occurrences outside the designated token sources.

Split stateful features by domain (map layers, selection, playback, disruptions, plan comparison, passenger impact), not by arbitrary UI fragments. Generate request/response types from OpenAPI, keep domain DTOs versioned, validate at the boundary, and remove the unused parallel schema story. Add module budgets and dependency boundaries to lint/CI.

### Data integration and cache coherence

Next's `live-status` route duplicates some backend FAA/NWS behavior and parses XML with regex/`any`. `/predict/cascade` reloads static YAML on each request and can reason about a different input set than the reseeded engine. Prediction history is partly placeholder-like. Static schedule/fleet/live caches lack a unified TTL, provenance, version, and freshness UI.

Put external adapters behind the API, normalize them into immutable source snapshots, store source/update/license/confidence metadata, and pass snapshot IDs into every prediction/solve. Use conditional requests and explicit cache policy. The UI should expose data freshness and degraded sources rather than blending stale and live data invisibly.

### Observability and service health

`/health` reports basic process/OpenSky information but does not prove persistence, broker, engine, migrations, or worker readiness. Terraform disables Container Insights, keeps logs for seven days, and defines no application alarms, tracing, WAF, or SLOs.

Separate liveness from readiness. Emit structured logs keyed by request/workspace/run/job/model/solver version, OpenTelemetry traces across web/API/worker/adapters, and RED metrics plus solver queue/runtime/timeout/infeasible rates. Define SLOs for interactive API latency, websocket freshness, solve completion, external-feed freshness, and successful deployment. Alert on symptoms, not only infrastructure state.

## Features needed for an impressive full-stack product

The product should become impressive through operational truth and collaboration, not more landing-page ornament.

| Priority | Feature | Product value | Minimum credible implementation |
|---|---|---|---|
| 1 | Organizations, workspaces, and RBAC | Makes the system safely usable by real teams | SSO/OIDC, invitations, roles, tenant-scoped queries, audit trail |
| 2 | Versioned scenario/run model | Turns a singleton demo into a real application | Immutable input snapshot, draft scenario, run/job lifecycle, revisions, clone/archive |
| 3 | Independent feasibility validator | Makes recovery advice trustworthy | Constraint-by-constraint pass/fail, blocking reasons, missing-data state, test corpus |
| 4 | Scenario builder and import | Lets operators model their own disruption | CSV/API import, schema validation, map/table editing, saved templates, provenance |
| 5 | Asynchronous solve workspace | Makes optimization reliable and understandable | Queue, progress, cancel/retry, plan comparison, run history, reproducible artifact |
| 6 | Explainable recovery plans | Converts solver output into decisions | Cost/constraint deltas, affected flights/passengers/crew, assumptions, confidence, alternatives |
| 7 | Replay and time travel | A standout demo and training feature | Immutable command/event log, scrubber, branch-from-revision, shareable read-only replay |
| 8 | Live collaborative operations | Makes the cockpit team-oriented | Presence, comments, assignments, approvals, conflict-safe updates, activity feed |
| 9 | Data-source control center | Builds operational trust | Connector status, freshness, quotas, provenance, manual override, degraded-mode controls |
| 10 | Action workflow and integrations | Bridges analysis to operations | Approval gates, export/API/webhooks, notification rules, downstream status tracking |
| 11 | Executive/post-event reporting | Demonstrates measurable value | Versioned before/after metrics, assumptions, PDF/CSV export, audit appendix |
| 12 | Admin and reliability console | Supports a paid product | tenant quotas, job diagnostics, feature flags, model rollout, retention/deletion tools |

Later, after evidence exists: billing/entitlements, enterprise SCIM, custom retention, regional residency, and model governance. These are not substitutes for solving isolation and correctness first.

## Recommended target architecture

```text
Browser / mobile web
        │
        ▼
CDN + WAF + TLS
        │
        ▼
Next.js web/BFF ───── OIDC/SSO identity
        │                    │
        └──── principal + org/workspace authorization
                             │
                             ▼
                       FastAPI command/query API
                         │       │        │
                         │       │        └── external data adapters
                         │       │             (versioned source snapshots)
                         │       ▼
                         │   Postgres
                         │   runs, revisions, audit, outbox
                         │       │
                         ▼       ▼
                    job queue / event broker
                         │       │
                         ▼       └── websocket/SSE gateway
                 isolated solver workers
                         │
                         ├── feasibility validator
                         ├── model + solver artifact registry
                         └── object storage for immutable inputs/results
```

Important boundaries:

- The API is stateless with respect to users/runs; no process-global domain engine.
- A solve consumes one immutable snapshot and produces one immutable result artifact.
- A command transaction writes state plus an outbox record; clients receive ordered revisions.
- External data is never silently “live.” Every run names the exact source snapshot it consumed.
- Prediction, optimizer, feasibility validator, and product release are independently versioned.

## Delivery roadmap

Estimates are directional for a small experienced team and assume the existing prototype is retained.

### Phase 0 — contain risk and tell the truth (1–2 weeks)

- Disable or protect public mutation, relay, playtest, stress, and solve routes.
- Give every demo visitor an isolated expiring run, or make the hosted demo read-only.
- Fix `/network/aircraft`, authoritative reset/reconciliation, mutation rollback, and the blocking loader.
- Remove/label unverified metrics, fictional trust signals, and inaccurate architecture/ML claims.
- Resolve license/version/privacy/cookie copy; commit reproducible locks.
- Repair ESLint CI, make checks mandatory, add a minimal web/API smoke test.

**Exit:** safe private beta/demo; no anonymous shared mutation; no known false product claim.

### Phase 1 — build the full-stack spine (3–5 weeks)

- OIDC identity, organizations, memberships, workspace/run authorization.
- Postgres schema and migration from singleton/SQLite state.
- Command/idempotency/revision/audit model; authoritative websocket protocol.
- Queue and isolated solver worker; job lifecycle and cancellation.
- Immutable source/result objects and data provenance.
- Integration tests for tenancy, concurrency, restart, rollback, and reconnect.

**Exit:** two+ API instances and workers can safely serve concurrent tenants with deterministic recovery.

### Phase 2 — earn decision-support credibility (4–8 weeks)

- Independent feasibility validator and blocking UI.
- Expand time/aircraft/airport/crew constraints in evidence-driven increments.
- Scenario builder/import, saved templates, run history, branching replay.
- Explainability panel, assumptions/data gaps, plan comparison, approval workflow.
- Reproducible evaluation harness and versioned public methodology.

**Exit:** every recommended action is traceable, reproducible, and validator-approved on a representative test corpus.

### Phase 3 — make it excellent in production (3–6 weeks)

- Responsive and WCAG-focused simulator pass; keyboard and screen-reader workflows.
- Collaboration, comments, assignments, notifications, exports/webhooks.
- Immutable multi-AZ deploys, rollback drills, backups/restores, capacity tests.
- SLO dashboard, tracing, alarms, security review, threat model, dependency policy.
- Landing rewrite around real workflows, real evidence, and one signature visual moment.

**Exit:** monitored production candidate with auditable security, reliability, accessibility, and model evidence.

## Hallmark product/design audit

This section applies the repository's own design contract plus the Hallmark anti-slop rubric. Counts are intentionally explicit.

### Critical

1. **Tell:** The design-contract stamp is false because three incompatible token systems follow it.  
   **Where:** `apps/web/app/globals.css:8-67`, `apps/web/lib/design-tokens.ts:25-49`, `apps/web/tailwind.config.ts:8-33`, compared with `design.md`.  
   **Severity:** critical  
   **Fix:** Generate CSS, Tailwind, chart/map, and component tokens from one contract; add a token-drift CI check.

2. **Tell:** Inter is used as the dominant visual voice, producing the generic startup-dashboard feel Hallmark warns against. It is currently contract-compliant, so the contract itself must be amended before changing it.  
   **Where:** `apps/web/app/globals.css:77-79`, `apps/web/app/layout.tsx:6-9,66-84`, `design.md`.  
   **Severity:** critical  
   **Fix:** Preserve a utilitarian UI face but choose a more ownable display/data pairing in `design.md`, then implement it consistently with a strict type scale.

3. **Tell:** Hard-coded financial, cancellation, passenger, and latency values are styled as product evidence rather than clearly identified fixtures.  
   **Where:** `apps/web/components/landing/four-plans.tsx:24-28,113`, pricing, cinematic demo, and final CTA content.  
   **Severity:** critical  
   **Fix:** Render metrics from a named scenario result with run/version provenance, or visibly mark them as illustrative fixture data.

4. **Tell:** “Trusted by the best” manufactures social proof from fictional carrier names.  
   **Where:** `apps/web/components/landing/trusted-by.tsx:15,44,86`.  
   **Severity:** critical  
   **Fix:** Remove the trust claim until verifiable users approve attribution; describe target users or research collaborators honestly.

5. **Tell:** The scenarios page uses the recognizable centered-hero plus three equal icon-above-card template instead of expressing the domain's scenario topology.  
   **Where:** `apps/web/app/scenarios/page.tsx` and its scenario card grid.  
   **Severity:** critical  
   **Fix:** Use an operational scenario library: sortable evidence-dense rows/map scope, event chain, affected assets, provenance, and a clear primary action.

6. **Tell:** The four-plan centerpiece is built from full-bleed gradients, glass cards, glowing blobs, and equal cards—the exact ornamental vocabulary the product should outgrow.  
   **Where:** `apps/web/components/landing/four-plans.tsx:3-7,75-91`.  
   **Severity:** critical  
   **Fix:** Show one authentic plan-comparison workbench with constraint deltas, causal evidence, and a decisive recommendation hierarchy.

7. **Tell:** Colored status dots are a repeated primary status language despite the design contract explicitly prohibiting them.  
   **Where:** `apps/web/components/ds/primitives.tsx:301-349`, `event-panel.tsx:436-444,715-784`, flight search, and My Flights.  
   **Severity:** critical  
   **Fix:** Replace dots with text-first status chips/icons that remain distinguishable without color and are announced accessibly.

8. **Tell:** Semantic pigments and raw color literals drift across domain components, weakening both meaning and contrast governance.  
   **Where:** 228 raw hex occurrences outside canonical global/token/config sources; largest concentrations include `flight-map.tsx` and `aircraft-cabin.tsx`.  
   **Severity:** critical  
   **Fix:** Define a small semantic palette with foreground pairs, migrate literals, and reject new raw colors in lint except documented visualization scales.

### Major

1. **Tell:** Italic display headlines turn a controlled editorial accent into a repeated AI-landing-page affectation.  
   **Where:** four-plans, hero/opening-stage, and methodology headings.  
   **Severity:** major  
   **Fix:** Use roman display type and reserve italics for genuine quotations or narrow editorial emphasis.

2. **Tell:** Nearly every section uses a numbered eyebrow, including a duplicate “05,” so navigation decoration replaces information hierarchy.  
   **Where:** landing section headers, especially pricing and trusted-by.  
   **Severity:** major  
   **Fix:** Keep numbering only where sequence is meaningful; give sections specific descriptive labels.

3. **Tell:** The footer falls back to the generic product/reference/legal column scaffold.  
   **Where:** landing footer component.  
   **Severity:** major  
   **Fix:** Make the footer compact and product-specific: release evidence, status, methodology version, contact, and necessary legal links.

4. **Tell:** Multiple cinematic canvases, atmospheric layers, and theatrical loaders compete with the actual simulator.  
   **Where:** `hero-plane-3d.tsx`, `cabin-opening.tsx`, `atmosphere.tsx`, scroll experience, and dashboard loader.  
   **Severity:** major  
   **Fix:** Keep one memorable 3D/animation signature and spend the remaining motion budget on causal state changes and direct manipulation.

5. **Tell:** Staggered fades, hover lifts, and reveal choreography are applied broadly rather than conveying state.  
   **Where:** landing/scenario cards, docs, and shared motion utilities.  
   **Severity:** major  
   **Fix:** Restrict animation to orientation, causality, and feedback; render informational content immediately.

6. **Tell:** `transition-all` makes motion behavior implicit and can animate layout/paint properties accidentally.  
   **Where:** nine occurrences across web components.  
   **Severity:** major  
   **Fix:** Name the exact transform/color/opacity properties and durations; honor reduced motion at the primitive level.

7. **Tell:** Several small text/color pairs appear below normal-text contrast targets.  
   **Where:** amber landing eyebrows, scenario badges, and muted simulator text; sampled ratios were approximately 2.8–3.75:1.  
   **Severity:** major  
   **Fix:** Define tested foreground/background pairs and run axe plus human checks over all themes/states.

8. **Tell:** The desktop OCC is squeezed rather than redesigned for mobile, causing horizontal overflow and controls that dominate the viewport.  
   **Where:** simulator at 390 px; observed document width about 437 px.  
   **Severity:** major  
   **Fix:** Create a compact task-first layout with sheets, collapsible timeline, and explicit map/table modes.

9. **Tell:** The simulator lacks core document semantics and robust dialog/control accessibility.  
   **Where:** no simulator `<main>`/`<h1>`, unnamed My Flights chevron, and dialog-like overlays without complete focus management.  
   **Severity:** major  
   **Fix:** Add landmarks/headings/names and use an accessible dialog primitive with focus entry, trap, Escape, inert background, and focus return.

### Minor

1. **Tell:** Cookie consent dominates the first mobile viewport while its two choices currently have no behavioral distinction.  
   **Where:** `apps/web/components/legal/cookie-consent.tsx`.  
   **Severity:** minor  
   **Fix:** Correct the consent model first, then use a compact non-blocking presentation for essential-only behavior.

2. **Tell:** Inter is delivered through overlapping Next/local/CDN paths, with additional Google font requests.  
   **Where:** `apps/web/app/layout.tsx:6-9,66-84`.  
   **Severity:** minor  
   **Fix:** Self-host only the chosen families/weights, subset them, preload deliberately, and remove duplicate requests.

3. **Tell:** Very small 9–11 px labels and one-size metadata treatments reduce scanability in dense simulator panels.  
   **Where:** simulator rail, event, flight, and map overlays.  
   **Severity:** minor  
   **Fix:** Establish a readable minimum metadata size and use weight/spacing before shrinking text.

**8 critical · 9 major · 3 minor**

## Verification evidence

| Check | Result | Interpretation |
|---|---|---|
| Web production build | Pass | Next 15.5.18 compiled and emitted all routes |
| Web type-check | Pass | Sequential TypeScript check passed |
| `npm run lint` | Pass with 1 warning | External font warning remains; integrated Next lint is not a future-proof gate |
| CI ESLint command | Fail | ESLint 9 flat config missing; workflow currently ignores failure |
| API `poetry check` | Pass | Package metadata parses |
| Ruff check + format check | Pass | Python lint/format baseline is clean |
| mypy | Pass | Current annotated Python paths type-check |
| pytest | **116 passed** | Strong unit/regression base |
| API coverage | **38% total** | Critical HTTP/WS/live/concurrency paths largely untested |
| `npm audit --omit=dev` | 8 advisories | 4 high, 4 moderate in the resolved production graph |
| Docker Compose config | Pass | Compose model resolves |
| Docker image build | Not run | Docker daemon was unavailable in the audit environment |
| Terraform fmt/validate | Not run | Terraform CLI was unavailable; HCL was inspected manually |
| Browser desktop/mobile pass | Findings | Confirmed 404 fleet request, delayed simulator shell, mobile overflow, semantic/accessibility gaps |
| Reduced-motion sample | Pass | No continuing sampled animations under reduced-motion preference |

Approximate source inventory: 19,199 TSX lines across 78 files; 11,442 Python lines across 73 files; 2,786 TypeScript lines across 29 files; 1,052 CSS lines; 828 Terraform lines. Generated/build/vendor directories were excluded from the code-shape assessment.

## Go/no-go gates

Aeolus is ready for a public production launch only when all of the following are true:

- [ ] Anonymous traffic cannot mutate shared state or consume unbounded relay/solver resources.
- [ ] Tenant isolation and authorization are covered by adversarial integration tests.
- [ ] Postgres-backed commands are transactional, idempotent, revisioned, and recoverable after restart.
- [ ] Optimization runs asynchronously and every displayed plan passes an independent feasibility validator.
- [ ] Public methodology, ML, performance, customer, privacy, cookie, license, and version claims match reproducible evidence.
- [ ] Web state accepts authoritative server resets/nulls and rolls back failed optimistic mutations.
- [ ] All web/API contract calls pass in an end-to-end smoke suite.
- [ ] Frontend lint, tests, accessibility checks, API integration coverage, dependency policy, and deploy smoke tests are mandatory CI gates.
- [ ] Deploys use immutable digests, maintain healthy capacity, and have a tested automatic/manual rollback path.
- [ ] Readiness, tracing, SLO metrics, alarms, backups, and restore drills cover the real persistence/worker/data dependencies.
- [ ] Mobile and keyboard/screen-reader simulator workflows pass a human accessibility review.

Until then, the correct positioning is: **a strong, explicitly illustrative airline-disruption research prototype—not a production operational-control or decision-support system.**
