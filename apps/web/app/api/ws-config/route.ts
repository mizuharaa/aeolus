/**
 * Returns the WebSocket base URL to the browser at request time.
 *
 * This lets the client discover the Railway WS endpoint without needing
 * NEXT_PUBLIC_WS_URL baked into the build. The server reads API_URL (which
 * is already required for the REST proxy) and converts http→ws / https→wss.
 *
 * The client in lib/websocket.ts calls this route when no NEXT_PUBLIC_* env
 * var was embedded at build time.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const raw = process.env.API_URL || ""
  if (!raw) return NextResponse.json({ wsUrl: null })
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`
  const wsUrl = withScheme.replace(/^http/, "ws")
  return NextResponse.json({ wsUrl })
}
