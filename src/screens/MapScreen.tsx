import { useMemo, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import type { Stage, World } from '../types/game'
import { SkyIcon, skySrc, type SkyName } from '../components/SkyIcon'
import mapBg from '../assets/sky/map-bg.png'
import './map.css'

// One screen = one stage of the sky road. The background plate is the painted
// world (islands, road, portal); the level tokens are positioned in percent of
// that plate so they always sit on the road at any screen size.
const NODES_PER_STAGE = 6

// Anchors traced along the painted road, bottom -> top. `size` is the token
// width in px; the nearest pad is the largest, exactly as in the reference.
const ROAD_POINTS = [
  { x: 21, y: 92, size: 116 },
  { x: 38, y: 82, size: 106 },
  { x: 50, y: 71, size: 98 },
  { x: 53, y: 59, size: 92 },
  { x: 57, y: 47, size: 87 },
  { x: 62, y: 35, size: 83 },
]

interface Placed { stage: Stage; world: World; x: number; y: number; size: number }

export function MapScreen({ onPlay }: { onPlay: (s: Stage) => void }) {
  const { worlds, quests } = useGame()

  const flat = useMemo(() => {
    const out: { stage: Stage; world: World }[] = []
    worlds.forEach((w) => w.stages.forEach((stage) => out.push({ stage, world: w })))
    return out
  }, [worlds])

  const stageCount = Math.max(1, Math.ceil(flat.length / NODES_PER_STAGE))
  const currentStageIdx = Math.floor(
    Math.max(0, flat.findIndex((f) => f.stage.status === 'current')) / NODES_PER_STAGE,
  )
  const [view, setView] = useState(currentStageIdx)
  const stageIdx = Math.min(view, stageCount - 1)

  const slice = flat.slice(stageIdx * NODES_PER_STAGE, stageIdx * NODES_PER_STAGE + NODES_PER_STAGE)
  const world = slice[0]?.world
  const placed: Placed[] = slice.map((f, i) => ({ ...f, ...ROAD_POINTS[i % ROAD_POINTS.length] }))

  const daily = quests.find((q) => q.period === 'daily')
  const dailyPct = daily ? Math.min(100, Math.round((daily.progress / daily.target) * 100)) : 0

  return (
    <div className="screen map-screen full">
      {/* painted world; tokens are its children so they ride the road */}
      <div className="map-plate">
        <img className="map-plate-img" src={mapBg} alt="" draggable={false} />
        {placed.map((p) => <RoadToken key={p.stage.id} p={p} onPlay={onPlay} />)}
      </div>

      {/* --- overlay chrome, laid out like the reference --- */}
      <div className="map-chrome">
        {daily && (
          <button className="daily-card reveal" aria-label={`Daily quest: ${daily.title}`}>
            <img className="daily-card-bg" src={skySrc('card_daily')} alt="" draggable={false} />
            <span className="daily-card-title">Daily Quest</span>
            <span className="daily-card-fill" style={{ width: `${dailyPct * 0.52}%` }} />
          </button>
        )}

        <button className="world-drop reveal" onClick={() => setView((v) => (v + 1) % stageCount)}>
          <img className="world-drop-bg" src={skySrc('dropdown')} alt="" draggable={false} />
          <span className="world-drop-txt">
            {world ? world.name : 'Sky Realm'} - Stage {stageIdx + 1}
          </span>
        </button>

        <div className="side-rail">
          <SideButton label="Mail" icon="ic_mail" dot />
          <SideButton label="Events" icon="ic_events" />
          <SideButton label="Friends" icon="ic_friends" />
        </div>

        <div className="chest-widget reveal">
          <img className="chest-widget-bg" src={skySrc('widget_chest')} alt="" draggable={false} />
          <span className="chest-widget-txt">1 / 4</span>
        </div>
      </div>
    </div>
  )
}

function SideButton({ label, icon, dot }: { label: string; icon: SkyName; dot?: boolean }) {
  return (
    <button className="side-btn" aria-label={label}>
      <span className="side-btn-face">
        <img className="side-btn-bg" src={skySrc('btn_side')} alt="" draggable={false} />
        <SkyIcon name={icon} size={28} className="side-btn-ic" />
        {dot && <i className="side-btn-dot" />}
      </span>
      <span className="side-btn-lbl">{label}</span>
    </button>
  )
}

function RoadToken({ p, onPlay }: { p: Placed; onPlay: (s: Stage) => void }) {
  const locked = p.stage.status === 'locked'
  const current = p.stage.status === 'current'
  return (
    <div className={`rtoken${current ? ' is-current' : ''}`}
      style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size }}>
      <button className="rtoken-btn" disabled={locked}
        onClick={() => !locked && onPlay(p.stage)}
        aria-label={locked ? `Level ${p.stage.index} locked` : `Play level ${p.stage.index}`}>
        <SkyIcon name={locked ? 'token_locked' : 'token_open'} size={p.size} className="rtoken-img" />
        {!locked && <span className="rtoken-num">{p.stage.index}</span>}
      </button>
      {current && (
        <span className="rtoken-current">
          <img src={skySrc('pill_current')} alt="" draggable={false} />
          <b>Current</b>
        </span>
      )}
    </div>
  )
}
