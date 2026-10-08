import {
  SLOT_W, FLOOR_H, DEPTH, CORRIDOR_Z, ELEV_X, MAX_FLOORS, MAX_WIDTH, MINUTES_PER_SECOND,
  WALK_SPEED, ELEV_SPEED, QUEUE_MAX, START_MONEY, ROOM_TYPES, STAFF_TYPES, GUEST_COLORS,
  floorCost, widenCost, slotX,
} from './constants'

const SAVE_KEY = 'hotel-tycoon-save-v1'
const CHECKIN_TIME = 10 // game minutes per guest at the desk
const CLEAN_TIME = 35
export const TAXI_ARRIVE = 10 // game minutes for a taxi to reach the curb

const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// Arrival intensity by hour of day
const HOUR_CURVE = [
  0.15, 0.1, 0.08, 0.08, 0.1, 0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9,
  1.0, 1.1, 1.2, 1.25, 1.3, 1.3, 1.25, 1.15, 0.95, 0.7, 0.45, 0.25,
]

function emptyDay() {
  return { revenue: 0, rooms: 0, amenities: 0, tips: 0, expenses: 0, guests: 0, lost: 0, missed: 0 }
}

function createGame() {
  const g = {
    money: START_MONEY,
    day: 1,
    minute: 9 * 60,
    speed: 1,
    rating: 3.0,
    floors: 1,
    width: 3,
    rooms: {},
    agents: [],
    queue: [],
    desks: [],
    nextId: 1,
    staff: { housekeeper: 1, receptionist: 1 },
    priceMult: 1,
    today: emptyDay(),
    totals: { guests: 0, lost: 0, earned: 0, bestDay: 0 },
    history: [],
    goalsDone: {},
    floaters: [],
    toasts: [],
    structureVersion: 0,
    lastSummary: null,
    spawnAcc: 0,
    taxis: [],
  }
  placeRoom(g, 1, 0, 'standard')
  placeRoom(g, 1, 1, 'standard')
  return g
}

function placeRoom(g, floor, slot, type) {
  const key = `${floor}-${slot}`
  g.rooms[key] = { key, floor, slot, type, status: 'vacant', guestId: null, cleanBy: null, users: [] }
  g.structureVersion++
}

export let game = load() || createGame()
syncStaffAgents()

// ---------------------------------------------------------------- geometry helpers
export const lobbyWidth = () => game.width * SLOT_W
export const deskX = () => lobbyWidth() / 2 + 0.6
export const entranceX = () => lobbyWidth() - 1.7
export const SIDEWALK_Z = DEPTH / 2 + 3.4
export const CURB_Z = SIDEWALK_Z + 1.25 // where taxis drop guests off
export const TAXI_LANE_Z = SIDEWALK_Z + 2.0
export const WALK_RANGE = 26 // guests on foot appear/disappear this far from the hotel
export const absTime = () => game.day * 1440 + game.minute
export const curbX = () => entranceX() + 1.6

export function serviceSpot(i) {
  return { x: deskX() + (i - 1) * 1.25, y: 0, z: -0.2 }
}
export function receptionistSpot(i) {
  return { x: deskX() + (i - 1) * 1.25, y: 0, z: -1.45 }
}
export function queueSpot(i) {
  const startX = deskX() + 2.1
  const maxX = lobbyWidth() - 0.6
  const perRow = Math.max(2, Math.floor((maxX - startX) / 0.6) + 1)
  const row = Math.floor(i / perRow)
  const col = i % perRow
  const x = row % 2 === 0 ? startX + col * 0.6 : startX + (perRow - 1 - col) * 0.6
  return { x, y: 0, z: 0.45 + row * 0.6 }
}
function housekeeperHome(i) {
  return { x: 0.6 + (i % 6) * 0.5, y: 0, z: -1.5 + Math.floor(i / 6) * 0.5 }
}
function roomSpot(room) {
  return { x: slotX(room.slot) + rand(-1.1, 1.1), y: room.floor * FLOOR_H, z: rand(-0.7, 0.6) }
}

