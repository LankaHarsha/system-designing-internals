import { Guest } from './Guest'
import { Housekeeper } from './Housekeeper'
import { Owner } from './Owner'
import { Candidate } from './Candidate'

export { Agent } from './Agent'
export { Guest, Housekeeper, Owner, Candidate }

// Rebuild the right class from saved plain data.
export function agentFromJSON(o) {
  if (o.kind === 'guest') return new Guest(o)
  if (o.kind === 'candidate') return new Candidate(o)
  return new Housekeeper(o)
}
