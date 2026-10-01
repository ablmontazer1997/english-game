import type { MapNode } from './mapLayout'
import { measure, projectS, type Road } from './mapProgress'

/**
 * A tall, scrolling world: more than one painted panel stacked top to bottom,
 * with a band of clouds hiding each join (the worlds are sky islands, so the
 * road simply dips into the clouds and comes out further on).
 *
 * Each panel carries its road traced by runecast_fix/tallmap/trace_panel.py as
 * a polyline, bottom to top, [x, y, width] as fractions of that panel. The
 * stages are not painted anywhere: they are spread evenly by distance along
 * the whole road, so a world can hold 10 stages or 18 on the same art.
 */
export type TallPanel = { bg: string; w: number; h: number; pts: number[][] }
/** panels top to bottom; the first is the scene's own painting with the gate, its bottom
 *  cut off where the road flares towards the camera. band: the clouds over each join.
 *  life: the full scene's height over the first panel's, so the scene's hand-cut life
 *  (swaying trees, falls, gate swirl) is laid out on the uncut painting and clipped */
export type Tall = { panels: TallPanel[]; clouds?: string[]; life?: number }

// keep stages off the joins, where the cloud puffs sit (in screen widths above and below
// a join), and clear of the nav bar
const CLEAR_ABOVE = 0.26
const CLEAR_BELOW = 0.22
const FOOT = 0.55         // the first stage sits this many screen widths above the bottom, clear of the chest widget and nav

// a lower panel slides this far (in screen widths) up under the one above and fades in over it
const OVERLAP = 0.1

export type TallLayout = {
  h: number
  panels: { top: number; h: number; bg: string }[]
  /** each join: its height and where the road crosses it, in scene px */
  seams: { y: number; x: number }[]
  overlap: number
  nodes: MapNode[]
  /** the road's typical width in px (a node's scale is relative to it) */
  road: number
  /** the whole road in walking order, the stretches under the clouds included, with each
   *  stage's place along it: what the hero walks (scene px) */
  walk: Road
}

export function layoutTall(tall: Tall, w: number, count: number): TallLayout {
  const ov = OVERLAP * w
  let top = 0
  const panels = tall.panels.map((p, i) => {
    const h = w * p.h / p.w
    if (i) top -= ov
    const out = { top, h, bg: p.bg }
    top += h
    return out
  })
  const H = top
  // the join is the middle of the overlap; the road crosses it between the upper road's
  // last point and the lower road's first
  const seams = panels.slice(1).map((p, i) => {
    const a = tall.panels[i].pts, b = tall.panels[i + 1].pts
    const x = ((a[0]?.[0] ?? 0.5) + (b[b.length - 1]?.[0] ?? 0.5)) / 2 * w
    return { y: p.top + ov / 2, x }
  })

  // the road in walking order: bottom panel first, each bottom to top, in scene px
  const legs: { x: number; y: number; r: number }[][] = []
  for (let k = tall.panels.length - 1; k >= 0; k--) {
    const P = tall.panels[k], box = panels[k]
    const last = k === tall.panels.length - 1
    const leg = P.pts
      .map(([x, y, r]) => ({ x: x * w, y: box.top + y * box.h, r: r * w }))
      .filter((p) => (!last || p.y <= H - FOOT * w) &&
        seams.every((sm) => p.y < sm.y - CLEAR_ABOVE * w || p.y > sm.y + CLEAR_BELOW * w))
    if (leg.length > 1) legs.push(leg)
  }

  // arc length inside each leg; the hop between legs (under the clouds) is not road
  const at: { x: number; y: number; r: number; s: number }[] = []
  let s = 0
  legs.forEach((leg) => leg.forEach((p, i) => {
    if (i) s += Math.hypot(p.x - leg[i - 1].x, p.y - leg[i - 1].y)
    at.push({ ...p, s })
  }))
  const total = s
  // every pad is one size: the typical road width of the scene's own painting
  const orig = at.filter((p) => p.y <= panels[0].h)
  const rs = (orig.length ? orig : at).map((p) => p.r).sort((a, b) => a - b)
  const wide = rs[rs.length >> 1] || w * 0.2

  const nodes: MapNode[] = []
  for (let i = 0; i < count; i++) {
    const want = count > 1 ? total * i / (count - 1) : 0
    let j = at.findIndex((p) => p.s >= want)
    if (j < 0) j = at.length - 1
    const b = at[j], a = at[Math.max(0, j - 1)]
    // interpolate only inside a leg (a and b on the same side of a join)
    const f = b.s > a.s && Math.abs(b.y - a.y) < H * 0.05 ? (want - a.s) / (b.s - a.s) : 1
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f
    nodes.push({ x: x / w, y: y / H, scale: 1 })
  }
  // the walk: every traced point, bottom panel first, nothing skipped (the hero goes on under
  // the clouds); stages keep the places worked out above
  const full = measure(tall.panels.map((P, k) => P.pts.map(([x, y]) => ({ x: x * w, y: panels[k].top + y * panels[k].h })))
    .reverse().flat())
  const nodeS = nodes.map((n) => projectS(full, n.x * w, n.y * H))
  const walk = { pts: full, total: full.length ? full[full.length - 1].s : 0, nodeS }
  return { h: H, panels, seams, overlap: ov, nodes, road: wide, walk }
}
