// Seeded random numbers (mulberry32). The state is a plain 32-bit integer so it lives in the
// save: the same save + the same inputs replays identically. Inlined so a draw allocates nothing.
export class Random {
  constructor(state) {
    this.state = state
  }

  next() {
    const s = (this.state + 0x6d2b79f5) | 0
    this.state = s
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(a, b) {
    return a + this.next() * (b - a)
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)]
  }
}
