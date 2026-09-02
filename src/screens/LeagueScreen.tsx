import { useGame } from '../services/ServiceProvider'
import { ImgIcon } from '../components/ImgIcon'
import type { LeagueTier } from '../types/game'
import './screens.css'
import './screens2.css'

const TIERS: Record<LeagueTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', ruby: 'Ruby', astral: 'Astral', legend: 'Legend',
}

export function LeagueScreen() {
  const { league } = useGame()
  if (!league) return <div className="screen" />
  const label = TIERS[league.tier] ?? 'Gold'
  const days = Math.max(0, Math.ceil((league.endsAt - Date.now()) / 864e5))
  const n = league.entries.length

  return (
    <div className="screen">
      <div className="page reveal">
        <div className="rc-banner">
          <h1>Weekly League</h1>
          <p>{days} days left this week · Top {league.promoteCount} promote, bottom {league.demoteCount} demote.</p>
        </div>

        <div className="rc-tier">
          <ImgIcon name="badge" size={112} className="rc-tier-badge" />
          <div className="rc-tier-name">{label} League</div>
        </div>

        <div className="rc-sec"><span className="rc-sec-t">Cohort Standings</span></div>

        {league.entries.map((e, i) => {
          const zone = i < league.promoteCount ? 'promote'
            : i >= n - league.demoteCount ? 'demote' : ''
          const cls = `rc-lrow${zone ? ' ' + zone : ''}${e.isMe ? ' me' : ''}`
          return (
            <div key={e.playerId} className={cls}>
              <div className="rc-lrank">{i + 1}</div>
              <div className="rc-lname">{e.name}{e.isMe ? ' (You)' : ''}</div>
              <div className="rc-llp">{e.lp}<small>LP</small></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
