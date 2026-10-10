import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Game, Guest, Housekeeper, Random, SAVE_VERSION } from '../../src/sim'
import { project } from './golden.scenario'

const DAY = 1440
const fixture = (name) => JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8'))
const roundTrip = (g) => Game.fromJSON(JSON.parse(JSON.stringify(g)))

describe('purity', () => {
  it('src/sim uses no browser APIs, wall clock or unseeded randomness', () => {
    const dir = join(import.meta.dirname, '../../src/sim')
    const files = readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js'))
    expect(files.length).toBeGreaterThan(5)
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8').replace(/\/\/.*$/gm, '')
      expect(src, f).not.toMatch(/\b(window|document|localStorage|sessionStorage|performance|Date|Math\.random|setTimeout|fetch)\b/)
    }
  })
})

describe('saves', () => {
  // The v1 fixture was written by the pre-OOP engine. Rules have changed on purpose since
  // (Day 1 wages and fixed costs), so check that everything carries over exactly on load and
  // that the hotel keeps running consistently afterwards.
  it('loads a real v1 save (written by the old engine) with every field carried over', () => {
    const { save } = fixture('save-v1.json')
    expect(save.version).toBeUndefined()
    const game = Game.fromJSON(save)
    expect(game.money).toBe(save.money)
    expect(game.rating).toBe(save.rating)
    expect(game.rngState).toBe(save.rngState)
    expect(game.staff).toEqual(save.staff)
    expect(Object.keys(game.rooms)).toEqual(Object.keys(save.rooms))
    expect(Object.values(game.rooms).map((r) => r.status)).toEqual(Object.values(save.rooms).map((r) => r.status))
    expect(game.agents.map((a) => [a.id, a.kind, a.state, a.pos])).toEqual(save.agents.map((a) => [a.id, a.kind, a.state, a.pos]))
    expect(game.queue).toEqual(save.queue)
    expect(game.owner.energy).toBe(100) // v1 had no owner: one arrives, rested
    game.simulateMinutes(2 * DAY)
    expect(game.day).toBe(save.day + 2)
    expect(Number.isFinite(game.money)).toBe(true)
    expect(game.desks.length).toBe(game.staff.receptionist)
  })

  it('round-trips mid-game: the copy and the original stay identical', () => {
    const a = Game.create(4242)
    a.money = 10000
    a.hire('receptionist')
    a.hire('housekeeper')
    a.simulateMinutes(DAY + 700)
    const b = roundTrip(a)
    expect(b.toJSON().version).toBe(SAVE_VERSION)
    expect(b.agents.every((x) => x instanceof (x.kind === 'guest' ? Guest : Housekeeper))).toBe(true)
    a.simulateMinutes(2 * DAY)
    b.simulateMinutes(2 * DAY)
    expect(project(b)).toEqual(project(a))
  })

  it('never writes view-only feedback into the save', () => {
    const g = Game.create(1)
    g.toast('hi')
    expect(JSON.stringify(g)).not.toMatch(/toasts|floaters/)
  })
})

describe('commands', () => {
  it('apply(intent) does the same as calling the command', () => {
    const a = Game.create(9)
    const b = Game.create(9)
    a.money = b.money = 100000
    a.widen()
    a.buildRoom(1, 3, 'deluxe')
    a.hire('housekeeper')
    a.priceMult = 1.3
    expect(b.apply({ type: 'widen' })).toBe(true)
    expect(b.apply({ type: 'buildRoom', floor: 1, slot: 3, room: 'deluxe' })).toBe(true)
    expect(b.apply({ type: 'hire', role: 'housekeeper' })).toBe(true)
    expect(b.apply({ type: 'setPrice', mult: 1.3 })).toBe(true)
    a.simulateMinutes(DAY)
    b.simulateMinutes(DAY)
    expect(project(b)).toEqual(project(a))
  })

  it('rejects unknown intents loudly', () => {
    expect(() => Game.create(1).apply({ type: 'teleport' })).toThrow(/Unknown intent/)
  })

  it('reports moments worth saving through onCheckpoint', () => {
    let saves = 0
    const g = Game.create(5, { onCheckpoint: () => saves++ })
    g.upgradeRoom('1-0')
    expect(saves).toBe(1)
    g.simulateMinutes(DAY) // passes midnight
    expect(saves).toBe(2)
  })
})

describe('Random', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = new Random(7)
    const b = new Random(7)
    for (let i = 0; i < 1000; i++) {
      const v = a.next()
      expect(v).toBe(b.next())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(new Random(8).next()).not.toBe(new Random(7).next())
  })
})
