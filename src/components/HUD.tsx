import { useGame } from '../services/ServiceProvider'
import { PlusIcon } from './Icon'
import { ImgIcon, type IconName } from './ImgIcon'
import { Bar } from './Bar'
import mage from '../assets/character/body/mage_m.png'
import type { CurrencyId } from '../types/game'
import './hud.css'

function fmt(n: number) { return n >= 1000 ? n.toLocaleString('en-US') : String(n) }

export function HUD({ onBuy, onSettings }: { onBuy: (c: CurrencyId) => void; onSettings: () => void }) {
  const { currencies, profile } = useGame()
  if (!currencies || !profile) return <div className="hud" />

  const xpPct = Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100))

  return (
    <div className="hud">
      <div className="hud-left">
        <button className="hud-avatar" aria-label="Profile & settings" onClick={onSettings}>
          <img src={mage} alt="" className="hud-avatar-img" draggable={false} />
          <span className="hud-avatar-lvl">{profile.level}</span>
        </button>
        <div className="hud-xp">
          <Bar value={xpPct} tone="gold" />
          <span className="hud-xp-txt">{profile.xp} / {profile.xpToNext}</span>
        </div>
      </div>

      <div className="hud-chips">
        <Chip icon="heart" value={`${currencies.hearts}/${currencies.heartsMax}`} onBuy={() => onBuy('hearts')} />
        <Chip icon="potion" value={fmt(currencies.potion)} onBuy={() => onBuy('potion')} />
        <Chip icon="coin" value={fmt(currencies.coins)} onBuy={() => onBuy('coins')} />
      </div>
    </div>
  )
}

function Chip({ icon, value, onBuy }: { icon: IconName; value: string; onBuy: () => void }) {
  return (
    <div className="chip">
      <ImgIcon name={icon} size={26} className="chip-ic" />
      <b>{value}</b>
      <button className="chip-plus" aria-label="Buy" onClick={onBuy}><PlusIcon size={12} /></button>
    </div>
  )
}
