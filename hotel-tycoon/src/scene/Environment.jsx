import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment as EnvMap, Lightformer } from '@react-three/drei'
import { game, SIDEWALK_Z, TAXI_LANE_Z, TAXI_ARRIVE, absTime } from '../game/engine'
import { DEPTH, SLOT_W, ELEV_W } from '../game/constants'
import { B, Cyl, mat, sphereGeo, glowMat, glowMats, env, updateGlowMats, T } from './parts'

// Recording mode (?rec) trades a little shadow sharpness for much faster software rendering.
const REC = typeof location !== 'undefined' && new URLSearchParams(location.search).has('rec')

// ---------------------------------------------------------------- road layout (z grows toward the camera)
export const ROAD = {
  near: SIDEWALK_Z + 1.1,
  far: SIDEWALK_Z + 8.3,
  lanes: [TAXI_LANE_Z, SIDEWALK_Z + 3.75, SIDEWALK_Z + 5.65, SIDEWALK_Z + 7.4],
}
export const sideStreetX = (lw) => lw + 22

// ---------------------------------------------------------------- day / night
const KEYS = [
  { h: 0, bg: '#1f2746', sun: 0.215, hemi: 0.192, envI: 0.069, sunColor: '#9fb0ff', night: 1 },
  { h: 4.5, bg: '#232c4f', sun: 0.215, hemi: 0.2, envI: 0.069, sunColor: '#9fb0ff', night: 1 },
  { h: 6, bg: '#f1dcd2', sun: 1.026, hemi: 0.326, envI: 0.206, sunColor: '#ffc9a6', night: 0.3 },
  { h: 8, bg: '#e9eef8', sun: 1.966, hemi: 0.403, envI: 0.275, sunColor: '#fff4e8', night: 0 },
  { h: 13, bg: '#e7edf8', sun: 2.137, hemi: 0.422, envI: 0.275, sunColor: '#ffffff', night: 0 },
  { h: 17, bg: '#ebedf6', sun: 1.966, hemi: 0.403, envI: 0.275, sunColor: '#fff0e0', night: 0 },
  { h: 18.7, bg: '#f2d8d2', sun: 1.111, hemi: 0.326, envI: 0.206, sunColor: '#ffb592', night: 0.35 },
  { h: 20.2, bg: '#5c6191', sun: 0.342, hemi: 0.23, envI: 0.096, sunColor: '#a9a6ff', night: 0.85 },
  { h: 21.5, bg: '#1f2746', sun: 0.215, hemi: 0.192, envI: 0.069, sunColor: '#9fb0ff', night: 1 },
  { h: 24, bg: '#1f2746', sun: 0.215, hemi: 0.192, envI: 0.069, sunColor: '#9fb0ff', night: 1 },
]
const cA = new THREE.Color()
const cB = new THREE.Color()
const out = { bg: new THREE.Color(), sunColor: new THREE.Color(), sun: 0, hemi: 0, envI: 0, night: 0 }
function sample(hour) {
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = (hour - a.h) / (b.h - a.h)
  out.bg.copy(cA.set(a.bg)).lerp(cB.set(b.bg), t)
  out.sunColor.copy(cA.set(a.sunColor)).lerp(cB.set(b.sunColor), t)
  for (const k of ['sun', 'hemi', 'envI', 'night']) out[k] = a[k] + (b[k] - a[k]) * t
  return out
}

