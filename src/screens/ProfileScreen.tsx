import { useGame } from '../services/ServiceProvider'
import { ImgIcon } from '../components/ImgIcon'
import type { CurrencyId } from '../types/game'
import avatarHero from '../assets/ui/profile/avatar_hero.webp'
import divider from '../assets/ui/profile/divider.webp'
import statStreak from '../assets/ui/profile/stat_streak.webp'
import statStars from '../assets/ui/profile/stat_stars.webp'
import statStages from '../assets/ui/profile/stat_stages.webp'
import statLeague from '../assets/ui/profile/stat_league.webp'
import btnOpenCyan from '../assets/ui/profile/btn_open_cyan.webp'
import btnOpenGold from '../assets/ui/profile/btn_open_gold.webp'
import btnCustomize from '../assets/ui/profile/btn_customize.webp'
import './screens.css'
import './screens2.css'

function StatCard({ img, v, l }: { img: string; v: React.ReactNode; l: string }) {
  return (
    <div className="pf-stat">
      <div className="pf-stat-card">
        <img src={img} alt="" draggable={false} />
        <b className="pf-stat-v">{v}</b>
      </div>
      <span className="pf-stat-l">{l}</span>
    </div>
  )
}

export function ProfileScreen({ onBuy, onCustomize }: { onBuy: (c: CurrencyId) => void; onCustomize: () => void }) {
  const { profile, worlds } = useGame()
  if (!profile) return <div className="screen" />
  const totalStars = worlds.reduce((a, w) => a + w.stages.reduce((b, s) => b + s.stars, 0), 0)
  const done = worlds.reduce((a, w) => a + w.stages.filter((s) => s.status === 'done').length, 0)

  return (
    <div className="screen">
      <div className="page reveal">
        <div className="pf-hero">
          <img className="pf-avatar" src={avatarHero} alt="" draggable={false} />
          <div className="pf-id">
            <h1 className="pf-name">{profile.name}</h1>
            <p className="pf-sub">Level {profile.level} · Apprentice Mage</p>
            <img className="pf-divider" src={divider} alt="" draggable={false} />
          </div>
        </div>

        <div className="pf-stats">
          <StatCard img={statStreak} v={profile.streak} l="Day Streak" />
          <StatCard img={statStars} v={totalStars} l="Stars" />
          <StatCard img={statStages} v={done} l="Stages" />
          <StatCard img={statLeague} v={profile.leagueTier} l="League" />
        </div>

        <div className="rc-sec"><span className="rc-sec-t">Backpack & Character</span></div>
        <div className="rc-crow">
          <ImgIcon name="chest_closed" size={54} className="pf-row-ic" />
          <div className="rc-crow-main"><b>Backpack</b><p>Boosters, potions and crystals</p></div>
          <button className="pf-rowbtn" aria-label="Open"><img src={btnOpenCyan} alt="Open" draggable={false} /></button>
        </div>
        <div className="rc-crow">
          <ImgIcon name="badge" size={54} className="pf-row-ic" />
          <div className="rc-crow-main"><b>Character Creator</b><p>Hair, robe, hat, staff and color</p></div>
          <button className="pf-rowbtn" aria-label="Customize" onClick={onCustomize}><img src={btnCustomize} alt="Customize" draggable={false} /></button>
        </div>

        <div className="rc-sec"><span className="rc-sec-t">Shop</span></div>
        <div className="rc-crow">
          <ImgIcon name="gem" size={54} className="pf-row-ic" />
          <div className="rc-crow-main"><b>Gem Shop</b><p>Cosmetics, Moon Pass, boosters</p></div>
          <button className="pf-rowbtn" aria-label="Open" onClick={() => onBuy('gems')}><img src={btnOpenGold} alt="Open" draggable={false} /></button>
        </div>
      </div>
    </div>
  )
}
