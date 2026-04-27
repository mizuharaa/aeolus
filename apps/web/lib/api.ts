const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const apiClient = {
  async get(path: string) {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return { data: await res.json() }
  },

  async post(path: string, body?: any) {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `API error: ${res.status}`)
    }
    return { data: await res.json() }
  },

  async del(path: string) {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return { data: await res.json() }
  },
}
