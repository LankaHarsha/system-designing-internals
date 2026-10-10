// Scripted games used as a golden master: the same seed and the same player actions must
// produce exactly the recorded state. Re-recorded on 2026-10-10 for the Day 1 start (6-room
// inn, no staff); the scripts hire and expand so every system still gets exercised. Any intended change to game rules must update the
// fixture on purpose (UPDATE_GOLDEN=1 npm test), so accidental changes can't slip through.

export const SCENARIOS = [
  // nobody minds the inn: guests queue, give up and walk out
  { name: 'idle-3-days', seed: 99, script: (e) => { e.simulateMinutes(3 * 1440) } },
  {
    name: 'builder-10-days',
    seed: 12345,
    script: (e) => {
      e.game.money += 30000
      e.hire('receptionist')
      e.hire('housekeeper')
      e.ownerTask('fix', '1-2')
      e.simulateMinutes(1440)
      e.ownerTask('fix', '2-1')
      e.setPrice(1.2)
      e.upgradeRoom('1-0')
      e.simulateMinutes(1440)
      e.addFloor()
      e.buildRoom(3, 0, 'deluxe')
      e.buildRoom(3, 1, 'restaurant')
      e.simulateMinutes(3 * 1440)
      e.widen()
      e.hire('receptionist')
      e.hire('housekeeper')
      e.buildRoom(1, 3, 'suite')
      e.simulateMinutes(2 * 1440)
      e.fire('housekeeper')
      e.demolish('3-1')
      e.simulateMinutes(3 * 1440)
    },
  },
  {
    // the spec's Day 1: you alone, fixing, working the desk and cleaning
    name: 'owner-2-days',
    seed: 2024,
    owner: true,
    script: (e) => {
      const g = e.game
      g.ownerTask('fix', '1-2')
      e.simulateMinutes(150) // walk there (~1 h) and fix (40 min)
      g.ownerTask('desk')
      e.simulateMinutes(8 * 60)
      const dirty = Object.values(g.rooms).find((r) => r.status === 'dirty' && r.cleanBy == null)
      if (dirty) g.ownerTask('clean', dirty.key)
      e.simulateMinutes(5 * 60)
      g.ownerTask('desk')
      e.simulateMinutes(1440)
      g.ownerTask('stop')
      e.simulateMinutes(600)
    },
  },
]

const r6 = (v) => Math.round(v * 1e6) / 1e6

// Everything that matters about a game, in a stable shape independent of how it is stored.
// withOwner adds the owner (scenarios recorded before the owner existed leave it out).
export function project(g, { withOwner = false } = {}) {
  return {
    ...(withOwner && { owner: { energy: g.owner.energy, state: g.owner.state, task: g.owner.task, atDesk: g.owner.atDesk, x: r6(g.owner.pos.x), y: r6(g.owner.pos.y), z: r6(g.owner.pos.z) } }),
    day: g.day,
    minute: r6(g.minute),
    money: r6(g.money),
    rating: r6(g.rating),
    rngState: g.rngState,
    nextId: g.nextId,
    floors: g.floors,
    width: g.width,
    staff: { ...g.staff },
    totals: { ...g.totals },
    today: { ...g.today },
    history: g.history.map((h) => ({ ...h, rating: r6(h.rating) })),
    goalsDone: Object.keys(g.goalsDone).sort(),
    queue: [...g.queue],
    desks: [...g.desks],
    rooms: Object.values(g.rooms).map((r) => ({ key: r.key, type: r.type, status: r.status, guestId: r.guestId, cleanBy: r.cleanBy, users: [...r.users] })),
    agents: g.agents.map((a) => ({
      id: a.id, kind: a.kind, state: a.state, mood: a.mood, hidden: !!a.hidden,
      x: r6(a.pos.x), y: r6(a.pos.y), z: r6(a.pos.z), heading: r6(a.heading || 0), path: a.path.length,
    })),
  }
}
