// Milestones that pay a one-off reward. `check` reads the game through its public getters.
export const GOALS = [
  { id: 'rooms4', text: 'Have 4 guest rooms', reward: 500, check: (g) => g.building.countGuestRooms() >= 4 },
  { id: 'floor2', text: 'Build a 2nd floor', reward: 600, check: (g) => g.floors >= 2 },
  { id: 'guests25', text: 'Check in 25 guests', reward: 800, check: (g) => g.totals.guests >= 25 },
  { id: 'deluxe', text: 'Build a Deluxe Room', reward: 500, check: (g) => g.building.hasType('deluxe') },
  { id: 'restaurant', text: 'Open a Restaurant', reward: 1000, check: (g) => g.building.hasType('restaurant') },
  { id: 'star35', text: 'Reach a 3.5★ rating', reward: 1200, check: (g) => g.rating >= 3.5 },
  { id: 'widen', text: 'Widen the hotel', reward: 1000, check: (g) => g.width >= 4 },
  { id: 'day2k', text: 'Earn $2,000 in a day', reward: 1500, check: (g) => g.totals.bestDay >= 2000 },
  { id: 'rooms10', text: 'Have 10 guest rooms', reward: 2000, check: (g) => g.building.countGuestRooms() >= 10 },
  { id: 'suite', text: 'Build a Royal Suite', reward: 1500, check: (g) => g.building.hasType('suite') },
  { id: 'floor5', text: 'Grow to 5 floors', reward: 3000, check: (g) => g.floors >= 5 },
  { id: 'star45', text: 'Reach a 4.5★ rating', reward: 4000, check: (g) => g.rating >= 4.5 },
  { id: 'guests500', text: 'Check in 500 guests', reward: 6000, check: (g) => g.totals.guests >= 500 },
  { id: 'day10k', text: 'Earn $10,000 in a day', reward: 10000, check: (g) => g.totals.bestDay >= 10000 },
]

export class Goals {
  constructor(done = {}) {
    this.done = done // goal id -> true
  }

  check(game) {
    for (const goal of GOALS) {
      if (!this.done[goal.id] && goal.check(game)) {
        this.done[goal.id] = true
        game.ledger.money += goal.reward
        game.toast(`Goal complete: ${goal.text} (+$${goal.reward.toLocaleString()})`, '🏆')
      }
    }
  }
}
