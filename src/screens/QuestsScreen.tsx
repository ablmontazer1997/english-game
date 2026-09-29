import { useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Panel, Art, art, PAGE_BG, type ArtName } from '../components/PageArt'
import { RewardChips, ChestStrip, useCountdown } from '../components/Rewards'
import { dayEnd, weekEnd } from '../services/progress'
import questIcon from '../assets/sky/nav2_quests.png'
import type { Quest } from '../types/game'
import './pages.css'
import '../components/progression.css'

// icon per quest kind (the id's last part), bonus chests get the chest
const ICON: Record<string, ArtName> = {
  win: 'qi_star', three: 'qi_star', stars: 'qi_star', correct: 'qi_crystal', xp: 'qi_flame', variety: 'qi_crystal',
  wwin: 'qi_star', wthree: 'qi_star', wcorrect: 'qi_crystal', wboss: 'qi_flame', wxp: 'qi_flame', all: 'qi_chest', days: 'qi_chest',
}

function QuestRow({ q, onClaim }: { q: Quest; onClaim: (id: string) => void }) {
  const pct = Math.min(100, (q.progress / q.target) * 100)
  const ready = q.progress >= q.target && !q.done
  return (
    <Panel name="pnl_card4" inner="q-row" className={`q-card${q.bonus ? ' q-bonus' : ''}${q.done ? ' q-done' : ''}${ready ? ' q-ready' : ''}`}>
      <Art name={ICON[q.id.split(':').pop()!] ?? 'qi_star'} className="q-ic" />
      <div className="q-main">
        <div className="q-title">{q.title}</div>
        <div className="q-prog">
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <b>{Math.min(q.progress, q.target)}/{q.target}</b>
        </div>
      </div>
      {ready
        ? <Panel name="btn_gold" className="q-cta" onClick={() => onClaim(q.id)}>Claim</Panel>
        : q.done ? <span className="q-check">✓</span>
          : <span className="q-rw"><RewardChips reward={q.reward} size={16} /></span>}
    </Panel>
  )
}

export function QuestsScreen() {
  const { quests, claimQuest } = useGame()
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const list = quests.filter((q) => q.period === period)
  const main = list.filter((q) => !q.bonus), bonus = list.filter((q) => q.bonus)
  const left = useCountdown(period === 'daily' ? dayEnd() : weekEnd())

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.quests} alt="" draggable={false} />
      <div className="pg-scroll">
        <Panel name="pnl_card4" className="reveal" inner="pg-title">
          <img src={questIcon} alt="" draggable={false} style={{ width: 52, height: 'auto' }} />
          <span className="pg-title-t">Quests</span>
          <Panel name="chip_violet" className="pg-chip">{left.label}</Panel>
        </Panel>

        <div className="seg reveal" style={{ ['--seg-track' as string]: `url(${art('pnl_row6')})` }}>
          <span className="seg-pill" style={{
            backgroundImage: `url(${art('pnl_pill32')})`,
            left: period === 'daily' ? '1.5%' : '51.5%',
          }} />
          <button className={period === 'daily' ? 'on' : ''} onClick={() => setPeriod('daily')}>Daily</button>
          <button className={period === 'weekly' ? 'on' : ''} onClick={() => setPeriod('weekly')}>Weekly</button>
        </div>

        <p className="pg-note">{period === 'daily'
          ? 'New quests every day. Finish all three to win the daily chest.'
          : 'Bigger goals for the whole week. Finish your dailies on 5 days for an Epic Chest.'}</p>

        {main.map((q) => <QuestRow key={q.id} q={q} onClaim={claimQuest} />)}
        {bonus.map((q) => <QuestRow key={q.id} q={q} onClaim={claimQuest} />)}

        <ChestStrip />
      </div>
    </div>
  )
}
