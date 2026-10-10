import { B, Cyl, Ball, mat, glowMat, sphereGeo } from './parts'

// All furniture is laid out in slot-local space: x ∈ [-2, 2], z ∈ [-2, 2], floor at y = 0.

function Bed({ position, w = 1.3, l = 1.9, sheet = '#ffffff', blanket = '#e98a6b', frame = '#c98a5b' }) {
  return (
    <group position={position}>
      <B args={[w + 0.1, 0.3, l + 0.1]} r={0.06} color={frame} position={[0, 0.15, 0]} />
      <B args={[w, 0.22, l]} r={0.08} color={sheet} position={[0, 0.4, 0]} />
      <B args={[w + 0.02, 0.1, l * 0.62]} r={0.05} color={blanket} position={[0, 0.53, l * 0.18]} />
      <B args={[w * 0.4, 0.14, 0.32]} r={0.07} color="#fdfbf7" position={[-w * 0.23, 0.58, -l / 2 + 0.25]} />
      <B args={[w * 0.4, 0.14, 0.32]} r={0.07} color="#fdfbf7" position={[w * 0.23, 0.58, -l / 2 + 0.25]} />
      <B args={[w + 0.14, 0.9, 0.12]} r={0.05} color={frame} position={[0, 0.5, -l / 2 - 0.05]} />
    </group>
  )
}

function Nightstand({ position, lamp = '#ffe7b0' }) {
  return (
    <group position={position}>
      <B args={[0.45, 0.45, 0.4]} r={0.05} color="#d9a877" position={[0, 0.225, 0]} />
      <Cyl args={[0.04, 0.06, 0.25, 8]} color="#6b5a4f" position={[0, 0.57, 0]} />
      <Cyl args={[0.1, 0.16, 0.18, 12]} m={glowMat(lamp, 0.15, 2.2)} position={[0, 0.75, 0]} shadow={false} />
    </group>
  )
}

function Plant({ position, s = 1 }) {
  return (
    <group position={position} scale={s}>
      <Cyl args={[0.16, 0.12, 0.3, 10]} color="#e3a27c" position={[0, 0.15, 0]} />
      <mesh geometry={sphereGeo(0.26, 7)} material={mat('#79bf7f', { flatShading: true })} position={[0, 0.48, 0]} castShadow />
      <mesh geometry={sphereGeo(0.18, 6)} material={mat('#8fd18a', { flatShading: true })} position={[0.12, 0.66, 0.05]} castShadow />
    </group>
  )
}

function Rug({ position, w, d, color }) {
  return <B args={[w, 0.02, d]} r={0.01} color={color} position={[position[0], 0.012, position[2]]} shadow={false} />
}

function Frame({ position, color = '#f2b880', w = 0.8, h = 0.55 }) {
  return (
    <group position={position}>
      <B args={[w, h, 0.05]} color="#fdf6ea" shadow={false} />
      <B args={[w - 0.12, h - 0.12, 0.06]} color={color} shadow={false} />
    </group>
  )
}

function Sofa({ position, color = '#4f9d8a', rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <B args={[1.3, 0.3, 0.6]} r={0.1} color={color} position={[0, 0.25, 0]} />
      <B args={[1.3, 0.45, 0.18]} r={0.08} color={color} position={[0, 0.5, -0.22]} />
      <B args={[0.18, 0.4, 0.6]} r={0.08} color={color} position={[-0.6, 0.38, 0]} />
      <B args={[0.18, 0.4, 0.6]} r={0.08} color={color} position={[0.6, 0.38, 0]} />
    </group>
  )
}

function Table({ position, r = 0.4, top = '#fdf6ea', h = 0.55 }) {
  return (
    <group position={position}>
      <Cyl args={[r, r, 0.06, 16]} color={top} position={[0, h, 0]} />
      <Cyl args={[0.05, 0.08, h, 8]} color="#6b5a4f" position={[0, h / 2, 0]} />
    </group>
  )
}

function Chair({ position, color = '#e0a43c', rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <B args={[0.34, 0.06, 0.34]} r={0.03} color={color} position={[0, 0.36, 0]} />
      <B args={[0.34, 0.36, 0.05]} r={0.02} color={color} position={[0, 0.56, -0.15]} />
      <Cyl args={[0.03, 0.03, 0.36, 6]} color="#6b5a4f" position={[0, 0.18, 0]} />
    </group>
  )
}

