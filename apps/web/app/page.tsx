"use client"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Plane, Zap, BarChart3, Shield, ArrowRight,
  CloudLightning, Clock, TrendingDown, Terminal, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"

function EditorialOrbit() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
      <svg className="absolute -right-1/4 top-1/4 w-[80%] h-[40%] text-signal-light" viewBox="0 0 400 120" fill="none" aria-hidden>
        <path
          d="M0,100 Q200,20 400,100"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function FlightVisual() {
  const airports = [
    { x: 200, y: 110, code: "ORD" },
    { x: 600, y: 280, code: "ATL" },
    { x: 420, y: 210, code: "DFW" },
    { x: 660, y: 200, code: "LAX" },
    { x: 320, y: 170, code: "DEN" },
    { x: 700, y: 140, code: "JFK" },
  ]
  return (
    <div className="relative w-full h-[420px] rounded-stadium border border-border bg-lifted overflow-hidden shadow-lift">
      <div className="absolute inset-0 bg-gradient-to-br from-[#FCFBFA] via-canvas to-[#F0EBE4]" />
      <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(30 6% 78%)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
        {[
          { d: "M 200,110 Q 400,50 600,280", color: "#F37338", delay: 0.5 },
          { d: "M 420,210 Q 500,160 660,200", color: "#9A3A0A", delay: 1.0 },
          { d: "M 320,170 Q 500,90 700,140", color: "#3860BE", delay: 1.5 },
          { d: "M 200,110 Q 310,200 420,210", color: "#CF4500", delay: 2.0 },
        ].map((p, i) => (
          <motion.path
            key={i}
            d={p.d}
            stroke={p.color}
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="8 5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.85 }}
            transition={{ duration: 2, delay: p.delay }}
          />
        ))}

        {airports.map((ap, idx) => (
          <g key={ap.code}>
            <motion.circle
              cx={ap.x} cy={ap.y} r="6"
              fill={ap.code === "ORD" ? "#F37338" : "#141413"}
              stroke="#FCFBFA" strokeWidth="2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + idx * 0.12 }}
            />
            <motion.circle
              cx={ap.x} cy={ap.y} r="14"
              fill="none"
              stroke={ap.code === "ORD" ? "#F37338" : "#141413"}
              strokeWidth="1.2" opacity={0.4}
              animate={{ r: [12, 18, 12], opacity: [0.45, 0.1, 0.45] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: idx * 0.4 }}
            />
            <text
              x={ap.x + 12}
              y={ap.y + 4}
              fill="#141413"
              fontSize="10"
              fontFamily="Sofia Sans, Arial, sans-serif"
              fontWeight="600"
            >
              {ap.code}
            </text>
          </g>
        ))}

        <motion.circle
          cx={200} cy={110} r="20"
          fill="none" stroke="#F37338" strokeWidth="2"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 2.2 }}
        />
      </svg>

      <div className="absolute top-4 right-4 flex items-center gap-2 rounded-pill border border-border bg-white px-3 py-1.5 text-xs shadow-nav">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-ink/80 font-medium">Live simulation</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5 }}
        className="absolute top-4 left-4 rounded-[1.25rem] border border-border bg-white/95 px-4 py-2.5 shadow-nav backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 text-orange-800 text-xs font-semibold">
          <CloudLightning className="w-3.5 h-3.5" />
          <span>ORD thunderstorm — 47 flights cascading</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3 }}
        className="absolute bottom-4 right-4 rounded-[1.25rem] border border-border bg-white/95 px-4 py-2.5 shadow-nav backdrop-blur-sm"
      >
        <div className="text-xs font-semibold text-ink">3 recovery plans ready</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Solved in &lt; 10ms · Heuristic engine</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.5 }}
        className="absolute bottom-4 left-4 flex items-center gap-2 flex-wrap"
      >
        <span className="rounded-pill border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800 font-semibold">153 on time</span>
        <span className="rounded-pill border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] text-orange-800 font-semibold">31 delayed</span>
        <span className="rounded-pill border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-800 font-semibold">16 cancelled</span>
      </motion.div>
    </div>
  )
}

const stats = [
  { value: "$34B", label: "Annual disruption cost (US)", Icon: TrendingDown },
  { value: "74%",  label: "Weather-caused delays",       Icon: CloudLightning },
  { value: "18h",  label: "Average cascade duration",    Icon: Clock },
  { value: "4–5×", label: "Aircraft reuse per day",      Icon: Plane },
]

const features = [
  { Icon: CloudLightning, title: "10 disruption event types",
    desc: "Weather, mechanical AOG, crew sickouts, airspace closures, cyber incidents — all with realistic cascade propagation." },
  { Icon: Zap, title: "Heuristic recovery optimizer",
    desc: "Three plan archetypes (cost / passenger / next-day) produced in milliseconds with portfolio cost rollups." },
  { Icon: Shield, title: "FAR Part 117 crew legality",
    desc: "Duty-time checks surface violation counts on every plan so you can compare tradeoffs." },
  { Icon: BarChart3, title: "Cascade + ML predictor",
    desc: "Rotation-based propagation, optionally backed by a trained model for delay expectations." },
]

