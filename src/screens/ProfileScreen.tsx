import { useGame } from '../services/ServiceProvider'
import { Panel, Art, art, PAGE_BG, type ArtName } from '../components/PageArt'
import type { CurrencyId } from '../types/game'
import './pages.css'

const BADGES: ArtName[] = ['badge_1', 'badge_2', 'badge_3', 'badge_lock1', 'badge_lock2']

export function ProfileScreen({ onCustomize }: { onBuy: (c: CurrencyId) => void; onCustomize: () => void }) {
  const { profile, worlds, currencies } = useGame()
  if (!profile) return <div className="screen pg" />
  const stars = worlds.reduce((a, w) => a + w.stages.reduce((b, s) => b + s.stars, 0), 0)

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.profile} alt="" draggable={false} />
      <div className="pg-scroll">
        <div className="pf-stage reveal">
          <iframe className="pf-char3d" src="/runecast-studio/profile-viewer.html?bg=none" title="character" scrolling="no" />
          <Art name="podium" className="pf-podium" />
          <Panel name="btn_edit" className="pf-edit" onClick={onCustomize}>Edit</Panel>
        </div>

        <Panel name="pnl_card4" inner="pf-name">
          <span className="pf-name-t">{profile.name}<i className="pf-lvl">{profile.level}</i></span>
        </Panel>

        <div className="pf-stats">
          <Panel name="card_stat" inner="pf-stat">
            <img src={art('qi_flame')} alt="" draggable={false} />
            <b>{profile.streak}</b><span>Streak</span>
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

        <Panel name="panel_wide" inner="pf-ach">
          <span className="pf-ach-t">Achievements</span>
          <div className="pf-ach-row">
            {BADGES.map((b) => <img key={b} src={art(b)} alt="" draggable={false} />)}
          </div>
        </Panel>
      </div>
    </div>
  )
}
