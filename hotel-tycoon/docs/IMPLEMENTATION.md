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
| Save | Partial | `localStorage` only, one slot, no schema version |
| Deterministic simulation | Partial | Seeded RNG added; engine is still a module singleton, not `packages/sim` |
| Owner avatar, energy, manual tasks | Not started | Core of M1 |
| First-hire moment, staff traits | Not started | Game starts with 1 housekeeper + 1 receptionist |
| Breakdowns, complaints | Not started | |
| Character asset stack | In progress | Both candidate packs installed in the lab; family not picked yet |
| Accounts and cloud saves | Not started | |
| Tests and CI | Done | See TEST_PLAN.md |

## M1 — The Inn (vertical slice)

Gate: playtesters ask to keep playing past Day 3.

- [x] Safety net: seeded RNG, unit tests, browser smoke tests, CI workflow
- [x] Character lab (`?lab`): KayKit lobby, today's people, slots for each candidate pack
- [x] Install Kenney Mini Characters and Quaternius Modular in the lab (`scripts/import-characters.sh`)
- [ ] Pick one family, record the choice in `ASSETS.md`, swap it into the game
- [ ] Extract the simulation into a pure module: `createGame(seed)`, `step(game, minutes)`, `apply(game, intent)`; no `window`, `localStorage` or `performance` inside
- [ ] Owner avatar: walks the building, click a task to send them there
- [ ] Energy bar and the Day 1 numbers from the spec (start $1,500, 6 rooms, 2 broken)
- [ ] Manual tasks: check-in, check-out, hold-to-clean, restock, fix breakdown, complaint dialogue
- [ ] First hire: candidate at dawn on Day 2, "Delegated" stamp, step back in any time
- [ ] Save schema version + migration from the current `hotel-tycoon-save-v1`
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

## Progress log

Newest first.

| Date | Change |
| --- | --- |
| 2026-10-09 | Deployed commit aa30c73 (character packs) to production on Vercel (READY in about 15 s); all 10 smoke tests pass against hotel-tycoon.vercel.app |
| 2026-10-09 | Installed Kenney Mini Characters (6 GLBs) and Quaternius Modular Men + Women (4 outfits, slimmed to GLB, pistol removed) in the lab, via `scripts/import-characters.sh`. Asset test now also checks external textures and that each model has the manifest's idle and walk clips |
| 2026-10-09 | Character lab at `?lab`: lobby from KayKit Furniture + Restaurant Bits (CC0, imported from GitHub), today's people for comparison, manifest-driven slots for candidate packs. Asset-existence unit tests and a lab smoke test. `ASSETS.md` added |
| 2026-10-09 | Deployed commit 62c0719 to production on Vercel (build READY in about 20 s). Added `vercel.json` and a post-deploy smoke workflow |
| 2026-10-09 | Added seeded RNG (`src/game/rng.js`), `newGame`, `simulateMinutes`, `loadGame` hooks; 17 unit tests; 4 browser smoke tests × desktop and mobile; GitHub Actions workflow; fixed missing favicon (404 on every load) |
