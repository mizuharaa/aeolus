import { normalizeBackendUrl } from "@/lib/backend-url"

/** Resolve the server-side Railway target. API_URL remains the preferred name. */
export function getBackendUrl(): string | null {
  const configured = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL
  if (configured) return normalizeBackendUrl(configured)
  return process.env.NODE_ENV === "development" ? "http://localhost:8000" : null
}
