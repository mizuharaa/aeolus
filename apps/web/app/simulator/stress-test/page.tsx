"use client"
import { useState } from "react"
import { motion } from "framer-motion"
import { Network, Loader2, Play, AlertTriangle, TrendingUp } from "lucide-react"
import { apiClient } from "@/lib/api"
import { airportLabel } from "@/lib/labels"
import { c, ff, r, sp, type as typeStyle } from "@/lib/design-tokens"
import { ContentCard, Eyebrow, Type, ButtonPrimary, ButtonSecondary } from "@/components/ds/primitives"
import { SimulatorPageShell } from "@/components/simulator/page-shell"

// ─── Types matching the FastAPI response shape ─────────────────────────

interface ScenarioSample {
  airport: string
  event_kind: string
  severity: string
  duration_min: number
  affected: number
  direct_hits: number
  cascade_1: number
  cascade_2: number
  cancelled_estimate: number
  pax_delay_min: number
  score: number
}

interface AirportSummary {
  airport: string
  iterations: number
  avg_affected: number
  p95_affected: number
  avg_pax_delay_min: number
  p95_pax_delay_min: number
  avg_score: number
  p95_score: number
  worst_kind: string
  samples: ScenarioSample[]
}

interface StressTestResponse {
  iterations_per_airport: number
  total_scenarios: number
  airports: string[]
  event_kinds: string[]
  ranked: AirportSummary[]
  heatmap: Record<string, Record<string, number>>
  fleet_size: number
  schedule_size: number
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function StressTestPage() {
  const [data, setData] = useState<StressTestResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iterations, setIterations] = useState(5)

  const runStressTest = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.post<StressTestResponse>("/network/stress-test", {
        iterations_per_airport: iterations,
        seed: 42,
      })
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stress test failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SimulatorPageShell
      breadcrumbs={[
        { label: "Simulator", href: "/simulator" },
        { label: "Stress test" },
      ]}
      title="Network vulnerability stress test"
      subtitle="Monte Carlo single-airport disruptions across the Nimbus Air schedule. Surfaces your highest-leverage failure points before weather finds them."
      actions={
        <>
          <select
            value={iterations}
            onChange={(e) => setIterations(parseInt(e.target.value, 10))}
            disabled={loading}
            style={{
              fontFamily: ff.body,
              fontSize: 13,
              height: 36,
              padding: "0 12px",
              borderRadius: r.sm,
              border: `1px solid ${c.hairline}`,
              background: c.canvas,
              color: c.body,
              cursor: "pointer",
            }}
          >
            <option value={3}>3 iterations / airport</option>
            <option value={5}>5 iterations / airport</option>
            <option value={10}>10 iterations / airport</option>
            <option value={20}>20 iterations / airport</option>
          </select>
          <ButtonPrimary
            size="md"
            onClick={runStressTest}
            disabled={loading}
            leadingIcon={loading
              ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
              : <Play style={{ width: 14, height: 14 }} />}
          >
            {loading ? "Running…" : "Run stress test"}
          </ButtonPrimary>
        </>
      }
    >
      {error && (
        <ContentCard padding={sp.md} style={{ marginBottom: sp.lg, borderColor: c.signatureCoral }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.statusCancelled.ink }}>
            <AlertTriangle style={{ width: 14, height: 14 }} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </div>
        </ContentCard>
      )}

      {!data && !loading && !error && (
        <ContentCard
          padding={sp.xxl}
          style={{
            background: c.signatureCream,
            borderColor: "transparent",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <Eyebrow color={c.signatureForest}>Chaos Engineering</Eyebrow>
          <Type as="h2" role="titleLg" color={c.ink}>Run a stress test against your network.</Type>
          <Type as="p" role="bodyMd" color={c.body} style={{ maxWidth: 560, lineHeight: 1.55 }}>
            We perturb each of Nimbus Air&apos;s twelve hubs with a randomised disruption (weather, ground stop, ATC staffing, thunderstorm) and measure how badly the cascade fragments the schedule. The result is a vulnerability heatmap: airports in the top-left are your highest-risk failure points.
          </Type>
        </ContentCard>
      )}

      {loading && !data && (
        <ContentCard padding={sp.xxl}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: c.muted, fontSize: 14 }}>
            <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
            Running {iterations * 12} Monte Carlo scenarios across the network…
          </div>
        </ContentCard>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: sp.lg }}>

          {/* ── Summary band ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: sp.md,
            }}
          >
            <SummaryCard label="Scenarios" value={data.total_scenarios.toString()} sub={`${data.iterations_per_airport}/airport`} />
            <SummaryCard label="Schedule" value={data.schedule_size.toLocaleString()} sub="flights" />
            <SummaryCard label="Fleet" value={data.fleet_size.toString()} sub="aircraft" />
            <SummaryCard label="Worst hub"
              value={data.ranked[0]?.airport ?? "—"}
              sub={data.ranked[0] ? `${data.ranked[0].avg_affected.toFixed(0)} avg affected` : ""}
              accent={c.signatureCoral}
            />
          </div>

          {/* ── Heatmap ── */}
          <ContentCard padding={sp.lg}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sp.sm }}>
              <Network style={{ width: 16, height: 16, color: c.muted }} />
              <Type as="h2" role="titleSm" color={c.ink}>Vulnerability heatmap</Type>
            </div>
            <Type as="p" role="bodyMd" color={c.muted} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: sp.md }}>
              Composite vulnerability score per airport × disruption type. Darker coral = more fragile under that scenario.
            </Type>
            <Heatmap data={data} />
          </ContentCard>

          {/* ── Ranked airport table ── */}
          <ContentCard padding={sp.lg}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sp.sm }}>
              <TrendingUp style={{ width: 16, height: 16, color: c.muted }} />
              <Type as="h2" role="titleSm" color={c.ink}>Airports ranked by fragility</Type>
            </div>
            <RankedTable summaries={data.ranked} />
          </ContentCard>
        </div>
      )}
    </SimulatorPageShell>
  )
}

