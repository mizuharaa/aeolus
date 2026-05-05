"use client"
import Link from "next/link"
import { motion } from "framer-motion"
import { Plane, BarChart3, Shield, Zap, Database, Cloud } from "lucide-react"
import { Separator } from "@/components/ui/separator"

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="scroll-mt-20"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-2xl bg-ink/5 border border-ink/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-ink" />
        </div>
        <h2 className="font-display text-2xl font-medium tracking-tight">{title}</h2>
      </div>
      {children}
    </motion.section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-xl border border-border bg-secondary/50 p-4 text-xs text-muted-foreground overflow-x-auto font-mono leading-relaxed">
      {children}
    </pre>
  )
}

function TableRow({ cells }: { cells: string[] }) {
  return (
    <tr className="border-b border-border">
      {cells.map((c, i) => (
        <td key={i} className={`px-4 py-2.5 text-sm ${i === 0 ? "font-mono text-ink font-medium" : "text-muted-foreground"}`}>
          {c}
        </td>
      ))}
    </tr>
  )
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 flex justify-center pt-3 px-4">
        <nav className="w-full max-w-6xl nav-pill-surface h-12 flex items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-2xl bg-ink flex items-center justify-center">
              <Plane className="w-3.5 h-3.5 text-[#F3F0EE]" />
            </div>
            <span className="font-display font-medium">Aeolus</span>
          </Link>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/simulator" className="hover:text-ink font-medium transition-colors">Simulator</Link>
            <Link href="/scenarios" className="hover:text-ink font-medium transition-colors">Scenarios</Link>
          </div>
        </nav>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="section-badge mb-4"><BarChart3 className="w-3.5 h-3.5" />Technical methodology</div>
          <h1 className="font-display text-5xl font-medium tracking-tight mb-4">How Aeolus works</h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
            A deep dive into the optimizer formulation, cascade predictor, crew legality engine, and data sources powering the simulation.
          </p>
        </motion.div>

        <Separator />

        {/* Problem */}
        <Section id="problem" title="The $34B cascade problem" icon={Zap}>
          <div className="prose-sm text-muted-foreground space-y-4">
            <p>
              U.S. flight disruptions cost approximately <span className="text-foreground font-semibold">$34 billion annually</span> as of 2026.
              Weather causes ~74% of delays. The core challenge is <em>cascade propagation</em>: airlines reuse aircraft 4–5 times per day,
              so a single late inbound flight propagates into late departures for the next 18+ hours.
            </p>
            <p>
              Large carriers (Delta, United) operate proprietary Operations Control Center (OCC) software built over decades.
              Regional carriers — Breeze, Avelo, Frontier, JSX, Sun Country — rely on expensive third-party tools and manual dispatcher judgment.
              Aeolus is an open-source OCC reference implementation.
            </p>
            <div className="rounded-xl border border-border bg-secondary/30 p-4 font-mono text-xs">
              <div className="text-muted-foreground mb-2">{"// Cascade propagation example"}</div>
              <div>Flight NB101 (ORD→ATL) delayed <span className="text-amber-400">+2h</span> by thunderstorm</div>
              <div className="pl-4 text-muted-foreground/60">↳ N001NB arrives ATL late</div>
              <div className="pl-8">↳ NB102 (ATL→MIA) delayed <span className="text-orange-400">+2h15m</span> (late inbound + turn)</div>
              <div className="pl-12 text-muted-foreground/60">↳ N001NB arrives MIA late</div>
              <div className="pl-16">↳ NB103 (MIA→ORD) delayed <span className="text-red-400">+2h30m</span></div>
              <div className="pl-20 text-muted-foreground/60">…propagates for 18+ hours</div>
            </div>
          </div>
        </Section>

        <Separator />

        {/* Optimizer */}
        <Section id="optimizer" title="Recovery optimizer (MILP)" icon={BarChart3}>
          <div className="space-y-6 text-muted-foreground">
            <p>
              The recovery optimizer is formulated as a <span className="text-foreground font-semibold">Mixed-Integer Linear Program</span> solved
              by <span className="text-foreground font-semibold">Google OR-Tools CP-SAT</span>. It runs three times with different weight vectors
              to produce Plans A, B, and C.
            </p>

            <div>
              <h3 className="font-display font-semibold text-foreground mb-3">Decision variables</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      {["Variable", "Domain", "Meaning"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <TableRow cells={["x[f]", "{0, 1}", "1 if flight f operates, 0 if cancelled"]} />
                    <TableRow cells={["d[f]", "ℤ⁺ (slots)", "Delay in 15-min slots (0 = on time)"]} />
                    <TableRow cells={["a[f][ac]", "{0, 1}", "1 if aircraft ac operates flight f"]} />
                    <TableRow cells={["c[f][crew]", "{0, 1}", "1 if crew pairing operates flight f"]} />
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-display font-semibold text-foreground mb-3">Objective function</h3>
              <CodeBlock>{`minimize  α·Σ(cancel_cost[f] · (1 − x[f]))        # Plan A: α=10
        + β·Σ(pax_delay_min[f] · passengers[f])     # Plan B: β=10
        + γ·Σ(crew_overtime_hours)                   #
        + δ·Σ(aircraft_out_of_position_penalty)      # Plan C: δ=10

Constants:
  cancel_cost_per_flight = $15,000
  pax_delay_cost_per_min = $1.50  (DOT methodology)
  crew_overtime_per_hour = $450`}</CodeBlock>
            </div>

            <div>
              <h3 className="font-display font-semibold text-foreground mb-3">Hard constraints</h3>
              <ul className="space-y-2 text-sm">
                {[
                  "Aircraft continuity: if A operates f1 (lands at ORD at T), next flight must depart ORD ≥ T + min_turn_time",
                  "FAR 117 duty limits: enforced as hard constraints via crew legality engine",
                  "Airport capacity: Σ(departures/hour) ≤ airport.hourly_capacity",
                  "Event constraints: no flight can depart/arrive at a closed airport during event window",
                  "Each operating flight must have exactly one aircraft and one crew pairing",
                ].map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">→</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display font-semibold text-foreground mb-3">Weight configurations</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      {["Plan", "Objective", "α (cancel)", "β (pax)", "γ (crew)", "δ (position)"].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <TableRow cells={["A", "Minimize cost", "10.0", "1.0", "5.0", "2.0"]} />
                    <TableRow cells={["B", "Minimize pax impact", "1.0", "10.0", "2.0", "1.0"]} />
                    <TableRow cells={["C", "Protect tomorrow", "2.0", "3.0", "2.0", "10.0"]} />
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-sm">
              Solver target: &lt;30 seconds on a single CPU for the 200-flight, 40-aircraft instance.
              On timeout, falls back to a greedy nearest-aircraft swap heuristic and flags the plan as <code className="text-amber-400">heuristic</code>.
            </p>
          </div>
        </Section>

        <Separator />

        {/* Cascade predictor */}
        <Section id="predictor" title="Cascade predictor (XGBoost)" icon={BarChart3}>
          <div className="space-y-6 text-muted-foreground">
            <p>
              An <span className="text-foreground font-semibold">XGBoost ensemble</span> (classifier + regressor) predicts, for each flight in the next 18 hours:
              P(delay &gt; 15 min) and expected delay in minutes.
            </p>

            <div>
              <h3 className="font-display font-semibold text-foreground mb-3">Feature set</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      {["Feature", "Description"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["origin, destination", "Encoded airport IDs"],
                      ["departure_hour, day_of_week", "Temporal features (high delay correlation)"],
                      ["aircraft_type", "B737 vs A320 vs E175 — different turn times"],
                      ["inbound_delay_minutes", "Critical cascade feature: how late is the inbound?"],
                      ["origin/dest METAR", "Wind, visibility, ceiling, flight category (VFR/IFR/LIFR)"],
                      ["event_distance_nm", "Proximity to active disruption polygon"],
                      ["event_severity_encoded", "mild=0.4, moderate=0.7, severe=0.9, extreme=1.0"],
                      ["crew_duty_remaining_min", "Hours remaining on crew's duty clock"],
                      ["route_on_time_pct_90d", "Historical baseline: how often does this route run on time?"],
                    ].map(([f, d]) => <TableRow key={f} cells={[f, d]} />)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Classifier target</div>
                <div className="font-mono text-2xl font-bold text-primary">AUC &gt; 0.82</div>
                <div className="text-xs text-muted-foreground mt-1">P(delay &gt; 15 min)</div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Regressor target</div>
                <div className="font-mono text-2xl font-bold text-primary">MAE &lt; 8 min</div>
                <div className="text-xs text-muted-foreground mt-1">Expected delay minutes</div>
              </div>
            </div>

            <p className="text-sm">
              Training data: BTS On-Time Performance (2023–2024) joined with historical METAR archives.
              Validate on 2025. When no trained model is present, falls back to deterministic rule-based propagation
              with realistic cascade decay (severity × 0.4–0.9 multiplier).
            </p>
          </div>
        </Section>

        <Separator />

        {/* Crew legality */}
        <Section id="crew" title="Crew legality engine (FAR 117)" icon={Shield}>
          <div className="space-y-6 text-muted-foreground">
            <p>
              The crew legality engine hard-codes <span className="text-foreground font-semibold">FAR Part 117</span> for 2-pilot passenger operations.
              Every recovery plan is checked against these rules before being presented.
            </p>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    {["Rule", "Limit", "FAR Reference"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Max flight time / FDP", "9 hours (2-pilot)", "117.65"],
                    ["Flight Duty Period limit", "9–14h by report time", "117.13 Table B"],
                    ["Min rest before FDP", "10 consecutive hours", "117.25(a)"],
                    ["Max flight time / 7 days", "60 hours", "117.23(a)"],
                    ["Max flight time / 28 days", "100 hours", "117.23(b)"],
                    ["Max flight time / 365 days", "1,000 hours", "117.23(c)"],
                    ["WOCL restriction", "0200–0559 local", "117.3, 117.13"],
                  ].map(([r, l, f]) => <TableRow key={r} cells={[r, l, f]} />)}
                </tbody>
              </table>
            </div>

            <CodeBlock>{`# Usage
engine = CrewLegalityEngine()

result = engine.validate(
    crew={
        "duty_start": datetime(2024, 1, 15, 8, 0),
        "flight_time_7d_minutes": 3420,  # 57h
        "last_rest_end": datetime(2024, 1, 15, 7, 50),
        ...
    },
    proposed_pairing={
        "departure": datetime(2024, 1, 15, 9, 0),
        "arrival":   datetime(2024, 1, 15, 11, 30),
        "flight_time_minutes": 150,
    }
)

result.is_legal          # → True
result.violations        # → []
result.warnings          # → ["Flight in WOCL window"]
result.flight_time_remaining_minutes  # → 180`}</CodeBlock>
          </div>
        </Section>

        <Separator />

        {/* Data sources */}
        <Section id="data" title="Data sources" icon={Database}>
          <div className="space-y-4 text-muted-foreground">
            {[
              {
                name: "aviationweather.gov (NOAA)",
                desc: "Free, no API key. METAR observations for all 15 Nimbus airports, fetched every 5 minutes. Used for live weather layer on the map and as predictor features.",
                usage: "Live",
                endpoint: "https://aviationweather.gov/api/data/metar?ids=KORD,...&format=json",
              },
              {
                name: "BTS On-Time Performance",
                desc: "Historical training data for the XGBoost cascade predictor. 2023–2025 CSVs. Used only at build time.",
                usage: "Training",
                endpoint: "transtats.bts.gov",
              },
              {
                name: "Nimbus Air (synthetic)",
                desc: "40 aircraft, 200 daily flights, 60 crew pairings, 15 airports — fully generated by generate_network.py with seed=42 for reproducibility.",
                usage: "Simulation",
                endpoint: "data/network/*.yaml",
              },
            ].map((src) => (
              <div key={src.name} className="rounded-xl border border-border bg-secondary/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-semibold text-foreground text-sm">{src.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase font-medium">{src.usage}</span>
                </div>
                <p className="text-sm mb-2">{src.desc}</p>
                <code className="text-[10px] text-muted-foreground/60 font-mono">{src.endpoint}</code>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        {/* Architecture */}
        <Section id="architecture" title="System architecture" icon={Cloud}>
          <CodeBlock>{`                    ┌──────────────────────────────────────┐
External data  →    │  Weather fetch (httpx + asyncio)     │
                    └──────────────┬───────────────────────┘
                                   ↓
                    ┌──────────────────────────────────────┐
                    │  PostgreSQL 16 + TimescaleDB         │
                    │  Redis 7 (cache + task queue)        │
                    └──────────────┬───────────────────────┘
                                   ↓
  ┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────┐
  │ CascadePredictor │→ │ RecoveryOptimizer   │→ │ CrewLegality    │
  │ (XGBoost)        │  │ (OR-Tools CP-SAT)   │  │ Engine (FAR117) │
  └──────────────────┘  └──────────┬──────────┘  └─────────────────┘
                                   ↓
                    ┌──────────────────────────────────────┐
                    │  FastAPI (REST + WebSocket)          │
                    │  ECS Fargate · 2 vCPU · 4GB         │
                    └──────────────┬───────────────────────┘
                                   ↓
                    ┌──────────────────────────────────────┐
                    │  Next.js 15 dashboard                │
                    │  SVG map · Recharts · Zustand        │
                    └──────────────────────────────────────┘`}</CodeBlock>
        </Section>
      </div>
    </main>
  )
}
