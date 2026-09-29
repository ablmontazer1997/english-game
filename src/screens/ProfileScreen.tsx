import { useGame } from '../services/ServiceProvider'
import { Panel, Art, art, PAGE_BG } from '../components/PageArt'
import { usePortrait } from '../components/Portrait'
import { medal, TIER_NAME } from './AchievementsScreen'
import type { CurrencyId } from '../types/game'
import './pages.css'
import '../components/progression.css'

export function ProfileScreen({ onCustomize, onAchievements }: { onBuy: (c: CurrencyId) => void; onCustomize: () => void; onAchievements: () => void }) {
  const { profile, worlds, currencies, achievements, inventory } = useGame()
  const portrait = usePortrait()
  if (!profile) return <div className="screen pg" />
  const stars = worlds.reduce((a, w) => a + w.stages.reduce((b, s) => b + s.stars, 0), 0)
  const claimed = achievements.filter((a) => a.claimed)
  const ready = achievements.filter((a) => a.progress >= a.target && !a.claimed).length
  // the showcase: best tier earned in each family, newest-looking first (highest tier)
  const best: Record<string, (typeof achievements)[number]> = {}
  for (const a of claimed) { const f = a.id.split('.')[0]; if (!best[f] || best[f].tier < a.tier) best[f] = a }
  const shelf = Object.values(best).sort((a, b) => b.tier - a.tier).slice(0, 5)

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.profile} alt="" draggable={false} />
      <div className="pg-scroll">
        <div className="pf-stage reveal">
          <iframe className="pf-char3d" src="/runecast-wardrobe/?embed=1" title="character" scrolling="no" />
          <Art name="podium" className="pf-podium" />
          <Panel name="btn_edit" className="pf-edit" onClick={onCustomize}>Edit</Panel>
        </div>

        <Panel name="pnl_card4" inner="pf-name">
          <img className="pf-face" src={portrait} alt="" draggable={false} />
          <span className="pf-name-t">{profile.name}<i className="pf-lvl">{profile.level}</i></span>
        </Panel>

        <div className="pf-stats">
          <Panel name="card_stat" inner="pf-stat">
            <img src={art('qi_flame')} alt="" draggable={false} />
            <b>{profile.streak}</b><span>{inventory?.freezes ? `Streak · ❄${inventory.freezes}` : 'Streak'}</span>
          </Panel>
          <Panel name="card_stat" inner="pf-stat">
            <img src={art('qi_star')} alt="" draggable={false} />
            <b>{stars}</b><span>Stars</span>
          </Panel>
          <Panel name="card_stat" inner="pf-stat">
            <img src={art('gem_s')} alt="" draggable={false} />
            <b>{currencies?.gems ?? 0}</b><span>Gems</span>
          </Panel>
        </div>

        <Panel name="panel_wide" inner="pf-ach" onClick={onAchievements}>
          <span className="pf-ach-t">Achievements <small>{claimed.length}/{achievements.length}</small>{ready > 0 && <em className="pf-ach-new">{ready} to claim</em>}</span>
          <div className="pf-ach-row">
            {shelf.map((a) => (
              <span key={a.id} className={`ac-medal sm t${a.tier}`} title={`${a.title} · ${TIER_NAME[a.tier]}`}><img src={medal(a.cat)} alt="" draggable={false} /></span>
            ))}
            {Array.from({ length: Math.max(0, 5 - shelf.length) }, (_, i) => <img key={i} src={art(i % 2 ? 'badge_lock2' : 'badge_lock1')} alt="" draggable={false} />)}
          </div>
          <span className="pf-ach-more">View all ›</span>
        </Panel>
      </div>
    </div>
  )
}