// ─── Heatmap component ────────────────────────────────────────────────

function Heatmap({ data }: { data: StressTestResponse }) {
  const allScores = data.airports.flatMap((a) =>
    data.event_kinds.map((k) => data.heatmap[a]?.[k] ?? 0),
  )
  const maxScore = Math.max(1, ...allScores)

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `120px repeat(${data.event_kinds.length}, 1fr)`,
          gap: 4,
          minWidth: data.event_kinds.length * 100 + 120,
        }}
      >
        {/* Header row */}
        <div />
        {data.event_kinds.map((k) => (
          <div
            key={k}
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.06em",
              color: c.muted,
              padding: "8px 4px",
              textAlign: "center",
              fontFamily: ff.body,
            }}
          >
            {k.replace("_", " ")}
          </div>
        ))}

        {/* Data rows */}
        {data.airports.map((airport) => {
          const a = airportLabel(airport)
          return [
            <div
              key={`${airport}-label`}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                fontFamily: ff.mono,
                fontSize: 13,
                fontWeight: 500,
                color: c.ink,
                paddingRight: 8,
              }}
            >
              <span>{a.iata || airport}</span>
              {a.city && (
                <span style={{ fontSize: 10, color: c.muted, fontFamily: ff.body, fontWeight: 400 }}>
                  {a.city}
                </span>
              )}
            </div>,
            ...data.event_kinds.map((kind) => {
              const score = data.heatmap[airport]?.[kind] ?? 0
              const intensity = score / maxScore
              return (
                <HeatCell
                  key={`${airport}-${kind}`}
                  score={score}
                  intensity={intensity}
                />
              )
            }),
          ]
        })}
      </div>
    </div>
  )
}

function HeatCell({ score, intensity }: { score: number; intensity: number }) {
  // Coral surface, alpha proportional to intensity
  const alpha = 0.05 + intensity * 0.85
  const ink = intensity > 0.5 ? c.canvas : c.statusCancelled.ink
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: `rgba(170, 45, 0, ${alpha})`,
        borderRadius: r.sm,
        padding: "12px 8px",
        textAlign: "center",
        fontFamily: ff.mono,
        fontWeight: 600,
        fontSize: 12,
        color: ink,
        fontVariantNumeric: "tabular-nums",
        minHeight: 38,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {score >= 1000 ? `${(score / 1000).toFixed(0)}k` : Math.round(score)}
    </motion.div>
  )
}

// ─── Ranked table ─────────────────────────────────────────────────────

function RankedTable({ summaries }: { summaries: AirportSummary[] }) {
  const max = Math.max(1, ...summaries.map((s) => s.avg_score))
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px minmax(0, 1.2fr) minmax(0, 1.2fr) 90px 90px 110px",
          gap: sp.sm,
          padding: "8px 12px",
          borderBottom: `1px solid ${c.hairline}`,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: c.muted,
          fontWeight: 500,
        }}
      >
        <span>#</span>
        <span>Airport</span>
        <span>Worst kind</span>
        <span style={{ textAlign: "right" }}>Avg affected</span>
        <span style={{ textAlign: "right" }}>P95 affected</span>
        <span>Avg score</span>
      </div>
      {summaries.map((s, i) => {
        const a = airportLabel(s.airport)
        const fillPct = Math.min(100, Math.round((s.avg_score / max) * 100))
        return (
          <div
            key={s.airport}
            style={{
              display: "grid",
              gridTemplateColumns: "32px minmax(0, 1.2fr) minmax(0, 1.2fr) 90px 90px 110px",
              gap: sp.sm,
              padding: "10px 12px",
              borderBottom: `1px solid ${c.hairline}`,
              alignItems: "center",
              fontFamily: ff.body,
              fontSize: 13,
            }}
          >
            <span style={{ fontFamily: ff.mono, color: c.muted }}>{i + 1}</span>
            <div>
              <div style={{ fontFamily: ff.mono, fontWeight: 500, color: c.ink }}>
                {a.iata || s.airport}
              </div>
              {a.city && (
                <div style={{ fontSize: 11, color: c.muted }}>{a.city}</div>
              )}
            </div>
            <span style={{ fontSize: 12, color: c.body }}>
              {s.worst_kind.replace("_", " ")}
            </span>
            <span style={{ fontFamily: ff.mono, textAlign: "right", color: c.ink, fontVariantNumeric: "tabular-nums" }}>
              {s.avg_affected.toFixed(0)}
            </span>
            <span style={{ fontFamily: ff.mono, textAlign: "right", color: c.statusCancelled.ink, fontVariantNumeric: "tabular-nums" }}>
              {s.p95_affected}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: ff.mono, fontSize: 12, color: c.ink, fontVariantNumeric: "tabular-nums" }}>
                {s.avg_score >= 1000 ? `${(s.avg_score / 1000).toFixed(0)}k` : Math.round(s.avg_score)}
              </span>
              <div style={{ height: 4, background: c.surfaceStrong, borderRadius: r.pill, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ height: "100%", background: c.signatureCoral }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryCard({
  label, value, sub, accent = c.ink,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <ContentCard padding={sp.md} style={{ borderLeft: `4px solid ${accent}` }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ fontFamily: ff.display, fontSize: 28, fontWeight: 400, color: c.ink, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
        {value}
      </div>
      {sub && (
        <span style={{ fontSize: 12, color: c.muted, fontFamily: ff.body }}>{sub}</span>
      )}
    </ContentCard>
  )
}
