import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../..')
const pub = join(root, 'public/assets')

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

  it('the character manifest is valid and its model files exist', () => {
    const { packs } = JSON.parse(readFileSync(join(pub, 'characters/manifest.json'), 'utf8'))
    expect(packs.length).toBeGreaterThan(0)
    for (const p of packs) {
      for (const key of ['id', 'name', 'stack', 'license', 'source', 'dir']) expect(p[key], `${p.id}.${key}`).toBeTruthy()
      expect(p.clips.idle && p.clips.walk).toBeTruthy()
      for (const m of p.models) expect(existsSync(join(pub, 'characters', p.dir, m)), `${p.id}: ${m}`).toBe(true)
    }
  })
})
