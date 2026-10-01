import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import heroFront from '../assets/games/boss2/hero.webp'
import heroCheer from '../assets/games/boss2/hero_cheer.webp'
import heroBack from '../assets/mapv2/hero_back.webp'
import padCrack from '../assets/mapv2/pad_crack.webp'
import padRuin from '../assets/mapv2/pad_ruin.webp'
import {
  cursorOf, cmpCursor, planAdvance, heroPad, pointAt, headingAt, facingFor, walkDuration, walkProgress,
  cloudVeil, loadSeen, saveSeen, type Plan, type Beat, type Facing, type KV, type StageStatus,
} from './mapProgress'
import type { TallLayout } from './tallMap'
import './maphero.css'

/*
 * The hero on the map (view layer only; the rules live in mapProgress.ts).
 *
 * The hero is the 2D painted sprite, not the 3D model: several pads are on
 * screen and the map already runs MapLife, so a sprite costs nothing.
 *
 * WALK FRAMES: drop a frame-by-frame walk cycle into assets/mapv2/walk/
 * (back_00.webp ... and front_00.webp ..., feet on the bottom edge, same canvas)
 * and the walk plays it, one frame per stride step. Until then the walk is a
 * PLACEHOLDER: the standing sprite hops along the road (no cutout rig).
 * The sheet to paint is described in runecast_v2/mapv2/WALK_SHEET_PROMPT.md.
 */
const WALK_FRAMES = import.meta.glob('../assets/mapv2/walk/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const framesFor = (view: string) => Object.entries(WALK_FRAMES)
  .filter(([p]) => p.split('/').pop()!.startsWith(view + '_')).sort(([a], [b]) => a.localeCompare(b)).map(([, u]) => u)
const WALK_BACK = framesFor('back')
const WALK_FRONT = framesFor('front')

export const PAD_ASPECT = 379 / 490 // pad_base.png
/** the token box sits at translate(-50%, -62%) from its node; the hero stands just in front of the top face centre (35% of the pad height) */
const FEET_UP = (0.62 - 0.35) * PAD_ASPECT
const HERO_H = 1.55          // hero height in pad widths
const PACE = 0.5             // walking pace in scene widths per second
const STRIDE = 0.2           // one stride along the road, in scene widths (a placeholder hop / two walk frames)
const SEAM_HOLD = 0.45       // the pause in the clouds at a join (s)
const HOP_ON = 0.38          // the hop up onto the next pad (s)

export function useReducedMotion() {
  const read = () => {
    let app = false
    try { app = localStorage.getItem('rc.set.motion') === '1' } catch { /* ignore */ }
    return app || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }
  const [r, setR] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const on = () => setR(read())
    mq?.addEventListener?.('change', on)
    window.addEventListener('storage', on)
    return () => { mq?.removeEventListener?.('change', on); window.removeEventListener('storage', on) }
  }, [])
  return r
}

const kv: KV = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

type Play = { plans: Plan[]; p: number; k: number }

export type AdvanceGeo = {
  tall: TallLayout | null
  sceneW: number
  sceneH: number
  /** a pad's drawn width in scene px */
  padPx: number
  box: { w: number; h: number }
}

/**
 * Plays an advance when the player's place moves on, and keeps the hero placed.
 * Returns what the pads need to know (the plan and beat playing in the world on
 * screen) and the refs for the hero element.
 */
