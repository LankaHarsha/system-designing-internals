// Renders the trailer frame by frame from the real game using a virtual clock.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const W = +(process.env.W || 1920)
const H = +(process.env.H || 1080)
const FPS = +(process.env.FPS || 30)
const Q = process.env.Q || 'high'
const OUT = process.env.OUT || 'frames'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null // preview specific frames
const URL = process.env.URL || 'http://localhost:4173/'

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const ctx = await browser.newContext({ viewport: { width: W, height: H } })
  await ctx.addInitScript((q) => {
    localStorage.clear()
    localStorage.setItem('hotel-tycoon-quality', q)
    localStorage.setItem('hotel-tycoon-seen-help', '1')
  }, Q)
  await ctx.addInitScript({ content: fs.readFileSync(path.join(__dirname, 'vclock.js'), 'utf8') })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  await page.goto(URL)
  await page.waitForTimeout(9000) // fonts, environment map, shaders
  await page.evaluate((fps) => { window.__FPS = fps; window.__freeze() }, FPS)
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'trailer.js'), 'utf8') })
  await page.evaluate(() => window.__setup())
  const total = Math.round((await page.evaluate(() => window.__TRAILER_LEN)) * FPS)
  const last = ONLY ? Math.max(...ONLY) : total - 1
  console.log('frames', total)
  const t0 = Date.now()
  for (let f = 0; f <= last; f++) {
    const a = Date.now()
    await page.evaluate((fr) => window.__frame(fr), f)
    const b = Date.now()
    await page.evaluate((ms) => window.__tick(ms), 1000 / FPS)
    const c = Date.now()
    if (!ONLY || ONLY.includes(f)) {
      await page.screenshot({ path: path.join(OUT, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 })
    }
    const d = Date.now()
    if (process.env.DEBUG) console.log(f, JSON.stringify(await page.evaluate(() => [window.__lastTick, window.__renderer && window.__renderer.info.render.frame, hotel.game.minute])), 'frame', b - a, 'tick', c - b, 'shot', d - c)
    if (f % 30 === 0) {
      const el = (Date.now() - t0) / 1000
      console.log(`frame ${f}/${total} · ${el.toFixed(0)}s elapsed · ${(el / (f + 1)).toFixed(2)}s/frame`)
    }
  }
  await browser.close()
})()
