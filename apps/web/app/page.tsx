"use client"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Plane, Zap, BarChart3, Shield, ArrowRight,
  CloudLightning, Clock, TrendingDown, Terminal, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"

function PeachBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-orange-200/40 blur-[120px]" />
      <div className="absolute top-10 right-0 w-[420px] h-[420px] rounded-full bg-rose-200/30 blur-[110px]" />
      <div className="absolute bottom-0 left-1/3 w-[600px] h-[260px] rounded-full bg-amber-100/40 blur-[80px]" />
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
    <div className="relative w-full h-[420px] rounded-2xl border border-border bg-card overflow-hidden shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/60 via-white to-rose-50/40" />

      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(22 60% 75%)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
        {[
          { d: "M 200,110 Q 400,50 600,280", color: "#F87156", delay: 0.5 },
          { d: "M 420,210 Q 500,160 660,200", color: "#FB923C", delay: 1.0 },
          { d: "M 320,170 Q 500,90 700,140", color: "#0EA5E9", delay: 1.5 },
          { d: "M 200,110 Q 310,200 420,210", color: "#E84545", delay: 2.0 },
        ].map((p, i) => (
          <motion.path
            key={i}
            d={p.d}
            stroke={p.color}
            strokeWidth="1.6"
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
              fill={ap.code === "ORD" ? "#FB923C" : "#F87156"}
              stroke="#fff" strokeWidth="2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + idx * 0.12 }}
            />
            <motion.circle
              cx={ap.x} cy={ap.y} r="14"
              fill="none"
              stroke={ap.code === "ORD" ? "#FB923C" : "#F87156"}
              strokeWidth="1.2" opacity={0.4}
              animate={{ r: [12, 18, 12], opacity: [0.45, 0.1, 0.45] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: idx * 0.4 }}
            />
            <text x={ap.x + 12} y={ap.y + 4} fill="#3F2A1B" fontSize="10" fontFamily="Space Grotesk, sans-serif" fontWeight="700">
              {ap.code}
            </text>
          </g>
        ))}

        <motion.circle
          cx={200} cy={110} r="20"
          fill="none" stroke="#FB923C" strokeWidth="2"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 2.2 }}
        />
      </svg>

      <div className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-white/90 border border-border px-3 py-1.5 text-xs backdrop-blur-sm shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-foreground/70 font-medium">Live simulation</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5 }}
        className="absolute top-4 left-4 rounded-xl border border-orange-300 bg-orange-50/95 px-4 py-2.5 backdrop-blur-sm shadow-sm"
      >
        <div className="flex items-center gap-2 text-orange-700 text-xs font-semibold">
          <CloudLightning className="w-3.5 h-3.5" />
          <span>ORD thunderstorm — 47 flights cascading</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3 }}
        className="absolute bottom-4 right-4 rounded-xl border border-primary/30 bg-primary-soft/80 px-4 py-2.5 backdrop-blur-sm shadow-sm"
      >
        <div className="text-xs font-semibold text-primary">3 recovery plans ready</div>
        <div className="text-[10px] text-foreground/70 mt-0.5">Solved in 8.4s · OR-Tools CP-SAT</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.5 }}
        className="absolute bottom-4 left-4 flex items-center gap-2"
      >
        <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 font-semibold">153 on time</span>
        <span className="rounded-md border border-orange-300 bg-orange-50 px-2 py-1 text-[10px] text-orange-700 font-semibold">31 delayed</span>
        <span className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[10px] text-red-700 font-semibold">16 cancelled</span>
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
  { Icon: Zap, title: "MILP recovery optimizer",
    desc: "Google OR-Tools CP-SAT produces 3 ranked plans (cost / passenger / next-day positioning) in seconds." },
  { Icon: Shield, title: "FAR Part 117 crew legality",
    desc: "Hard-coded FAA duty-time rules count violations on every plan, so a controller picks a crew-legal one." },
  { Icon: BarChart3, title: "XGBoost cascade predictor",
    desc: "ML model trained on BTS on-time data predicts delay propagation with MAE < 8 minutes per flight." },
]

