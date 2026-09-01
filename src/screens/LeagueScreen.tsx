import { useGame } from '../services/ServiceProvider'
import { LeagueIcon } from '../components/Icon'
import type { LeagueTier } from '../types/game'
import './screens.css'

const TIERS: { id: LeagueTier; label: string; color: string }[] = [
  { id: 'bronze', label: 'Bronze', color: '#c98a4a' },
  { id: 'silver', label: 'Silver', color: '#c7d0e0' },
  { id: 'gold', label: 'Gold', color: '#f5c451' },
  { id: 'ruby', label: 'Ruby', color: '#ff5d6c' },
  { id: 'astral', label: 'Astral', color: '#9a6bff' },
  { id: 'legend', label: 'Legend', color: '#57c8ff' },
]

export function LeagueScreen() {
  const { league } = useGame()
  if (!league) return <div className="screen" />
  const tier = TIERS.find((t) => t.id === league.tier)!
  const days = Math.max(0, Math.ceil((league.endsAt - Date.now()) / 864e5))

  return (
    <div className="screen">
      <div className="page reveal">
        <h1 className="page-title">Weekly League</h1>
        <p className="page-sub">{days} days left this week · Top 3 promote, bottom 3 demote.</p>

        <div className="tile" style={{ justifyContent: 'center', gap: 10, borderColor: tier.color + '55' }}>
          <span style={{ color: tier.color, filter: `drop-shadow(0 0 8px ${tier.color}88)` }}><LeagueIcon size={26} /></span>
          <b style={{ fontSize: 17, color: tier.color }}>{tier.label} League</b>
        </div>

        <div className="section-label">Cohort Standings</div>
        {league.entries.map((e, i) => {
          const zone = i < league.promoteCount ? 'promote' : i >= league.entries.length - league.demoteCount ? 'demote' : ''
          return (
            <div key={e.playerId} className="tile" style={{
              padding: '10px 14px',
              background: e.isMe ? 'linear-gradient(160deg, rgba(87,200,255,.16), rgba(12,20,64,.7))' : undefined,
              borderColor: e.isMe ? 'rgba(87,200,255,.4)' : undefined,
            }}>
              <div className="rank" style={{
                width: 28, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, flex: 'none',
                color: zone === 'promote' ? 'var(--emerald)' : zone === 'demote' ? 'var(--rose)' : 'var(--ink-faint)',
              }}>{i + 1}</div>
              <div className="tile-main"><b style={{ color: e.isMe ? 'var(--cyan)' : undefined }}>{e.name}{e.isMe ? ' (You)' : ''}</b></div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--gold)' }}>{e.lp} LP</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
