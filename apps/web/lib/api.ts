const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const apiClient = {
  async get<T = unknown>(path: string): Promise<{ data: T }> {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return { data: (await res.json()) as T }
  },

  async post<T = unknown>(path: string, body?: unknown): Promise<{ data: T }> {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { detail?: string }).detail || `API error: ${res.status}`)
    }
    return { data: (await res.json()) as T }
  },

  async del<T = unknown>(path: string): Promise<{ data: T }> {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return { data: (await res.json()) as T }
  },
}
