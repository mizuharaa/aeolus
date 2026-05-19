"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

// NOTE: Browser-extension error filtering lives in `app/layout.tsx` as an
// inline `<head>` script so it registers BEFORE third-party extension code
// (notably MetaMask's `inpage.js`) gets a chance to throw on page load.
// Adding it here in a `useEffect` is too late — the error has already fired
// by the time React hydrates.

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
