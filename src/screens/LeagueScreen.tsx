import { useGame } from '../services/ServiceProvider'
import { Panel, art, PAGE_BG, type ArtName } from '../components/PageArt'
import type { LeagueTier } from '../types/game'
import './pages.css'

const TIER_ART: Record<LeagueTier, ArtName> = {
  bronze: 'tier_2', silver: 'tier_1', gold: 'tier_4',
  ruby: 'tier_3', astral: 'tier_5', legend: 'tier_5',
}
const RAIL: ArtName[] = ['tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5']
const LABEL: Record<LeagueTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', ruby: 'Ruby', astral: 'Astral', legend: 'Legend',
}
const DISC: ArtName[] = ['rank_gold', 'rank_silver', 'rank_bronze']

export function LeagueScreen() {
  const { league } = useGame()
  if (!league) return <div className="screen pg" />
  const n = league.entries.length
  const ms = Math.max(0, league.endsAt - Date.now())
  const days = Math.floor(ms / 864e5)
  const left = `${days}d ${Math.floor((ms % 864e5) / 36e5)}h`
  const mine = TIER_ART[league.tier]

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.league} alt="" draggable={false} />
      <div className="pg-scroll">
        <div className="lg-hero reveal">
          <img className="lg-trophy" src={art('trophy_big')} alt="" draggable={false} />
          <div className="lg-name">{LABEL[league.tier]} League</div>
          <Panel name="chip_violet" className="pg-chip">{left}</Panel>
        </div>

        <div className="lg-rail">
          {RAIL.map((t) => (
            <img key={t} src={art(t)} alt="" draggable={false} className={t === mine ? 'on' : ''} />
          ))}
        </div>

        <div className="lg-list">
          {league.entries.map((e, i) => {
            const zone = i < league.promoteCount ? 'promote'
              : i >= n - league.demoteCount ? 'demote' : ''
            return (
              <div key={e.playerId} className={`lg-zone ${zone}`}>
                <Panel name={e.isMe ? 'pnl_row6v' : 'pnl_row6'} inner={`lg-row${e.isMe ? ' lg-row-me' : ''}`}>
                  <span className="lg-rank">
                    {i < 3
                      ? <><img src={art(DISC[i])} alt="" draggable={false} /><span>{i + 1}</span></>
                      : i + 1}
                  </span>
                  <span className="lg-nm">{e.isMe ? 'You' : e.name}</span>
                  <span className="lg-lp">{e.lp.toLocaleString('en-US')} XP</span>
                </Panel>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
