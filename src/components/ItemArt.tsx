import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { ItemThumb } from './ItemThumb'
import type { ArtName } from './PageArt'
import dyeBlue from '../assets/es2/shop/dye_blue.webp'
import dyePink from '../assets/es2/shop/dye_pink.webp'

// ES redesign 10-11, admin 4899: garments on the redesigned cards show the ORIGINAL source picture each 3D garment was
// made from (cut out, src/assets/es2/garments/<item id>.webp). A recolour uses its base garment's picture; an item with
// no source picture falls back to its 3D render thumbnail (ItemThumb). Hair colours are dye bottles (the concept's art),
// tinted to the swatch for the colours that have no bottle of their own.
const SRC = import.meta.glob('../assets/es2/garments/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const GARMENT: Record<string, string> = Object.fromEntries(Object.entries(SRC).map(([p, u]) => [p.split('/').pop()!.replace('.webp', ''), u]))
const HAIRC: Record<string, string> = { natural: '#6b4a2e', black: '#2a2226', darkbrown: '#4a2e1f', chestnut: '#7a4526', auburn: '#9a3d22', ginger: '#c56a33', blonde: '#dcbd7c', platinum: '#efe6d6', pink: '#f59ac0', lilac: '#b48be8', blue: '#4f7fe0', mint: '#6fd8b8' }

let baseOf: Promise<Record<string, string | null>> | null = null
const bases = () => (baseOf ??= api.catalog().then((c) => Object.fromEntries(c.map((x) => [x.id, x.base_mesh ?? null]))).catch(() => ({} as Record<string, string | null>)))

/** hue of a hex colour in degrees */
function hue(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (!d) return 0
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

export function ItemArt({ id, className, fallback = 'qi_star' }: { id: string; className?: string; fallback?: ArtName }) {
  const [src, setSrc] = useState<string | null>(GARMENT[id] ?? null)
  useEffect(() => {
    if (GARMENT[id]) { setSrc(GARMENT[id]); return }
    setSrc(null)
    let alive = true
    bases().then((b) => { const k = b[id]; if (alive && k && GARMENT[k]) setSrc(GARMENT[k]) })
    return () => { alive = false }
  }, [id])
  if (id.startsWith('haircolor_')) {
    const c = id.slice(10)
    if (c === 'pink') return <img className={className} src={dyePink} alt="" draggable={false} />
    if (c === 'blue') return <img className={className} src={dyeBlue} alt="" draggable={false} />
    const hex = HAIRC[c] ?? '#4f7fe0'
    // the blue bottle turned to the swatch's hue; pale and dark colours also get their lightness
    const n = parseInt(hex.slice(1), 16), l = (Math.max(n >> 16, (n >> 8) & 255, n & 255) + Math.min(n >> 16, (n >> 8) & 255, n & 255)) / 510
    const sat = Math.max(Math.max(n >> 16, (n >> 8) & 255, n & 255) - Math.min(n >> 16, (n >> 8) & 255, n & 255), 1) / 255
    return <img className={className} src={dyeBlue} alt="" draggable={false}
      style={{ filter: `hue-rotate(${Math.round(hue(hex) - 225)}deg) saturate(${Math.max(.15, sat * 1.6).toFixed(2)}) brightness(${(.55 + l * .9).toFixed(2)})` }} />
  }
  if (src) return <img className={className} src={src} alt="" draggable={false} />
  return <ItemThumb className={className} id={id} fallback={fallback} />
}
