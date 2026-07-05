import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy — Aeolus",
  description: "How Aeolus handles data. Aeolus is a research artifact that stores only first-party functional data.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 4, 2026">
      <p>
        Aeolus is an open-source airline-disruption simulation and recovery
        engine, published as a research and demonstration artifact. This policy
        explains what data the Aeolus web application handles and why. It is
        written to be plain and honest — Aeolus is deliberately built to collect
        as little as possible.
      </p>

      <h2>1. Who we are</h2>
      <p>
        &quot;Aeolus&quot;, &quot;we&quot;, and &quot;our&quot; refer to the maintainers of the
        Aeolus project. The simulator models a fictional carrier, &quot;Nimbus
        Air&quot;, and does not process real passenger, booking, or ticketing data.
      </p>

      <h2>2. What we collect</h2>
      <p>Aeolus is designed to run without accounts and without a tracking backend. The application stores:</p>
      <ul>
        <li>
          <strong>Functional preferences</strong> kept in your browser&apos;s local
          storage on your device — for example your theme, whether the map is in
          focus mode, whether the simulator side rail is collapsed, and your
          cookie choice. These never leave your browser.
        </li>
        <li>
          <strong>Simulation state</strong> you generate while using the tool
          (events you trigger, recovery plans you inspect). This is synthetic and
          is held in memory / your session only.
        </li>
        <li>
          <strong>Standard server logs</strong> if you use a hosted deployment —
          such as IP address, timestamp, and requested URL — retained transiently
          for security and to keep the service running. We do not build profiles
          from these.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> collect names, email addresses, payment
        details, or precise location, and we do not sell data to anyone.
      </p>

      <h2>3. Third-party services</h2>
      <p>
        To render the experience, Aeolus may request assets and public data from
        third parties, subject to their own privacy terms:
      </p>
      <ul>
        <li><strong>Fonts</strong> — Google Fonts and rsms.me deliver the typefaces.</li>
        <li><strong>Map tiles</strong> — CARTO / OpenStreetMap serve the base map in the simulator.</li>
        <li><strong>Public aviation data</strong> — FAA NAS status, NWS/NOAA weather, and open ADS-B feeds provide live context. These are public, non-personal datasets.</li>
      </ul>

      <h2>4. Legal bases (GDPR)</h2>
      <p>
        Where the EU/UK GDPR applies, our processing of functional storage rests
        on your <strong>consent</strong> (which you may withdraw at any time by
        clearing your browser storage) and, for transient security logs, on our
        <strong> legitimate interest</strong> in operating a secure service.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Because Aeolus does not maintain user accounts or personal records, there
        is generally no personal profile to access, correct, or delete. You can
        clear all locally stored preferences at any time from your browser
        settings. If a specific hosted deployment holds data about you, contact
        that deployment&apos;s operator to exercise your access, rectification,
        erasure, restriction, portability, and objection rights.
      </p>

      <h2>6. Data retention & security</h2>
      <p>
        Local preferences persist on your device until you clear them. Transient
        server logs are kept only as long as needed for security and diagnostics.
        We take reasonable technical measures to protect the service, but no
        internet transmission is ever perfectly secure.
      </p>

      <h2>7. Children</h2>
      <p>Aeolus is a technical tool not directed to children under 16, and we do not knowingly collect their data.</p>

      <h2>8. Changes</h2>
      <p>
        We may update this policy as the project evolves; the &quot;last
        updated&quot; date above always reflects the current version.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about this policy can be raised through the project&apos;s public
        repository issue tracker. See also our <a href="/cookies">Cookie Policy</a>{" "}
        and <a href="/terms">Terms of Service</a>.
      </p>
    </LegalPage>
  )
}
