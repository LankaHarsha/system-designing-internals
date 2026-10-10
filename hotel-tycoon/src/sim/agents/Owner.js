import { FLOOR_H, slotX } from '../../game/constants'
import { CLEAN_TIME, ENERGY_COST, ENERGY_MAX, FIX_TIME, OWNER_ID, TIRED_BELOW } from '../rules'
import { Agent } from './Agent'

// You: the visible avatar who walks the building and does chores by hand. Give it a task and
// it walks there (travel time is part of the pressure), spends energy and does the work.
// Tasks: { kind: 'clean' | 'fix', room } | { kind: 'desk' }. One at a time; a new one replaces the old.
export class Owner extends Agent {
  constructor(p) {
    super({ color: '#e2522f', hair: '#3b2a20', mood: 'work', state: 'idle', speedMul: 1.2, ...p, id: OWNER_ID, kind: 'owner' })
    this.energy = p.energy ?? ENERGY_MAX
    this.task = p.task ?? null
    this.atDesk = p.atDesk ?? false // serving at the owner's desk right now
  }

  static create(game) {
    return new Owner({ pos: game.building.ownerHome })
  }

  get tired() {
    return this.energy < TIRED_BELOW
  }

  spend(amount) {
    this.energy = Math.max(0, this.energy - amount)
  }

  rest() {
    this.energy = ENERGY_MAX
  }

  // ---------------------------------------------------------------- commands (true if accepted)
  clean(game, key) {
    if (this.task?.kind === 'clean' && this.task.room === key) return true
    const room = game.building.get(key)
    if (!room || !room.isGuestRoom) return false
    if (room.status !== 'dirty' && room.cleanBy !== OWNER_ID) { game.toast('That room doesn’t need cleaning', '✨'); return false }
    if (room.cleanBy != null && room.cleanBy !== OWNER_ID) { game.toast('A housekeeper is already on it', '🧹'); return false }
    if (this.energy < ENERGY_COST.clean) { game.toast('Too tired to clean. Rest until tomorrow', '😮‍💨'); return false }
    this.cancel(game)
    room.cleanBy = OWNER_ID
    this.task = { kind: 'clean', room: key }
    this.state = 'toClean'
    this.routeTo({ x: slotX(room.slot) - 0.6, y: room.floor * FLOOR_H, z: 0.2 })
    return true
  }

  fix(game, key) {
    if (this.task?.kind === 'fix' && this.task.room === key) return true
    const room = game.building.get(key)
    if (!room) return false
    if (room.status !== 'broken') { game.toast('Nothing to fix in there', '🔧'); return false }
    if (this.energy < ENERGY_COST.fix) { game.toast('Too tired to fix it. Rest until tomorrow', '😮‍💨'); return false }
    this.cancel(game)
    this.task = { kind: 'fix', room: key, started: false }
    this.state = 'toFix'
    this.routeTo({ x: slotX(room.slot) + 0.4, y: room.floor * FLOOR_H, z: -0.4 })
    return true
  }

  workDesk(game) {
    if (this.task?.kind === 'desk') return true
    if (this.energy < ENERGY_COST.checkIn) { game.toast('Too tired for the desk. Rest until tomorrow', '😮‍💨'); return false }
    this.cancel(game)
    this.task = { kind: 'desk' }
    this.state = 'toDesk'
    this.routeTo(this.deskSpot(game))
    return true
  }

  stop(game) {
    this.cancel(game)
    return true
  }

  // Drop the current task, handing a half-cleaned room back to housekeeping.
  cancel(game) {
    if (this.task?.kind === 'clean') {
      const room = game.building.get(this.task.room)
      if (room && room.cleanBy === OWNER_ID) {
        room.cleanBy = null
        if (room.status === 'cleaning') { room.status = 'dirty'; room.cleanT = 0 }
      }
    }
    this.task = null
    this.atDesk = false
    this.state = 'idle'
  }

  // a demolished or upgraded room takes the task with it
  abandonRoom() {
    this.task = null
    this.state = 'idle'
  }

  // the owner's post is the desk slot after the receptionists'
  deskSpot(game) {
    return game.building.receptionistSpot(game.staff.receptionist)
  }

  // A guest was checked in at the owner's desk.
  onCheckIn(game) {
    this.spend(ENERGY_COST.checkIn)
    if (this.energy < ENERGY_COST.checkIn) {
      game.toast('You’re exhausted. Leaving the desk to the staff', '😮‍💨')
      this.cancel(game)
    }
  }

  // ---------------------------------------------------------------- per tick
  step(game, dt) {
    this.speedMul = this.tired ? 0.6 : 1.2
    if (!this.task) return this.wander(game)
    if (this.task.kind === 'desk') return this.deskDuty(game)
    if (this.task.kind === 'clean') return this.cleaning(game, dt)
    if (this.task.kind === 'fix') return this.fixing(game, dt)
  }

  wander(game) {
    if (this.moving) return
    const home = game.building.ownerHome
    if (Math.hypot(this.pos.x - home.x, this.pos.y - home.y, this.pos.z - home.z) > 0.05) this.routeTo(home)
  }

  deskDuty(game) {
    const spot = this.deskSpot(game)
    const away = Math.hypot(this.pos.x - spot.x, this.pos.y - spot.y, this.pos.z - spot.z) > 0.05
    if (away) {
      // the post moves when receptionists are hired or fired
      this.atDesk = false
      if (!this.moving) this.routeTo(spot)
      return
    }
    if (!this.moving) {
      this.atDesk = true
      this.state = 'atDesk'
      this.heading = 0 // face the guests
    }
  }

  fixing(game, dt) {
    const room = game.building.get(this.task.room)
    if (!room || room.status !== 'broken') return this.abandonRoom()
    if (this.moving) return
    if (!this.task.started) {
      this.spend(ENERGY_COST.fix)
      this.task.started = true
      room.fixT = 0
      this.state = 'fixing'
    }
    room.fixT += dt * (this.tired ? 0.6 : 1)
    if (room.fixT >= FIX_TIME) {
      room.status = 'vacant'
      room.fixT = 0
      game.floater('Fixed!', room.center, '#3d9a5f')
      this.task = null
      this.state = 'idle'
    }
  }

  cleaning(game, dt) {
    const room = game.building.get(this.task.room)
    if (!room || room.cleanBy !== OWNER_ID) return this.abandonRoom()
    if (this.moving) return
    if (room.status === 'dirty') {
      this.spend(ENERGY_COST.clean)
      room.status = 'cleaning'
      room.cleanT = 0
      this.state = 'cleaning'
    }
    room.cleanT += dt * (this.tired ? 0.6 : 1)
    this.heading += dt * 0.08
    if (room.cleanT >= CLEAN_TIME) {
      room.status = 'vacant'
      room.cleanBy = null
      room.cleanT = 0
      game.floater('Sparkling!', room.center, '#3d9a5f')
      this.task = null
      this.state = 'idle'
    }
  }
}
