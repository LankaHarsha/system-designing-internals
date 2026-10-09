import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Today's in-game person (same shapes as scene/Agents.jsx), for side-by-side comparison.
export default function CurrentPerson({ color, hair = '#3b2a20', staff = false, position = [0, 0, 0], rotation = 0, scale = 2.1, walk, seed = 0 }) {
  const group = useRef()
  const body = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    let moving = false
    if (walk && group.current) {
      const [a, b] = walk
      const span = Math.hypot(b[0] - a[0], b[2] - a[2])
      const p = (t * 1.4) / span
      const [from, to] = Math.floor(p) % 2 ? [b, a] : [a, b]
      const f = p % 1
      group.current.position.set(from[0] + (to[0] - from[0]) * f, 0, from[2] + (to[2] - from[2]) * f)
      group.current.rotation.y = Math.atan2(to[0] - from[0], to[2] - from[2])
      moving = true
    }
    const phase = t * 11 + seed
    body.current.position.y = moving ? Math.abs(Math.sin(phase)) * 0.07 : Math.sin(t * 2 + seed) * 0.008
    body.current.rotation.z = moving ? Math.sin(phase) * 0.12 : 0
  })
  return (
    <group ref={group} position={position} rotation={[0, rotation, 0]}>
      <group scale={scale}>
        <group ref={body}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <capsuleGeometry args={[0.17, 0.32, 8, 20]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.86, 0]} castShadow>
            <sphereGeometry args={[0.16, 24, 18]} />
            <meshStandardMaterial color="#f6d2b8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.92, -0.03]}>
            <sphereGeometry args={[0.17, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={staff ? '#ffffff' : hair} roughness={0.8} />
          </mesh>
          {staff && (
            <mesh position={[0, 0.42, 0.17]}>
              <boxGeometry args={[0.26, 0.3, 0.04]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  )
}
