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
    return [s.name, project(engine.game, { withOwner: s.owner })]
  }))
  const golden = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}
  // UPDATE_GOLDEN=1 rewrites every scenario; new scenarios are recorded on first run
  const missing = SCENARIOS.some((s) => !golden[s.name])
  if (process.env.UPDATE_GOLDEN || missing) {
    for (const s of SCENARIOS) if (process.env.UPDATE_GOLDEN || !golden[s.name]) golden[s.name] = results[s.name]
    writeFileSync(FILE, JSON.stringify(golden, null, 1))
  }

  for (const s of SCENARIOS) {
    it(`${s.name} replays exactly`, () => {
      expect(results[s.name]).toEqual(golden[s.name])
    })
  }
})
