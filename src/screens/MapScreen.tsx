import { useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import type { Stage } from '../types/game'
import { skySrc } from '../components/SkyIcon'
import { sceneFor } from './worlds'
import { layoutTall } from './tallMap'
import { MapLife } from '../components/MapLife'
import './map.css'
import { WorldAtlas } from './WorldAtlas'
import atlasIcon from '../assets/atlas/icon.png'
import { MapHero, PadBreak, padRuin, useMapAdvance, useReducedMotion } from './MapHero'
import { padLook, pointAt, type PadLook, type Beat } from './mapProgress'

/** A disc is drawn a touch wider than the path, and the perspective scaling is
 *  damped: the raw ratio between the foot and the head of the path is far too
 *  strong once a real disc is on it. */
const PAD_OVER = 0.74
const damp = (s: number) => 0.6 + 0.4 * s

export function MapScreen({ onPlay }: { onPlay: (s: Stage) => void }) {
  const { worlds, quests, submitResult, mode } = useGame()
  const [worldIdx, setWorldIdx] = useState(0)
  const [atlas, setAtlas] = useState(false)
  // the world the map opens on (the one the hero is in) is picked by useMapAdvance below
  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  const world = worlds[worldIdx % Math.max(1, worlds.length)]
  const scene = sceneFor(world?.paint ?? worldIdx)
  const { aspect: MAP_ASPECT, padW: MAP_PAD_W, nodes: MAP_NODES } = scene.map
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

  // a tall world is as wide as the screen and scrolls; a one-panel world covers the screen
  const tall = scene.tall && box.w ? layoutTall(scene.tall, box.w, stages.length) : null
  const sceneW = tall ? box.w : Math.max(box.w, box.h * MAP_ASPECT)
  const sceneH = tall ? tall.h : sceneW / MAP_ASPECT
  const nodes = tall ? tall.nodes : MAP_NODES
  const padW = tall ? tall.road / sceneW : MAP_PAD_W
  const lifeH = tall ? tall.panels[0].h * (scene.tall!.life ?? 1) : sceneH

  // the hero on the road: stands on the current pad; when a stage is finished the pad
  // breaks and the hero walks on to the next one (mapProgress.ts has the rules)
  const reduced = useReducedMotion()
  const padPx = sceneW * padW * damp(1) * PAD_OVER
  const adv = useMapAdvance({ worlds, worldIdx: worldIdx % Math.max(1, worlds.length), setWorldIdx, frame,
    geo: { tall, sceneW, sceneH, padPx, box }, reduced })
  const look = (i: number): PadLook => padLook(i, stages[i].status, adv.plan?.beats ?? null, adv.beatIdx)
  const gateAt = adv.beat?.kind === 'portal' && tall ? pointAt(tall.walk.pts, tall.walk.total) : null

  // open a tall world on the current stage (or the start of the road), a little below the middle
  const cur = stages.findIndex((s) => s.status === 'current')
  const aimed = useRef('')
  useLayoutEffect(() => {
    const el = frame.current
    if (!el || !tall || !box.h) return
    const key = `${scene.id}:${box.w}`
    if (adv.playing) { aimed.current = key; return } // the advance moves the camera itself
    if (aimed.current === key) return
    aimed.current = key
    const n = nodes[cur >= 0 ? cur : stages.every((s) => s.status === 'done') ? nodes.length - 1 : 0]
    if (n) el.scrollTop = Math.max(0, Math.min(sceneH - box.h, n.y * sceneH - box.h * 0.58))
  })
  const daily = quests.find((q) => q.period === 'daily')
  const dailyPct = daily ? Math.min(100, Math.round((daily.progress / daily.target) * 100)) : 0

  return (
    <div className="screen map-screen full">
      <div className={`mw-frame${tall ? ' is-tall' : ''}${adv.playing ? ' is-playing' : ''}${reduced ? ' is-reduced' : ''}`} ref={frame}>
        <div className="mw-scene" style={tall ? { width: sceneW, height: sceneH, left: 0, top: 0 } : {
          width: sceneW, height: sceneH,
          left: (box.w - sceneW) / 2, top: (box.h - sceneH) / 2,
        }}>
          {tall ? tall.panels.map((p, i) => (
            <img key={i} className="mw-panel" src={p.bg} alt="" draggable={false} style={{
              top: p.top, height: p.h, zIndex: i,
              ...(i ? { maskImage: `linear-gradient(#0000, #000 ${tall.overlap}px)`, WebkitMaskImage: `linear-gradient(#0000, #000 ${tall.overlap}px)` } : {}),
            }} />
          )) : <img className="mw-bg" src={scene.bg} alt="" draggable={false} />}
          <div className="mw-lifebox" style={{ height: tall ? tall.panels[0].h : sceneH }}>
            <div className="mw-lifebox-in" style={{ height: lifeH }}>
              <MapLife width={sceneW} height={lifeH} life={scene.life} src={scene.src} fx={scene.fx} extras={scene.extras} />
            </div>
          </div>
          {tall && scene.tall!.clouds?.length ? tall.seams.map((sm, i) => (
            <CloudBank key={i} x={sm.x} y={sm.y} w={sceneW} clouds={scene.tall!.clouds!} flip={i % 2 === 1} />
          )) : null}
          {stages.map((stage, i) => {
            const n = nodes[i]
            if (!n) return null
            return (
              <RoadToken key={stage.id} stage={stage} node={n} look={look(i)}
                beat={adv.beat && 'pad' in adv.beat && adv.beat.pad === i ? adv.beat : null}
                width={sceneW * padW * damp(n.scale) * PAD_OVER} onPlay={onPlay} />
            )
          })}
          {tall && <MapHero heroRef={adv.heroRef} hero3d={adv.hero3d} ready={adv.hero3dReady} hidden={!adv.showHero} />}
          {gateAt && <span className="mgate-flash" style={{ left: gateAt.x, top: gateAt.y }} />}
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

        <button className="atlas-btn reveal" onClick={() => setAtlas(true)} aria-label="Open the world map">
          <img src={atlasIcon} alt="" draggable={false} />
          <span>{world ? world.name : 'World Map'}</span>
        </button>

        {DEMO && mode === 'mock' && (() => {
          const cs = worlds.flatMap((w) => w.stages).find((s) => s.status === 'current')
          return (
            <button className="mapdemo-btn" disabled={!cs || adv.playing}
              onClick={() => cs && submitResult({ stageId: cs.id, correct: 5, total: 5, stars: 3, heartsLost: 0, xpGained: 20, coinsGained: 10 })}>
              Test: finish this stage
            </button>
          )
        })()}

        <div className="chest-widget reveal">
          <img className="chest-widget-bg" src={skySrc('widget_chest')} alt="" draggable={false} />
          <span className="chest-widget-txt">1 / 4</span>
        </div>
      </div>
      {atlas && <WorldAtlas worlds={worlds} current={worldIdx % Math.max(1, worlds.length)}
        onPick={(i) => setWorldIdx(i)} onClose={() => setAtlas(false)} />}
    </div>
  )
}

// test-only: ?mapdemo=1 shows a button that finishes the current stage, to watch the advance
const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('mapdemo')

function RoadToken({ stage, node, width, onPlay, look, beat }: {
  stage: Stage; node: { x: number; y: number }; width: number; onPlay: (s: Stage) => void
  /** how the pad looks now (mapProgress.padLook); beat: the advance beat playing on this pad */
  look: PadLook; beat: Beat | null
}) {
  const locked = look === 'locked'
  const current = look === 'current'
  const done = stage.status === 'done'
  const phase = look === 'breaking' && beat ? (beat.kind === 'burst' ? 'burst' : 'crack') : null
  const arriving = beat?.kind === 'arrive' && current
  // a finished pad is a ruin; it breaks first (whole while it cracks, the ruin under the flying shards)
  const pad = look === 'ruined' || phase === 'burst' ? padRuin : skySrc('pad_base')
  return (
    <div className={`rtoken${current ? ' is-current' : ''}${locked ? ' is-locked' : ''}${look === 'ruined' ? ' is-ruined' : ''}${phase ? ` is-${phase}` : ''}${arriving ? ' is-arriving' : ''}${node.x > 0.55 ? ' flip' : ''}`}
      style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%`, width }}>
      {current && <span className="rtoken-halo" aria-hidden />}
      <button className="rtoken-btn" disabled={stage.status === 'locked'}
        onClick={() => stage.status !== 'locked' && onPlay(stage)}
        aria-label={stage.status === 'locked' ? `Level ${stage.index} locked` : `Play level ${stage.index}`}>
        <img className="rtoken-pad" src={pad} alt="" draggable={false} />
        <PadBreak phase={phase} padSrc={skySrc('pad_base')} />
        {locked && <img className="rtoken-lock" src={skySrc('pad_lock')} alt="" draggable={false} />}
        {done && look === 'ruined' && (
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
          <b>{stage.optional ? 'Bonus' : stage.kind === 'boss' ? 'Boss' : 'Current'}</b>
        </span>
      )}
    </div>
  )
}

/** The clouds over a join between two panels: a few loose puffs gathered on the road
 *  where it crosses, not a wall across the screen (the panels themselves fade into
 *  each other underneath). Positions are in screen widths from the crossing. */
const PUFFS = [
  { c: 0, dx: 0, dy: -0.02, w: 0.62 },   // the big one, sat on the road
  { c: 1, dx: -0.36, dy: -0.1, w: 0.42 }, // a smaller one up and to one side
  { c: 2, dx: 0.34, dy: 0.07, w: 0.5 },   // and one lower on the other
]
function CloudBank({ x, y, w, clouds, flip }: { x: number; y: number; w: number; clouds: string[]; flip: boolean }) {
  return (
    <div className="mw-clouds" style={{ left: x, top: y }} aria-hidden>
      {PUFFS.map((p, i) => (
        <img key={i} src={clouds[p.c % clouds.length]} alt="" draggable={false}
          className={`mw-puff mw-puff-${i}`}
          style={{ left: (flip ? -p.dx : p.dx) * w, top: p.dy * w, width: p.w * w }} />
      ))}
    </div>
  )
}
