import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom, HueSaturation, N8AO, Vignette, TiltShift2, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { game, step } from '../game/engine'
import { useGame, syncUI } from '../game/store'
import { SLOT_W, FLOOR_H, ELEV_W } from '../game/constants'
import { Sky, Lights, Island } from './Environment'
import Hotel from './Hotel'
import Agents from './Agents'

function GameLoop() {
  const acc = useRef(0)
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

function CameraRig() {
  const floors = useGame((s) => s.snap.floors)
  const width = useGame((s) => s.snap.width)
  const controls = useRef()
  const { camera, size } = useThree()
  const first = useRef(true)

  useEffect(() => {
    const lw = width * SLOT_W
    const cx = (lw - ELEV_W) / 2
    const cy = ((floors + 1) * FLOOR_H) / 2
    const c = controls.current
    if (!c) return
    const dx = camera.position.x - c.target.x
    const dy = camera.position.y - c.target.y
    const dz = camera.position.z - c.target.z
    c.target.set(cx, cy - 1.2, 0)
    if (first.current) {
      camera.position.set(cx + 34, cy + 26, 46)
      first.current = false
    } else {
      camera.position.set(cx + dx, cy + dy, dz)
    }
    // leave room for the top bar and build bar
    const fitW = size.width / (lw + ELEV_W + (size.width < 760 ? 6 : 18))
    const fitH = Math.max(200, size.height - 190) / ((floors + 1.6) * FLOOR_H + 7)
    camera.zoom = Math.max(8, Math.min(60, Math.min(fitW, fitH)))
    camera.updateProjectionMatrix()
    c.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors, width])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.55}
      maxPolarAngle={1.38}
      minAzimuthAngle={-1.0}
      maxAzimuthAngle={1.2}
      minZoom={7}
      maxZoom={110}
      screenSpacePanning
    />
  )
}

export default function Scene({ quality }) {
  return (
    <>
      <Sky />
      <GameLoop />
      <CameraRig />
      <SceneContent />
      {quality !== 'low' && (
        <EffectComposer multisampling={quality === 'high' ? 4 : 0} enableNormalPass={false}>
          <N8AO halfRes aoRadius={1.4} intensity={2.2} distanceFalloff={0.8} color="#3a2f4a" />
          <HueSaturation saturation={0.12} />
          <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.92} luminanceSmoothing={0.2} />
          <TiltShift2 blur={0.08} taper={0.6} start={[0.5, 0.0]} end={[0.5, 1.0]} />
          <Vignette offset={0.25} darkness={0.45} />
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
      <Lights center={center} />
      <Island width={width} />
      <Hotel />
      <Agents />
      <Floaters />
    </>
  )
}
