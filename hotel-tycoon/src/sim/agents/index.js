import { Guest } from './Guest'
import { Housekeeper } from './Housekeeper'
import { Owner } from './Owner'

export { Agent } from './Agent'
export { Guest, Housekeeper, Owner }

// Rebuild the right class from saved plain data.
export function agentFromJSON(o) {
  return o.kind === 'guest' ? new Guest(o) : new Housekeeper(o)
}
