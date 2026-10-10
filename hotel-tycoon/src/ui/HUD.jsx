import { useEffect, useRef, useState } from 'react'
import { useGame, syncUI } from '../game/store'
import {
  game, setSpeed, setPrice, addFloor, widen, hire, fire, demolish, upgradeRoom, upgradeCost, UPGRADES,
  GOALS, demandMix, resetGame, roomName, ownerTask,
} from '../game/engine'
import { ENERGY_COST, ENERGY_MAX } from '../sim'
import { ROOM_TYPES, STAFF_TYPES, MAX_FLOORS, MAX_WIDTH } from '../game/constants'
import { camApi } from '../scene/Scene'
import Icon, { TYPE_ICON } from './Icon'

const act = (fn) => (...args) => {
  fn(...args)
  syncUI()
}
const fmt = (n) => `$${Math.round(n).toLocaleString()}`
const clock = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.floor((minute % 60) / 10) * 10).padStart(2, '0')}`
const TIER_TYPES = ['standard', 'deluxe', 'suite']

function useAnimatedNumber(value) {
  const [shown, setShown] = useState(value)
  const ref = useRef(value)
  useEffect(() => {
    let raf
    const tick = () => {
      ref.current += (value - ref.current) * 0.2
      if (Math.abs(value - ref.current) < 1) ref.current = value
      setShown(ref.current)
      if (ref.current !== value) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return shown
}

function TypeBadge({ type, size = 36 }) {
  const def = ROOM_TYPES[type]
  return (
    <span className="type-badge" style={{ '--c': def.accent, '--bg': def.wall, width: size, height: size }}>
      <Icon name={TYPE_ICON[type]} size={size * 0.5} />
    </span>
  )
}

function Delta({ value, suffix = '' }) {
  if (!value) return null
  const up = value > 0
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      <Icon name="up" size={11} stroke={2.6} className={up ? '' : 'flip'} />
      {up ? '+' : '−'}{Math.abs(value).toLocaleString()}{suffix}
    </span>
  )
}

// ---------------------------------------------------------------- navbar
function Nav() {
  const snap = useGame((s) => s.snap)
  const [q, setQ] = useState('')
  const occ = snap.totalRooms ? Math.round((snap.occupied / snap.totalRooms) * 100) : 0
  const search = (e) => {
    e.preventDefault()
    const needle = q.trim().toLowerCase()
    if (!needle) return
    const room = Object.values(game.rooms).find((r) =>
      roomName(r).includes(needle) || ROOM_TYPES[r.type].name.toLowerCase().includes(needle)
    )
    if (room) useGame.getState().selectAndFocus(room.key)
    setQ('')
  }
  return (
    <header className="nav">
      <div className="logo">
        <span className="logo-mark"><Icon name="building" size={18} stroke={2.2} /></span>
        <span className="logo-text">Hotel Tycoon</span>
      </div>
      <form className="search" onSubmit={search}>
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rooms (e.g. 203, suite)…" />
        <kbd>↵</kbd>
      </form>
      <div className="nav-right">
        <div className="site-pill">
          <span className="site-code">HT-01</span>
          <div>
            <b>Coral Grand</b>
            <small>{snap.floors} floors · {occ}% full · {snap.staff.receptionist} desk{snap.staff.receptionist > 1 ? 's' : ''}</small>
          </div>
        </div>
        <div className="live">
          <span className={`dot ${snap.speed ? '' : 'paused'}`} />
          <span>{snap.speed ? 'Live' : 'Paused'}</span>
          <b>Day {snap.day} · {clock(snap.minute)}</b>
        </div>
        <div className="seg">
          {[0, 1, 2, 4].map((s) => (
            <button key={s} className={snap.speed === s ? 'on' : ''} onClick={act(() => setSpeed(s))} title={s ? `${s}× speed` : 'Pause (Space)'}>
              {s === 0 ? <Icon name="pause" size={13} fill="currentColor" stroke={0} /> : s === 1 ? <Icon name="play" size={12} fill="currentColor" stroke={0} /> : <span className="ffx"><Icon name="ff" size={13} fill="currentColor" stroke={0} />{s}×</span>}
            </button>
          ))}
        </div>
        <div className="user">
          <span className="avatar">GM</span>
          <div className="hide-md">
            <b>You</b>
            <small>General Manager</small>
          </div>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------- KPI cards
function Kpis() {
  const snap = useGame((s) => s.snap)
  const money = useAnimatedNumber(snap.money)
  const prev = game.history[game.history.length - 1]
  const occ = snap.totalRooms ? Math.round((snap.occupied / snap.totalRooms) * 100) : 0
  const ratingDelta = prev ? Math.round((snap.rating - prev.rating) * 100) / 100 : 0
  return (
    <div className="kpis">
      <div className="kpi">
        <span className="kpi-icon coral"><Icon name="wallet" size={18} /></span>
        <div>
          <small>Balance</small>
          <div className="kpi-main">
            <b className={snap.money < 0 ? 'neg' : ''}>{fmt(money)}</b>
            <Delta value={snap.today.revenue} />
          </div>
          <span className="kpi-sub">today's revenue</span>
        </div>
      </div>
      <div className="kpi">
        <span className="kpi-icon blue"><Icon name="bed" size={18} /></span>
        <div>
          <small>Occupancy</small>
          <div className="kpi-main"><b>{occ}%</b><span className="kpi-chip">{snap.occupied}/{snap.totalRooms}</span></div>
          <span className="kpi-sub">{snap.dirty} to clean</span>
        </div>
      </div>
      <div className="kpi">
        <span className="kpi-icon amber"><Icon name="star" size={18} /></span>
        <div>
          <small>Guest rating</small>
          <div className="kpi-main"><b>{snap.rating.toFixed(1)}</b><Delta value={ratingDelta} /></div>
          <span className="kpi-sub">{'★'.repeat(Math.round(snap.rating))}{'☆'.repeat(5 - Math.round(snap.rating))}</span>
        </div>
      </div>
      <div className="kpi hide-md">
        <span className="kpi-icon green"><Icon name="list" size={18} /></span>
        <div>
          <small>Reception queue</small>
          <div className="kpi-main"><b className={snap.queue > 5 ? 'neg' : ''}>{snap.queue}</b><span className="kpi-chip">{snap.staff.receptionist} desk{snap.staff.receptionist > 1 ? 's' : ''}</span></div>
          <span className="kpi-sub">{snap.today.lost} walked out today</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- left tool rail + flyouts
const RAIL = [
  { id: 'rooms', icon: 'bed', label: 'Rooms' },
  { id: 'amenities', icon: 'glass', label: 'Amenities' },
  { id: 'expand', icon: 'building', label: 'Expand' },
  { id: 'demolish', icon: 'hammer', label: 'Demolish' },
  { id: 'staff', icon: 'users', label: 'Staff & prices' },
  { id: 'finance', icon: 'chart', label: 'Finances' },
  { id: 'goals', icon: 'trophy', label: 'Goals' },
]

function Rail() {
  const rail = useGame((s) => s.rail)
  const tool = useGame((s) => s.tool)
  const setRail = useGame((s) => s.setRail)
  const goalsLeft = GOALS.length - Object.keys(useGame((s) => s.snap.goalsDone)).length
  return (
    <>
      <nav className="rail">
        {RAIL.map((r) => {
          const on = r.id === 'demolish' ? tool === 'demolish' : rail === r.id
          return (
            <button
              key={r.id}
              className={`rail-btn ${on ? 'on' : ''} ${r.id === 'demolish' ? 'danger' : ''}`}
              onClick={() => {
                if (r.id === 'demolish') {
                  const st = useGame.getState()
                  st.setTool(st.tool === 'demolish' ? null : 'demolish')
                  useGame.setState({ rail: null })
                } else setRail(r.id)
              }}
            >
              <Icon name={r.icon} size={19} />
              {r.id === 'goals' && goalsLeft > 0 && <span className="rail-badge">{goalsLeft}</span>}
              <span className="rail-tip">{r.label}</span>
            </button>
          )
        })}
      </nav>
      {rail && <Flyout id={rail} />}
    </>
  )
}

function Flyout({ id }) {
  const close = () => useGame.setState({ rail: null })
  const title = RAIL.find((r) => r.id === id)?.label
  return (
    <div className="flyout">
      <div className="card-head">
        <h3>{title}</h3>
        <button className="icon-btn" onClick={close}><Icon name="x" size={16} /></button>
      </div>
      {id === 'rooms' && <BuildList ids={TIER_TYPES} />}
      {id === 'amenities' && <BuildList ids={['restaurant', 'bar', 'spa']} />}
      {id === 'expand' && <ExpandList />}
      {id === 'staff' && <StaffPanel />}
      {id === 'finance' && <FinancePanel />}
      {id === 'goals' && <GoalsPanel />}
    </div>
  )
}

function BuildList({ ids }) {
  const tool = useGame((s) => s.tool)
  const money = useGame((s) => s.snap.money)
  return (
    <div className="list">
      {ids.map((id) => {
        const def = ROOM_TYPES[id]
        const on = tool === id
        return (
          <button key={id} className={`build-item ${on ? 'on' : ''}`} style={{ '--c': def.accent }} onClick={() => useGame.getState().setTool(on ? null : id)}>
            <TypeBadge type={id} size={40} />
            <div className="bi-text">
              <b>{def.name}</b>
              <small>{def.desc}</small>
              <span className="bi-meta">
                {def.kind === 'room' ? <>Earns <b>{fmt(def.price)}</b>/stay</> : <>Spend <b>~{fmt(def.spend)}</b></>} · upkeep {fmt(def.upkeep)}
              </span>
            </div>
            <span className={`price-tag ${money < def.cost ? 'poor' : ''}`}>{fmt(def.cost)}</span>
          </button>
        )
      })}
      <p className="hint"><Icon name="target" size={14} /> Pick a type, then click an empty slot in the hotel.</p>
    </div>
  )
}

function ExpandList() {
  const snap = useGame((s) => s.snap)
  return (
    <div className="list">
      <button className="build-item" style={{ '--c': '#4f7cff' }} disabled={snap.floors >= MAX_FLOORS} onClick={act(addFloor)}>
        <span className="type-badge" style={{ '--c': '#4f7cff', '--bg': '#e6edff', width: 40, height: 40 }}><Icon name="layers" size={20} /></span>
        <div className="bi-text">
          <b>Add a floor</b>
          <small>{snap.floors}/{MAX_FLOORS} floors · {snap.width} new room slots</small>
        </div>
        <span className={`price-tag ${snap.money < snap.floorCost ? 'poor' : ''}`}>{snap.floors >= MAX_FLOORS ? 'Max' : fmt(snap.floorCost)}</span>
      </button>
      <button className="build-item" style={{ '--c': '#4f7cff' }} disabled={snap.width >= MAX_WIDTH} onClick={act(widen)}>
        <span className="type-badge" style={{ '--c': '#4f7cff', '--bg': '#e6edff', width: 40, height: 40 }}><Icon name="expand" size={20} /></span>
        <div className="bi-text">
          <b>Widen the building</b>
          <small>{snap.width}/{MAX_WIDTH} slots per floor · bigger lobby</small>
        </div>
        <span className={`price-tag ${snap.money < snap.widenCost ? 'poor' : ''}`}>{snap.width >= MAX_WIDTH ? 'Max' : fmt(snap.widenCost)}</span>
      </button>
    </div>
  )
}

function StaffPanel() {
  const snap = useGame((s) => s.snap)
  const mix = demandMix(snap.rating)
  const pct = Math.round(snap.priceMult * 100)
  return (
    <div className="list">
      {Object.values(STAFF_TYPES).map((s) => (
        <div key={s.id} className="staff-row">
          <span className="type-badge" style={{ '--c': s.id === 'housekeeper' ? '#4f7cff' : '#ff6a45', '--bg': s.id === 'housekeeper' ? '#e6edff' : '#ffe9e2', width: 38, height: 38 }}>
            <Icon name={s.id === 'housekeeper' ? 'sparkle' : 'key'} size={18} />
          </span>
          <div className="bi-text">
            <b>{s.name}s</b>
            <small>{s.id === 'housekeeper' ? 'Clean rooms after check-out' : 'Each opens another check-in desk'}</small>
            <span className="bi-meta">{fmt(s.wage)}/day · hire {fmt(s.hire)}</span>
          </div>
          <div className="stepper">
            <button onClick={act(() => fire(s.id))}><Icon name="minus" size={14} /></button>
            <span>{snap.staff[s.id]}</span>
            <button onClick={act(() => hire(s.id))} disabled={snap.staff[s.id] >= s.max}><Icon name="plus" size={14} /></button>
          </div>
        </div>
      ))}
      <div className="sep" />
      <div className="row-between"><b><Icon name="tag" size={14} /> Room prices</b><span className={`pill ${pct > 115 ? 'amber' : pct < 90 ? 'green' : 'gray'}`}>{pct}%</span></div>
      <input className="range" type="range" min="0.6" max="1.8" step="0.05" value={snap.priceMult} onChange={(e) => { setPrice(parseFloat(e.target.value)); syncUI() }} />
      <div className="price-grid">
        {TIER_TYPES.map((id) => (
          <div key={id}><small>{ROOM_TYPES[id].name}</small><b>{fmt(ROOM_TYPES[id].price * snap.priceMult)}</b></div>
        ))}
      </div>
      <small className="muted">Higher prices earn more per stay but bring fewer guests and lower satisfaction.</small>
      <div className="sep" />
      <b>Who is arriving</b>
      <div className="mix">
        {TIER_TYPES.map((id, i) => (
          <div key={id} style={{ flex: Math.max(0.001, mix[i]), background: ROOM_TYPES[id].accent }}>{mix[i] > 0.12 && `${Math.round(mix[i] * 100)}%`}</div>
        ))}
      </div>
      <div className="legend">
        {TIER_TYPES.map((id) => <span key={id}><i style={{ background: ROOM_TYPES[id].accent }} />{ROOM_TYPES[id].name}</span>)}
      </div>
      <small className="muted">A higher rating attracts guests who want fancier rooms.</small>
    </div>
  )
}

function FinancePanel() {
  const snap = useGame((s) => s.snap)
  const history = game.history.slice(-10)
  const max = Math.max(1, ...history.map((h) => Math.max(h.revenue, h.expenses)))
  const t = snap.today
  return (
    <div className="list">
      <div className="kv"><span>Room stays</span><b className="pos">{fmt(t.rooms)}</b></div>
      <div className="kv"><span>Amenities</span><b className="pos">{fmt(t.amenities)}</b></div>
      <div className="kv"><span>Tips</span><b className="pos">{fmt(t.tips)}</b></div>
      <div className="kv"><span>Checked in</span><b>{t.guests}</b></div>
      <div className="kv"><span>Walked out</span><b className={t.lost ? 'neg' : ''}>{t.lost}</b></div>
      <div className="kv"><span>Turned away</span><b className={t.missed ? 'neg' : ''}>{t.missed}</b></div>
      <div className="sep" />
      <b>Last days</b>
      {history.length === 0 ? (
        <small className="muted">Finish your first day to see a history.</small>
      ) : (
        <div className="chart">
          {history.map((h) => (
            <div key={h.day} className="chart-col" title={`Day ${h.day}: ${fmt(h.revenue)} in · ${fmt(h.expenses)} out`}>
              <div className="bars">
                <div className="bar-in" style={{ height: `${(h.revenue / max) * 100}%` }} />
                <div className="bar-out" style={{ height: `${(h.expenses / max) * 100}%` }} />
              </div>
              <small>{h.day}</small>
            </div>
          ))}
        </div>
      )}
      <div className="legend"><span><i style={{ background: '#4f7cff' }} />Revenue</span><span><i style={{ background: '#ffb4a2' }} />Expenses</span></div>
      <div className="sep" />
      <div className="kv"><span>All-time guests</span><b>{snap.totals.guests}</b></div>
      <div className="kv"><span>All-time earnings</span><b>{fmt(snap.totals.earned)}</b></div>
      <div className="kv"><span>Best day</span><b>{fmt(snap.totals.bestDay)}</b></div>
      <button className="link-btn" onClick={() => { if (window.confirm('Start a brand new hotel? Your progress will be lost.')) { resetGame(); syncUI() } }}>Restart hotel</button>
    </div>
  )
}

function GoalsPanel() {
  const done = useGame((s) => s.snap.goalsDone)
  return (
    <div className="list goals">
      {GOALS.map((g) => (
        <div key={g.id} className={`goal ${done[g.id] ? 'done' : ''}`}>
          <span className="goal-check">{done[g.id] && <Icon name="check" size={12} stroke={3} />}</span>
          <span>{g.text}</span>
          <b>+{fmt(g.reward)}</b>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- map controls
function MapControls({ quality, setQuality, onHelp }) {
  return (
    <div className="map-ctrl">
      <button onClick={() => camApi.zoom(0.75)} title="Zoom in"><Icon name="plus" size={16} /></button>
      <button onClick={() => camApi.zoom(1.33)} title="Zoom out"><Icon name="minus" size={16} /></button>
      <span className="mc-sep" />
      <button onClick={() => camApi.rotate(-0.5)} title="Rotate left"><Icon name="rotl" size={15} /></button>
      <button onClick={() => camApi.rotate(0.5)} title="Rotate right"><Icon name="rotr" size={15} /></button>
      <button onClick={() => camApi.home()} title="Reset view"><Icon name="home" size={15} /></button>
      <span className="mc-sep" />
      <button onClick={() => setQuality(quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high')} title={`Graphics: ${quality}`} className="mc-text">
        {quality === 'high' ? 'HQ' : quality === 'medium' ? 'MQ' : 'LQ'}
      </button>
      <button onClick={onHelp} title="How to play"><Icon name="help" size={15} /></button>
    </div>
  )
}

// ---------------------------------------------------------------- selected room detail
const STATUS = {
  vacant: ['Ready', 'green'],
  occupied: ['Occupied', 'blue'],
  dirty: ['Needs cleaning', 'amber'],
  cleaning: ['Cleaning', 'violet'],
}

function Detail({ roomKey }) {
  useGame((s) => s.snap)
  const owner = useGame((s) => s.snap.owner)
  const setSelected = useGame((s) => s.setSelected)
  const room = game.rooms[roomKey]
  if (!room) return null
  const def = ROOM_TYPES[room.type]
  const guest = room.guestId && game.agents.find((a) => a.id === room.guestId)
  const next = UPGRADES[room.type]
  const [label, tone] = def.kind === 'room' ? STATUS[room.status] : [room.users.length ? 'Busy' : 'Open', room.users.length ? 'blue' : 'green']
  const cleaner = room.cleanBy != null && game.agentById(room.cleanBy)
  return (
    <div className="detail">
      <div className="detail-head">
        <TypeBadge type={room.type} size={42} />
        <div className="dh-text">
          <small className="eyebrow">{def.kind === 'room' ? 'Guest room' : 'Amenity'} · {def.name}</small>
          <h3>Room {roomName(room)}</h3>
          <small className="muted">HT-01 · Floor {room.floor} · Slot {room.slot + 1}</small>
        </div>
        <div className="dh-actions">
          <button className="icon-btn" title="Focus" onClick={() => useGame.getState().selectAndFocus(roomKey)}><Icon name="target" size={15} /></button>
          <button className="icon-btn" title="Close" onClick={() => setSelected(null)}><Icon name="x" size={15} /></button>
        </div>
      </div>
      <div className="detail-status">
        <span className={`pill ${tone}`}>{label}</span>
        <small className="muted">{guest ? `Guest #G-${guest.id}` : cleaner ? (cleaner.kind === 'owner' ? (room.status === 'cleaning' ? 'You’re cleaning it' : 'You’re on the way') : 'Housekeeper on it') : def.kind === 'room' ? 'No guest assigned' : `${room.users.length}/${def.capacity} visitors`}</small>
      </div>
      <div className="kvs">
        {def.kind === 'room' ? (
          <>
            <div className="kv"><span>Price per stay</span><b>{fmt(def.price * game.priceMult)}</b></div>
            {guest && <div className="kv"><span>Guest wanted</span><b>{ROOM_TYPES[TIER_TYPES[guest.tier]].name}</b></div>}
            {guest && <div className="kv"><span>Guest mood</span><b>{guest.sat >= 4 ? 'Delighted' : guest.sat >= 3 ? 'Happy' : guest.sat >= 2.2 ? 'Meh' : 'Unhappy'}</b></div>}
            {guest && <div className="kv"><span>Check-out in</span><b>{Math.max(0, Math.round(guest.stay / 60))} h</b></div>}
          </>
        ) : (
          <>
            <div className="kv"><span>Visitors</span><b>{room.users.length}/{def.capacity}</b></div>
            <div className="kv"><span>Avg. spend</span><b>{fmt(def.spend)}</b></div>
          </>
        )}
        <div className="kv"><span>Upkeep</span><b>{fmt(def.upkeep)}/day</b></div>
        <div className="kv"><span>Build value</span><b>{fmt(def.cost)}</b></div>
      </div>
      <div className="detail-actions">
        {def.kind === 'room' && room.status === 'dirty' && room.cleanBy == null && (
          <button className="btn accent" disabled={owner.energy < ENERGY_COST.clean} onClick={act(() => ownerTask('clean', roomKey))}>
            Clean it yourself · {ENERGY_COST.clean} energy
          </button>
        )}
        {next && (
          <button className="btn primary" onClick={act(() => upgradeRoom(roomKey))}>
            Upgrade to {ROOM_TYPES[next].name} · {fmt(upgradeCost(room.type))}
          </button>
        )}
        <button className="btn ghost-danger" onClick={act(() => { if (demolish(roomKey)) setSelected(null) })}>
          Demolish · refund {fmt(def.cost / 2)}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- you, the owner (left)
