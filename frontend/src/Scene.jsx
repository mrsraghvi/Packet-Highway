import React, { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Environment } from '@react-three/drei'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Vehicle catalogue - matches the "WHO'S DRIVING" legend
// ---------------------------------------------------------------------------
export const VEHICLE_CATALOG = {
  city_bus:  { label: 'City bus',   proto: 'HTTPS', color: '#ffd23f', size: [0.9, 0.55, 2.6] },
  sports_car:{ label: 'Sports car', proto: 'QUIC',  color: '#39ff8a', size: [0.7, 0.35, 1.5] },
  box_truck: { label: 'Box truck',  proto: 'HTTP',  color: '#ff8c2b', size: [0.85, 0.7, 2.2] },
  motorcycle:{ label: 'Motorcycle', proto: 'DNS',   color: '#b388ff', size: [0.45, 0.35, 1.1] },
  taxi:      { label: 'Taxi',       proto: 'SSH',   color: '#ffe066', size: [0.7, 0.4, 1.6] },
  sedan:     { label: 'Sedan',      proto: 'TLS',   color: '#4f9bff', size: [0.7, 0.4, 1.6] },
  panel_van: { label: 'Panel van',  proto: 'ICMP',  color: '#e6e6e6', size: [0.85, 0.6, 1.9] },
  police_car:{ label: 'Police car', proto: 'SMTP',  color: '#ff5577', size: [0.7, 0.4, 1.6] },
  bicycle:   { label: 'Bicycle',    proto: 'ARP',   color: '#5fff8f', size: [0.35, 0.5, 0.9] },
  hatchback: { label: 'Hatchback',  proto: 'OTHER', color: '#6ec3ff', size: [0.65, 0.4, 1.4] },
}

const VEHICLE_KEYS = Object.keys(VEHICLE_CATALOG)
const NUM_LANES = 4
const LANE_WIDTH = 1.1
const ROAD_LENGTH = 60

// ---------------------------------------------------------------------------
// Low-poly vehicle models - built from primitives so each "vehicle" actually
// reads as a car/bus/truck/bike silhouette rather than a plain box.
// ---------------------------------------------------------------------------

const GLASS = '#2a3a55'
const TIRE = '#15191f'
const RIM = '#c4c9d4'

