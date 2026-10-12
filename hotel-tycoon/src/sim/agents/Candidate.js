import { DEPTH } from '../../game/constants'
import { SIDEWALK_Z, WALK_RANGE } from '../rules'
import { Agent } from './Agent'

// Someone looking for work. Walks up from the street, waits at the door, then either walks
// to their post (hired) or back off down the street. Recruitment owns the decision.
export class Candidate extends Agent {
  constructor(p) {
    super({ heading: -Math.PI / 2, mood: 'happy', state: 'arriving', speedMul: 1, ...p, kind: 'candidate' })
    this.role = p.role // the job they want: 'housekeeper' | 'receptionist'
    this.name = p.name
  }

  static arrive(game, role, name) {
    const b = game.building
    const c = new Candidate({
      id: game.nextId++, role, name,
      pos: { x: b.lobbyWidth + 8, y: 0, z: SIDEWALK_Z },
      path: [
        { x: b.entranceX, y: 0, z: SIDEWALK_Z },
        { x: b.entranceX, y: 0, z: DEPTH / 2 + 0.6 }, // just outside the door
      ],
    })
    game.population.add(c)
    return c
  }

  step(game) {
    if (this.moving) return
    if (this.state === 'arriving') {
      this.state = 'knocking'
      this.heading = Math.PI // facing the door
    } else if (this.state === 'toPost') {
      game.recruitment.arrivedAtPost(game, this)
    } else if (this.state === 'leaving') {
      this.dead = true
    }
  }

  goToPost(game) {
    this.state = 'toPost'
    const b = game.building
    const post = this.role === 'housekeeper'
      ? b.housekeeperHome(game.staff.housekeeper)
      : b.receptionistSpot(game.staff.receptionist)
    this.path = [{ x: b.entranceX, y: 0, z: DEPTH / 2 - 0.3 }]
    this.path.push(post)
  }

  walkAway(game) {
    this.state = 'leaving'
    const b = game.building
    this.path = [{ x: b.entranceX, y: 0, z: SIDEWALK_Z }, { x: -WALK_RANGE, y: 0, z: SIDEWALK_Z }]
  }
}
