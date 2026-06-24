"use client"
import { useEffect, useRef, useState } from "react"
import { useSimulationStore } from "@/stores/simulation"

/**
 * Resolve the WebSocket base URL in priority order:
 *  1. NEXT_PUBLIC_WS_URL — explicit baked-in override
 *  2. NEXT_PUBLIC_API_URL — baked in, http→ws conversion
 *  3. /api/ws-config     — server-side runtime lookup (reads API_URL env var);
 *                          works even when no NEXT_PUBLIC_* was set at build time
 *  4. ws://localhost:8000 — local dev fallback
 */
async function resolveWsUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_WS_URL
  if (explicit) return explicit
  const api = process.env.NEXT_PUBLIC_API_URL
  if (api) return api.replace(/^http/, "ws")

  try {
    const res = await fetch("/api/ws-config", { cache: "no-store" })
    if (res.ok) {
      const { wsUrl } = (await res.json()) as { wsUrl: string | null }
      if (wsUrl) return wsUrl
    }
  } catch {}

  return "ws://localhost:8000"
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { setUpdate } = useSimulationStore()
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pingTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const isMounted = useRef(true)
  const wsUrlRef = useRef<string | null>(null)

  const connect = (url: string) => {
    if (!isMounted.current) return
    try {
      const socket = new WebSocket(`${url}/ws/simulation`)
      ws.current = socket

      socket.onopen = () => {
        if (!isMounted.current) return
        setIsConnected(true)
        pingTimer.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }))
          }
        }, 25_000)
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.type === "pong" || msg.type === "ping") return
          if (isMounted.current) setUpdate(msg)
        } catch (e) {
          console.warn("[WS] parse error", e)
        }
      }

      socket.onclose = () => {
        if (!isMounted.current) return
        setIsConnected(false)
        clearInterval(pingTimer.current)
        ws.current = null
        reconnectTimer.current = setTimeout(() => {
          if (wsUrlRef.current) connect(wsUrlRef.current)
        }, 3_000)
      }

      socket.onerror = () => {
        socket.close()
      }
    } catch {
      if (!isMounted.current) return
      setIsConnected(false)
      reconnectTimer.current = setTimeout(() => {
        if (wsUrlRef.current) connect(wsUrlRef.current)
      }, 5_000)
    }
  }

  useEffect(() => {
    isMounted.current = true

    resolveWsUrl().then((url) => {
      if (!isMounted.current) return
      wsUrlRef.current = url
      connect(url)
    })

    return () => {
      isMounted.current = false
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      if (ws.current) {
        ws.current.onclose = null
        ws.current.close()
        ws.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isConnected }
}
