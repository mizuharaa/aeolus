"use client"
/**
 * 404 — "flight not found". A creative aviation miss: a paper-plane drifts
 * off a dashed great-circle route that runs off the edge of the map, the
 * big 404 sits behind glass, and two real CTAs get you back on course.
 * Plum + gold, glass surfaces, no stock-icon slop.
 */

import Link from "next/link"
import { useEffect, useRef } from "react"

export default function NotFound() {
  const planeRef = useRef<SVGGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const plane = planeRef.current
    const path = pathRef.current
    if (!plane || !path) return
    let raf = 0
    const len = path.getTotalLength()
    const start = performance.now()
    const DUR = 5200
    const tick = (now: number) => {
      const t = ((now - start) % DUR) / DUR
      const p = path.getPointAtLength(t * len)
      const p2 = path.getPointAtLength(Math.min(len, t * len + 1))
      const ang = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI
      plane.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${ang})`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <main className="nf-root">
      {/* drifting route + paper plane */}
      <svg className="nf-sky" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="nf-route" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8B6FD0" stopOpacity="0" />
            <stop offset="0.5" stopColor="#8B6FD0" stopOpacity="0.9" />
            <stop offset="1" stopColor="#C9A050" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {/* the intended route — a clean arc */}
        <path d="M -60 560 C 300 420 520 200 760 250 S 1120 240 1320 120"
          fill="none" stroke="url(#nf-route)" strokeWidth="2.5" strokeDasharray="2 10" strokeLinecap="round" opacity="0.55" />
        {/* the plane's actual (wrong) path — veers off */}
        <path ref={pathRef} d="M -60 560 C 300 420 520 200 760 250 C 900 285 940 470 1300 640"
          fill="none" stroke="none" />
        {/* origin + a ghost destination that never arrives */}
        <circle cx="-60" cy="560" r="5" fill="#5B3FA8" />
        <g transform="translate(1320 120)">
          <circle r="7" fill="none" stroke="#C9A050" strokeWidth="2" strokeDasharray="3 4" opacity="0.7" />
          <circle r="2.5" fill="#C9A050" opacity="0.7" />
        </g>
        {/* paper plane */}
        <g ref={planeRef} className="nf-plane">
          <path d="M 16 0 L -12 -9 L -5 0 L -12 9 Z" fill="#1C1426" />
          <path d="M -5 0 L -12 9 L -3 4 Z" fill="#5B3FA8" />
        </g>
      </svg>

      {/* glass card */}
      <div className="nf-card">
        <span className="nf-eyebrow">Squawk 7700 · off route</span>
        <div className="nf-code" aria-hidden>404</div>
        <h1 className="nf-title">This flight never departed.</h1>
        <p className="nf-sub">
          The route you asked for isn&apos;t on any dispatch sheet — it may have been
          re-timed, cancelled, or it never existed. Let&apos;s get you back to a real gate.
        </p>
        <div className="nf-actions">
          <Link href="/" className="nf-btn nf-btn--solid">Back to the tower</Link>
          <Link href="/simulator" className="nf-btn nf-btn--ghost">Launch the simulator</Link>
        </div>
      </div>

      <style>{`
        .nf-root {
          position: relative; min-height: 100vh; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background:
            radial-gradient(120% 90% at 20% 10%, rgba(139,111,208,0.14), transparent 55%),
            radial-gradient(100% 80% at 90% 90%, rgba(201,160,80,0.12), transparent 55%),
            #17111f;
          font-family: var(--ae-font-body, system-ui, sans-serif);
          padding: 24px;
        }
        .nf-sky { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
        .nf-plane { filter: drop-shadow(0 4px 10px rgba(0,0,0,0.4)); }

        .nf-card {
          position: relative; z-index: 2; text-align: center;
          max-width: 560px; width: 100%;
          padding: clamp(30px, 5vw, 52px);
          border-radius: 22px;
          background: rgba(30,22,42,0.55);
          border: 1px solid rgba(201,160,80,0.22);
          box-shadow: 0 30px 90px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
          backdrop-filter: blur(18px) saturate(1.2);
          -webkit-backdrop-filter: blur(18px) saturate(1.2);
        }
        .nf-eyebrow {
          font-family: var(--ae-font-mono, ui-monospace, monospace);
          font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;
          color: #C9A050;
        }
        .nf-code {
          font-family: var(--ae-font-display, var(--ae-font-body, sans-serif));
          font-weight: 800; letter-spacing: -0.04em; line-height: 0.9;
          font-size: clamp(96px, 20vw, 190px);
          margin: 6px 0 2px;
          background: linear-gradient(120deg, #F1ECE1 0%, #B9A6E6 45%, #C9A050 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .nf-title {
          margin: 0 0 12px; color: #F1ECE1;
          font-family: var(--ae-font-display, sans-serif); font-weight: 700;
          font-size: clamp(20px, 3vw, 28px); letter-spacing: -0.01em;
        }
        .nf-sub { margin: 0 auto 26px; max-width: 440px; color: #A79FB6; font-size: 14.5px; line-height: 1.6; }
        .nf-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .nf-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 12px 22px; border-radius: 999px; font-size: 14px; font-weight: 650;
          text-decoration: none; cursor: pointer;
          transition: transform 160ms ease, filter 160ms ease, background 160ms ease;
        }
        .nf-btn:hover { transform: translateY(-2px); }
        .nf-btn--solid { background: #5B3FA8; color: #fff; }
        .nf-btn--solid:hover { filter: brightness(1.14); }
        .nf-btn--ghost { background: transparent; color: #F1ECE1; border: 1px solid rgba(241,236,225,0.28); }
        .nf-btn--ghost:hover { border-color: #C9A050; color: #C9A050; }

        @media (prefers-reduced-motion: reduce) { .nf-plane { display: none; } }
      `}</style>
    </main>
  )
}