export function Lighting({ center }) {
  const sun = useRef()
  const hemi = useRef()
  const { scene, camera } = useThree()
  const controls = useThree((s) => s.controls)
  const target = useMemo(() => new THREE.Object3D(), [])
  const bg = useMemo(() => new THREE.Color('#e9eef8'), [])
  const fog = useMemo(() => new THREE.Fog('#e9eef8', 80, 200), [])
  useMemo(() => {
    scene.background = bg
    scene.fog = fog
  }, [scene, bg, fog])

  useFrame(() => {
    const hour = game.minute / 60
    const s = sample(hour)
    env.night = s.night
    env.hour = hour
    updateGlowMats()
    bg.copy(s.bg)
    fog.color.copy(s.bg)
    // fog follows the camera distance so the far city melts into the background
    const tgt = controls?.target || target.position
    const dist = camera.position.distanceTo(tgt)
    fog.near = dist * 1.5
    fog.far = dist * 3.4
    scene.environmentIntensity = s.envI
    // the sun swings east -> west during the day; a soft moon light at night
    const dayT = THREE.MathUtils.clamp((hour - 6) / 14, 0, 1)
    const ang = THREE.MathUtils.lerp(-0.9, 0.9, dayT)
    // light from the front-left so soft shadows fall to the right, like a product render
    sun.current.position.set(center[0] - 42 + ang * 14, 58, center[2] + 26 - ang * 6)
    target.position.set(center[0], 0, center[2])
    sun.current.intensity = s.sun
    sun.current.color.copy(s.sunColor)
    hemi.current.intensity = s.hemi
    hemi.current.color.copy(cA.set('#ffffff')).lerp(cB.set('#8d9cff'), s.night)
    hemi.current.groundColor.copy(cA.set('#c3cde6')).lerp(cB.set('#3a3f6b'), s.night)
  })
  return (
    <>
      <primitive object={target} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#c3cde6', 1]} />
      <directionalLight
        ref={sun}
        castShadow
        target={target}
        shadow-mapSize={REC ? [2048, 2048] : [4096, 4096]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
        shadow-radius={6}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
      {/* a soft studio-style environment for gentle reflections */}
      <EnvMap resolution={128} frames={1}>
        <color attach="background" args={['#dfe6f5']} />
        <Lightformer intensity={2.2} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} color="#ffffff" />
        <Lightformer intensity={1.2} position={[-14, 4, 6]} rotation-y={Math.PI / 2} scale={[20, 8, 1]} color="#fff3e8" />
        <Lightformer intensity={1} position={[14, 4, -6]} rotation-y={-Math.PI / 2} scale={[20, 8, 1]} color="#e6eeff" />
      </EnvMap>
    </>
  )
}

// ---------------------------------------------------------------- helpers
function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

let windowCanvas
function windowTexture(w, h) {
  if (!windowCanvas) {
    windowCanvas = document.createElement('canvas')
    windowCanvas.width = 128
    windowCanvas.height = 128
    const ctx = windowCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 128, 128)
    const grd = ctx.createLinearGradient(0, 22, 0, 110)
    grd.addColorStop(0, '#c4d5f6')
    grd.addColorStop(1, '#a9c0ee')
    ctx.fillStyle = grd
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(22, 22, 84, 82, 10)
    else ctx.rect(22, 22, 84, 82)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillRect(30, 30, 10, 66)
  }
  return makeTex(windowCanvas, w, h)
}

// Emissive mask: only the panes light up at night, not the walls.
let glowCanvas
function windowGlowTexture(w, h) {
  if (!glowCanvas) {
    glowCanvas = document.createElement('canvas')
    glowCanvas.width = 128
    glowCanvas.height = 128
    const ctx = glowCanvas.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(24, 24, 80, 78)
  }
  return makeTex(glowCanvas, w, h)
}

function makeTex(canvas, w, h) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(Math.max(1, Math.round(w / 2.4)), Math.max(1, Math.round(h / 3)))
  tex.anisotropy = 4
  return tex
}

// A neighbouring office/apartment block with a window grid on the visible faces.
function Building({ position, w, h, d, tint = '#ffffff' }) {
  const mats = useMemo(() => {
    const make = (a, b) => {
      const m = new THREE.MeshStandardMaterial({ color: tint, map: windowTexture(a, b), roughness: 0.55, emissive: '#ffd59a', emissiveIntensity: 0 })
      m.emissiveMap = windowGlowTexture(a, b)
      m.userData = { dayIntensity: 0, nightIntensity: 0.55 }
      glowMats.push(m)
      return m
    }
    const front = make(w, h)
    const side = make(d, h)
    return [side, side, mat('#eef1f7'), mat(tint), front, front]
  }, [w, h, d, tint])
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <B args={[w + 0.3, 0.35, d + 0.3]} r={0.08} color="#ffffff" position={[0, h + 0.1, 0]} />
      {h > 5 && <B args={[2, 0.9, 2]} r={0.1} color="#e3e8f2" position={[w * 0.25, h + 0.6, -d * 0.2]} />}
    </group>
  )
}