const steps = [
  { n: "01", t: "Event triggered",  d: "Pick disruption type, airport or tail, severity, duration." },
  { n: "02", t: "Cascade computed", d: "Predictor propagates delays through aircraft rotations." },
  { n: "03", t: "Plans generated",  d: "The engine assembles three differentiated recovery strategies." },
  { n: "04", t: "Plans returned",   d: "WebSocket streams results to the OCC dashboard live." },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background overflow-hidden">
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 md:pt-5 px-4 pointer-events-none">
        <nav className="pointer-events-auto w-full max-w-6xl nav-pill-surface h-14 md:h-[3.5rem] flex items-center justify-between pl-4 pr-2 md:px-8">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-ink flex items-center justify-center shadow-nav shrink-0">
              <Plane className="w-4 h-4 text-[#F3F0EE]" />
            </div>
            <span className="font-display font-medium text-lg tracking-tight text-ink truncate">Aeolus</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/scenarios" className="hover:text-ink transition-colors font-medium">Scenarios</Link>
            <Link href="/docs" className="hover:text-ink transition-colors font-medium">Methodology</Link>
            <Link href="/simulator" className="hover:text-ink transition-colors font-medium">Simulator</Link>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/simulator">Launch simulator <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </nav>
      </div>

      <section className="relative pt-32 md:pt-40 pb-20 px-6">
        <EditorialOrbit />
        <div className="relative max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <div className="section-badge mb-6 justify-center">
              <Sparkles className="w-3.5 h-3.5 text-signal-light" />
              <span className="text-muted-foreground">Nimbus Air · 40 aircraft · 142 daily flights</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-medium tracking-tight mb-6 leading-[1.05] text-ink max-w-4xl mx-auto">
              When weather hits,<br />
              <span className="text-link">cascades don&apos;t wait.</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8 font-[450]">
              Aeolus is an open-source Operations Control Center. Trigger disruption types
              against a synthetic US airline network and receive recovery plans in real time.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button asChild size="lg">
                <Link href="/simulator">Launch simulator <ArrowRight className="w-4 h-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/docs">Read the methodology</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <FlightVisual />
          </motion.div>
        </div>
      </section>

      <section className="border-y border-border py-12 md:py-16 px-6 bg-lifted/50">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="font-display text-3xl md:text-4xl font-medium text-ink mb-1.5 tracking-tight">{s.value}</div>
              <div className="text-sm text-muted-foreground font-[450]">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-20 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="section-badge mb-4 justify-center">
              <Zap className="w-3.5 h-3.5 text-signal-light" />
              <span className="text-muted-foreground">System capabilities</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-medium mb-3 text-ink tracking-tight">Built like a real OCC.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed font-[450]">
              Every component reflects how carriers approach disruption recovery — with transparent, inspectable logic.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                viewport={{ once: true }}
                whileHover={{ y: -2 }}
                className="surface-card p-6 md:p-8 hover:border-ink/15 transition-all bg-white"
              >
                <div className="w-12 h-12 rounded-full border border-ink/10 bg-lifted flex items-center justify-center mb-4">
                  <f.Icon className="w-5 h-5 text-ink" />
                </div>
                <h3 className="font-display font-medium mb-2 text-sm md:text-base text-ink tracking-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-[450]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-6 border-t border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="section-badge mb-4 justify-center">
              <Terminal className="w-3.5 h-3.5 text-signal-light" />
              <span className="text-muted-foreground">How it works</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-medium mb-3 text-ink tracking-tight">From disruption to recovery in seconds.</h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="surface-card p-5 md:p-6 relative bg-white"
              >
                <div className="font-display text-4xl md:text-5xl font-medium text-ink/[0.08] absolute top-3 right-4 select-none">
                  {step.n}
                </div>
                <div className="text-[10px] font-bold text-link mb-2 uppercase tracking-wider">Step {step.n}</div>
                <h3 className="font-display font-medium mb-2 text-sm text-ink tracking-tight">{step.t}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-[450]">{step.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-5xl font-medium mb-3 text-ink tracking-tight">Trigger your first disruption.</h2>
            <p className="text-muted-foreground mb-8 text-base md:text-lg leading-relaxed font-[450]">
              One click. Watch flights cascade on the US map. Compare three recovery plans. Inspect FAR 117 flags in real time.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button asChild size="lg">
                <Link href="/simulator">Open the simulator <ArrowRight className="w-4 h-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/scenarios">Browse scenarios</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-12 md:py-16 px-6 bg-ink text-[#F3F0EE]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
              <Plane className="w-3.5 h-3.5" />
            </div>
            <span className="text-white/90 font-[450]">Aeolus — open-source OCC reference</span>
          </div>
          <div className="flex flex-wrap gap-6 text-white/70">
            <Link href="/scenarios" className="hover:text-white transition-colors">Scenarios</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Methodology</Link>
            <Link href="/simulator" className="hover:text-white transition-colors">Simulator</Link>
          </div>
        </div>
        <p className="max-w-6xl mx-auto mt-10 text-xs text-white/50 font-[450]">
          UI tokens follow the Aeolus <span className="text-white/70">DESIGN.md</span> system — canvas cream, ink CTAs, editorial rhythm.
        </p>
      </footer>
    </main>
  )
}
