import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

// Any rigged glTF/GLB character. Plays the clip whose name matches `clips.idle`,
// or `clips.walk` while walking back and forth between the two points in `walk`.
export default function RiggedCharacter({ url, scale = 1, clips, position = [0, 0, 0], rotation = 0, walk }) {
  const { scene, animations } = useGLTF(url)
  const model = useMemo(() => {
    const c = SkeletonUtils.clone(scene)
    c.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true }
    })
    return c
  }, [scene])
  const group = useRef()
  const { actions, names } = useAnimations(animations, group)

  useEffect(() => {
    const want = new RegExp(walk ? clips.walk : clips.idle, 'i')
    const name = names.find((n) => want.test(n)) ?? names[0]
    const action = name && actions[name]
    action?.reset().fadeIn(0.2).play()
    return () => { action?.fadeOut(0.2) }
  }, [actions, names, walk, clips])

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