function Tv({ position }) {
  return (
    <group position={position}>
      <B args={[1.1, 0.4, 0.4]} r={0.04} color="#8a6e5a" position={[0, 0.2, 0]} />
      <B args={[1.0, 0.6, 0.06]} r={0.02} color="#2d2b3a" position={[0, 0.85, -0.05]} />
      <B args={[0.9, 0.5, 0.02]} m={glowMat('#7ac6e8', 0.6, 1.6)} position={[0, 0.85, -0.01]} shadow={false} />
    </group>
  )
}

export function StandardRoom({ def }) {
  return (
    <group>
      <Rug position={[0.1, 0, 0.1]} w={1.8} d={1.4} color="#f2c6a6" />
      <Bed position={[-0.8, 0, -0.75]} w={1.0} l={1.7} blanket={def.accent} />
      <Nightstand position={[0.1, 0, -1.55]} />
      <Plant position={[1.55, 0, -1.55]} />
      <B args={[0.8, 0.75, 0.45]} r={0.05} color="#d9a877" position={[1.3, 0.375, 0.2]} />
      <Frame position={[-0.8, 1.75, -1.93]} color="#e98a6b" />
    </group>
  )
}

export function DeluxeRoom({ def }) {
  return (
    <group>
      <Rug position={[0, 0, 0.2]} w={2.6} d={1.8} color="#f4ead8" />
      <Bed position={[-0.65, 0, -0.7]} w={1.5} l={1.9} blanket={def.accent} frame="#b98458" />
      <Nightstand position={[0.4, 0, -1.55]} />
      <Nightstand position={[-1.7, 0, -1.55]} />
      <Sofa position={[1.15, 0, 0.6]} color="#f1b77a" rotation={[0, -Math.PI / 2, 0]} />
      <Table position={[0.4, 0, 0.75]} r={0.28} h={0.35} />
      <Plant position={[1.6, 0, -1.55]} s={1.2} />
      <Frame position={[-0.65, 1.85, -1.93]} color="#4f9d8a" w={1.1} />
    </group>
  )
}

export function SuiteRoom({ def }) {
  return (
    <group>
      <Rug position={[-0.3, 0, 0.1]} w={2.8} d={2.4} color="#efe4f7" />
      <Bed position={[-0.75, 0, -0.65]} w={1.8} l={2.0} blanket={def.accent} frame="#8a5e3f" sheet="#fffaf1" />
      <Nightstand position={[0.5, 0, -1.55]} lamp="#ffd28a" />
      <Nightstand position={[-1.85, 0, -1.55]} lamp="#ffd28a" />
      {/* bathtub */}
      <group position={[1.35, 0, -1.05]}>
        <B args={[0.85, 0.5, 1.5]} r={0.2} color="#ffffff" position={[0, 0.25, 0]} />
        <B args={[0.65, 0.04, 1.25]} r={0.02} color="#9fdcef" position={[0, 0.48, 0]} shadow={false} />
        <Ball r={0.08} color="#ffffff" position={[0.1, 0.52, 0.2]} shadow={false} />
        <Ball r={0.1} color="#ffffff" position={[-0.1, 0.53, -0.2]} shadow={false} />
      </group>
      <Tv position={[1.3, 0, 1.2]} />
      <Chair position={[0.3, 0, 1.0]} color="#c8b6e6" rotation={[0, Math.PI * 0.85, 0]} />
      <Plant position={[-1.8, 0, 1.4]} s={1.3} />
      <Frame position={[-0.75, 1.9, -1.93]} color="#f2c14e" w={1.3} h={0.7} />
      {/* chandelier */}
      <Cyl args={[0.01, 0.01, 0.5, 4]} color="#d8b860" position={[-0.6, 2.5, -0.3]} shadow={false} />
      <Ball r={0.18} m={glowMat('#ffe0a0', 0.4, 2.6)} position={[-0.6, 2.2, -0.3]} shadow={false} />
    </group>
  )
}

