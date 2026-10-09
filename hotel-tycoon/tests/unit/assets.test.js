import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { CLIPS, MODELS, OUTFITS, modelUrl, outfitFor } from '../../src/scene/characters.js'

const root = join(import.meta.dirname, '../..')
const pub = join(root, 'public/assets')

// GLB = 12-byte header, then a JSON chunk (length, type, data)
const readGlbJson = (file) => {
  const b = readFileSync(file)
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'))
}

describe('asset files', () => {
  it('every KayKit prop used in src/ exists with its .bin and texture', () => {
    const sources = readdirSync(join(root, 'src'), { recursive: true })
      .filter((f) => f.endsWith('.jsx'))
      .map((f) => readFileSync(join(root, 'src', f), 'utf8'))
      .join('\n')
    const names = [...new Set([...sources.matchAll(/<Prop name="([^"]+)"/g)].map((m) => m[1]))]
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const gltf = join(pub, 'kaykit', `${name}.gltf`)
      expect(existsSync(gltf), `${name}.gltf`).toBe(true)
      const doc = JSON.parse(readFileSync(gltf, 'utf8'))
      const dir = join(gltf, '..')
      for (const b of doc.buffers) expect(existsSync(join(dir, b.uri)), `${name}: ${b.uri}`).toBe(true)
      for (const img of doc.images ?? []) expect(existsSync(join(dir, img.uri)), `${name}: ${img.uri}`).toBe(true)
    }
  })

  it('every outfit in characters.js exists with all the clips the game plays', () => {
    expect(MODELS.length).toBeGreaterThan(0)
    for (const list of Object.values(OUTFITS)) expect(list.length).toBeGreaterThan(0)
    for (const m of MODELS) {
      const file = join(root, 'public', modelUrl(m))
      expect(existsSync(file), m).toBe(true)
      const doc = readGlbJson(file)
      for (const img of doc.images ?? []) if (img.uri) expect(existsSync(join(file, '..', img.uri)), `${m}: ${img.uri}`).toBe(true)
      const clips = (doc.animations ?? []).map((a) => a.name)
      for (const c of Object.values(CLIPS)) expect(clips, `${m}: clip ${c}`).toContain(c)
      // one skinned primitive = one draw call per person; crowds depend on it
      expect(doc.meshes.flatMap((x) => x.primitives).length, `${m}: primitives`).toBe(1)
    }
  })

  it('outfitFor is stable and picks from the right list', () => {
    expect(OUTFITS.housekeeper).toContain(outfitFor({ id: 7, kind: 'staff' }))
    expect(OUTFITS.vip).toContain(outfitFor({ id: 7, kind: 'guest', tier: 2 }))
    expect(OUTFITS.guest).toContain(outfitFor({ id: 7, kind: 'guest', tier: 0 }))
    expect(outfitFor({ id: 12, kind: 'guest', tier: 1 })).toBe(outfitFor({ id: 12, kind: 'guest', tier: 1 }))
  })
})
