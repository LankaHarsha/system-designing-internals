// Everyone in the world, in a stable order (iteration order is part of the rules), with an
// id index so lookups are O(1) instead of a scan.
export class Population {
  constructor(list = []) {
    this.list = list
    this.byId = new Map()
    for (const a of list) this.byId.set(a.id, a)
  }

  add(agent) {
    this.list.push(agent)
    this.byId.set(agent.id, agent)
  }

  // swap one agent for another in the same list slot (a candidate becoming staff)
  replace(old, next) {
    const i = this.list.indexOf(old)
    if (i < 0) return this.add(next)
    this.list[i] = next
    this.byId.delete(old.id)
    this.byId.set(next.id, next)
  }

  get(id) {
    return this.byId.get(id)
  }

  count(kind) {
    let n = 0
    for (const a of this.list) if (a.kind === kind) n++
    return n
  }

  ofKind(kind) {
    return this.list.filter((a) => a.kind === kind)
  }

  // Drop agents marked dead, compacting the list in place.
  sweep() {
    let w = 0
    for (const a of this.list) {
      if (a.dead) this.byId.delete(a.id)
      else this.list[w++] = a
    }
    this.list.length = w
  }
}
