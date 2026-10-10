import {
  DAILY_FIXED_COSTS, FLOOR_H, MAX_FLOORS, MAX_WIDTH, ROOM_TYPES, START_MONEY, START_RATING, STAFF_TYPES, floorCost, slotX,
  widenCost,
} from '../game/constants'
import { Random } from './Random'
import { Building } from './Building'
import { Population } from './Population'
import { Reception } from './Reception'
import { Arrivals } from './Arrivals'
import { Ledger } from './Ledger'
import { Goals } from './Goals'
import { Housekeeper, Owner, agentFromJSON } from './agents'
import { INN, OWNER_ID, UPGRADES, upgradeCost } from './rules'

export const SAVE_VERSION = 2
const TICK = 2 // game minutes per simulation tick

// One hotel simulation. Pure: no DOM, storage or wall clock inside. The host injects
//   now()          - timestamps for floaters/toasts (performance.now in the browser)
//   onCheckpoint() - called at moments worth saving (end of day, after building)
// Same seed + same commands = same game, which tests and replays rely on.
export class Game {
  constructor(state, { now = () => 0, onCheckpoint = () => {} } = {}) {
    this.now = now
    this.onCheckpoint = onCheckpoint

    this.seed = state.seed
    this.random = new Random(state.rngState)
    this.day = state.day
    this.minute = state.minute
    this.speed = state.speed
    this.rating = state.rating
    this.priceMult = state.priceMult
    this.nextId = state.nextId
    this.staff = state.staff // role -> head count

    this.building = new Building({ floors: state.floors, width: state.width, rooms: state.rooms, version: state.structureVersion })
    this.population = new Population(state.agents.map((a) => agentFromJSON(a)))
    this.reception = new Reception({ queue: state.queue, desks: state.desks })
    this.arrivals = new Arrivals({ spawnAcc: state.spawnAcc, taxis: state.taxis })
    this.ledger = new Ledger(state)
    this.goals = new Goals(state.goalsDone)
    // the player's avatar; kept out of the population so it never shifts agent ids
    this.owner = state.owner ? new Owner(state.owner) : Owner.create(this)

    // short-lived feedback for the view; never saved
    this.floaters = []
    this.toasts = []
  }

  // Day 1: you inherit a run-down inn with no staff (spec Act 1).
  static create(seed, options) {
    const game = new Game({
      seed, rngState: seed, money: START_MONEY, day: 1, minute: 9 * 60, speed: 1, rating: START_RATING,
      floors: INN.floors, width: INN.width, rooms: {}, agents: [], queue: [], desks: [], nextId: 1,
      staff: { housekeeper: 0, receptionist: 0 }, priceMult: 1, goalsDone: {}, structureVersion: 0,
      spawnAcc: 0, taxis: [],
    }, options)
    for (let floor = 1; floor <= INN.floors; floor++) {
      for (let slot = 0; slot < INN.width; slot++) game.building.place(floor, slot, INN.room)
    }
    for (const key of INN.broken) game.building.get(key).status = 'broken'
    return game
  }

  // Accepts every save format so far (v1 had no version field). `fallbackSeed` covers saves
  // from before seeded randomness.
  static fromJSON(data, { fallbackSeed = 1, ...options } = {}) {
    const state = { spawnAcc: 0, taxis: [], lastSummary: null, ...data }
    if (state.rngState == null) state.rngState = state.seed = fallbackSeed
    const game = new Game(state, options)
    game.syncStaff()
    return game
  }

  toJSON() {
    const { building: b, ledger: l } = this
    return {
      version: SAVE_VERSION,
      seed: this.seed, rngState: this.random.state, nextId: this.nextId,
      day: this.day, minute: this.minute, speed: this.speed, rating: this.rating, priceMult: this.priceMult,
      floors: b.floors, width: b.width, rooms: b.rooms, structureVersion: b.version,
      agents: this.population.list, staff: this.staff,
      queue: this.reception.queue, desks: this.reception.desks,
      spawnAcc: this.arrivals.spawnAcc, taxis: this.arrivals.taxis,
      money: l.money, today: l.today, totals: l.totals, history: l.history, lastSummary: l.lastSummary,
      goalsDone: this.goals.done,
      owner: this.owner,
    }
  }

  // ---------------------------------------------------------------- read-through accessors
  // Flat names the views and older code use.
  get rngState() { return this.random.state }
  get money() { return this.ledger.money }
  set money(v) { this.ledger.money = v }
  get today() { return this.ledger.today }
  get totals() { return this.ledger.totals }
  get history() { return this.ledger.history }
  get lastSummary() { return this.ledger.lastSummary }
  get rooms() { return this.building.rooms }
  get floors() { return this.building.floors }
  get width() { return this.building.width }
  set width(v) { this.building.width = v }
  get structureVersion() { return this.building.version }
  set structureVersion(v) { this.building.version = v }
  get agents() { return this.population.list }
  get queue() { return this.reception.queue }
  get desks() { return this.reception.desks }
  get taxis() { return this.arrivals.taxis }
  get goalsDone() { return this.goals.done }
  get absTime() { return this.day * 1440 + this.minute }
  get hour() { return Math.floor(this.minute / 60) }

