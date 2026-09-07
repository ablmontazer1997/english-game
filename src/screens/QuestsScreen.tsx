import { useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Panel, Art, art, PAGE_BG, type ArtName } from '../components/PageArt'
import questIcon from '../assets/sky/nav2_quests.png'
import type { Quest } from '../types/game'
import './pages.css'

const QUEST_ICONS: ArtName[] = ['qi_star', 'qi_potion', 'qi_crystal', 'qi_chest', 'qi_flame']

function resetIn(period: 'daily' | 'weekly') {
  const now = new Date()
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  if (period === 'weekly') end.setDate(end.getDate() + ((7 - now.getDay()) % 7))
  const ms = end.getTime() - now.getTime()
  const h = Math.floor(ms / 36e5)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 36e5) / 6e4)}m`
}

function QuestRow({ q, i, onClaim }: { q: Quest; i: number; onClaim: (id: string) => void }) {
  const pct = Math.min(100, (q.progress / q.target) * 100)
  const ready = q.progress >= q.target && !q.done
  return (
    <Panel name="pnl_card4" inner="q-row" style={ready ? { filter: "drop-shadow(0 5px 12px rgba(20,60,110,.18)) drop-shadow(0 0 9px rgba(255,210,110,.95))" } : undefined}>
      <Art name={QUEST_ICONS[i % QUEST_ICONS.length]} className="q-ic" />
      <div className="q-main">
        <div className="q-title">{q.title}</div>
        <div className="q-prog">
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <b>{Math.min(q.progress, q.target)}/{q.target}</b>
        </div>
      </div>
      {ready
        ? <Panel name="btn_gold" className="q-cta" onClick={() => onClaim(q.id)}>Claim</Panel>
        : <img className="q-reward" src={art(q.done ? 'chest_open' : 'qi_chest')} alt="" draggable={false} />}
    </Panel>
  )
}

export function QuestsScreen() {
  const { quests, claimQuest } = useGame()
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const list = quests.filter((q) => q.period === period)

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.quests} alt="" draggable={false} />
      <div className="pg-scroll">
        <Panel name="pnl_card4" className="reveal" inner="pg-title">
          <img src={questIcon} alt="" draggable={false} style={{ width: 52, height: 'auto' }} />
          <span className="pg-title-t">Quests</span>
          <Panel name="chip_violet" className="pg-chip">{resetIn(period)}</Panel>
        </Panel>

        <div className="seg reveal" style={{ ['--seg-track' as string]: `url(${art('pnl_row6')})` }}>
          <span className="seg-pill" style={{
            backgroundImage: `url(${art('pnl_pill32')})`,
            left: period === 'daily' ? '1.5%' : '51.5%',
          }} />
          <button className={period === 'daily' ? 'on' : ''} onClick={() => setPeriod('daily')}>Daily</button>
          <button className={period === 'weekly' ? 'on' : ''} onClick={() => setPeriod('weekly')}>Weekly</button>
        </div>

        {list.map((q, i) => <QuestRow key={q.id} q={q} i={i} onClaim={claimQuest} />)}
        {!list.length && <div className="pg-h">No {period} quests right now</div>}
      </div>
    </div>
  )
}