function floorOf(p) {
  return Math.round(p.y / FLOOR_H)
}

// Build a path from the agent's current position to target, using the elevator if needed.
function routeTo(a, target) {
  const p = a.pos
  const from = floorOf(p)
  const to = floorOf(target)
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
  a.path = path
}

function moveAgent(a, dt) {
  let budget = dt
  while (a.path.length && budget > 0) {
    const t = a.path[0]
    const dx = t.x - a.pos.x
    const dy = t.y - a.pos.y
    const dz = t.z - a.pos.z
    const horiz = Math.hypot(dx, dz)
    const vertical = Math.abs(dy) > 0.01 && horiz < 0.01
    const dist = vertical ? Math.abs(dy) : Math.hypot(dx, dy, dz)
    const speed = (vertical ? ELEV_SPEED : WALK_SPEED) * (a.speedMul || 1)
    if (horiz > 0.001) a.heading = Math.atan2(dx, dz)
    a.inElevator = vertical
    if (dist <= speed * budget) {
      a.pos.x = t.x; a.pos.y = t.y; a.pos.z = t.z
      budget -= dist / speed
      a.path.shift()
    } else {
      const k = (speed * budget) / dist
      a.pos.x += dx * k; a.pos.y += dy * k; a.pos.z += dz * k
      budget = 0
    }
  }
  a.moving = a.path.length > 0
  if (!a.moving) a.inElevator = false
}

// ---------------------------------------------------------------- feedback
export function floater(text, pos, color = '#3d9a5f') {
  game.floaters.push({ id: game.nextId++, text, x: pos.x, y: pos.y + 2.1, z: pos.z, color, born: performance.now() })
  if (game.floaters.length > 40) game.floaters.shift()
}
export function toast(text, icon = '✨') {
  game.toasts.push({ id: game.nextId++, text, icon, born: performance.now() })
  if (game.toasts.length > 5) game.toasts.shift()
}

function earn(amount, category) {
  game.money += amount
  game.today.revenue += amount
  game.today[category] += amount
  game.totals.earned += amount
}

// ---------------------------------------------------------------- guests
// Share of arriving guests wanting [standard, deluxe, suite] at a given rating.
export function demandMix(r) {
  const pSuite = clamp((r - 3.4) * 0.3, 0, 0.35)
  const pDeluxe = clamp(0.12 + (r - 2) * 0.16, 0.08, 0.45)
  return [1 - pSuite - pDeluxe, pDeluxe, pSuite]
}

function spawnGuest() {
  const [, pDeluxe, pSuite] = demandMix(game.rating)
  const roll = Math.random()
  const tier = roll < pSuite ? 2 : roll < pSuite + pDeluxe ? 1 : 0
  // half the guests arrive by taxi, the rest stroll in along the sidewalk
  const byTaxi = Math.random() < 0.5 && game.taxis.length < 4
  const start = byTaxi
    ? { x: curbX(), y: 0, z: CURB_Z - 0.5 }
    : { x: lobbyWidth() + WALK_RANGE + rand(0, 1), y: 0, z: SIDEWALK_Z + rand(-0.4, 0.4) }
  const a = {
    id: game.nextId++,
    kind: 'guest',
    tier,
    color: pick(GUEST_COLORS),
    hair: pick(['#3b2a20', '#6b4a2f', '#d9a441', '#1f1f28', '#a4553a', '#e8e1d6']),
    scale: rand(0.9, 1.08),
    pos: start,
    heading: -Math.PI / 2,
    path: byTaxi ? [] : [
      { x: entranceX(), y: 0, z: SIDEWALK_Z },
      { x: entranceX(), y: 0, z: DEPTH / 2 - 0.3 },
    ],
    state: byTaxi ? 'taxi' : 'arriving',
    hidden: byTaxi,
    taxiT: 0,
    wait: 0,
    patience: rand(90, 160),
    sat: 3.6,
    mood: 'happy',
    speedMul: rand(0.9, 1.15),
  }
  if (byTaxi) game.taxis.push({ id: game.nextId++, guestId: a.id, start: absTime(), x: curbX() })
  game.agents.push(a)
}

