import type { LifeData, Fx, Extra } from '../components/MapLife'
import type { MapNode } from './mapLayout'
import type { Tall, TallPanel } from './tallMap'
const CLOUDS = Object.values(import.meta.glob('../assets/tall/cloud*.webp', { eager: true, import: 'default' }) as Record<string, string>)
import W1_MAP from '../data/map.json'
import W1_LIFE from '../assets/sky/life/life.json'
import w1Bg from '../assets/sky/map_w1.webp'

/**
 * Every world has its own painted scene (not a colour grade of the first one).
 *
 * World 1 is the original map with its hand-cut life (swaying trees, flowing
 * waterfalls, drifting clouds, the Final Gate swirl). The others live in
 * assets/worlds/<id>/: map.webp (same composition, new biome, painted by
 * runecast_fix/worlds/gen_world.py), map.json (the stone path traced by
 * measure_world.py: disc spots + path width) and life.json + gate.png (the
 * gate swirl cut by cut_world.py). On top, each world gets a light weather
 * layer (fx). The scene cycles with the world index, so finishing a path
 * always opens a new place.
 */
export type MapMeta = { w: number; h: number; aspect: number; padW: number; nodes: MapNode[] }
export type Scene = { id: string; bg: string; map: MapMeta; life: LifeData; src: Record<string, string>; fx?: Fx; extras?: Extra[]; tall?: Tall }

const base = (p: string) => p.split('/').pop()!.replace(/\.\w+$/, '')
const dir = (p: string) => p.split('/').slice(-2)[0]
const byName = (g: Record<string, string>) => Object.fromEntries(Object.entries(g).map(([p, u]) => [base(p), u]))


const MAPS = import.meta.glob('../assets/worlds/*/map.json', { eager: true, import: 'default' }) as Record<string, MapMeta>
const LIVES = import.meta.glob('../assets/worlds/*/life.json', { eager: true, import: 'default' }) as Record<string, LifeData>
const BGS = import.meta.glob('../assets/worlds/*/map.webp', { eager: true, import: 'default' }) as Record<string, string>
const PNGS = import.meta.glob('../assets/worlds/*/*.png', { eager: true, import: 'default' }) as Record<string, string>
const pick = <T,>(g: Record<string, T>, id: string) => Object.entries(g).find(([p]) => dir(p) === id)?.[1]

// play order after the first world, with each world's weather and set pieces
const ORDER: [string, Fx, Extra[]][] = [
  ['crystal', 'sparkles', ['rays']], ['library', 'pages', ['books']], ['alchemy', 'motes', ['birds']], ['fairy', 'fireflies', ['butterflies']],
  ['moon', 'stars', ['moon', 'shooting']], ['frost', 'snow', ['aurora']], ['dragon', 'embers', ['heat']], ['ruins', 'petals', ['runes', 'birds']],
  ['academy', 'sparkles', ['brooms', 'birds']], ['stars', 'stars', ['shooting', 'aurora']],
]
// World 1 in the soft clay style (09-27, admin-approved look): assets/worlds/w1soft, same path and gate as the
// original map; the hand-cut original (sky/map_w1 + sky/life) stays in the repo as the fallback
const W1_OLD: Scene = {
  id: 'forest', bg: w1Bg, map: W1_MAP as MapMeta, life: W1_LIFE as unknown as LifeData,
  src: byName(import.meta.glob('../assets/sky/life/*.png', { eager: true, import: 'default' }) as Record<string, string>),
}
const softMap = pick(MAPS, 'w1soft'), softBg = pick(BGS, 'w1soft')
const W1: Scene = softMap && softBg ? {
  id: 'forest', bg: softBg, map: softMap, life: pick(LIVES, 'w1soft') ?? ({ _map: { w: softMap.w, h: softMap.h } } as LifeData),
  src: byName(Object.fromEntries(Object.entries(PNGS).filter(([p]) => dir(p) === 'w1soft'))),
} : W1_OLD

// tall scrolling worlds (tallMap.ts): assets/tall/<scene dir>/ holds upper.webp (the scene's own painting, its
// flared foreground cut off), lower.webp, lower2.webp, ... (the next stretches of road, painted to a constant-width road sketch) and
// the road traced on each (upper.json, lower.json, ...; upper.json.life = scene height / cut height)
type Road = { w: number; h: number; pts: number[][]; life?: number }
const TALL_JSON = import.meta.glob('../assets/tall/*/*.json', { eager: true, import: 'default' }) as Record<string, Road>
const TALL_BG = import.meta.glob('../assets/tall/*/*.webp', { eager: true, import: 'default' }) as Record<string, string>
// each lower panel's own life (runecast/fix/tallmap/life/tools/cut_panel.py): assets/tall/<scene dir>/life/<panel>.json
// + <panel>_<region>.png, laid out on that panel alone (falls, swaying trees, pools, crystal glints, lamps)
const PANEL_LIFE = import.meta.glob('../assets/tall/*/life/*.json', { eager: true, import: 'default' }) as Record<string, LifeData>
const PANEL_PNG = import.meta.glob('../assets/tall/*/life/*.png', { eager: true, import: 'default' }) as Record<string, string>
const world3 = (p: string) => p.split('/').slice(-3)[0]
const panelLife = (id: string, panel: string) => {
  const life = Object.entries(PANEL_LIFE).find(([p]) => world3(p) === id && base(p) === panel)?.[1]
  if (!life) return {}
  const src = Object.fromEntries(Object.entries(PANEL_PNG).filter(([p]) => world3(p) === id && base(p).startsWith(panel + '_'))
    .map(([p, u]) => [base(p).slice(panel.length + 1), u]))
  return { anim: { life, src } }
}
const tallFor = (id: string): Tall | undefined => {
  const at = (g: Record<string, unknown>, f: string) => Object.entries(g).find(([p]) => dir(p) === id && base(p) === f)?.[1]
  // upper, then lower, lower2, ... down the road
  const names = ['upper', 'lower', ...[2, 3, 4, 5].map((n) => `lower${n}`)]
  const panels = names.map((n) => {
    const road = at(TALL_JSON, n) as Road | undefined, bg = at(TALL_BG, n) as string | undefined
    return road && bg ? { ...road, bg, ...(n === 'upper' ? {} : panelLife(id, n)) } : null
  })
  const n = panels.indexOf(null)
  const have = (n < 0 ? panels : panels.slice(0, n)) as (TallPanel & { life?: number })[]
  return have.length > 1 ? { clouds: CLOUDS, life: have[0].life, panels: have } : undefined
}

export const SCENES: Scene[] = [{ ...W1, extras: ['birds'], tall: softBg ? tallFor('w1soft') : undefined }, ...ORDER.flatMap(([id, fx, extras]) => {
  const map = pick(MAPS, id), bg = pick(BGS, id)
  if (!map || !bg) return []
  const life = pick(LIVES, id) ?? ({ _map: { w: map.w, h: map.h } } as LifeData)
  const src = byName(Object.fromEntries(Object.entries(PNGS).filter(([p]) => dir(p) === id)))
  return [{ id, bg, map, life, src, fx, extras, tall: tallFor(id) }]
})]
export const sceneFor = (worldIdx: number) => SCENES[((worldIdx % SCENES.length) + SCENES.length) % SCENES.length]
