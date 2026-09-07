import { useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import type { Stage } from '../types/game'
import { skySrc } from '../components/SkyIcon'
import { themeFor, MAP_ASPECT, MAP_PAD_W, MAP_NODES } from './mapLayout'
import mapW1 from '../assets/sky/map_w1.webp'
import { MapLife } from '../components/MapLife'
import './map.css'

/** A disc is drawn a touch wider than the path, and the perspective scaling is
 *  damped: the raw ratio between the foot and the head of the path is far too
 *  strong once a real disc is on it. */
const PAD_OVER = 0.87
const damp = (s: number) => 0.6 + 0.4 * s

export function MapScreen({ onPlay }: { onPlay: (s: Stage) => void }) {
  const { worlds, quests } = useGame()
  const [worldIdx, setWorldIdx] = useState(0)
  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  const world = worlds[worldIdx % Math.max(1, worlds.length)]
  const theme = themeFor(worldIdx)
  const stages = world?.stages ?? []

  // the scene is one picture: scale it to cover the screen and centre it, the
  // way a background does, so no stage ever needs to be scrolled to
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    read()
    return () => ro.disconnect()
  }, [])

  const sceneW = Math.max(box.w, box.h * MAP_ASPECT)
  const sceneH = sceneW / MAP_ASPECT
  const daily = quests.find((q) => q.period === 'daily')
  const dailyPct = daily ? Math.min(100, Math.round((daily.progress / daily.target) * 100)) : 0

  return (
    <div className="screen map-screen full">
      <div className="mw-frame" ref={frame}>
        <div className="mw-scene" style={{
          width: sceneW, height: sceneH,
          left: (box.w - sceneW) / 2, top: (box.h - sceneH) / 2,
          filter: theme.filter,
        }}>
          <img className="mw-bg" src={mapW1} alt="" draggable={false} />
          <MapLife width={sceneW} height={sceneH} />
          {stages.map((stage, i) => {
            const n = MAP_NODES[i]
            if (!n) return null
            return (
              <RoadToken key={stage.id} stage={stage} node={n}
                width={sceneW * MAP_PAD_W * damp(n.scale) * PAD_OVER} onPlay={onPlay} />
            )
          })}
        </div>
      </div>

      <div className="map-chrome">
        {daily && (
          <button className="daily-card reveal" aria-label={`Daily quest: ${daily.title}`}>
            <img className="daily-card-bg" src={skySrc('card_daily')} alt="" draggable={false} />
            <span className="daily-card-title">Daily Quest</span>
            <span className="daily-card-fill" style={{ width: `${dailyPct * 0.52}%` }} />
          </button>
        )}

        <button className="world-drop reveal" onClick={() => setWorldIdx((v) => (v + 1) % Math.max(1, worlds.length))}>
          <img className="world-drop-bg" src={skySrc('dropdown')} alt="" draggable={false} />
          <span className="world-drop-txt">{world ? world.name : 'Sky Realm'}</span>
        </button>

        <div className="chest-widget reveal">
          <img className="chest-widget-bg" src={skySrc('widget_chest')} alt="" draggable={false} />
          <span className="chest-widget-txt">1 / 4</span>
        </div>
      </div>
    </div>
  )
}

function RoadToken({ stage, node, width, onPlay }: {
  stage: Stage; node: { x: number; y: number }; width: number; onPlay: (s: Stage) => void
}) {
  const locked = stage.status === 'locked'
  const current = stage.status === 'current'
  const done = stage.status === 'done'
  return (
    <div className={`rtoken${current ? ' is-current' : ''}${node.x > 0.55 ? ' flip' : ''}`}
      style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%`, width }}>
      {current && <span className="rtoken-halo" aria-hidden />}
      <button className="rtoken-btn" disabled={locked}
        onClick={() => !locked && onPlay(stage)}
        aria-label={locked ? `Level ${stage.index} locked` : `Play level ${stage.index}`}>
        <img className="rtoken-pad" src={skySrc('pad_base')} alt="" draggable={false} />
        {locked
          ? <img className="rtoken-lock" src={skySrc('pad_lock')} alt="" draggable={false} />
          : <span className="rtoken-num">{stage.index}</span>}
        {done && (
          <span className="rtoken-stars">
            {[0, 1, 2].map((i) => (
              <img key={i} src={skySrc('pad_star')} alt="" draggable={false}
                className={`rtoken-star${i < stage.stars ? '' : ' off'}`} />
            ))}
          </span>
        )}
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