function Tree({ position, s = 1, tone = 0 }) {
  return (
    <group position={position} scale={s}>
      <Cyl args={[0.09, 0.12, 1.3, 10]} color={T.trunk} position={[0, 0.65, 0]} />
      <mesh geometry={sphereGeo(0.78, 28)} material={mat(tone ? T.leaf2 : T.leaf, { roughness: 0.7 })} position={[0, 1.75, 0]} scale={[1, 1.12, 1]} castShadow receiveShadow />
    </group>
  )
}

function Lamp({ position, rot = 0 }) {
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <Cyl args={[0.06, 0.08, 3, 10]} color="#c9d1e3" position={[0, 1.5, 0]} />
      <B args={[0.9, 0.08, 0.12]} r={0.03} color="#c9d1e3" position={[0.4, 3, 0]} />
      <B args={[0.36, 0.08, 0.2]} r={0.03} m={glowMat('#fff1cc', 0.1, 3.2)} position={[0.78, 2.94, 0]} shadow={false} />
    </group>
  )
}

function Bench({ position, rot = 0 }) {
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <B args={[1.5, 0.1, 0.45]} r={0.04} color="#ffffff" position={[0, 0.45, 0]} />
      <B args={[1.5, 0.35, 0.08]} r={0.04} color="#ffffff" position={[0, 0.7, -0.2]} />
      <B args={[0.08, 0.45, 0.4]} color="#b9c3d8" position={[-0.6, 0.22, 0]} />
      <B args={[0.08, 0.45, 0.4]} color="#b9c3d8" position={[0.6, 0.22, 0]} />
    </group>
  )
}

function Hedge({ position, w, d = 0.7 }) {
  return <B args={[w, 0.7, d]} r={0.3} color={T.leaf2} position={[position[0], 0.4, position[2]]} />
}

function Fence({ from, to }) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const n = Math.max(1, Math.round(len / 3))
  const ang = Math.atan2(dz, dx)
  return (
    <group position={[from[0], 0, from[1]]} rotation={[0, -ang, 0]}>
      {Array.from({ length: n + 1 }).map((_, i) => (
        <B key={i} args={[0.1, 1.6, 0.1]} color="#cdd5e6" position={[(i * len) / n, 0.8, 0]} />
      ))}
      <B args={[len, 0.06, 0.06]} color="#cdd5e6" position={[len / 2, 1.55, 0]} />
      <B args={[len, 1.4, 0.03]} m={mat('#dfe7f7', { transparent: true, opacity: 0.35 })} position={[len / 2, 0.8, 0]} shadow={false} />
    </group>
  )
}

