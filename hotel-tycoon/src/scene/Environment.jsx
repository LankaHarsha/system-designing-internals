import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { game, SIDEWALK_Z, ISLAND_PAD } from '../game/engine'
import { DEPTH, SLOT_W } from '../game/constants'
import { B, Cyl, Ball, mat, coneGeo, sphereGeo, glowMat, env, updateGlowMats } from './parts'

// ---------------------------------------------------------------- day / night palette
const KEYS = [
  { h: 0, top: '#111735', bottom: '#2c2c5e', sun: 0.0, hemi: 0.35, sunColor: '#8fa2ff', night: 1 },
  { h: 4.5, top: '#18204a', bottom: '#40386c', sun: 0.0, hemi: 0.38, sunColor: '#8fa2ff', night: 1 },
  { h: 6, top: '#6f86c9', bottom: '#f6b49b', sun: 0.9, hemi: 0.6, sunColor: '#ffb98a', night: 0.35 },
  { h: 8, top: '#8ec5ec', bottom: '#fde5cf', sun: 2.8, hemi: 1.25, sunColor: '#fff0dc', night: 0 },
  { h: 13, top: '#7fc0ea', bottom: '#e4f3f6', sun: 3.1, hemi: 1.35, sunColor: '#fff6ea', night: 0 },
  { h: 17, top: '#8ab5e3', bottom: '#fcdcb9', sun: 2.8, hemi: 1.25, sunColor: '#ffe2bf', night: 0 },
  { h: 19, top: '#7469b3', bottom: '#f8a589', sun: 1.1, hemi: 0.65, sunColor: '#ff9d6e', night: 0.4 },
  { h: 20.5, top: '#2b2c66', bottom: '#6d4f8c', sun: 0.15, hemi: 0.42, sunColor: '#9a8cff', night: 0.9 },
  { h: 24, top: '#111735', bottom: '#2c2c5e', sun: 0.0, hemi: 0.35, sunColor: '#8fa2ff', night: 1 },
]
const cA = new THREE.Color()
const cB = new THREE.Color()
function sample(hour) {
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = (hour - a.h) / (b.h - a.h)
  const lerpC = (x, y, out) => out.copy(cA.set(x)).lerp(cB.set(y), t)
  return {
    top: lerpC(a.top, b.top, new THREE.Color()),
    bottom: lerpC(a.bottom, b.bottom, new THREE.Color()),
    sunColor: lerpC(a.sunColor, b.sunColor, new THREE.Color()),
    sun: a.sun + (b.sun - a.sun) * t,
    hemi: a.hemi + (b.hemi - a.hemi) * t,
    night: a.night + (b.night - a.night) * t,
  }
}

