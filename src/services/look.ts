// Phase B (UX audit 10-11): the 3D look lives on the account. The wardrobe (/runecast-wardrobe/) and the hero pages
// (/runecast-hero/) still read the look from localStorage by INDEX (girl, hairPick, hairColor, irisColor, skinTone2,
// hatOn, hatPick, outfit, tint, blush) plus rcVariant / rcTintFx for recolour treasures. This module converts between
// those keys and the server's look (catalogue ids). The tables mirror the wardrobe page (index.html HAIRS, HATS,
// HAIR_COLORS, IRIS_COLORS, OUTFIT); keep them in step when the wardrobe gets new items.
import { api, type Look, type WardrobeItem } from './api'

const HAIRS = ['hair_short', 'hair_girllong', 'hair_pony', 'hair_twin', 'hair_bob', 'hair_twobuns', 'hair_curly', 'hair_spiky',
  'hair_quiff', 'hair_braid', 'hair_spikecrop', 'hair_wildspike', 'hair_bobcut', 'hair_ponybow', 'hair_twinstar', 'hair_curlyfro', 'hair_spikefade']
const HAIR_RETIRED: Record<number, number> = { 2: 13, 3: 14, 4: 12, 6: 15, 7: 11, 8: 16, 9: 1, 10: 16 }
const HAIR_COLORS = ['natural', 'black', 'darkbrown', 'chestnut', 'auburn', 'ginger', 'blonde', 'platinum', 'pink', 'lilac', 'blue', 'mint']
const IRIS = ['violet', 'blue', 'aqua', 'green', 'hazel', 'amber', 'brown', 'grey', 'ruby', 'pink']
const HATS = ['hat', 'hat_midnight', 'hat_apprentice', 'hat_witch', 'hat_mushroom', 'hat_scholar', 'hat_fire', 'hat_frost', 'hat_owl', 'hat_astronomer', 'hat_dragon']
const OUTFIT: Record<'top' | 'coat' | 'pants' | 'shoes', { row: string; ids: (string | null)[] }> = {
  top: { row: 'Top', ids: [null, 'top_apprentice', 'top_alchemist', 'top_crystal', 'top_fire', 'top_forest', 'top_frost', 'top_rune', 'top_scholar', 'top_star'] },
  coat: { row: 'Outer', ids: [null, 'coat', 'coat_fire', 'coat_forest', 'coat_frost', 'coat_midnight', 'coat_royal', 'coat_sea', 'coat_sun'] },
  pants: { row: 'Legs', ids: [null, 'pants', 'pants_alch', 'pants_fire', 'pants_forest', 'pants_frost', 'pants_royal', 'pants_rune', 'pants_shadow', 'pants_star', 'pants_sun'] },
  shoes: { row: 'Feet', ids: [null, 'shoes', 'shoes_alch', 'shoes_crystal', 'shoes_curl', 'shoes_fire', 'shoes_forest', 'shoes_frost', 'shoes_royal', 'shoes_star', 'shoes_wing'] },
}
type Garment = keyof typeof OUTFIT
const GARMENTS = Object.keys(OUTFIT) as Garment[]
type Variant = { id: string; base: string; swatch: string }

const ls = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string | number) { try { localStorage.setItem(k, String(v)) } catch { /* private mode */ } },
}
const json = <T,>(k: string, d: T): T => { try { const v = JSON.parse(ls.get(k) || 'null'); return v && typeof v === 'object' ? v : d } catch { return d } }
const num = (k: string, d: number) => { const v = ls.get(k); const n = v === null ? NaN : +v; return Number.isFinite(n) ? n : d }

/** the look the browser has now (what the wardrobe last showed), as catalogue ids */
export function lsToLook(): Look {
  let hi = num('hairPick', 0); if (hi in HAIR_RETIRED) hi = HAIR_RETIRED[hi]
  const outfit = json<Record<string, number>>('outfit', {})
  const vars = json<Record<string, Variant>>('rcVariant', {})
  const look: Look = {
    body: ls.get('girl') === '1' ? 'girl' : 'boy', tone: Math.min(9, Math.max(0, num('skinTone2', 1))), blush: Math.round(num('blush', 80)),
    hair: HAIRS[hi] ?? 'hair_short', haircolor: 'haircolor_' + (HAIR_COLORS[num('hairColor', 0)] ?? 'natural'),
    eyes: 'eyes_' + (IRIS[num('irisColor', 0)] ?? 'violet'),
    hat: ls.get('hatOn') === '0' ? null : (HATS[num('hatPick', 0)] ?? 'hat'),
    top: null, coat: null, pants: null, shoes: null, tint: json<Record<string, string>>('tint', {}),
  }
  for (const g of GARMENTS) {
    const i = outfit[OUTFIT[g].row]
    look[g] = vars[g]?.id ?? (OUTFIT[g].ids[i == null ? 1 : i] ?? OUTFIT[g].ids[1])
  }
  return look
}

