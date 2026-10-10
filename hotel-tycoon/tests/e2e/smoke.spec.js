import { expect, test } from '@playwright/test'

// Collects console errors and uncaught exceptions so any test can assert none happened.
function watchErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  return errors
}

async function openGame(page) {
  await page.goto('./')
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForFunction(() => window.hotel && window.__renderer)
  // wait until the 3D scene has drawn at least one frame
  await page.waitForFunction(() => window.__renderer.info.render.frame > 2, null, { timeout: 30_000 })
  // the rigged characters have loaded and replaced the capsule stand-ins, then a few more frames
  await page.waitForFunction(() => window.hotel.peopleReady, null, { timeout: 30_000 })
  const f = await page.evaluate(() => window.__renderer.info.render.frame)
  await page.waitForFunction((n) => window.__renderer.info.render.frame > n + 2, f, { timeout: 30_000 })
}

test('loads, renders the 3D scene and shows the HUD without errors', async ({ page }) => {
  const errors = watchErrors(page)
  await openGame(page)
  await expect(page.locator('header.nav')).toContainText('Day 1', { timeout: 20_000 })
  const drawCalls = await page.evaluate(() => window.__renderer.info.render.calls)
  expect(drawCalls).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('a full day runs and ends with the day report', async ({ page }) => {
  const errors = watchErrors(page)
  await openGame(page)
  const snap = await page.evaluate(() => {
    window.hotel.simulateMinutes(1440)
    return window.hotel.snapshot()
  })
  expect(snap.day).toBe(2)
  expect(snap.totals.guests).toBeGreaterThan(0)
  expect(Number.isFinite(snap.money)).toBe(true)
  // The HUD syncs from the engine every few frames; software WebGL in CI can be slow.
  await expect(page.locator('header.nav')).toContainText('Day 2', { timeout: 20_000 })
  await expect(page.getByText('Day 1 complete')).toBeVisible({ timeout: 20_000 })
  expect(errors).toEqual([])
})

test('progress survives a page reload', async ({ page }) => {
  await openGame(page)
  const built = await page.evaluate(() => window.hotel.buildRoom(1, 2, 'standard'))
  expect(built).toBe(true)
  await page.reload()
  await openGame(page)
  const rooms = await page.evaluate(() => window.hotel.snapshot().totalRooms)
  expect(rooms).toBe(3)
})

test('no horizontal page scroll', async ({ page }) => {
  await openGame(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('the owner takes chores from the HUD', async ({ page }) => {
  const errors = watchErrors(page)
  await openGame(page)
  await page.getByRole('button', { name: 'Open the doors' }).click()
  // phones show the folded chip first
  const chip = page.getByRole('button', { name: 'Show your owner card' })
  if (await chip.isVisible()) await chip.click()
  await page.getByRole('button', { name: /Work the desk/ }).click()
  await expect.poll(() => page.evaluate(() => window.hotel.game.owner.task?.kind)).toBe('desk')
  if (await chip.isVisible()) await chip.click() // folded itself away on the phone
  await expect(page.getByRole('button', { name: 'Leave the desk' })).toBeVisible()
  // make a room dirty with no housekeeper free, select it, and clean it yourself
  await page.evaluate(() => {
    const g = window.hotel.game
    g.staff.housekeeper = 0
    g.syncStaff()
    Object.assign(g.rooms['1-1'], { status: 'dirty', guestId: null, cleanBy: null })
    window.hotel.ui.getState().setSelected('1-1')
  })
  await page.getByRole('button', { name: /Clean it yourself/ }).click()
  await expect.poll(() => page.evaluate(() => window.hotel.game.rooms['1-1'].cleanBy)).toBe('owner')
  await page.evaluate(() => window.hotel.simulateMinutes(180))
  await expect.poll(() => page.evaluate(() => window.hotel.game.rooms['1-1'].status)).toBe('vacant')
  expect(errors).toEqual([])
})

test('character lab loads every asset without errors', async ({ page }) => {
  const errors = watchErrors(page)
  const missing = []
  page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`) })
  await page.goto('./?lab')
  await expect(page.getByRole('heading', { name: 'Character lab' })).toBeVisible()
  // one label for the old capsules, one for the outfits
  await page.waitForFunction(() => document.querySelectorAll('.lab-label').length >= 2, null, { timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  expect(missing).toEqual([])
  expect(errors).toEqual([])
})