export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, stars: { value: 0 }, time: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
        fragmentShader: `
          uniform vec3 top; uniform vec3 bottom; uniform float stars; uniform float time; varying vec2 vUv;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          void main(){
            float t = smoothstep(0.0, 1.0, vUv.y);
            vec3 col = mix(bottom, top, t);
            vec2 grid = vUv * vec2(220.0, 124.0);
            vec2 g = floor(grid);
            float h = hash(g);
            float d = length(fract(grid) - 0.5);
            float tw = 0.6 + 0.4 * sin(h * 80.0 + time * (1.0 + h * 3.0));
            float s = step(0.985, h) * smoothstep(0.16, 0.0, d) * tw * stars * smoothstep(0.3, 0.9, vUv.y);
            col += vec3(s);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
        depthWrite: false,
        depthTest: false,
      }),
    []
  )
  useFrame(() => {
    const s = sample(game.minute / 60)
    material.uniforms.top.value.copy(s.top)
    material.uniforms.bottom.value.copy(s.bottom)
    material.uniforms.stars.value = s.night
    material.uniforms.time.value = performance.now() / 1000
  })
  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

export function Lights({ center }) {
  const sun = useRef()
  const hemi = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const hour = game.minute / 60
    const s = sample(hour)
    env.night = s.night
    env.hour = hour
    updateGlowMats()
    // Sun travels east -> west; at night the "sun" becomes a dim moon from the other side.
    const dayT = (hour - 6) / 14
    const ang = dayT * Math.PI
    const isDay = hour > 5.5 && hour < 20.5
    const a = isDay ? ang : ang + Math.PI
    sun.current.position.set(center[0] + Math.cos(a) * -40, 18 + Math.abs(Math.sin(a)) * 30, center[2] + 30)
    target.position.set(center[0], 0, center[2])
    sun.current.intensity = isDay ? s.sun : 0.45
    sun.current.color.copy(s.sunColor)
    hemi.current.intensity = s.hemi
  })
  return (
    <>
      <primitive object={target} />
      <hemisphereLight ref={hemi} args={['#fff1e0', '#c9a7a0', 1]} />
      <ambientLight intensity={0.25} color="#ffe9dc" />
      <directionalLight
        ref={sun}
        castShadow
        target={target}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
    </>
  )
}

// ---------------------------------------------------------------- the floating diorama island
function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function Island({ width }) {
  const lw = width * SLOT_W
  const minX = -ISLAND_PAD
  const maxX = lw + ISLAND_PAD
  const minZ = -9
  const maxZ = 13
  const W = maxX - minX
  const Dz = maxZ - minZ
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const roadZ = SIDEWALK_Z + 2.6

  const trees = useMemo(() => {
    const rnd = seeded(7 + width)
    const list = []
    const tryAdd = (x, z) => {
      // keep clear of the hotel, its driveway and the road
      if (x > -3.4 && x < lw + 0.8 && z > -DEPTH / 2 - 1.2 && z < SIDEWALK_Z + 4.2) return
      if (z > SIDEWALK_Z - 1 && z < roadZ + 2) return
      list.push({ x, z, s: 0.75 + rnd() * 0.6, kind: rnd() < 0.55 ? 'round' : 'pine', hue: Math.floor(rnd() * 3) })
    }
    for (let i = 0; i < 60; i++) tryAdd(minX + 1.2 + rnd() * (W - 2.4), minZ + 1.2 + rnd() * (Dz - 2.4))
    return list.slice(0, 26 + width * 2)
  }, [width, lw, minX, W, Dz, roadZ])

  const lamps = useMemo(() => {
    const list = []
    for (let x = minX + 3; x < maxX - 1; x += 7) list.push(x)
    return list
  }, [minX, maxX])

  return (
    <group>
      {/* grass top + soil layers */}
      <B args={[W, 0.5, Dz]} r={0.2} color="#a8d98a" position={[cx, -0.25, cz]} />
      <B args={[W - 0.2, 1.4, Dz - 0.2]} r={0.25} color="#c99a6e" position={[cx, -1.15, cz]} shadow={false} />
      <B args={[W - 0.8, 1.2, Dz - 0.8]} r={0.3} color="#a87a54" position={[cx, -2.2, cz]} shadow={false} />
      <B args={[W - 2.2, 1, Dz - 2.2]} r={0.35} color="#8c6446" position={[cx, -3.1, cz]} shadow={false} />

      {/* plaza in front of the hotel */}
      <B args={[lw + 3.2, 0.06, 2.8]} color="#efe3d0" position={[lw / 2 - 1.2, 0.03, DEPTH / 2 + 0.9]} shadow={false} />
      {/* sidewalk + road */}
      <B args={[W, 0.12, 1.6]} color="#e6ddd2" position={[cx, 0.06, SIDEWALK_Z]} shadow={false} />
      <B args={[W, 0.08, 3.2]} color="#6f6a7d" position={[cx, 0.04, roadZ]} shadow={false} />
      {Array.from({ length: Math.floor(W / 3) }).map((_, i) => (
        <B key={i} args={[1.2, 0.02, 0.14]} color="#f6efe3" position={[minX + 1.5 + i * 3, 0.09, roadZ]} shadow={false} />
      ))}
      <B args={[W, 0.14, 0.4]} color="#ded3c4" position={[cx, 0.07, roadZ + 1.8]} shadow={false} />

      {/* back garden path & pond */}
      <mesh position={[minX + 4.5, 0.02, minZ + 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.2, 32]} />
        <meshStandardMaterial color="#86cfe0" roughness={0.2} />
      </mesh>
      <mesh position={[minX + 4.5, 0.015, minZ + 4]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.55, 32]} />
        <meshStandardMaterial color="#d8cbb4" />
      </mesh>

      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      {lamps.map((x, i) => (
        <Lamp key={i} position={[x, 0, SIDEWALK_Z + 0.65]} />
      ))}
      <Bench position={[lw + 3.5, 0, SIDEWALK_Z - 0.9]} />
      <Bench position={[-6, 0, SIDEWALK_Z - 0.9]} />
      <Cars minX={minX} maxX={maxX} roadZ={roadZ} />
      <Clouds cx={cx} />
    </group>
  )
}

const LEAF = ['#7fc77a', '#9bd27c', '#6db88a']
function Tree({ x, z, s, kind, hue }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <Cyl args={[0.12, 0.16, 0.9, 6]} color="#9c6b4a" position={[0, 0.45, 0]} />
      {kind === 'round' ? (
        <>
          <mesh geometry={sphereGeo(0.75, 7)} material={mat(LEAF[hue], { flatShading: true })} position={[0, 1.45, 0]} castShadow receiveShadow />
          <mesh geometry={sphereGeo(0.5, 6)} material={mat(LEAF[(hue + 1) % 3], { flatShading: true })} position={[0.35, 1.9, 0.1]} castShadow />
        </>
      ) : (
        <>
          <mesh geometry={coneGeo(0.8, 1.3)} material={mat('#5fae7d', { flatShading: true })} position={[0, 1.4, 0]} castShadow receiveShadow />
          <mesh geometry={coneGeo(0.6, 1.1)} material={mat('#6fc08a', { flatShading: true })} position={[0, 2.05, 0]} castShadow />
        </>
      )}
    </group>
  )
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <Cyl args={[0.05, 0.07, 2.2, 8]} color="#4c4a5e" position={[0, 1.1, 0]} />
      <Ball r={0.16} m={glowMat('#ffe2a6', 0.1, 3)} position={[0, 2.3, 0]} shadow={false} />
      <Cyl args={[0.2, 0.12, 0.1, 8]} color="#4c4a5e" position={[0, 2.45, 0]} />
    </group>
  )
}

function Bench({ position }) {
  return (
    <group position={position}>
      <B args={[1.4, 0.08, 0.4]} r={0.03} color="#c98a5b" position={[0, 0.42, 0]} />
      <B args={[1.4, 0.35, 0.06]} r={0.03} color="#c98a5b" position={[0, 0.65, -0.2]} />
      <B args={[0.06, 0.42, 0.36]} color="#4c4a5e" position={[-0.6, 0.21, 0]} />
      <B args={[0.06, 0.42, 0.36]} color="#4c4a5e" position={[0.6, 0.21, 0]} />
    </group>
  )
}

const CAR_COLORS = ['#f28b82', '#7ab8e8', '#ffd36e', '#a6d9a0', '#c4a3e6']
function Cars({ minX, maxX, roadZ }) {
  const refs = useRef([])
  const cars = useMemo(
    () => CAR_COLORS.map((c, i) => ({ color: c, dir: i % 2 ? 1 : -1, offset: i * 9.3, speed: 2.4 + (i % 3) * 0.6 })),
    []
  )
  const span = maxX - minX
  useFrame((_, dt) => {
    const t = performance.now() / 1000
    cars.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      const p = ((t * c.speed * Math.max(0.6, game.speed || 0.0001) + c.offset) % span + span) % span
      const x = c.dir > 0 ? minX + p : maxX - p
      g.position.x = x
      const edge = Math.min(x - minX, maxX - x)
      g.scale.setScalar(Math.min(1, Math.max(0.001, edge / 1.5)))
    })
  })
  return cars.map((c, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} position={[0, 0.08, roadZ + (c.dir > 0 ? 0.75 : -0.75)]} rotation={[0, c.dir > 0 ? 0 : Math.PI, 0]}>
      <B args={[1.5, 0.45, 0.8]} r={0.15} color={c.color} position={[0, 0.38, 0]} />
      <B args={[0.85, 0.38, 0.72]} r={0.12} color="#eef6fb" position={[-0.1, 0.75, 0]} />
      {[-0.5, 0.5].map((wx) =>
        [-0.4, 0.4].map((wz) => (
          <Cyl key={`${wx}${wz}`} args={[0.16, 0.16, 0.12, 12]} color="#3a3845" position={[wx, 0.16, wz]} rotation={[Math.PI / 2, 0, 0]} />
        ))
      )}
      <Ball r={0.07} m={glowMat('#fff3c4', 0.2, 4)} position={[0.76, 0.42, 0.25]} shadow={false} />
      <Ball r={0.07} m={glowMat('#fff3c4', 0.2, 4)} position={[0.76, 0.42, -0.25]} shadow={false} />
    </group>
  ))
}

function Clouds({ cx }) {
  const group = useRef()
  const clouds = useMemo(() => {
    const rnd = seeded(42)
    return Array.from({ length: 6 }).map((_, i) => ({
      x: cx - 40 + i * 16 + rnd() * 6,
      y: 24 + rnd() * 8,
      z: -22 - rnd() * 14,
      s: 1.2 + rnd() * 1.4,
    }))
  }, [cx])
  useFrame((_, dt) => {
    if (!group.current) return
    group.current.children.forEach((c, i) => {
      c.position.x += dt * (0.4 + i * 0.05) * Math.max(0.5, game.speed)
      if (c.position.x > cx + 55) c.position.x = cx - 55
    })
  })
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh geometry={sphereGeo(1.2, 10)} material={mat('#ffffff', { flatShading: true, transparent: true, opacity: 0.92 })} />
          <mesh geometry={sphereGeo(0.9, 10)} material={mat('#ffffff', { flatShading: true, transparent: true, opacity: 0.92 })} position={[1.2, -0.2, 0.2]} />
          <mesh geometry={sphereGeo(0.8, 10)} material={mat('#ffffff', { flatShading: true, transparent: true, opacity: 0.92 })} position={[-1.1, -0.3, 0]} />
        </group>
      ))}
    </group>
  )
}
