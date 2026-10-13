import { useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { NameSheet } from '../components/NameSheet'
import './serverstage.css'
import { Btn, Chip } from '../components/PageArt'
import { Sheet } from '../components/Sheet'
import bgLeague from '../assets/es2/league/bg_league_dusk.webp'   // admin 5421/5425: clay, dusk
import crBronze from '../assets/es2/league/crest_bronze.webp'
import crSilver from '../assets/es2/league/crest_silver.webp'
import crGold from '../assets/es2/league/crest_gold.webp'
import crRuby from '../assets/es2/league/crest_ruby.webp'
import crAstral from '../assets/es2/league/crest_astral.webp'
import crLegend from '../assets/es2/league/crest_legend.webp'
import crown from '../assets/es2/league/crown.webp'
import lockArt from '../assets/es2/league/lock.webp'
import laurelL from '../assets/es2/league/laurel_l.webp'
import laurelR from '../assets/es2/league/laurel_r.webp'
import plGold from '../assets/es2/league/plinth_gold.webp'
import plSilver from '../assets/es2/league/plinth_silver.webp'
import plBronze from '../assets/es2/league/plinth_bronze.webp'
import './league2.css'
// 12 preset looks rendered from our 3D wardrobe (?portrait=1) for rivals, picked by player id (admin 4986)
const LOOKS = Object.values(import.meta.glob('../assets/es2/league/looks/*.webp', { eager: true, import: 'default' })) as string[]
const lookOf = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return LOOKS[h % LOOKS.length] }
import { RewardChips, useCountdown } from '../components/Rewards'
import { usePortrait } from '../components/Portrait'
import { leagueReward, TIERS } from '../services/progress'
import type { LeagueTier } from '../types/game'
import './pages.css'
import '../components/progression.css'

const LABEL: Record<LeagueTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', ruby: 'Ruby', astral: 'Astral', legend: 'Legend',
}
// ES redesign concept 03 (admin 4935): the a6 sheet's six crests, podium plinths, crown, laurels, zone ribbons; a7 arena
const CREST: Record<LeagueTier, string> = { bronze: crBronze, silver: crSilver, gold: crGold, ruby: crRuby, astral: crAstral, legend: crLegend }
const PLINTH = [plGold, plSilver, plBronze]

