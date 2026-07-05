import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service — Aeolus",
  description: "Terms for using the Aeolus airline-disruption simulator, a research artifact provided as-is.",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 4, 2026">
      <p>
        These terms govern your use of the Aeolus web application and simulator.
        By using Aeolus you agree to them. Aeolus is an open-source research and
        demonstration project, not a commercial product.
      </p>

      <h2>1. What Aeolus is</h2>
      <p>
        Aeolus simulates airline disruptions and computes recovery plans for a
        <strong> fictional carrier, &quot;Nimbus Air&quot;</strong>. It is a
        modelling and educational tool. It is <strong>not</strong> certified
        operational software, is not a substitute for a real airline Operations
        Control Center, and must not be used to make real-world flight, dispatch,
        crew, or safety decisions.
      </p>

      <h2>2. No warranty</h2>
      <p>
        Aeolus is provided <strong>&quot;as is&quot; and &quot;as available&quot;,
        without warranties of any kind</strong>, express or implied, including
        merchantability, fitness for a particular purpose, and non-infringement.
        Outputs — cascades, cost figures, crew-legality flags, carbon estimates —
        are illustrative model results and may be inaccurate or incomplete.
      </p>

      <h2>3. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, the maintainers are not liable
        for any direct, indirect, incidental, consequential, or special damages
        arising from your use of, or inability to use, Aeolus — including any
        reliance on its outputs.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not use Aeolus for any unlawful purpose or to violate anyone&apos;s rights.</li>
        <li>Do not attempt to disrupt, overload, or compromise the service or the public data sources it relies on.</li>
        <li>Do not represent Aeolus outputs as authoritative operational guidance.</li>
      </ul>

      <h2>5. Open-source license</h2>
      <p>
        The Aeolus source code is released under the <strong>Apache License
        2.0</strong>. Your use, modification, and redistribution of the code are
        governed by that license, which controls over these terms where they
        differ regarding the code itself.
      </p>

      <h2>6. Third-party data & services</h2>
      <p>
        Aeolus displays public data (FAA, NWS/NOAA, open ADS-B) and uses
        third-party fonts and map tiles, each subject to its own terms. We make no
        warranty about the availability or accuracy of those third-party sources.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may revise these terms as the project develops. Continued use after an
        update constitutes acceptance of the revised terms; the &quot;last
        updated&quot; date reflects the current version.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions can be raised via the project&apos;s public repository. See also
        our <a href="/privacy">Privacy Policy</a> and <a href="/cookies">Cookie
        Policy</a>.
      </p>
    </LegalPage>
  )
}