// ---------------------------------------------------------------- the city block around the hotel
export function Site({ width }) {
  const lw = width * SLOT_W
  const sx = sideStreetX(lw)
  const lotMinX = -18
  const lotMaxX = sx - 4
  const lotMinZ = -18
  const roadMid = (ROAD.near + ROAD.far) / 2
  const roadW = ROAD.far - ROAD.near

  const trees = useMemo(() => {
    const list = []
    for (let x = -60; x < sx + 60; x += 7) {
      if (Math.abs(x + 1.5 - sx) > 5) list.push({ p: [x + 1.5, 0, SIDEWALK_Z + 0.55], s: 0.95, tone: 0 })
      if (Math.abs(x + 4.5 - sx) > 5) list.push({ p: [x + 4.5, 0, ROAD.far + 1.2], s: 1, tone: 1 })
    }
    for (let z = -60; z < SIDEWALK_Z - 4; z += 7) {
      list.push({ p: [sx - 4.6, 0, z], s: 1, tone: 1 })
      list.push({ p: [sx + 4.6, 0, z + 3], s: 0.9, tone: 0 })
    }
    const rnd = seeded(11)
    for (let i = 0; i < 9; i++) list.push({ p: [lotMinX + 1.5 + rnd() * 10, 0, lotMinZ + 1.5 + rnd() * 4], s: 0.8 + rnd() * 0.5, tone: i % 2 })
    list.push({ p: [-16.5, 0, 2.5], s: 1.1, tone: 0 })
    return list
  }, [sx, lotMinX, lotMinZ])

  const lamps = useMemo(() => {
    const l = []
    for (let x = -56; x < sx + 56; x += 14) if (Math.abs(x - sx) > 6) l.push(x)
    return l
  }, [sx])

  const parked = useMemo(() => {
    const rnd = seeded(5 + width)
    const cols = ['#ffffff', '#ffffff', '#2b3245', '#c7d2ea', T.accent, '#ffffff', '#8aa4d6']
    const list = []
    const x0 = lw + 5
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        if (rnd() < 0.35) continue
        list.push({ p: [x0 + i * 2.4, 0.1, -9.5 + row * 7.5], rot: row ? Math.PI / 2 : -Math.PI / 2, color: cols[Math.floor(rnd() * cols.length)] })
      }
    }
    return list
  }, [lw, width])

  const blocks = useMemo(() => {
    const rnd = seeded(23)
    const list = []
    let x = -70
    while (x < sx + 70) {
      const w = 9 + rnd() * 8
      list.push({ p: [x + w / 2, 0, -36 - rnd() * 10], w, h: 5 + rnd() * 12, d: 10 + rnd() * 4 })
      x += w + 3 + rnd() * 3
    }
    list.push({ p: [-34, 0, -6], w: 10, h: 8, d: 14 })
    list.push({ p: [sx + 15, 0, -10], w: 12, h: 7, d: 16 })
    list.push({ p: [sx + 14, 0, -34], w: 10, h: 14, d: 12 })
    // low shops across the main road so they never hide the hotel
    for (let i = -3; i < 7; i++) list.push({ p: [i * 11 + 4, 0, ROAD.far + 8], w: 8.5, h: 2.6 + (i % 2) * 0.8, d: 6, low: true })
    return list
  }, [sx])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color={T.ground} roughness={0.9} />
      </mesh>

      {/* hotel lot + forecourt */}
      <B args={[lotMaxX - lotMinX, 0.12, SIDEWALK_Z - 1 - lotMinZ]} color={T.lot} position={[(lotMinX + lotMaxX) / 2, 0.04, (lotMinZ + SIDEWALK_Z - 1) / 2]} shadow={false} />
      <B args={[lw + 4.8, 0.13, SIDEWALK_Z - 1 - DEPTH / 2]} color="#ffffff" position={[(lw - ELEV_W) / 2, 0.05, (DEPTH / 2 + SIDEWALK_Z - 1) / 2]} shadow={false} />

      {/* sidewalks + road */}
      <B args={[400, 0.16, 2.1]} color={T.sidewalk} position={[0, 0.06, SIDEWALK_Z]} shadow={false} />
      <B args={[400, 0.17, 0.18]} color={T.curb} position={[0, 0.07, SIDEWALK_Z + 1.05]} shadow={false} />
      <B args={[400, 0.04, roadW]} color={T.road} position={[0, 0.01, roadMid]} shadow={false} />
      <B args={[400, 0.16, 2.6]} color={T.sidewalk} position={[0, 0.06, ROAD.far + 1.3]} shadow={false} />
      <B args={[400, 0.17, 0.18]} color={T.curb} position={[0, 0.07, ROAD.far + 0.05]} shadow={false} />
      <B args={[400, 0.02, 0.09]} color="#ffffff" position={[0, 0.04, roadMid - 0.1]} shadow={false} />
      <B args={[400, 0.02, 0.09]} color="#ffffff" position={[0, 0.04, roadMid + 0.1]} shadow={false} />
      {Array.from({ length: 70 }).map((_, i) => {
        const x = -140 + i * 4
        if (Math.abs(x - sx) < 6) return null
        return (
          <group key={i}>
            <B args={[1.6, 0.02, 0.12]} color="#ffffff" position={[x, 0.04, (ROAD.lanes[0] + ROAD.lanes[1]) / 2]} shadow={false} />
            <B args={[1.6, 0.02, 0.12]} color="#ffffff" position={[x, 0.04, (ROAD.lanes[2] + ROAD.lanes[3]) / 2]} shadow={false} />
          </group>
        )
      })}

      {/* side street with crosswalks */}
      <B args={[6.4, 0.045, 160]} color={T.road} position={[sx, 0.012, -80 + ROAD.near]} shadow={false} />
      <B args={[2, 0.16, 160]} color={T.sidewalk} position={[sx - 4.2, 0.06, -80 + SIDEWALK_Z - 1]} shadow={false} />
      <B args={[2, 0.16, 160]} color={T.sidewalk} position={[sx + 4.2, 0.06, -80 + SIDEWALK_Z - 1]} shadow={false} />
      {Array.from({ length: 30 }).map((_, i) => (
        <B key={i} args={[0.12, 0.02, 1.6]} color="#ffffff" position={[sx, 0.05, ROAD.near - 8 - i * 4]} shadow={false} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i}>
          <B args={[0.5, 0.02, roadW - 0.4]} color="#ffffff" position={[sx - 8.2 + i * 0.9, 0.045, roadMid]} shadow={false} />
          <B args={[0.5, 0.02, roadW - 0.4]} color="#ffffff" position={[sx + 3.7 + i * 0.9, 0.045, roadMid]} shadow={false} />
          <B args={[5.4, 0.02, 0.5]} color="#ffffff" position={[sx, 0.045, ROAD.near - 1.2 - i * 0.9]} shadow={false} />
        </group>
      ))}

      {/* parking lot */}
      <B args={[15.5, 0.135, 17]} color="#eef2f9" position={[lw + 10.6, 0.06, -6]} shadow={false} />
      {Array.from({ length: 7 }).map((_, i) => (
        <group key={i}>
          <B args={[0.1, 0.02, 3.6]} color="#ffffff" position={[lw + 3.8 + i * 2.4, 0.14, -9.5]} shadow={false} />
          <B args={[0.1, 0.02, 3.6]} color="#ffffff" position={[lw + 3.8 + i * 2.4, 0.14, -2]} shadow={false} />
        </group>
      ))}
      {parked.map((c, i) => (
        <Car key={i} position={c.p} rotation={[0, c.rot, 0]} color={c.color} />
      ))}
      <group position={[lw + 3.2, 0, 2.4]}>
        <Cyl args={[0.06, 0.06, 2.2, 10]} color="#c9d1e3" position={[0, 1.1, 0]} />
        <B args={[0.9, 0.9, 0.1]} r={0.12} color="#4f7cff" position={[0, 2.4, 0]} />
        <B args={[0.12, 0.5, 0.11]} color="#ffffff" position={[-0.1, 2.4, 0.01]} shadow={false} />
        <B args={[0.3, 0.12, 0.11]} color="#ffffff" position={[0.05, 2.58, 0.01]} shadow={false} />
        <B args={[0.12, 0.25, 0.11]} color="#ffffff" position={[0.18, 2.48, 0.01]} shadow={false} />
        <B args={[0.3, 0.1, 0.11]} color="#ffffff" position={[0.05, 2.36, 0.01]} shadow={false} />
      </group>

      <PoolGarden />

      {/* service yard behind the hotel */}
      <B args={[lw + 6, 0.13, 9]} color="#eceff6" position={[(lw - ELEV_W) / 2, 0.055, -8]} shadow={false} />
      {Array.from({ length: Math.floor((lw + 4) / 3.2) }).map((_, i) => (
        <B key={i} args={[0.09, 0.02, 4]} color="#f7c66b" position={[-2 + i * 3.2, 0.13, -9.5]} shadow={false} />
      ))}
      <group position={[lw - 3, 0.1, -9]} rotation={[0, Math.PI, 0]}>
        <BoxTruck />
      </group>
      <group position={[0.5, 0, -5.2]}>
        <B args={[1.8, 1.1, 1.1]} r={0.08} color="#7fa0d6" position={[0, 0.6, 0]} />
        <B args={[1.9, 0.12, 1.2]} r={0.04} color="#6a8cc4" position={[0, 1.2, 0]} />
      </group>
      <Pallet position={[3.2, 0.1, -5.4]} />
      <Pallet position={[4.6, 0.1, -5.4]} wrapped />

      <Fence from={[lotMinX, lotMinZ]} to={[lotMaxX, lotMinZ]} />
      <Fence from={[lotMaxX, lotMinZ]} to={[lotMaxX, SIDEWALK_Z - 1.3]} />
      <Fence from={[lotMinX, lotMinZ]} to={[lotMinX, SIDEWALK_Z - 1.3]} />

      {trees.map((t, i) => (
        <Tree key={i} position={t.p} s={t.s} tone={t.tone} />
      ))}
      {lamps.map((x, i) => (
        <Lamp key={i} position={[x, 0, SIDEWALK_Z + 0.75]} rot={Math.PI / 2} />
      ))}
      <Bench position={[lw + 1.5, 0, SIDEWALK_Z - 0.4]} />
      <Bench position={[-9, 0, SIDEWALK_Z - 0.4]} />
      <BusStop position={[-22, 0, ROAD.far + 1.6]} />
      {blocks.map((b, i) => (
        <Building key={i} position={b.p} w={b.w} h={b.h} d={b.d} tint={i % 4 === 0 ? '#f2f5fb' : '#ffffff'} />
      ))}
      <Traffic sx={sx} />
      <Taxis />
    </group>
  )
}

