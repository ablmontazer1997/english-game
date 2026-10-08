import { useEffect, useRef, useState } from 'react'
import { ItemsSheet } from './ItemsSheet'
import { useGame } from '../services/ServiceProvider'
import { Card, Btn, Slot, Art, art, PAGE_BG } from '../components/PageArt'
import hero2d from '../assets/games/boss2/hero.webp'
import { usePortrait } from '../components/Portrait'
import { medal, TIER_NAME } from './AchievementsScreen'
import type { CurrencyId } from '../types/game'
import './pages.css'
import { ProfileHeroStage, ProfileHeroCard } from './ProfileHero'

// TEST: two showcase directions under review (admin msg 4267 picked B, the default; ?pf=a stage, ?pf=0 the old podium)
const PF = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('pf') ?? 'b'
import '../components/progression.css'

export function ProfileScreen({ onCustomize, onAchievements }: { onBuy: (c: CurrencyId) => void; onCustomize: () => void; onAchievements: () => void }) {
  const { profile, worlds, currencies, achievements, inventory, mode, streak } = useGame()
  const [items, setItems] = useState(false)
  const portrait = usePortrait()
  const hero = useHero3d()
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
      <img className="pg-bg" src={PAGE_BG.profile} alt="" draggable={false} />
      <div className="pg-scroll">
        {PF === 'b' ? (
          <ProfileHeroCard name={profile.name} level={profile.level} onEdit={onCustomize} stats={[
            { icon: art('qi_flame'), value: streak?.current ?? profile.streak, label: mode === 'http' ? 'Hearthfire' : 'Streak' },
            { icon: art('qi_star'), value: stars, label: 'Stars' },
            { icon: art('gem_s'), value: currencies?.gems ?? 0, label: 'Gems' },
          ]} />
        ) : PF === 'a' ? (
          <ProfileHeroStage name={profile.name} level={profile.level} onEdit={onCustomize}>{statsRow}</ProfileHeroStage>
        ) : <>
        {/* the hero on the podium: live 3D when the wardrobe page loads, the painted hero until then (or if it can't) */}
        <div className="pf-stage reveal">
          <Art name="podium" className="pf-podium" />
          <img className={`pf-char${hero.ready ? ' off' : ''}`} src={hero2d} alt="" draggable={false} />
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
          <Card className="ui-row pf-name" onClick={() => setItems(true)}>
            <Slot src={art('chest_epic')} />
            <span className="pf-name-t"><span className="ui-t">My Items</span></span>
            <span className="ui-trail"><span className="pf-ach-more">Wear ›</span></span>
          </Card>
        )}
        <ItemsSheet open={items} onClose={() => setItems(false)} />

        <Card name="panel_wide" className="pf-ach" onClick={onAchievements}>
          <span className="pf-ach-t"><b>Achievements</b><small>{claimed.length}/{achievements.length}</small>{ready > 0 && <em className="pf-ach-new">{ready} to claim</em>}</span>
          <div className="pf-ach-row">
            {shelf.map((a) => (
              <span key={a.id} className={`ac-medal sm t${a.tier}`} title={`${a.title} · ${TIER_NAME[a.tier]}`}><img src={medal(a.cat)} alt="" draggable={false} /></span>
            ))}
            {Array.from({ length: Math.max(0, 5 - shelf.length) }, (_, i) => <img key={i} src={art(i % 2 ? 'badge_lock2' : 'badge_lock1')} alt="" draggable={false} />)}
          </div>
          <span className="pf-ach-more">View all ›</span>
        </Card>
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
