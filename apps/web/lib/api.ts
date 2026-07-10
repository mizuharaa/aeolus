// Always use same-origin paths so requests go through the server-side proxy
// at app/api/v1/[...path]/route.ts — that route reads API_URL (server-side)
// and forwards to Railway. This keeps Railway's URL off the browser and
// removes any CORS dependency for REST calls.
// Note: NEXT_PUBLIC_API_URL is still used by websocket.ts for WS URL derivation.
const API_URL = ""

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T }> {
  const url = `${API_URL}/api/v1${path.startsWith("/") ? path : `/${path}`}`
  let res: Response

  try {
    res = await fetch(url, { cache: "no-store", ...init })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to reach the Aeolus API (${message})`)
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new Error(payload?.detail || `API request failed with status ${res.status}`)
  }

  if (res.status === 204) return { data: undefined as T }
  return { data: (await res.json()) as T }
}

export const apiClient = {
  async get<T = unknown>(path: string): Promise<{ data: T }> {
    return request<T>(path)
  },

  async post<T = unknown>(path: string, body?: unknown): Promise<{ data: T }> {
    return request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  async del<T = unknown>(path: string): Promise<{ data: T }> {
    return request<T>(path, {
      method: "DELETE",
    })
  },
}
