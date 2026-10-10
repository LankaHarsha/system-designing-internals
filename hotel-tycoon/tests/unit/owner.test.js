import { describe, expect, it } from 'vitest'
import { ENERGY_COST, ENERGY_MAX, FIX_TIME, Game, OWNER_ID } from '../../src/sim'

const DAY = 1440
const until = (g, cond, maxMinutes = DAY) => {
  for (let m = 0; m < maxMinutes; m += 2) {
    if (cond()) return true
    g.simulateMinutes(2)
  }
  return cond()
}
const dirtyRoom = (g, key = '1-1') => {
  const r = g.rooms[key]
  r.status = 'dirty'
  r.guestId = null
  return r
}

describe('owner', () => {
  it('starts rested, idle, at home and outside the staff list', () => {
    const g = Game.create(1)
    expect(g.owner.energy).toBe(ENERGY_MAX)
    expect(g.owner.task).toBeNull()
    expect(g.agents.includes(g.owner)).toBe(false)
    expect(g.agentById(OWNER_ID)).toBe(g.owner)
  })

  it('walks to a dirty room, cleans it, and spends energy', () => {
    const g = Game.create(2)
    const room = dirtyRoom(g)
    expect(g.apply({ type: 'owner', task: 'clean', room: '1-1' })).toBe(true)
    expect(room.cleanBy).toBe(OWNER_ID)
    expect(until(g, () => room.status === 'cleaning')).toBe(true)
    expect(g.owner.energy).toBe(ENERGY_MAX - ENERGY_COST.clean)
    expect(until(g, () => room.status === 'vacant')).toBe(true)
    expect(room.cleanBy).toBeNull()
    expect(g.owner.task).toBeNull()
  })

  it('keeps housekeepers off a room the owner claimed', () => {
    const g = Game.create(3)
    g.money = 10000
    g.hire('housekeeper')
    const room = dirtyRoom(g)
    g.ownerTask('clean', '1-1')
    g.simulateMinutes(10)
    expect(room.cleanBy).toBe(OWNER_ID)
    expect(g.agents.filter((a) => a.kind === 'staff').every((h) => h.target !== '1-1')).toBe(true)
  })

  it('refuses rooms that are clean, taken by a housekeeper, or when too tired', () => {
    const g = Game.create(4)
    g.money = 10000
    g.hire('housekeeper')
    g.toasts.length = 0
    expect(g.ownerTask('clean', '1-0')).toBe(false) // vacant
    const room = dirtyRoom(g)
    room.cleanBy = g.agents[0].id
    expect(g.ownerTask('clean', '1-1')).toBe(false)
    room.cleanBy = null
    g.owner.energy = ENERGY_COST.clean - 1
    expect(g.ownerTask('clean', '1-1')).toBe(false)
    expect(g.toasts.length).toBe(3)
  })

  it('stopping mid-clean hands the room back to housekeeping', () => {
    const g = Game.create(5)
    const room = dirtyRoom(g)
    g.ownerTask('clean', '1-1')
    until(g, () => room.status === 'cleaning')
    g.ownerTask('stop')
    expect(room.status).toBe('dirty')
    expect(room.cleanBy).toBeNull()
  })

  it('works the desk: opens an extra desk, checks guests in, 3 energy each', () => {
    const g = Game.create(6)
    g.ownerTask('desk')
    expect(until(g, () => g.owner.atDesk)).toBe(true)
    g.simulateMinutes(1)
    expect(g.desks.length).toBe(g.staff.receptionist + 1)
    const before = g.totals.guests + g.today.missed
    g.simulateMinutes(6 * 60)
    const served = (ENERGY_MAX - g.owner.energy) / ENERGY_COST.checkIn
    expect(Number.isInteger(served)).toBe(true)
    expect(served).toBeGreaterThan(0)
    // every guest served costs energy, checked in or turned away ("No vacancy")
    expect(g.totals.guests + g.today.missed - before).toBeGreaterThanOrEqual(served)
  })

  it('leaves the desk when exhausted, and the extra desk closes', () => {
    const g = Game.create(7)
    g.ownerTask('desk')
    g.owner.energy = ENERGY_COST.checkIn // one more check-in
    expect(until(g, () => g.owner.task === null, 2 * DAY)).toBe(true)
    expect(g.owner.energy).toBe(0)
    g.simulateMinutes(2)
    expect(g.desks.length).toBe(g.staff.receptionist)
    expect(g.toasts.some((t) => /exhausted/.test(t.text))).toBe(true)
  })

  it('walks at reduced speed when tired, and refills overnight', () => {
    const g = Game.create(8)
    g.owner.energy = 10
    g.simulateMinutes(2)
    expect(g.owner.speedMul).toBe(0.6)
    g.simulateMinutes(DAY)
    expect(g.owner.energy).toBe(ENERGY_MAX)
    expect(g.owner.speedMul).toBe(1.2)
  })

  it('moves the desk post when a receptionist is hired', () => {
    const g = Game.create(9)
    g.money = 10000
    g.ownerTask('desk')
    until(g, () => g.owner.atDesk)
    const x0 = g.owner.pos.x
    g.hire('receptionist')
    g.simulateMinutes(2)
    expect(g.owner.atDesk).toBe(false)
    expect(until(g, () => g.owner.atDesk, 120)).toBe(true)
    expect(g.owner.pos.x).toBeGreaterThan(x0)
  })

  it('saves its energy and task, and continues identically after loading', () => {
    const g = Game.create(10)
    g.ownerTask('desk')
    g.simulateMinutes(3 * 60)
    const copy = Game.fromJSON(JSON.parse(JSON.stringify(g)))
    expect(copy.owner.energy).toBe(g.owner.energy)
    expect(copy.owner.task).toEqual(g.owner.task)
    g.simulateMinutes(DAY)
    copy.simulateMinutes(DAY)
    expect(copy.toJSON()).toEqual(JSON.parse(JSON.stringify(g)))
  })

  it('fixes a broken room: walks there, spends 10 energy, and the room can be sold', () => {
    const g = Game.create(11)
    const room = g.rooms['2-1']
    expect(room.status).toBe('broken')
    expect(g.apply({ type: 'owner', task: 'fix', room: '2-1' })).toBe(true)
    expect(until(g, () => g.owner.state === 'fixing')).toBe(true)
    expect(g.owner.pos.y).toBeCloseTo(6) // took the elevator up to floor 2 (lobby is floor 0)
    expect(g.owner.energy).toBe(ENERGY_MAX - ENERGY_COST.fix)
    expect(until(g, () => room.status === 'vacant', FIX_TIME + 10)).toBe(true)
    expect(g.owner.task).toBeNull()
  })

  it('refuses to fix a working room or when too tired', () => {
    const g = Game.create(12)
    expect(g.ownerTask('fix', '1-0')).toBe(false)
    g.owner.energy = ENERGY_COST.fix - 1
    expect(g.ownerTask('fix', '1-2')).toBe(false)
  })

  it('never sells a broken room', () => {
    const g = Game.create(13)
    g.ownerTask('desk')
    g.simulateMinutes(12 * 60)
    expect(g.rooms['1-2'].status).toBe('broken')
    expect(g.rooms['2-1'].status).toBe('broken')
    expect(g.agents.some((a) => a.room === '1-2' || a.room === '2-1')).toBe(false)
  })
})
