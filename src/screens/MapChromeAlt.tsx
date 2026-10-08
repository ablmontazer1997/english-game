import type { Quest, World } from '../types/game'
import type { Streak } from '../services/api'
import { art, Chip, type ArtName } from '../components/PageArt'
import { useCountdown } from '../components/Rewards'
import { dayEnd } from '../services/progress'
import atlasIcon from '../assets/atlas/icon.png'
import questIcon from '../assets/sky/nav2_quests.png'
import './mapalt.css'

/* Map chrome. Admin 10-05 (msg 4004) picked c, now the default; ?maplayout=a|b still shows the other drafts.
   a: daily quests as a row of small cards under the HUD, the chest is the 4th card
   b: the world map button takes the chest's corner; daily card + labelled chips on the left
   c: one status bar (streak / review / quests) under the HUD, world map in the corner */
export type MapLayout = 'a' | 'b' | 'c'
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('maplayout') : null
export const MAP_LAYOUT: MapLayout | null = q === 'a' || q === 'b' ? q : 'c'

const ICON: Record<string, ArtName> = {
  win: 'qi_star', three: 'qi_star', stars: 'qi_star', correct: 'qi_crystal', xp: 'qi_flame', variety: 'qi_crystal',
  cauldron: 'qi_potion', boss: 'qi_flame', games: 'qi_crystal', all: 'qi_chest',
}
const iconOf = (qq: Quest) => art(ICON[qq.id.split(':').pop()!] ?? 'qi_star')

type Props = {
  layout: MapLayout; world?: World; quests: Quest[]; http: boolean; reviewDue: number; streak: Streak | null
  onAtlas: () => void; onCauldron?: () => void; onHearth?: () => void; onQuests?: () => void
}

export function MapChromeAlt(p: Props) {
  const dailies = p.quests.filter((x) => x.period === 'daily')
  const main = dailies.filter((x) => !x.bonus).slice(0, 3)
  const bonus = dailies.find((x) => x.bonus)
  const finished = main.filter((x) => x.progress >= x.target).length
  const claimable = dailies.some((x) => x.progress >= x.target && !x.done)
  const showReview = p.http && !!p.onCauldron
  const showStreak = p.http && !!p.onHearth && !!p.streak
  const st = p.streak
  const days = st ? `${st.current} day${st.current === 1 ? '' : 's'}` : ''
  const left = useCountdown(dayEnd())

  const review = (cls: string) => showReview && (
    <button className={`${cls} mla-review${p.reviewDue ? ' has-due' : ''}`} onClick={p.onCauldron} aria-label={`Review, ${p.reviewDue} words due`}>
      <img src={art('qi_potion')} alt="" draggable={false} />
      <span className="mla-tx"><b>{p.reviewDue > 99 ? '99+' : p.reviewDue} due</b><small>Review</small></span>
    </button>
  )
  const hearth = (cls: string) => showStreak && st && (
    <button className={`${cls} mla-streak${st.today_done ? '' : ' is-out'}`} onClick={p.onHearth} aria-label={`Streak ${days}`}>
      <img src={art('qi_flame')} alt="" draggable={false} />
      <span className="mla-tx"><b>{days}</b><small>{st.today_done ? 'Streak' : 'Play today'}</small></span>
    </button>
  )
  const done = p.world ? p.world.stages.filter((s) => s.status === 'done').length : 0
  const total = p.world?.stages.length ?? 0
  const atlasCard = (
    <button className="mlx-atlas sk sk-card reveal" onClick={p.onAtlas} aria-label="Open the world map">
      <img src={atlasIcon} alt="" draggable={false} />
      <span className="mla-tx">
        <small>World map</small>
        <b className="mlx-atlas-name">{p.world ? p.world.name.split(':')[0] : 'World Map'}</b>
        {total > 0 && <em>{done} / {total} stages</em>}
      </span>
    </button>
  )

  if (p.layout === 'a') return (
    <div className="map-chrome mla">
      <div className="mla-col">
      <div className="mla-strip sk sk-card reveal" role="button" tabIndex={0} onClick={p.onQuests} aria-label="Daily quests">
        <div className="mla-head">
          <b>Daily quests</b>
          <Chip>{left.label}</Chip>
        </div>
        <div className="mla-row">
          {main.map((x) => {
            const pct = Math.min(100, (x.progress / x.target) * 100)
            const ready = x.progress >= x.target && !x.done
            return (
              <div key={x.id} className={`mla-tile${x.done ? ' is-done' : ''}${ready ? ' is-ready' : ''}`}>
                <img src={iconOf(x)} alt="" draggable={false} />
                <span className="mla-tile-t">{x.title}</span>
                <span className="mla-bar"><i style={{ width: `${pct}%` }} /></span>
                <em>{x.done ? 'Claimed' : ready ? 'Claim!' : `${Math.min(x.progress, x.target)}/${x.target}`}</em>
              </div>
            )
          })}
          <div className={`mla-tile mla-chest${bonus?.done ? ' is-done' : ''}${finished >= 3 && !bonus?.done ? ' is-ready' : ''}`}>
            <img src={art(bonus?.done ? 'chest_open' : 'chest_wood')} alt="" draggable={false} />
            <span className="mla-tile-t">Daily chest</span>
            <span className="mla-bar"><i style={{ width: `${(finished / 3) * 100}%` }} /></span>
            <em>{bonus?.done ? 'Claimed' : `${finished}/3`}</em>
          </div>
        </div>
      </div>
      <div className="mla-under">
        <button className="atlas-btn mla-atlas reveal" onClick={p.onAtlas} aria-label="Open the world map">
          <img src={atlasIcon} alt="" draggable={false} />
          <span>{p.world ? p.world.name.split(':')[0] : 'World Map'}</span>
        </button>
        <div className="mla-side">
          {review('mla-chip sk sk-row reveal')}
          {hearth('mla-chip sk sk-row reveal')}
        </div>
      </div>
      </div>
    </div>
  )

  if (p.layout === 'b') return (
    <div className="map-chrome mlb">
      <button className="mlb-daily sk sk-card reveal" onClick={p.onQuests} aria-label="Daily quests">
        <img src={questIcon} alt="" draggable={false} />
        <span className="mla-tx">
          <b>Daily quests</b>
          <span className="mla-bar"><i style={{ width: `${(finished / 3) * 100}%` }} /></span>
          <small>{finished} of 3 done · chest at 3</small>
        </span>
        {claimable && <i className="mla-dot" />}
      </button>
      <div className="mlb-side">
        {review('mla-chip sk sk-row reveal')}
        {hearth('mla-chip sk sk-row reveal')}
      </div>
      {atlasCard}
    </div>
  )

  return (
    <div className="map-chrome mlc">
      <div className="mlc-bar sk sk-card reveal">
        {hearth('mlc-seg')}
        {review('mlc-seg')}
        <button className="mlc-seg" onClick={p.onQuests} aria-label="Daily quests">
          <img src={art(bonus?.done ? 'chest_open' : 'chest_wood')} alt="" draggable={false} />
          <span className="mla-tx"><b>{finished}/3</b><small>Quests</small></span>
          {claimable && <i className="mla-dot" />}
        </button>
      </div>
      {atlasCard}
    </div>
  )
}
