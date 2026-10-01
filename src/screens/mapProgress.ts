/**
 * The map's progression, as pure data: no DOM, no React, no timers. The view
 * (MapScreen + MapHero) asks this module what each pad looks like and what to
 * play next; React Native can reuse it unchanged.
 *
 *  - Pads: a finished stage is a RUINED pad, the current one is lit and holds the
 *    hero, the rest are locked. While an advance is playing, the pad being left
 *    breaks and the pad ahead stays dark until the hero gets there.
 *  - Advance: when the player's place on the road moves on (a stage was finished)
 *    the map plays: cheer -> the pad cracks -> the hero hops off as it bursts ->
 *    walks the road to the next pad (through the clouds at a join) -> the next
 *    pad lights up. At the end of a world the hero walks on into the gate and the
 *    next world opens with the hero dropping onto its first pad.
 *  - The map remembers which place it last SHOWED (a cursor) so the advance plays
 *    once, when the map is next on screen, however the stage was finished.
 */

export type StageStatus = 'locked' | 'current' | 'done'
export type PadLook = 'locked' | 'current' | 'ruined' | 'breaking'

/** where the hero is: world index and stage index inside it */
export type Cursor = { world: number; stage: number }

export const cmpCursor = (a: Cursor, b: Cursor) => a.world - b.world || a.stage - b.stage

/** the player's place from the stage statuses of every world (null before any data) */
export function cursorOf(worlds: { stages: { status: StageStatus }[] }[]): Cursor | null {
  if (!worlds.length) return null
  for (let w = 0; w < worlds.length; w++) {
    const s = worlds[w].stages.findIndex((x) => x.status === 'current')
    if (s >= 0) return { world: w, stage: s }
  }
  // everything finished: the hero stays on the last pad of the last world
  const w = worlds.length - 1
  return { world: w, stage: Math.max(0, worlds[w].stages.length - 1) }
}

// ---------------------------------------------------------------- the advance

export type Beat =
  /** a short cheer on the finished pad */
  | { kind: 'cheer'; pad: number; ms: number }
  /** the finished pad cracks (hero still on it) */
  | { kind: 'crack'; pad: number; ms: number }
  /** the pad bursts and the hero hops off onto the road */
  | { kind: 'burst'; pad: number; ms: number }
  /** walk the road from one pad to the next (or to the gate: to = -1) */
  | { kind: 'walk'; from: number; to: number }
  /** the next pad lights up under the hero */
  | { kind: 'arrive'; pad: number; ms: number }
  /** into the gate at the top of the road; the next world opens */
  | { kind: 'portal'; world: number; ms: number }
  /** the hero drops onto the first pad of a new world */
  | { kind: 'enter'; world: number; pad: number; ms: number }

export type Plan = { world: number; beats: Beat[] }

/**
 * What to play to go from the place last shown to the player's place now. Only
 * the last step is animated; pads skipped over (several stages finished while
 * the map was away) are already ruins. Reduced motion keeps the same beats with
 * short timings; the view drops the flying parts.
 */
export function planAdvance(seen: Cursor, now: Cursor, stageCounts: number[], reduced = false): Plan[] {
  if (cmpCursor(now, seen) <= 0) return []
  const t = (ms: number) => (reduced ? Math.min(ms, 260) : ms)
  if (now.world === seen.world) {
    const from = now.stage - 1
    return [{
      world: now.world, beats: [
        { kind: 'cheer', pad: from, ms: t(650) },
        { kind: 'crack', pad: from, ms: t(520) },
        { kind: 'burst', pad: from, ms: t(560) },
        { kind: 'walk', from, to: now.stage },
        { kind: 'arrive', pad: now.stage, ms: t(700) },
      ],
    }]
  }
  // a world was finished: break its last pad, walk into its gate, open the next world
  const last = Math.max(0, (stageCounts[seen.world] ?? 1) - 1)
  const fromPad = seen.world === now.world - 1 ? Math.min(seen.stage, last) : last
  return [
    {
      world: now.world - 1, beats: [
        { kind: 'cheer', pad: fromPad, ms: t(650) },
        { kind: 'crack', pad: fromPad, ms: t(520) },
        { kind: 'burst', pad: fromPad, ms: t(560) },
        { kind: 'walk', from: fromPad, to: -1 },
        { kind: 'portal', world: now.world - 1, ms: t(900) },
      ],
    },
    {
      world: now.world, beats: [
        { kind: 'enter', world: now.world, pad: now.stage, ms: t(900) },
        { kind: 'arrive', pad: now.stage, ms: t(700) },
      ],
    },
  ]
}

/**
 * How a pad looks: its stage status, overridden while an advance plays. The pad
 * being left stays lit through the cheer, breaks during crack + burst and is a
 * ruin after; the pad ahead (already 'current' in the data) stays dark until the
 * hero arrives on it. beats/k: the plan playing in this world and the beat now.
 */
export function padLook(i: number, status: StageStatus, beats: Beat[] | null, k: number): PadLook {
  if (beats && k >= 0 && k < beats.length) {
    const beat = beats[k]
    const leave = beats.find((b) => b.kind === 'cheer') as { pad: number } | undefined
    if (leave && i === leave.pad) {
      if (beat.kind === 'cheer') return 'current'
      if (beat.kind === 'crack' || beat.kind === 'burst') return 'breaking'
      return 'ruined'
    }
    const ai = beats.findIndex((b) => b.kind === 'arrive')
    const arrive = beats[ai] as { pad: number } | undefined
    if (arrive && i === arrive.pad) return k < ai ? 'locked' : 'current'
  }
  return status === 'done' ? 'ruined' : status === 'current' ? 'current' : 'locked'
}

