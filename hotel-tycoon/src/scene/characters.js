// The people in the hotel: Quaternius Ultimate Modular Men + Women (CC0), slimmed by
// scripts/import-characters.sh. Game, character lab and asset tests all read this list.

export const CHARACTER_DIR = './assets/characters/quaternius-modular/'

export const OUTFITS = {
  guest: ['male-casual-hoodie', 'female-casual', 'male-casual', 'female-punk', 'male-beach'],
  vip: ['male-suit', 'female-formal', 'female-suit'],
  housekeeper: ['male-worker', 'female-worker'],
  receptionist: ['male-suit', 'female-suit'],
  owner: ['owner'], // you: the casual outfit in the accent orange
}

export const MODELS = [...new Set(Object.values(OUTFITS).flat())]
export const modelUrl = (name) => `${CHARACTER_DIR}${name}.glb`

// clip names inside every model
export const CLIPS = { idle: 'Idle', walk: 'Walk', run: 'Run', work: 'Interact', wave: 'Wave' }

// The models stand 1.85 units tall; at 0.7 a person is ~1.3: a head above the 1.05 desk,
// under half a 3-unit floor.
export const CHARACTER_SCALE = 0.7

// Roughly how many world units per second the walk and run clips cover at timeScale 1 and
// CHARACTER_SCALE (estimated from a human stride and tuned by eye); People.jsx scales
// clip speed by movement speed over these so feet slide as little as possible.
export const WALK_STRIDE_SPEED = 1.0
export const RUN_STRIDE_SPEED = 2.7

// Same agent, same outfit, every frame and after a reload (ids are saved).
export function outfitFor(agent) {
  if (agent.kind === 'owner') return OUTFITS.owner[0]
  const list = agent.kind === 'staff' ? OUTFITS.housekeeper : agent.tier === 2 ? OUTFITS.vip : OUTFITS.guest
  return list[agent.id % list.length]
}
