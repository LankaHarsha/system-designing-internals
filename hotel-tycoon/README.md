# Hotel Tycoon

A hotel management strategy game built with **React**, **React Three Fiber** and **drei**. It has a bright, clay-render style: a cutaway hotel set in a small city block with streets, traffic, a parking lot and a pool garden, plus a dashboard UI.

Run a tiny hotel, keep the lobby queue moving, keep rooms clean, and grow it into a tower.

## Run it

```bash
cd hotel-tycoon
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
npm test         # unit tests
npm run check    # unit tests + build + browser smoke tests (the deploy gate)
```

## Docs

- [Implementation tracker](docs/IMPLEMENTATION.md): what is built, what is next, decisions, progress log
- [Test plan](docs/TEST_PLAN.md): test layers, how to run them, rules for new code
- [Learning notes](docs/learning/): concepts explained as we meet them
- [Third-party assets](ASSETS.md): every pack we ship, its licence and source

Open the game with `?lab` (for example `http://localhost:5173/?lab`) for the character lab: one lobby with every character outfit beside the old capsule people.

## How to play

- **Guests** arrive by taxi or on foot, queue at reception and get the free room that best matches what they want. They pay on check-in.
- **Rooms**: Cozy Room, Deluxe Room and Royal Suite. A better star rating brings guests who want fancier rooms (see *Staff & Prices → Who is arriving*). Selected rooms can be upgraded.
- **Housekeeping**: after check-out a room is dirty and can't be sold until a housekeeper cleans it.
- **Reception**: each receptionist opens another check-in desk. Guests who wait too long walk out and hurt your rating.
- **Amenities**: Restaurant, Cocktail Bar and Spa & Pool. Guests visit them during their stay, spend money and get happier. The restaurant is busiest at mealtimes, the bar after dark.
- **Prices**: the price slider trades revenue per stay against demand and guest satisfaction.
- **Expand**: add floors (up to 10) and widen the building (up to 7 rooms per floor).
- **Economy**: wages and upkeep are charged at midnight, and an end-of-day report shows how you did.
- **Goals** pay cash rewards. Progress autosaves to `localStorage`.

Controls: drag to orbit, right-drag or two fingers to pan, scroll to zoom, or use the map controls on the right. Search a room number in the nav bar, or click a row in the rooms board, to fly the camera to that room. `Space` pauses, `1`/`2`/`3` set the speed and `Esc` cancels build mode.

## Code map

| Path | What it does |
| --- | --- |
| `src/game/engine.js` | Simulation: guests, queue, desks, housekeepers, amenities, economy, goals, save/load. Plain mutable state, stepped every frame. |
| `src/game/rng.js` | Seeded random numbers; the state is saved with the game so runs replay exactly |
| `src/game/constants.js` | Room/staff definitions, costs, world dimensions |
| `src/game/store.js` | Zustand store: a UI snapshot synced from the engine about 5 times a second, plus tool and selection state |
| `src/scene/Hotel.jsx` | The cutaway building, lobby, elevator, roof sign and the clickable room slots |
| `src/scene/Furniture.jsx` | Low-poly furniture for each room type |
| `src/scene/Agents.jsx` | All guests and staff, drawn with instanced meshes |
| `src/scene/Environment.jsx` | City block (roads, parking, pool garden, neighbouring buildings), traffic, taxis, day/night lighting |
| `src/scene/Scene.jsx` | Camera rig and map-control API, game loop, floating money text, post-processing (AO, bloom) |
| `src/ui/HUD.jsx` | Nav bar, KPI cards, tool rail and flyouts, room detail panel, map controls, guest-journey stepper, rooms/staff board, modals |
| `src/ui/Icon.jsx` | Inline SVG icon set |
| `src/lab/` | Character lab (`?lab`): KayKit lobby, rigged-character loader, today's people for comparison |
| `scripts/import-kaykit.sh` | Copies the KayKit props we use from KayKit's GitHub repos |
| `tests/unit/` | Vitest tests for the game rules |
| `tests/e2e/` | Playwright smoke tests against the built game |

The `HQ`/`MQ`/`LQ` button in the corner switches graphics quality. Low quality turns off post-processing for slower devices.
