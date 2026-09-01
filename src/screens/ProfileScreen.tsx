import type { ReactNode } from 'react'
import { useGame } from '../services/ServiceProvider'
import { FlameIcon, StarIcon, LeagueIcon, BoltIcon } from '../components/Icon'
import { ImgIcon } from '../components/ImgIcon'
import type { CurrencyId } from '../types/game'
import './screens.css'

export function ProfileScreen({ onBuy, onCustomize }: { onBuy: (c: CurrencyId) => void; onCustomize: () => void }) {
  const { profile, worlds } = useGame()
  if (!profile) return <div className="screen" />
  const totalStars = worlds.reduce((a, w) => a + w.stages.reduce((b, s) => b + s.stars, 0), 0)
  const done = worlds.reduce((a, w) => a + w.stages.filter((s) => s.status === 'done').length, 0)

  return (
    <div className="screen">
      <div className="page reveal">
        {/* avatar hero */}
        <div className="avatar-hero">
          <div className="avatar-orb"><span className="avatar-glyph">🐺</span></div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{profile.name}</h1>
            <p className="page-sub" style={{ margin: '2px 0 0' }}>Level {profile.level} · Apprentice Mage</p>
          </div>
        </div>

        <div className="stat-grid">
          <Stat icon={<FlameIcon size={20} />} v={profile.streak} l="Day Streak" tint="#ffb27a" />
          <Stat icon={<StarIcon size={20} />} v={totalStars} l="Stars" tint="var(--gold)" />
          <Stat icon={<BoltIcon size={20} />} v={done} l="Stages" tint="var(--cyan)" />
          <Stat icon={<LeagueIcon size={20} />} v={profile.leagueTier} l="League" tint="var(--amethyst-soft)" />
        </div>

        <div className="section-label">Backpack & Character</div>
        <div className="tile"><div className="tile-ic tile-ic-img"><ImgIcon name="chest_closed" size={38} /></div>
          <div className="tile-main"><b>Backpack</b><p>Boosters, potions and crystals</p></div>
          <button className="btn btn-ghost">Open</button></div>
        <div className="tile"><div className="tile-ic tile-ic-img"><ImgIcon name="badge" size={38} /></div>
          <div className="tile-main"><b>Character Creator</b><p>Hair, robe, hat, staff and color</p></div>
          <button className="btn btn-ghost" onClick={onCustomize}>Customize</button></div>

        <div className="section-label">Shop</div>
        <div className="tile"><div className="tile-ic tile-ic-img"><ImgIcon name="gem" size={38} /></div>
          <div className="tile-main"><b>Gem Shop</b><p>Cosmetics, Moon Pass, boosters</p></div>
          <button className="btn btn-gold" onClick={() => onBuy('gems')}>Open</button></div>
      </div>
    </div>
  )
}

function Stat({ icon, v, l, tint }: { icon: ReactNode; v: ReactNode; l: string; tint: string }) {
  return (
    <div className="stat">
      <span className="stat-ic" style={{ color: tint }}>{icon}</span>
      <b>{v}</b><span>{l}</span>
    </div>
  )
}
