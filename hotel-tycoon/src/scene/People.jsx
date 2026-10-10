import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { game, WALK_RANGE, lobbyWidth } from '../game/engine'
import { MINUTES_PER_SECOND, WALK_SPEED } from '../game/constants'
import {
  CHARACTER_SCALE, CLIPS, MODELS, RUN_STRIDE_SPEED, WALK_STRIDE_SPEED, modelUrl, outfitFor,
} from './characters'

const URLS = MODELS.map(modelUrl)
const FADE = 0.2

// A flat accent ring at the owner's feet, so you can always find yourself.
const OWNER_RING = new THREE.RingGeometry(0.62, 0.8, 40).rotateX(-Math.PI / 2)
const OWNER_RING_MAT = new THREE.MeshBasicMaterial({ color: '#ff6a45', transparent: true, opacity: 0.85, depthWrite: false })

// One skinned, animated clone of an outfit. Geometry and material are shared with the
// loaded file; only the skeleton and the AnimationMixer are per person.
function makePerson(gltf, isOwner) {
  const root = SkeletonUtils.clone(gltf.scene)
  if (isOwner) {
    const ring = new THREE.Mesh(OWNER_RING, OWNER_RING_MAT)
    ring.position.y = 0.03
    ring.raycast = () => null
    root.add(ring)
  }
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.frustumCulled = false // skinned bounds come from the bind pose, so culling misfires
      o.raycast = () => null
    }
  })
  const mixer = new THREE.AnimationMixer(root)
  const actions = {}
  for (const [key, name] of Object.entries(CLIPS)) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name)
    if (clip) actions[key] = mixer.clipAction(clip)
  }
  return { root, mixer, actions, current: null }
}

function play(p, key, timeScale) {
  const next = p.actions[key] ?? p.actions.idle
  next.timeScale = timeScale
  if (p.current === next) return
  next.reset().fadeIn(FADE).play()
  p.current?.fadeOut(FADE)
  p.current = next
}

// Every guest, housekeeper and the owner as a rigged, animated character. Mood gems and
// elevator discs stay in <Agents bodies={false} />.
export default function People() {
  const gltfs = useGLTF(URLS)
  const byOutfit = useMemo(() => Object.fromEntries(MODELS.map((m, i) => [m, gltfs[i]])), [gltfs])
  const group = useRef()
  const pool = useMemo(() => new Map(), [])
  const frame = useRef(0) // stamps pooled people seen this frame; no per-frame allocations

  useEffect(() => {
    // tests wait for this so slow software WebGL doesn't stall mid-assertion on the swap
    if (window.hotel) window.hotel.peopleReady = true
    return () => {
      for (const p of pool.values()) p.mixer.stopAllAction()
      pool.clear()
    }
  }, [pool])

  // place, pose and animate one person (pooled by agent id)
  const update = (a, dt, minX, maxX) => {
    let p = pool.get(a.id)
    if (!p) {
      p = makePerson(byOutfit[outfitFor(a)], a.kind === 'owner')
      pool.set(a.id, p)
      group.current.add(p.root)
    }
    p.seen = frame.current
    const { x, y, z } = a.pos
    // shrink in/out at the island edges, like the old capsules
    const edge = Math.min(x - minX, maxX - x)
    const s = CHARACTER_SCALE * (a.scale || 1) * Math.min(1, Math.max(0.001, edge / 1.2))
    p.root.position.set(x, y, z)
    p.root.rotation.y = a.heading || 0
    p.root.scale.setScalar(s)

    const speed = WALK_SPEED * MINUTES_PER_SECOND * game.speed * (a.speedMul || 1)
    if (a.moving && !a.inElevator && game.speed) {
      // walk while the stride can keep up, run beyond that; clamp so feet barely slide
      const run = speed > WALK_STRIDE_SPEED * 2.4
      const stride = (run ? RUN_STRIDE_SPEED : WALK_STRIDE_SPEED) * (a.scale || 1) // taller people stride further
      play(p, run ? 'run' : 'walk', THREE.MathUtils.clamp(speed / stride, 0.6, 2.4))
    } else if (a.state === 'cleaning' || a.state === 'fixing') {
      play(p, 'work', 1)
    } else {
      play(p, 'idle', 1)
    }
    p.mixer.update(dt)
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const minX = -WALK_RANGE
    const maxX = lobbyWidth() + WALK_RANGE + 1
    frame.current++
    for (const a of game.agents) if (!a.hidden) update(a, dt, minX, maxX)
    update(game.owner, dt, minX, maxX)
    for (const [id, p] of pool) {
      if (p.seen === frame.current) continue
      p.mixer.stopAllAction()
      group.current.remove(p.root)
      pool.delete(id)
    }
  })

  return <group ref={group} />
}

for (const url of URLS) useGLTF.preload(url)
