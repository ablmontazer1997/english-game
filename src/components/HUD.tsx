import { useGame } from '../services/ServiceProvider'
import { SkyIcon, skySrc, type SkyName } from './SkyIcon'
import { usePortrait } from './Portrait'
import type { CurrencyId } from '../types/game'
import './hud.css'

// keep big balances short enough for the painted pill
function fmt(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K`
  return n >= 1000 ? n.toLocaleString('en-US') : String(n)
}

export function HUD({ onBuy, onSettings }: { onBuy: (c: CurrencyId) => void; onSettings: () => void }) {
  const { currencies, profile } = useGame()
  const face = usePortrait()
  if (!currencies || !profile) return <div className="hud" />

  return (
    <div className="hud">
      <button className="hud-avatar" aria-label={`Level ${profile.level}, ${profile.xp} of ${profile.xpToNext} XP`} onClick={onSettings}
        style={{ '--xp': `${Math.min(100, (profile.xp / Math.max(1, profile.xpToNext)) * 100)}%` } as React.CSSProperties}>
        <img src={face} alt="" className="hud-avatar-img" draggable={false} />
        <span className="hud-avatar-lvl">{profile.level}</span>
      </button>

      <div className="hud-pills">
        <Pill icon="ic_heart" value={`${currencies.hearts}/${currencies.heartsMax}`} onBuy={() => onBuy('hearts')} />
        <Pill icon="ic_coin" value={fmt(currencies.coins)} onBuy={() => onBuy('coins')} />
        <Pill icon="ic_gem" value={fmt(currencies.gems)} onBuy={() => onBuy('gems')} />
      </div>

      <button className="hud-gear" aria-label="Settings" onClick={onSettings}>
        <SkyIcon name="btn_gear" size={36} />
      </button>
    </div>
  )
}

function Pill({ icon, value, onBuy, wide }: {
  icon: SkyName; value: string; onBuy: () => void; wide?: boolean
}) {
  return (
    <div className={`pill${wide ? ' wide' : ''}`}>
      <img className="pill-bg" src={skySrc('pill')} alt="" draggable={false} />
      <SkyIcon name={icon} size={20} className="pill-ic" />
      <b className="pill-val">{value}</b>
      <button className="pill-plus" aria-label="Buy more" onClick={onBuy} />
    </div>
  )
}
