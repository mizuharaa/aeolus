"use client"

import Link from "next/link"
import { AeolusMark } from "@/components/ds/logo"

export function LandingFooter() {
  return (
    <footer className="ae-footer-statement">
      <div>
        <h2>
          One disrupted day.
          <br />
          <span>One defensible recovery.</span>
        </h2>

        <div className="ae-footer-meta">
          <Link href="/" className="ae-footer-brand" aria-label="Aeolus home">
            <AeolusMark size={25} />
            <b>AEOLUS</b>
          </Link>

          <nav className="ae-footer-links" aria-label="Footer navigation">
            <Link href="/simulator">Simulator</Link>
            <Link href="/scenarios">Scenarios</Link>
            <Link href="/docs">Methodology</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>

          <p className="ae-footer-note">
            Open-source OCC reference · research artifact · not a substitute for
            production operations software.
            <br />
            Aircraft model created with{" "}
            <a
              href="https://www.meshy.ai/"
              target="_blank"
              rel="noreferrer"
            >
              Meshy
            </a>{" "}
            · CC BY 4.0.
          </p>
        </div>
      </div>
    </footer>
  )
}