/** write a server look into the browser keys the wardrobe and hero pages read; true when something changed */
export function lookToLs(look: Look, catalogue?: Record<string, WardrobeItem>): boolean {
  const before = snapshot()
  ls.set('girl', look.body === 'girl' ? 1 : 0)
  ls.set('skinTone2', look.tone)
  ls.set('blush', look.blush)
  const hi = HAIRS.findIndex((h, i) => h === look.hair && !(i in HAIR_RETIRED))
  ls.set('hairPick', Math.max(0, hi))
  ls.set('hairColor', Math.max(0, HAIR_COLORS.indexOf(look.haircolor.replace('haircolor_', ''))))
  ls.set('irisColor', Math.max(0, IRIS.indexOf(look.eyes.replace('eyes_', ''))))
  if (look.hat) { ls.set('hatOn', 1); ls.set('hatPick', Math.max(0, HATS.indexOf(look.hat))) } else ls.set('hatOn', 0)
  const outfit = json<Record<string, number>>('outfit', {})
  const vars: Record<string, Variant> = {}, fx: Record<string, string> = {}
  for (const g of GARMENTS) {
    const id = look[g]
    const rc = id ? catalogue?.[id]?.recolour ?? RECOLOUR[id] : undefined
    if (id && rc) {
      vars[g] = { id, base: rc.base, swatch: rc.swatch }; fx[rc.base] = rc.swatch
      outfit[OUTFIT[g].row] = Math.max(0, OUTFIT[g].ids.indexOf(rc.base))
    } else outfit[OUTFIT[g].row] = Math.max(0, OUTFIT[g].ids.indexOf(id))
  }
  ls.set('outfit', JSON.stringify(outfit))
  ls.set('rcVariant', JSON.stringify(vars)); ls.set('rcTintFx', JSON.stringify(fx))
  ls.set('tint', JSON.stringify(look.tint || {}))
  return snapshot() !== before
}
const KEYS = ['girl', 'skinTone2', 'blush', 'hairPick', 'hairColor', 'irisColor', 'hatOn', 'hatPick', 'outfit', 'rcVariant', 'tint']
const snapshot = () => KEYS.map((k) => ls.get(k)).join('|')

// recolour treasures (catalogue base_mesh + dye), used when the catalogue is not at hand
const RECOLOUR: Record<string, { base: string; swatch: string }> = {
  shoes_librarian: { base: 'shoes', swatch: 'ochre' }, shoes_runestone: { base: 'shoes_crystal', swatch: 'teal' },
  pants_geode: { base: 'pants_frost', swatch: 'violet' }, pants_page: { base: 'pants', swatch: 'cream' },
  pants_petal: { base: 'pants_forest', swatch: 'rose' }, shoes_moon: { base: 'shoes_star', swatch: 'cream' },
  top_ink: { base: 'top_scholar', swatch: 'midnight' }, top_fairy: { base: 'top_forest', swatch: 'rose' },
  top_moon: { base: 'top_star', swatch: 'royal' }, coat_amethyst: { base: 'coat_frost', swatch: 'violet' },
  coat_scholar: { base: 'coat', swatch: 'midnight' }, coat_blossom: { base: 'coat_forest', swatch: 'rose' },
  coat_runestone: { base: 'coat_forest', swatch: 'charcoal' }, coat_autumn: { base: 'coat_forest', swatch: 'ochre' },
}

/** tell the app the look changed (portrait retake, 3D viewers reload) */
export const lookChanged = () => dispatchEvent(new Event('rc-look'))

/** app start (http mode): load the account's look into the browser; the first time, upload the browser's look
 *  (accounts from before Phase B keep everything they wear: the server grants it once) */
export async function syncLook(): Promise<void> {
  const wd = await api.wardrobe()
  const cat = Object.fromEntries(wd.items.map((i) => [i.id, i]))
  let look = wd.look
  if (!wd.look_saved) look = (await api.saveLook(lsToLook(), true)).look
  if (look && lookToLs(look, cat)) lookChanged()
}

/** wear one owned item (shop "Wear", My Items, a boss treasure's "Wear now") */
export async function wearItem(slot: string, itemId: string | null): Promise<Look | undefined> {
  const inv = await api.equip(slot, itemId)
  if (inv.look && lookToLs(inv.look)) lookChanged()
  return inv.look
}
