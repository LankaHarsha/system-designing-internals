import * as THREE from 'three'
import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { game, buildRoom, demolish, deskX, entranceX, receptionistSpot } from '../game/engine'
import { SLOT_W, FLOOR_H, DEPTH, ELEV_W, SLAB, CORRIDOR_Z, ROOM_TYPES, slotX } from '../game/constants'
import { useGame, syncUI } from '../game/store'
import { B, Cyl, Ball, mat, glowMat, env, sphereGeo, T, nightGlass } from './parts'
import { roomName } from '../game/engine'
import { FURNITURE, Plant, Sofa, Table } from './Furniture'
import Character from './Character'
import { OUTFITS } from './characters'

const FACADE = '#f7f9fd'
const TRIM = '#ffffff'
const ACCENT = T.accent
const BAND = '#e4e9f3'
const INNER_H = FLOOR_H - SLAB

export default function Hotel() {
  const version = useGame((s) => s.snap.structureVersion)
  const floors = useGame((s) => s.snap.floors)
  const width = useGame((s) => s.snap.width)
  const receptionists = useGame((s) => s.snap.staff.receptionist)
  const lw = width * SLOT_W

  const slots = useMemo(() => {
    const list = []
    for (let f = 1; f <= floors; f++) for (let s = 0; s < width; s++) list.push({ floor: f, slot: s, key: `${f}-${s}` })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors, width, version])

  return (
    <group>
      <Shell floors={floors} width={width} />
      <Lobby width={width} receptionists={receptionists} />
      <Elevator floors={floors} />
      {slots.map((s) => (
        <Slot key={`${s.key}-${game.rooms[s.key]?.type || 'empty'}`} {...s} room={game.rooms[s.key]} />
      ))}
      <Roof floors={floors} width={width} />
    </group>
  )
}

// ---------------------------------------------------------------- structural shell
function Shell({ floors, width }) {
  const lw = width * SLOT_W
  const totalW = lw + ELEV_W
  const cx = (lw - ELEV_W) / 2
  const topY = (floors + 1) * FLOOR_H
  const items = []

  // slabs (floor 0 is the ground slab)
  for (let f = 0; f <= floors + 1; f++) {
    const y = f * FLOOR_H
    items.push(<B key={`slab${f}`} args={[lw + 0.3, SLAB, DEPTH + 0.3]} color={TRIM} position={[lw / 2, y - SLAB / 2, 0]} />)
    // a pastel band on the front edge of each slab
    if (f > 0) items.push(<B key={`band${f}`} args={[lw + 0.32, 0.12, 0.06]} color={f === floors + 1 ? ACCENT : BAND} position={[lw / 2, y - SLAB - 0.02, DEPTH / 2 + 0.16]} shadow={false} />)
    // elevator landings
    items.push(<B key={`land${f}`} args={[ELEV_W, SLAB, 1.2]} color={TRIM} position={[-ELEV_W / 2, y - SLAB / 2, DEPTH / 2 - 0.45]} />)
  }
  // exterior side walls
  items.push(<B key="wallL" args={[0.3, topY, DEPTH + 0.3]} color={FACADE} position={[-ELEV_W - 0.15, topY / 2 - SLAB, 0]} />)
  items.push(<B key="wallR" args={[0.3, topY, DEPTH + 0.3]} color={FACADE} position={[lw + 0.15, topY / 2 - SLAB, 0]} />)
  // back exterior wall (thin, behind the room wallpapers)
  items.push(<B key="wallB" args={[totalW + 0.3, topY, 0.12]} color={FACADE} position={[cx, topY / 2 - SLAB, -DEPTH / 2 - 0.1]} />)
  // corner pillars
  for (const x of [-ELEV_W - 0.15, lw + 0.15]) {
    items.push(<B key={`pil${x}`} args={[0.42, topY + 0.1, 0.42]} color={TRIM} position={[x, topY / 2 - SLAB + 0.05, DEPTH / 2 + 0.05]} />)
  }
  // windows on the right side facade
  for (let f = 0; f <= floors; f++) {
    for (const z of [-0.9, 0.7]) {
      items.push(
        <group key={`win${f}${z}`} position={[lw + 0.31, f * FLOOR_H + 1.45, z]}>
          <B args={[0.06, 1.25, 0.95]} color={TRIM} shadow={false} />
          <B args={[0.07, 1.05, 0.75]} m={nightGlass()} shadow={false} />
          <B args={[0.12, 0.08, 1.05]} color={TRIM} position={[0.03, -0.66, 0]} shadow={false} />
        </group>
      )
    }
  }
  // dividers between slots on every room floor
  for (let f = 1; f <= floors; f++) {
    for (let s = 1; s < width; s++) {
      items.push(<B key={`div${f}-${s}`} args={[0.12, INNER_H, CORRIDOR_Z - 0.35 + DEPTH / 2]} color={TRIM} position={[s * SLOT_W, f * FLOOR_H + INNER_H / 2, (-DEPTH / 2 + CORRIDOR_Z - 0.35) / 2]} />)
    }
    // glass balcony railing along the front walkway
    items.push(
      <group key={`rail${f}`}>
        <B args={[lw, 0.5, 0.04]} m={mat('#d8f4f6', { transparent: true, opacity: 0.18, roughness: 0.1 })} position={[lw / 2, f * FLOOR_H + 0.3, DEPTH / 2 + 0.08]} shadow={false} />
        <B args={[lw, 0.06, 0.1]} r={0.02} color={TRIM} position={[lw / 2, f * FLOOR_H + 0.58, DEPTH / 2 + 0.08]} />
      </group>
    )
  }
  return <group>{items}</group>
}

