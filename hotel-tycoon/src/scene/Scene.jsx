import * as THREE from 'three'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, SoftShadows } from '@react-three/drei'
import { EffectComposer, Bloom, N8AO, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { game, step } from '../game/engine'
import { useGame, syncUI } from '../game/store'
import { SLOT_W, FLOOR_H, ELEV_W, slotX } from '../game/constants'
import { Lighting, Site } from './Environment'
import Hotel from './Hotel'
import Agents from './Agents'
import People from './People'

function GameLoop() {
  const acc = useRef(0)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    // handy for tooling (e.g. the trailer recorder) to inspect the renderer
    window.__renderer = gl
  }, [gl])
  useFrame((_, dt) => {
    step(dt)
    acc.current += dt
    if (acc.current > 0.2) {
      acc.current = 0
      syncUI()
    }
  })
  return null
}

function Floaters() {
  const [items, setItems] = useState([])
  const sig = useRef('')
  useFrame(() => {
    const now = performance.now()
    const live = game.floaters.filter((f) => now - f.born < 1800)
    const s = live.map((f) => f.id).join(',')
    if (s !== sig.current) {
      sig.current = s
      setItems(live)
    }
  })
  return items.map((f) => (
    <Html key={f.id} position={[f.x, f.y, f.z]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
      <div className="floater" style={{ color: f.color }}>{f.text}</div>
    </Html>
  ))
}

// ---------------------------------------------------------------- camera
// Imperative camera API used by the on-screen map controls.
export const camApi = { zoom: () => {}, rotate: () => {}, home: () => {}, focus: () => {}, set: () => {} }

const HOME_DIR = new THREE.Vector3(0.62, 0.66, 1).normalize()

function CameraRig() {
  const floors = useGame((s) => s.snap.floors)
  const width = useGame((s) => s.snap.width)
  const selected = useGame((s) => s.selected)
  const controls = useRef()
  const { camera, size } = useThree()
  const anim = useRef(null)

  const homePose = () => {
    const lw = width * SLOT_W
    const cx = (lw - ELEV_W) / 2
    const hb = (floors + 1) * FLOOR_H
    const target = new THREE.Vector3(cx + 1.5, hb * 0.38, 1.5)
    const aspect = size.width / Math.max(1, size.height)
    const needH = Math.max(hb * 2.3 + 12, (lw + ELEV_W + 30) / aspect)
    const dist = needH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    return { target, pos: target.clone().addScaledVector(HOME_DIR, dist) }
  }

  const flyTo = (pos, target) => {
    // scripted cameras (e.g. the trailer recorder) can lock out automatic framing
    if (window.__camLocked) return
    anim.current = { pos, target }
  }

  camApi.home = () => {
    const p = homePose()
    flyTo(p.pos, p.target)
  }
  camApi.zoom = (f) => {
    const c = controls.current
    if (!c) return
    const off = camera.position.clone().sub(c.target).multiplyScalar(f)
    off.setLength(THREE.MathUtils.clamp(off.length(), c.minDistance, c.maxDistance))
    flyTo(c.target.clone().add(off), c.target.clone())
  }
  camApi.rotate = (a) => {
    const c = controls.current
    if (!c) return
    const off = camera.position.clone().sub(c.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a)
    flyTo(c.target.clone().add(off), c.target.clone())
  }
  // Jump straight to a pose (used by scripted camera moves, e.g. the trailer recorder).
  camApi.set = (pos, target) => {
    const c = controls.current
    if (!c) return
    anim.current = null
    camera.position.set(...pos)
    c.target.set(...target)
    c.update()
  }
  camApi.focus = (x, y, z, dist = 26) => {
    const c = controls.current
    if (!c) return
    const target = new THREE.Vector3(x, y, z)
    const dir = camera.position.clone().sub(c.target).normalize()
    flyTo(target.clone().addScaledVector(dir, dist), target)
  }

  // Frame the hotel on load (with a little swoop) and whenever it grows.
  const first = useRef(true)
  useEffect(() => {
    const p = homePose()
    if (first.current) {
      first.current = false
      const d = p.pos.distanceTo(p.target) * 1.5
      camera.position.copy(p.target).addScaledVector(HOME_DIR.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -0.55), d)
      controls.current?.target.copy(p.target)
    }
    flyTo(p.pos, p.target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors, width])

  // Glide toward a room when it is picked from a list.
  useEffect(() => {
    const room = selected && game.rooms[selected]
    if (room && useGame.getState().focusOnSelect) {
      camApi.focus(slotX(room.slot), room.floor * FLOOR_H + 1.4, 0.5, 24)
      useGame.setState({ focusOnSelect: false })
    }
  }, [selected])

  useFrame((_, dt) => {
    const a = anim.current
    const c = controls.current
    if (!a || !c) return
    const k = 1 - Math.pow(0.004, Math.min(dt, 0.05))
    camera.position.lerp(a.pos, k)
    c.target.lerp(a.target, k)
    if (camera.position.distanceTo(a.pos) < 0.05 && c.target.distanceTo(a.target) < 0.05) anim.current = null
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.3}
      maxPolarAngle={1.32}
      minAzimuthAngle={-1.25}
      maxAzimuthAngle={1.45}
      minDistance={10}
      maxDistance={170}
      onStart={() => (anim.current = null)}
    />
  )
}

export default function Scene({ quality }) {
  return (
    <>
      <GameLoop />
      <CameraRig />
      {quality === 'high' && <SoftShadows size={22} samples={12} focus={0.7} />}
      <SceneContent />
      {quality !== 'low' && (
        <EffectComposer multisampling={quality === 'high' ? 4 : 0} enableNormalPass={false}>
          <N8AO halfRes={quality !== 'high'} aoRadius={1.6} intensity={1.8} distanceFalloff={0.6} color="#55618a" />
          <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1} luminanceSmoothing={0.25} />
          <Vignette offset={0.35} darkness={0.22} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      )}
    </>
  )
}

function SceneContent() {
  const floors = useGame((s) => s.snap.floors)
  const width = useGame((s) => s.snap.width)
  const lw = width * SLOT_W
  const center = [(lw - ELEV_W) / 2, (floors * FLOOR_H) / 2, 0]
  return (
    <>
      <Lighting center={center} />
      <Site width={width} />
      <Hotel />
      {/* capsule people until the character models arrive, so the game never waits on them */}
      <Suspense fallback={<Agents />}>
        <People />
        <Agents bodies={false} />
      </Suspense>
      <Floaters />
    </>
  )
}
