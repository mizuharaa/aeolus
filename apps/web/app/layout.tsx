import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Aeolus — Nimbus Air OCC",
  description: "Real-time aircraft disruption simulation and recovery engine.",
  openGraph: {
    title: "Aeolus — Nimbus Air OCC",
    description: "Real-time aircraft disruption simulation and recovery engine.",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Inter Display + Inter is the documented open-source substitute for
          Haas Groot Disp / Haas Grotesk (per DESIGN.md). Loaded at the unusual
          mid-weights 400 / 475 / 500 / 575 to match the Airtable type stack —
          notably 475 and 575 power the pricing-page sub-system signature.
          JetBrains Mono for delay-minute / cost / flight-ID monospace cells.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;475;500;575;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/*
          "Inter Display" is the optical-size-tuned variant from rsms.me. Loaded
          separately so display headlines pick up the tighter cap-height while
          body text uses the standard Inter.
        */}
        <link
          href="https://rsms.me/inter/inter.css"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className="min-h-screen">
        <Providers>
          {children}
          <Toaster
            theme="light"
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                fontFamily: 'Inter, "Inter Display", system-ui, sans-serif',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 10,
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
