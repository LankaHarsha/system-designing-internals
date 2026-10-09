// Browser host for the simulation in src/sim: owns the one live Game, persistence and the wall
// clock, and keeps the function-style API the views, tests and tools use (window.hotel).
import { MINUTES_PER_SECOND } from './constants'
import { randomSeed } from './rng'
import { SaveStore } from './SaveStore'
import { Game } from '../sim'

export {
  SIDEWALK_Z, CURB_Z, TAXI_LANE_Z, WALK_RANGE, TAXI_ARRIVE, UPGRADES, upgradeCost, demandMix,
} from '../sim/rules'
export { GOALS } from '../sim'

const store = new SaveStore()
const options = {
  now: () => performance.now(),
  onCheckpoint: (g) => store.write(g),
}

export let game = load() || Game.create(randomSeed(), options)

function load() {
  const data = store.read()
  if (!data) return null
  try {
    return Game.fromJSON(data, { ...options, fallbackSeed: randomSeed() })
  } catch {
    return null
  }
}

// Starts a fresh game in memory without touching the saved one (tests, tools).
export function newGame(seed) {
  game = Game.create(seed, options)
  return game
}

// Replaces the current game with the saved one, if any. Returns true on success.
export function loadGame() {
  const loaded = load()
  if (!loaded) return false
  game = loaded
  return true
}

export function resetGame(seed = randomSeed()) {
  store.clear()
  game = Game.create(seed, options)
  game.structureVersion = Date.now() % 100000 // views keyed on it must rebuild
}

export const save = () => store.write(game)

// Real seconds → game minutes at the current speed (capped so a stalled tab doesn't jump).
export function step(dtReal) {
  if (!game.speed) return
  game.simulateMinutes(Math.min(dtReal, 0.1) * MINUTES_PER_SECOND * game.speed)
}

// ---------------------------------------------------------------- function-style API
export const simulateMinutes = (m) => game.simulateMinutes(m)
export const snapshot = () => game.snapshot()
export const checkGoals = () => game.goals.check(game)
export const syncStaffAgents = () => game.syncStaff()
export const floater = (text, pos, color) => game.floater(text, pos, color)
export const toast = (text, icon) => game.toast(text, icon)

export const buildRoom = (floor, slot, type) => game.buildRoom(floor, slot, type)
export const demolish = (key) => game.demolish(key)
export const upgradeRoom = (key) => game.upgradeRoom(key)
export const addFloor = () => game.addFloor()
export const widen = () => game.widen()
export const hire = (role) => game.hire(role)
export const fire = (role) => game.fire(role)
export const ownerTask = (task, room) => game.ownerTask(task, room)
export const setPrice = (mult) => { game.priceMult = mult }
export const setSpeed = (s) => { game.speed = s }

// geometry of the current building
export const lobbyWidth = () => game.building.lobbyWidth
export const deskX = () => game.building.deskX
export const entranceX = () => game.building.entranceX
export const curbX = () => game.building.curbX
export const absTime = () => game.absTime
export const serviceSpot = (i) => game.building.serviceSpot(i)
export const receptionistSpot = (i) => game.building.receptionistSpot(i)
export const queueSpot = (i) => game.building.queueSpot(i)

export const roomName = (room) => `${room.floor}${String(room.slot + 1).padStart(2, '0')}`
