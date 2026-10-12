import { useEffect, useRef, useState } from 'react'
import { api, errorText, type SeasonOut, type SeasonTier, type TrackReward } from '../services/api'
import { toCurrencies } from '../services/httpService'
import { useGame } from '../services/ServiceProvider'
import { Card, Btn, Chip, art, PAGE_BG } from '../components/PageArt'
import { ItemThumb } from '../components/ItemThumb'
import { skySrc } from '../components/SkyIcon'
import { useCountdown } from '../components/Rewards'
import { sfx } from '../services/audio'
import './pages.css'
import '../components/progression.css'
import './seasonpass.css'

// Phase D (admin 4839, decision 5 A): the monthly Season Pass. Free track claimable now; premium track shown, locked.
export const SWATCH: Record<string, string> = {
  violet: '#7b4fd6', royal: '#2f55c8', emerald: '#1f9a63', crimson: '#b8263e', midnight: '#1b2150',
  ochre: '#d7a032', teal: '#1f8f94', rose: '#e07aa3', charcoal: '#46464f', cream: '#efe3c8',
}
const GARMENT: Record<string, string> = { coat: 'Cloak', top_apprentice: 'Tunic', pants: 'Trousers', shoes: 'Boots', hat: 'Hat' }
const CHEST: Record<string, 'chest_wood' | 'chest_silver' | 'chest_epic'> = { wood: 'chest_wood', silver: 'chest_silver', epic: 'chest_epic' }

/** one reward: picture + short label (coins, gems, elixir, chest, dye, item) */
export function TrackPrize({ r }: { r: TrackReward }) {
  if (r.item) return <span className="ssn-prize"><ItemThumb className="ssn-pic ssn-item" id={r.item} /><small>{r.item.startsWith('hat') ? 'Hat' : 'Cloak'}</small></span>
  if (r.dye) {
    const [g, sw] = r.dye.split(':')
    return <span className="ssn-prize"><i className="ssn-pic ssn-dye" style={{ background: SWATCH[sw] ?? '#999' }} /><small>{GARMENT[g] ?? 'Dye'} dye</small></span>
  }
  if (r.chest) return <span className="ssn-prize"><img className="ssn-pic" src={art(CHEST[r.chest])} alt="" /><small>{r.chest === 'wood' ? 'Wooden' : r.chest === 'silver' ? 'Silver' : 'Epic'}</small></span>
  if (r.gems) return <span className="ssn-prize"><img className="ssn-pic" src={skySrc('ic_gem')} alt="" /><small>{r.gems} gems</small></span>
  if (r.elixir) return <span className="ssn-prize"><img className="ssn-pic" src={art('qi_potion')} alt="" /><small>{r.elixir} elixir{r.elixir > 1 ? 's' : ''}</small></span>
  return <span className="ssn-prize"><img className="ssn-pic" src={skySrc('ic_coin')} alt="" /><small>{(r.coins ?? 0).toLocaleString('en-US')}</small></span>
}

function TierRow({ t, cur, busy, onClaim }: { t: SeasonTier; cur: boolean; busy: boolean; onClaim: (t: number) => void }) {
  return (
    <div className={`ssn-row${t.reached ? ' is-reached' : ''}${cur ? ' is-cur' : ''}`} data-tier={t.tier}>
      <span className="ssn-n">{t.tier}</span>
      <Card className={`ssn-cell ssn-free${t.free_claimable ? ' q-ready' : ''}`}>
        <TrackPrize r={t.free} />
        {t.free_claimed ? <span className="q-check">✓</span>
          : t.free_claimable ? <Btn className="sm" name="btn_gold" disabled={busy} onClick={() => onClaim(t.tier)}>Claim</Btn>
            : <span className="ssn-wait">{t.xp.toLocaleString('en-US')} XP</span>}
      </Card>
      <Card className="ssn-cell ssn-prem">
        <TrackPrize r={t.premium} />
        <span className="ssn-lock" aria-label="Premium, coming soon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><rect x="4.5" y="10" width="15" height="11" rx="3" fill="currentColor" /></svg>
        </span>
      </Card>
    </div>
  )
}

