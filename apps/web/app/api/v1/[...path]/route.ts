/**
 * Server-side proxy for all /api/v1/* requests.
 *
 * The browser always calls same-origin /api/v1/... — no CORS, no baked-in URL.
 * This route reads API_URL at request time (not build time), so setting it in
 * Vercel's environment dashboard takes effect on the next invocation without
 * a redeploy.
 *
 * Set API_URL in Vercel → Settings → Environment Variables:
 *   API_URL = https://your-railway-api-url.up.railway.app
 *
 * WebSocket still needs NEXT_PUBLIC_API_URL or NEXT_PUBLIC_WS_URL set in
 * the Vercel build environment (baked at build time by Next.js).
 */
import { NextRequest, NextResponse } from "next/server"
import { getBackendUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function proxyTimeoutMs(): number {
  const configured = Number(process.env.API_PROXY_TIMEOUT_MS || 55_000)
  if (!Number.isFinite(configured)) return 55_000
  return Math.min(55_000, Math.max(1_000, configured))
}

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const backend = getBackendUrl()
  if (!backend) {
    return NextResponse.json(
      {
        detail:
          "API backend is not configured. Set API_URL to the Railway service URL in Vercel.",
      },
      { status: 503 }
    )
  }

  const encodedPath = path.map((part) => encodeURIComponent(part)).join("/")
  const url = `${backend}/api/v1/${encodedPath}${req.nextUrl.search}`

  const init: RequestInit = { method: req.method }

  const ct = req.headers.get("content-type")
  if (ct) init.headers = { "content-type": ct }

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer()
  }

  // Recovery solves can legitimately take longer than a cold Railway startup.
  // Keep this just under maxDuration so the proxy can return a structured 504.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), proxyTimeoutMs())

  try {
    const upstream = await fetch(url, { ...init, signal: controller.signal })
    const body = await upstream.arrayBuffer()
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    })
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "AbortError"
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        detail: isTimeout
          ? "The API did not respond before the proxy timeout. Check Railway logs and service health."
          : `Unable to reach the API backend: ${message}`,
      },
      { status: isTimeout ? 504 : 502 }
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(req, (await params).path)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(req, (await params).path)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(req, (await params).path)
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  })
}
