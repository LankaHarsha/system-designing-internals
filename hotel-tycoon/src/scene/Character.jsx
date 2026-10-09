import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CHARACTER_SCALE, CLIPS, modelUrl } from './characters'

// One standalone character by outfit name (see characters.js), playing `clip`.
// With `walk: [a, b]` it paces between the two points (used by the character lab).
// Crowds go through People.jsx instead, which pools clones and mixers.
export default function Character({ outfit, clip = 'idle', scale = CHARACTER_SCALE, position = [0, 0, 0], rotation = 0, walk }) {
  const { scene, animations } = useGLTF(modelUrl(outfit))
  const model = useMemo(() => {
    const c = SkeletonUtils.clone(scene)
    c.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false }
    })
    return c
  }, [scene])
  const group = useRef()
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    const action = actions[CLIPS[walk ? 'walk' : clip]]
    action?.reset().fadeIn(0.2).play()
    return () => { action?.fadeOut(0.2) }
  }, [actions, walk, clip])

  useFrame((state) => {
    if (!walk || !group.current) return
    const [a, b] = walk
    const span = Math.hypot(b[0] - a[0], b[2] - a[2])
    const t = (state.clock.elapsedTime * 1.4) / span
    const leg = Math.floor(t) % 2 // 0: a → b, 1: b → a
    const f = t % 1
    const [from, to] = leg ? [b, a] : [a, b]
    group.current.position.set(from[0] + (to[0] - from[0]) * f, 0, from[2] + (to[2] - from[2]) * f)
    group.current.rotation.y = Math.atan2(to[0] - from[0], to[2] - from[2])
  })

  return (
    <group ref={group} position={position} rotation={[0, rotation, 0]}>
      <primitive object={model} scale={scale} />
    </group>
  )
}