  // any agent by id, the owner included
  agentById(id) {
    return id === OWNER_ID ? this.owner : this.population.get(id)
  }

  // ---------------------------------------------------------------- feedback
  floater(text, pos, color = '#3d9a5f') {
    this.floaters.push({ id: this.nextId++, text, x: pos.x, y: pos.y + 2.1, z: pos.z, color, born: this.now() })
    if (this.floaters.length > 40) this.floaters.shift()
  }

  toast(text, icon = '✨') {
    this.toasts.push({ id: this.nextId++, text, icon, born: this.now() })
    if (this.toasts.length > 5) this.toasts.shift()
  }

  // ---------------------------------------------------------------- simulation
  // Advance by game minutes in fixed 2-minute ticks.
  simulateMinutes(minutes) {
    let dt = minutes
    while (dt > 0) {
      const d = Math.min(dt, TICK)
      dt -= d
      this.tick(d)
    }
  }

  tick(dt) {
    const prevHour = this.hour
    this.minute += dt
    if (this.minute >= 1440) {
      this.minute -= 1440
      this.endOfDay()
    }
    const hour = this.hour
    if (hour !== prevHour) this.goals.check(this)

    this.arrivals.step(this, dt, hour)
    this.reception.step(this)
    this.owner.move(dt)
    this.owner.step(this, dt)
    for (const a of this.population.list) {
      a.move(dt)
      a.step(this, dt)
    }
    this.population.sweep()
  }

  endOfDay() {
    let wages = 0
    for (const k of Object.keys(this.staff)) wages += this.staff[k] * STAFF_TYPES[k].wage
    let upkeep = 0
    for (const r of this.building.all()) upkeep += r.def.upkeep
    upkeep += DAILY_FIXED_COSTS
    this.ledger.closeDay(this.day, this.rating, wages, upkeep)
    this.day++
    this.owner.rest()
    this.goals.check(this)
    this.onCheckpoint(this)
  }

  // One Housekeeper agent per hired housekeeper; extras (preferring idle ones) leave.
  syncStaff() {
    const hks = this.population.ofKind('staff')
    const want = this.staff.housekeeper
    for (let i = hks.length; i < want; i++) Housekeeper.hire(this, i)
    if (hks.length > want) {
      const sorted = [...hks].sort((a, b) => (a.state === 'idle' ? -1 : 1) - (b.state === 'idle' ? -1 : 1))
      for (const a of sorted.slice(0, hks.length - want)) {
        a.release(this)
        a.dead = true
      }
      this.population.sweep()
      this.population.ofKind('staff').forEach((a, i) => (a.home = i))
    }
  }

  // ---------------------------------------------------------------- commands
  // Every player action, as one entry point: game.apply({ type: 'buildRoom', floor, slot, room }).
  // Returns whether it happened. Keeps a single seam for replays, undo or server validation.
  apply(intent) {
    switch (intent.type) {
      case 'buildRoom': return this.buildRoom(intent.floor, intent.slot, intent.room)
      case 'demolish': return this.demolish(intent.key)
      case 'upgradeRoom': return this.upgradeRoom(intent.key)
      case 'addFloor': return this.addFloor()
      case 'widen': return this.widen()
      case 'hire': return this.hire(intent.role)
      case 'fire': return this.fire(intent.role)
      case 'setPrice': this.priceMult = intent.mult; return true
      case 'setSpeed': this.speed = intent.speed; return true
      case 'owner': return this.ownerTask(intent.task, intent.room)
      default: throw new Error(`Unknown intent: ${intent.type}`)
    }
  }

  // Charge `cost`, or toast and refuse.
  pay(cost) {
    if (!this.ledger.canAfford(cost)) { this.toast('Not enough money', '💸'); return false }
    this.ledger.money -= cost
    return true
  }

  buildRoom(floor, slot, type) {
    const def = ROOM_TYPES[type]
    if (!this.building.isFreeSlot(floor, slot)) return false
    if (!this.pay(def.cost)) return false
    this.building.place(floor, slot, type)
    this.floater(`-$${def.cost}`, { x: slotX(slot), y: floor * FLOOR_H, z: 0 }, '#d0574b')
    return this.committed()
  }

