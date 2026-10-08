// Virtual clock: time only moves when the recorder calls __tick(ms), and each tick renders exactly one frame.
(() => {
  let now = 0
  const start = Date.now()
  let queue = []
  let id = 1e7 // keep fake ids clear of real rAF ids
  const realPerf = performance.now.bind(performance)
  let live = true // until recording starts, behave like a normal page
  performance.now = () => (live ? realPerf() : now)
  Date.now = () => start + (live ? realPerf() : now)
  const realRaf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => {
    if (live) return realRaf(cb)
    queue.push({ id: ++id, cb })
    return id
  }
  const realCancel = window.cancelAnimationFrame.bind(window)
  window.cancelAnimationFrame = (h) => { queue = queue.filter((q) => q.id !== h); try { realCancel(h) } catch {} }
  window.__freeze = () => { now = realPerf(); live = false }
  // Wait for the render loop to ask for its next frame, then run exactly that frame.
  window.__tick = async (ms) => {
    let waited = 0
    for (; waited < 600 && !queue.length; waited++) await new Promise((r) => setTimeout(r, 10))
    now += ms
    const q = queue
    queue = []
    const t = realPerf()
    for (const { cb } of q) cb(now)
    window.__lastTick = { n: q.length, waited, ms: Math.round(realPerf() - t) }
    return q.length
  }
})()
