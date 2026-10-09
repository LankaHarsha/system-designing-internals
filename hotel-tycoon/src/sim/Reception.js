// The front desk: a queue of guest ids and one desk per receptionist.
export class Reception {
  constructor({ queue = [], desks = [] } = {}) {
    this.queue = queue // guest ids, front first
    this.desks = desks // guest id being served at each desk, or null
  }

  remove(id) {
    this.queue = this.queue.filter((q) => q !== id)
  }

  // Match the desks to the number of receptionists, then call the next guest to any free desk.
  step(game) {
    const n = game.staff.receptionist
    const desks = this.desks
    while (desks.length < n) desks.push(null)
    if (desks.length > n) {
      // send anyone at a removed desk back to the front of the queue
      for (let i = n; i < desks.length; i++) {
        const a = desks[i] && game.population.get(desks[i])
        if (a) { a.state = 'queue'; a.queueIdx = -1; this.queue.unshift(a.id) }
      }
      desks.length = n
    }
    for (let i = 0; i < n; i++) {
      if (desks[i] == null && this.queue.length) {
        const id = this.queue.shift()
        const a = game.population.get(id)
        if (!a) continue
        desks[i] = id
        a.desk = i
        a.deskT = 0
        a.state = 'toDesk'
        a.path = [game.building.serviceSpot(i)]
      }
    }
  }
}
