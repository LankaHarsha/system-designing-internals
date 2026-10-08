# Hotel Tycoon

A cozy isometric hotel management strategy game built with **React**, **React Three Fiber** and **drei**.

Run a tiny hotel, keep the lobby queue moving, keep rooms clean, and grow it into a tower.

## Run it

```bash
cd hotel-tycoon
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## How to play

- **Guests** walk in from the street, queue at reception and get the free room that best matches what they want. They pay on check-in.
- **Rooms**: Cozy Room, Deluxe Room and Royal Suite. A better star rating brings guests who want fancier rooms (see *Staff & Prices → Who is arriving*). Selected rooms can be upgraded.
- **Housekeeping**: after check-out a room is dirty and can't be sold until a housekeeper cleans it.
- **Reception**: each receptionist opens another check-in desk. Guests who wait too long walk out and hurt your rating.
- **Amenities**: Restaurant, Cocktail Bar and Spa & Pool. Guests visit them during their stay, spend money and get happier. The restaurant is busiest at mealtimes, the bar after dark.
- **Prices**: the price slider trades revenue per stay against demand and guest satisfaction.
- **Expand**: add floors (up to 10) and widen the building (up to 7 rooms per floor).
- **Economy**: wages and upkeep are charged at midnight, and an end-of-day report shows how you did.
- **Goals** pay cash rewards. Progress autosaves to `localStorage`.

Controls: drag to rotate, right-drag or two fingers to pan, scroll to zoom. `Space` pauses, `1`/`2`/`3` set the speed and `Esc` cancels build mode.

## Code map

| Path | What it does |
| --- | --- |
| `src/game/engine.js` | Simulation: guests, queue, desks, housekeepers, amenities, economy, goals, save/load. Plain mutable state, stepped every frame. |
| `src/game/constants.js` | Room/staff definitions, costs, world dimensions |
| `src/game/store.js` | Zustand store: a UI snapshot synced from the engine about 5 times a second, plus tool and selection state |
| `src/scene/Hotel.jsx` | The cutaway building, lobby, elevator, roof sign and the clickable room slots |
| `src/scene/Furniture.jsx` | Low-poly furniture for each room type |
| `src/scene/Agents.jsx` | All guests and staff, drawn with instanced meshes |
| `src/scene/Environment.jsx` | Floating diorama island, day/night sky and lighting, trees, cars, clouds |
| `src/scene/Scene.jsx` | Camera rig, game loop, floating money text, post-processing (AO, bloom, tilt-shift) |
| `src/ui/HUD.jsx` | Top bar, build bar, panels, goals, toasts, day summary |

The `HQ`/`MQ`/`LQ` button in the corner switches graphics quality. Low quality turns off post-processing for slower devices.
