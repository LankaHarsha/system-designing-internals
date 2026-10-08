import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Shared geometry / material caches keep draw setup cheap as the hotel grows.
const geoCache = new Map()
const matCache = new Map()

export function boxGeo(w, h, d, r = 0) {
  const key = `${w}|${h}|${d}|${r}`
  let g = geoCache.get(key)
  if (!g) {
    g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d)
    geoCache.set(key, g)
  }
  return g
}

export function cylGeo(rt, rb, h, seg = 16) {
  const key = `cyl|${rt}|${rb}|${h}|${seg}`
  let g = geoCache.get(key)
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg)
    geoCache.set(key, g)
  }
  return g
}

export function sphereGeo(r, seg = 16) {
  const key = `sph|${r}|${seg}`
  let g = geoCache.get(key)
  if (!g) {
    g = new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75))
    geoCache.set(key, g)
  }
  return g
}

export function coneGeo(r, h, seg = 7) {
  const key = `cone|${r}|${h}|${seg}`
  let g = geoCache.get(key)
  if (!g) {
    g = new THREE.ConeGeometry(r, h, seg)
    geoCache.set(key, g)
  }
  return g
}

export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts })
    matCache.set(key, m)
  }
  return m
}

export function B({ args, r = 0, color = '#ffffff', position, rotation, scale, shadow = true, m, ...rest }) {
  return (
    <mesh
      geometry={boxGeo(args[0], args[1], args[2], r)}
      material={m || mat(color)}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={shadow}
      receiveShadow
      {...rest}
    />
  )
}

export function Cyl({ args, color = '#ffffff', position, rotation, shadow = true, m, ...rest }) {
  return (
    <mesh
      geometry={cylGeo(...args)}
      material={m || mat(color)}
      position={position}
      rotation={rotation}
      castShadow={shadow}
      receiveShadow
      {...rest}
    />
  )
}

export function Ball({ r, color = '#ffffff', position, scale, shadow = true, m, seg = 16, ...rest }) {
  return (
    <mesh
      geometry={sphereGeo(r, seg)}
      material={m || mat(color)}
      position={position}
      scale={scale}
      castShadow={shadow}
      receiveShadow
      {...rest}
    />
  )
}

// Shared environment state written by the sky every frame, read by emissive things.
export const env = { night: 0, hour: 12 }

// Emissive "glow" materials whose intensity follows the night factor.
export const glowMats = []
export function glowMat(color, dayIntensity = 0, nightIntensity = 2.5) {
  const key = `glow|${color}|${dayIntensity}|${nightIntensity}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: dayIntensity, roughness: 0.4, toneMapped: false })
    m.userData = { dayIntensity, nightIntensity }
    matCache.set(key, m)
    glowMats.push(m)
  }
  return m
}
export function updateGlowMats() {
  for (const m of glowMats) {
    const { dayIntensity, nightIntensity } = m.userData
    m.emissiveIntensity = dayIntensity + (nightIntensity - dayIntensity) * env.night
  }
}