export function SeasonPassScreen({ onClose }: { onClose: () => void }) {
  const { setCurrencies, showReward } = useGame()
  const [s, setS] = useState<SeasonOut | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const left = useCountdown(s?.ends_at ?? 0)
  useEffect(() => { api.season().then(setS).catch((e) => setErr(errorText(e))) }, [])
  // open at the next tier to reach
  useEffect(() => {
    if (!s || !list.current) return
    const n = Math.max(1, Math.min(s.tiers_total, s.tier))
    list.current.querySelector(`[data-tier="${n}"]`)?.scrollIntoView({ block: 'center' })
  }, [s?.season_id]) // eslint-disable-line react-hooks/exhaustive-deps
  const claim = async (tier: number) => {
    setBusy(true)
    try {
      const r = await api.seasonClaim(tier, 'free')
      setS(r.season); setCurrencies(toCurrencies(r.wallet)); sfx('reveal')
      const g = r.reward
      if (g.item) showReward('Season reward: a new hat!', {})
      else if (g.dye) showReward('Season reward: a new dye!', {})
      else showReward('Season reward', { coins: g.coins, gems: g.gems, potion: g.elixir, chest: g.chest })
    } catch (e) { setErr(errorText(e)); setTimeout(() => setErr(null), 2400) }
    setBusy(false)
  }
  const into = s ? s.xp - s.tier * s.tier_xp : 0
  const done = s ? s.tier >= s.tiers_total : false
  const ready = s ? s.tiers.filter((t) => t.free_claimable).length : 0
  return (
    <div className="screen pg ssn">
      <img className="pg-bg" src={PAGE_BG.quests} alt="" draggable={false} />
      <div className="pg-scroll" ref={list}>
        <Card className="reveal pg-title">
          <button className="ac-back" onClick={onClose} aria-label="Back">‹</button>
          <h1 className="pg-title-t">Season Pass</h1>
          {s && <Chip>{left.label}</Chip>}
        </Card>
        {!s ? <Card className="reveal ssn-head"><p className="ui-note">{err ?? 'Opening the season…'}</p></Card> : <>
          <Card className={`reveal ssn-head ssn-t-${s.theme}`}>
            <span className="ssn-season">{s.name}</span>
            <span className="ssn-tier"><b>Tier {s.tier}</b> of {s.tiers_total}</span>
            <span className="q-prog ssn-bar">
              <span className="bar"><i style={{ width: `${done ? 100 : Math.min(100, (into / s.tier_xp) * 100)}%` }} /></span>
              <b>{done ? 'Complete' : `${into}/${s.tier_xp} XP`}</b>
            </span>
            <small className="ssn-how">Win stages (+{s.rules.stage_win}, +{s.rules.per_star} a star) and claim quests (+{s.rules.quest.daily} daily, +{s.rules.quest.weekly} weekly). Today {s.xp_today}/{s.xp_daily_cap} XP.</small>
          </Card>
          {err && <p className="nm-err ssn-err">{err}</p>}
          {ready > 0 && <p className="ui-note ac-ready">{ready} reward{ready > 1 ? 's' : ''} ready to claim!</p>}
          <div className="ssn-cols"><span /><b>Free</b><b className="ssn-cols-p">Premium <em>Coming soon</em></b></div>
          {s.tiers.map((t) => <TierRow key={t.tier} t={t} cur={t.tier === s.tier + 1} busy={busy} onClaim={claim} />)}
          <Card className="reveal ssn-premcard">
            <span className="ssn-premcard-main"><b className="ui-t">Premium track</b><small className="ui-s">Gems, elixirs, chests and the {s.name} season cloak. Opens when the store goes live.</small></span>
            <Btn className="sm" disabled>Coming soon</Btn>
          </Card>
          <p className="ui-note">A new season starts on the 1st of every month. Claim your free rewards before it ends: unclaimed ones do not carry over.</p>
        </>}
      </div>
    </div>
  )
}

/** the Season Pass card on the Quests page: tier, progress, rewards waiting */
export function SeasonEntry({ onOpen, trophy }: { onOpen: () => void; trophy?: string }) {
  const { currencies } = useGame()
  const [s, setS] = useState<SeasonOut | null>(null)
  useEffect(() => { api.season().then(setS).catch(() => {}) }, [currencies?.coins, currencies?.gems])
  if (!s) return null
  const into = s.xp - s.tier * s.tier_xp
  const done = s.tier >= s.tiers_total
  const ready = s.tiers.filter((t) => t.free_claimable).length
  return (
    <Card className={`reveal ssn-entry${ready ? ' q-ready' : ''}`} onClick={onOpen}>
      <img src={trophy ?? art('trophy_big')} alt="" draggable={false} />
      <span className="ssn-entry-main">
        <b className="ui-t">Season Pass: {s.name}</b>
        <span className="q-prog"><span className="bar"><i style={{ width: `${done ? 100 : Math.min(100, (into / s.tier_xp) * 100)}%` }} /></span><b>Tier {s.tier}/{s.tiers_total}</b></span>
        <small className="ui-s">{ready ? `${ready} reward${ready > 1 ? 's' : ''} to claim` : 'Win stages and quests to climb'}</small>
      </span>
      <span className={`sk ${ready ? 'sk-gold' : 'sk-green'} ui-btn sm`}>{ready ? 'Claim' : 'Open'}</span>
    </Card>
  )
}
