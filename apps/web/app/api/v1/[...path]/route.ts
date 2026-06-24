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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BACKEND = () => {
  const raw = process.env.API_URL || "http://localhost:8000"
  return raw.startsWith("http") ? raw : `https://${raw}`
}

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const url = `${BACKEND()}/api/v1/${path.join("/")}${req.nextUrl.search}`

  const init: RequestInit = { method: req.method }

  const ct = req.headers.get("content-type")
  if (ct) init.headers = { "content-type": ct }

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer()
  }

  // 9-second abort so the Vercel function always responds before its 10s
  // default timeout — prevents HTTP 000 (connection dropped) on slow upstreams.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9000)

  try {
    const upstream = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timer)
    const body = await upstream.arrayBuffer()
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    })
  } catch (e) {
    clearTimeout(timer)
    const isTimeout = e instanceof Error && e.name === "AbortError"
    return NextResponse.json(
      { detail: isTimeout ? "upstream timeout" : `Proxy error: ${String(e)}` },
      { status: isTimeout ? 504 : 502 }
    )
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
