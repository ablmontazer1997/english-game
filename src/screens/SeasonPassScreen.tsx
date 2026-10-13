import { useEffect, useRef, useState } from 'react'
import { api, errorText, type SeasonOut, type SeasonTier, type TrackReward } from '../services/api'
import { toCurrencies } from '../services/httpService'
import { useGame } from '../services/ServiceProvider'
import { Card, Btn, art } from '../components/PageArt'
import bgSeason from '../assets/es2/shop/bg_shop2.webp'   // admin 5402/5406: reuse the live tab bg (Shop/Quests), daytime; the dusk bg is dropped
import heroArt from '../assets/games/boss2/hero_cheer.webp'
import logoArt from '../assets/es2/season/logo.webp'
import pillArt from '../assets/es2/season/pill.webp'
import leavesArt from '../assets/es2/season/leaves.webp'
import hdrFree from '../assets/es2/season/hdr_free.webp'
import hdrPrem from '../assets/es2/season/hdr_prem.webp'
import nodeArt from '../assets/es2/season/node.webp'
import nodeCur from '../assets/es2/season/node_cur.webp'
import checkArt from '../assets/es2/season/check.webp'
import lockGold from '../assets/es2/season/lock_gold.webp'
import lockLav from '../assets/es2/season/lock_lav.webp'
import coinsArt from '../assets/es2/season/coins.webp'
import coinsBig from '../assets/es2/season/coins_big.webp'
import gemsArt from '../assets/es2/season/gems.webp'
import chestArt from '../assets/es2/season/chest.webp'
import elixirArt from '../assets/es2/season/elixir.webp'
import './season2.css'
import '../components/es2kit.css'
import { ItemThumb } from '../components/ItemThumb'
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

/** one reward: picture + short label (coins, gems, elixir, chest, dye, item). Garments use their own source image (ItemThumb). */
export function TrackPrize({ r }: { r: TrackReward }) {
  if (r.item) return <span className="ssn-prize"><ItemThumb className="ssn-pic ssn-item" id={r.item} /><small>{r.item.startsWith('hat') ? 'Hat' : 'Cloak'}</small></span>
  if (r.dye) {
    const [g, sw] = r.dye.split(':')
    return <span className="ssn-prize"><span className="ssn-dyepic"><ItemThumb className="ssn-pic ssn-item" id={g} /><i className="ssn-dye" style={{ background: SWATCH[sw] ?? '#999' }} /></span><small>{GARMENT[g] ?? 'Dye'} dye</small></span>
  }
  if (r.chest) return <span className="ssn-prize"><img className="ssn-pic" src={r.chest === 'epic' ? chestArt : art(CHEST[r.chest])} alt="" /><small>{r.chest === 'wood' ? 'Wooden' : r.chest === 'silver' ? 'Silver' : 'Epic'}</small></span>
  if (r.gems) return <span className="ssn-prize"><img className="ssn-pic" src={gemsArt} alt="" /><small>{r.gems} gems</small></span>
  if (r.elixir) return <span className="ssn-prize"><img className="ssn-pic" src={elixirArt} alt="" /><small>{r.elixir} elixir{r.elixir > 1 ? 's' : ''}</small></span>
  const c = r.coins ?? 0
  return <span className="ssn-prize"><img className="ssn-pic" src={c >= 250 ? coinsBig : coinsArt} alt="" /><small>{c.toLocaleString('en-US')}</small></span>
}

// ES redesign concept 06 (admin 4935): two columns (Free lavender / Premium gold, locked) on a glowing centre path of
// numbered nodes; the current tier lit with a winged node; a jump-to-current-tier button; premium stays "Coming soon".
function TierRow({ t, cur, busy, onClaim }: { t: SeasonTier; cur: boolean; busy: boolean; onClaim: (t: number) => void }) {
  return (
    <div className={`ssn2-row${t.reached ? ' is-reached' : ''}${cur ? ' is-cur' : ''}`} data-tier={t.tier}>
      <div className={`ssn2-cell free${t.free_claimable ? ' is-ready' : ''}${t.free_claimed ? ' is-done' : ''}`}>
        <TrackPrize r={t.free} />
        {t.free_claimed ? <img className="ssn2-badge" src={checkArt} alt="Claimed" />
          : t.free_claimable ? <Btn className="sm ssn2-claim esk-shimmer" name="btn_gold" disabled={busy} onClick={() => onClaim(t.tier)}>Claim</Btn>
            : <img className="ssn2-badge" src={lockLav} alt={`${t.xp.toLocaleString('en-US')} XP`} title={`${t.xp.toLocaleString('en-US')} XP`} />}
      </div>
      <span className="ssn2-node">{cur ? <img src={nodeCur} alt="" draggable={false} /> : <img src={nodeArt} alt="" draggable={false} />}<b>{t.tier}</b></span>
      <div className="ssn2-cell prem">
        <TrackPrize r={t.premium} />
        <img className="ssn2-badge" src={lockGold} alt="Premium, coming soon" />
      </div>
    </div>
  )
}

