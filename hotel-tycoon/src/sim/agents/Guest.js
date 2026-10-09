import { DEPTH, FLOOR_H, GUEST_COLORS, QUEUE_MAX, slotX } from '../../game/constants'
import {
  CHECKIN_TIME, CURB_Z, DOOR_Z, HAIR_COLORS, MAX_TAXIS, SIDEWALK_Z, TAXI_ARRIVE, WALK_RANGE, clamp, demandMix,
  amenityPreference,
} from '../rules'
import { Agent } from './Agent'

// A guest's life: taxi/walk in → queue → desk → room ⇄ amenities → leave.
// Each state is a method named in STATES; step() dispatches on this.state.
export class Guest extends Agent {
  constructor(p) {
    super({ ...p, kind: 'guest' })
    this.tier = p.tier // 0 standard, 1 deluxe, 2 suite
    this.taxiT = p.taxiT ?? 0
    this.wait = p.wait ?? 0
    this.patience = p.patience
    this.sat = p.sat ?? 3.6 // satisfaction, 0.5–5
    this.queueIdx = p.queueIdx ?? -1
    this.desk = p.desk ?? null
    this.deskT = p.deskT ?? 0
    this.room = p.room ?? null
    this.paid = p.paid ?? 0
    this.stay = p.stay ?? 0
    this.nextAmenityRoll = p.nextAmenityRoll ?? 0
    this.idleT = p.idleT ?? 0
    this.amenity = p.amenity ?? null
    this.amenityT = p.amenityT ?? 0
  }

  // A new arrival. The order of random draws is part of the rules (replays depend on it).
  static spawn(game) {
    const rnd = game.random
    const b = game.building
    const [, pDeluxe, pSuite] = demandMix(game.rating)
    const roll = rnd.next()
    const tier = roll < pSuite ? 2 : roll < pSuite + pDeluxe ? 1 : 0
    // half the guests arrive by taxi, the rest stroll in along the sidewalk
    const byTaxi = rnd.next() < 0.5 && game.arrivals.taxis.length < MAX_TAXIS
    const pos = byTaxi
      ? { x: b.curbX, y: 0, z: CURB_Z - 0.5 }
      : { x: b.lobbyWidth + WALK_RANGE + rnd.range(0, 1), y: 0, z: SIDEWALK_Z + rnd.range(-0.4, 0.4) }
    const id = game.nextId++
    const color = rnd.pick(GUEST_COLORS)
    const hair = rnd.pick(HAIR_COLORS)
    const scale = rnd.range(0.9, 1.08)
    const path = byTaxi ? [] : [
      { x: b.entranceX, y: 0, z: SIDEWALK_Z },
      { x: b.entranceX, y: 0, z: DOOR_Z },
    ]
    const patience = rnd.range(90, 160)
    const speedMul = rnd.range(0.9, 1.15)
    const guest = new Guest({
      id, tier, color, hair, scale, pos, path, patience, speedMul,
      heading: -Math.PI / 2,
      state: byTaxi ? 'taxi' : 'arriving',
      hidden: byTaxi,
      mood: 'happy',
    })
    if (byTaxi) game.arrivals.taxis.push({ id: game.nextId++, guestId: id, start: game.absTime, x: b.curbX })
    game.population.add(guest)
    return guest
  }

  step(game, dt) {
    const handler = STATES[this.state]
    if (handler) this[handler](game, dt)
  }

  // ---------------------------------------------------------------- states
  inTaxi(game, dt) {
    this.taxiT += dt
    if (this.taxiT < TAXI_ARRIVE) return
    const b = game.building
    this.hidden = false
    this.state = 'arriving'
    this.path = [
      { x: b.curbX, y: 0, z: SIDEWALK_Z },
      { x: b.entranceX, y: 0, z: SIDEWALK_Z - 0.6 },
      { x: b.entranceX, y: 0, z: DOOR_Z },
    ]
  }

  arriving(game) {
    if (this.moving) return
    if (game.reception.queue.length >= QUEUE_MAX) {
      game.floater('Too crowded!', this.pos, '#d0574b')
      this.lose(game)
    } else {
      game.reception.queue.push(this.id)
      this.state = 'queue'
      this.queueIdx = -1
    }
  }

  queueing(game, dt) {
    this.wait += dt
    const idx = game.reception.queue.indexOf(this.id)
    if (idx !== this.queueIdx) {
      this.queueIdx = idx
      this.path = [game.building.queueSpot(idx)]
    }
    if (this.wait > this.patience * 0.6) this.mood = 'meh'
    if (this.wait > this.patience) {
      game.floater('Too slow!', this.pos, '#d0574b')
      this.lose(game)
    }
  }

  atDesk(game, dt) {
    this.wait += dt
    if (this.moving) return
    this.deskT = (this.deskT || 0) + dt
    this.heading = Math.PI
    if (this.deskT >= CHECKIN_TIME) {
      game.reception.desks[this.desk] = null
      this.checkIn(game)
    }
  }

  walkingToRoom() {
    if (!this.moving) this.state = 'inRoom'
  }

  inRoom(game, dt) {
    this.stay -= dt
    this.idleT = (this.idleT || 0) - dt
    if (this.stay <= 0) { this.finishStay(game); return }
    this.nextAmenityRoll -= dt
    if (this.nextAmenityRoll <= 0) {
      this.nextAmenityRoll = game.random.range(50, 100)
      if (this.visitAmenity(game)) return
    }
    if (this.idleT <= 0) {
      this.idleT = game.random.range(40, 120)
      const room = game.building.get(this.room)
      if (room) {
        const s = game.building.roomSpot(room, game.random)
        this.path = [{ x: s.x, y: s.y, z: s.z }]
      }
    }
  }