function leave(a, reason) {
  a.state = 'leaving'
  game.queue = game.queue.filter((id) => id !== a.id)
  const exitPath = []
  // Route back to the lobby first
  const lobbyPoint = { x: entranceX(), y: 0, z: DEPTH / 2 - 0.3 }
  routeTo(a, lobbyPoint)
  exitPath.push({ x: entranceX(), y: 0, z: SIDEWALK_Z + 0.4 })
  exitPath.push({ x: -WALK_RANGE, y: 0, z: SIDEWALK_Z + 0.4 })
  a.path.push(...exitPath)
  if (reason) a.mood = 'angry'
}

function checkIn(a) {
  const tier = a.tier
  const vacant = Object.values(game.rooms).filter(
    (r) => ROOM_TYPES[r.type].kind === 'room' && r.status === 'vacant'
  )
  if (!vacant.length) {
    game.today.missed++
    floater('No vacancy!', a.pos, '#d0574b')
    leave(a, 'novacancy')
    return
  }
  // Prefer the exact tier, then closest tier
  vacant.sort((r1, r2) => {
    const d1 = Math.abs(ROOM_TYPES[r1.type].tier - tier) + (ROOM_TYPES[r1.type].tier > tier ? 0.4 : 0)
    const d2 = Math.abs(ROOM_TYPES[r2.type].tier - tier) + (ROOM_TYPES[r2.type].tier > tier ? 0.4 : 0)
    return d1 - d2 || r1.floor - r2.floor
  })
  const room = vacant[0]
  const def = ROOM_TYPES[room.type]
  const diff = def.tier - tier
  if (diff < 0) a.sat -= 0.55 * -diff
  if (diff > 0) a.sat -= 0.25 * diff
  if (diff === 0) a.sat += 0.35
  a.sat -= (game.priceMult - 1) * 1.6
  a.sat -= clamp((a.wait - 30) / 60, 0, 1.2)
  const price = Math.round(def.price * game.priceMult)
  earn(price, 'rooms')
  a.paid = price
  floater(`+$${price}`, a.pos)
  room.status = 'occupied'
  room.guestId = a.id
  a.room = room.key
  a.stay = rand(240, 660)
  a.nextAmenityRoll = rand(30, 90)
  a.state = 'toRoom'
  a.mood = 'happy'
  routeTo(a, roomSpot(room))
  game.today.guests++
  game.totals.guests++
}

function amenityPreference(type, hour) {
  if (type === 'restaurant') return (hour >= 7 && hour <= 9) || (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21) ? 1.6 : 0.5
  if (type === 'bar') return hour >= 18 || hour <= 1 ? 1.8 : 0.25
  if (type === 'spa') return hour >= 9 && hour <= 20 ? 1 : 0.2
  return 1
}

function maybeVisitAmenity(a) {
  const hour = Math.floor(game.minute / 60)
  const options = Object.values(game.rooms).filter((r) => {
    const d = ROOM_TYPES[r.type]
    return d.kind === 'amenity' && r.users.length < d.capacity
  })
  if (!options.length) return false
  const weighted = options.map((r) => ({ r, w: amenityPreference(r.type, hour) }))
  const total = weighted.reduce((s, o) => s + o.w, 0)
  if (Math.random() > 0.22 * Math.min(1.6, total / options.length)) return false
  let roll = Math.random() * total
  let chosen = weighted[0].r
  for (const o of weighted) {
    roll -= o.w
    if (roll <= 0) { chosen = o.r; break }
  }
  chosen.users.push(a.id)
  a.amenity = chosen.key
  a.state = 'toAmenity'
  const idx = chosen.users.length - 1
  routeTo(a, {
    x: slotX(chosen.slot) - 1.2 + (idx % 2) * 2.4 + rand(-0.15, 0.15),
    y: chosen.floor * FLOOR_H,
    z: idx < 2 ? -0.3 : 0.7,
  })
  return true
}

