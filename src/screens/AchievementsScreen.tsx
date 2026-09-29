import { useMemo, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Panel, PAGE_BG } from '../components/PageArt'
import { RewardChips } from '../components/Rewards'
import { ACH_CATS } from '../services/progress'
import type { Achievement, AchievementCat } from '../types/game'
import './pages.css'
import '../components/progression.css'

const MEDALS = import.meta.glob('../assets/achv/ach_*.png', { eager: true, import: 'default' }) as Record<string, string>
export const medal = (cat: AchievementCat) => MEDALS[`../assets/achv/ach_${cat}.png`]
export const TIER_NAME = ['', 'Bronze', 'Silver', 'Gold', 'Astral']

/** claimable first, then closest to done, then finished ones */
const order = (a: Achievement) => (a.progress >= a.target && !a.claimed ? 0 : a.claimed ? 2 : 1)

function Card({ a, onClaim }: { a: Achievement; onClaim: (id: string) => void }) {
  const ready = a.progress >= a.target && !a.claimed
  const pct = Math.min(100, (a.progress / a.target) * 100)
  return (
    <Panel name="pnl_card4" inner="ac-row" className={`ac-card${a.claimed ? ' ac-done' : ''}${ready ? ' q-ready' : ''}`}>
      <span className={`ac-medal t${a.tier}${a.claimed || ready ? '' : ' ac-locked'}`}>
        <img src={medal(a.cat)} alt="" draggable={false} />
        <i>{TIER_NAME[a.tier]}</i>
      </span>
      <span className="ac-main">
        <b>{a.title}</b>
        <small>{a.desc}</small>
        {!a.claimed && <span className="q-prog"><span className="bar"><i style={{ width: `${pct}%` }} /></span><b>{a.progress.toLocaleString('en-US')}/{a.target.toLocaleString('en-US')}</b></span>}
      </span>
      {ready ? <Panel name="btn_gold" className="q-cta" onClick={() => onClaim(a.id)}>Claim</Panel>
        : a.claimed ? <span className="q-check">✓</span> : <span className="q-rw"><RewardChips reward={a.reward} size={15} /></span>}
    </Panel>
  )
}

export function AchievementsScreen({ onClose }: { onClose: () => void }) {
  const { achievements, claimAchievement } = useGame()
  const [cat, setCat] = useState<AchievementCat | 'all'>('all')
  const done = achievements.filter((a) => a.claimed).length
  const ready = achievements.filter((a) => a.progress >= a.target && !a.claimed).length
  // show each family's next step (and finished ones), not four cards of the same goal at once
  const list = useMemo(() => {
    const byFam: Record<string, Achievement[]> = {}
    for (const a of achievements) (byFam[a.id.split('.')[0]] ??= []).push(a)
    const out: Achievement[] = []
    const isReady = (a: Achievement) => a.progress >= a.target && !a.claimed
    for (const fam of Object.values(byFam)) {
      out.push(...fam.filter((a) => a.claimed || isReady(a)))
      const next = fam.find((a) => !a.claimed && !isReady(a))
      if (next) out.push(next)
    }
    return out.filter((a) => cat === 'all' || a.cat === cat).sort((x, y) => order(x) - order(y) || (y.progress / y.target) - (x.progress / x.target))
  }, [achievements, cat])

  return (
    <div className="screen pg ac-screen">
      <img className="pg-bg" src={PAGE_BG.profile} alt="" draggable={false} />
      <div className="pg-scroll ac-scroll">
        <Panel name="pnl_card4" className="reveal" inner="pg-title">
          <button className="ac-back" onClick={onClose} aria-label="Back">‹</button>
          <span className="pg-title-t">Achievements</span>
          <Panel name="chip_violet" className="pg-chip">{done}/{achievements.length}</Panel>
        </Panel>
        {ready > 0 && <p className="pg-note ac-ready">{ready} reward{ready > 1 ? 's' : ''} ready to claim!</p>}

        <div className="ac-cats">
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>All</button>
          {ACH_CATS.map((c) => (
            <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
              <img src={medal(c.id)} alt="" />{c.label}
            </button>
          ))}
        </div>

        {list.map((a) => <Card key={a.id} a={a} onClaim={claimAchievement} />)}
      </div>
    </div>
  )
}
