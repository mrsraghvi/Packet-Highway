import React, { useState, useEffect, useRef } from 'react'
import Scene, { VEHICLE_CATALOG } from './Scene.jsx'
import { usePacketSocket } from './usePacketSocket.js'
import './styles.css'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUptime(seconds) {
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function App() {
  const { lastEvent, connected, stats } = usePacketSocket('ws://localhost:8765')
  const [selected, setSelected] = useState(null)

  // rolling rate calculation (packets/sec, bytes/sec) over a 1s window
  const [rates, setRates] = useState({ pps: 0, bytesIn: 0, bytesOut: 0 })
  const windowRef = useRef([])
  const totalsRef = useRef({ totalIn: 0, totalOut: 0, uptime: 0 })

  useEffect(() => {
    if (!lastEvent) return
    const now = performance.now()
    windowRef.current.push({ t: now, size: lastEvent.size, lane: lastEvent.lane })
    if (lastEvent.totalIn != null) totalsRef.current.totalIn = lastEvent.totalIn
    if (lastEvent.totalOut != null) totalsRef.current.totalOut = lastEvent.totalOut
    if (lastEvent.uptime != null) totalsRef.current.uptime = lastEvent.uptime
  }, [lastEvent])

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now()
      windowRef.current = windowRef.current.filter((e) => now - e.t < 1000)
      const bytesIn = windowRef.current
        .filter((e) => e.lane % 2 === 0)
        .reduce((a, e) => a + e.size, 0)
      const bytesOut = windowRef.current
        .filter((e) => e.lane % 2 === 1)
        .reduce((a, e) => a + e.size, 0)
      setRates({ pps: windowRef.current.length, bytesIn, bytesOut })
    }, 500)
    return () => clearInterval(id)
  }, [])

  const totalBytes = totalsRef.current.totalIn + totalsRef.current.totalOut
  const inPct = totalBytes > 0 ? Math.round((totalsRef.current.totalIn / totalBytes) * 100) : 0

  return (
    <div className="app">
      <Scene lastEvent={lastEvent} onSelect={setSelected} />

      {/* Top-left: title + live stats */}
      <div className="hud hud-stats">
        <div className="hud-title-row">
          <span className="hud-title">PACKET HIGHWAY</span>
          <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? `LIVE · running ${formatUptime(totalsRef.current.uptime)}` : 'OFFLINE'}
          </span>
        </div>

        <div className="stat-row">
          <span className="stat-label">packets/s</span>
          <span className="stat-value">
            <span className="dir-in">↓ {rates.pps}</span>
            <span className="dir-out">↑ {Math.max(0, rates.pps - Math.round(rates.pps * 0.4))}</span>
          </span>
        </div>

        <div className="stat-row">
          <span className="stat-label">traffic/s</span>
          <span className="stat-value">
            <span className="dir-in">{formatBytes(rates.bytesIn)}</span>
            <span className="dir-out">{formatBytes(rates.bytesOut)}</span>
          </span>
        </div>

        <div className="stat-row">
          <span className="stat-label">on link</span>
          <span className="stat-value link-bar">
            <span className="link-pct">{stats.total}</span>
            <span className="link-pct-right">{inPct}%</span>
          </span>
        </div>
        <div className="link-bar-track">
          <div className="link-bar-fill" style={{ width: `${inPct}%` }} />
        </div>
      </div>

      {/* Top-right: legend */}
      <div className="hud hud-legend">
        <div className="legend-title">WHO'S DRIVING</div>
        {Object.entries(VEHICLE_CATALOG).map(([key, def]) => (
          <div className="legend-row" key={key}>
            <span className="legend-dot" style={{ background: def.color }} />
            <span className="legend-name">{def.label}</span>
            <span className="legend-proto">{def.proto}</span>
          </div>
        ))}
      </div>

      {/* Selected packet inspector */}
      {selected && (
        <div className="hud hud-inspector">
          <button className="close-btn" onClick={() => setSelected(null)}>×</button>
          <h2>Packet Details</h2>
          <div><strong>Vehicle:</strong> {VEHICLE_CATALOG[selected.vehicle]?.label || selected.vehicle}</div>
          <div><strong>Protocol:</strong> {selected.protocol}</div>
          <div><strong>Source:</strong> {selected.src}:{selected.sport ?? '-'}</div>
          <div><strong>Destination:</strong> {selected.dst}:{selected.dport ?? '-'}</div>
          <div><strong>Size:</strong> {selected.size} bytes</div>
        </div>
      )}

      {!connected && (
        <div className="hud hud-banner">
          Waiting for backend at ws://localhost:8765 — start <code>sniffer.py</code> (sudo) or <code>mock_server.py</code>
        </div>
      )}
    </div>
  )
}
