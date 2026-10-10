# Implementation tracker

Living record of what is built, what is next and why. Update it in the same commit as the code it describes.

- **Spec:** [Hotel Tycoon: Grand Empire — Game Requirements v2](https://claude.ai/code/artifact/3d960caa-ef3a-4317-a579-0147cca04d9d)
- **Test plan:** [TEST_PLAN.md](TEST_PLAN.md)
- **Learning notes:** [learning/](learning/)
- **Live game:** https://hotel-tycoon.vercel.app (Vercel project `hotel-tycoon`, root directory `hotel-tycoon/`)

## Where the game stands (2026-10-09)

The current build is a polished sandbox with staff from minute one. It is closer to the spec's "Hotel" era than to Day One.

| Spec area | Status | Notes |
| --- | --- | --- |
| 3D cutaway hotel, city block, day/night | Done | Clay-render look, HQ/MQ/LQ quality switch |
| Guests: arrive, queue, check in, stay, amenities, leave | Done | Taxi or on foot; patience and walk-outs |
| Room tiers and amenities | Done | Cozy, Deluxe, Suite; Restaurant, Bar, Spa |
| Build, demolish, upgrade, add floors, widen | Done | |
| Pricing, end-of-day report, goals | Done | |
| Save | Partial | `localStorage`, one slot; versioned format (v2) that loads v1 saves |
| Deterministic simulation | Done | Pure object-oriented `src/sim` (`Game`, `Building`, `Guest`, …); golden-master tests pin its behaviour |
| Owner avatar, energy, manual tasks | Partial | Avatar walks the building, works the desk and cleans rooms; energy 100, refills at midnight, slow when tired. Other chores (check-out, restock, fix, complaints) next |
| First-hire moment, staff traits | Not started | Game starts with 1 housekeeper + 1 receptionist |
| Breakdowns, complaints | Not started | |
| Character asset stack | Done | Quaternius Modular: 10 outfits, rigged and animated in the game |
| Accounts and cloud saves | Not started | |
| Tests and CI | Done | See TEST_PLAN.md |

## M1 — The Inn (vertical slice)

Gate: playtesters ask to keep playing past Day 3.

- [x] Safety net: seeded RNG, unit tests, browser smoke tests, CI workflow
- [x] Character lab (`?lab`): KayKit lobby, today's people, slots for each candidate pack
- [x] Install Kenney Mini Characters and Quaternius Modular in the lab (`scripts/import-characters.sh`)
- [x] Pick one family, record the choice in `ASSETS.md`, swap it into the game (Quaternius)
- [x] Extract the simulation into a pure module: `Game.create(seed)`, `game.simulateMinutes(m)`, `game.apply(intent)`; no `window`, `localStorage` or `performance` inside (`src/sim`, enforced by a test)
- [x] Owner avatar: walks the building, click a task to send them there (work the desk, clean a room)
- [ ] Energy bar (done) and the Day 1 numbers from the spec (start $1,500, 6 rooms, 2 broken)
- [ ] Manual tasks: check-in, check-out, hold-to-clean, restock, fix breakdown, complaint dialogue
- [ ] First hire: candidate at dawn on Day 2, "Delegated" stamp, step back in any time
- [x] Save schema version + migration from the current `hotel-tycoon-save-v1` (format v2; a real v1 save is a test fixture)
- [ ] Guest accounts with cloud saves (provider decision pending)
- [ ] Playtest with 5–10 people, tune numbers, record results below

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-09 | All simulation randomness goes through a seeded RNG whose state is saved | Replays, tests and later server validation need identical results from identical inputs |
| 2026-10-09 | Smoke tests drive the game through `window.hotel` | Clicking a 3D canvas is brittle; the hook tests the real build without pixel hunting |
| 2026-10-09 | CI must be green before any deploy | The user asked for every deploy to be safe |
| 2026-10-09 | KayKit props are committed to the repo | CC0 allows it, they total about 400 KB, and builds should not depend on a download at deploy time |
| 2026-10-09 | Deploy to the existing Vercel project; build settings pinned in `vercel.json` | Same host as before; settings in the repo are reviewable and survive dashboard edits |
| 2026-10-09 | Both character candidate packs are committed, Quaternius slimmed to 4 outfits as GLB | Picking by eye needs them in the real lobby; 6.3 MB total is acceptable until one is dropped |
| 2026-10-09 | Quaternius Modular chosen for all people; Kenney removed | The user preferred its look; CC0 |
| 2026-10-09 | Each outfit is merged to one skinned mesh with vertex colours, then meshopt-compressed | Up to 140 people on screen: 1 draw call each instead of ~10, and 2.3 MB for 10 outfits instead of 1.2 MB each |
| 2026-10-09 | Capsule people stay as the fallback while the models load | The game is playable immediately on slow connections |
| 2026-10-09 | Simulation is object-oriented: one class per concept (`Game`, `Building`, `Room`, `Guest`, `Housekeeper`, `Reception`, `Arrivals`, `Ledger`, `Goals`, `Population`, `Random`) | The user asked for modular, OOP code that is easy to optimise; each part can now be measured and replaced alone |
| 2026-10-09 | Hot loops stay allocation-light: agents get every field in the constructor (one object shape), `Random` is inlined, `Population` indexes ids | Classes must not cost frame time; GC pauses show up as stutter |
| 2026-10-09 | Behaviour is pinned by a golden master (`tests/unit/fixtures/golden.json`) | Refactors must change nothing; any intended rule change updates the fixture on purpose |
| 2026-10-09 | `engine.js` stays as a thin facade with the old function API | The UI, tests and trailer keep working; views can move to the classes gradually |
| 2026-10-09 | The owner is its own `Owner` agent with the fixed id `'owner'`, outside the guest/staff population | Keeps every existing agent id and replay identical; old saves gain an owner on load |
| 2026-10-09 | Owner chores for now: work the desk (an extra desk, 3 energy per check-in) and clean a room (8 energy); staff still start hired | The spec's "step back in on any chore"; the staff-free Day 1 comes with the Day 1 numbers step |

## Progress log

Newest first.

| Date | Change |
| --- | --- |
| 2026-10-10 | Phones: the "You" card no longer covers the hotel. It starts folded into a small chip (energy + what you're doing), opens on tap, folds itself away after you pick a chore, and remembers your choice. Desktop can fold it too |
| 2026-10-09 | Owner avatar: you walk the hotel in an orange shirt with a ring at your feet. "You" card with energy bar and Work the desk / Leave the desk; "Clean it yourself" on dirty rooms. Energy 100, refills at midnight, half speed and slower cleaning below 20. The reception desk gained the owner's post. 10 owner unit tests, a third golden scenario, and a browser test that drives the buttons |
| 2026-10-09 | Simulation rewritten as object-oriented classes in `src/sim` with identical behaviour (golden master over 13 scripted game days, and a real v1 save continues exactly as the old engine did). Save format v2. `game.apply(intent)` command entry point. Benchmark: same speed as before, ~33 ms per busy simulated day |
| 2026-10-09 | Deployed commit 7dba62c (Quaternius people) to production. First smoke run there: 2 of 10 timed out in software WebGL on the cold first model download; both passed on re-run, then a full run passed 10/10 |
| 2026-10-09 | Quaternius people in the game: guests, VIPs, housekeepers and receptionists are rigged characters that walk, run (at high game speed), clean and idle. 10 outfits, one draw call each. Reception desk now centred over the receptionists, and the housekeeping cart no longer overlaps receptionist #1. Kenney pack removed; lab shows every outfit |
| 2026-10-09 | Deployed commit aa30c73 (character packs) to production on Vercel (READY in about 15 s); all 10 smoke tests pass against hotel-tycoon.vercel.app |
| 2026-10-09 | Installed Kenney Mini Characters (6 GLBs) and Quaternius Modular Men + Women (4 outfits, slimmed to GLB, pistol removed) in the lab, via `scripts/import-characters.sh`. Asset test now also checks external textures and that each model has the manifest's idle and walk clips |
| 2026-10-09 | Character lab at `?lab`: lobby from KayKit Furniture + Restaurant Bits (CC0, imported from GitHub), today's people for comparison, manifest-driven slots for candidate packs. Asset-existence unit tests and a lab smoke test. `ASSETS.md` added |
| 2026-10-09 | Deployed commit 62c0719 to production on Vercel (build READY in about 20 s). Added `vercel.json` and a post-deploy smoke workflow |
| 2026-10-09 | Added seeded RNG (`src/game/rng.js`), `newGame`, `simulateMinutes`, `loadGame` hooks; 17 unit tests; 4 browser smoke tests × desktop and mobile; GitHub Actions workflow; fixed missing favicon (404 on every load) |