function finishStay(a) {
  const room = game.rooms[a.room]
  if (room) {
    room.status = 'dirty'
    room.guestId = null
  }
  a.room = null
  a.sat = clamp(a.sat, 0.5, 5)
  game.rating = clamp(game.rating + (a.sat - game.rating) * 0.08, 0.5, 5)
  if (a.sat >= 4.2) {
    const tip = Math.round(a.paid * 0.12)
    earn(tip, 'tips')
    floater(`Tip +$${tip}`, a.pos, '#c58b1b')
  }
  a.mood = a.sat >= 3.4 ? 'happy' : a.sat >= 2.4 ? 'meh' : 'angry'
  leave(a)
}

function stepGuest(a, dt) {
  switch (a.state) {
    case 'taxi':
      a.taxiT += dt
      if (a.taxiT >= TAXI_ARRIVE) {
        a.hidden = false
        a.state = 'arriving'
        a.path = [
          { x: curbX(), y: 0, z: SIDEWALK_Z },
          { x: entranceX(), y: 0, z: SIDEWALK_Z - 0.6 },
          { x: entranceX(), y: 0, z: DEPTH / 2 - 0.3 },
        ]
      }
      break
    case 'arriving':
      if (!a.moving) {
        if (game.queue.length >= QUEUE_MAX) {
          floater('Too crowded!', a.pos, '#d0574b')
          loseGuest(a)
        } else {
          game.queue.push(a.id)
          a.state = 'queue'
          a.queueIdx = -1
        }
      }
      break
    case 'queue': {
      a.wait += dt
      const idx = game.queue.indexOf(a.id)
      if (idx !== a.queueIdx) {
        a.queueIdx = idx
        const s = queueSpot(idx)
        a.path = [s]
      }
      if (a.wait > a.patience * 0.6) a.mood = 'meh'
      if (a.wait > a.patience) {
        floater('Too slow!', a.pos, '#d0574b')
        loseGuest(a)
      }
      break
    }
    case 'toDesk':
      a.wait += dt
      if (!a.moving) {
        a.deskT = (a.deskT || 0) + dt
        a.heading = Math.PI
        if (a.deskT >= CHECKIN_TIME) {
          game.desks[a.desk] = null
          checkIn(a)
        }
      }
      break
    case 'toRoom':
      if (!a.moving) a.state = 'inRoom'
      break
    case 'inRoom':
      a.stay -= dt
      a.idleT = (a.idleT || 0) - dt
      if (a.stay <= 0) { finishStay(a); break }
      a.nextAmenityRoll -= dt
      if (a.nextAmenityRoll <= 0) {
        a.nextAmenityRoll = rand(50, 100)
        if (maybeVisitAmenity(a)) break
      }
      if (a.idleT <= 0) {
        a.idleT = rand(40, 120)
        const room = game.rooms[a.room]
        if (room) {
          const s = roomSpot(room)
          a.path = [{ x: s.x, y: s.y, z: s.z }]
        }
      }
      break
    case 'toAmenity':
      a.stay -= dt
      if (!a.moving) {
        a.state = 'atAmenity'
        a.amenityT = rand(50, 90)
        a.heading = Math.PI
      }
      break
    case 'atAmenity': {
      a.stay -= dt
      a.amenityT -= dt
      if (a.amenityT <= 0) {
        const am = game.rooms[a.amenity]
        if (am) {
          const def = ROOM_TYPES[am.type]
          am.users = am.users.filter((id) => id !== a.id)
          earn(def.spend, 'amenities')
          a.sat += def.joy
          floater(`+$${def.spend}`, a.pos, '#3d9a5f')
        }
        a.amenity = null
        const room = game.rooms[a.room]
        if (a.stay <= 0 || !room) finishStay(a)
        else {
          a.state = 'toRoom'
          routeTo(a, roomSpot(room))
        }
      }
      break
    }
    case 'leaving':
      if (!a.moving) a.dead = true
      break
  }
}