function Pallet({ position, wrapped }) {
  return (
    <group position={position}>
      <B args={[1.1, 0.14, 1.1]} color="#d8b48d" position={[0, 0.07, 0]} />
      {wrapped ? (
        <B args={[1, 0.9, 1]} r={0.08} m={mat('#e6eefc', { roughness: 0.25 })} position={[0, 0.6, 0]} />
      ) : (
        <>
          <B args={[0.5, 0.45, 0.5]} r={0.03} color="#e8c39a" position={[-0.25, 0.37, -0.25]} />
          <B args={[0.5, 0.45, 0.5]} r={0.03} color="#e3bb8f" position={[0.25, 0.37, -0.25]} />
          <B args={[0.5, 0.45, 0.5]} r={0.03} color="#e8c39a" position={[-0.25, 0.37, 0.25]} />
          <B args={[0.5, 0.45, 0.5]} r={0.03} color="#edc9a2" position={[0.25, 0.37, 0.25]} />
          <B args={[0.5, 0.45, 0.5]} r={0.03} color="#e3bb8f" position={[0, 0.82, 0]} />
        </>
      )}
    </group>
  )
}

function PoolGarden() {
  return (
    <group position={[-11, 0, -3]}>
      <B args={[11, 0.16, 13]} r={0.1} color="#ffffff" position={[0, 0.07, 0]} shadow={false} />
      <B args={[6.4, 0.2, 8.4]} r={0.3} color="#eef3fb" position={[0.3, 0.12, -0.8]} />
      <B args={[5.8, 0.06, 7.8]} r={0.25} m={mat('#7fc4ff', { roughness: 0.08, metalness: 0.1, emissive: '#5fb2ff', emissiveIntensity: 0.18 })} position={[0.3, 0.2, -0.8]} shadow={false} />
      {[-1.5, 0.3, 2.1].map((x, i) => (
        <group key={i} position={[x, 0, 4.5]}>
          <B args={[0.75, 0.14, 1.6]} r={0.06} color="#ffffff" position={[0, 0.32, 0]} />
          <B args={[0.75, 0.5, 0.12]} r={0.05} color="#ffffff" position={[0, 0.55, -0.72]} rotation={[-0.45, 0, 0]} />
          <B args={[0.66, 0.05, 1.3]} r={0.02} color={i === 1 ? T.accent : '#9cc3ff'} position={[0, 0.41, 0.05]} shadow={false} />
          <Cyl args={[0.05, 0.05, 0.25, 8]} color="#c9d1e3" position={[0, 0.15, 0]} />
        </group>
      ))}
      {[[-4, -3], [-4, 1.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl args={[0.05, 0.05, 2.2, 8]} color="#c9d1e3" position={[0, 1.1, 0]} />
          <mesh position={[0, 2.25, 0]} castShadow material={mat(i ? '#ffffff' : T.accent, { side: THREE.DoubleSide })}>
            <coneGeometry args={[1.3, 0.55, 24, 1, true]} />
          </mesh>
          <Cyl args={[0.45, 0.45, 0.06, 20]} color="#ffffff" position={[0, 0.7, 0]} />
          <Cyl args={[0.06, 0.08, 0.6, 8]} color="#c9d1e3" position={[0, 0.38, 0]} />
        </group>
      ))}
      <Hedge position={[0, 0, -6.1]} w={10.4} />
      <Hedge position={[-5.1, 0, 0]} w={0.7} d={11.5} />
    </group>
  )
}

