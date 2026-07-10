const API_PREFIX_RE = /\/api\/v1\/?$/i

function withDefaultScheme(raw: string): string {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
}

/** Normalize a configured API origin without hiding invalid configuration. */
export function normalizeBackendUrl(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  try {
    const url = new URL(withDefaultScheme(value))
    if (url.protocol !== "http:" && url.protocol !== "https:") return null

    url.hash = ""
    url.search = ""
    url.pathname = url.pathname.replace(API_PREFIX_RE, "").replace(/\/+$/, "")
    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

export function toWebSocketUrl(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  try {
    const url = new URL(withDefaultScheme(value))
    if (url.protocol === "http:") url.protocol = "ws:"
    else if (url.protocol === "https:") url.protocol = "wss:"
    else if (url.protocol !== "ws:" && url.protocol !== "wss:") return null

    url.hash = ""
    url.search = ""
    url.pathname = url.pathname.replace(API_PREFIX_RE, "").replace(/\/+$/, "")
    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}
