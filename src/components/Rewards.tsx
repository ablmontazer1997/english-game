import { useEffect, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { art, Panel } from './PageArt'
import { skySrc } from './SkyIcon'
import { CHEST_LABEL } from '../services/progress'
import type { Reward, ChestKind } from '../types/game'
import './progression.css'

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

/** the app-wide "you got…" card (quests, achievements, chests, league) */
export function RewardPopup() {
  const { toast, clearToast } = useGame()
  if (!toast) return null
  const r = toast.reward
  return (
    <div className="rw-scrim" onClick={clearToast}>
      <div className="rw-card" onClick={(e) => e.stopPropagation()}>
        <div className="rw-rays" />
        <div className="rw-title">{toast.title}</div>
        <div className="rw-items">
          {!!r.coins && <RewardBig img={skySrc('ic_coin')} n={`+${r.coins.toLocaleString('en-US')}`} label="Coins" />}
          {!!r.gems && <RewardBig img={skySrc('ic_gem')} n={`+${r.gems}`} label="Gems" />}
          {!!r.potion && <RewardBig img={art('qi_potion')} n={`+${r.potion}`} label={r.potion > 1 ? 'Elixirs' : 'Elixir'} />}
          {r.chest && <RewardBig img={art(CHEST_ART[r.chest])} n="+1" label={CHEST_LABEL[r.chest]} />}
        </div>
        {r.chest && <p className="rw-note">Open it from your chests in the Shop or Quests.</p>}
        <Panel name="btn_gold" className="rw-ok" onClick={clearToast}>Great!</Panel>
      </div>
    </div>
  )
}
function RewardBig({ img, n, label }: { img: string; n: string; label: string }) {
  return <div className="rw-big"><img src={img} alt="" draggable={false} /><b>{n}</b><span>{label}</span></div>
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
    <div className="ch-strip reveal">
      {owned.map((k) => (
        <Panel key={k} name="card_square" inner="ch-card">
          <img className={`ch-art${opening === k ? ' ch-shake' : ''}`} src={art(CHEST_ART[k])} alt="" draggable={false} />
          <span className="ch-n">×{inventory.chests[k]}</span>
          <Panel name="btn_gold" className="ch-open" onClick={() => open(k)} disabled={!!opening}>Open</Panel>
        </Panel>
      ))}
    </div>
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
