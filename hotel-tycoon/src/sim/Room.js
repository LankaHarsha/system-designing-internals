import { FLOOR_H, ROOM_TYPES, slotX } from '../game/constants'

// One built slot: a guest room or an amenity.
export class Room {
  constructor({ key, floor, slot, type, status = 'vacant', guestId = null, cleanBy = null, users = [], cleanT = 0, fixT = 0 }) {
    this.key = key
    this.floor = floor
    this.slot = slot
    this.type = type
    this.status = status // vacant | occupied | dirty | cleaning | broken
    this.guestId = guestId
    this.cleanBy = cleanBy // housekeeper id
    this.users = users // guest ids using an amenity
    this.cleanT = cleanT
    this.fixT = fixT // repair progress while broken
  }

  static keyOf(floor, slot) {
    return `${floor}-${slot}`
  }

  get def() {
    return ROOM_TYPES[this.type]
  }

  get isGuestRoom() {
    return this.def.kind === 'room'
  }

  get isAmenity() {
    return this.def.kind === 'amenity'
  }

  // can be sold to a guest right now
  get isVacant() {
    return this.isGuestRoom && this.status === 'vacant'
  }

  get hasSpace() {
    return this.users.length < this.def.capacity
  }

  get name() {
    return `${this.floor}${String(this.slot + 1).padStart(2, '0')}`
  }

  // a point in the middle of the room's floor
  get center() {
    return { x: slotX(this.slot), y: this.floor * FLOOR_H, z: 0 }
  }
}
