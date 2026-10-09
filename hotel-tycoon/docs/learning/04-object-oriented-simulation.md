# 04: Object-oriented simulation

> Split by responsibility, keep the hot loops lean, and prove the split changed nothing.

## 1. From one big module to classes

Before, `engine.js` was 865 lines: one global `game` object and ~60 functions that all read and wrote it. Now `src/sim/` has one class per concept:

```text
Game ─┬─ Random       seeded numbers (state saved)
      ├─ Building ─── Room       floors, width, rooms, lobby geometry
      ├─ Population ─ Agent ─┬─ Guest        taxi → queue → desk → room ⇄ amenity → leave
      │                      └─ Housekeeper  find dirty room → clean → go home
      ├─ Reception    queue and desks
      ├─ Arrivals     how many guests come, taxis
      ├─ Ledger       money, today, totals, day summaries
      └─ Goals        milestones and rewards
```

Each class owns its data **and** the rules that change it. `Guest` holds a guest's state machine as methods (`queueing`, `atDesk`, `inRoom`…), so the rule for "what a guest does at the desk" lives in one place.

## 2. Pure core, thin host

`src/sim` never touches the browser: no `window`, `localStorage`, `performance`, `Date` or `Math.random` (a test greps for them). What it needs from outside is **injected**:

| Need | Injected as | Browser host passes |
| --- | --- | --- |
| Timestamps for floating text | `now()` | `performance.now` |
| "Save now" moments | `onCheckpoint(game)` | `SaveStore.write` |
| A seed | `Game.create(seed)` | `randomSeed()` |

`src/game/engine.js` is the host: it holds the live `Game`, a `SaveStore`, and the old function API (`buildRoom(...)`, `snapshot()`…) so the UI didn't have to change in the same step. That is the **facade** pattern: new structure behind an old front door.

The same pure core can later run in a Web Worker, on a server that validates moves, or in a replay tool.

## 3. OOP without losing frame time

Objects can be slow if used carelessly. The rules we follow on code that runs every tick:

| Rule | Why | Where |
| --- | --- | --- |
| Set every field in the constructor | All agents share one hidden class, so property access stays fast (V8 "shapes") | `Agent`, `Guest`, `Housekeeper` |
| Don't allocate per call | Garbage collection pauses look like stutter | `Random.next()` is inlined instead of returning `{ state, value }` |
| Index what you look up | `find` over all agents is O(n) per lookup | `Population.byId` |
| Pass the game in, don't store it | No cycles: an agent serialises as plain data | `agent.step(game, dt)` |
| Compact in place | No new array every tick | `Population.sweep()` |

## 4. Commands as data

Every player action also goes through `game.apply({ type: 'buildRoom', floor, slot, room })`. One entry point means one place to add undo, replays, multiplayer, or server-side validation later.

## 5. Proving a refactor changed nothing: the golden master

Unit tests check rules you thought of. A **golden master** checks everything: run scripted games with fixed seeds, record the complete resulting state, and require the new code to reproduce it exactly.

- `golden.test.js`: 13 simulated days of building, hiring, upgrading and firing. Every agent's position, every room, the random state.
- `save-v1.json`: a real save written by the **old** engine, plus what the old engine did next. The new engine must load it and do the same.

It caught nothing this time, but it is what let us change every line of the simulation with confidence. When a rule changes **on purpose**, regenerate with `UPDATE_GOLDEN=1 npm test` and read the fixture diff in review: the diff *is* the behaviour change.

**Gotcha:** replays depend on the **order of random draws**. In `Guest.spawn` the position is drawn before colour, hair, scale, patience and speed, exactly as before; swap two lines and every later guest changes.

## 6. Measured

20 busy simulated days (42 rooms, 70 people) take ~0.7 s in both the old and new engine, so ~33 ms per game day, or ~0.2 ms per frame at 1× speed. The simulation is not the bottleneck today; the renderer is. When it is, profile one class at a time and let the golden master tell you if an optimisation changed behaviour.