/** where the hero stands while not walking: the pad it is on during a plan, else the current pad */
export function heroPad(curStage: number, beats: Beat[] | null, k: number): number {
  if (!beats || k < 0 || k >= beats.length) return curStage
  const b = beats[k]
  if (b.kind === 'cheer' || b.kind === 'crack' || b.kind === 'burst') return b.pad
  if (b.kind === 'arrive' || b.kind === 'enter') return b.pad
  return -1 // walking or in the gate: placed by the walk
}

// ---------------------------------------------------------------- the road

/** the whole road in walking order, cloud stretches included (scene px) */
export type RoadPt = { x: number; y: number; s: number }
export type Road = { pts: RoadPt[]; total: number; nodeS: number[] }

/** cumulative arc length over a polyline */
export function measure(pts: { x: number; y: number }[]): RoadPt[] {
  let s = 0
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
    return { x: p.x, y: p.y, s }
  })
}

/** where a point sits along the road (projected onto the nearest segment) */
export function projectS(road: RoadPt[], x: number, y: number): number {
  let best = Infinity, bestS = 0
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1], b = road[i]
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy
    const f = L ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L)) : 0
    const px = a.x + dx * f, py = a.y + dy * f
    const d = (px - x) ** 2 + (py - y) ** 2
    if (d < best) { best = d; bestS = a.s + (b.s - a.s) * f }
  }
  return bestS
}

/** position and heading at arc length s */
export function pointAt(road: RoadPt[], s: number): { x: number; y: number; dx: number; dy: number } {
  if (!road.length) return { x: 0, y: 0, dx: 0, dy: -1 }
  if (s <= road[0].s) {
    const b = road[1] ?? road[0]
    return { x: road[0].x, y: road[0].y, ...unit(b.x - road[0].x, b.y - road[0].y) }
  }
  let lo = 0, hi = road.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (road[m].s < s) lo = m; else hi = m }
  const a = road[lo], b = road[hi]
  const f = b.s > a.s ? Math.min(1, (s - a.s) / (b.s - a.s)) : 1
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ...unit(b.x - a.x, b.y - a.y) }
}
const unit = (dx: number, dy: number) => { const L = Math.hypot(dx, dy) || 1; return { dx: dx / L, dy: dy / L } }

/** the heading smoothed over a stretch of road ahead, so a kinked trace doesn't flick the sprite */
export function headingAt(road: RoadPt[], s: number, look: number) {
  const a = pointAt(road, s), b = pointAt(road, s + look)
  const dx = b.x - a.x, dy = b.y - a.y
  return Math.hypot(dx, dy) > 0.5 ? unit(dx, dy) : { dx: a.dx, dy: a.dy }
}

/**
 * Which sprite faces the way the hero walks. The camera looks up the road, so
 * walking up the screen shows the hero's back; walking down shows the front.
 * flip mirrors the sprite to lean left/right. A dead band keeps it from flicking.
 */
export type Facing = { view: 'back' | 'front'; flip: boolean }
export function facingFor(dx: number, dy: number, prev?: Facing): Facing {
  const view = dy < -0.18 ? 'back' : dy > 0.18 ? 'front' : prev?.view ?? 'back'
  const flip = dx < -0.15 ? true : dx > 0.15 ? false : prev?.flip ?? false
  return { view, flip }
}

/** walking timing: an ease in and out of a steady pace (scene px per second) */
export function walkDuration(dist: number, pace: number) {
  return Math.max(0.9, dist / pace + 0.35)
}
/** distance walked at time t of a walk lasting T (ease in for 0.3s, ease out for 0.3s) */
export function walkProgress(t: number, T: number) {
  const e = Math.min(0.3, T / 3)
  const v = 1 / (T - e) // peak speed in fractions per second with linear ramps
  if (t <= 0) return 0
  if (t >= T) return 1
  if (t < e) return (v * t * t) / (2 * e)
  if (t > T - e) { const r = T - t; return 1 - (v * r * r) / (2 * e) }
  return (v * e) / 2 + v * (t - e)
}

/**
 * The clouds over a join: 1 where the hero is fully hidden in the puffs, 0 in the
 * clear, eased between (y and seams in scene px, w = scene width).
 */
export function cloudVeil(y: number, seams: { y: number }[], w: number) {
  let v = 0
  for (const sm of seams) {
    const d = Math.abs(y - sm.y) / w
    const k = d < 0.04 ? 1 : d > 0.13 ? 0 : 1 - (d - 0.04) / 0.09
    v = Math.max(v, k * k * (3 - 2 * k))
  }
  return v
}
/** the join being crossed on a walk between two arc lengths (index into seams), or -1 */
export function seamCrossed(road: RoadPt[], s0: number, s1: number, seams: { y: number }[]) {
  const y0 = pointAt(road, s0).y, y1 = pointAt(road, s1).y
  return seams.findIndex((sm) => (sm.y - y0) * (sm.y - y1) < 0)
}

// ---------------------------------------------------------------- memory

/** the last place the map showed, so an advance plays once. The view passes its storage in. */
export type KV = { get(k: string): string | null; set(k: string, v: string): void }
const KEY = 'runecast.map.seen.v1'
export function loadSeen(kv: KV): Cursor | null {
  try {
    const v = JSON.parse(kv.get(KEY) || 'null')
    return v && typeof v.world === 'number' && typeof v.stage === 'number' ? v : null
  } catch { return null }
}
export function saveSeen(kv: KV, c: Cursor) {
  try { kv.set(KEY, JSON.stringify(c)) } catch { /* ignore */ }
}
