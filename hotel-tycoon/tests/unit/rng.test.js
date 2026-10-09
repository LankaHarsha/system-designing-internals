import { describe, expect, it } from 'vitest'
import { nextRandom } from '../../src/game/rng'

describe('seeded random numbers', () => {
  it('gives the same sequence for the same seed', () => {
    const run = (seed) => {
      let state = seed
      return Array.from({ length: 5 }, () => {
        const r = nextRandom(state)
        state = r.state
        return r.value
      })
    }
    expect(run(42)).toEqual(run(42))
    expect(run(42)).not.toEqual(run(43))
  })

  it('stays in [0, 1)', () => {
    let state = 7
    for (let i = 0; i < 10000; i++) {
      const r = nextRandom(state)
      state = r.state
      expect(r.value).toBeGreaterThanOrEqual(0)
      expect(r.value).toBeLessThan(1)
    }
  })
})
