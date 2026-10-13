import { useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Btn, Chip } from '../components/PageArt'
import { RewardChips, ChestStrip, useCountdown } from '../components/Rewards'
import { dayEnd, weekEnd } from '../services/progress'
import type { Quest } from '../types/game'
import { SeasonEntry } from './SeasonPassScreen'
import { EventsCard } from './Events'
import bgQuests from '../assets/es2/quests/bg_quests_dusk.webp'   // admin 5419/5425/5427: its own clay dusk (scroll library)
import heroArt from '../assets/games/boss2/hero_cheer.webp'
import scrollArt from '../assets/es2/quests/scroll.webp'
import trophyArt from '../assets/es2/quests/trophy.webp'
import tileStar from '../assets/es2/quests/tile_star.webp'
import tileScroll from '../assets/es2/quests/tile_scroll.webp'
import tileFlame from '../assets/es2/quests/tile_flame.webp'
import cpStar from '../assets/es2/quests/cp_star.webp'
import cpSilver from '../assets/es2/quests/cp_silver.webp'
import cpGift from '../assets/es2/quests/cp_gift.webp'
import chestClosed from '../assets/es2/quests/chest_closed.webp'
import chestOpen from '../assets/es2/quests/chest_open.webp'
import ledgeArt from '../assets/es2/quests/ledge.webp'
import './pages.css'
import '../components/progression.css'
import '../components/eskit.css'
import './quests2.css'

// ES redesign 10-11 (concept 02, admin 4935): scroll banner with our hero, illustrated weekly events, the Season Pass strip,
// quest cards with violet icon tiles and thick bars, and the daily chest track on a stone ledge. Art: the a5 asset sheet.
const TILE: Record<string, string> = {
  win: tileScroll, wwin: tileScroll, three: tileStar, wthree: tileStar, stars: tileStar,
  correct: tileFlame, wcorrect: tileFlame, xp: tileFlame, wxp: tileFlame, wboss: tileFlame, variety: tileScroll, cauldron: tileScroll,
}

// Phase B (audit P1): every open quest has a "Go" to where it is played
export type QuestGo = 'map' | 'cauldron'
const goOf = (q: Quest): QuestGo | null => {
  const k = q.id.split(':').pop()!
  if (q.bonus || k === 'all' || k === 'days') return null
  return k === 'cauldron' ? 'cauldron' : 'map'
}

function QuestRow({ q, i, onClaim, onGo }: { q: Quest; i: number; onClaim: (id: string) => void; onGo?: (to: QuestGo) => void }) {
  const go = onGo ? goOf(q) : null
  const pct = Math.min(100, (q.progress / q.target) * 100)
  const ready = q.progress >= q.target && !q.done
  return (
    <div className={`qs2-row esk-enter${q.done ? ' is-done' : ''}${ready ? ' is-ready' : ''}`} style={{ ['--i' as string]: i + 4 }}>
      <img className="qs2-tile" src={TILE[q.id.split(':').pop()!] ?? tileStar} alt="" draggable={false} />
      <b className="qs2-t">{q.title}</b>
      <span className="qs2-prog"><span className="qs2-bar"><i style={{ width: `${pct}%` }} /></span><b>{Math.min(q.progress, q.target)}/{q.target}</b></span>
      <div className="qs2-trail">
        {q.done ? <span className="q-check" aria-label="Done">✓</span>
          : <RewardChips reward={q.reward} size={18} />}
        {ready ? <Btn name="btn_gold" className="sm qs2-btn esk-shimmer" onClick={() => onClaim(q.id)}>Claim</Btn>
          : !q.done && go ? <Btn className="sm qs2-btn" onClick={() => onGo!(go)}>Go</Btn> : null}
      </div>
    </div>
  )
}

/** the daily (or weekly) chest track: one checkpoint per step of the bonus quest, the chest at the end on its ledge */
function ChestTrack({ q, onClaim }: { q: Quest; onClaim: (id: string) => void }) {
  const n = Math.min(7, Math.max(1, q.target)), got = Math.min(q.progress, q.target)
  const ready = got >= q.target && !q.done
  return (
    <div className={`qs2-track esk-enter${ready ? ' is-ready' : ''}${q.done ? ' is-done' : ''}${n > 3 ? ' is-long' : ''}`} style={{ ['--i' as string]: 9 }}>
      <img className="qs2-ledge" src={ledgeArt} alt="" draggable={false} />
      <div className="qs2-path" aria-label={`${q.title}: ${got} of ${q.target}`}>
        <span className="qs2-line"><i style={{ width: `${n > 1 ? (Math.max(0, got - 1) / (n - 1)) * 100 : 100}%` }} /></span>
        {Array.from({ length: n }, (_, k) => {
          const last = k === n - 1, on = k < got
          return <img key={k} className={`qs2-cp${on ? ' on' : ''}${last ? ' gift' : ''}`} src={last ? cpGift : on ? cpStar : cpSilver} alt="" draggable={false} />
        })}
      </div>
      <div className="qs2-chest" aria-label={q.done ? 'Opened' : q.title}>
        <img className={ready ? 'esk-float' : ''} src={q.done ? chestOpen : chestClosed} alt="" draggable={false} />
        {ready ? <Btn name="btn_gold" className="sm qs2-btn esk-shimmer" onClick={() => onClaim(q.id)}>Open</Btn>
          : null}
      </div>
    </div>
  )
}

export function QuestsScreen({ onGo, onSeason }: { onGo?: (to: QuestGo) => void; onSeason?: () => void }) {
  const { quests, claimQuest } = useGame()
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const list = quests.filter((q) => q.period === period)
  const main = list.filter((q) => !q.bonus), bonus = list.filter((q) => q.bonus)
  const left = useCountdown(period === 'daily' ? dayEnd() : weekEnd())

  return (
    <div className="screen pg qs2">
      <img className="pg-bg" src={bgQuests} alt="" draggable={false} />
      <div className="pg-scroll qs2-scroll">
        <div className="qs2-head esk-enter">
          <img className="qs2-hero" src={heroArt} alt="" draggable={false} />
          <div className="qs2-banner">
            <img src={scrollArt} alt="" draggable={false} />
            <div className="qs2-banner-in">
              <h1 className="qs2-title">Quests</h1>
              <Chip className="qs2-timer">{left.label}</Chip>
            </div>
          </div>
        </div>
        <EventsCard />
        {onSeason && <SeasonEntry onOpen={onSeason} trophy={trophyArt} />}

        <div className="qs2-seg esk-enter" role="tablist" style={{ ['--i' as string]: 3 }}>
          <span className="qs2-seg-pill" style={{ transform: period === 'daily' ? 'none' : 'translateX(100%)' }} />
          <button role="tab" aria-selected={period === 'daily'} className={period === 'daily' ? 'on' : ''} onClick={() => setPeriod('daily')}>Daily</button>
          <button role="tab" aria-selected={period === 'weekly'} className={period === 'weekly' ? 'on' : ''} onClick={() => setPeriod('weekly')}>Weekly</button>
        </div>

        {main.map((q, i) => <QuestRow key={q.id} q={q} i={i} onClaim={claimQuest} onGo={onGo} />)}
        {bonus.map((q) => <ChestTrack key={q.id} q={q} onClaim={claimQuest} />)}

        <ChestStrip />
      </div>
    </div>
  )
}