const OWNER_CARD_KEY = 'hotel-tycoon-owner-card'
const isPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches

function OwnerCard() {
  const o = useGame((s) => s.snap.owner)
  // phones start folded so the card never sits on top of the hotel; the choice is remembered
  const [open, setOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem(OWNER_CARD_KEY)
      if (saved) return saved === 'open'
    } catch { /* storage blocked */ }
    return !isPhone()
  })
  const setOpen = (v) => {
    setOpenState(v)
    try { localStorage.setItem(OWNER_CARD_KEY, v ? 'open' : 'closed') } catch { /* ignore */ }
  }
  // on a phone, fold away once a chore is chosen so you can watch it happen
  const choose = (task) => act(() => {
    ownerTask(task)
    if (isPhone()) setOpenState(false)
  })

  const room = o.task?.room && game.rooms[o.task.room]
  const short = !o.task ? 'Free' : o.task.kind === 'desk' ? 'At the desk' : o.state === 'cleaning' ? 'Cleaning' : 'On the way'
  const doing = !o.task
    ? 'Free. Select a dirty room to clean it'
    : o.task.kind === 'desk'
      ? (o.atDesk ? 'Working the front desk' : 'Walking to the desk')
      : o.state === 'cleaning' ? `Cleaning room ${room ? roomName(room) : ''}` : `Heading to room ${room ? roomName(room) : ''}`
  const pct = Math.round((o.energy / ENERGY_MAX) * 100)
  const bar = <div className={`energy-bar ${o.tired ? 'low' : ''}`}><i style={{ width: `${pct}%` }} /></div>

  if (!open) {
    return (
      <button className="owner-chip" onClick={() => setOpen(true)} aria-label="Show your owner card">
        <span className="owner-dot sm">You</span>
        <span className="chip-text"><b>{Math.round(o.energy)}</b> energy · {short}</span>
        {bar}
      </button>
    )
  }
  return (
    <div className="owner-card">
      <div className="owner-head">
        <span className="owner-dot">You</span>
        <div className="grow">
          <b>You · Owner</b>
          <small>{doing}</small>
        </div>
        <button className="icon-btn" title="Fold away" aria-label="Fold away" onClick={() => setOpen(false)}><Icon name="down" size={15} /></button>
      </div>
      <div className="energy" title="Tasks cost energy. It refills overnight; below 20 you walk at half speed.">
        {bar}
        <small><b>{Math.round(o.energy)}</b> energy{o.tired ? ' · tired, moving slowly' : ''}</small>
      </div>
      <div className="owner-actions">
        {o.task?.kind === 'desk' ? (
          <button className="btn" onClick={choose('stop')}>Leave the desk</button>
        ) : (
          <button className="btn accent" disabled={o.energy < ENERGY_COST.checkIn} onClick={choose('desk')}>
            Work the desk · {ENERGY_COST.checkIn}/guest
          </button>
        )}
        {o.task?.kind === 'clean' && <button className="btn" onClick={choose('stop')}>Stop</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- guest journey (bottom left)
const STEPS = [
  { id: 'arriving', label: 'Arriving', icon: 'car' },
  { id: 'queue', label: 'In queue', icon: 'list' },
  { id: 'checkin', label: 'Check-in', icon: 'key' },
  { id: 'staying', label: 'Staying', icon: 'bed' },
  { id: 'leaving', label: 'Checking out', icon: 'exit' },
]

function Journey() {
  const snap = useGame((s) => s.snap)
  const j = snap.journey
  // spotlight: a VIP in line, else whoever is first in the queue, else someone checking in
  const guests = game.agents.filter((a) => a.kind === 'guest')
  const spot =
    guests.find((a) => a.tier === 2 && (a.state === 'queue' || a.state === 'toDesk')) ||
    guests.find((a) => a.id === game.queue[0]) ||
    guests.find((a) => a.state === 'toDesk') ||
    guests.find((a) => a.state === 'taxi' || a.state === 'arriving')
  const stateLabel = spot && ({ taxi: ['Taxi en route', 'gray'], arriving: ['Walking in', 'gray'], queue: ['In queue', 'amber'], toDesk: ['Checking in', 'blue'] }[spot.state] || ['Guest', 'gray'])
  const lastActive = STEPS.reduce((acc, s, i) => (j[s.id] > 0 ? i : acc), -1)
  return (
    <div className="journey">
      <div className="card-head">
        <h3><Icon name="person" size={16} /> Guest journey</h3>
        <small className="muted">{snap.today.guests} checked in today</small>
      </div>
      <div className="journey-body">
        <div className="stepper-line">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`step ${j[s.id] ? 'active' : ''} ${i <= lastActive ? 'reached' : ''}`}>
              <span className="step-dot"><Icon name={s.icon} size={13} /></span>
              <b>{s.label}</b>
              <small>{j[s.id]} guest{j[s.id] === 1 ? '' : 's'}</small>
            </div>
          ))}
        </div>
        <div className="spot">
          {spot ? (
            <>
              <span className="spot-icon" style={{ background: spot.color === '#ffffff' ? '#8b95ad' : spot.color }}><Icon name={spot.state === 'taxi' ? 'car' : 'person'} size={20} /></span>
              <div>
                <b>#G-{spot.id}{spot.tier === 2 && <span className="vip">VIP</span>}</b>
                <small>Wants {ROOM_TYPES[TIER_TYPES[spot.tier]].name}</small>
                <span className="spot-row">
                  <span className={`pill ${stateLabel[1]}`}>{stateLabel[0]}</span>
                  {(spot.state === 'queue' || spot.state === 'toDesk') && <small className="muted">{Math.round(spot.wait)} min</small>}
                </span>
              </div>
            </>
          ) : (
            <small className="muted">No guests at the desk right now.</small>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- rooms / staff / amenities table (bottom right)
function Board() {
  useGame((s) => s.snap)
  const [tab, setTab] = useState('rooms')
  const selectAndFocus = useGame((s) => s.selectAndFocus)
  const rooms = Object.values(game.rooms).sort((a, b) => a.floor - b.floor || a.slot - b.slot)
  const guestRooms = rooms.filter((r) => ROOM_TYPES[r.type].kind === 'room')
  const amenities = rooms.filter((r) => ROOM_TYPES[r.type].kind === 'amenity')
  const staff = game.agents.filter((a) => a.kind === 'staff')
  const ready = guestRooms.filter((r) => r.status === 'vacant').length
  return (
    <div className="board">
      <div className="board-head">
        <div className="tabs">
          <button className={tab === 'rooms' ? 'on' : ''} onClick={() => setTab('rooms')}>Rooms <small>{ready}/{guestRooms.length}</small></button>
          <button className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>Staff <small>{staff.length + game.staff.receptionist}</small></button>
          <button className={tab === 'amen' ? 'on' : ''} onClick={() => setTab('amen')}>Amenities <small>{amenities.length}</small></button>
        </div>
        <small className="muted hide-md">Coral Grand</small>
      </div>
      <div className="rows">
        {tab === 'rooms' && guestRooms.map((r) => {
          const def = ROOM_TYPES[r.type]
          const [label, tone] = STATUS[r.status]
          const g = r.guestId && game.agents.find((a) => a.id === r.guestId)
          return (
            <button key={r.key} className="row" onClick={() => selectAndFocus(r.key)}>
              <span className="row-id"><b>{roomName(r)}</b><small>F{r.floor}</small></span>
              <span className="row-name"><i style={{ background: def.accent }} />{def.name}</span>
              <span className={`pill ${tone}`}>{label}</span>
              <span className="row-meta">{g ? `${Math.max(0, Math.round(g.stay / 60))}h left` : r.status === 'cleaning' ? <Progress v={(r.cleanT || 0) / 35} /> : ''}</span>
              <Icon name="right" size={15} />
            </button>
          )
        })}
        {tab === 'rooms' && guestRooms.length === 0 && <p className="empty">No guest rooms yet. Build one from the Rooms tool.</p>}
        {tab === 'staff' && (
          <>
            {Array.from({ length: game.staff.receptionist }).map((_, i) => (
              <div key={`r${i}`} className="row static">
                <span className="row-id"><b>RC-{i + 1}</b><small>Lobby</small></span>
                <span className="row-name"><i style={{ background: '#ff6a45' }} />Receptionist</span>
                <span className={`pill ${game.desks[i] ? 'blue' : 'green'}`}>{game.desks[i] ? 'Checking in' : 'Available'}</span>
                <span className="row-meta">Desk {i + 1}</span>
              </div>
            ))}
            {staff.map((a, i) => {
              const target = a.target && game.rooms[a.target]
              const busy = a.state === 'cleaning' ? ['Cleaning', 'violet'] : a.state === 'toClean' ? ['En route', 'blue'] : ['Idle', 'gray']
              return (
                <div key={a.id} className="row static">
                  <span className="row-id"><b>HK-{i + 1}</b><small>F{Math.round(a.pos.y / 3)}</small></span>
                  <span className="row-name"><i style={{ background: '#5b8def' }} />Housekeeper</span>
                  <span className={`pill ${busy[1]}`}>{busy[0]}</span>
                  <span className="row-meta">{target ? `Room ${roomName(target)}` : '—'}</span>
                </div>
              )
            })}
          </>
        )}
        {tab === 'amen' && amenities.map((r) => {
          const def = ROOM_TYPES[r.type]
          return (
            <button key={r.key} className="row" onClick={() => selectAndFocus(r.key)}>
              <span className="row-id"><b>{roomName(r)}</b><small>F{r.floor}</small></span>
              <span className="row-name"><i style={{ background: def.accent }} />{def.name}</span>
              <span className={`pill ${r.users.length ? 'blue' : 'green'}`}>{r.users.length ? 'Busy' : 'Open'}</span>
              <span className="row-meta">{r.users.length}/{def.capacity}</span>
              <Icon name="right" size={15} />
            </button>
          )
        })}
        {tab === 'amen' && amenities.length === 0 && <p className="empty">No amenities yet — a restaurant is a great first one.</p>}
      </div>
    </div>
  )
}

function Progress({ v }) {
  return <span className="progress"><span style={{ width: `${Math.min(100, v * 100)}%` }} /></span>
}

// ---------------------------------------------------------------- toasts, modals
function Toasts() {
  const [list, setList] = useState([])
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now()
      const live = game.toasts.filter((t) => now - t.born < 4200).slice(-3)
      setList((prev) => (prev.map((t) => t.id).join() === live.map((t) => t.id).join() ? prev : live))
    }, 200)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className="toast"><span className="toast-icon">{t.icon}</span>{t.text}</div>
      ))}
    </div>
  )
}

