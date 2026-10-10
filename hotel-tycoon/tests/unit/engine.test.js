import { beforeEach, describe, expect, it } from 'vitest'
import * as engine from '../../src/game/engine'
import { DAILY_FIXED_COSTS, QUEUE_MAX, ROOM_TYPES, START_MONEY, START_RATING, floorCost, widenCost } from '../../src/game/constants'

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
  it('starts as the spec\'s Day 1: a 6-room inn, 2 rooms broken, $1,500, 2.5★, no staff', () => {
    expect(g().money).toBe(1500)
    expect(START_MONEY).toBe(1500)
    expect(g().rating).toBe(START_RATING)
    expect(g().day).toBe(1)
    expect(g().floors).toBe(2)
    expect(Object.keys(g().rooms)).toEqual(['1-0', '1-1', '1-2', '2-0', '2-1', '2-2'])
    expect(Object.values(g().rooms).every((r) => r.type === 'inn')).toBe(true)
    expect(Object.values(g().rooms).filter((r) => r.status === 'broken').map((r) => r.key)).toEqual(['1-2', '2-1'])
    expect(ROOM_TYPES.inn.price).toBe(40)
    expect(g().staff).toEqual({ housekeeper: 0, receptionist: 0 })
    expect(g().agents).toHaveLength(0)
    expect(engine.snapshot().broken).toBe(2)
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
    g().money = 100000
    engine.hire('receptionist')
    engine.hire('housekeeper')
    engine.widen()
    engine.buildRoom(1, 3, 'standard')
    for (let h = 0; h < 240; h++) {
      engine.simulateMinutes(60)
      const game = g()
      expect(Number.isFinite(game.money)).toBe(true)
      expect(game.rating).toBeGreaterThanOrEqual(0.5)
      expect(game.rating).toBeLessThanOrEqual(5)
      expect(game.queue.length).toBeLessThanOrEqual(QUEUE_MAX)
      expect(game.desks.length).toBe(game.staff.receptionist + (game.owner.atDesk ? 1 : 0))
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
  it('charges wages, upkeep and fixed costs and records a summary', () => {
    g().money = 10000
    engine.hire('housekeeper')
    engine.simulateMinutes(DAY - 9 * 60 - 1) // just before midnight
    const before = g().money
    const revenueSoFar = g().today.revenue
    engine.simulateMinutes(1)
    const s = g().lastSummary
    const wages = 30 // one housekeeper, per the spec's Day 1 sheet
    const upkeep = 6 * ROOM_TYPES.inn.upkeep + DAILY_FIXED_COSTS
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
    g().money = 100000
    g().goalsDone.widen = true
    engine.widen()
    const before = g().money
    expect(engine.buildRoom(1, 3, 'standard')).toBe(true)
    expect(g().money).toBe(before - ROOM_TYPES.standard.cost)
    expect(g().rooms['1-3'].status).toBe('vacant')
  })

  it('cannot afford to grow on Day 1', () => {
    expect(floorCost(3)).toBeGreaterThan(START_MONEY)
    expect(widenCost(4, 2)).toBeGreaterThan(START_MONEY)
    expect(engine.addFloor()).toBe(false)
    expect(engine.widen()).toBe(false)
  })

  it('refuses taken slots, bad slots and unaffordable rooms', () => {
    expect(engine.buildRoom(1, 0, 'standard')).toBe(false)
    expect(engine.buildRoom(3, 0, 'standard')).toBe(false) // floor not built
    expect(engine.buildRoom(1, 9, 'standard')).toBe(false)
    g().money = 100000
    engine.widen()
    g().money = 10
    expect(engine.buildRoom(1, 3, 'suite')).toBe(false)
    expect(g().money).toBe(10)
  })

  it('refunds half the cost on demolish', () => {
    const before = g().money
    expect(engine.demolish('1-0')).toBe(true)
    expect(g().money).toBe(before + ROOM_TYPES.inn.cost / 2)
    expect(g().rooms['1-0']).toBeUndefined()
  })

  it('upgrades an inn room to a Cozy Room for the documented price', () => {
    const cost = engine.upgradeCost('inn')
    expect(cost).toBe(ROOM_TYPES.standard.cost - ROOM_TYPES.inn.cost / 2)
    expect(engine.upgradeRoom('1-0')).toBe(true)
    expect(g().rooms['1-0'].type).toBe('standard')
    expect(g().money).toBe(START_MONEY - cost)
  })

  it('will not upgrade a broken room', () => {
    expect(engine.upgradeRoom('1-2')).toBe(false)
    expect(g().rooms['1-2'].type).toBe('inn')
  })

  it('adds a floor at floorCost', () => {
    g().goalsDone.floor3 = true
    g().money = 100000
    expect(engine.addFloor()).toBe(true)
    expect(g().floors).toBe(3)
    expect(g().money).toBe(100000 - floorCost(3))
  })

  it('hires at the spec\'s signing fees and fires within limits', () => {
    g().goalsDone.firstHire = true
    expect(engine.hire('housekeeper')).toBe(true)
    expect(g().money).toBe(START_MONEY - 150)
    expect(engine.hire('receptionist')).toBe(true)
    expect(g().money).toBe(START_MONEY - 150 - 200)
    expect(g().staff).toEqual({ housekeeper: 1, receptionist: 1 })
    expect(g().agents.filter((a) => a.kind === 'staff')).toHaveLength(1)
    expect(engine.fire('receptionist')).toBe(true) // the owner can run the desk alone
    expect(engine.fire('receptionist')).toBe(false)
    expect(engine.fire('housekeeper')).toBe(true)
    expect(g().agents.filter((a) => a.kind === 'staff')).toHaveLength(0)
  })
})

describe('goals', () => {
  it('starts with no goal already met', () => {
    engine.checkGoals()
    expect(g().goalsDone).toEqual({})
    expect(g().money).toBe(START_MONEY)
  })

  it('pays a goal reward exactly once', () => {
    for (const r of Object.values(g().rooms)) if (r.status === 'broken') r.status = 'vacant'
    engine.checkGoals()
    expect(g().goalsDone.fixAll).toBe(true)
    expect(g().money).toBe(START_MONEY + 200)
    engine.checkGoals()
    expect(g().money).toBe(START_MONEY + 200)
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
