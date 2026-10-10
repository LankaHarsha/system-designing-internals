// Simulation rules and world layout that only the simulation needs. Shared data (room and
// staff types, prices, world sizes) stays in game/constants.js.
import { DEPTH, ROOM_TYPES } from '../game/constants'

export const CHECKIN_TIME = 10 // game minutes per guest at the desk
export const CLEAN_TIME = 35
export const FIX_TIME = 40 // game minutes to repair a broken room
export const TAXI_ARRIVE = 10 // game minutes for a taxi to reach the curb
export const MAX_GUESTS = 90

// The owner (the player's avatar). Energy refills at midnight.
export const OWNER_ID = 'owner' // never collides with numeric agent ids
export const ENERGY_MAX = 100
export const TIRED_BELOW = 20 // walk at half speed, clean at 60% pace
export const ENERGY_COST = { checkIn: 3, clean: 8, fix: 10 }
export const MAX_TAXIS = 4

export const SIDEWALK_Z = DEPTH / 2 + 3.4
export const CURB_Z = SIDEWALK_Z + 1.25 // where taxis drop guests off
export const TAXI_LANE_Z = SIDEWALK_Z + 2.0
export const WALK_RANGE = 26 // guests on foot appear/disappear this far from the hotel
export const DOOR_Z = DEPTH / 2 - 0.3 // just inside the entrance

// Day 1 (spec Act 1): a run-down 6-room inn over two floors, two rooms broken until fixed.
export const INN = { floors: 2, width: 3, room: 'inn', broken: ['1-2', '2-1'] }

export const HAIR_COLORS = ['#3b2a20', '#6b4a2f', '#d9a441', '#1f1f28', '#a4553a', '#e8e1d6']

// Arrival intensity by hour of day
export const HOUR_CURVE = [
  0.15, 0.1, 0.08, 0.08, 0.1, 0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9,
  1.0, 1.1, 1.2, 1.25, 1.3, 1.3, 1.25, 1.15, 0.95, 0.7, 0.45, 0.25,
]

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// Share of arriving guests wanting [standard, deluxe, suite] at a given rating.
export function demandMix(r) {
  const pSuite = clamp((r - 3.4) * 0.3, 0, 0.35)
  const pDeluxe = clamp(0.12 + (r - 2) * 0.16, 0.08, 0.45)
  return [1 - pSuite - pDeluxe, pDeluxe, pSuite]
}

// How much guests want an amenity at a given hour.
export function amenityPreference(type, hour) {
  if (type === 'restaurant') return (hour >= 7 && hour <= 9) || (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21) ? 1.6 : 0.5
  if (type === 'bar') return hour >= 18 || hour <= 1 ? 1.8 : 0.25
  if (type === 'spa') return hour >= 9 && hour <= 20 ? 1 : 0.2
  return 1
}

export const UPGRADES = { inn: 'standard', standard: 'deluxe', deluxe: 'suite' }
export function upgradeCost(type) {
  const next = UPGRADES[type]
  return next ? ROOM_TYPES[next].cost - Math.round(ROOM_TYPES[type].cost * 0.5) : null
}

export const emptyDay = () => ({ revenue: 0, rooms: 0, amenities: 0, tips: 0, expenses: 0, guests: 0, lost: 0, missed: 0 })