export function LeagueScreen() {
  const { league, inventory, seenLeagueResult, showReward, mode } = useGame()
  const server = mode === 'http'
  const portrait = usePortrait()
  const left = useCountdown(league?.endsAt ?? 0)
  const boost = useCountdown(inventory?.xpBoostUntil ?? 0)
  const [rename, setRename] = useState(false)
  const [rules, setRules] = useState(false)
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

  const entries = league.entries as (typeof league.entries[number] & { bot?: boolean })[]
  const top = entries.slice(0, 3), rest = entries.slice(3)
  const anyBot = entries.some((e) => e.bot)
  const me = entries.find((e) => e.isMe)
  const face = (e: { playerId: string; isMe: boolean }) => e.isMe ? portrait : lookOf(e.playerId)
  const ring = (e: { name: string; isMe: boolean }) => e.isMe ? '#8b4dff' : `hsl(${(e.name.charCodeAt(0) * 47 + e.name.length * 13) % 360} 70% 58%)`
  const Podium = ({ e, place }: { e: typeof entries[number]; place: 1 | 2 | 3 }) => (
    <div className={`lg2-pod p${place}${e.isMe ? ' is-me' : ''}`}>
      <span className="lg2-pod-fig">
        {place === 1 && <><img className="lg2-laurel l" src={laurelL} alt="" draggable={false} /><img className="lg2-laurel r" src={laurelR} alt="" draggable={false} />
          <img className="lg2-crown esk-float" src={crown} alt="" draggable={false} /></>}
        <img className="lg2-pod-face" src={face(e)} alt="" draggable={false} style={{ ['--ring' as string]: ring(e) }} />
      </span>
      <span className="lg2-plinth"><img src={PLINTH[place - 1]} alt="" draggable={false} /><b>{place}</b></span>
      <span className="lg2-pod-t"><b>{e.isMe ? (server ? e.name : 'You') : e.name}</b><small>{e.lp.toLocaleString('en-US')} {server ? 'pts' : 'XP'}</small></span>
    </div>
  )

  return (
    <div className="screen pg lg2">
      <img className="pg-bg" src={bgLeague} alt="" draggable={false} />
      <div className="pg-scroll">
        <div className="lg2-head esk-enter">
          <img className="lg2-crest esk-float" src={CREST[league.tier]} alt="" draggable={false} />
          <h1 className="lg2-title">{LABEL[league.tier]} League
            <button className="lg2-info esk-press" onClick={() => setRules(true)} aria-label="How the league works">i</button></h1>
          <Chip className="lg2-timer">Ends in {left.label}</Chip>
        </div>

        {/* the ladder: where you are and what's next (locked tiers dimmed with a padlock) */}
        <div className="lg2-ladder esk-enter" style={{ ['--i' as string]: 1 }}>
          {TIERS.map((t, i) => (
            <span key={t} className={`lg2-step${i === ti ? ' on' : i < ti ? ' past' : ' locked'}`}>
              <span className="lg2-step-art"><img src={CREST[t]} alt="" draggable={false} />{i > ti && <img className="lg2-lock" src={lockArt} alt="" draggable={false} />}</span>
              <small>{LABEL[t]}</small>
            </span>
          ))}
        </div>

        {top.length > 0 && <div className="lg2-podium esk-enter" style={{ ['--i' as string]: 2 }}>
          {top[1] && <Podium e={top[1]} place={2} />}
          <Podium e={top[0]} place={1} />
          {top[2] && <Podium e={top[2]} place={3} />}
        </div>}
        {league.promoteCount > 0 && <div className="lg2-zone up esk-enter" style={{ ['--i' as string]: 3 }}><span>▲ Promotion zone ▲</span></div>}

        {rest.length > 0 && <div className="lg2-list esk-enter" style={{ ['--i' as string]: 4 }}>
          {rest.map((e, k) => {
            const i = k + 3
            return (
              <div key={e.playerId} className="lg2-li">
                {i === n - league.demoteCount && league.demoteCount > 0 && <div className="lg2-zone down"><span>▼ Demotion zone ▼</span></div>}
                <div className={`lg2-row${e.isMe ? ' is-mine' : ''}${i >= n - league.demoteCount ? ' is-down' : ''}`}>
                  <span className="lg2-rank">{i + 1}</span>
                  <img className="lg2-face" src={face(e)} alt="" draggable={false} style={{ ['--ring' as string]: ring(e) }} />
                  <span className="lg2-nm">{e.isMe ? (server ? e.name : 'You') : e.name}</span>
                  {e.isMe && <i className="lg2-you">You</i>}
                  <span className="lg2-lp">{e.lp.toLocaleString('en-US')} {server ? 'pts' : 'XP'}</span>
                </div>
              </div>
            )
          })}
        </div>}
      </div>

      {/* your own row, pinned above the nav (concept 03), also when you are on the podium */}
      {me && <div className="lg2-row is-me lg2-pin">
        <span className="lg2-rank">{myRank}</span>
        <img className="lg2-face" src={portrait} alt="" draggable={false} />
        <span className="lg2-nm">{server ? me.name : 'You'}</span>
        <i className="lg2-you">You</i>
        {server && <button className="lg-rename" onClick={() => setRename(true)} aria-label="Change your name">✎</button>}
        <span className="lg2-lp">{me.lp.toLocaleString('en-US')} {server ? 'pts' : 'XP'}</span>
      </div>}

      <Sheet open={rules} title="How the league works" onClose={() => setRules(false)} variant="light">
        <div className="lg2-rules">
          <p>{server
            ? <>Every stage earns <b>points</b> for what you answer right (10 × correct × accuracy, up to 400 a day). Boosts and purchases never count.</>
            : <>Win stages to earn <b>XP</b>.</>}
            {' '}When the week ends, the <b className="up">top {league.promoteCount}</b> move up{league.demoteCount ? <>, the <b className="down">bottom {league.demoteCount}</b> move down</> : null}.</p>
          {!server && boost.ms > 0 && <p className="lg-boost">Double XP · {boost.label}</p>}
          <div className="lg2-rw">
            {[1, 2, 3, 4].map((r) => <span key={r}><b>{r === 4 ? '#4 to #10' : `#${r}`}</b><RewardChips reward={leagueReward(r)} size={18} /></span>)}
          </div>
          <p className="lg2-small">You are #{myRank}. Rewards are paid when the week ends.{anyBot ? ' Some rivals are practice rivals until more players join.' : ''}</p>
        </div>
      </Sheet>
      <NameSheet open={rename} onClose={() => setRename(false)} />
      {last && (
        <div className="rw-scrim">
          <div className="rw-card">
            <div className="rw-rays" />
            <div className="rw-title">Last week: #{last.rank} in {LABEL[last.tier]}</div>
            <img className="lg-result-art" src={CREST[TIERS[TIERS.indexOf(last.tier) + last.moved]]} alt="" />
            <p className="rw-note">{last.moved > 0 ? `Promoted to ${LABEL[TIERS[TIERS.indexOf(last.tier) + 1]]}!` : last.moved < 0 ? `Moved down to ${LABEL[TIERS[TIERS.indexOf(last.tier) - 1]]}. You'll climb back!` : `You stay in ${LABEL[last.tier]}.`}</p>
            {Object.keys(last.reward).length > 0 && <RewardChips reward={last.reward} size={22} />}
            <Btn name="btn_gold" className="lg" onClick={collect}>{Object.keys(last.reward).length ? 'Collect' : 'OK'}</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
