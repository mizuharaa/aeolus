"use client"
import { useEffect, useRef, useState } from "react"
import { useSimulationStore } from "@/stores/simulation"

// Prefer an explicit NEXT_PUBLIC_WS_URL. If it's missing but the API URL is
// set (the common deploy case), derive the WS origin from it — http→ws,
// https→wss — so a single forgotten env var can't silently point the socket
// back at localhost. Falls back to localhost only for local dev.
function resolveWsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL
  if (explicit) return explicit
  const api = process.env.NEXT_PUBLIC_API_URL
  if (api) return api.replace(/^http/, "ws")
  return "ws://localhost:8000"
}

const WS_URL = resolveWsUrl()

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { setUpdate } = useSimulationStore()
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const pingTimer = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined
  )
  const isMounted = useRef(true)

  const connect = () => {
    if (!isMounted.current) return
    try {
      const socket = new WebSocket(`${WS_URL}/ws/simulation`)
      ws.current = socket

      socket.onopen = () => {
        if (!isMounted.current) return
        setIsConnected(true)
        // Ping every 25s to keep connection alive
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
        // Reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3_000)
      }

      socket.onerror = () => {
        socket.close()
      }
    } catch (e) {
      if (!isMounted.current) return
      setIsConnected(false)
      reconnectTimer.current = setTimeout(connect, 5_000)
    }
  }

  useEffect(() => {
    isMounted.current = true
    connect()

    return () => {
      isMounted.current = false
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      if (ws.current) {
        ws.current.onclose = null // Prevent reconnect on intentional close
        ws.current.close()
        ws.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isConnected }
}
