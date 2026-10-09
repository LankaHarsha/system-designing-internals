import { FLOOR_H, SLOT_W, slotX } from '../game/constants'
import { Room } from './Room'

// The structure: floors, width, rooms, and every fixed spot in the lobby.
// `version` bumps on any structural change so views know to rebuild.
export class Building {
  constructor({ floors = 1, width = 3, rooms = {}, version = 0 } = {}) {
    this.floors = floors
    this.width = width
    this.rooms = {} // key -> Room, in build order (iteration order is part of the rules)
    for (const [key, r] of Object.entries(rooms)) this.rooms[key] = r instanceof Room ? r : new Room(r)
    this.version = version
  }

  // ---------------------------------------------------------------- rooms
  get(key) {
    return this.rooms[key]
  }

  all() {
    return Object.values(this.rooms)
  }

  place(floor, slot, type) {
    const key = Room.keyOf(floor, slot)
    const room = new Room({ key, floor, slot, type })
    this.rooms[key] = room
    this.version++
    return room
  }

  remove(key) {
    delete this.rooms[key]
    this.version++
  }

  isFreeSlot(floor, slot) {
    return !this.rooms[Room.keyOf(floor, slot)] && floor >= 1 && floor <= this.floors && slot >= 0 && slot < this.width
  }

  countGuestRooms() {
    let n = 0
    for (const r of this.all()) if (r.isGuestRoom) n++
    return n
  }

  hasType(type) {
    return this.all().some((r) => r.type === type)
  }

  // ---------------------------------------------------------------- lobby geometry
  get lobbyWidth() {
    return this.width * SLOT_W
  }

  get deskX() {
    return this.lobbyWidth / 2 + 0.6
  }

  get entranceX() {
    return this.lobbyWidth - 1.7
  }

  get curbX() {
    return this.entranceX + 1.6
  }

  // where a guest stands to be served at desk i
  serviceSpot(i) {
    return { x: this.deskX + (i - 1) * 1.25, y: 0, z: -0.2 }
  }

  receptionistSpot(i) {
    return { x: this.deskX + (i - 1) * 1.25, y: 0, z: -1.45 }
  }

  // the queue snakes back and forth in front of the desk
  queueSpot(i) {
    const startX = this.deskX + 2.1
    const maxX = this.lobbyWidth - 0.6
    const perRow = Math.max(2, Math.floor((maxX - startX) / 0.6) + 1)
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const x = row % 2 === 0 ? startX + col * 0.6 : startX + (perRow - 1 - col) * 0.6
    return { x, y: 0, z: 0.45 + row * 0.6 }
  }

  // where the owner waits between tasks: front-left of the lobby, by the lounge
  get ownerHome() {
    return { x: 0.9, y: 0, z: 0.9 }
  }

  housekeeperHome(i) {
    return { x: 0.6 + (i % 6) * 0.5, y: 0, z: -1.5 + Math.floor(i / 6) * 0.5 }
  }

  // a random spot inside a room
  roomSpot(room, random) {
    return { x: slotX(room.slot) + random.range(-1.1, 1.1), y: room.floor * FLOOR_H, z: random.range(-0.7, 0.6) }
  }
}
