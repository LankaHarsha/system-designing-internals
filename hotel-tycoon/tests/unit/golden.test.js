import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as engine from '../../src/game/engine'
import { SCENARIOS, project } from './golden.scenario'

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const FILE = join(import.meta.dirname, 'fixtures/golden.json')

describe('golden master', () => {
  const results = Object.fromEntries(SCENARIOS.map((s) => {
    engine.newGame(s.seed)
    s.script(engine)
    return [s.name, project(engine.game)]
  }))
  if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) writeFileSync(FILE, JSON.stringify(results, null, 1))
  const golden = JSON.parse(readFileSync(FILE, 'utf8'))

  for (const s of SCENARIOS) {
    it(`${s.name} replays exactly`, () => {
      expect(results[s.name]).toEqual(golden[s.name])
    })
  }
})
