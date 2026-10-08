import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './scene/Scene'
import HUD from './ui/HUD'
import { useGame } from './game/store'

function pickQuality() {
  try {
    const saved = localStorage.getItem('hotel-tycoon-quality')
    if (saved) return saved
  } catch { /* ignore */ }
  return window.innerWidth < 700 ? 'medium' : 'high'
}

export default function App() {
  const [quality, setQualityState] = useState(pickQuality)
  const setQuality = (q) => {
    setQualityState(q)
    try { localStorage.setItem('hotel-tycoon-quality', q) } catch { /* ignore */ }
  }
  return (
    <div className="app">
      <Canvas
        key={quality === 'low' ? 'low' : 'fx'}
        orthographic
        shadows={quality === 'low' ? 'basic' : 'soft'}
        flat={quality !== 'low'}
        dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
        camera={{ position: [40, 30, 46], zoom: 22, near: -200, far: 400 }}
        gl={{ antialias: quality === 'low', powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          if (quality === 'low') gl.toneMapping = THREE.ACESFilmicToneMapping
        }}
        onPointerMissed={() => useGame.getState().setSelected(null)}
      >
        <Suspense fallback={null}>
          <Scene quality={quality} />
        </Suspense>
      </Canvas>
      <HUD quality={quality} setQuality={setQuality} />
    </div>
  )
}
