import { useEffect, useRef, useState } from 'react'
import { useGame, syncUI } from '../game/store'
import {
  game, setSpeed, setPrice, addFloor, widen, hire, fire, demolish, upgradeRoom, upgradeCost, UPGRADES,
  GOALS, demandMix, resetGame,
} from '../game/engine'
import { ROOM_TYPES, STAFF_TYPES, MAX_FLOORS, MAX_WIDTH } from '../game/constants'

const act = (fn) => (...args) => {
  fn(...args)
  syncUI()
}

const fmt = (n) => `$${Math.round(n).toLocaleString()}`

function useAnimatedNumber(value) {
  const [shown, setShown] = useState(value)
  const ref = useRef(value)
  useEffect(() => {
    let raf
    const tick = () => {
      ref.current += (value - ref.current) * 0.18
      if (Math.abs(value - ref.current) < 1) ref.current = value
      setShown(ref.current)
      if (ref.current !== value) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return shown
}

function Stars({ value }) {
  return (
    <span className="stars" title={`${value.toFixed(2)} / 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className="star">
            <span className="star-bg">★</span>
            <span className="star-fg" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        )
      })}
    </span>
  )
}

function Clock({ minute, day }) {
  const h = Math.floor(minute / 60)
  const m = Math.floor(minute % 60)
  const night = h < 6 || h >= 20
  return (
    <div className="chip clock">
      <span className="chip-icon">{night ? '🌙' : h < 8 || h >= 18 ? '🌅' : '☀️'}</span>
      <div>
        <div className="chip-label">Day {day}</div>
        <div className="chip-value">{String(h).padStart(2, '0')}:{String(m - (m % 10)).padStart(2, '0')}</div>
      </div>
    </div>
  )
}

function TopBar() {
  const snap = useGame((s) => s.snap)
  const money = useAnimatedNumber(snap.money)
  const occ = snap.totalRooms ? Math.round((snap.occupied / snap.totalRooms) * 100) : 0
  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-badge">🏨</span>
        <div>
          <div className="brand-title">Hotel Tycoon</div>
          <Stars value={snap.rating} />
        </div>
      </div>
      <div className="chip money">
        <span className="chip-icon">💰</span>
        <div>
          <div className="chip-label">Balance</div>
          <div className={`chip-value ${snap.money < 0 ? 'neg' : ''}`}>{fmt(money)}</div>
        </div>
      </div>
      <Clock minute={snap.minute} day={snap.day} />
      <div className="chip">
        <span className="chip-icon">🛏️</span>
        <div>
          <div className="chip-label">Occupancy</div>
          <div className="chip-value">{snap.occupied}/{snap.totalRooms} <small>{occ}%</small></div>
        </div>
      </div>
      <div className="chip hide-sm">
        <span className="chip-icon">🧍</span>
        <div>
          <div className="chip-label">Guests · Queue</div>
          <div className="chip-value">{snap.guests} · <span className={snap.queue > 5 ? 'warn' : ''}>{snap.queue}</span></div>
        </div>
      </div>
      <div className="speed">
        {[0, 1, 2, 4].map((s) => (
          <button key={s} className={`speed-btn ${snap.speed === s ? 'on' : ''}`} onClick={act(() => setSpeed(s))} title={s ? `${s}x speed` : 'Pause'}>
            {s === 0 ? '❚❚' : '▶'.repeat(s === 4 ? 3 : s)}
          </button>
        ))}
      </div>
    </div>
  )
}

function BuildBar() {
  const tool = useGame((s) => s.tool)
  const setTool = useGame((s) => s.setTool)
  const snap = useGame((s) => s.snap)
  const setPanel = useGame((s) => s.setPanel)
  const panel = useGame((s) => s.panel)
  const pick = (id) => setTool(tool === id ? null : id)
  return (
    <div className="buildbar">
      {tool && (
        <div className="build-hint">
          {tool === 'demolish' ? 'Click a room to demolish it (50% refund)' : `Click an empty slot to build a ${ROOM_TYPES[tool].name}`}
          <button onClick={() => setTool(null)}>Done</button>
        </div>
      )}
      <div className="bar">
        <div className="group">
          <div className="group-title">Rooms</div>
          <div className="cards">
            {['standard', 'deluxe', 'suite'].map((id) => <BuildCard key={id} def={ROOM_TYPES[id]} on={tool === id} money={snap.money} onClick={() => pick(id)} />)}
          </div>
        </div>
        <div className="group">
          <div className="group-title">Amenities</div>
          <div className="cards">
            {['restaurant', 'bar', 'spa'].map((id) => <BuildCard key={id} def={ROOM_TYPES[id]} on={tool === id} money={snap.money} onClick={() => pick(id)} />)}
          </div>
        </div>
        <div className="group">
          <div className="group-title">Expand</div>
          <div className="cards">
            <button className="card" disabled={snap.floors >= MAX_FLOORS} onClick={act(addFloor)}>
              <span className="card-icon">🏗️</span>
              <span className="card-name">Add Floor</span>
              <span className={`card-cost ${snap.money < snap.floorCost ? 'poor' : ''}`}>{snap.floors >= MAX_FLOORS ? 'Max' : fmt(snap.floorCost)}</span>
            </button>
            <button className="card" disabled={snap.width >= MAX_WIDTH} onClick={act(widen)}>
              <span className="card-icon">📐</span>
              <span className="card-name">Widen</span>
              <span className={`card-cost ${snap.money < snap.widenCost ? 'poor' : ''}`}>{snap.width >= MAX_WIDTH ? 'Max' : fmt(snap.widenCost)}</span>
            </button>
            <button className={`card danger ${tool === 'demolish' ? 'on' : ''}`} onClick={() => pick('demolish')}>
              <span className="card-icon">🔨</span>
              <span className="card-name">Demolish</span>
              <span className="card-cost">50% back</span>
            </button>
          </div>
        </div>
        <div className="group">
          <div className="group-title">Manage</div>
          <div className="cards">
            <button className={`card ${panel === 'staff' ? 'on' : ''}`} onClick={() => setPanel('staff')}>
              <span className="card-icon">👥</span>
              <span className="card-name">Staff & Prices</span>
              <span className="card-cost">{snap.staff.housekeeper + snap.staff.receptionist} staff</span>
            </button>
            <button className={`card ${panel === 'stats' ? 'on' : ''}`} onClick={() => setPanel('stats')}>
              <span className="card-icon">📊</span>
              <span className="card-name">Finances</span>
              <span className="card-cost">today {fmt(snap.today.revenue)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BuildCard({ def, on, money, onClick }) {
  return (
    <button className={`card ${on ? 'on' : ''}`} onClick={onClick} style={{ '--accent': def.accent, '--wall': def.wall }}>
      <span className="card-icon swatch">{def.icon}</span>
      <span className="card-name">{def.name}</span>
      <span className={`card-cost ${money < def.cost ? 'poor' : ''}`}>{fmt(def.cost)}</span>
      <span className="card-tip">
        <b>{def.name}</b>
        <br />
        {def.desc}
        <br />
        {def.kind === 'room' ? `Earns ${fmt(def.price)}/stay` : `Guests spend ~${fmt(def.spend)}`} · upkeep {fmt(def.upkeep)}/day
      </span>
    </button>
  )
}

function StaffPanel() {
  const snap = useGame((s) => s.snap)
  const setPanel = useGame((s) => s.setPanel)
  const mix = demandMix(snap.rating)
  const pct = Math.round(snap.priceMult * 100)
  return (
    <div className="panel right">
      <div className="panel-head">
        <h3>👥 Staff & Prices</h3>
        <button className="x" onClick={() => setPanel('staff')}>✕</button>
      </div>
      {Object.values(STAFF_TYPES).map((s) => (
        <div key={s.id} className="staff-row">
          <span className="staff-icon">{s.icon}</span>
          <div className="staff-info">
            <b>{s.name}s</b>
            <small>{fmt(s.wage)}/day each · hire {fmt(s.hire)}</small>
            <small className="muted">{s.id === 'housekeeper' ? 'Clean dirty rooms after check-out' : 'Each opens another check-in desk'}</small>
          </div>
          <div className="stepper">
            <button onClick={act(() => fire(s.id))}>−</button>
            <span>{snap.staff[s.id]}</span>
            <button onClick={act(() => hire(s.id))} disabled={snap.staff[s.id] >= s.max}>+</button>
          </div>
        </div>
      ))}
      <div className="divider" />
      <div className="price">
        <div className="price-head">
          <b>💲 Room prices</b>
          <span className={pct > 115 ? 'warn' : pct < 90 ? 'good' : ''}>{pct}%</span>
        </div>
        <input type="range" min="0.6" max="1.8" step="0.05" value={snap.priceMult} onChange={(e) => { setPrice(parseFloat(e.target.value)); syncUI() }} />
        <small className="muted">Higher prices earn more per stay but bring fewer guests and lower satisfaction.</small>
        <div className="price-list">
          {['standard', 'deluxe', 'suite'].map((id) => (
            <span key={id}>{ROOM_TYPES[id].icon} {fmt(ROOM_TYPES[id].price * snap.priceMult)}</span>
          ))}
        </div>
      </div>
      <div className="divider" />
      <b>📈 Who is arriving</b>
      <small className="muted">A better rating attracts guests who want fancier rooms.</small>
      <div className="mix">
        {['standard', 'deluxe', 'suite'].map((id, i) => (
          <div key={id} className="mix-seg" style={{ flex: Math.max(0.001, mix[i]), background: ROOM_TYPES[id].accent }}>
            {mix[i] > 0.12 && `${Math.round(mix[i] * 100)}%`}
          </div>
        ))}
      </div>
      <div className="mix-legend">
        {['standard', 'deluxe', 'suite'].map((id) => (
          <span key={id}><i style={{ background: ROOM_TYPES[id].accent }} />{ROOM_TYPES[id].name}</span>
        ))}
      </div>
    </div>
  )
}

function StatsPanel() {
  const snap = useGame((s) => s.snap)
  const setPanel = useGame((s) => s.setPanel)
  const history = game.history.slice(-10)
  const max = Math.max(1, ...history.map((h) => Math.max(h.revenue, h.expenses)))
  const t = snap.today
  return (
    <div className="panel right">
      <div className="panel-head">
        <h3>📊 Finances</h3>
        <button className="x" onClick={() => setPanel('stats')}>✕</button>
      </div>
      <b>Today so far</b>
      <div className="kv"><span>Room stays</span><span className="good">{fmt(t.rooms)}</span></div>
      <div className="kv"><span>Amenities</span><span className="good">{fmt(t.amenities)}</span></div>
      <div className="kv"><span>Tips</span><span className="good">{fmt(t.tips)}</span></div>
      <div className="kv"><span>Guests checked in</span><span>{t.guests}</span></div>
      <div className="kv"><span>Walked out (waited too long)</span><span className={t.lost ? 'warn' : ''}>{t.lost}</span></div>
      <div className="kv"><span>Turned away (no vacancy)</span><span className={t.missed ? 'warn' : ''}>{t.missed}</span></div>
      <div className="divider" />
      <b>Last days</b>
      {history.length === 0 ? (
        <small className="muted">Finish your first day to see a history.</small>
      ) : (
        <div className="chart">
          {history.map((h) => (
            <div key={h.day} className="chart-col" title={`Day ${h.day}: ${fmt(h.revenue)} in, ${fmt(h.expenses)} out`}>
              <div className="bars">
                <div className="bar-in" style={{ height: `${(h.revenue / max) * 100}%` }} />
                <div className="bar-out" style={{ height: `${(h.expenses / max) * 100}%` }} />
              </div>
              <small>{h.day}</small>
            </div>
          ))}
        </div>
      )}
      <div className="mix-legend"><span><i style={{ background: '#5fbf8f' }} />Revenue</span><span><i style={{ background: '#f08a7a' }} />Expenses</span></div>
      <div className="divider" />
      <div className="kv"><span>All-time guests</span><span>{snap.totals.guests}</span></div>
      <div className="kv"><span>All-time earnings</span><span>{fmt(snap.totals.earned)}</span></div>
      <div className="kv"><span>Best day</span><span>{fmt(snap.totals.bestDay)}</span></div>
      <button
        className="btn ghost"
        onClick={() => {
          if (window.confirm('Start a brand new hotel? Your progress will be lost.')) {
            resetGame()
            syncUI()
          }
        }}
      >
        Restart hotel
      </button>
    </div>
  )
}

const STATUS_TEXT = {
  vacant: ['Ready for guests', 'good'],
  occupied: ['Occupied', ''],
  dirty: ['Needs cleaning', 'warn'],
  cleaning: ['Being cleaned…', ''],
}

function RoomPanel({ roomKey }) {
  useGame((s) => s.snap) // re-render on sync
  const setSelected = useGame((s) => s.setSelected)
  const room = game.rooms[roomKey]
  if (!room) return null
  const def = ROOM_TYPES[room.type]
  const guest = room.guestId && game.agents.find((a) => a.id === room.guestId)
  const users = room.users.length
  const next = UPGRADES[room.type]
  const [statusText, statusCls] = STATUS_TEXT[room.status] || ['', '']
  return (
    <div className="panel right room-panel" style={{ '--accent': def.accent, '--wall': def.wall }}>
      <div className="panel-head">
        <h3>{def.icon} {def.name}</h3>
        <button className="x" onClick={() => setSelected(null)}>✕</button>
      </div>
      <small className="muted">Floor {room.floor} · Slot {room.slot + 1}</small>
      <p className="desc">{def.desc}</p>
      {def.kind === 'room' ? (
        <>
          <div className="kv"><span>Status</span><span className={statusCls}>{statusText}</span></div>
          <div className="kv"><span>Price per stay</span><span>{fmt(def.price * game.priceMult)}</span></div>
          {guest && (
            <>
              <div className="kv"><span>Guest wanted</span><span>{ROOM_TYPES[['standard', 'deluxe', 'suite'][guest.tier]].name}</span></div>
              <div className="kv"><span>Guest mood</span><span>{guest.sat >= 4 ? '😄 Delighted' : guest.sat >= 3 ? '🙂 Happy' : guest.sat >= 2.2 ? '😐 Meh' : '😠 Unhappy'}</span></div>
              <div className="kv"><span>Checks out in</span><span>{Math.max(0, Math.round(guest.stay / 60))}h</span></div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="kv"><span>Visitors</span><span>{users}/{def.capacity}</span></div>
          <div className="kv"><span>Avg. spend</span><span>{fmt(def.spend)}</span></div>
        </>
      )}
      <div className="kv"><span>Upkeep</span><span>{fmt(def.upkeep)}/day</span></div>
      <div className="row">
        {next && (
          <button className="btn" onClick={act(() => upgradeRoom(roomKey))}>
            ⬆ {ROOM_TYPES[next].name} · {fmt(upgradeCost(room.type))}
          </button>
        )}
        <button className="btn danger" onClick={act(() => { if (demolish(roomKey)) setSelected(null) })}>
          🔨 Demolish (+{fmt(def.cost / 2)})
        </button>
      </div>
    </div>
  )
}

function Goals() {
  const done = useGame((s) => s.snap.goalsDone)
  const [open, setOpen] = useState(true)
  const pending = GOALS.filter((g) => !done[g.id]).slice(0, 3)
  const count = Object.keys(done).length
  return (
    <div className={`goals ${open ? '' : 'closed'}`}>
      <button className="goals-head" onClick={() => setOpen(!open)}>
        🏆 Goals <small>{count}/{GOALS.length}</small> <span className="caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul>
          {pending.map((g) => (
            <li key={g.id}>
              <span className="goal-dot" />
              <span>{g.text}</span>
              <b>+{fmt(g.reward)}</b>
            </li>
          ))}
          {pending.length === 0 && <li>Every goal complete — you're a hotel legend! 🌟</li>}
        </ul>
      )}
    </div>
  )
}

function Toasts() {
  const [list, setList] = useState([])
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now()
      const live = game.toasts.filter((t) => now - t.born < 4200)
      setList((prev) => (prev.map((t) => t.id).join() === live.map((t) => t.id).join() ? prev : live))
    }, 200)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.icon}</span> {t.text}
        </div>
      ))}
    </div>
  )
}

function DaySummary() {
  const summary = useGame((s) => s.snap.lastSummary)
  const [shownDay, setShownDay] = useState(() => summary?.day ?? 0)
  const resume = useRef(1)
  const open = !!summary && summary.day !== shownDay
  useEffect(() => {
    // pause while the end-of-day report is open
    if (open) {
      resume.current = game.speed || 1
      setSpeed(0)
      syncUI()
    }
  }, [open])
  if (!open) return null
  const close = () => {
    setShownDay(summary.day)
    setSpeed(resume.current)
    syncUI()
  }
  return (
    <div className="summary">
      <div className="summary-card">
        <div className="summary-title">🌙 Day {summary.day} complete</div>
        <div className="kv"><span>Room stays</span><span className="good">{fmt(summary.rooms)}</span></div>
        <div className="kv"><span>Amenities & tips</span><span className="good">{fmt(summary.amenities + summary.tips)}</span></div>
        <div className="kv"><span>Staff wages</span><span className="warn">−{fmt(summary.wages)}</span></div>
        <div className="kv"><span>Upkeep</span><span className="warn">−{fmt(summary.upkeep)}</span></div>
        <div className="kv total"><span>Profit</span><span className={summary.profit >= 0 ? 'good' : 'warn'}>{summary.profit >= 0 ? '+' : '−'}{fmt(Math.abs(summary.profit))}</span></div>
        <div className="kv"><span>Guests · walked out · turned away</span><span>{summary.guests} · {summary.lost} · {summary.missed}</span></div>
        <div className="summary-tip">{tipFor(summary)}</div>
        <button className="btn" onClick={close}>Next day ☀️</button>
      </div>
    </div>
  )
}

function tipFor(s) {
  if (s.lost > 3) return 'Guests are walking out of the queue — hire another receptionist.'
  if (s.missed > 6) return 'You turned many guests away. Build more rooms or raise prices.'
  if (s.profit < 0) return 'You lost money today. Check staff count and upkeep against income.'
  if (game.staff.housekeeper * 6 < Object.keys(game.rooms).length) return 'Dirty rooms can’t be sold — consider another housekeeper.'
  if (s.rating < 3) return 'Your rating is slipping. Match room types to demand and keep the queue short.'
  return 'Nice work! Amenities keep guests happy and earn extra cash.'
}

function Help({ onClose }) {
  return (
    <div className="summary">
      <div className="summary-card help">
        <div className="summary-title">🏨 Welcome, Manager!</div>
        <p>You've inherited a tiny hotel. Make it the most loved stay in town.</p>
        <ul>
          <li>🧍 Guests arrive, queue at <b>reception</b>, and get the best matching free room.</li>
          <li>🛏️ After check-out a room is <b>dirty</b> — housekeepers clean it before it can be sold again.</li>
          <li>🏗️ Build rooms on empty slots, <b>add floors</b> and <b>widen</b> the hotel to grow.</li>
          <li>🍸 Amenities earn extra money and raise guest satisfaction.</li>
          <li>⭐ Happy guests raise your rating, which attracts more (and richer) guests.</li>
          <li>💸 Wages and upkeep are paid every midnight.</li>
        </ul>
        <p className="muted">Drag to rotate · right-drag / two fingers to pan · scroll to zoom</p>
        <button className="btn" onClick={onClose}>Open the doors!</button>
      </div>
    </div>
  )
}

export default function HUD({ quality, setQuality }) {
  const selected = useGame((s) => s.selected)
  const panel = useGame((s) => s.panel)
  const [help, setHelp] = useState(() => {
    try { return !localStorage.getItem('hotel-tycoon-seen-help') } catch { return true }
  })
  const closeHelp = () => {
    setHelp(false)
    try { localStorage.setItem('hotel-tycoon-seen-help', '1') } catch { /* ignore */ }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') { useGame.getState().setTool(null); useGame.getState().setSelected(null) }
      if (e.key === ' ') { e.preventDefault(); setSpeed(game.speed ? 0 : 1); syncUI() }
      if (['1', '2', '3'].includes(e.key)) { setSpeed([1, 2, 4][+e.key - 1]); syncUI() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="hud">
      <TopBar />
      <Goals />
      <Toasts />
      {selected ? <RoomPanel roomKey={selected} /> : panel === 'staff' ? <StaffPanel /> : panel === 'stats' ? <StatsPanel /> : null}
      <BuildBar />
      <div className="corner">
        <button className="mini" onClick={() => setHelp(true)} title="How to play">?</button>
        <button className="mini" onClick={() => setQuality(quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high')} title="Graphics quality">
          {quality === 'high' ? 'HQ' : quality === 'medium' ? 'MQ' : 'LQ'}
        </button>
      </div>
      <DaySummary />
      {help && <Help onClose={closeHelp} />}
    </div>
  )
}
