import { beforeEach, describe, expect, it } from 'vitest'
import * as engine from '../../src/game/engine'
import { QUEUE_MAX, ROOM_TYPES, STAFF_TYPES, START_MONEY, floorCost } from '../../src/game/constants'

// In-memory localStorage so save/load can run under Node.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const g = () => engine.game
const DAY = 1440

beforeEach(() => {
  store.clear()
  engine.newGame(12345)
})

describe('new game', () => {
  it('starts with the documented state', () => {
    expect(g().money).toBe(START_MONEY)
    expect(g().day).toBe(1)
    expect(Object.keys(g().rooms)).toEqual(['1-0', '1-1'])
    expect(g().staff).toEqual({ housekeeper: 1, receptionist: 1 })
    expect(g().agents.filter((a) => a.kind === 'staff')).toHaveLength(1)
  })
})

describe('determinism', () => {
  const play = (seed) => {
    engine.newGame(seed)
    engine.simulateMinutes(3 * DAY)
    const { money, rating, totals, day } = g()
    return { money, rating, totals: { ...totals }, day }
  }

  it('replays identically from the same seed', () => {
    expect(play(99)).toEqual(play(99))
  })

  it('differs for a different seed', () => {
    expect(play(99)).not.toEqual(play(100))
  })
})

describe('simulation invariants over 10 days', () => {
  it('keeps the world consistent every hour', () => {
    engine.buildRoom(1, 2, 'standard')
    for (let h = 0; h < 240; h++) {
      engine.simulateMinutes(60)
      const game = g()
      expect(Number.isFinite(game.money)).toBe(true)
      expect(game.rating).toBeGreaterThanOrEqual(0.5)
      expect(game.rating).toBeLessThanOrEqual(5)
      expect(game.queue.length).toBeLessThanOrEqual(QUEUE_MAX)
      expect(game.desks.length).toBe(game.staff.receptionist)
      const ids = new Set(game.agents.map((a) => a.id))
      for (const room of Object.values(game.rooms)) {
        if (room.status === 'occupied') expect(ids.has(room.guestId)).toBe(true)
        if (room.cleanBy != null) expect(ids.has(room.cleanBy)).toBe(true)
        expect(room.users.length).toBeLessThanOrEqual(ROOM_TYPES[room.type].capacity ?? 0)
      }
      for (const a of game.agents) {
        expect(Number.isFinite(a.pos.x + a.pos.y + a.pos.z)).toBe(true)
      }
    }
    expect(g().day).toBe(11)
    expect(g().totals.guests).toBeGreaterThan(0)
  })
})

describe('end of day', () => {
  it('charges wages and upkeep and records a summary', () => {
    engine.simulateMinutes(DAY - 9 * 60 - 1) // just before midnight
    const before = g().money
    const revenueSoFar = g().today.revenue
    engine.simulateMinutes(1)
    const s = g().lastSummary
    const wages = STAFF_TYPES.housekeeper.wage + STAFF_TYPES.receptionist.wage
    const upkeep = 2 * ROOM_TYPES.standard.upkeep
    expect(s.day).toBe(1)
    expect(s.wages).toBe(wages)
    expect(s.upkeep).toBe(upkeep)
    expect(s.profit).toBe(s.revenue - wages - upkeep)
    expect(s.revenue).toBeGreaterThanOrEqual(revenueSoFar)
    expect(g().money).toBe(before + (s.revenue - revenueSoFar) - wages - upkeep)
    expect(g().day).toBe(2)
  })
})

describe('player actions', () => {
  it('builds a room and charges for it', () => {
    expect(engine.buildRoom(1, 2, 'standard')).toBe(true)
    expect(g().money).toBe(START_MONEY - ROOM_TYPES.standard.cost)
    expect(g().rooms['1-2'].status).toBe('vacant')
  })

  it('refuses taken slots, bad slots and unaffordable rooms', () => {
    expect(engine.buildRoom(1, 0, 'standard')).toBe(false)
    expect(engine.buildRoom(2, 0, 'standard')).toBe(false) // floor not built
    expect(engine.buildRoom(1, 9, 'standard')).toBe(false)
    g().money = 10
    expect(engine.buildRoom(1, 2, 'suite')).toBe(false)
    expect(g().money).toBe(10)
  })

  it('refunds half the cost on demolish', () => {
    engine.buildRoom(1, 2, 'deluxe')
    const before = g().money
    expect(engine.demolish('1-2')).toBe(true)
    expect(g().money).toBe(before + ROOM_TYPES.deluxe.cost / 2)
    expect(g().rooms['1-2']).toBeUndefined()
  })

  it('upgrades a vacant room for the documented price', () => {
    g().goalsDone.deluxe = true // keep the goal reward out of the sum
    const cost = engine.upgradeCost('standard')
    expect(cost).toBe(ROOM_TYPES.deluxe.cost - ROOM_TYPES.standard.cost / 2)
    expect(engine.upgradeRoom('1-0')).toBe(true)
    expect(g().rooms['1-0'].type).toBe('deluxe')
    expect(g().money).toBe(START_MONEY - cost)
  })

  it('adds a floor at floorCost', () => {
    g().goalsDone.floor2 = true
    g().money = 100000
    expect(engine.addFloor()).toBe(true)
    expect(g().floors).toBe(2)
    expect(g().money).toBe(100000 - floorCost(2))
  })

  it('hires and fires within limits', () => {
    expect(engine.hire('housekeeper')).toBe(true)
    expect(g().staff.housekeeper).toBe(2)
    expect(g().agents.filter((a) => a.kind === 'staff')).toHaveLength(2)
    expect(engine.fire('receptionist')).toBe(false) // always keep one
    expect(engine.fire('housekeeper')).toBe(true)
    expect(g().agents.filter((a) => a.kind === 'staff')).toHaveLength(1)
  })
})

describe('goals', () => {
  it('pays a goal reward exactly once', () => {
    engine.buildRoom(1, 2, 'standard')
    g().money = 100000
    g().width = 4
    engine.buildRoom(1, 3, 'standard') // 4 rooms + widen goal
    const after = g().money
    engine.checkGoals()
    expect(g().goalsDone.rooms4).toBe(true)
    expect(g().money).toBe(after)
  })
})

describe('demand mix', () => {
  it('always sums to 1 with no negative shares', () => {
    for (let r = 0.5; r <= 5; r += 0.25) {
      const mix = engine.demandMix(r)
      expect(mix.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
      for (const p of mix) expect(p).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('save and load', () => {
  it('round-trips the game, including the random state', () => {
    engine.simulateMinutes(DAY)
    engine.save()
    const saved = new Map(store)
    engine.simulateMinutes(DAY) // passes midnight, which autosaves over our save
    const expected = { money: g().money, rating: g().rating, guests: g().totals.guests }
    store.clear()
    for (const [k, v] of saved) store.set(k, v)
    expect(engine.loadGame()).toBe(true)
    engine.simulateMinutes(DAY)
    expect({ money: g().money, rating: g().rating, guests: g().totals.guests }).toEqual(expected)
  })

  it('returns false when nothing is saved', () => {
    expect(engine.loadGame()).toBe(false)
  })
})
