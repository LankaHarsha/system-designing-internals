import { describe, expect, it } from 'vitest'
import { ENERGY_COST, ENERGY_MAX, Game, OWNER_ID } from '../../src/sim'

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
    g.staff.housekeeper = 0
    g.syncStaff()
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
    const room = dirtyRoom(g)
    g.ownerTask('clean', '1-1')
    g.simulateMinutes(10)
    expect(room.cleanBy).toBe(OWNER_ID)
    expect(g.agents.filter((a) => a.kind === 'staff').every((h) => h.target !== '1-1')).toBe(true)
  })

  it('refuses rooms that are clean, taken by a housekeeper, or when too tired', () => {
    const g = Game.create(4)
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
    g.staff.housekeeper = 0
    g.syncStaff()
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
    const before = g.totals.guests
    g.simulateMinutes(6 * 60)
    const served = (ENERGY_MAX - g.owner.energy) / ENERGY_COST.checkIn
    expect(Number.isInteger(served)).toBe(true)
    expect(served).toBeGreaterThan(0)
    expect(g.totals.guests - before).toBeGreaterThanOrEqual(served)
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
})
