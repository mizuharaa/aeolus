"use client"
import { useEffect, useRef, useState } from "react"
import { useSimulationStore } from "@/stores/simulation"

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"

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
