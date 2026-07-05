import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Cookie Policy — Aeolus",
  description: "The first-party functional storage Aeolus uses, and how to control it.",
}

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="July 4, 2026">
      <p>
        This policy explains the cookies and cookie-like browser storage Aeolus
        uses. In short: Aeolus uses only <strong>first-party functional
        storage</strong> to remember your preferences. It sets no advertising
        cookies and performs no cross-site tracking.
      </p>

      <h2>1. What these technologies are</h2>
      <p>
        &quot;Cookies&quot; are small files a site stores in your browser.
        &quot;Local storage&quot; is a similar browser mechanism for keeping small
        values on your device. Aeolus relies mainly on <strong>local
        storage</strong> rather than traditional cookies.
      </p>

      <h2>2. What Aeolus stores</h2>
      <ul>
        <li><code>aeolus-cookie-consent</code> — your choice on this banner (Accept all / Essential only), so we don&apos;t ask again.</li>
        <li><code>aeolus-theme</code> — light/dark preference, where applicable.</li>
        <li><code>aeolus-map-focused</code> — whether the simulator map is in focus mode.</li>
        <li><code>aeolus-rail-collapsed</code> — whether the simulator side navigation is collapsed.</li>
      </ul>
      <p>
        All of the above are <strong>strictly functional</strong>: they exist to
        make the interface remember how you like it, and they never leave your
        device.
      </p>

      <h2>3. What Aeolus does not use</h2>
      <ul>
        <li>No advertising or marketing cookies.</li>
        <li>No cross-site or third-party tracking pixels.</li>
        <li>No fingerprinting or ad-network identifiers.</li>
      </ul>
      <p>
        Third parties that serve fonts and map tiles (Google Fonts, rsms.me,
        CARTO/OpenStreetMap) may set their own technical cookies under their own
        policies; Aeolus does not read or share them.
      </p>

      <h2>4. Managing your choices</h2>
      <p>
        You can change or revoke consent at any time by clearing this site&apos;s
        storage in your browser settings — the consent banner will reappear on
        your next visit. Because the stored values are strictly functional,
        clearing them simply resets your interface preferences.
      </p>

      <h2>5. More information</h2>
      <p>
        See our <a href="/privacy">Privacy Policy</a> for the full picture of how
        Aeolus handles data, and our <a href="/terms">Terms of Service</a> for the
        terms of use.
      </p>
    </LegalPage>
  )
}
