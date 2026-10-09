# 01: Deterministic simulation

> A simulation is deterministic when the same starting state and the same inputs always produce the same end state, bit for bit.

## 0. The problem

The game used `Math.random()` for guest arrivals, room tiers and amenity visits. That made three things impossible:

1. **Tests.** "After 3 days money is 4,210" is only checkable if 3 days always play out the same way.
2. **Bug reports.** "My hotel went bankrupt on Day 9" cannot be replayed.
3. **Multiplayer (M5).** The server must recompute a player's day and get the same answer the client got, or it cannot tell cheating from rounding.

## 1. The fix: a seeded pseudo-random generator

A PRNG is a tiny function: `state → (new state, number in [0,1))`. Same starting state (the **seed**), same sequence forever.

We use **mulberry32** (`src/game/rng.js`): one 32-bit integer of state, a few multiplies and shifts. It is not cryptographic, but it is fast, well distributed and trivial to save.

```js
function random() {
  const r = nextRandom(game.rngState) // pure: no hidden globals
  game.rngState = r.state             // state lives in the game object
  return r.value
}
```

Key choice: **the RNG state is part of the game state.** So `save()` stores it, `load()` restores it, and a loaded game continues the *same* random sequence. The unit test "save and load round-trips the game, including the random state" proves exactly this.

## 2. Other sources of non-determinism (and how we treat them)

| Source | Problem | Rule |
| --- | --- | --- |
| `Math.random()` | Different every run | Banned inside the simulation; use `random()` |
| Frame time (`dt`) | 60 fps and 30 fps step differently | Simulation advances in fixed 2-minute ticks (`simulateMinutes`) |
| `performance.now()`, `Date.now()` | Wall clock differs | Allowed only for visuals (floating text fade), never for rules |
| Floating-point money | `0.1 + 0.2 !== 0.3`; different CPUs can differ in edge cases | Planned: store money as integer cents |
| Object key order, `Array.sort` ties | Usually stable in modern JS, but easy to break | Sort with full tie-breakers (the engine sorts by tier, then floor) |

## 3. Fixed timestep, in one picture

Render frames arrive at uneven intervals. The simulation slices whatever time passed into equal ticks:

```
frame dt:  16ms      33ms           16ms
game min:  1.6       3.3            1.6        (10 game minutes per real second)
ticks:     [1.6]     [2][1.3]       [1.6]
```

Each tick is at most 2 game minutes, so a slow device simulates the same rules as a fast one. It just draws fewer frames. (Strictly, determinism needs *identical* tick sizes; `simulateMinutes` gives that for tests. Live play splits by frame, which is fine for single-player.)

## 4. Gotcha we hit: autosave overwrote the test's save

The first save/load test saved, simulated a day, then loaded, and the numbers did not match. The engine was fine: **midnight triggers an autosave**, which replaced our snapshot with a later one. The lesson is general: when a system writes state on its own schedule, a test must control or snapshot that storage itself.

## 5. Where this goes next

- Move the engine into a pure module: `step(game, minutes)` with no globals, so many games can run side by side (server shards, AI rivals).
- Money as integer cents.
- Server-side replay: client sends intents with the world day; server re-runs and compares.
