import { describe, expect, it } from 'vitest'
import { FIRST_HIRE, Game, Housekeeper } from '../../src/sim'

const DAY = 1440
// from 09:00 on Day 1 to dawn on Day 3, plus a little to walk up to the door
const toDawnOfDay3 = (g) => g.simulateMinutes(2 * DAY - 3 * 60 + 2)
const until = (g, cond, max = DAY) => {
  for (let m = 0; m < max && !cond(); m += 2) g.simulateMinutes(2)
  return cond()
}
const waiting = (g) => g.snapshot().candidate?.state === 'knocking'

describe('the first hire', () => {
  it('nobody knocks before dawn on Day 3', () => {
    const g = Game.create(1)
    g.simulateMinutes(2 * DAY - 3 * 60 - 10) // 05:50 on Day 3
    expect(g.day).toBe(3)
    expect(g.snapshot().candidate).toBeNull()
  })

  it('a candidate knocks at dawn on Day 3 when you still have no staff', () => {
    const g = Game.create(2)
    toDawnOfDay3(g)
    const c = g.snapshot().candidate
    expect(c).not.toBeNull()
    expect(g.hour).toBe(FIRST_HIRE.hour)
    expect(until(g, () => waiting(g), 120)).toBe(true)
    expect(g.toasts.some((t) => /knocking/.test(t.text))).toBe(true)
  })

  it('offers to take the chore you spent the most energy on', () => {
    const a = Game.create(3)
    a.owner.chores.clean = 5
    toDawnOfDay3(a)
    expect(a.snapshot().candidate.role).toBe('housekeeper')
    const b = Game.create(3)
    b.owner.chores.checkIn = 20
    toDawnOfDay3(b)
    expect(b.snapshot().candidate.role).toBe('receptionist')
  })

  it('hiring charges the fee, walks them to their post and the same person becomes your housekeeper', () => {
    const g = Game.create(4)
    toDawnOfDay3(g)
    until(g, () => waiting(g), 120)
    const { id, fee } = g.snapshot().candidate
    const money = g.money
    expect(g.apply({ type: 'candidate', hire: true })).toBe(true)
    expect(g.money).toBe(money - fee)
    expect(g.staff.housekeeper).toBe(0) // not until they reach their post
    expect(until(g, () => g.staff.housekeeper === 1, 120)).toBe(true)
    const hk = g.agentById(id)
    expect(hk).toBeInstanceOf(Housekeeper)
    expect(g.agents.filter((a) => a.kind === 'staff')).toHaveLength(1)
    expect(g.goalsDone.firstHire).toBe(true)
    expect(g.snapshot().candidate).toBeNull()
    expect(g.recruitment.done).toBe(true)
  })

  it('a hired receptionist opens a desk', () => {
    const g = Game.create(5)
    g.owner.chores.checkIn = 30
    toDawnOfDay3(g)
    until(g, () => waiting(g), 120)
    g.apply({ type: 'candidate', hire: true })
    expect(until(g, () => g.staff.receptionist === 1, 120)).toBe(true)
    expect(g.agents.some((a) => a.kind === 'candidate')).toBe(false)
    g.simulateMinutes(2)
    expect(g.desks.length).toBe(1)
  })

  it('"not now" sends them away for good', () => {
    const g = Game.create(6)
    toDawnOfDay3(g)
    until(g, () => waiting(g), 120)
    expect(g.apply({ type: 'candidate', hire: false })).toBe(true)
    expect(g.snapshot().candidate).toBeNull()
    g.simulateMinutes(3 * DAY)
    expect(g.agents.some((a) => a.kind === 'candidate')).toBe(false)
    expect(g.staff).toEqual({ housekeeper: 0, receptionist: 0 })
  })

  it('gives up after waiting three hours', () => {
    const g = Game.create(7)
    toDawnOfDay3(g)
    g.simulateMinutes(FIRST_HIRE.waitMinutes + 10)
    expect(g.snapshot().candidate).toBeNull()
    expect(g.toasts.some((t) => /gave up/.test(t.text))).toBe(true)
  })

  it('stays at the door if you cannot afford the fee', () => {
    const g = Game.create(8)
    toDawnOfDay3(g)
    until(g, () => waiting(g), 120)
    g.money = 10
    expect(g.apply({ type: 'candidate', hire: true })).toBe(false)
    expect(g.snapshot().candidate.state).toBe('knocking')
  })

  it('nobody knocks if you hired before Day 3', () => {
    const g = Game.create(9)
    g.hire('housekeeper')
    g.simulateMinutes(3 * DAY)
    expect(g.agents.some((a) => a.kind === 'candidate')).toBe(false)
  })

  it('a save made while they knock loads and continues identically', () => {
    const g = Game.create(10)
    toDawnOfDay3(g)
    until(g, () => waiting(g), 120)
    const copy = Game.fromJSON(JSON.parse(JSON.stringify(g)))
    expect(copy.snapshot().candidate).toEqual(g.snapshot().candidate)
    g.apply({ type: 'candidate', hire: true })
    copy.apply({ type: 'candidate', hire: true })
    g.simulateMinutes(DAY)
    copy.simulateMinutes(DAY)
    expect(copy.toJSON()).toEqual(JSON.parse(JSON.stringify(g)))
  })
})
