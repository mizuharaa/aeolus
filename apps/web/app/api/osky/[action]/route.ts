/**
 * OpenSky relay.
 *
 * OpenSky's network drops connections from some datacenter IP ranges
 * (e.g. Railway), so the API backend can't reach it directly. This route
 * runs on Vercel's network — which OpenSky *does* allow — and acts as a
 * thin relay: it holds the OAuth2 credentials, fetches the data, and hands
 * the raw OpenSky JSON back to the backend unchanged.
 *
 * Endpoints (the [action] segment):
 *   GET /api/osky/states?lamin&lamax&lomin&lomax[&extended]
 *        → proxies https://opensky-network.org/api/states/all
 *   GET /api/osky/aircraft?icao24&begin&end
 *        → proxies https://opensky-network.org/api/flights/aircraft
 *
 * Auth: set OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET in Vercel env.
 * Optional shared-secret: set OSKY_RELAY_KEY here AND on the backend; the
 * backend must then send it as the `x-relay-key` header or requests are 401'd.
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"
export const dynamic = "force-dynamic"

const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
const API_BASE = "https://opensky-network.org/api"

// Token cache, shared across warm invocations of the same lambda instance.
let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID
  const secret = process.env.OPENSKY_CLIENT_SECRET
  if (!id || !secret) return null
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    // tokens last 30 min; refresh 5 min early
    expires: Date.now() + ((data.expires_in ?? 1800) - 300) * 1000,
  }
  return cachedToken.token
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params

  // Optional shared-secret gate so this relay isn't a public OpenSky proxy.
  const requiredKey = process.env.OSKY_RELAY_KEY
  if (requiredKey && req.headers.get("x-relay-key") !== requiredKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  let target: string

  if (action === "states") {
    const p = new URLSearchParams()
    for (const k of ["lamin", "lamax", "lomin", "lomax", "extended"]) {
      const v = sp.get(k)
      if (v) p.set(k, v)
    }
    target = `${API_BASE}/states/all?${p.toString()}`
  } else if (action === "aircraft") {
    const p = new URLSearchParams()
    for (const k of ["icao24", "begin", "end"]) {
      const v = sp.get(k)
      if (v) p.set(k, v)
    }
    target = `${API_BASE}/flights/aircraft?${p.toString()}`
  } else {
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 404 })
  }

  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  try {
    const res = await fetch(target, { headers, cache: "no-store" })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return NextResponse.json(
      { error: "relay_fetch_failed", detail: String(e) },
      { status: 502 }
    )
  }
}
