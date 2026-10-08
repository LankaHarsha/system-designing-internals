// Runs inside the game page. Drives camera, gameplay beats and overlay text frame by frame.
(() => {
  const H = window.hotel
  const FPS = window.__FPS || 30
  const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t))
  const lerp = (a, b, t) => a + (b - a) * t
  const clamp01 = (t) => Math.max(0, Math.min(1, t))
  const g = () => H.game
  const lw = () => g().width * 4
  const topY = () => (g().floors + 1) * 3

  // ------------------------------------------------------------ overlay
  const css = `
  #tr { position: fixed; inset: 0; pointer-events: none; z-index: 9999; font-family: Inter, system-ui, sans-serif; color: #1d2433; }
  #tr .scrim { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(255,255,255,.72), rgba(236,241,250,.88)); }
  #tr .title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; }
  #tr .mark { width: 120px; height: 120px; border-radius: 32px; display: grid; place-items: center; background: linear-gradient(145deg,#ff8a5c,#f2552f); box-shadow: 0 24px 60px rgba(255,106,69,.45); }
  #tr .mark svg { width: 64px; height: 64px; }
  #tr h1 { margin: 0; font-size: 104px; font-weight: 800; letter-spacing: -4px; }
  #tr .tag { font-size: 34px; font-weight: 500; color: #4a5468; letter-spacing: -0.5px; }
  #tr .cap { position: absolute; left: 96px; bottom: 96px; display: flex; flex-direction: column; gap: 14px; }
  #tr .chip { align-self: flex-start; background: #ff6a45; color: #fff; font-weight: 700; font-size: 20px; letter-spacing: 1.5px; padding: 8px 16px; border-radius: 10px; text-transform: uppercase; box-shadow: 0 10px 30px rgba(255,106,69,.4); }
  #tr .line { font-size: 64px; font-weight: 800; letter-spacing: -2px; line-height: 1.05; max-width: 1200px;
    background: rgba(255,255,255,.92); padding: 18px 28px 22px; border-radius: 22px; box-shadow: 0 20px 60px rgba(20,30,60,.18); }
  #tr .cap.top { left: 50%; bottom: auto; top: 200px; margin-left: -330px; align-items: flex-start; }
  #tr .cap.top .line { font-size: 52px; }
  #tr .cap.top .sub { background: rgba(255,255,255,.92); padding: 10px 18px; border-radius: 12px; font-size: 22px; box-shadow: 0 10px 30px rgba(20,30,60,.12); }
  #tr .sub { font-size: 26px; color: #4a5468; font-weight: 500; padding-left: 6px; text-shadow: 0 1px 0 rgba(255,255,255,.8); }
  #tr .night .sub { color: #e7ebf7; text-shadow: 0 2px 8px rgba(0,0,0,.4); }
  #tr .url { margin-top: 18px; display: flex; align-items: center; gap: 14px; background: #1d2433; color: #fff; font-size: 34px; font-weight: 600; padding: 18px 30px; border-radius: 18px; box-shadow: 0 20px 50px rgba(29,36,51,.35); }
  #tr .url i { width: 14px; height: 14px; border-radius: 50%; background: #22a565; box-shadow: 0 0 0 6px rgba(34,165,101,.25); }
  #tr .built { font-size: 20px; color: #8a93a6; font-weight: 500; margin-top: 6px; }
  #tr .pills { display: flex; gap: 12px; }
  #tr .pill { background: #fff; border: 1px solid #e8ecf3; padding: 10px 18px; border-radius: 12px; font-size: 22px; font-weight: 600; color: #4a5468; box-shadow: 0 6px 18px rgba(20,30,60,.08); }
  `
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  const root = document.createElement('div')
  root.id = 'tr'
  const logo = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>'
  root.innerHTML = `
    <div class="scrim" id="tr-scrim"></div>
    <div class="title" id="tr-title"><div class="mark">${logo}</div><h1>Hotel Tycoon</h1><div class="tag">Build the hotel everyone is talking about.</div></div>
    <div class="cap" id="tr-cap"><div class="chip" id="tr-chip"></div><div class="line" id="tr-line"></div><div class="sub" id="tr-sub"></div></div>
    <div class="title" id="tr-end"><div class="mark">${logo}</div><h1>Hotel Tycoon</h1>
      <div class="pills"><span class="pill">Build rooms</span><span class="pill">Hire staff</span><span class="pill">Set prices</span><span class="pill">Grow a skyline</span></div>
      <div class="url"><i></i>Play free · hotel-tycoon.vercel.app</div>
      <div class="built">Runs in your browser · Built with React Three Fiber</div></div>`
  document.body.appendChild(root)
  const $ = (id) => document.getElementById(id)
  const hud = document.querySelector('.hud')

  function setFade(el, a, dy = 0) {
    el.style.opacity = a
    el.style.transform = `translateY(${dy}px)`
  }
  function caption(t, inT, outT, chip, line, sub) {
    const a = clamp01((t - inT) / 0.45) * clamp01((outT - t) / 0.35)
    $('tr-chip').textContent = chip
    $('tr-line').textContent = line
    $('tr-sub').textContent = sub
    const k = ease(clamp01((t - inT) / 0.6))
    setFade($('tr-cap'), a, (1 - k) * 40)
  }

  // ------------------------------------------------------------ scene helpers
  function orbit(target, r, h, ang) {
    H.cam.set([target[0] + Math.sin(ang) * r, target[1] + h, target[2] + Math.cos(ang) * r], target)
  }
  const once = new Set()
  function at(f, frame, key, fn) {
    if (f >= frame && !once.has(key)) { once.add(key); fn() }
  }
  const TYPES = ['standard', 'deluxe', 'suite', 'standard', 'deluxe', 'restaurant', 'bar', 'standard', 'suite', 'spa', 'deluxe']
  let typeI = 0
  function fillEmpty(maxCount) {
    let n = 0
    for (let fl = 1; fl <= g().floors; fl++) for (let s = 0; s < g().width; s++) {
      if (n >= maxCount) return
      if (!g().rooms[`${fl}-${s}`]) { H.buildRoom(fl, s, TYPES[typeI++ % TYPES.length]); n++ }
    }
  }
  function spawnSoon(n = 1) { g().spawnAcc += n }

  // ------------------------------------------------------------ timeline (seconds)
  const S = { title: 4.5, arrive: 10.5, build: 16.5, grow: 22, night: 28, pro: 33.5, end: 39 }
  window.__TRAILER_LEN = S.end

  window.__setup = () => {
    window.__camLocked = true
    g().money = 250000
    g().speed = 1
    g().minute = 8 * 60 + 30
    g().rating = 4.1
    H.hire('housekeeper')
    H.hire('receptionist')
    H.buildRoom(1, 2, 'deluxe')
    // warm up so the street and lobby already feel alive
    for (let i = 0; i < 120; i++) H.step(0.1)
    g().minute = 8 * 60 + 30
    g().floaters.length = 0
    g().toasts.length = 0
  }

  // CSS animations run on wall-clock time; pin them to the virtual clock instead.
  function syncAnimations() {
    const now = performance.now()
    for (const a of document.getAnimations()) {
      if (a.__vs === undefined) { a.__vs = now; a.pause() }
      a.currentTime = now - a.__vs
    }
  }

  window.__frame = (f) => {
    syncAnimations()
    const t = f / FPS
    hud.style.opacity = 0
    $('tr-scrim').style.opacity = 0
    setFade($('tr-title'), 0)
    setFade($('tr-end'), 0)
    setFade($('tr-cap'), 0)
    $('tr-cap').classList.toggle('night', false)
    g().toasts.length = 0
    // keep the trailer upbeat: drop "no vacancy" style complaints
    for (let i = g().floaters.length - 1; i >= 0; i--) if (!/^\+/.test(g().floaters[i].text)) g().floaters.splice(i, 1)
    const cx = (lw() - 2.4) / 2

    if (t < S.title) {
      // aerial establishing shot with the title card
      const k = t / S.title
      orbit([cx, 2, 0], 70 - k * 8, 46 - k * 6, -0.9 + k * 0.35)
      const a = clamp01((t - 0.3) / 0.6) * clamp01((S.title - 0.2 - t) / 0.6)
      $('tr-scrim').style.opacity = a * 0.9
      setFade($('tr-title'), a, (1 - ease(clamp01((t - 0.3) / 0.8))) * 30)
    } else if (t < S.arrive) {
      // street-level push toward the entrance as taxis pull in
      const k = ease((t - S.title) / (S.arrive - S.title))
      const ex = lw() - 1.7
      H.cam.set([lerp(ex + 9, ex + 4, k), lerp(2.8, 3.6, k), lerp(23, 17, k)], [lerp(ex - 1, ex - 3, k), lerp(1.6, 2.2, k), 3])
      at(f, Math.round(S.title * FPS) + 2, 'spawn1', () => spawnSoon(1))
      at(f, Math.round((S.title + 1.3) * FPS), 'spawn2', () => spawnSoon(1))
      at(f, Math.round((S.title + 2.6) * FPS), 'spawn3', () => spawnSoon(1))
      caption(t, S.title + 0.3, S.arrive - 0.2, 'Living city', 'Guests arrive by taxi and on foot', 'Every guest queues, checks in and finds their room.')
    } else if (t < S.build) {
      // front view while rooms pop in one by one
      const k = ease((t - S.title - 6) / 6)
      at(f, Math.round((S.arrive + 0.3) * FPS), 'floor2', () => H.addFloor())
      for (let i = 0; i < 5; i++) at(f, Math.round((S.arrive + 0.9 + i * 0.9) * FPS), `b${i}`, () => fillEmpty(1))
      const tgt = [cx + 1, 3.6, 0]
      orbit(tgt, lerp(26, 22, k), lerp(9, 8, k), lerp(0.55, 0.3, k))
      caption(t, S.arrive + 0.3, S.build - 0.2, 'Build', 'Design every floor', 'Cozy rooms, deluxe suites, restaurants, bars and a spa.')
    } else if (t < S.grow) {
      // the hotel grows into a tower; the camera rises with it
      const k = ease((t - S.build) / (S.grow - S.build))
      for (let i = 0; i < 5; i++) {
        at(f, Math.round((S.build + 0.2 + i * 0.95) * FPS), `fl${i}`, () => { H.addFloor(); fillEmpty(4) })
      }
      at(f, Math.round((S.build + 2.6) * FPS), 'widen', () => { H.widen(); fillEmpty(8) })
      const tgt = [cx + 1, lerp(5, topY() * 0.45, k), 0]
      orbit(tgt, lerp(38, 62, k), lerp(16, 30, k), lerp(-0.2, 0.45, k))
      caption(t, S.build + 0.3, S.grow - 0.2, 'Grow', 'From corner inn to skyline', 'Add floors, widen the building and fill it with guests.')
    } else if (t < S.night) {
      // timelapse into night: the rooms light up
      at(f, Math.round(S.grow * FPS), 'dusk', () => { g().minute = 17 * 60 + 45; g().speed = 4; fillEmpty(20); spawnSoon(3) })
      H.step(0.016)
      const k = (t - S.grow) / (S.night - S.grow)
      const tgt = [cx + 1, topY() * 0.42, 0]
      orbit(tgt, 58, 18, 0.75 - k * 0.9)
      $('tr-cap').classList.toggle('night', k > 0.45)
      caption(t, S.grow + 0.4, S.night - 0.2, 'Day & night', 'The lights come on after dark', 'Bars fill up, taxis glow, the city keeps moving.')
    } else if (t < S.pro) {
      // the manager's dashboard
      at(f, Math.round(S.night * FPS), 'day', () => {
        g().minute = 11 * 60
        g().speed = 1
        g().rating = 4.6
        g().today.lost = 0
        g().today.missed = 0
        H.ui.getState().setSelected('3-1')
      })
      at(f, Math.round((S.night + 2.4) * FPS), 'staff', () => H.ui.setState({ rail: 'staff' }))
      hud.style.opacity = 1
      const k = ease((t - S.night) / (S.pro - S.night))
      const tgt = [cx + 2, topY() * 0.4, 1]
      orbit(tgt, lerp(60, 54, k), lerp(34, 30, k), lerp(0.6, 0.5, k))
      caption(t, S.night + 0.3, S.pro - 0.2, 'Manage', 'Run it like a pro', 'Hire staff, set prices and watch every guest in real time.')
      $('tr-cap').classList.add('top')
    } else {
      // end card
      H.ui.setState({ rail: null, selected: null })
      $('tr-cap').classList.remove('top')
      const k = (t - S.pro) / (S.end - S.pro)
      orbit([cx + 1, topY() * 0.4, 0], 80, 50, 0.5 - k * 0.4)
      const a = clamp01((t - S.pro) / 0.6)
      $('tr-scrim').style.opacity = a * 0.92
      setFade($('tr-end'), a, (1 - ease(clamp01((t - S.pro) / 0.8))) * 30)
    }
  }
})()
