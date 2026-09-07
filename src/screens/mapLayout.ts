import MAP from '../data/map.json'

/**
 * The map is one finished painting, exactly as in the reference, and every
 * stage sits at a fixed spot on it. Nothing here is procedural any more.
 *
 * The only thing not painted into the scene is the row of level discs: their
 * number, stars and lock change at runtime, so they cannot be baked in.
 * pipeline/sky/measure_map.py traces the stone path in the artwork and records
 * where each disc goes and how wide the path is there, so a disc high up the
 * map is drawn smaller and still lands on the tiles.
 */

export type MapNode = { x: number; y: number; scale: number }
type MapMeta = { w: number; h: number; aspect: number; padW: number; nodes: MapNode[] }

const M = MAP as MapMeta
export const MAP_ASPECT = M.aspect
/** the stone path's typical width, as a fraction of the scene's width */
export const MAP_PAD_W = M.padW
export const MAP_NODES = M.nodes

export interface WorldTheme {
  /** each world reuses the scene under its own colour grade until it has art of its own */
  filter?: string
}
export const THEMES: WorldTheme[] = [
  {},
  { filter: 'hue-rotate(-22deg) saturate(1.06)' },
  { filter: 'hue-rotate(148deg) saturate(.88) brightness(.97)' },
]
export const themeFor = (worldIdx: number) => THEMES[worldIdx % THEMES.length]
