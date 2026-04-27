import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Aeolus — Airline Disruption Recovery Engine",
  description:
    "Real-time simulation and recovery optimizer for airline disruptions. $34B annual problem solved.",
  openGraph: {
    title: "Aeolus",
    description: "Airline disruption simulation and recovery engine",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster
            theme="light"
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                fontFamily: "Inter, sans-serif",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
