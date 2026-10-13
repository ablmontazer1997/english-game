import { useEffect, useRef, useState } from 'react'
import { use3dFallback } from '../components/use3dFallback'
import { ItemsSheet } from './ItemsSheet'
import { useGame } from '../services/ServiceProvider'
import { Card, Btn, Slot, Art, art } from '../components/PageArt'
import hero2d from '../assets/games/boss2/hero.webp'
import { usePortrait } from '../components/Portrait'
import { TIER_NAME } from './AchievementsScreen'
import { api, type SeasonOut } from '../services/api'
import bgProfile from '../assets/es2/shop/bg_shop_dusk.webp'   // admin 5427: Profile uses the Shop dusk
import flameArt from '../assets/es2/profile/flame.webp'
import starArt from '../assets/es2/profile/star.webp'
import gemsArt from '../assets/es2/profile/gems.webp'
import chestArt from '../assets/es2/profile/chest.webp'
import scrollArt from '../assets/es2/quests/trophy.webp'
import mHat from '../assets/es2/profile/m_hat.webp'
import mBook from '../assets/es2/profile/m_book.webp'
import mFlame from '../assets/es2/profile/m_flame.webp'
import mCrown from '../assets/es2/profile/m_crown.webp'
import mStar from '../assets/es2/profile/m_star.webp'
import mLock from '../assets/es2/profile/m_lock.webp'
import type { AchievementCat } from '../types/game'
import type { CurrencyId } from '../types/game'
import './pages.css'
import { ProfileHeroStage, ProfileHeroCard } from './ProfileHero'

// TEST: two showcase directions under review (admin msg 4267 picked B, the default; ?pf=a stage, ?pf=0 the old podium)
const PF = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('pf') ?? 'b'
import '../components/progression.css'

// b1 medal per achievement family (concept 04: coloured medals for earned, the silver padlock for the rest)
const MEDAL_ES2: Record<AchievementCat, string> = { journey: mHat, explorer: mHat, stars: mStar, gems: mStar, treasure: mStar, scholar: mBook, quests: mBook,
  streak: mFlame, elixir: mFlame, boss: mCrown, wealth: mCrown, league: mCrown }

/** the Season Pass mini card (concept 04): tier progress, opens the pass */
function SeasonMini({ onOpen }: { onOpen: () => void }) {
  const [s, setS] = useState<SeasonOut | null>(null)
  useEffect(() => { api.season().then(setS).catch(() => {}) }, [])
  if (!s) return null
  return (
    <button className="pf2-card pf2-season esk-enter" onClick={onOpen} aria-label={`Season Pass: tier ${s.tier} of ${s.tiers_total}`}>
      <img src={scrollArt} alt="" draggable={false} />
      <span className="pf2-season-m"><b className="pf2-t">Season Pass</b>
        <span className="pf2-season-bar"><span><i style={{ width: `${Math.min(100, (s.tier / s.tiers_total) * 100)}%` }} /></span><b>{s.tier}/{s.tiers_total}</b></span></span>
    </button>
  )
}

