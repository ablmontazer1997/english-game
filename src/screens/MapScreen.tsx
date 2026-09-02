import { useMemo, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { StarIcon, LockIcon, CrownIcon, ChestIcon, FlameIcon } from '../components/Icon'
import type { Stage, World } from '../types/game'
import mapBg from '../assets/map-bg.webp'
import nodeImg from '../assets/node.webp'
import pathImg from '../assets/path.webp'
import { GateVortex } from '../components/GateVortex'
import './map.css'

// Each STAGE is one non-scrolling screen: an illustrated floating stone path
// with a fixed number of node tokens sitting on its curve + a Final Gate.
const NODES_PER_STAGE = 6

// Node anchor points, in percent of the PATH sprite's own box (traced from the
// illustrated path art bottom -> top). Nodes are children of the path island,
// so these track the curve at any scale.
// each point is centered on a real cobblestone landing-pad of the illustrated
// path (detected bottom -> top). `size` is the token width in px; the bottom pad
// is the biggest, so node 1 is the biggest — like the reference.
const PATH_POINTS = [
  { x: 36, y: 84, size: 88 }, // pad 1 — biggest, bottom
  { x: 64, y: 71, size: 66 },
  { x: 50, y: 58, size: 70 },
  { x: 71, y: 46, size: 68 },
  { x: 54, y: 38, size: 66 },
  { x: 78, y: 27, size: 66 },
]
// Final Gate — decoupled from the path, placed in SCREEN percent near the top,
// behind the path so the path's top lobe reaches up to its base.
const PORTAL_POINT = { x: 62, y: 24 }

// island sprites (skip isl_00 — the merged left column)
const islandUrls = Object.entries(
  import.meta.glob('../assets/islands/*.webp', { eager: true, import: 'default' }),
).filter(([p]) => !p.endsWith('isl_00.webp')).sort().map(([, u]) => u as string)

// island decoration slots (percent of the frame), spread on BOTH sides and kept
// fully INSIDE the frame (no bleeding off the edges).
const ISLE_SLOTS = [
  // left flank
  { x: 14, y: 26, w: 88, far: false }, { x: 12, y: 48, w: 70, far: true },
  { x: 22, y: 69, w: 90, far: false }, { x: 26, y: 88, w: 68, far: true },
  // right flank
  { x: 86, y: 32, w: 86, far: false }, { x: 88, y: 54, w: 72, far: true },
  { x: 85, y: 75, w: 90, far: false }, { x: 87, y: 90, w: 66, far: true },
]

interface Placed { stage: Stage; world: World; x: number; y: number; size: number }

export function MapScreen({ onPlay }: { onPlay: (s: Stage) => void }) {
  const { worlds, quests } = useGame()

  // flat node list with world ref, then split into stages of NODES_PER_STAGE
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

  // pin each stage node onto a fixed anchor on the illustrated path
  const placed: Placed[] = slice.map((f, i) => ({ ...f, ...PATH_POINTS[i % PATH_POINTS.length] }))
  // the Final Gate wakes up only when the last node is reached (unlocked)
  const gateActive = placed.length > 0 && placed[placed.length - 1].stage.status !== 'locked'

  const isles = useMemo(() => ISLE_SLOTS.map((s, i) => ({
    ...s, url: islandUrls[(i * 3 + 1) % islandUrls.length],
    amp: (s.far ? 5 : 8) + (i % 3) * 2, dur: 5 + (i % 4), delay: -(i * 0.9),
  })), [])

  const daily = quests.find((q) => q.period === 'daily')

  return (
    <div className="screen map-screen full">
      <div className="map-bg" style={{ backgroundImage: `url(${mapBg})` }} />
      <div className="map-bg-fade" />

      <div className="map-overlay">
        {daily && (
          <div className="daily-banner reveal">
            <div className="daily-scroll"><FlameIcon size={18} /></div>
            <div className="daily-txt">
              <b>Daily Quest</b>
              <span>{daily.title}</span>
              <div className="daily-bar"><i style={{ width: `${Math.min(100, (daily.progress / daily.target) * 100)}%` }} /></div>
            </div>
            <div className="daily-reward"><ChestIcon size={22} /></div>
          </div>
        )}
        {world && <div className="world-tag reveal">{world.name} · <span>Stage {stageIdx + 1}</span></div>}
      </div>

      <div className="map-canvas">
        {/* floating islands — decoration behind the path, all on one screen */}
        {isles.map((s, i) => (
          <img key={i} className={`isle${s.far ? ' far' : ''}`} src={s.url} alt="" draggable={false}
            style={{ left: `${s.x}%`, top: `calc(${s.y}% - ${s.x < 50 ? 80 : 0}px)`, width: s.w * 2,
              // @ts-expect-error css var
              '--amp': `${s.amp}px`, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}

        {/* the illustrated floating stone path — the hero of the screen.
            nodes + portal are its children so they ride the curve at any scale */}
        {/* Final Gate — BEHIND the path (lower z), fixed near the top; the path's
            top lobe rises up to meet its base. The vortex animates only once the
            gate is unlocked (user reached the final stage). */}
        <div className="portal-top" style={{ left: `${PORTAL_POINT.x}%`, top: `${PORTAL_POINT.y}%` }}>
          <div className="portal-frame">
            <GateVortex active={gateActive} width={154} />
          </div>
        </div>

        <div className="path-island">
          <img className="path-sprite" src={pathImg} alt="" draggable={false} />
          {/* stage nodes ride ON TOP of the path */}
          {placed.map((p) => <NodeDot key={p.stage.id} p={p} onPlay={onPlay} />)}
        </div>
      </div>

      {/* stage pager */}
      <div className="stage-pager">
        <button disabled={stageIdx === 0} onClick={() => setView(stageIdx - 1)} aria-label="Previous stage">‹</button>
        <span>{stageIdx + 1} / {stageCount}</span>
        <button disabled={stageIdx >= stageCount - 1} onClick={() => setView(stageIdx + 1)} aria-label="Next stage">›</button>
      </div>
    </div>
  )
}

function NodeDot({ p, onPlay }: { p: Placed; onPlay: (s: Stage) => void }) {
  const { stage } = p
  const disabled = stage.status === 'locked'
  const label = disabled ? '' : String(stage.index)
  return (
    <div className="node-wrap" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
      <button className={`node node-${stage.status}`} disabled={disabled}
        onClick={() => !disabled && onPlay(stage)}
        aria-label={disabled ? 'Locked' : `${p.world.name} Stage ${stage.index}`}>
        <img className="node-token" src={nodeImg} alt="" draggable={false} style={{ width: p.size }} />
        {stage.status === 'current' && <span className="node-rise" />}
        <span className="node-center" style={{ fontSize: Math.round(p.size * 0.32) }}>{disabled ? <LockIcon size={Math.round(p.size * 0.28)} /> : label}</span>
        {stage.kind === 'boss' && !disabled && <span className="boss-flag"><CrownIcon size={15} /></span>}
      </button>
      {stage.status === 'done' && (
        <div className="node-stars">
          {[0, 1, 2].map((i) => <StarIcon key={i} size={12} className={i < stage.stars ? 'on' : 'off'} />)}
        </div>
      )}
      {stage.status === 'current' && <span className="cur-label">Current</span>}
    </div>
  )
}