function loseGuest(a) {
  game.today.lost++
  game.totals.lost++
  game.rating = clamp(game.rating + (1.2 - game.rating) * 0.05, 0.5, 5)
  leave(a, 'angry')
}

function stepDesks() {
  const n = game.staff.receptionist
  while (game.desks.length < n) game.desks.push(null)
  if (game.desks.length > n) {
    // send anyone at a removed desk back to the queue front
    for (let i = n; i < game.desks.length; i++) {
      const id = game.desks[i]
      const a = id && game.agents.find((x) => x.id === id)
      if (a) { a.state = 'queue'; a.queueIdx = -1; game.queue.unshift(a.id) }
    }
    game.desks.length = n
  }
  for (let i = 0; i < n; i++) {
    if (game.desks[i] == null && game.queue.length) {
      const id = game.queue.shift()
      const a = game.agents.find((x) => x.id === id)
      if (!a) continue
      game.desks[i] = id
      a.desk = i
      a.deskT = 0
      a.state = 'toDesk'
      a.path = [serviceSpot(i)]
    }
  }
}

// ---------------------------------------------------------------- staff
export function syncStaffAgents() {
  const hks = game.agents.filter((a) => a.kind === 'staff')
  const want = game.staff.housekeeper
  for (let i = hks.length; i < want; i++) {
    const home = housekeeperHome(i)
    game.agents.push({
      id: game.nextId++,
      kind: 'staff',
      color: STAFF_TYPES.housekeeper.color,
      hair: '#3b2a20',
      scale: 1,
      pos: { x: home.x, y: 0, z: home.z },
      heading: 0,
      path: [],
      state: 'idle',
      home: i,
      speedMul: 1.15,
      mood: 'work',
    })
  }
  if (hks.length > want) {
    // remove the extras, preferring idle ones
    const sorted = [...hks].sort((a, b) => (a.state === 'idle' ? -1 : 1) - (b.state === 'idle' ? -1 : 1))
    for (const a of sorted.slice(0, hks.length - want)) {
      const room = a.target && game.rooms[a.target]
      if (room && room.cleanBy === a.id) {
        room.cleanBy = null
        if (room.status === 'cleaning') room.status = 'dirty'
      }
      a.dead = true
    }
    game.agents = game.agents.filter((a) => !a.dead)
    game.agents.filter((a) => a.kind === 'staff').forEach((a, i) => (a.home = i))
  }
}

function stepStaff(a, dt) {
  switch (a.state) {
    case 'idle':
    case 'returning': {
      const dirty = Object.values(game.rooms).filter((r) => r.status === 'dirty' && r.cleanBy == null)
      if (dirty.length) {
        const cur = floorOf(a.pos)
        dirty.sort((r1, r2) => Math.abs(r1.floor - cur) - Math.abs(r2.floor - cur) || Math.abs(slotX(r1.slot) - a.pos.x) - Math.abs(slotX(r2.slot) - a.pos.x))
        const room = dirty[0]
        room.cleanBy = a.id
        a.target = room.key
        a.state = 'toClean'
        routeTo(a, { x: slotX(room.slot) + 0.6, y: room.floor * FLOOR_H, z: 0.2 })
      } else if (a.state === 'idle' && !a.atHome) {
        a.state = 'returning'
        a.atHome = true
        routeTo(a, housekeeperHome(a.home))
      } else if (a.state === 'returning' && !a.moving) {
        a.state = 'idle'
      }
      break
    }
    case 'toClean': {
      const room = game.rooms[a.target]
      if (!room) { a.state = 'idle'; a.atHome = false; break }
      if (!a.moving) {
        room.status = 'cleaning'
        room.cleanT = 0
        a.state = 'cleaning'
      }
      break
    }
    case 'cleaning': {
      const room = game.rooms[a.target]
      if (!room) { a.state = 'idle'; a.atHome = false; break }
      room.cleanT += dt
      a.heading += dt * 0.08
      if (room.cleanT >= CLEAN_TIME) {
        room.status = 'vacant'
        room.cleanBy = null
        room.cleanT = 0
        a.target = null
        a.state = 'idle'
        a.atHome = false
      }
      break
    }
  }
}

