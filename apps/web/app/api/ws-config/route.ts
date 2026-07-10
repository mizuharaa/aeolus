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
import { getBackendUrl } from "@/lib/backend-config"
import { toWebSocketUrl } from "@/lib/backend-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const wsUrl =
    toWebSocketUrl(process.env.NEXT_PUBLIC_WS_URL) ??
    toWebSocketUrl(getBackendUrl() ?? undefined)
  return NextResponse.json({ wsUrl })
}
