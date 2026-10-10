# Test plan

**Rule: nothing deploys unless `npm run check` passes locally or the GitHub Actions workflow is green.**

## Test layers

| Layer | Tool | Where | What it proves | Runs |
| --- | --- | --- | --- | --- |
| Unit | Vitest | `tests/unit/` | Game rules: economy, actions, goals, save/load and migration, determinism, invariants, golden master, simulation purity | Every push, ~1 s |
| Build | Vite | `npm run build` | The production bundle compiles | Every push |
| Browser smoke | Playwright | `tests/e2e/` | The built game loads, draws WebGL, runs a day, saves across reload, fits the screen | Every push, desktop + mobile, ~2 min |
| Post-deploy smoke | Playwright | same specs, `BASE_URL=<url>` | The live deployment works | Automatically when Vercel reports a successful deploy to GitHub (`hotel-tycoon-deploy-smoke.yml`); or run the main workflow by hand with a URL |
| Playtest | People | checklist below | It is fun | Per milestone |

## Run it

```bash
cd hotel-tycoon
npm test                 # unit tests
npm run test:e2e         # builds must exist: run `npm run build` first
npm run check            # unit + build + e2e, the full deploy gate
BASE_URL=https://your-deploy.example npm run test:e2e   # smoke-test a live site
```

In the Claude Code cloud sandbox, add `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` to use the preinstalled browser.

## What each unit test covers

| Area | Checks |
| --- | --- |
| RNG (`sim.test.js`) | Same seed → same sequence; values in [0, 1) |
| Golden master (`golden.test.js`) | Three scripted games from the Day 1 start (3 idle days; 10 days of fixing, hiring, building, upgrading, firing; 2 days of the owner alone) reproduce the recorded state exactly: money, rating, rooms, every agent's position and state, random state. Intended rule changes: `UPDATE_GOLDEN=1 npm test`, then review the fixture diff |
| Saves (`sim.test.js`) | A real v1 save from the old engine loads with every field carried over and keeps running (rules changed since, so not an exact replay); mid-game save → load stays identical to the original; floaters/toasts never saved |
| Commands (`sim.test.js`) | `game.apply(intent)` equals calling the command; unknown intents throw; `onCheckpoint` fires on builds and at midnight |
| Owner (`owner.test.js`) | Starts rested at home; cleans a dirty room (walks, spends 8, room vacant); housekeepers keep off a claimed room; refuses clean/claimed/too-tired; stop hands the room back; works the desk (extra desk, 3 per check-in); leaves when exhausted; slow when tired, refills at midnight; post moves when a receptionist is hired; save/load mid-task is identical |
| Purity (`sim.test.js`) | Nothing in `src/sim` touches `window`, `document`, storage, `performance`, `Date` or `Math.random` |
| New game | Starting money, rooms, staff |
| Determinism | 3 simulated days replay identically from one seed; differ for another |
| Invariants (10 days, checked hourly) | Money finite; rating in 0.5–5; queue ≤ max; desks = receptionists; occupied rooms point at real guests; amenity users ≤ capacity; no NaN positions |
| End of day | Wages + upkeep charged exactly; summary profit = revenue − expenses; day advances |
| Actions | Build (cost, refusals), demolish (50% refund), upgrade (price), add floor (cost), hire/fire limits |
| Goals | Reward paid once |
| Demand mix | Shares sum to 1, never negative |
| Save/load | Round trip replays identically, random state included |

## Browser smoke tests

1. Loads with no console errors or uncaught exceptions; WebGL has drawn; HUD shows Day 1.
2. A full simulated day ends: engine reaches Day 2 with guests served; HUD and day report update.
3. A built room survives a page reload (save + load in a real browser).
4. No horizontal page scroll.

## Rules for new code

- Every new game rule gets a unit test in the same commit.
- Every bug fix starts with a failing test that reproduces it.
- A new player-facing screen or flow gets a smoke step when it can break the whole game.
- Flaky test = bug. Fix the cause (usually timing); never skip or retry it into green.

## M1 playtest checklist

- [ ] New player understands the first task without help within 30 s
- [ ] Day 1 feels busy but survivable; energy runs out around the evening rush
- [ ] Player hires on Day 2 or 3 and says it felt like relief
- [ ] No one gets stuck with no money and no way forward
- [ ] Players ask to keep playing past Day 3 (the M1 gate)
