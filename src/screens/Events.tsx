// Phase E (admin 4847, Q8 = A): the two weekly events, scheduled by the SERVER (GET /v1/events, the player's local
// weekday): Boss Rush on Saturday + Sunday (bosses pay gems again), Double XP on Wednesday. The app only shows what
// the server says, with a live countdown; every reward is computed by the server when a stage is graded.
import { useEffect, useState } from 'react'
import { api, type EventOut } from '../services/api'
import { useGame } from '../services/ServiceProvider'
import { Card, Chip } from '../components/PageArt'
import { useCountdown } from '../components/Rewards'
import bossIcon from '../assets/padicons/pk_boss.webp'
import xpIcon from '../assets/sky/ic_energy.png'
import './events.css'

const ICON: Record<string, string> = { boss: bossIcon, xp: xpIcon }

/** the events (null until loaded, [] offline / mock); refetched when the shown one starts or ends */
export function useEvents(): EventOut[] | null {
  const { mode } = useGame()
  const [ev, setEv] = useState<EventOut[] | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (mode !== 'http') { setEv([]); return }
    let alive = true
    api.events().then((r) => { if (alive) setEv(r.events) }).catch(() => { if (alive) setEv([]) })
    return () => { alive = false }
  }, [mode, n])
  // the next boundary (an event starting or ending): fetch again then
  useEffect(() => {
    if (!ev?.length) return
    const now = Date.now()
    const next = Math.min(...ev.map((e) => (e.active ? e.ends_at : e.starts_at)).filter((t) => t > now))
    if (!isFinite(next)) return
    const t = setTimeout(() => setN((x) => x + 1), Math.min(next - now + 1500, 6 * 3600e3))
    return () => clearTimeout(t)
  }, [ev])
  return ev
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const when = (e: EventOut) => e.days.length > 1 ? `${DAY[(e.days[0] + 1) % 7]} + ${DAY[(e.days[e.days.length - 1] + 1) % 7]}` : DAY[(e.days[0] + 1) % 7]

/** map: one pill under the status bar, the event that is on (else the next one), with its countdown */
export function MapEventPill({ onOpen }: { onOpen?: () => void }) {
  const ev = useEvents()
  const e = ev?.[0]
  const left = useCountdown(e ? (e.active ? e.ends_at : e.starts_at) : 0)
  if (!e) return null
  return (
    <button className={`evp reveal${e.active ? ' is-on' : ''}`} onClick={onOpen}
      aria-label={e.active ? `${e.title} is on, ends in ${left.label}` : `${e.title} starts in ${left.label}`}>
      <img src={ICON[e.icon] ?? bossIcon} alt="" draggable={false} />
      <span className="evp-tx">
        <b>{e.title}</b>
        <small>{e.active ? <><i className="evp-live">Live</i>{left.label} left</> : <>{when(e)} · in {left.label}</>}</small>
      </span>
    </button>
  )
}

function EventRow({ e }: { e: EventOut }) {
  const left = useCountdown(e.active ? e.ends_at : e.starts_at)
  return (
    <div className={`evr${e.active ? ' is-on' : ''}`}>
      <span className="evr-ic"><img src={ICON[e.icon] ?? bossIcon} alt="" draggable={false} /></span>
      <span className="evr-main">
        <span className="evr-top"><b>{e.title}</b><small>{when(e)}</small></span>
        <span className="evr-blurb">{e.blurb}</span>
      </span>
      <Chip className={`evr-chip${e.active ? ' is-on' : ''}`}>{e.active ? `${left.label} left` : `in ${left.label}`}</Chip>
    </div>
  )
}

/** Quests page: both weekly events with their rules and countdowns */
export function EventsCard() {
  const ev = useEvents()
  if (!ev?.length) return null
  return (
    <Card className="reveal evc">
      <div className="evc-h"><b className="ui-t">Weekly events</b></div>
      {ev.map((e) => <EventRow key={e.id} e={e} />)}
    </Card>
  )
}
