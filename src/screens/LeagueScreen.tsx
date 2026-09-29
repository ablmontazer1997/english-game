import { useGame } from '../services/ServiceProvider'
import { Panel, art, PAGE_BG, type ArtName } from '../components/PageArt'
import { RewardChips, useCountdown } from '../components/Rewards'
import { usePortrait } from '../components/Portrait'
import { leagueReward, TIERS } from '../services/progress'
import type { LeagueTier } from '../types/game'
import './pages.css'
import '../components/progression.css'

// five painted tier crests for six tiers: Legend reuses the top crest with a golden glow
const TIER_ART: Record<LeagueTier, ArtName> = {
  bronze: 'tier_2', silver: 'tier_1', gold: 'tier_4', ruby: 'tier_3', astral: 'tier_5', legend: 'tier_5',
}
const LABEL: Record<LeagueTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', ruby: 'Ruby', astral: 'Astral', legend: 'Legend',
}
const DISC: ArtName[] = ['rank_gold', 'rank_silver', 'rank_bronze']

export function LeagueScreen() {
  const { league, inventory, seenLeagueResult, showReward } = useGame()
  const portrait = usePortrait()
  const left = useCountdown(league?.endsAt ?? 0)
  const boost = useCountdown(inventory?.xpBoostUntil ?? 0)
  if (!league) return <div className="screen pg" />
  const n = league.entries.length
  const myRank = league.entries.findIndex((e) => e.isMe) + 1
  const ti = TIERS.indexOf(league.tier)
  const last = league.last

  const collect = async () => {
    const r = last!.reward
    await seenLeagueResult()
    if (Object.keys(r).length) showReward('League rewards', r)
  }

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.league} alt="" draggable={false} />
      <div className="pg-scroll">
        <div className="lg-hero reveal">
          <img className={`lg-trophy${league.tier === 'legend' ? ' lg-legend' : ''}`} src={art(TIER_ART[league.tier])} alt="" draggable={false} />
          <div className="lg-name">{LABEL[league.tier]} League</div>
          <Panel name="chip_violet" className="pg-chip">Ends in {left.label}</Panel>
        </div>

        {/* the ladder: where you are and what's next */}
        <div className="lg-ladder">
          {TIERS.map((t, i) => (
            <span key={t} className={`lg-step${i === ti ? ' on' : i < ti ? ' past' : ''}`}>
              <img src={art(TIER_ART[t])} alt="" draggable={false} className={t === 'legend' ? 'lg-legend' : ''} />
              <small>{LABEL[t]}</small>
            </span>
          ))}
        </div>

        <Panel name="pnl_card4" inner="lg-how">
          <span>Win stages to earn <b>XP</b>. When the week ends, the <b className="up">top 3</b> move up a league{league.demoteCount ? <>, the <b className="down">bottom 3</b> move down</> : null}.</span>
          {boost.ms > 0 && <span className="lg-boost">Double XP · {boost.label}</span>}
        </Panel>

        <div className="lg-list">
          {league.entries.map((e, i) => {
            const zone = i < league.promoteCount ? 'promote' : i >= n - league.demoteCount ? 'demote' : ''
            const rw = leagueReward(i + 1)
            return (
              <div key={e.playerId}>
                {i === league.promoteCount && league.promoteCount > 0 && <div className="lg-cut up">▲ Promotion zone</div>}
                {i === n - league.demoteCount && <div className="lg-cut down">▼ Demotion zone</div>}
                <div className={`lg-zone ${zone}`}>
                  <Panel name={e.isMe ? 'pnl_row6v' : 'pnl_row6'} inner={`lg-row${e.isMe ? ' lg-row-me' : ''}`}>
                    <span className="lg-rank">
                      {i < 3 ? <><img src={art(DISC[i])} alt="" draggable={false} /><span>{i + 1}</span></> : i + 1}
                    </span>
                    <span className="lg-nm">
                      {e.isMe ? <img className="lg-face" src={portrait} alt="" /> : <i className="lg-dot" style={{ background: `hsl(${(e.name.charCodeAt(0) * 47) % 360} 70% 62%)` }}>{e.name[0]}</i>}
                      {e.isMe ? 'You' : e.name}
                      {i < 10 && Object.keys(rw).length > 0 && <span className="lg-rw"><RewardChips reward={rw} size={13} /></span>}
                    </span>
                    <span className="lg-lp">{e.lp.toLocaleString('en-US')} XP</span>
                  </Panel>
                </div>
              </div>
            )
          })}
        </div>
        <p className="pg-note">You are #{myRank}. Rewards are paid when the week ends.</p>
      </div>

      {last && (
        <div className="rw-scrim">
          <div className="rw-card">
            <div className="rw-rays" />
            <div className="rw-title">Last week: #{last.rank} in {LABEL[last.tier]}</div>
            <img className="lg-result-art" src={art(TIER_ART[TIERS[TIERS.indexOf(last.tier) + last.moved]])} alt="" />
            <p className="rw-note">{last.moved > 0 ? `Promoted to ${LABEL[TIERS[TIERS.indexOf(last.tier) + 1]]}!` : last.moved < 0 ? `Moved down to ${LABEL[TIERS[TIERS.indexOf(last.tier) - 1]]}. You'll climb back!` : `You stay in ${LABEL[last.tier]}.`}</p>
            {Object.keys(last.reward).length > 0 && <RewardChips reward={last.reward} size={22} />}
            <Panel name="btn_gold" className="rw-ok" onClick={collect}>{Object.keys(last.reward).length ? 'Collect' : 'OK'}</Panel>
          </div>
        </div>
      )}
    </div>
  )
}
