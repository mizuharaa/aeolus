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
        {/*
          Browser-extension noise filter — runs before ANY other JavaScript.
          MetaMask injects `chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/scripts/inpage.js`
          into every page and throws `Failed to connect to MetaMask` when its
          service worker is asleep. We don't import any Web3 / wallet code
          anywhere in Aeolus, so we silently swallow those errors before
          Next's dev overlay can pop them up as if they were our bug.
          MUST be inline + `<head>` so it registers before extension scripts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              function isExt(s){
                if(!s) return false;
                var t = typeof s === 'string' ? s : (s && s.stack ? s.message + ' ' + s.stack : (s && s.message ? s.message : ''));
                return t && (
                  t.indexOf('chrome-extension://') !== -1 ||
                  t.indexOf('moz-extension://') !== -1 ||
                  t.indexOf('safari-extension://') !== -1 ||
                  t.indexOf('Failed to connect to MetaMask') !== -1 ||
                  t.indexOf('MetaMask') !== -1
                );
              }
              window.addEventListener('error', function(e){
                if (isExt(e.error) || isExt(e.message) || (e.filename && e.filename.indexOf('-extension://') !== -1)){
                  e.preventDefault(); e.stopImmediatePropagation();
                }
              }, true);
              window.addEventListener('unhandledrejection', function(e){
                if (isExt(e.reason)){
                  e.preventDefault(); e.stopImmediatePropagation();
                }
              }, true);
              // Next.js dev overlay also pipes console.error → overlay; filter that too.
              var origErr = console.error;
              console.error = function(){
                for (var i=0;i<arguments.length;i++){ if (isExt(arguments[i])) return; }
                return origErr.apply(this, arguments);
              };
            })();`,
          }}
        />
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