export function SeasonPassScreen({ onClose }: { onClose: () => void }) {
  const { setCurrencies, showReward } = useGame()
  const [s, setS] = useState<SeasonOut | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [curOff, setCurOff] = useState<0 | 1 | -1>(0)   // where the current tier row is: on screen / below / above
  const list = useRef<HTMLDivElement>(null)
  const left = useCountdown(s?.ends_at ?? 0)
  useEffect(() => { api.season().then(setS).catch((e) => setErr(errorText(e))) }, [])
  const curTier = s ? Math.max(1, Math.min(s.tiers_total, s.tier)) : 1
  const jump = (smooth = true) => list.current?.querySelector(`[data-tier="${curTier}"]`)?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
  // open at the current tier
  useEffect(() => { if (s) jump(false) }, [s?.season_id]) // eslint-disable-line react-hooks/exhaustive-deps
  // the jump button shows only while the current tier is off screen
  useEffect(() => {
    const row = list.current?.querySelector(`[data-tier="${curTier}"]`)
    if (!row || !list.current) return
    const io = new IntersectionObserver(([e]) => setCurOff(e.isIntersecting ? 0 : e.boundingClientRect.top > (e.rootBounds?.top ?? 0) ? 1 : -1),
      { root: list.current, rootMargin: '-90px 0px -110px 0px' })
    io.observe(row)
    return () => io.disconnect()
  }, [s?.season_id, curTier])
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
  const days = s ? Math.max(0, Math.ceil((s.ends_at - Date.now()) / 864e5)) : 0
  const fill = s ? Math.min(100, ((Math.min(s.tier, s.tiers_total) - 0.5) / s.tiers.length) * 100) : 0
  return (
    <div className="screen pg ssn ssn2">
      <img className="pg-bg" src={bgSeason} alt="" draggable={false} />
      <div className="pg-scroll" ref={list}>
        <div className="ssn2-head esk-enter">
          <button className="ac-back ssn2-back" onClick={onClose} aria-label="Back">‹</button>
          <img className="ssn2-hero" src={heroArt} alt="" draggable={false} />
          <img className="ssn2-leaves" src={leavesArt} alt="" draggable={false} />
          <div className="ssn2-title">
            {s?.theme === 'ember' ? <img className="ssn2-logo" src={logoArt} alt={s.name} draggable={false} />
              : <h1 className="ssn2-name">{s?.name ?? 'Season Pass'}</h1>}
            {s && <span className="ssn2-pill"><img src={pillArt} alt="" draggable={false} /><b>{days > 1 ? `${days} days left` : left.label}</b></span>}
          </div>
        </div>
        {!s ? <p className="ui-note">{err ?? 'Opening the season…'}</p> : <>
          <div className="ssn2-prog esk-enter" style={{ ['--i' as string]: 1 }}>
            <b>Tier {s.tier}/{s.tiers_total}</b>
            <span><i style={{ width: `${done ? 100 : Math.min(100, (into / s.tier_xp) * 100)}%` }} /></span>
            <small>{done ? 'Complete' : `${into}/${s.tier_xp} XP`}</small>
          </div>
          {err && <p className="nm-err ssn-err">{err}</p>}
          <div className="ssn2-cols esk-enter" style={{ ['--i' as string]: 2 }}>
            <span className="ssn2-hdr free"><img src={hdrFree} alt="" draggable={false} /><b>FREE</b></span>
            <span />
            <span className="ssn2-hdr prem"><img src={hdrPrem} alt="" draggable={false} /><b>PREMIUM</b></span>
          </div>
          <div className="ssn2-track" style={{ ['--fill' as string]: `${fill}%` }}>
            <span className="ssn2-path" aria-hidden><i /></span>
            {s.tiers.map((t) => <TierRow key={t.tier} t={t} cur={t.tier === curTier} busy={busy} onClaim={claim} />)}
          </div>
          <p className="ssn2-note">Win stages (+{s.rules.stage_win}, +{s.rules.per_star} a star) and claim quests (+{s.rules.quest.daily} daily, +{s.rules.quest.weekly} weekly). Today {s.xp_today}/{s.xp_daily_cap} XP. A new season starts on the 1st of every month; unclaimed free rewards do not carry over.</p>
        </>}
      </div>
      {s && curOff !== 0 && <button className="ssn2-jump esk-press" onClick={() => jump()} aria-label={`Jump to tier ${curTier}`}>{curOff > 0 ? '↓' : '↑'} Tier {curTier}</button>}
      {s && <div className="ssn2-foot">
        <span className="ssn2-unlock" aria-disabled="true"><img src={lockLav} alt="" draggable={false} /><span><b>Premium</b><em>Coming soon</em></span></span>
      </div>}
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