// ---------------------------------------------------------------- main step
export function step(dtReal) {
  if (!game.speed) return
  let dt = Math.min(dtReal, 0.1) * MINUTES_PER_SECOND * game.speed
  while (dt > 0) {
    const d = Math.min(dt, 2)
    dt -= d
    tick(d)
  }
}

function roomCount() {
  return Object.values(game.rooms).filter((r) => ROOM_TYPES[r.type].kind === 'room').length
}

function tick(dt) {
  const prevHour = Math.floor(game.minute / 60)
  game.minute += dt
  if (game.minute >= 1440) {
    game.minute -= 1440
    endOfDay()
  }
  const hour = Math.floor(game.minute / 60)
  if (hour !== prevHour) checkGoals()

  // arrivals
  const rooms = roomCount()
  const anyVacant = Object.values(game.rooms).some((r) => ROOM_TYPES[r.type].kind === 'room' && r.status !== 'occupied')
  const ratingF = 0.3 + (game.rating / 5) * 1.0
  const priceF = Math.pow(1 / game.priceMult, 1.8)
  const capF = 0.6 + rooms * 0.45
  const perHour = 0.9 * HOUR_CURVE[hour] * ratingF * priceF * capF * (anyVacant ? 1 : 0.3)
  game.spawnAcc += (perHour / 60) * dt
  const guests = game.agents.filter((a) => a.kind === 'guest').length
  while (game.spawnAcc >= 1) {
    game.spawnAcc -= 1
    if (guests < 90) spawnGuest()
  }

  if (game.taxis.length && absTime() - game.taxis[0].start > 40) game.taxis.shift()

  stepDesks()
  for (const a of game.agents) {
    moveAgent(a, dt)
    if (a.kind === 'guest') stepGuest(a, dt)
    else stepStaff(a, dt)
  }
  if (game.agents.some((a) => a.dead)) game.agents = game.agents.filter((a) => !a.dead)
}

function endOfDay() {
  let wages = 0
  for (const k of Object.keys(game.staff)) wages += game.staff[k] * STAFF_TYPES[k].wage
  let upkeep = 0
  for (const r of Object.values(game.rooms)) upkeep += ROOM_TYPES[r.type].upkeep
  const expenses = wages + upkeep
  game.money -= expenses
  game.today.expenses = expenses
  const summary = { day: game.day, ...game.today, wages, upkeep, profit: game.today.revenue - expenses, rating: game.rating }
  game.lastSummary = summary
  game.history.push(summary)
  if (game.history.length > 30) game.history.shift()
  game.totals.bestDay = Math.max(game.totals.bestDay, game.today.revenue)
  game.today = emptyDay()
  game.day++
  checkGoals()
  save()
}

