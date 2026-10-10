import { HOUR_CURVE, MAX_GUESTS } from './rules'
import { Guest } from './agents'

// How many guests turn up, and the taxis that bring half of them.
export class Arrivals {
  constructor({ spawnAcc = 0, taxis = [] } = {}) {
    this.spawnAcc = spawnAcc // fractional guests owed
    this.taxis = taxis
  }

  // Guests per hour right now: time of day × rating × price × size, cut when full.
  rate(game, hour) {
    const b = game.building
    const anyVacant = b.all().some((r) => r.isGuestRoom && r.status !== 'occupied' && r.status !== 'broken')
    const ratingF = 0.3 + (game.rating / 5) * 1.0
    const priceF = Math.pow(1 / game.priceMult, 1.8)
    const capF = 0.6 + b.countGuestRooms() * 0.45
    return 0.9 * HOUR_CURVE[hour] * ratingF * priceF * capF * (anyVacant ? 1 : 0.3)
  }

  step(game, dt, hour) {
    this.spawnAcc += (this.rate(game, hour) / 60) * dt
    const guests = game.population.count('guest')
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1
      if (guests < MAX_GUESTS) Guest.spawn(game)
    }
    if (this.taxis.length && game.absTime - this.taxis[0].start > 40) this.taxis.shift()
  }
}
