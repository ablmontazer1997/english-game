import { useEffect, useState } from 'react'
import { sfx } from '../services/audio'
import { useGame } from '../services/ServiceProvider'
import { art, Btn } from './PageArt'
import { skySrc } from './SkyIcon'
import { CHEST_LABEL } from '../services/progress'
import type { Reward, ChestKind } from '../types/game'
import './progression.css'
import './eskit.css'
import './chests2.css'
import shelf from '../assets/es2/shop/shelf3.webp'

/** the painted 3-slot shelf (admin 4966): slot centres at 23.9 / 51.4 / 78.6 % of its width */
const KINDS: ChestKind[] = ['wood', 'silver', 'epic']
const SLOT_X = ['23.9%', '51.4%', '78.6%']
const CHEST_ART = { wood: 'chest_wood', silver: 'chest_silver', epic: 'chest_epic' } as const

/** small inline chips: 🪙 120  💎 5  🧪 1  [chest] */
export function RewardChips({ reward, size = 18 }: { reward: Reward; size?: number }) {
  return (
    <span className="rw-chips">
      {!!reward.coins && <span className="rw-chip"><img src={skySrc('ic_coin')} alt="" style={{ width: size }} />{reward.coins.toLocaleString('en-US')}</span>}
      {!!reward.gems && <span className="rw-chip"><img src={skySrc('ic_gem')} alt="" style={{ width: size }} />{reward.gems}</span>}
      {!!reward.potion && <span className="rw-chip"><img src={art('qi_potion')} alt="" style={{ width: size + 2 }} />{reward.potion}</span>}
      {reward.chest && <span className="rw-chip"><img src={art(CHEST_ART[reward.chest])} alt="" style={{ width: size + 8 }} /></span>}
    </span>
  )
}

/** the app-wide "you got…" reveal (quests, achievements, chests, league). ES redesign 10-11: the Bingual ChestReveal pattern —
 *  a dark backdrop; when a chest is involved it drops in, shakes three times, then a flash, sparks fly out, slow rays turn
 *  behind and the reward cards pop in one by one (170 ms apart). Plain rewards skip the chest and open on the rays. */
const CHEST_OF = (title: string, r: Reward): ChestKind | null => {
  const k = (Object.keys(CHEST_LABEL) as ChestKind[]).find((c) => title.startsWith(CHEST_LABEL[c]))
  return k ?? (r.chest ?? null)
}
const SPARKS = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; const d = 110 + (i % 3) * 30; return { dx: Math.cos(a) * d, dy: Math.sin(a) * d } })
export function RewardPopup() {
  const { toast, clearToast } = useGame()
  const [opened, setOpened] = useState(false)
  const chest = toast ? CHEST_OF(toast.title, toast.reward) : null
  const opening = !!toast && !!chest && /opened/i.test(toast.title)
  useEffect(() => {
    if (!toast) return
    sfx('reveal')   // admin 4530: every reward / chest / purchase card
    const calm = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setOpened(!opening || calm)
    if (opening && !calm) { const t = setTimeout(() => setOpened(true), 1900); return () => clearTimeout(t) }
  }, [toast, opening])
  if (!toast) return null
  const r = toast.reward
  const items: { img: string; n: string; label: string }[] = []
  if (r.coins) items.push({ img: skySrc('ic_coin'), n: `+${r.coins.toLocaleString('en-US')}`, label: 'Coins' })
  if (r.gems) items.push({ img: skySrc('ic_gem'), n: `+${r.gems}`, label: 'Gems' })
  if (r.potion) items.push({ img: art('qi_potion'), n: `+${r.potion}`, label: r.potion > 1 ? 'Elixirs' : 'Elixir' })
  if (r.chest) items.push({ img: art(CHEST_ART[r.chest]), n: '+1', label: CHEST_LABEL[r.chest] })
  const d0 = opening ? '120ms' : '0ms'
  return (
    <div className={`esk-rv${opened ? ' opened' : ''}`} onClick={() => opened && clearToast()} role="dialog" aria-label={toast.title}>
      <div className="esk-rv-stage" onClick={(e) => e.stopPropagation()} style={{ ['--d0' as string]: d0 }}>
        {opened && <div className="esk-rv-rays" />}
        {chest && (opening || !opened) && <img className="esk-rv-chest" src={art(CHEST_ART[chest])} alt="" draggable={false} />}
        <div className="esk-rv-sparks" aria-hidden>{opening && SPARKS.map((s, i) => <i key={i} style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px` }} />)}</div>
        {opened && <>
          <h2 className="esk-rv-title">{toast.title}</h2>
          <div className="esk-rv-cards">
            {items.map((it, i) => (
              <div key={it.label} className="esk-rv-card" style={{ ['--i' as string]: i }}><img src={it.img} alt="" draggable={false} /><b>{it.n}</b><span>{it.label}</span></div>
            ))}
          </div>
          {r.chest && <p className="esk-rv-note">Open it from your chests in the Shop or Quests.</p>}
          <Btn name="btn_gold" className="lg" onClick={clearToast}>Great!</Btn>
        </>}
      </div>
      {opening && <div className="esk-rv-flash" />}
    </div>
  )
}

/** the chests you own, each with an Open button that plays a short reveal */
export function ChestStrip() {
  const { inventory, openChest, showReward } = useGame()
  const [opening, setOpening] = useState<ChestKind | null>(null)
  if (!inventory) return null
  const owned = (Object.keys(inventory.chests) as ChestKind[]).filter((k) => inventory.chests[k] > 0)
  if (!owned.length) return null
  const open = async (k: ChestKind) => {
    setOpening(k)
    await new Promise((r) => setTimeout(r, 700))              // the chest shakes, then pops
    const r = await openChest(k)
    setOpening(null)
    if (r) showReward(`${CHEST_LABEL[k]} opened!`, r)
  }
  return (
    <section className="chs2 esk-enter" aria-label="Your chests">
      <div className="chs2-shelf">
        <img className="chs2-bg" src={shelf} alt="" draggable={false} />
        <b className="chs2-h">Your chests</b>
        {KINDS.map((k, i) => inventory.chests[k] > 0 && (
          <span key={k} className="chs2-slot" style={{ left: SLOT_X[i] }}>
            <img className={`chs2-art${opening === k ? ' ch-shake' : ''}`} src={art(CHEST_ART[k])} alt={CHEST_LABEL[k]} draggable={false} />
            <b className="chs2-n">×{inventory.chests[k]}</b>
          </span>
        ))}
      </div>
      <div className="chs2-btns">
        {KINDS.map((k) => inventory.chests[k] > 0
          ? <Btn key={k} name="btn_gold" className="sm chs2-btn" onClick={() => open(k)} disabled={!!opening}>Open</Btn>
          : <span key={k} />)}
      </div>
    </section>
  )
}

/** "12m 30s" countdown that re-renders itself */
export function useCountdown(until: number) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  const ms = Math.max(0, until - Date.now())
  const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1000)
  return { ms, label: h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, '0')}s` }
}
