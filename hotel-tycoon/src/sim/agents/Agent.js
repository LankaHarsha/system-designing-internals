import { CORRIDOR_Z, ELEV_SPEED, ELEV_X, FLOOR_H, WALK_SPEED } from '../../game/constants'

// Anyone who walks around the hotel. Subclasses add a role (`kind`) and a state machine in
// step(game, dt). Every field is set in the constructor so all agents share one object shape,
// which keeps the per-tick loops fast. Agents never hold a reference to the game: it is passed
// in, so an agent serialises as plain data.
export class Agent {
  constructor(p) {
    this.id = p.id
    this.kind = p.kind
    this.state = p.state
    this.pos = { x: p.pos.x, y: p.pos.y, z: p.pos.z }
    this.heading = p.heading ?? 0
    this.path = p.path ?? [] // waypoints, consumed from the front
    this.moving = p.moving ?? false
    this.inElevator = p.inElevator ?? false
    this.hidden = p.hidden ?? false
    this.speedMul = p.speedMul ?? 1
    this.scale = p.scale ?? 1
    this.mood = p.mood
    this.color = p.color
    this.hair = p.hair
    this.dead = false // removed from the population at the end of the tick
  }

  get floor() {
    return Math.round(this.pos.y / FLOOR_H)
  }

  // Path from the current position to target, through the corridor and elevator if needed.
  routeTo(target) {
    const p = this.pos
    const from = this.floor
    const to = Math.round(target.y / FLOOR_H)
    const path = []
    if (from === to) {
      if (Math.abs(p.x - target.x) > 0.6 || Math.abs(p.z - target.z) > 1.6) {
        path.push({ x: p.x, y: p.y, z: CORRIDOR_Z })
        path.push({ x: target.x, y: target.y, z: CORRIDOR_Z })
      }
    } else {
      path.push({ x: p.x, y: p.y, z: CORRIDOR_Z })
      path.push({ x: ELEV_X, y: p.y, z: CORRIDOR_Z })
      path.push({ x: ELEV_X, y: p.y, z: 0 })
      path.push({ x: ELEV_X, y: target.y, z: 0 })
      path.push({ x: ELEV_X, y: target.y, z: CORRIDOR_Z })
      path.push({ x: target.x, y: target.y, z: CORRIDOR_Z })
    }
    path.push({ ...target })
    this.path = path
  }

  // Walk (or ride the elevator) along the path for dt game minutes.
  move(dt) {
    let budget = dt
    const p = this.pos
    while (this.path.length && budget > 0) {
      const t = this.path[0]
      const dx = t.x - p.x
      const dy = t.y - p.y
      const dz = t.z - p.z
      const horiz = Math.hypot(dx, dz)
      const vertical = Math.abs(dy) > 0.01 && horiz < 0.01
      const dist = vertical ? Math.abs(dy) : Math.hypot(dx, dy, dz)
      const speed = (vertical ? ELEV_SPEED : WALK_SPEED) * (this.speedMul || 1)
      if (horiz > 0.001) this.heading = Math.atan2(dx, dz)
      this.inElevator = vertical
      if (dist <= speed * budget) {
        p.x = t.x; p.y = t.y; p.z = t.z
        budget -= dist / speed
        this.path.shift()
      } else {
        const k = (speed * budget) / dist
        p.x += dx * k; p.y += dy * k; p.z += dz * k
        budget = 0
      }
    }
    this.moving = this.path.length > 0
    if (!this.moving) this.inElevator = false
  }

  // eslint-disable-next-line no-unused-vars
  step(game, dt) {}
}