export function Restaurant({ def }) {
  return (
    <group>
      {[[-1.2, -0.3], [1.2, -0.3], [-1.2, 0.7], [1.2, 0.7]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Table position={[0, 0, 0]} r={0.36} top="#ffffff" />
          <Chair position={[-0.45, 0, 0]} rotation={[0, Math.PI / 2, 0]} color={def.accent} />
          <Chair position={[0.45, 0, 0]} rotation={[0, -Math.PI / 2, 0]} color={def.accent} />
          <Ball r={0.06} color="#f28b82" position={[0, 0.63, 0]} shadow={false} />
        </group>
      ))}
      {/* buffet counter */}
      <B args={[3.2, 0.8, 0.5]} r={0.06} color="#f3e1c4" position={[0, 0.4, -1.65]} />
      {[-1.1, -0.35, 0.4, 1.15].map((x, i) => (
        <Cyl key={i} args={[0.18, 0.2, 0.12, 12]} color={['#f6c36b', '#e98a6b', '#9bd27c', '#f28b82'][i]} position={[x, 0.86, -1.65]} />
      ))}
      <Ball r={0.16} m={glowMat('#ffd88a', 0.3, 2.6)} position={[-1, 2.35, 0.2]} shadow={false} />
      <Ball r={0.16} m={glowMat('#ffd88a', 0.3, 2.6)} position={[1, 2.35, 0.2]} shadow={false} />
    </group>
  )
}

export function Bar({ def }) {
  return (
    <group>
      <B args={[3.4, 0.95, 0.6]} r={0.08} color="#3d4f86" position={[0, 0.475, -0.85]} />
      <B args={[3.5, 0.06, 0.7]} r={0.03} color="#d9b46a" position={[0, 0.98, -0.85]} />
      {/* bottle shelf */}
      <B args={[3.4, 0.06, 0.3]} color="#7b5a45" position={[0, 1.6, -1.8]} />
      <B args={[3.4, 0.06, 0.3]} color="#7b5a45" position={[0, 2.1, -1.8]} />
      {Array.from({ length: 12 }).map((_, i) => (
        <Cyl
          key={i}
          args={[0.05, 0.06, 0.32, 8]}
          m={glowMat(['#ffd36e', '#7ae0c9', '#f48fb1', '#a7c7e7'][i % 4], 0.4, 1.8)}
          position={[-1.5 + (i % 6) * 0.6, i < 6 ? 1.79 : 2.29, -1.8]}
          shadow={false}
        />
      ))}
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <group key={i} position={[x, 0, -0.25]}>
          <Cyl args={[0.18, 0.18, 0.06, 12]} color="#f48fb1" position={[0, 0.7, 0]} />
          <Cyl args={[0.03, 0.12, 0.7, 8]} color="#c9c3d6" position={[0, 0.35, 0]} />
        </group>
      ))}
      <B args={[3.6, 0.08, 0.08]} m={glowMat('#ff7ac0', 1.2, 3.5)} position={[0, 2.62, 0.4]} shadow={false} />
    </group>
  )
}

export function Spa({ def }) {
  return (
    <group>
      {/* pool */}
      <B args={[2.4, 0.3, 1.8]} r={0.12} color="#ffffff" position={[-0.6, 0.15, -0.6]} />
      <B args={[2.1, 0.04, 1.5]} m={glowMat('#6fd3e3', 0.35, 1.4)} position={[-0.6, 0.3, -0.6]} shadow={false} />
      {/* loungers */}
      {[0.4, 1.3].map((z, i) => (
        <group key={i} position={[1.35, 0, z - 0.4]}>
          <B args={[0.6, 0.12, 1.2]} r={0.05} color="#ffffff" position={[0, 0.3, 0]} />
          <B args={[0.6, 0.4, 0.1]} r={0.04} color="#ffffff" position={[0, 0.5, -0.55]} rotation={[-0.5, 0, 0]} />
          <B args={[0.5, 0.04, 1.0]} r={0.02} color={def.accent} position={[0, 0.38, 0.05]} shadow={false} />
        </group>
      ))}
      <Plant position={[-1.7, 0, 1.4]} s={1.4} />
      <Plant position={[0.4, 0, 1.5]} s={1.1} />
      <Ball r={0.16} m={glowMat('#c8f4ff', 0.3, 2.2)} position={[0, 2.35, 0]} shadow={false} />
    </group>
  )
}

export const FURNITURE = {
  inn: StandardRoom, // the inherited rooms: same furniture, tired colours (ROOM_TYPES.inn)
  standard: StandardRoom,
  deluxe: DeluxeRoom,
  suite: SuiteRoom,
  restaurant: Restaurant,
  bar: Bar,
  spa: Spa,
}

export { Plant, Sofa, Table, Chair }
