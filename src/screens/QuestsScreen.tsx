import { useGame } from '../services/ServiceProvider'
import { CoinIcon, GemIcon, PotionIcon, ChestIcon, FlameIcon } from '../components/Icon'
import type { Quest, Reward } from '../types/game'
import './screens.css'

function RewardView({ r }: { r: Reward }) {
  return (
    <span className="reward-chip">
      {r.coins != null && <><CoinIcon size={14} />{r.coins}</>}
      {r.gems != null && <><GemIcon size={14} />{r.gems}</>}
      {r.potion != null && <><PotionIcon size={14} />{r.potion}</>}
      {r.chest != null && <><ChestIcon size={14} />Chest</>}
    </span>
  )
}

function QuestTile({ q, onClaim }: { q: Quest; onClaim: (id: string) => void }) {
  const pct = Math.min(100, (q.progress / q.target) * 100)
  const ready = q.progress >= q.target && !q.done
  return (
    <div className="tile">
      <div className="tile-ic"><FlameIcon size={20} /></div>
      <div className="tile-main">
        <b>{q.title}</b>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <RewardView r={q.reward} />
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>{Math.min(q.progress, q.target)}/{q.target}</span>
        </div>
        <div className="tile-bar"><i style={{ width: pct + '%' }} /></div>
      </div>
      <button className={`btn ${q.done ? 'btn-ghost' : ready ? 'btn-claim' : 'btn-ghost'}`}
        disabled={!ready} onClick={() => onClaim(q.id)}>
        {q.done ? 'Claimed' : ready ? 'Claim' : 'In progress'}
      </button>
    </div>
  )
}

export function QuestsScreen() {
  const { quests, claimQuest } = useGame()
  const daily = quests.filter((q) => q.period === 'daily')
  const weekly = quests.filter((q) => q.period === 'weekly')
  return (
    <div className="screen">
      <div className="page reveal">
        <h1 className="page-title">Quests</h1>
        <p className="page-sub">Complete missions and earn rewards.</p>
        <div className="section-label">Daily</div>
        {daily.map((q) => <QuestTile key={q.id} q={q} onClaim={claimQuest} />)}
        <div className="section-label">Weekly</div>
        {weekly.map((q) => <QuestTile key={q.id} q={q} onClaim={claimQuest} />)}
      </div>
    </div>
  )
}