// ---------------------------------------------------------------- goals
export const GOALS = [
  { id: 'rooms4', text: 'Have 4 guest rooms', reward: 500, check: (g) => countRooms(g) >= 4 },
  { id: 'floor2', text: 'Build a 2nd floor', reward: 600, check: (g) => g.floors >= 2 },
  { id: 'guests25', text: 'Check in 25 guests', reward: 800, check: (g) => g.totals.guests >= 25 },
  { id: 'deluxe', text: 'Build a Deluxe Room', reward: 500, check: (g) => hasType(g, 'deluxe') },
  { id: 'restaurant', text: 'Open a Restaurant', reward: 1000, check: (g) => hasType(g, 'restaurant') },
  { id: 'star35', text: 'Reach a 3.5★ rating', reward: 1200, check: (g) => g.rating >= 3.5 },
  { id: 'widen', text: 'Widen the hotel', reward: 1000, check: (g) => g.width >= 4 },
  { id: 'day2k', text: 'Earn $2,000 in a day', reward: 1500, check: (g) => g.totals.bestDay >= 2000 },
  { id: 'rooms10', text: 'Have 10 guest rooms', reward: 2000, check: (g) => countRooms(g) >= 10 },
  { id: 'suite', text: 'Build a Royal Suite', reward: 1500, check: (g) => hasType(g, 'suite') },
  { id: 'floor5', text: 'Grow to 5 floors', reward: 3000, check: (g) => g.floors >= 5 },
  { id: 'star45', text: 'Reach a 4.5★ rating', reward: 4000, check: (g) => g.rating >= 4.5 },
  { id: 'guests500', text: 'Check in 500 guests', reward: 6000, check: (g) => g.totals.guests >= 500 },
  { id: 'day10k', text: 'Earn $10,000 in a day', reward: 10000, check: (g) => g.totals.bestDay >= 10000 },
]
function countRooms(g) {
  return Object.values(g.rooms).filter((r) => ROOM_TYPES[r.type].kind === 'room').length
}
function hasType(g, t) {
  return Object.values(g.rooms).some((r) => r.type === t)
}
export function checkGoals() {
  for (const goal of GOALS) {
    if (!game.goalsDone[goal.id] && goal.check(game)) {
      game.goalsDone[goal.id] = true
      game.money += goal.reward
      toast(`Goal complete: ${goal.text} (+$${goal.reward.toLocaleString()})`, '🏆')
    }
  }
}

// ---------------------------------------------------------------- player actions
export function buildRoom(floor, slot, type) {
  const def = ROOM_TYPES[type]
  const key = `${floor}-${slot}`
  if (game.rooms[key]) return false
  if (floor < 1 || floor > game.floors || slot < 0 || slot >= game.width) return false
  if (game.money < def.cost) { toast('Not enough money', '💸'); return false }
  game.money -= def.cost
  placeRoom(game, floor, slot, type)
  floater(`-$${def.cost}`, { x: slotX(slot), y: floor * FLOOR_H, z: 0 }, '#d0574b')
  checkGoals()
  save()
  return true
}

export function demolish(key) {
  const room = game.rooms[key]
  if (!room) return false
  if (room.status === 'occupied' || room.users.length) { toast('Wait until the guests are gone', '🙅'); return false }
  if (room.cleanBy) {
    const hk = game.agents.find((a) => a.id === room.cleanBy)
    if (hk) { hk.state = 'idle'; hk.atHome = false; hk.target = null }
  }
  const refund = Math.round(ROOM_TYPES[room.type].cost * 0.5)
  game.money += refund
  floater(`+$${refund}`, { x: slotX(room.slot), y: room.floor * FLOOR_H, z: 0 })
  delete game.rooms[key]
  game.structureVersion++
  save()
  return true
}

export const UPGRADES = { standard: 'deluxe', deluxe: 'suite' }
export function upgradeCost(type) {
  const next = UPGRADES[type]
  return next ? ROOM_TYPES[next].cost - Math.round(ROOM_TYPES[type].cost * 0.5) : null
}
export function upgradeRoom(key) {
  const room = game.rooms[key]
  if (!room) return false
  const next = UPGRADES[room.type]
  if (!next) return false
  if (room.status !== 'vacant' && room.status !== 'dirty') { toast('Wait until the guests check out', '🙅'); return false }
  if (room.cleanBy) { toast('Housekeeping is in there right now', '🧹'); return false }
  const cost = upgradeCost(room.type)
  if (game.money < cost) { toast('Not enough money', '💸'); return false }
  game.money -= cost
  room.type = next
  room.status = 'vacant'
  floater(`-$${cost}`, { x: slotX(room.slot), y: room.floor * FLOOR_H, z: 0 }, '#d0574b')
  toast(`Upgraded to ${ROOM_TYPES[next].name}`, ROOM_TYPES[next].icon)
  game.structureVersion++
  checkGoals()
  save()
  return true
}

