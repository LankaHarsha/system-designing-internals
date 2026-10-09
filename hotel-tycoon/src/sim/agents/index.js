import { Guest } from './Guest'
import { Housekeeper } from './Housekeeper'

export { Agent } from './Agent'
export { Guest, Housekeeper }

// Rebuild the right class from saved plain data.
export function agentFromJSON(o) {
  return o.kind === 'guest' ? new Guest(o) : new Housekeeper(o)
}
