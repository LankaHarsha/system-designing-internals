// Seeded random numbers (mulberry32). The state is a plain 32-bit integer so it
// can live inside the save: the same save + the same inputs replays identically.
export function nextRandom(state) {
  const s = (state + 0x6d2b79f5) | 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { state: s, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0
}
