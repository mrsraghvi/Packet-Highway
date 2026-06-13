import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Connects to the Packet Highway backend WebSocket and exposes
 * incoming packet events plus a running stats summary.
 * Auto-reconnects if the connection drops.
 */
export function usePacketSocket(url = 'ws://localhost:8765') {
  const [lastEvent, setLastEvent] = useState(null)
  const [connected, setConnected] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    byProtocol: {},
    byVehicle: {},
  })
  const wsRef = useRef(null)

  const updateStats = useCallback((event) => {
    setStats((prev) => ({
      total: prev.total + 1,
      byProtocol: {
        ...prev.byProtocol,
        [event.protocol]: (prev.byProtocol[event.protocol] || 0) + 1,
      },
      byVehicle: {
        ...prev.byVehicle,
        [event.vehicle]: (prev.byVehicle[event.vehicle] || 0) + 1,
      },
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    let reconnectTimer

    function connect() {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => !cancelled && setConnected(true)
      ws.onclose = () => {
        if (cancelled) return
        setConnected(false)
        reconnectTimer = setTimeout(connect, 1500)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data)
          setLastEvent({ ...data, _id: crypto.randomUUID() })
          updateStats(data)
        } catch (e) {
          console.error('Bad message', e)
        }
      }
    }

    connect()
    return () => {
      cancelled = true
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [url, updateStats])

  return { lastEvent, connected, stats }
}
