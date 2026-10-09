import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, SoftShadows } from '@react-three/drei'
import Prop from './Prop'
import Character from '../scene/Character'
import { MODELS, OUTFITS } from '../scene/characters'
import CurrentPerson from './CurrentPerson'

// Character lab (open the game with ?lab): one hotel lobby built from KayKit props with
// every outfit the game uses (src/scene/characters.js) next to the old capsule people,
// to judge new outfits by eye before they go into the game.

const ROWS_Z = 3.2
const GROUP_X = { current: -6.5, outfits: 3 }
const WALK = { current: [[-5.5, 0, -2.6], [-0.5, 0, -2.6]], outfits: [[0, 0, 0.6], [7, 0, 0.6]] }
const LAB_SCALE = 1.2 // KayKit props are about 1.3 units per metre

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
      <Label position={[x, 3.4, ROWS_Z]} title="Before" sub="the old capsule people" />
    </group>
  )
}

function OutfitGroup() {
  const x = GROUP_X.outfits
  const n = MODELS.length
  return (
    <group>
      <Suspense fallback={null}>
        {MODELS.map((m, i) => (
          <Character key={m} outfit={m} scale={LAB_SCALE} position={[x - 6 + (i % 5) * 3 + (i >= 5 ? 1.5 : 0), 0, ROWS_Z + (i >= 5 ? 2.2 : 0)]} />
        ))}
        <Character outfit={OUTFITS.housekeeper[0]} scale={LAB_SCALE} walk={WALK.outfits} />
      </Suspense>
      <Label position={[x, 3.6, ROWS_Z]} title="Quaternius Modular" sub={`${n} outfits, CC0`} />
    </group>
  )
}

export default function Lab() {
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
          <OutfitGroup />
        </Suspense>
        <OrbitControls target={[0, 0.8, -1]} maxPolarAngle={Math.PI / 2.2} minDistance={8} maxDistance={60} />
      </Canvas>
      <div className="lab-card">
        <h1>Character lab</h1>
        <p>Same lobby, same light: every outfit in the game.</p>
        <ul>
          <li><b>Before</b> — the old capsule people</li>
          {Object.entries(OUTFITS).map(([role, list]) => (
            <li key={role}><b>{role}</b> — {list.join(', ')}</li>
          ))}
        </ul>
        <a href="./">← Back to the game</a>
      </div>
    </div>
  )
}
