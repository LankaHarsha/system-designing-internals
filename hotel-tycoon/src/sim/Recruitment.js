import { CANDIDATE_NAMES, ENERGY_COST, FIRST_HIRE } from './rules'
import { Candidate } from './agents/Candidate'
import { Housekeeper } from './agents/Housekeeper'

// The first hire (spec Act 1). If you still run the inn alone at dawn after Day 2, someone
// knocks at the door offering to take the chore you've spent the most energy on. Hire them and
// they walk to their post; say no (or leave them waiting) and they go. Happens once a game.
export class Recruitment {
  constructor({ candidateId = null, deadline = 0, done = false } = {}) {
    this.candidateId = candidateId // the Candidate waiting at the door, or walking in
    this.deadline = deadline // absTime they give up at
    this.done = done
  }

  candidate(game) {
    return this.candidateId == null ? null : game.population.get(this.candidateId) ?? null
  }

  // Which job to offer: whichever chore cost the owner more energy so far.
  static roleFor(owner) {
    const desk = owner.chores.checkIn * ENERGY_COST.checkIn
    const rooms = owner.chores.clean * ENERGY_COST.clean
    return desk > rooms ? 'receptionist' : 'housekeeper'
  }

  step(game) {
    if (this.done) return
    const hired = game.staff.housekeeper + game.staff.receptionist > 0
    const c = this.candidate(game)
    if (!c) {
      if (hired) { this.done = true; return } // you hired on your own: no knock needed
      if (game.day >= FIRST_HIRE.day && game.hour >= FIRST_HIRE.hour) {
        const name = CANDIDATE_NAMES[(game.seed + game.day) % CANDIDATE_NAMES.length]
        const role = Recruitment.roleFor(game.owner)
        this.candidateId = Candidate.arrive(game, role, name).id
        this.deadline = game.absTime + FIRST_HIRE.waitMinutes
        game.toast(`Someone is knocking at the door: ${name}, looking for work`, '🚪')
      }
      return
    }
    if (c.state === 'knocking' && game.absTime >= this.deadline) {
      game.toast(`${c.name} gave up waiting and left`, '🚪')
      this.finish(game, c)
    }
  }

  // Your answer at the door. Hiring charges the signing fee now; the job starts at the post.
  answer(game, hire) {
    const c = this.candidate(game)
    if (!c || (c.state !== 'knocking' && c.state !== 'arriving')) return false
    if (!hire) {
      game.toast(`${c.name} will try elsewhere. You can still hire from the Staff panel`, '👋')
      this.finish(game, c)
      return true
    }
    if (!game.pay(game.hireFee(c.role))) return false
    c.goToPost(game)
    return true
  }

  arrivedAtPost(game, c) {
    this.candidateId = null
    this.done = true
    if (c.role === 'housekeeper') {
      // the same person becomes the housekeeper: same id, outfit and spot
      game.population.replace(c, new Housekeeper({ id: c.id, home: game.staff.housekeeper, pos: c.pos, heading: c.heading }))
    } else {
      c.dead = true // receptionists are drawn at the desk, where they now stand
    }
    game.staff[c.role]++
    game.syncStaff()
    game.building.version++
    game.toast(`${c.name} joined as your ${c.role}. That chore is delegated`, '🎉')
    game.committed()
  }

  finish(game, c) {
    c.walkAway(game)
    this.candidateId = null
    this.done = true
  }
}