function WheelPair({ x, w, radius = 0.16 }) {
  return (
    <group position={[x, 0, 0]}>
      {[w / 2 + 0.03, -(w / 2 + 0.03)].map((z, i) => (
        <group key={i} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          {/* tire */}
          <mesh>
            <cylinderGeometry args={[radius, radius, 0.13, 20]} />
            <meshStandardMaterial color={TIRE} roughness={0.9} metalness={0.05} />
          </mesh>
          {/* rim */}
          <mesh position={[0, 0, z > 0 ? 0.05 : -0.05]}>
            <cylinderGeometry args={[radius * 0.55, radius * 0.55, 0.04, 12]} />
            <meshStandardMaterial color={RIM} roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function CarModel({ def }) {
  const [w, , l] = def.size
  const bodyH = 0.3
  const cabinH = 0.24
  const wheelR = 0.16
  return (
    <group position={[0, wheelR, 0]}>
      {/* lower body */}
      <mesh castShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[l, bodyH, w]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.35} roughness={0.35} metalness={0.55} />
      </mesh>
      {/* cabin block */}
      <mesh position={[-l * 0.04, bodyH + cabinH / 2, 0]}>
        <boxGeometry args={[l * 0.5, cabinH, w * 0.86]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.35} roughness={0.35} metalness={0.55} />
      </mesh>
      {/* windshield - sloped via rotated plane-like box */}
      <mesh
        position={[l * 0.18, bodyH + cabinH * 0.55, 0]}
        rotation={[0, 0, -0.55]}
      >
        <boxGeometry args={[cabinH * 1.1, 0.03, w * 0.82]} />
        <meshStandardMaterial color={GLASS} emissive="#bfe7ff" emissiveIntensity={0.15} roughness={0.1} metalness={0.4} />
      </mesh>
      {/* rear window - sloped the other way */}
      <mesh
        position={[-l * 0.27, bodyH + cabinH * 0.55, 0]}
        rotation={[0, 0, 0.5]}
      >
        <boxGeometry args={[cabinH * 0.9, 0.03, w * 0.82]} />
        <meshStandardMaterial color={GLASS} emissive="#bfe7ff" emissiveIntensity={0.15} roughness={0.1} metalness={0.4} />
      </mesh>
      {/* roof panel */}
      <mesh position={[-l * 0.04, bodyH + cabinH + 0.005, 0]}>
        <boxGeometry args={[l * 0.32, 0.02, w * 0.82]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.35} roughness={0.35} metalness={0.55} />
      </mesh>
      {/* side mirrors */}
      {[w / 2 + 0.04, -(w / 2 + 0.04)].map((z, i) => (
        <mesh key={i} position={[l * 0.18, bodyH + cabinH * 0.5, z]}>
          <boxGeometry args={[0.05, 0.03, 0.03]} />
          <meshStandardMaterial color="#222222" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      <WheelPair x={l * 0.32} w={w} radius={wheelR} />
      <WheelPair x={-l * 0.32} w={w} radius={wheelR} />
      <mesh position={[l / 2 + 0.01, bodyH * 0.6, w * 0.3]}>
        <boxGeometry args={[0.02, 0.06, 0.12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[l / 2 + 0.01, bodyH * 0.6, -w * 0.3]}>
        <boxGeometry args={[0.02, 0.06, 0.12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[-l / 2 - 0.01, bodyH * 0.6, w * 0.3]}>
        <boxGeometry args={[0.02, 0.06, 0.12]} />
        <meshBasicMaterial color="#ff3344" toneMapped={false} />
      </mesh>
      <mesh position={[-l / 2 - 0.01, bodyH * 0.6, -w * 0.3]}>
        <boxGeometry args={[0.02, 0.06, 0.12]} />
        <meshBasicMaterial color="#ff3344" toneMapped={false} />
      </mesh>
    </group>
  )
}

function BusModel({ def }) {
  const [w, , l] = def.size
  const bodyH = 0.62
  const wheelR = 0.2
  return (
    <group position={[0, wheelR, 0]}>
      <mesh castShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[l, bodyH, w]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.3} roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[0, bodyH * 0.62, w / 2 - 0.01]}>
        <boxGeometry args={[l * 0.88, bodyH * 0.32, 0.02]} />
        <meshStandardMaterial color={GLASS} emissive="#bfe7ff" emissiveIntensity={0.2} roughness={0.1} metalness={0.4} />
      </mesh>
      <mesh position={[0, bodyH * 0.62, -(w / 2 - 0.01)]}>
        <boxGeometry args={[l * 0.88, bodyH * 0.32, 0.02]} />
        <meshStandardMaterial color={GLASS} emissive="#bfe7ff" emissiveIntensity={0.2} roughness={0.1} metalness={0.4} />
      </mesh>
      <mesh position={[0, bodyH + 0.01, 0]}>
        <boxGeometry args={[l, 0.02, w * 0.95]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <WheelPair x={l * 0.32} w={w} radius={wheelR} />
      <WheelPair x={-l * 0.32} w={w} radius={wheelR} />
      <mesh position={[l / 2 + 0.01, bodyH * 0.3, w * 0.3]}>
        <boxGeometry args={[0.02, 0.08, 0.14]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[l / 2 + 0.01, bodyH * 0.3, -w * 0.3]}>
        <boxGeometry args={[0.02, 0.08, 0.14]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[-l / 2 - 0.01, bodyH * 0.3, 0]}>
        <boxGeometry args={[0.02, 0.1, w * 0.7]} />
        <meshBasicMaterial color="#ff3344" toneMapped={false} />
      </mesh>
    </group>
  )
}

function TruckModel({ def }) {
  const [w, , l] = def.size
  const cabH = 0.42
  const boxH = 0.62
  const wheelR = 0.18
  const cabL = l * 0.22
  const boxL = l * 0.7
  return (
    <group position={[0, wheelR, 0]}>
      <mesh castShadow position={[l / 2 - cabL / 2, cabH / 2, 0]}>
        <boxGeometry args={[cabL, cabH, w * 0.92]} />
        <meshStandardMaterial color="#3a4250" emissive="#3a4250" emissiveIntensity={0.15} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[l / 2 - cabL * 0.25, cabH - 0.02, 0]}>
        <boxGeometry args={[cabL * 0.5, 0.05, w * 0.86]} />
        <meshStandardMaterial color={GLASS} emissive="#bfe7ff" emissiveIntensity={0.15} roughness={0.1} metalness={0.4} />
      </mesh>
      <mesh castShadow position={[l / 2 - cabL - boxL / 2 - 0.05, boxH / 2, 0]}>
        <boxGeometry args={[boxL, boxH, w]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.3} roughness={0.35} metalness={0.55} />
      </mesh>
      <WheelPair x={l * 0.34} w={w} radius={wheelR} />
      <WheelPair x={-l * 0.1} w={w} radius={wheelR} />
      <WheelPair x={-l * 0.36} w={w} radius={wheelR} />
      <mesh position={[l / 2 + 0.01, cabH * 0.5, w * 0.3]}>
        <boxGeometry args={[0.02, 0.07, 0.12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[l / 2 + 0.01, cabH * 0.5, -w * 0.3]}>
        <boxGeometry args={[0.02, 0.07, 0.12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[-l / 2 - 0.01, boxH * 0.3, 0]}>
        <boxGeometry args={[0.02, 0.1, w * 0.7]} />
        <meshBasicMaterial color="#ff3344" toneMapped={false} />
      </mesh>
    </group>
  )
}

function VanModel({ def }) {
  const [w, , l] = def.size
  const bodyH = 0.52
  const wheelR = 0.17
  return (
    <group position={[0, wheelR, 0]}>
      <mesh castShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[l, bodyH, w]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.25} roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[l / 2 - 0.08, bodyH * 0.7, 0]}>
        <boxGeometry args={[0.05, bodyH * 0.4, w * 0.8]} />
        <meshStandardMaterial color={GLASS} emissive="#bfe7ff" emissiveIntensity={0.15} roughness={0.1} metalness={0.4} />
      </mesh>
      <WheelPair x={l * 0.32} w={w} radius={wheelR} />
      <WheelPair x={-l * 0.32} w={w} radius={wheelR} />
      <mesh position={[l / 2 + 0.01, bodyH * 0.5, w * 0.3]}>
        <boxGeometry args={[0.02, 0.07, 0.12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[l / 2 + 0.01, bodyH * 0.5, -w * 0.3]}>
        <boxGeometry args={[0.02, 0.07, 0.12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[-l / 2 - 0.01, bodyH * 0.5, 0]}>
        <boxGeometry args={[0.02, 0.1, w * 0.7]} />
        <meshBasicMaterial color="#ff3344" toneMapped={false} />
      </mesh>
    </group>
  )
}

function TwoWheelerModel({ def, motor }) {
  const [w, , l] = def.size
  const wheelR = motor ? 0.16 : 0.18
  const bodyH = motor ? 0.22 : 0.16
  return (
    <group position={[0, wheelR, 0]}>
      <mesh castShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[l * 0.7, bodyH, w * 0.4]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.4} roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[-l * 0.12, bodyH + 0.05, 0]}>
        <boxGeometry args={[l * 0.22, 0.06, w * 0.3]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[l * 0.3, bodyH + 0.04, 0]}>
        <boxGeometry args={[0.04, 0.14, w * 0.5]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {[l * 0.32, -l * 0.32].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[wheelR, wheelR, 0.05, 14]} />
          <meshStandardMaterial color={TIRE} />
        </mesh>
      ))}
      <mesh position={[l / 2 + 0.005, bodyH * 0.9, 0]}>
        <boxGeometry args={[0.015, 0.05, 0.05]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[-l / 2 - 0.005, bodyH * 0.9, 0]}>
        <boxGeometry args={[0.015, 0.05, 0.05]} />
        <meshBasicMaterial color="#ff3344" toneMapped={false} />
      </mesh>
    </group>
  )
}

function VehicleModel({ vehicleKey, def }) {
  switch (vehicleKey) {
    case 'city_bus':
      return <BusModel def={def} />
    case 'box_truck':
      return <TruckModel def={def} />
    case 'panel_van':
      return <VanModel def={def} />
    case 'motorcycle':
      return <TwoWheelerModel def={def} motor />
    case 'bicycle':
      return <TwoWheelerModel def={def} />
    default:
      return <CarModel def={def} />
  }
}

// ---------------------------------------------------------------------------
// A single moving vehicle (one packet event)
// ---------------------------------------------------------------------------
function Vehicle({ event, onSelect, onDone }) {
  const ref = useRef()
  const def = VEHICLE_CATALOG[event.vehicle] || VEHICLE_CATALOG.sedan
  const dir = event.direction
  const startX = dir === 1 ? -ROAD_LENGTH / 2 : ROAD_LENGTH / 2
  const endX = -startX
  const speed = (event.speed || 5) * 0.9 * dir
  const laneZ = event.laneZ

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.x += speed * delta
    if ((dir === 1 && ref.current.position.x > endX) || (dir === -1 && ref.current.position.x < endX)) {
      onDone(event._id)
    }
  })

  return (
    <group
      ref={ref}
      position={[startX, 0, laneZ]}
      rotation={[0, dir === 1 ? 0 : Math.PI, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(event) }}
    >
      <VehicleModel vehicleKey={event.vehicle} def={def} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// City skyline - rows of glowing-window towers behind the highway
// ---------------------------------------------------------------------------
function makeWindowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0c1322'
  ctx.fillRect(0, 0, 32, 64)
  for (let y = 2; y < 64; y += 6) {
    for (let x = 2; x < 32; x += 6) {
      if (Math.random() > 0.35) {
        ctx.fillStyle = Math.random() > 0.85 ? '#ffd23f' : '#4f9bff'
        ctx.globalAlpha = 0.5 + Math.random() * 0.5
        ctx.fillRect(x, y, 3, 3)
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  return tex
}

function Building({ position, size, color }) {
  const [w, h, d] = size
  const texture = useMemo(() => makeWindowTexture(), [])

  return (
    <mesh position={position}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} map={texture} emissive="#1a2a4a" emissiveIntensity={0.3} />
    </mesh>
  )
}

function CitySkyline() {
  const buildings = useMemo(() => {
    const arr = []
    const rows = [-22, -18, 22, 18] // two rows on each side
    for (const z of rows) {
      let x = -ROAD_LENGTH / 2 - 5
      while (x < ROAD_LENGTH / 2 + 5) {
        const w = 1.5 + Math.random() * 2
        const h = 3 + Math.random() * 10
        const d = 1.5 + Math.random() * 2
        arr.push({ position: [x, h / 2, z + (Math.random() - 0.5) * 2], size: [w, h, d], color: '#101a30' })
        x += w + Math.random() * 1.5
      }
    }
    return arr
  }, [])

  return (
    <group>
      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Highway: two carriageways (inbound / outbound), lane markings, glowing sign
// ---------------------------------------------------------------------------
function laneZPositions(side) {
  // side: 1 = inbound (positive z block), -1 = outbound (negative z block)
  const positions = []
  for (let i = 0; i < NUM_LANES; i++) {
    positions.push(side * (0.6 + i * LANE_WIDTH))
  }
  return positions
}

const INBOUND_LANES = laneZPositions(1)
const OUTBOUND_LANES = laneZPositions(-1)

function Highway() {
  const totalWidth = (NUM_LANES * LANE_WIDTH + 0.6) * 2 + 0.6 // both carriageways + median

  // dashed lane lines
  const dashes = useMemo(() => {
    const arr = []
    const zs = [...INBOUND_LANES.slice(0, -1).map((z) => z + LANE_WIDTH / 2),
                 ...OUTBOUND_LANES.slice(0, -1).map((z) => z - LANE_WIDTH / 2)]
    for (const z of zs) {
      for (let x = -ROAD_LENGTH / 2; x < ROAD_LENGTH / 2; x += 1.4) {
        arr.push([x, z])
      }
    }
    return arr
  }, [])

  return (
    <group>
      {/* road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[ROAD_LENGTH + 6, totalWidth]} />
        <meshStandardMaterial color="#10182a" />
      </mesh>

      {/* median strip glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[ROAD_LENGTH + 6, 0.5]} />
        <meshBasicMaterial color="#1c2940" />
      </mesh>

      {/* dashed lane markings */}
      {dashes.map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
          <planeGeometry args={[0.7, 0.06]} />
          <meshBasicMaterial color="#3a5a8a" toneMapped={false} />
        </mesh>
      ))}

      {/* edge lines (glowing cyan, like screenshot) */}
      {[INBOUND_LANES[INBOUND_LANES.length - 1] + LANE_WIDTH / 2,
        OUTBOUND_LANES[OUTBOUND_LANES.length - 1] - LANE_WIDTH / 2].map((z, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[ROAD_LENGTH + 6, 0.05]} />
          <meshBasicMaterial color="#5fd0ff" toneMapped={false} />
        </mesh>
      ))}

      {/* PACKET HIGHWAY overhead sign */}
      <group position={[-4, 3.2, 0]}>
        <mesh>
          <boxGeometry args={[8, 1.4, 0.2]} />
          <meshStandardMaterial color="#0d1626" emissive="#0d1626" />
        </mesh>
        <Text
          position={[0, 0, 0.15]}
          fontSize={0.55}
          color="#5fd0ff"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.15}
        >
          PACKET HIGHWAY
        </Text>
        {/* sign posts */}
        <mesh position={[-3.6, -2.3, 0]}>
          <boxGeometry args={[0.15, 3.2, 0.15]} />
          <meshStandardMaterial color="#1a2436" />
        </mesh>
        <mesh position={[3.6, -2.3, 0]}>
          <boxGeometry args={[0.15, 3.2, 0.15]} />
          <meshStandardMaterial color="#1a2436" />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Top-level scene
// ---------------------------------------------------------------------------
export default function Scene({ lastEvent, onSelect }) {
  const [vehicles, setVehicles] = useState([])

  useMemo(() => {
    if (lastEvent) {
      const def = VEHICLE_CATALOG[lastEvent.vehicle] || VEHICLE_CATALOG.sedan
      // assign a direction + lane deterministically from the event's lane index
      const dir = lastEvent.lane % 2 === 0 ? 1 : -1
      const lanes = dir === 1 ? INBOUND_LANES : OUTBOUND_LANES
      const laneZ = lanes[Math.floor(lastEvent.lane / 2) % lanes.length] ?? lanes[0]
      const enriched = { ...lastEvent, direction: dir, laneZ, _def: def }
      setVehicles((prev) => [...prev, enriched].slice(-160))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent])

  const handleDone = (id) => {
    setVehicles((prev) => prev.filter((v) => v._id !== id))
  }

  return (
    <Canvas shadows camera={{ position: [-6, 5, 9], fov: 45 }}>
      <color attach="background" args={['#070b14']} />
      <fog attach="fog" args={['#070b14', 15, 45]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 12, -5]} intensity={0.7} color="#9ec3ff" castShadow />
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#5fd0ff" distance={20} />
      {/* fill lights so metallic car paint picks up some reflection/highlight */}
      <pointLight position={[8, 3, 6]} intensity={0.4} color="#ffffff" distance={25} />
      <pointLight position={[-8, 3, -6]} intensity={0.4} color="#ffd23f" distance={25} />
      <Environment preset="night" />

      <CitySkyline />
      <Highway />

      {vehicles.map((v) => (
        <Vehicle key={v._id} event={v} onSelect={onSelect} onDone={handleDone} />
      ))}
    </Canvas>
  )
}
