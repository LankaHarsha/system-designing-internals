# 02: Testing a 3D browser game

> Test the rules where they are cheap (plain functions), and test the whole game where it is real (a real browser on the real build). Skip the expensive middle: pixel-clicking the canvas.

## 0. The testing pyramid, for this game

```
        playtest            people: is it fun?           per milestone
      browser smoke         Playwright, real build        ~2 min, every push
     unit tests (rules)     Vitest, Node, no browser      ~1 s, every push
```

Most bugs in a tycoon game are **rule bugs** (wrong cost, money goes NaN, a guest stuck in a room). Those are caught fastest at the bottom. The smoke layer only has to prove the whole thing *boots and runs* in a browser.

## 1. Unit tests: invariants beat examples

An example test says "building a room costs $600". An **invariant test** says "at every hour of a 10-day run, money is a finite number, the queue never exceeds its cap and every occupied room points at a guest who exists". One invariant test explores thousands of states that nobody would think to write by hand. With a seeded RNG, any failure replays exactly.

## 2. Browser tests without clicking pixels

A `<canvas>` has no DOM buttons inside it, so `click('Build room')` cannot work. Instead, `main.jsx` exposes the engine on `window.hotel`, and tests drive the game through it:

```js
await page.evaluate(() => window.hotel.simulateMinutes(1440)) // fast-forward a day
await expect(page.locator('header.nav')).toContainText('Day 2')
```

This still exercises the real production bundle, real React HUD and real WebGL renderer. We check WebGL actually drew through `window.__renderer.info.render.calls > 0`.

## 3. WebGL in headless CI

CI machines have no GPU. Chromium can fall back to **SwiftShader**, a CPU implementation of the GPU. Flags in `playwright.config.js`:

```
--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
```

Cost: rendering is slow, often a few frames per second at high quality.

## 4. Gotcha we hit: the HUD updates per frame, not per tick

The day test failed only on desktop. The engine had reached Day 2, but the HUD still said Day 1. The HUD copies engine state every 0.2 s *of rendered frames*, and SwiftShader at 1280×800 high quality was slow enough that 5 s was not enough.

Fix: assert on the engine (`snapshot().day === 2`) first, which is the truth, then give the UI a 20 s window to catch up. The lesson: **know which clock each layer runs on** before you write a timeout.

## 5. Gotcha we hit: the test found a real bug

The very first smoke run failed with a console 404. The page had no favicon, so every visit logged an error. Tiny, but it is exactly the kind of thing that hides a real error later. "Zero console errors" is now a test.

## 6. Making deploys safe

- `npm run check` = unit + build + smoke. Green means deployable.
- GitHub Actions runs it on every push and PR touching `hotel-tycoon/`.
- After a deploy, run the same smoke specs against the live URL (`BASE_URL=...`), so we test what users get, not just what we built.
