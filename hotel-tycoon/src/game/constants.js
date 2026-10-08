// World dimensions (in scene units)
export const SLOT_W = 4 // width of one room slot
export const FLOOR_H = 3 // height of one floor
export const DEPTH = 4 // depth of the building
export const ELEV_W = 2.4 // width of the elevator shaft (left of the building)
export const SLAB = 0.22 // floor slab thickness
export const CORRIDOR_Z = DEPTH / 2 - 0.45
export const ELEV_X = -ELEV_W / 2

export const MAX_FLOORS = 10 // room floors above the lobby
export const MAX_WIDTH = 7
export const MIN_WIDTH = 3

export const MINUTES_PER_SECOND = 10 // game minutes per real second at 1x
export const WALK_SPEED = 0.21 // units per game minute
export const ELEV_SPEED = 0.55

export const QUEUE_MAX = 8
export const DESK_CAPACITY = 3

export const START_MONEY = 3000

export const ROOM_TYPES = {
  standard: {
    id: 'standard',
    kind: 'room',
    name: 'Cozy Room',
    tier: 0,
    cost: 600,
    price: 110,
    upkeep: 10,
    wall: '#f6d9c4',
    accent: '#e98a6b',
    floor: '#e9c9a3',
    desc: 'A snug single bed. Budget travellers love it.',
    icon: '🛏️',
  },
  deluxe: {
    id: 'deluxe',
    kind: 'room',
    name: 'Deluxe Room',
    tier: 1,
    cost: 1600,
    price: 240,
    upkeep: 22,
    wall: '#cfe6dc',
    accent: '#4f9d8a',
    floor: '#d9c3a5',
    desc: 'Double bed, sofa and a view. For picky guests.',
    icon: '🛋️',
  },
  suite: {
    id: 'suite',
    kind: 'room',
    name: 'Royal Suite',
    tier: 2,
    cost: 3800,
    price: 520,
    upkeep: 45,
    wall: '#e3d6f2',
    accent: '#8a6cc9',
    floor: '#c9a882',
    desc: 'King bed, bathtub, big TV. Draws VIPs to 4★+ hotels.',
    icon: '👑',
  },
  restaurant: {
    id: 'restaurant',
    kind: 'amenity',
    name: 'Restaurant',
    cost: 2500,
    spend: 28,
    capacity: 4,
    joy: 0.35,
    upkeep: 40,
    wall: '#fbe3b0',
    accent: '#e0a43c',
    floor: '#c98f63',
    desc: 'Guests grab a bite. Earns money, boosts mood.',
    icon: '🍝',
  },
  bar: {
    id: 'bar',
    kind: 'amenity',
    name: 'Cocktail Bar',
    cost: 3200,
    spend: 38,
    capacity: 4,
    joy: 0.4,
    upkeep: 50,
    wall: '#c9d7f2',
    accent: '#4a68b8',
    floor: '#6b5a7a',
    desc: 'Evening drinks. Busy after sunset.',
    icon: '🍸',
  },
  spa: {
    id: 'spa',
    kind: 'amenity',
    name: 'Spa & Pool',
    cost: 5200,
    spend: 65,
    capacity: 3,
    joy: 0.6,
    upkeep: 70,
    wall: '#cdeef0',
    accent: '#3fb0bd',
    floor: '#eaf3f3',
    desc: 'Pure relaxation. Big mood boost, big spend.',
    icon: '🧖',
  },
}

export const STAFF_TYPES = {
  housekeeper: { id: 'housekeeper', name: 'Housekeeper', hire: 300, wage: 80, max: 12, icon: '🧹', color: '#5b8def' },
  receptionist: { id: 'receptionist', name: 'Receptionist', hire: 400, wage: 100, max: DESK_CAPACITY, icon: '🛎️', color: '#e98a6b' },
}

export const GUEST_COLORS = [
  '#ff8a65', '#4f7cff', '#ffc94d', '#6fd39a', '#a78bfa', '#f472b6', '#60a5fa', '#8b95ad', '#2dd4bf', '#ffffff',
]

export const floorCost = (floors) => Math.round(1500 * Math.pow(1.55, floors - 1) / 50) * 50
export const widenCost = (width, floors) => Math.round((900 * (floors + 1) * Math.pow(1.35, width - MIN_WIDTH)) / 50) * 50

export const slotX = (slot) => slot * SLOT_W + SLOT_W / 2
export const floorY = (floor) => floor * FLOOR_H