// ---------------------------------------------------------------- lobby
function Lobby({ width, receptionists }) {
  const lw = width * SLOT_W
  const dx = deskX()
  const ex = entranceX()
  const deskW = receptionists * 1.25 + 0.7
  // receptionistSpot(i) sits at dx + (i - 1) * 1.25: centre the desk over the spots in use
  const deskCX = dx + ((receptionists - 1) / 2 - 1) * 1.25
  return (
    <group>
      {/* floor + back wall */}
      <B args={[lw, 0.03, DEPTH]} color="#f6eee3" position={[lw / 2, 0.015, 0]} shadow={false} />
      {Array.from({ length: width * 2 }).map((_, i) => (
        <B key={i} args={[1.6, 0.032, 1.6]} color="#efe2d0" position={[1 + i * 2, 0.017, -0.6 + (i % 2) * 1.6]} shadow={false} />
      ))}
      <B args={[lw, INNER_H, 0.1]} m={mat('#f3ece6', { emissive: '#f3ece6', emissiveIntensity: 0.05 })} position={[lw / 2, INNER_H / 2, -DEPTH / 2 + 0.05]} shadow={false} />
      <B args={[lw, 0.9, 0.06]} color="#e8d7c6" position={[lw / 2, 0.45, -DEPTH / 2 + 0.12]} shadow={false} />
      <B args={[lw, 0.06, 0.1]} color={TRIM} position={[lw / 2, 0.92, -DEPTH / 2 + 0.14]} shadow={false} />

      {/* reception desk */}
      <group position={[deskCX, 0, -0.9]}>
        <B args={[deskW, 0.95, 0.6]} r={0.08} color={ACCENT} position={[0, 0.475, 0]} />
        <B args={[deskW + 0.15, 0.08, 0.72]} r={0.03} color="#e8c896" position={[0, 0.98, 0]} />
        <Cyl args={[0.08, 0.1, 0.06, 12]} color="#e7c46a" position={[deskW / 2 - 0.25, 1.05, 0.15]} />
        <Ball r={0.06} color="#e7c46a" position={[deskW / 2 - 0.25, 1.1, 0.15]} />
        {/* key board on the wall */}
        <B args={[1.6, 0.8, 0.06]} r={0.03} color="#c98a5b" position={[0, 1.75, -0.98]} shadow={false} />
        {Array.from({ length: 8 }).map((_, i) => (
          <Ball key={i} r={0.05} m={glowMat('#ffd36e', 0.2, 1)} position={[-0.6 + (i % 4) * 0.4, 1.9 - Math.floor(i / 4) * 0.3, -0.93]} shadow={false} />
        ))}
      </group>
      {Array.from({ length: receptionists }).map((_, i) => {
        const p = receptionistSpot(i)
        return (
          <Suspense key={i} fallback={<Person position={[p.x, 0, p.z]} color="#e98a6b" hair="#3b2a20" />}>
            <Character outfit={OUTFITS.receptionist[i % OUTFITS.receptionist.length]} position={[p.x, 0, p.z]} />
          </Suspense>
        )
      })}

      {/* waiting lounge on the left */}
      <Sofa position={[1.3, 0, 0.3]} color="#f1b77a" rotation={[0, Math.PI / 2, 0]} />
      <Table position={[2.1, 0, 0.3]} r={0.3} h={0.32} />
      <Plant position={[0.4, 0, -1.6]} s={1.4} />
      <Plant position={[lw - 0.45, 0, -1.6]} s={1.4} />
      {/* housekeeping cart */}
      <group position={[deskCX - deskW / 2 - 0.55, 0, -1.55]}>
        <B args={[0.7, 0.55, 0.4]} r={0.05} color="#9fd6cb" position={[0, 0.35, 0]} />
        <Cyl args={[0.07, 0.07, 0.05, 8]} color="#3a3845" position={[-0.25, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Cyl args={[0.07, 0.07, 0.05, 8]} color="#3a3845" position={[0.25, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <B args={[0.5, 0.15, 0.3]} color="#ffffff" position={[0, 0.7, 0]} />
      </group>
      {/* chandeliers */}
      {Array.from({ length: Math.max(1, width - 1) }).map((_, i) => (
        <group key={i} position={[(lw / Math.max(1, width - 1)) * (i + 0.5), INNER_H - 0.05, 0]}>
          <Cyl args={[0.01, 0.01, 0.5, 4]} color="#d8b860" position={[0, -0.25, 0]} shadow={false} />
          <Ball r={0.22} m={glowMat('#ffe6a8', 0.5, 3)} position={[0, -0.6, 0]} shadow={false} />
        </group>
      ))}

      {/* entrance: awning, mat, topiaries */}
      <group position={[ex, 0, DEPTH / 2]}>
        <B args={[1.8, 0.03, 1.2]} color="#e8edf6" position={[0, 0.03, 0.5]} shadow={false} />
        <B args={[2.4, 0.16, 1.5]} r={0.07} color={ACCENT} position={[0, 2.55, 0.55]} />
        <B args={[2.3, 0.04, 1.4]} m={glowMat('#fff3dc', 0.3, 2.2)} position={[0, 2.46, 0.55]} shadow={false} />
        <Cyl args={[0.04, 0.04, 2.5, 10]} color="#c9d2e6" position={[-0.95, 1.25, 1.15]} />
        <Cyl args={[0.04, 0.04, 2.5, 10]} color="#c9d2e6" position={[0.95, 1.25, 1.15]} />
        <Topiary position={[-1.3, 0, 1.2]} />
        <Topiary position={[1.3, 0, 1.2]} />
      </group>
    </group>
  )
}

function Topiary({ position }) {
  return (
    <group position={position}>
      <B args={[0.4, 0.4, 0.4]} r={0.05} color="#ffffff" position={[0, 0.2, 0]} />
      <mesh geometry={sphereGeo(0.32, 8)} material={mat('#6fbf7a', { flatShading: true })} position={[0, 0.7, 0]} castShadow />
      <mesh geometry={sphereGeo(0.22, 8)} material={mat('#7fcd85', { flatShading: true })} position={[0, 1.08, 0]} castShadow />
    </group>
  )
}

export function Person({ position, color, hair }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.36, 0]} castShadow material={mat(color)}>
        <capsuleGeometry args={[0.17, 0.32, 4, 10]} />
      </mesh>
      <Ball r={0.16} color="#f6d2b8" position={[0, 0.86, 0]} />
      <Ball r={0.17} color={hair} position={[0, 0.92, -0.03]} scale={[1, 0.7, 1]} />
    </group>
  )
}

// ---------------------------------------------------------------- elevator
function Elevator({ floors }) {
  const topY = (floors + 1) * FLOOR_H
  const x0 = -ELEV_W
  return (
    <group>
      <B args={[ELEV_W, topY, 0.1]} m={mat('#e9eef8', { emissive: '#e9eef8', emissiveIntensity: 0.04 })} position={[x0 + ELEV_W / 2, topY / 2 - SLAB, -DEPTH / 2 + 0.05]} shadow={false} />
      {[x0 + 0.25, -0.25].map((x) => (
        <B key={x} args={[0.1, topY, 0.1]} color={ACCENT} position={[x, topY / 2 - SLAB, -0.6]} />
      ))}
      <B args={[0.08, topY, 0.08]} color="#d9d3e8" position={[x0 + ELEV_W / 2, topY / 2 - SLAB, -1.2]} shadow={false} />
      {Array.from({ length: floors + 1 }).map((_, f) => (
        <group key={f} position={[x0 + ELEV_W / 2, f * FLOOR_H, 0.95]}>
          {/* door frame */}
          <B args={[1.5, 0.12, 0.12]} color="#c9d2e6" position={[0, 2.2, 0]} />
          <B args={[0.12, 2.2, 0.12]} color="#c9d2e6" position={[-0.75, 1.1, 0]} />
          <B args={[0.12, 2.2, 0.12]} color="#c9d2e6" position={[0.75, 1.1, 0]} />
          <Ball r={0.06} m={glowMat('#8ef0b5', 0.8, 2.5)} position={[0.95, 1.3, 0.05]} shadow={false} />
          <B args={[0.5, 0.2, 0.02]} m={glowMat('#ffdf8a', 0.3, 2)} position={[0, 2.42, 0.02]} shadow={false} />
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- roof
function useSignTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 256
    const ctx = c.getContext('2d')
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 170px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('HOTEL', c.width / 2, c.height / 2 + 10)
      tex.needsUpdate = true
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    draw()
    if (document.fonts) document.fonts.ready.then(draw)
    return tex
  }, [])
}

function Roof({ floors, width }) {
  const lw = width * SLOT_W
  const y = (floors + 1) * FLOOR_H
  const sign = useSignTexture()
  const signMat = useRef()
  useFrame(() => {
    if (signMat.current) signMat.current.emissiveIntensity = 0.9 + env.night * 2.4 + Math.sin(performance.now() / 300) * 0.05 * env.night
  })
  return (
    <group position={[0, y, 0]}>
      {/* parapet */}
      <B args={[lw + 0.3, 0.45, 0.15]} color={TRIM} position={[lw / 2, 0.22, DEPTH / 2 + 0.08]} />
      <B args={[lw + 0.3, 0.45, 0.15]} color={TRIM} position={[lw / 2, 0.22, -DEPTH / 2 - 0.08]} />
      <B args={[0.15, 0.45, DEPTH + 0.3]} color={TRIM} position={[lw + 0.08, 0.22, 0]} />
      {/* elevator machine room */}
      <B args={[ELEV_W + 0.3, 1.3, DEPTH + 0.3]} r={0.08} color={FACADE} position={[-ELEV_W / 2 - 0.15, 0.65 - SLAB, 0]} />
      <B args={[ELEV_W + 0.5, 0.15, DEPTH + 0.5]} color={ACCENT} position={[-ELEV_W / 2 - 0.15, 1.05, 0]} />
      {/* water tank */}
      <group position={[lw - 1.4, 0, -0.9]}>
        <Cyl args={[0.75, 0.75, 1.3, 16]} color="#c98a5b" position={[0, 1.35, 0]} />
        <mesh position={[0, 2.25, 0]} castShadow material={mat('#a86b48')}>
          <coneGeometry args={[0.85, 0.55, 16]} />
        </mesh>
        {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => (
          <B key={i} args={[0.08, 0.7, 0.08]} color="#6b5a4f" position={[x, 0.35, z]} />
        ))}
      </group>
      {/* AC units */}
      {Array.from({ length: Math.max(1, width - 2) }).map((_, i) => (
        <group key={i} position={[1.5 + i * 2.2, 0, -1.1]}>
          <B args={[1.1, 0.6, 0.8]} r={0.06} color="#e6e2ee" position={[0, 0.3, 0]} />
          <Cyl args={[0.28, 0.28, 0.04, 14]} color="#c9d2e6" position={[0, 0.62, 0]} />
        </group>
      ))}
      {/* string lights */}
      {Array.from({ length: Math.floor(lw / 0.6) }).map((_, i) => (
        <Ball key={i} r={0.06} m={glowMat(['#ffd36e', '#ff9db5', '#8ef0d0'][i % 3], 0.3, 3.2)} position={[0.3 + i * 0.6, 0.62 + Math.sin((i / 3) * Math.PI) * 0.06, DEPTH / 2 + 0.1]} shadow={false} />
      ))}
      {/* neon sign */}
      <group position={[lw / 2, 1.6, 0.9]}>
        <B args={[0.1, 1.2, 0.1]} color="#4c4a5e" position={[-1.8, -0.6, -0.2]} />
        <B args={[0.1, 1.2, 0.1]} color="#4c4a5e" position={[1.8, -0.6, -0.2]} />
        <B args={[4.4, 1.25, 0.12]} r={0.1} color={ACCENT} position={[0, 0.15, -0.1]} />
        <mesh position={[0, 0.15, -0.03]}>
          <planeGeometry args={[4.2, 1.05]} />
          <meshStandardMaterial ref={signMat} map={sign} emissiveMap={sign} emissive="#ffffff" color="#ffffff" transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- one room slot
function Slot({ floor, slot, room }) {
  const key = `${floor}-${slot}`
  const tool = useGame((s) => s.tool)
  const hovered = useGame((s) => s.hovered === key)
  const selected = useGame((s) => s.selected === key)
  const x = slotX(slot)
  const y = floor * FLOOR_H
  const def = room ? ROOM_TYPES[room.type] : null
  const Furniture = def ? FURNITURE[def.id] : null
  const buildDef = tool && ROOM_TYPES[tool]
  const canBuild = !room && buildDef
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: def ? def.wall : '#ebe5dc', emissive: def ? def.wall : '#000000', emissiveIntensity: 0, roughness: 0.85 }),
    [def]
  )

  const onClick = (e) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const st = useGame.getState()
    if (st.tool === 'demolish') {
      if (room && demolish(key)) st.setSelected(null)
    } else if (st.tool && !room) {
      buildRoom(floor, slot, st.tool)
    } else if (room) {
      st.setSelected(st.selected === key ? null : key)
    } else {
      st.setSelected(null)
    }
    syncUI()
  }

  const highlight = (hovered && (tool || room)) || selected
  const hlColor = tool === 'demolish' ? '#ff6b6b' : canBuild ? (game.money >= buildDef.cost ? '#6bdc9a' : '#ffb36b') : '#ffe082'

  return (
    <group position={[x, y, 0]}>
      {/* back wallpaper */}
      <mesh position={[0, INNER_H / 2, -DEPTH / 2 + 0.06]} material={wallMat} receiveShadow>
        <boxGeometry args={[SLOT_W - 0.12, INNER_H, 0.1]} />
      </mesh>
      {/* floor finish */}
      <B args={[SLOT_W - 0.12, 0.03, DEPTH]} color={def ? def.floor : '#dcd3c6'} position={[0, 0.015, 0]} shadow={false} />
      {def && <B args={[SLOT_W - 0.12, 0.5, 0.05]} color={def.accent} position={[0, 0.25, -DEPTH / 2 + 0.13]} shadow={false} />}
      {/* room door sign */}
      {def && (
        <B args={[0.6, 0.22, 0.04]} r={0.02} color={def.accent} position={[0, INNER_H - 0.25, -DEPTH / 2 + 0.13]} shadow={false} />
      )}
      {Furniture ? <Furniture def={def} /> : <EmptyDecor showPlus={!!canBuild} color={canBuild ? buildDef.accent : '#bdb3a4'} />}
      {room && <RoomStatus roomKey={key} wallMat={wallMat} def={def} />}

      {highlight && !selected && (
        <mesh position={[0, INNER_H / 2, 0]} raycast={() => null}>
          <boxGeometry args={[SLOT_W - 0.05, INNER_H, DEPTH]} />
          <meshBasicMaterial color={hlColor} transparent opacity={0.12} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {selected && room && (
        <>
          <Brackets />
          <MapPin position={[0, INNER_H - 0.9, DEPTH / 2 + 0.9]} color={ACCENT} />
          <Html position={[-SLOT_W / 2 + 0.2, INNER_H - 0.1, DEPTH / 2 + 0.3]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
            <div className="world-chip"><b>{roomName(room)}</b> {def.name}</div>
          </Html>
        </>
      )}
      {hovered && !tool && room && !selected && (
        <Html position={[0, INNER_H + 0.2, 1]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className="world-chip"><b>{roomName(room)}</b> {def.name}</div>
        </Html>
      )}
      {hovered && canBuild && (
        <Html position={[0, INNER_H + 0.2, 1]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className={`world-tip ${game.money >= buildDef.cost ? '' : 'poor'}`}>
            {buildDef.icon} {buildDef.name} · ${buildDef.cost.toLocaleString()}
          </div>
        </Html>
      )}
      {hovered && tool === 'demolish' && room && (
        <Html position={[0, INNER_H + 0.2, 1]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className="world-tip poor">Demolish · refund ${Math.round(def.cost / 2).toLocaleString()}</div>
        </Html>
      )}

      {/* invisible hit volume */}
      <mesh
        position={[0, INNER_H / 2, 0]}
        onPointerOver={(e) => { e.stopPropagation(); useGame.getState().setHovered(key); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { if (useGame.getState().hovered === key) useGame.getState().setHovered(null); document.body.style.cursor = '' }}
        onClick={onClick}
      >
        <boxGeometry args={[SLOT_W - 0.05, INNER_H, DEPTH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

// A floating map pin like the ones used on logistics dashboards.
export function MapPin({ position, color = ACCENT, scale = 1 }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.position.y = position[1] + Math.sin(performance.now() / 380) * 0.08
  })
  const m = mat(color, { roughness: 0.35 })
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh geometry={sphereGeo(0.42, 32)} material={m} position={[0, 0.95, 0]} castShadow />
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI, 0, 0]} material={m} castShadow>
        <coneGeometry args={[0.37, 0.85, 32]} />
      </mesh>
      <mesh geometry={sphereGeo(0.17, 24)} material={mat('#ffffff')} position={[0, 0.97, 0.3]} />
    </group>
  )
}

function Brackets() {
  const w = SLOT_W / 2 - 0.15
  const top = INNER_H - 0.1
  const z = DEPTH / 2 + 0.3
  const L = 0.7
  const m = glowMat(ACCENT, 0.6, 1.4)
  const corners = [[-w, 0.15, 1, 1], [w, 0.15, -1, 1], [-w, top, 1, -1], [w, top, -1, -1]]
  return (
    <group>
      {corners.map(([x, y, sx, sy], i) => (
        <group key={i} position={[x, y, z]}>
          <B args={[L, 0.07, 0.07]} m={m} position={[(sx * L) / 2, 0, 0]} shadow={false} />
          <B args={[0.07, L, 0.07]} m={m} position={[0, (sy * L) / 2, 0]} shadow={false} />
        </group>
      ))}
    </group>
  )
}

function EmptyDecor({ showPlus, color }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.06)
  })
  if (showPlus) {
    return (
      <group ref={ref} position={[0, 0.06, 0]}>
        <B args={[1.4, 0.06, 0.36]} r={0.03} m={glowMat(color, 0.6, 1.4)} shadow={false} />
        <B args={[0.36, 0.06, 1.4]} r={0.03} m={glowMat(color, 0.6, 1.4)} shadow={false} />
      </group>
    )
  }
  return (
    <group>
      <group position={[-1, 0, 0.6]}>
        <mesh position={[0, 0.3, 0]} castShadow material={mat('#ff9a5a')}>
          <coneGeometry args={[0.2, 0.6, 10]} />
        </mesh>
        <B args={[0.42, 0.05, 0.42]} color="#ff9a5a" position={[0, 0.025, 0]} />
        <B args={[0.33, 0.06, 0.06]} color="#ffffff" position={[0, 0.32, 0.12]} shadow={false} />
      </group>
      <B args={[0.7, 0.5, 0.6]} r={0.03} color="#d9b48a" position={[0.9, 0.25, -1.2]} />
      <B args={[0.5, 0.4, 0.5]} r={0.03} color="#e3c39b" position={[1.0, 0.7, -1.2]} rotation={[0, 0.3, 0]} />
      <B args={[1.4, 0.04, 0.08]} color="#f6c445" position={[0, 1.2, -1.85]} shadow={false} />
    </group>
  )
}

// Live status visuals for a built room, driven by the mutable game state.
function RoomStatus({ roomKey, wallMat, def }) {
  const badge = useRef()
  const badgeMat = useRef()
  const bag = useRef()
  const sparkle = useRef()
  useFrame(() => {
    const room = game.rooms[roomKey]
    if (!room) return
    const t = performance.now() / 1000
    const lit = def.kind === 'amenity' ? 0.25 + env.night * 0.55 : room.status === 'occupied' ? 0.15 + env.night * 0.6 : room.status === 'cleaning' ? 0.3 : 0.02
    wallMat.emissiveIntensity += (lit - wallMat.emissiveIntensity) * 0.08
    if (bag.current) bag.current.visible = room.status === 'dirty' || room.status === 'cleaning'
    if (sparkle.current) {
      sparkle.current.visible = room.status === 'cleaning'
      sparkle.current.rotation.y = t * 3
      sparkle.current.position.y = 1.6 + Math.sin(t * 4) * 0.1
    }
    if (badge.current) {
      badge.current.visible = def.kind === 'room' && room.status === 'dirty'
      badge.current.position.y = INNER_H - 1.75 + Math.sin(t * 2.6 + roomKey.length) * 0.06
      badge.current.scale.setScalar(0.55)
    }
  })
  return (
    <group>
      <group ref={badge} position={[0, INNER_H - 1.2, CORRIDOR_Z - 0.3]}>
        <mesh geometry={sphereGeo(0.42, 24)} position={[0, 0.95, 0]} raycast={() => null}>
          <meshStandardMaterial ref={badgeMat} color="#ffb020" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.42, 0]} rotation={[Math.PI, 0, 0]} raycast={() => null}>
          <coneGeometry args={[0.37, 0.85, 24]} />
          <meshStandardMaterial color="#ffb020" roughness={0.35} />
        </mesh>
        <mesh geometry={sphereGeo(0.17, 16)} material={mat('#ffffff')} position={[0, 0.97, 0.3]} raycast={() => null} />
      </group>
      <group ref={bag} position={[0.6, 0, 0.9]} visible={false}>
        <Ball r={0.22} color="#6b6377" position={[0, 0.2, 0]} scale={[1, 0.9, 1]} />
        <Ball r={0.16} color="#7d7489" position={[0.3, 0.14, 0.15]} />
        <B args={[0.3, 0.05, 0.2]} color="#f2efe8" position={[-0.4, 0.03, 0.2]} rotation={[0, 0.5, 0]} shadow={false} />
      </group>
      <mesh ref={sparkle} position={[0.6, 1.6, 0.2]} visible={false} raycast={() => null}>
        <octahedronGeometry args={[0.18]} />
        <meshBasicMaterial color="#9fe7ff" toneMapped={false} />
      </mesh>
    </group>
  )
}