function BusStop({ position }) {
  return (
    <group position={position}>
      <B args={[3.2, 0.1, 1.2]} r={0.04} color="#ffffff" position={[0, 2.3, 0]} />
      <B args={[3.2, 2.2, 0.06]} m={mat('#dbe6fb', { transparent: true, opacity: 0.5, roughness: 0.1 })} position={[0, 1.15, 0.5]} shadow={false} />
      <B args={[0.1, 2.3, 0.1]} color="#c9d1e3" position={[-1.5, 1.15, 0.5]} />
      <B args={[0.1, 2.3, 0.1]} color="#c9d1e3" position={[1.5, 1.15, 0.5]} />
      <B args={[2.4, 0.1, 0.4]} r={0.04} color={T.accent} position={[0, 0.5, 0.25]} />
    </group>
  )
}

// ---------------------------------------------------------------- vehicles
export function Car({ position, rotation, color = '#ffffff', taxi = false }) {
  const glass = mat('#9db6e8', { roughness: 0.15, metalness: 0.1 })
  return (
    <group position={position} rotation={rotation}>
      <B args={[2.1, 0.55, 1.0]} r={0.22} color={color} position={[0, 0.42, 0]} />
      <B args={[1.2, 0.48, 0.92]} r={0.2} color={color} position={[-0.12, 0.84, 0]} />
      <B args={[1.12, 0.36, 0.96]} r={0.14} m={glass} position={[-0.12, 0.86, 0]} shadow={false} />
      {[-0.68, 0.68].map((x) =>
        [-0.46, 0.46].map((z) => (
          <Cyl key={`${x}${z}`} args={[0.22, 0.22, 0.16, 20]} color="#2e3446" position={[x, 0.22, z]} rotation={[Math.PI / 2, 0, 0]} />
        ))
      )}
      <B args={[0.06, 0.12, 0.26]} m={glowMat('#fff6d6', 0.4, 3)} position={[1.05, 0.48, 0.3]} shadow={false} />
      <B args={[0.06, 0.12, 0.26]} m={glowMat('#fff6d6', 0.4, 3)} position={[1.05, 0.48, -0.3]} shadow={false} />
      <B args={[0.05, 0.1, 0.24]} m={glowMat('#ff5a4a', 0.4, 2)} position={[-1.05, 0.5, 0.32]} shadow={false} />
      <B args={[0.05, 0.1, 0.24]} m={glowMat('#ff5a4a', 0.4, 2)} position={[-1.05, 0.5, -0.32]} shadow={false} />
      {taxi && <B args={[0.45, 0.16, 0.24]} r={0.05} m={glowMat('#ffffff', 0.6, 2.5)} position={[-0.12, 1.15, 0]} />}
    </group>
  )
}

