import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "sonner"
import { CookieConsent } from "@/components/legal/cookie-consent"
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { themeInitScript } from "@/lib/use-theme";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", inter.variable)}>
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
        {/*
          Console register, stamped BEFORE first paint.

          The choice lives in localStorage, which a React effect can only read
          after hydration — so without this the console would paint its default
          register and then correct, i.e. a full-viewport flash of near-black or
          near-white on every load. On a surface someone watches for a whole
          shift, at night, that is not a cosmetic detail.

          Inline and synchronous on purpose: a deferred or external script would
          run after the first paint and reintroduce exactly the flash it exists
          to prevent. Source of truth is lib/use-theme.ts, which adopts whatever
          this stamped rather than re-deciding.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://rsms.me" crossOrigin="anonymous" />
        {/*
          ONE typeface family: Inter (+ Inter Display, its optical-size
          variant for headlines) served variable from rsms.me. JetBrains
          Mono is reserved for code blocks, flight IDs, and tabular ops
          data — it is not a display font.
        */}
        <link href="https://rsms.me/inter/inter.css" rel="stylesheet" />
        {/*
          JetBrains Mono — code, flight IDs, tabular ops data. Fraunces was
          dropped with the italic-serif accent: two families, not three, and
          one fewer blocking stylesheet on first paint.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className="min-h-screen">
        <Providers>
          {children}
          <CookieConsent />
          {/* bottom-right, not top-right: at top-right the toast landed on the
              ops bar's own right cluster and covered Ask Aeolus, the LIVE state
              and Reset — arrival notices obscuring the controls they should
              never compete with. The workspace's bottom-right is the docked
              Recovery track, which the toast is allowed to overlay briefly
              because it is transient and dismissible; the nav is not. */}
          <Toaster
            position="bottom-right"
            closeButton
            offset={16}
            // expand: without it Sonner renders a COLLAPSED stack and every
            // toast's close button lands on the same 20x20 square, so only the
            // front one is clickable and the rest are unreachable by pointer.
            expand
            toastOptions={{
              style: {
                fontFamily: 'Inter, "Inter Display", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 10,
                background: "var(--ae-surface)",
                color: "var(--ae-text)",
                border: "1px solid var(--ae-line)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