export function ProfileScreen({ onCustomize, onAchievements, onSeason }: { onBuy: (c: CurrencyId) => void; onCustomize: () => void; onAchievements: () => void; onSeason?: () => void }) {
  const { profile, worlds, currencies, achievements, inventory, mode, streak } = useGame()
  const [items, setItems] = useState(false)
  const portrait = usePortrait()
  const hero = useHero3d()
  const heroFb = use3dFallback(hero.ready)
  if (!profile) return <div className="screen pg" />
  const stars = worlds.reduce((a, w) => a + w.stages.reduce((b, s) => b + s.stars, 0), 0)
  const claimed = achievements.filter((a) => a.claimed)
  const ready = achievements.filter((a) => a.progress >= a.target && !a.claimed).length
  // the showcase: best tier earned in each family, newest-looking first (highest tier)
  const best: Record<string, (typeof achievements)[number]> = {}
  for (const a of claimed) { const f = a.id.split('.')[0]; if (!best[f] || best[f].tier < a.tier) best[f] = a }
  const shelf = Object.values(best).sort((a, b) => b.tier - a.tier).slice(0, 5)

  const statsRow = (
<div className="pf-stats">
          <Card name="card_stat" className="pf-stat">
            <img src={art('qi_flame')} alt="" draggable={false} />
            <b>{streak?.current ?? profile.streak}</b><span>{inventory?.freezes ? `Hearthfire · ❄${inventory.freezes}` : mode === 'http' ? 'Hearthfire' : 'Streak'}</span>
          </Card>
          <Card name="card_stat" className="pf-stat">
            <img src={art('qi_star')} alt="" draggable={false} />
            <b>{stars}</b><span>Stars</span>
          </Card>
          <Card name="card_stat" className="pf-stat">
            <img src={art('gem_s')} alt="" draggable={false} />
            <b>{currencies?.gems ?? 0}</b><span>Gems</span>
          </Card>
        </div>
  )

  return (
    <div className="screen pg">
      <img className="pg-bg" src={bgProfile} alt="" draggable={false} />
      <div className="pg-scroll">
        {PF === 'b' ? (
          <ProfileHeroCard name={profile.name} level={profile.level} onEdit={onCustomize} stats={[
            { icon: flameArt, value: streak?.current ?? profile.streak, label: mode === 'http' ? 'Hearthfire' : 'Streak' },
            { icon: starArt, value: stars, label: 'Stars' },
            { icon: gemsArt, value: currencies?.gems ?? 0, label: 'Gems' },
          ]} />
        ) : PF === 'a' ? (
          <ProfileHeroStage name={profile.name} level={profile.level} onEdit={onCustomize}>{statsRow}</ProfileHeroStage>
        ) : <>
        {/* the hero on the podium: live 3D when the wardrobe page loads, the painted hero until then (or if it can't) */}
        <div className="pf-stage reveal">
          <Art name="podium" className="pf-podium" />
          <img className={`pf-char${hero.ready || !heroFb ? ' off' : ''}`} src={hero2d} alt="" draggable={false} />
          <iframe ref={hero.ref} className={`pf-char3d${hero.ready ? ' on' : ''}`} src="/runecast-wardrobe/?embed=1" title="character" scrolling="no" />
        </div>

        <Card className="ui-row pf-name">
          <Slot className="pf-face-slot"><img className="pf-face" src={portrait} alt="" draggable={false} /></Slot>
          <span className="pf-name-t"><span className="ui-t">{profile.name}</span><i className="pf-lvl">{profile.level}</i></span>
          <span className="ui-trail"><Btn name="btn_edit" onClick={onCustomize}>Edit</Btn></span>
        </Card>

        {statsRow}
        </>}

        

        {mode === 'http' && (
          <button className="pf2-card pf2-items esk-enter" onClick={() => setItems(true)}>
            <img src={chestArt} alt="" draggable={false} />
            <b className="pf2-t">My Items</b>
            <span className="pf2-more">Wear ›</span>
          </button>
        )}
        <ItemsSheet open={items} onClose={() => setItems(false)} />

        <button className="pf2-card pf2-ach esk-enter" onClick={onAchievements}>
          <span className="pf2-ach-h"><b className="pf2-t">Achievements</b><small>{claimed.length}/{achievements.length}</small>{ready > 0 && <em className="pf2-claim">{ready} to claim</em>}</span>
          <span className="pf2-medals">
            {shelf.map((a) => <img key={a.id} src={MEDAL_ES2[a.cat] ?? mStar} alt={`${a.title} · ${TIER_NAME[a.tier]}`} draggable={false} />)}
            {Array.from({ length: Math.max(0, 5 - shelf.length) }, (_, i) => <img key={i} className="lock" src={mLock} alt="" draggable={false} />)}
          </span>
          <span className="pf2-more">View all ›</span>
        </button>

        {onSeason && <SeasonMini onOpen={onSeason} />}
      </div>
    </div>
  )
}

/** Watches the embedded 3D hero (same-origin /runecast-wardrobe/): ready once its loader is gone.
 *  Offline or failed loads never become ready, so the painted hero stays on the podium. */
function useHero3d() {
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let n = 0
    const t = setInterval(() => {
      n++
      try {
        const d = ref.current?.contentDocument
        if (d && d.readyState === 'complete' && d.getElementById('c') && !d.getElementById('ld')) {
          clearInterval(t); setTimeout(() => setReady(true), 400)   // a beat for the outfit to dress
        }
      } catch { /* error page: cross-origin, never ready */ }
      if (n > 240) clearInterval(t)
    }, 250)
    return () => clearInterval(t)
  }, [])
  return { ref, ready }
}