function BoxTruck({ color = T.accent }) {
  return (
    <group>
      <B args={[3.4, 1.9, 1.5]} r={0.12} color="#ffffff" position={[-0.6, 1.4, 0]} />
      <B args={[3.42, 0.22, 1.52]} r={0.06} color={color} position={[-0.6, 0.65, 0]} shadow={false} />
      <B args={[1.3, 1.5, 1.4]} r={0.22} color={color} position={[1.75, 1.05, 0]} />
      <B args={[0.4, 0.6, 1.3]} r={0.12} m={mat('#9db6e8', { roughness: 0.15 })} position={[2.2, 1.35, 0]} shadow={false} />
      <B args={[1.2, 0.6, 0.05]} r={0.04} color={color} position={[-0.6, 1.5, 0.77]} shadow={false} />
      {[-1.6, -0.5, 1.8].map((x) =>
        [-0.66, 0.66].map((z) => (
          <Cyl key={`${x}${z}`} args={[0.3, 0.3, 0.2, 20]} color="#2e3446" position={[x, 0.3, z]} rotation={[Math.PI / 2, 0, 0]} />
        ))
      )}
    </group>
  )
}

function Bus() {
  return (
    <group>
      <B args={[6.2, 2.0, 1.6]} r={0.3} color="#ffffff" position={[0, 1.25, 0]} />
      <B args={[5.6, 0.6, 1.64]} r={0.12} m={mat('#9db6e8', { roughness: 0.15 })} position={[0.1, 1.6, 0]} shadow={false} />
      <B args={[6.22, 0.2, 1.62]} r={0.06} color="#4f7cff" position={[0, 0.65, 0]} shadow={false} />
      {[-2.1, 2.1].map((x) =>
        [-0.7, 0.7].map((z) => (
          <Cyl key={`${x}${z}`} args={[0.32, 0.32, 0.2, 20]} color="#2e3446" position={[x, 0.32, z]} rotation={[Math.PI / 2, 0, 0]} />
        ))
      )}
    </group>
  )
}

