import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, SoftShadows } from '@react-three/drei'
import Prop from './Prop'
import RiggedCharacter from './RiggedCharacter'
import CurrentPerson from './CurrentPerson'

// Character lab (open the game with ?lab): one hotel lobby built from KayKit props,
// with today's people next to each candidate character pack, so we can pick one
// art family by eye. Packs are listed in public/assets/characters/manifest.json.

const ROWS_Z = 3.2
const GROUP_X = { current: -6.5, A: 0, B: 6.5 }
const WALK = { current: [[-5.5, 0, -2.6], [-0.5, 0, -2.6]], A: [[-1, 0, -1], [4, 0, -1]], B: [[3, 0, 0.6], [8, 0, 0.6]] }

function Lobby() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[22, 14]} />
        <meshStandardMaterial color="#efe3d3" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.4, -7.1]} receiveShadow>
        <boxGeometry args={[22, 4.8, 0.2]} />
        <meshStandardMaterial color="#f6f1ea" roughness={0.9} />
      </mesh>
      <mesh position={[-11.1, 2.4, 0]} receiveShadow>
        <boxGeometry args={[0.2, 4.8, 14]} />
        <meshStandardMaterial color="#f3ece3" roughness={0.9} />
      </mesh>

      {/* reception */}
      <Prop name="restaurant/kitchencounter_straight_A" position={[-7, 0, -5]} />
      <Prop name="restaurant/kitchencounter_straight_A" position={[-5, 0, -5]} />
      <Prop name="restaurant/kitchencounter_straight_A" position={[-3, 0, -5]} />
      <Prop name="furniture/cactus_small_B" position={[-2.6, 1, -5.3]} />
      <Prop name="furniture/lamp_table" position={[-7, 1, -5.4]} scale={0.8} />
      <Prop name="furniture/pictureframe_large_A" position={[-5, 3.1, -6.95]} />

      {/* lounge */}
      <Prop name="furniture/rug_rectangle_stripes_A" position={[5, 0, -3.6]} scale={1.3} />
      <Prop name="furniture/couch_pillows" position={[5, 0, -5.8]} />
      <Prop name="furniture/armchair_pillows" position={[8.2, 0, -3.4]} rotation-y={-Math.PI / 2} />
      <Prop name="furniture/table_low" position={[5, 0, -3.4]} />
      <Prop name="furniture/lamp_standing" position={[2.4, 0, -6.2]} />
      <Prop name="furniture/cactus_medium_A" position={[9.6, 0, -6.2]} />
      <Prop name="furniture/shelf_B_large_decorated" position={[5, 2.7, -6.75]} />

      {/* café corner */}
      <Prop name="restaurant/table_round_A" position={[-8.8, 0, -0.6]} scale={0.7} />
      <Prop name="restaurant/chair_A" position={[-8.8, 0, -1.9]} />
      <Prop name="restaurant/chair_A" position={[-8.8, 0, 0.7]} rotation-y={Math.PI} />
      <Prop name="furniture/cactus_medium_A" position={[-10.2, 0, 6]} />
    </group>
  )
}

function Label({ position, title, sub }) {
  return (
    <Html position={position} center distanceFactor={18} zIndexRange={[10, 0]}>
      <div className="lab-label">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </div>
    </Html>
  )
}

const CURRENT = [
  { color: '#5b8def', staff: true },
  { color: '#ff8a65', hair: '#6b4a2f' },
  { color: '#6fd39a', hair: '#d9a441' },
]

function CurrentGroup() {
  const x = GROUP_X.current
  return (
    <group>
      {CURRENT.map((p, i) => (
        <CurrentPerson key={i} {...p} seed={i} position={[x - 1.6 + i * 1.6, 0, ROWS_Z]} />
      ))}
      <CurrentPerson color="#e98a6b" staff walk={WALK.current} seed={7} />
      <Label position={[x, 3.4, ROWS_Z]} title="Today" sub="in-game people now" />
    </group>
  )
}

function PackGroup({ pack }) {
  const x = GROUP_X[pack.stack] ?? 0
  const url = (m) => `./assets/characters/${pack.dir}/${m}`
  const installed = pack.models.length > 0
  return (
    <group>
      {installed ? (
        <Suspense fallback={null}>
          {pack.models.slice(0, 3).map((m, i) => (
            <RiggedCharacter key={m} url={url(m)} scale={pack.scale} clips={pack.clips} position={[x - 1.6 + i * 1.6, 0, ROWS_Z]} />
          ))}
          <RiggedCharacter url={url(pack.models[3 % pack.models.length])} scale={pack.scale} clips={pack.clips} walk={WALK[pack.stack]} />
        </Suspense>
      ) : (
        <mesh position={[x, 0.05, ROWS_Z]} receiveShadow>
          <cylinderGeometry args={[2.2, 2.2, 0.1, 48]} />
          <meshStandardMaterial color="#e4dccf" />
        </mesh>
      )}
      <Label position={[x, 3.4, ROWS_Z]} title={`${pack.stack} · ${pack.name}`} sub={installed ? pack.license : 'not installed yet'} />
    </group>
  )
}

export default function Lab() {
  const [packs, setPacks] = useState([])
  useEffect(() => {
    // no-store: browsers that visited before the cache fix hold a year-long copy
    fetch('./assets/characters/manifest.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPacks(d.packs))
      .catch(() => setPacks([]))
  }, [])

  return (
    <div className="app lab">
      <Canvas shadows camera={{ fov: 30, position: [20, 17, 26], near: 0.5, far: 200 }}>
        <color attach="background" args={['#f4efe8']} />
        <SoftShadows size={20} samples={12} focus={0.6} />
        <hemisphereLight args={['#fff6ea', '#d9cbb8', 1.1]} />
        <directionalLight
          position={[10, 18, 12]}
          intensity={2.2}
          color="#fff1df"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <Suspense fallback={null}>
          <Lobby />
          <CurrentGroup />
          {packs.map((p) => <PackGroup key={p.id} pack={p} />)}
        </Suspense>
        <OrbitControls target={[0, 0.8, -1]} maxPolarAngle={Math.PI / 2.2} minDistance={8} maxDistance={60} />
      </Canvas>
      <div className="lab-card">
        <h1>Character lab</h1>
        <p>Same lobby, same light. Which people belong in this world?</p>
        <ul>
          <li><b>Today</b> — the current in-game people</li>
          {packs.map((p) => (
            <li key={p.id}>
              <b>{p.stack} · {p.name}</b> — {p.models.length ? `${p.models.length} models, ${p.license}` : 'not installed yet'}
            </li>
          ))}
        </ul>
        <a href="./">← Back to the game</a>
      </div>
    </div>
  )
}
