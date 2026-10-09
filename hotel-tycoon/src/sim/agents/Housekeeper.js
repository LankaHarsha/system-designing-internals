import { FLOOR_H, STAFF_TYPES, slotX } from '../../game/constants'
import { CLEAN_TIME } from '../rules'
import { Agent } from './Agent'

// Cleans dirty rooms, nearest floor first, then walks back to the staff corner.
export class Housekeeper extends Agent {
  constructor(p) {
    super({ color: STAFF_TYPES.housekeeper.color, hair: '#3b2a20', speedMul: 1.15, mood: 'work', state: 'idle', ...p, kind: 'staff' })
    this.home = p.home ?? 0 // index of the waiting spot
    this.target = p.target ?? null // room key being cleaned
    this.atHome = p.atHome ?? false
  }

  static hire(game, home) {
    const spot = game.building.housekeeperHome(home)
    const hk = new Housekeeper({ id: game.nextId++, home, pos: { x: spot.x, y: 0, z: spot.z } })
    game.population.add(hk)
    return hk
  }

  step(game, dt) {
    switch (this.state) {
      case 'idle':
      case 'returning': return this.lookForWork(game)
      case 'toClean': return this.walkingToRoom(game)
      case 'cleaning': return this.cleaning(game, dt)
    }
  }

  lookForWork(game) {
    const dirty = game.building.all().filter((r) => r.status === 'dirty' && r.cleanBy == null)
    if (dirty.length) {
      const cur = this.floor
      dirty.sort((r1, r2) => Math.abs(r1.floor - cur) - Math.abs(r2.floor - cur) || Math.abs(slotX(r1.slot) - this.pos.x) - Math.abs(slotX(r2.slot) - this.pos.x))
      const room = dirty[0]
      room.cleanBy = this.id
      this.target = room.key
      this.state = 'toClean'
      this.routeTo({ x: slotX(room.slot) + 0.6, y: room.floor * FLOOR_H, z: 0.2 })
    } else if (this.state === 'idle' && !this.atHome) {
      this.state = 'returning'
      this.atHome = true
      this.routeTo(game.building.housekeeperHome(this.home))
    } else if (this.state === 'returning' && !this.moving) {
      this.state = 'idle'
    }
  }

  walkingToRoom(game) {
    const room = game.building.get(this.target)
    if (!room) return this.becomeIdle()
    if (!this.moving) {
      room.status = 'cleaning'
      room.cleanT = 0
      this.state = 'cleaning'
    }
  }

  cleaning(game, dt) {
    const room = game.building.get(this.target)
    if (!room) return this.becomeIdle()
    room.cleanT += dt
    this.heading += dt * 0.08
    if (room.cleanT >= CLEAN_TIME) {
      room.status = 'vacant'
      room.cleanBy = null
      room.cleanT = 0
      this.target = null
      this.becomeIdle()
    }
  }

  becomeIdle() {
    this.state = 'idle'
    this.atHome = false
  }

  // Let go of the room being cleaned (when fired, or the room is demolished).
  release(game) {
    const room = this.target && game.building.get(this.target)
    if (room && room.cleanBy === this.id) {
      room.cleanBy = null
      if (room.status === 'cleaning') room.status = 'dirty'
    }
  }
}
