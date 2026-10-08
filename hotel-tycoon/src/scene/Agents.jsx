import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { game, ISLAND_PAD, lobbyWidth } from '../game/engine'

const MAX = 140
const dummy = new THREE.Object3D()
const tmpColor = new THREE.Color()
const offset = new THREE.Vector3()
const MOOD = { meh: '#ffd54f', angry: '#ff5a5a' }

function place(mesh, i, x, y, z, rotY, sx, sy = sx, sz = sx) {
  dummy.position.set(x, y, z)
  dummy.rotation.set(0, rotY, 0)
  dummy.scale.set(sx, sy, sz)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
}

// Every guest and housekeeper is drawn from a handful of instanced meshes.
export default function Agents() {
  const body = useRef()
  const head = useRef()
  const hair = useRef()
  const mood = useRef()
  const disc = useRef()
  const apron = useRef()

  const geos = useMemo(
    () => ({
      body: new THREE.CapsuleGeometry(0.17, 0.32, 4, 10),
      head: new THREE.SphereGeometry(0.16, 14, 12),
      hair: new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mood: new THREE.OctahedronGeometry(0.1),
      disc: new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20),
      apron: new THREE.BoxGeometry(0.26, 0.3, 0.04),
    }),
    []
  )

  // Create per-instance colour buffers up front so the shaders compile with them.
  useLayoutEffect(() => {
    for (const m of [body, hair, mood]) {
      for (let i = 0; i < MAX; i++) m.current.setColorAt(i, tmpColor.set('#ffffff'))
      m.current.instanceColor.needsUpdate = true
    }
  }, [])

  useFrame(() => {
    const t = performance.now() / 1000
    const agents = game.agents
    const n = Math.min(agents.length, MAX)
    const minX = -ISLAND_PAD
    const maxX = lobbyWidth() + ISLAND_PAD
    let moodCount = 0
    let discCount = 0
    let apronCount = 0
    for (let i = 0; i < n; i++) {
      const a = agents[i]
      const { x, y, z } = a.pos
      // shrink in/out at the island edges
      const edge = Math.min(x - minX, maxX - x)
      const s = (a.scale || 1) * Math.min(1, Math.max(0.001, edge / 1.2))
      const walking = a.moving && !a.inElevator
      const phase = t * 11 * Math.max(0.6, game.speed) + a.id
      const bob = walking ? Math.abs(Math.sin(phase)) * 0.07 : Math.sin(t * 2 + a.id) * 0.008
      const sway = walking ? Math.sin(phase) * 0.12 : 0
      const rot = a.heading || 0

      dummy.position.set(x, y + 0.36 * s + bob, z)
      dummy.rotation.set(0, rot, sway)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      body.current.setMatrixAt(i, dummy.matrix)
      body.current.setColorAt(i, tmpColor.set(a.color))

      place(head.current, i, x, y + 0.86 * s + bob, z, rot, s)
      offset.set(0, 0.03, -0.03).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rot)
      place(hair.current, i, x + offset.x * s, y + (0.89 + offset.y) * s + bob, z + offset.z * s, rot, s)
      hair.current.setColorAt(i, tmpColor.set(a.kind === 'staff' ? '#ffffff' : a.hair))

      if (a.kind === 'staff' && apronCount < MAX) {
        offset.set(0, 0, 0.17).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rot)
        place(apron.current, apronCount++, x + offset.x * s, y + 0.42 * s + bob, z + offset.z * s, rot, s)
      }
      if ((a.mood === 'meh' || a.mood === 'angry') && a.kind === 'guest') {
        place(mood.current, moodCount, x, y + 1.3 * s + Math.sin(t * 5 + a.id) * 0.05, z, t * 2, s)
        mood.current.setColorAt(moodCount, tmpColor.set(MOOD[a.mood]))
        moodCount++
      } else if (a.kind === 'guest' && a.tier === 2 && a.state !== 'leaving') {
        // VIPs get a little gold gem
        place(mood.current, moodCount, x, y + 1.3 * s + Math.sin(t * 3 + a.id) * 0.04, z, t, s * 0.8)
        mood.current.setColorAt(moodCount, tmpColor.set('#ffcf4a'))
        moodCount++
      }
      if (a.inElevator) {
        place(disc.current, discCount++, x, y - 0.02, z, 0, 1)
      }
    }
    for (const m of [body, head, hair]) {
      m.current.count = n
      m.current.instanceMatrix.needsUpdate = true
      if (m.current.instanceColor) m.current.instanceColor.needsUpdate = true
    }
    mood.current.count = moodCount
    mood.current.instanceMatrix.needsUpdate = true
    if (mood.current.instanceColor) mood.current.instanceColor.needsUpdate = true
    disc.current.count = discCount
    disc.current.instanceMatrix.needsUpdate = true
    apron.current.count = apronCount
    apron.current.instanceMatrix.needsUpdate = true
  })

  const noRay = () => null
  return (
    <group>
      <instancedMesh ref={body} args={[geos.body, undefined, MAX]} castShadow raycast={noRay} frustumCulled={false}>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={head} args={[geos.head, undefined, MAX]} castShadow raycast={noRay} frustumCulled={false}>
        <meshStandardMaterial color="#f6d2b8" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={hair} args={[geos.hair, undefined, MAX]} raycast={noRay} frustumCulled={false}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={apron} args={[geos.apron, undefined, MAX]} raycast={noRay} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={mood} args={[geos.mood, undefined, MAX]} raycast={noRay} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={disc} args={[geos.disc, undefined, 40]} raycast={noRay} frustumCulled={false}>
        <meshStandardMaterial color="#c9f1ff" emissive="#9fe7ff" emissiveIntensity={1.2} transparent opacity={0.75} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