const steps = [
  { n: "01", t: "Event triggered",  d: "Pick disruption type, airport or tail, severity, duration." },
  { n: "02", t: "Cascade computed", d: "Predictor propagates delays through aircraft rotations." },
  { n: "03", t: "MILP solved",      d: "CP-SAT finds 3 Pareto-optimal plans with FAR 117 constraints." },
  { n: "04", t: "Plans returned",   d: "WebSocket streams results to the OCC dashboard live." },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-peach flex items-center justify-center shadow-sm">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-foreground">Aeolus</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <Link href="/scenarios" className="hover:text-foreground transition-colors">Scenarios</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">Methodology</Link>
            <Link href="/simulator" className="hover:text-foreground transition-colors">Simulator</Link>
          </div>
          <Button asChild size="sm" className="gradient-peach text-white glow-peach hover:opacity-95 transition-opacity">
            <Link href="/simulator">Launch simulator <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-6">
        <PeachBackground />
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <div className="section-badge mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Nimbus Air · 40 aircraft · 142 daily flights
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.04] text-foreground">
              When weather hits,<br />
              <span className="text-gradient-peach">cascades don&apos;t wait.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
              Aeolus is an open-source Operations Control Center. Trigger any of 10 disruption types
              against a synthetic US airline network and receive MILP-optimized recovery plans in seconds.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button asChild size="lg" className="gradient-peach text-white glow-peach hover:opacity-95 h-12 px-8 text-base font-semibold">
                <Link href="/simulator">Launch simulator <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
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

      {/* Stats */}
      <section className="border-y border-border py-12 px-6 bg-card/50">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="font-display text-4xl font-bold text-gradient-peach mb-1.5">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="section-badge mb-4">
              <Zap className="w-3.5 h-3.5" />
              System capabilities
            </div>
            <h2 className="font-display text-4xl font-bold mb-3 text-foreground">Built like a real OCC.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Every component reflects how Delta, United, and other US carriers solve the disruption recovery problem.
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
                whileHover={{ y: -3 }}
                className="surface-card p-5 hover:border-primary/40 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center mb-3">
                  <f.Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-1.5 text-sm text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section className="py-20 px-6 border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="section-badge mb-4">
              <Terminal className="w-3.5 h-3.5" />
              How it works
            </div>
            <h2 className="font-display text-4xl font-bold mb-3 text-foreground">From disruption to recovery in seconds.</h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="surface-card p-5 relative"
              >
                <div className="font-display text-5xl font-bold text-primary/10 absolute top-3 right-4">{step.n}</div>
                <div className="text-xs font-mono font-bold text-primary mb-2 uppercase tracking-wider">Step {step.n}</div>
                <h3 className="font-display font-semibold mb-1.5 text-sm text-foreground">{step.t}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-3 text-foreground">Trigger your first disruption.</h2>
            <p className="text-muted-foreground mb-7 text-base md:text-lg leading-relaxed">
              One click. Watch flights cascade across the US map. Get 3 recovery plans. See FAR 117 violations flagged in real time.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button asChild size="lg" className="gradient-peach text-white glow-peach h-12 px-10 text-base font-semibold">
                <Link href="/simulator">Open the simulator <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
                <Link href="/scenarios">Browse scenarios</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border py-7 px-6 bg-card/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md gradient-peach flex items-center justify-center">
              <Plane className="w-3 h-3 text-white" />
            </div>
            <span>Aeolus — open-source OCC reference implementation</span>
          </div>
          <div className="flex gap-5">
            <Link href="/scenarios" className="hover:text-foreground transition-colors">Scenarios</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">Methodology</Link>
            <Link href="/simulator" className="hover:text-foreground transition-colors">Simulator</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