export function addFloor() {
  if (game.floors >= MAX_FLOORS) return false
  const cost = floorCost(game.floors + 1)
  if (game.money < cost) { toast('Not enough money', '💸'); return false }
  game.money -= cost
  game.floors++
  game.structureVersion++
  toast(`Floor ${game.floors} built!`, '🏗️')
  checkGoals()
  save()
  return true
}

export function widen() {
  if (game.width >= MAX_WIDTH) return false
  const cost = widenCost(game.width + 1, game.floors)
  if (game.money < cost) { toast('Not enough money', '💸'); return false }
  game.money -= cost
  game.width++
  // queued guests need to re-target their spots since the desk moves
  for (const a of game.agents) if (a.state === 'queue') a.queueIdx = -1
  game.structureVersion++
  toast('Hotel widened!', '📐')
  checkGoals()
  save()
  return true
}

export function hire(role) {
  const def = STAFF_TYPES[role]
  if (game.staff[role] >= def.max) return false
  if (game.money < def.hire) { toast('Not enough money', '💸'); return false }
  game.money -= def.hire
  game.staff[role]++
  syncStaffAgents()
  game.structureVersion++
  save()
  return true
}

export function fire(role) {
  if (game.staff[role] <= (role === 'receptionist' ? 1 : 0)) return false
  game.staff[role]--
  syncStaffAgents()
  game.structureVersion++
  save()
  return true
}

export function setPrice(mult) {
  game.priceMult = mult
}
export function setSpeed(s) {
  game.speed = s
}

// ---------------------------------------------------------------- persistence
export function save() {
  try {
    const { floaters, toasts, ...rest } = game
    localStorage.setItem(SAVE_KEY, JSON.stringify(rest))
  } catch { /* storage unavailable */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return { ...createGameShell(), ...data, floaters: [], toasts: [] }
  } catch {
    return null
  }
}
function createGameShell() {
  return { floaters: [], toasts: [], spawnAcc: 0, lastSummary: null, taxis: [] }
}
export function resetGame() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
  game = createGame()
  syncStaffAgents()
  game.structureVersion = Date.now() % 100000
}

export function roomName(room) {
  return `${room.floor}${String(room.slot + 1).padStart(2, '0')}`
}

export function snapshot() {
  const rooms = Object.values(game.rooms)
  const guestRooms = rooms.filter((r) => ROOM_TYPES[r.type].kind === 'room')
  const occupied = guestRooms.filter((r) => r.status === 'occupied').length
  const dirty = guestRooms.filter((r) => r.status === 'dirty' || r.status === 'cleaning').length
  const journey = { arriving: 0, queue: 0, checkin: 0, staying: 0, leaving: 0 }
  for (const a of game.agents) {
    if (a.kind !== 'guest') continue
    if (a.state === 'taxi' || a.state === 'arriving') journey.arriving++
    else if (a.state === 'queue') journey.queue++
    else if (a.state === 'toDesk') journey.checkin++
    else if (a.state === 'leaving') journey.leaving++
    else journey.staying++
  }
  return {
    journey,
    money: Math.floor(game.money),
    day: game.day,
    minute: game.minute,
    speed: game.speed,
    rating: game.rating,
    floors: game.floors,
    width: game.width,
    staff: { ...game.staff },
    priceMult: game.priceMult,
    totalRooms: guestRooms.length,
    occupied,
    dirty,
    queue: game.queue.length,
    guests: game.agents.filter((a) => a.kind === 'guest' && a.state !== 'leaving' && a.state !== 'taxi').length,
    today: { ...game.today },
    totals: { ...game.totals },
    goalsDone: { ...game.goalsDone },
    structureVersion: game.structureVersion,
    lastSummary: game.lastSummary,
    floorCost: floorCost(game.floors + 1),
    widenCost: widenCost(game.width + 1, game.floors),
  }
}
