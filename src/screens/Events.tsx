// Phase E (admin 4847, Q8 = A): the two weekly events, scheduled by the SERVER (GET /v1/events, the player's local
// weekday): Boss Rush on Saturday + Sunday (bosses pay gems again), Double XP on Wednesday. The app only shows what
// the server says, with a live countdown; every reward is computed by the server when a stage is graded.
import { useEffect, useState } from 'react'
import { api, mockFx, type EventOut } from '../services/api'
import { useGame } from '../services/ServiceProvider'
import { useCountdown } from '../components/Rewards'
import bossIcon from '../assets/padicons/pk_boss.webp'
import xpIcon from '../assets/sky/ic_energy.png'
import './events.css'
import bossArt from '../assets/games/boss/boss_normal.webp'
import burst from '../assets/es2/quests/burst.webp'
import twoX from '../assets/es2/quests/twox.webp'
import gemPile from '../assets/es2/quests/gems.webp'
import xpPot from '../assets/es2/quests/xp.webp'

const ICON: Record<string, string> = { boss: bossIcon, xp: xpIcon }

/** the events (null until loaded, [] offline / mock); refetched when the shown one starts or ends */
export function useEvents(): EventOut[] | null {
  const { mode } = useGame()
  const [ev, setEv] = useState<EventOut[] | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (mode !== 'http' && !mockFx('GET /v1/events')) { setEv([]); return }
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

// ES redesign 10-11 (concept 02): an illustrated event card. Boss Rush shows OUR lilac grammar boss (not a dragon),
// Double XP the gold "2x" spell book; the sticker on the right says what the event pays.
const ART: Record<string, string> = { boss: bossArt, xp: twoX }
function EventRow({ e }: { e: EventOut }) {
  const left = useCountdown(e.active ? e.ends_at : e.starts_at)
  const gems = /(\d+) gems/.exec(e.blurb)?.[1]
  const [more, setMore] = useState(false)
  // compact like the concept: the one-line summary, the full rules on tap
  return (
    <div className={`evr2${e.active ? ' is-on' : ''}${more ? ' is-more' : ''}`} role="button" tabIndex={0} aria-expanded={more}
      onClick={() => setMore(!more)} onKeyDown={(k) => { if (k.key === 'Enter' || k.key === ' ') setMore(!more) }}>
      <span className="evr2-art"><img className="evr2-burst" src={burst} alt="" draggable={false} />
        <img className={`evr2-pic evr2-${e.icon}`} src={ART[e.icon] ?? bossArt} alt="" draggable={false} /></span>
      <span className="evr2-main">
        <span className="evr2-top"><b>{e.title}</b><i className={`evr2-day${e.active ? ' is-on' : ''}`}>{when(e)}</i></span>
        <span className="evr2-blurb">{more ? e.blurb : e.short}</span>
        <span className={`evr2-time${e.active ? ' is-on' : ''}`}>{e.active ? <><i className="evp-live">Live</i>{left.label} left</> : <>Starts in {left.label}</>}</span>
      </span>
      <span className="evr2-stick">
        {e.icon === 'xp' ? <img className="evr2-xp" src={xpPot} alt="" draggable={false} />
          : <><img className="evr2-gems" src={gemPile} alt="" draggable={false} />{gems && <b className="evr2-plus">+{gems} gems</b>}</>}
      </span>
    </div>
  )
}

/** Quests page: both weekly events with their rules and countdowns */
export function EventsCard() {
  const ev = useEvents()
  if (!ev?.length) return null
  return (
    <div className="evc2 esk-enter" style={{ ['--i' as string]: 1 }}>
      <h2 className="evc2-h">Weekly events</h2>
      {ev.map((e) => <EventRow key={e.id} e={e} />)}
    </div>
  )
}