function ToolHint() {
  const tool = useGame((s) => s.tool)
  if (!tool) return null
  const def = ROOM_TYPES[tool]
  return (
    <div className="tool-hint">
      {tool === 'demolish' ? <><Icon name="hammer" size={15} /> Click a room to demolish it (50% refund)</> : <><TypeBadge type={tool} size={24} /> Click an empty slot to build a <b>{def.name}</b> · {fmt(def.cost)}</>}
      <button onClick={() => useGame.getState().setTool(null)}>Done</button>
    </div>
  )
}

function DaySummary() {
  const summary = useGame((s) => s.snap.lastSummary)
  const [shownDay, setShownDay] = useState(() => summary?.day ?? 0)
  const resume = useRef(1)
  const open = !!summary && summary.day !== shownDay
  useEffect(() => {
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
    <div className="modal-wrap">
      <div className="modal">
        <small className="eyebrow">End of day report</small>
        <h2>Day {summary.day} complete</h2>
        <div className={`profit ${summary.profit >= 0 ? 'pos' : 'neg'}`}>{summary.profit >= 0 ? '+' : '−'}{fmt(Math.abs(summary.profit))}<small>profit</small></div>
        <div className="kvs">
          <div className="kv"><span>Room stays</span><b className="pos">{fmt(summary.rooms)}</b></div>
          <div className="kv"><span>Amenities & tips</span><b className="pos">{fmt(summary.amenities + summary.tips)}</b></div>
          <div className="kv"><span>Staff wages</span><b className="neg">−{fmt(summary.wages)}</b></div>
          <div className="kv"><span>Upkeep</span><b className="neg">−{fmt(summary.upkeep)}</b></div>
          <div className="kv"><span>Checked in · walked out · turned away</span><b>{summary.guests} · {summary.lost} · {summary.missed}</b></div>
        </div>
        <div className="tip"><Icon name="sparkle" size={15} /> {tipFor(summary)}</div>
        <button className="btn primary wide" onClick={close}>Start day {summary.day + 1}</button>
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
    <div className="modal-wrap">
      <div className="modal help">
        <small className="eyebrow">Welcome, manager</small>
        <h2>Run the Coral Grand</h2>
        <ul>
          <li><span><Icon name="car" size={16} /></span>Guests arrive by taxi or on foot, queue at <b>reception</b> and get the best matching free room.</li>
          <li><span><Icon name="sparkle" size={16} /></span>After check-out a room is <b>dirty</b> — housekeepers clean it before it can be sold again.</li>
          <li><span><Icon name="person" size={16} /></span><b>You</b> walk the hotel too (orange ring): work the desk or clean a room yourself. Chores cost <b>energy</b>, which refills overnight.</li>
          <li><span><Icon name="building" size={16} /></span>Use the tool rail to build rooms, <b>add floors</b> and <b>widen</b> the hotel.</li>
          <li><span><Icon name="glass" size={16} /></span>Amenities earn extra money and raise guest satisfaction.</li>
          <li><span><Icon name="star" size={16} /></span>Happy guests raise your rating, which brings more — and richer — guests.</li>
          <li><span><Icon name="wallet" size={16} /></span>Wages and upkeep are paid every midnight.</li>
        </ul>
        <p className="muted">Drag to orbit · right-drag to pan · scroll to zoom · Space pauses · 1/2/3 set speed</p>
        <button className="btn primary wide" onClick={onClose}>Open the doors</button>
      </div>
    </div>
  )
}

export default function HUD({ quality, setQuality }) {
  const selected = useGame((s) => s.selected)
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
      if (e.key === 'Escape') { useGame.getState().setTool(null); useGame.getState().setSelected(null); useGame.setState({ rail: null }) }
      if (e.key === ' ') { e.preventDefault(); setSpeed(game.speed ? 0 : 1); syncUI() }
      if (['1', '2', '3'].includes(e.key)) { setSpeed([1, 2, 4][+e.key - 1]); syncUI() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="hud">
      <Nav />
      <Kpis />
      <Rail />
      <div className="right-col">
        <MapControls quality={quality} setQuality={setQuality} onHelp={() => setHelp(true)} />
        {selected && <Detail roomKey={selected} />}
      </div>
      <Toasts />
      <ToolHint />
      <OwnerCard />
      <Journey />
      <Board />
      <DaySummary />
      {help && <Help onClose={closeHelp} />}
    </div>
  )
}