export function useMapAdvance(opts: {
  worlds: { stages: { status: StageStatus }[] }[]
  worldIdx: number
  setWorldIdx: (i: number) => void
  frame: RefObject<HTMLDivElement | null>
  geo: AdvanceGeo
  reduced: boolean
}) {
  const { worlds, worldIdx, setWorldIdx, frame, geo, reduced } = opts
  const [play, setPlay] = useState<Play | null>(null)
  const playRef = useRef(play); playRef.current = play
  const snap = useRef(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const cursor = cursorOf(worlds)
  const ckey = cursor ? `${cursor.world}:${cursor.stage}` : ''

  // a new place on the road: plan the advance from the place last shown (once). Runs
  // before paint, so the map never flashes the new place first. It also picks the world
  // the map opens on: the one the hero is in (or was in, while an advance is pending).
  const opened = useRef(false)
  useLayoutEffect(() => {
    if (!cursor) return
    const seen = loadSeen(kv)
    saveSeen(kv, cursor)
    const plans = seen && cmpCursor(cursor, seen) > 0
      ? planAdvance(seen, cursor, worlds.map((w) => w.stages.length), reduced) : []
    if (plans.length) {
      opened.current = true
      setWorldIdx(plans[0].world)
      snap.current = true
      setPlay({ plans, p: 0, k: 0 })
    } else if (!opened.current) {
      opened.current = true
      setWorldIdx(cursor.world)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ckey])

  const plan = play ? play.plans[play.p] : null
  const beat: Beat | null = plan && play ? plan.beats[play.k] ?? null : null
  const live = !!plan && plan.world === worldIdx && !!geo.tall
  const beatStart = useRef(0)
  const walkRef = useRef<{ segs: Seg[]; T: number; done?: boolean } | null>(null)
  const beatKey = useRef('')
  const facing = useRef<Facing>({ view: 'back', flip: false })
  const cam = useRef<number | null>(null)

  const next = () => {
    const pl = playRef.current
    if (!pl) return
    let nx: Play | null = null
    if (pl.k + 1 < pl.plans[pl.p].beats.length) nx = { ...pl, k: pl.k + 1 }
    else if (pl.p + 1 < pl.plans.length) {
      nx = { ...pl, p: pl.p + 1, k: 0 }
      setWorldIdx(pl.plans[pl.p + 1].world)
      snap.current = true
    }
    playRef.current = nx
    setPlay(nx)
  }

  // ---- geometry helpers over the current layout
  const G = useRef(geo); G.current = geo
  const padTop = (i: number) => {
    const { tall, sceneW, sceneH, padPx } = G.current
    const n = tall?.nodes[Math.max(0, Math.min(i, (tall?.nodes.length ?? 1) - 1))]
    return n ? { x: n.x * sceneW, y: n.y * sceneH - FEET_UP * padPx } : { x: 0, y: 0 }
  }

  // ---- a timed beat ends on a timer (the walk ends itself when it gets there)
  useEffect(() => {
    if (!live || !beat || beat.kind === 'walk') return
    const t = setTimeout(next, beat.ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, play?.p, play?.k])

  // ---- where the hero is, written straight to the DOM (no render per frame)
  const place = (now: number) => {
    const el = heroRef.current
    const { tall, sceneW, padPx, box } = G.current
    if (!el || !tall) return
    const cur = cursor && cursor.world === worldIdx ? cursor.stage : -1
    const hp = live ? heroPad(cur, plan!.beats, play!.k) : cur
    let x = 0, y = 0, lift = 0, op = 1, scale = 1, z = 6
    let view: 'front' | 'back' | 'cheer' = 'front', flip = false, frameSrc = ''
    // a new beat: start its clock (and lay out the walk) the first time it is drawn
    const key = live && play ? `${play.p}:${play.k}` : ''
    if (key !== beatKey.current) {
      beatKey.current = key
      beatStart.current = now
      walkRef.current = live && beat?.kind === 'walk' ? buildWalk(beat, G.current, reduced) : null
    }
    const t = (now - beatStart.current) / 1000
    if (live && beat?.kind === 'walk' && walkRef.current) {
      const w = walkRef.current
      const st = walkState(w, t, tall, sceneW, padPx, facing.current, reduced)
      x = st.x; y = st.y; lift = st.lift; op = st.op; z = st.z
      facing.current = st.facing
      view = st.facing.view; flip = st.facing.flip
      frameSrc = st.frame
      stir(st.hold ? y : null)
      if (t >= w.T && !w.done) { w.done = true; next() }
    } else if (live && beat?.kind === 'burst') {
      // hop off the pad onto the road as it bursts
      const a = padTop(beat.pad)
      const s = tall.walk.nodeS[beat.pad] + 0.5 * padPx
      const b = pointAt(tall.walk.pts, s)
      const f = reduced ? 1 : Math.min(1, t / (beat.ms / 1000))
      x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f
      lift = reduced ? 0 : Math.sin(Math.PI * f) * 0.42 * padPx
      const h = headingAt(tall.walk.pts, s, 0.3 * sceneW)
      facing.current = facingFor(h.dx, h.dy)
      view = facing.current.view; flip = facing.current.flip
    } else if (live && beat?.kind === 'portal') {
      const end = pointAt(tall.walk.pts, tall.walk.total)
      const f = Math.min(1, t / (beat.ms / 1000))
      x = end.x; y = end.y; view = 'back'
      scale = 1 - 0.75 * f; op = 1 - f; lift = f * 0.5 * padPx
    } else if (live && beat?.kind === 'enter') {
      const a = padTop(beat.pad)
      const f = reduced ? 1 : Math.min(1, t / (beat.ms / 1000))
      x = a.x; y = a.y
      lift = (1 - bounce(f)) * box.h * 0.7
      op = reduced ? Math.min(1, t * 4) : 1
      view = 'front'
    } else if (hp >= 0) {
      const a = padTop(hp)
      x = a.x; y = a.y
      view = live && (beat?.kind === 'cheer' || beat?.kind === 'arrive') ? 'cheer' : 'front'
      if (live && beat?.kind === 'cheer' && !reduced) lift = Math.abs(Math.sin(Math.min(1, t / 0.5) * Math.PI)) * 0.16 * padPx
    } else {
      el.style.opacity = '0'
      return
    }
    const H = HERO_H * padPx
    el.style.transform = `translate(${x}px, ${y}px)`
    el.style.opacity = String(op)
    el.style.zIndex = String(z)
    el.style.setProperty('--hero-h', `${H}px`)
    el.style.setProperty('--pad', `${padPx}px`)
    el.style.setProperty('--lift', `${-lift}px`)
    el.style.setProperty('--scale', String(scale))
    el.style.setProperty('--flip', flip ? '-1' : '1')
    el.style.setProperty('--shadow', String(Math.max(0.35, 1 - lift / (padPx * 0.9))))
    el.dataset.view = frameSrc ? 'frame' : view
    const fr = el.querySelector<HTMLImageElement>('.mhero-frame')
    if (frameSrc && fr && fr.getAttribute('src') !== frameSrc) fr.src = frameSrc

    // the camera keeps the hero a little below the middle of the screen
    const fe = frame.current
    if (fe && live) {
      const want = Math.max(0, Math.min(G.current.sceneH - box.h, y - box.h * 0.58))
      const c = cam.current ?? fe.scrollTop
      const k = reduced || snap.current ? 1 : 0.085
      snap.current = false
      cam.current = Math.abs(want - c) < 0.5 ? want : c + (want - c) * k
      fe.scrollTop = cam.current
    }
  }
  const placeRef = useRef(place); placeRef.current = place
  // the clouds at a join stir and sparkle while the hero passes under them
  const stirred = useRef(-1)
  const stir = (y: number | null) => {
    const fe = frame.current, seams = G.current.tall?.seams ?? []
    let i = -1
    if (y != null) { let best = Infinity; seams.forEach((m, j) => { const d = Math.abs(m.y - y); if (d < best) { best = d; i = j } }) }
    if (i === stirred.current || !fe) return
    const banks = fe.querySelectorAll('.mw-clouds')
    banks[stirred.current]?.classList.remove('is-stirred')
    banks[i]?.classList.add('is-stirred')
    stirred.current = i
  }

  useLayoutEffect(() => { placeRef.current(performance.now()) })

  // ---- while an advance plays in the world on screen: a frame loop
  useEffect(() => {
    if (!live) { cam.current = null; stir(null); return }
    let raf = 0
    const tick = (now: number) => { placeRef.current(now); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live])

  return {
    plan: live ? plan : null,
    beatIdx: live && play ? play.k : -1,
    beat: live ? beat : null,
    heroRef,
    playing: !!play,
    showHero: !!cursor && (cursor.world === worldIdx || live),
  }
}

// ---------------------------------------------------------------- the walk timeline

type Seg =
  | { kind: 'walk'; s0: number; s1: number; t0: number; T: number }
  | { kind: 'hold'; s: number; t0: number; T: number }
  | { kind: 'hop'; s: number; to: { x: number; y: number }; t0: number; T: number }
  | { kind: 'fade'; s0: number; s1: number; t0: number; T: number } // reduced motion: out here, in there

function buildWalk(beat: Extract<Beat, { kind: 'walk' }>, geo: AdvanceGeo, reduced: boolean): { segs: Seg[]; T: number } {
  const { tall, sceneW, sceneH, padPx } = geo
  const road = tall!.walk
  const sA = road.nodeS[beat.from] + 0.5 * padPx
  const toGate = beat.to < 0
  const sB = toGate ? road.total : road.nodeS[beat.to] - 0.36 * padPx
  const n = tall!.nodes[beat.to]
  const top = n ? { x: n.x * sceneW, y: n.y * sceneH - FEET_UP * padPx } : null
  if (reduced) {
    const segs: Seg[] = [{ kind: 'fade', s0: sA, s1: toGate ? sB : sB, t0: 0, T: 0.5 }]
    return { segs, T: 0.5 }
  }
  const segs: Seg[] = []
  let t = 0
  // a join between here and there: walk into the clouds, pause there, walk out
  const ys = tall!.seams
  const sSeam = ys.length ? seamS(road.pts, sA, sB, ys) : null
  const legs: [number, number][] = sSeam == null ? [[sA, sB]] : [[sA, sSeam], [sSeam, sB]]
  legs.forEach(([a, b], i) => {
    const T = walkDuration(b - a, PACE * sceneW)
    segs.push({ kind: 'walk', s0: a, s1: b, t0: t, T }); t += T
    if (i === 0 && sSeam != null) { segs.push({ kind: 'hold', s: sSeam, t0: t, T: SEAM_HOLD }); t += SEAM_HOLD }
  })
  if (top && !toGate) { segs.push({ kind: 'hop', s: sB, to: top, t0: t, T: HOP_ON }); t += HOP_ON }
  return { segs, T: t }
}

/** arc length where the road crosses the first join between sA and sB, or null */
function seamS(pts: { x: number; y: number; s: number }[], sA: number, sB: number, seams: { y: number }[]): number | null {
  const y0 = pointAt(pts, sA).y, y1 = pointAt(pts, sB).y
  const sm = seams.find((m) => (m.y - y0) * (m.y - y1) < 0)
  if (!sm) return null
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    if (b.s < sA || a.s > sB) continue
    if ((sm.y - a.y) * (sm.y - b.y) <= 0 && a.y !== b.y) return a.s + (b.s - a.s) * (sm.y - a.y) / (b.y - a.y)
  }
  return null
}

function walkState(w: { segs: Seg[]; T: number }, t: number, tall: TallLayout, sceneW: number, padPx: number, prev: Facing, reduced: boolean) {
  const seg = w.segs.find((s) => t < s.t0 + s.T) ?? w.segs[w.segs.length - 1]
  const lt = Math.max(0, Math.min(seg.T, t - seg.t0))
  const pts = tall.walk.pts
  let s = 0, lift = 0, op = 1, x: number, y: number, frame = ''
  let facing = prev
  if (seg.kind === 'walk') {
    s = seg.s0 + (seg.s1 - seg.s0) * walkProgress(lt, seg.T)
  } else if (seg.kind === 'hold' || seg.kind === 'hop') {
    s = seg.s
  } else {
    s = lt < seg.T / 2 ? seg.s0 : seg.s1
    op = Math.abs(1 - lt / (seg.T / 2))
  }
  const p = pointAt(pts, s)
  x = p.x; y = p.y
  if (seg.kind === 'hop') {
    const f = lt / seg.T
    x = p.x + (seg.to.x - p.x) * f; y = p.y + (seg.to.y - p.y) * f
    lift = Math.sin(Math.PI * f) * 0.38 * padPx
  }
  if (seg.kind === 'walk') {
    const h = headingAt(pts, s, 0.12 * sceneW)
    facing = facingFor(h.dx, h.dy, prev)
    const step = STRIDE * sceneW
    const frames = facing.view === 'back' ? WALK_BACK : WALK_FRONT
    if (frames.length) frame = frames[Math.floor(s / (step / 2)) % frames.length]
    // PLACEHOLDER until the walk frames exist: a small hop each step
    else if (!reduced) lift = Math.abs(Math.sin(Math.PI * s / step)) * 0.11 * padPx
  }
  // under the clouds at a join the hero fades out and passes below the puffs
  const veil = reduced ? 0 : cloudVeil(y, tall.seams, sceneW)
  op *= 1 - veil
  return { x, y, lift, op, z: veil > 0.02 ? 3 : 6, facing, frame, hold: seg.kind === 'hold' }
}

const bounce = (f: number) => {
  // ease-out with one small bounce at the end
  if (f < 0.72) { const k = f / 0.72; return k * k }
  const k = (f - 0.72) / 0.28
  return 1 - 0.09 * Math.sin(Math.PI * k)
}

// ---------------------------------------------------------------- the hero element

export function MapHero({ heroRef }: { heroRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="mhero" ref={heroRef} aria-hidden data-view="front">
      <span className="mhero-shadow" />
      <span className="mhero-body">
        <img className="mhero-img mhero-front" src={heroFront} alt="" draggable={false} />
        <img className="mhero-img mhero-cheer" src={heroCheer} alt="" draggable={false} />
        <img className="mhero-img mhero-back" src={heroBack} alt="" draggable={false} />
        <img className="mhero-img mhero-frame" alt="" draggable={false} />
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- the pad breaking

/** pieces of the pad that fly off when it bursts: clip-path outlines over the pad (in %), with where they go */
const SHARDS = [
  { clip: '96% 45%, 94% 50%, 95% 56%, 89% 62%, 91% 69%, 88% 76%, 92% 84%, 98% 85%, 100% 60%', dx: 46, dy: -6, r: 70 },
  { clip: '0% 69%, 7% 71%, 11% 79%, 20% 82%, 23% 90%, 35% 100%, 0% 100%', dx: -44, dy: 4, r: -80 },
  { clip: '40% 6%, 52% 5%, 49% 18%, 42% 22%', dx: -12, dy: -46, r: -40 },
  { clip: '60% 8%, 74% 13%, 70% 24%, 61% 20%', dx: 22, dy: -42, r: 55 },
  { clip: '22% 30%, 30% 26%, 33% 38%, 24% 41%', dx: -36, dy: -30, r: -110 },
  { clip: '70% 34%, 80% 36%, 78% 47%, 69% 44%', dx: 34, dy: -26, r: 100 },
  { clip: '46% 86%, 58% 87%, 56% 97%, 47% 96%', dx: 6, dy: 26, r: 30 },
]
const DUST = [
  { x: 14, y: 78, d: -1, s: 1 }, { x: 86, y: 76, d: 1, s: 1.1 }, { x: 50, y: 92, d: 0, s: 1.2 },
  { x: 30, y: 60, d: -1, s: 0.8 }, { x: 72, y: 58, d: 1, s: 0.85 },
]

/** the layers over a pad: crack lines while it cracks, then shards and dust as it bursts */
export function PadBreak({ phase, padSrc }: { phase: 'crack' | 'burst' | null; padSrc: string }) {
  if (!phase) return null
  return (
    <span className={`pbreak is-${phase}`} aria-hidden>
      <img className="pbreak-crack" src={padCrack} alt="" draggable={false} />
      {phase === 'burst' && <>
        {SHARDS.map((s, i) => (
          <span key={i} className="pbreak-shard" style={{
            clipPath: `polygon(${s.clip})`, ['--dx' as string]: `${s.dx}cqw`, ['--dy' as string]: `${s.dy}cqw`, ['--r' as string]: `${s.r}deg`,
            animationDelay: `${(i % 3) * 25}ms`,
          }}>
            <img src={padSrc} alt="" draggable={false} />
            <img src={padCrack} alt="" draggable={false} />
          </span>
        ))}
        {DUST.map((d, i) => (
          <span key={i} className="pbreak-dust" style={{
            left: `${d.x}%`, top: `${d.y}%`, ['--d' as string]: d.d, ['--s' as string]: d.s, animationDelay: `${i * 30}ms`,
          }} />
        ))}
      </>}
    </span>
  )
}

export { padRuin }
