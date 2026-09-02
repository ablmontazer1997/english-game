import type { ReactNode } from 'react'
import { useGame } from '../services/ServiceProvider'
import { FlameIcon } from '../components/Icon'
import { ImgIcon } from '../components/ImgIcon'
import { Bar } from '../components/Bar'
import type { Quest, Reward } from '../types/game'
import './screens.css'
import './screens2.css'

// Varied medallion icon per quest so the list reads like the mockup, chosen
// stably from the quest's position rather than random.
const ICONS: ((s: number) => ReactNode)[] = [
  (s) => <FlameIcon size={s} />,
  (s) => <ImgIcon name="gem" size={s} />,
  (s) => <ImgIcon name="potion" size={s} />,
  (s) => <ImgIcon name="chest_closed" size={s} />,
  (s) => <ImgIcon name="badge" size={s} />,
]

function RewardView({ r }: { r: Reward }) {
  return (
    <div className="rc-reward">
      {r.coins != null && <span><ImgIcon name="coin" size={18} />{r.coins}</span>}
      {r.gems != null && <span><ImgIcon name="gem" size={18} />{r.gems}</span>}
      {r.potion != null && <span><ImgIcon name="potion" size={18} />{r.potion}</span>}
      {r.chest != null && <span><ImgIcon name="chest_closed" size={18} />Chest</span>}
    </div>
  )
}

function QuestCard({ q, i, onClaim }: { q: Quest; i: number; onClaim: (id: string) => void }) {
  const pct = Math.min(100, (q.progress / q.target) * 100)
  const ready = q.progress >= q.target && !q.done
  return (
    <div className="rc-crow">
      <div className="rc-medallion"><div className="rc-medallion-in">{ICONS[i % ICONS.length](34)}</div></div>
      <div className="rc-crow-main">
        <b>{q.title}</b>
        <RewardView r={q.reward} />
        <div className="rc-prog">
          <Bar value={pct} tone="gold" />
          <span className="rc-prog-txt">{Math.min(q.progress, q.target)}/{q.target}</span>
        </div>
      </div>
      <button
        className={`btn-img ${ready ? 'green' : 'grey'} rc-crow-btn`}
        disabled={!ready} onClick={() => onClaim(q.id)}>
        {q.done ? <>Claimed<span className="rc-tick">✓</span></> : ready ? 'Claim' : 'In progress'}
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
        <div className="rc-banner"><h1>Quests</h1><p>Complete missions and earn rewards.</p></div>
        <div className="rc-sec"><span className="rc-sec-t">Daily</span></div>
        {daily.map((q, i) => <QuestCard key={q.id} q={q} i={i} onClaim={claimQuest} />)}
        <div className="rc-sec"><span className="rc-sec-t">Weekly</span></div>
        {weekly.map((q, i) => <QuestCard key={q.id} q={q} i={i + daily.length} onClaim={claimQuest} />)}
      </div>
    </div>
  )
}