  demolish(key) {
    const room = this.building.get(key)
    if (!room) return false
    if (room.status === 'occupied' || room.users.length) { this.toast('Wait until the guests are gone', '🙅'); return false }
    if (room.cleanBy) this.agentById(room.cleanBy)?.abandonRoom()
    const refund = Math.round(room.def.cost * 0.5)
    this.ledger.money += refund
    this.floater(`+$${refund}`, room.center)
    this.building.remove(key)
    this.onCheckpoint(this)
    return true
  }

  upgradeRoom(key) {
    const room = this.building.get(key)
    if (!room) return false
    const next = UPGRADES[room.type]
    if (!next) return false
    if (room.status !== 'vacant' && room.status !== 'dirty') { this.toast('Wait until the guests check out', '🙅'); return false }
    if (room.cleanBy) { this.toast('Housekeeping is in there right now', '🧹'); return false }
    const cost = upgradeCost(room.type)
    if (!this.pay(cost)) return false
    room.type = next
    room.status = 'vacant'
    this.floater(`-$${cost}`, room.center, '#d0574b')
    this.toast(`Upgraded to ${ROOM_TYPES[next].name}`, ROOM_TYPES[next].icon)
    this.building.version++
    return this.committed()
  }

  addFloor() {
    const b = this.building
    if (b.floors >= MAX_FLOORS) return false
    if (!this.pay(floorCost(b.floors + 1))) return false
    b.floors++
    b.version++
    this.toast(`Floor ${b.floors} built!`, '🏗️')
    return this.committed()
  }

  widen() {
    const b = this.building
    if (b.width >= MAX_WIDTH) return false
    if (!this.pay(widenCost(b.width + 1, b.floors))) return false
    b.width++
    // queued guests re-target their spots since the desk moves
    for (const a of this.population.list) if (a.state === 'queue') a.queueIdx = -1
    b.version++
    this.toast('Hotel widened!', '📐')
    return this.committed()
  }

  hire(role) {
    const def = STAFF_TYPES[role]
    if (this.staff[role] >= def.max) return false
    if (!this.pay(def.hire)) return false
    this.staff[role]++
    this.syncStaff()
    this.building.version++
    this.onCheckpoint(this)
    return true
  }

  fire(role) {
    if (this.staff[role] <= 0) return false // the owner can always work the desk
    this.staff[role]--
    this.syncStaff()
    this.building.version++
    this.onCheckpoint(this)
    return true
  }

  // Send the owner: 'clean' or 'fix' (with a room key), 'desk', or 'stop'.
  ownerTask(task, room) {
    const o = this.owner
    if (task === 'clean') return o.clean(this, room)
    if (task === 'fix') return o.fix(this, room)
    if (task === 'desk') return o.workDesk(this)
    if (task === 'stop') return o.stop(this)
    throw new Error(`Unknown owner task: ${task}`)
  }

  // after a build: goals may now be met, and it's worth saving
  committed() {
    this.goals.check(this)
    this.onCheckpoint(this)
    return true
  }

  // ---------------------------------------------------------------- queries
  // Everything the HUD shows, as one plain object.
  snapshot() {
    const b = this.building
    const guestRooms = b.all().filter((r) => r.isGuestRoom)
    const occupied = guestRooms.filter((r) => r.status === 'occupied').length
    const dirty = guestRooms.filter((r) => r.status === 'dirty' || r.status === 'cleaning').length
    const broken = guestRooms.filter((r) => r.status === 'broken').length
    const journey = { arriving: 0, queue: 0, checkin: 0, staying: 0, leaving: 0 }
    let guests = 0
    for (const a of this.population.list) {
      if (a.kind !== 'guest') continue
      if (a.state === 'taxi' || a.state === 'arriving') journey.arriving++
      else if (a.state === 'queue') journey.queue++
      else if (a.state === 'toDesk') journey.checkin++
      else if (a.state === 'leaving') journey.leaving++
      else journey.staying++
      if (a.state !== 'leaving' && a.state !== 'taxi') guests++
    }
    return {
      journey,
      money: Math.floor(this.money),
      day: this.day,
      minute: this.minute,
      speed: this.speed,
      rating: this.rating,
      floors: b.floors,
      width: b.width,
      staff: { ...this.staff },
      priceMult: this.priceMult,
      totalRooms: guestRooms.length,
      occupied,
      dirty,
      broken,
      queue: this.reception.queue.length,
      guests,
      today: { ...this.today },
      totals: { ...this.totals },
      goalsDone: { ...this.goalsDone },
      structureVersion: b.version,
      lastSummary: this.lastSummary,
      owner: { energy: this.owner.energy, tired: this.owner.tired, state: this.owner.state, task: this.owner.task && { ...this.owner.task }, atDesk: this.owner.atDesk },
      floorCost: floorCost(b.floors + 1),
      widenCost: widenCost(b.width + 1, b.floors),
    }
  }
}
