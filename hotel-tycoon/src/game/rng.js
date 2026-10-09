// A fresh seed for a new game. The seeded generator itself is sim/Random.js.
export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0
}