  walkingToAmenity(game, dt) {
    this.stay -= dt
    if (this.moving) return
    this.state = 'atAmenity'
    this.amenityT = game.random.range(50, 90)
    this.heading = Math.PI
  }

  atAmenity(game, dt) {
    this.stay -= dt
    this.amenityT -= dt
    if (this.amenityT > 0) return
    const am = game.building.get(this.amenity)
    if (am) {
      const def = am.def
      am.users = am.users.filter((id) => id !== this.id)
      game.ledger.earn(def.spend, 'amenities')
      this.sat += def.joy
      game.floater(`+$${def.spend}`, this.pos, '#3d9a5f')
    }
    this.amenity = null
    const room = game.building.get(this.room)
    if (this.stay <= 0 || !room) this.finishStay(game)
    else {
      this.state = 'toRoom'
      this.routeTo(game.building.roomSpot(room, game.random))
    }
  }

  leaving() {
    if (!this.moving) this.dead = true
  }

  // ---------------------------------------------------------------- transitions
  checkIn(game) {
    const b = game.building
    const tier = this.tier
    const vacant = b.all().filter((r) => r.isGuestRoom && r.status === 'vacant')
    if (!vacant.length) {
      game.ledger.today.missed++
      game.floater('No vacancy!', this.pos, '#d0574b')
      this.leave(game, 'novacancy')
      return
    }
    // prefer the exact tier, then the closest tier, then lower floors
    const fit = (r) => Math.abs(r.def.tier - tier) + (r.def.tier > tier ? 0.4 : 0)
    vacant.sort((r1, r2) => fit(r1) - fit(r2) || r1.floor - r2.floor)
    const room = vacant[0]
    const def = room.def
    const diff = def.tier - tier
    if (diff < 0) this.sat -= 0.55 * -diff
    if (diff > 0) this.sat -= 0.25 * diff
    if (diff === 0) this.sat += 0.35
    this.sat -= (game.priceMult - 1) * 1.6
    this.sat -= clamp((this.wait - 30) / 60, 0, 1.2)
    const price = Math.round(def.price * game.priceMult)
    game.ledger.earn(price, 'rooms')
    this.paid = price
    game.floater(`+$${price}`, this.pos)
    room.status = 'occupied'
    room.guestId = this.id
    this.room = room.key
    this.stay = game.random.range(240, 660)
    this.nextAmenityRoll = game.random.range(30, 90)
    this.state = 'toRoom'
    this.mood = 'happy'
    this.routeTo(b.roomSpot(room, game.random))
    game.ledger.today.guests++
    game.ledger.totals.guests++
  }

  // Maybe head to an amenity with space, weighted by what's popular at this hour.
  visitAmenity(game) {
    const hour = game.hour
    const options = game.building.all().filter((r) => r.isAmenity && r.hasSpace)
    if (!options.length) return false
    const weighted = options.map((r) => ({ r, w: amenityPreference(r.type, hour) }))
    const total = weighted.reduce((s, o) => s + o.w, 0)
    if (game.random.next() > 0.22 * Math.min(1.6, total / options.length)) return false
    let roll = game.random.next() * total
    let chosen = weighted[0].r
    for (const o of weighted) {
      roll -= o.w
      if (roll <= 0) { chosen = o.r; break }
    }
    chosen.users.push(this.id)
    this.amenity = chosen.key
    this.state = 'toAmenity'
    const idx = chosen.users.length - 1
    this.routeTo({
      x: slotX(chosen.slot) - 1.2 + (idx % 2) * 2.4 + game.random.range(-0.15, 0.15),
      y: chosen.floor * FLOOR_H,
      z: idx < 2 ? -0.3 : 0.7,
    })
    return true
  }

  finishStay(game) {
    const room = game.building.get(this.room)
    if (room) {
      room.status = 'dirty'
      room.guestId = null
    }
    this.room = null
    this.sat = clamp(this.sat, 0.5, 5)
    game.rating = clamp(game.rating + (this.sat - game.rating) * 0.08, 0.5, 5)
    if (this.sat >= 4.2) {
      const tip = Math.round(this.paid * 0.12)
      game.ledger.earn(tip, 'tips')
      game.floater(`Tip +$${tip}`, this.pos, '#c58b1b')
    }
    this.mood = this.sat >= 3.4 ? 'happy' : this.sat >= 2.4 ? 'meh' : 'angry'
    this.leave(game)
  }

  // Walked out unhappy (queue too long or too slow): costs rating.
  lose(game) {
    game.ledger.today.lost++
    game.ledger.totals.lost++
    game.rating = clamp(game.rating + (1.2 - game.rating) * 0.05, 0.5, 5)
    this.leave(game, 'angry')
  }

  leave(game, reason) {
    const b = game.building
    this.state = 'leaving'
    game.reception.remove(this.id)
    // back to the lobby first, then off along the sidewalk
    this.routeTo({ x: b.entranceX, y: 0, z: DEPTH / 2 - 0.3 })
    this.path.push({ x: b.entranceX, y: 0, z: SIDEWALK_Z + 0.4 }, { x: -WALK_RANGE, y: 0, z: SIDEWALK_Z + 0.4 })
    if (reason) this.mood = 'angry'
  }
}

// state name (saved, shown in the UI) -> method
const STATES = {
  taxi: 'inTaxi',
  arriving: 'arriving',
  queue: 'queueing',
  toDesk: 'atDesk',
  toRoom: 'walkingToRoom',
  inRoom: 'inRoom',
  toAmenity: 'walkingToAmenity',
  atAmenity: 'atAmenity',
  leaving: 'leaving',
}