const TRAFFIC = [
  { lane: 1, dir: 1, kind: 'car', color: '#ffffff', speed: 4.2, offset: 0 },
  { lane: 1, dir: 1, kind: 'truck', color: '#4f7cff', speed: 3.4, offset: 90 },
  { lane: 1, dir: 1, kind: 'car', color: '#2b3245', speed: 4.6, offset: 170 },
  { lane: 2, dir: -1, kind: 'car', color: '#c7d2ea', speed: 4.0, offset: 30 },
  { lane: 2, dir: -1, kind: 'bus', speed: 3.0, offset: 130 },
  { lane: 3, dir: -1, kind: 'car', color: T.accent, speed: 4.8, offset: 60 },
  { lane: 3, dir: -1, kind: 'truck', color: '#2b3245', speed: 3.6, offset: 160 },
  { lane: 3, dir: -1, kind: 'car', color: '#ffffff', speed: 4.4, offset: 230 },
]

function Traffic({ sx }) {
  const refs = useRef([])
  const side = useRef([])
  const span = 260
  useFrame(() => {
    const t = performance.now() / 1000
    const k = game.speed ? Math.min(2, Math.max(0.6, game.speed)) : 0.6
    TRAFFIC.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      const p = (((t * c.speed * k + c.offset) % span) + span) % span
      g.position.x = c.dir > 0 ? -130 + p : 130 - p
    })
    side.current.forEach((g, i) => {
      if (!g) return
      const dir = i % 2 ? 1 : -1
      const p = (((t * 3.8 * k + i * 55) % 180) + 180) % 180
      g.position.z = dir > 0 ? -150 + p : 30 - p
    })
  })
  return (
    <group>
      {TRAFFIC.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={[0, 0.02, ROAD.lanes[c.lane]]} rotation={[0, c.dir > 0 ? 0 : Math.PI, 0]}>
          {c.kind === 'car' ? <Car color={c.color} /> : c.kind === 'bus' ? <Bus /> : <BoxTruck color={c.color} />}
        </group>
      ))}
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => (side.current[i] = el)} position={[sx + (i % 2 ? 1.5 : -1.5), 0.02, 0]} rotation={[0, i % 2 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <Car color={['#ffffff', '#8aa4d6', '#2b3245'][i]} />
        </group>
      ))}
    </group>
  )
}

// Taxis that drop guests at the hotel curb. Timing comes from the engine (game minutes).
function Taxis() {
  const refs = useRef([])
  useFrame(() => {
    const now = absTime()
    for (let i = 0; i < 4; i++) {
      const g = refs.current[i]
      if (!g) continue
      const taxi = game.taxis[i]
      if (!taxi) { g.visible = false; continue }
      const t = now - taxi.start
      const arrive = TAXI_ARRIVE * 0.85
      let x
      if (t < arrive) {
        const e = 1 - Math.pow(1 - t / arrive, 2)
        x = taxi.x - 60 * (1 - e)
      } else if (t < TAXI_ARRIVE + 4) {
        x = taxi.x
      } else {
        const d = t - TAXI_ARRIVE - 4
        x = taxi.x + d * d * 0.35
      }
      g.visible = x < taxi.x + 120
      g.position.x = x
    }
  })
  return [0, 1, 2, 3].map((i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} position={[0, 0.02, TAXI_LANE_Z]} visible={false}>
      <Car color="#ffc93c" taxi />
    </group>
  ))
}
