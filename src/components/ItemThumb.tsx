import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { art, type ArtName } from './PageArt'

// Wardrobe thumbnails live with the 3D wardrobe: /runecast-wardrobe/thumbs/item_<item id>.png.
// Recoloured items (catalogue base_mesh set, e.g. coat_amethyst <- coat_frost) have no thumbnail of their
// own, so they show their base mesh's; anything else falls back to a painted icon.
// Phase B: hairs use the wardrobe's hair_<index> pictures; eye and hair colours are drawn as swatches
const HAIR_IDX: Record<string, number> = { hair_short: 0, hair_girllong: 1, hair_twobuns: 5, hair_wildspike: 11, hair_bobcut: 12, hair_ponybow: 13, hair_twinstar: 14, hair_curlyfro: 15, hair_spikefade: 16 }
const IRIS: Record<string, string> = { violet: '#8a4fd8', blue: '#2f6fe0', aqua: '#1fc3c9', green: '#2fa84f', hazel: '#8a7a34', amber: '#e0a020', brown: '#7a4520', grey: '#8c97a6', ruby: '#c0243a', pink: '#f06aa8' }
const HAIRC: Record<string, string> = { natural: '#6b4a2e', black: '#2a2226', darkbrown: '#4a2e1f', chestnut: '#7a4526', auburn: '#9a3d22', ginger: '#c56a33', blonde: '#dcbd7c', platinum: '#efe6d6', pink: '#f59ac0', lilac: '#b48be8', blue: '#4f7fe0', mint: '#6fd8b8' }
const svg = (body: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)
const swatch = (id: string): string | null => {
  if (id.startsWith('eyes_') && IRIS[id.slice(5)]) return svg(`<circle cx="32" cy="32" r="26" fill="#fff"/><circle cx="32" cy="32" r="22" fill="${IRIS[id.slice(5)]}"/><circle cx="32" cy="32" r="9" fill="#1d1530"/><circle cx="25" cy="24" r="5" fill="#fff" opacity=".9"/>`)
  if (id.startsWith('haircolor_') && HAIRC[id.slice(10)]) return svg(`<circle cx="32" cy="32" r="26" fill="#fff"/><circle cx="32" cy="32" r="22" fill="${HAIRC[id.slice(10)]}"/><path d="M18 26c6-8 22-10 30-2" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".45"/>`)
  return null
}
const thumb = (id: string) => swatch(id) ?? (id in HAIR_IDX ? `/runecast-wardrobe/thumbs/hair_${HAIR_IDX[id]}.png` : `/runecast-wardrobe/thumbs/item_${id}.png`)
let baseOf: Promise<Record<string, string | null>> | null = null
const bases = () => (baseOf ??= api.catalog().then((c) => Object.fromEntries(c.map((x) => [x.id, x.base_mesh ?? null]))).catch(() => ({} as Record<string, string | null>)))

export function ItemThumb({ id, fallback = 'qi_star', className }: { id: string; fallback?: ArtName; className?: string }) {
  const [src, setSrc] = useState(thumb(id))
  const [step, setStep] = useState(0)
  useEffect(() => { setSrc(thumb(id)); setStep(0) }, [id])
  const onError = async () => {
    if (step === 0) {
      setStep(1)
      const b = (await bases())[id]
      if (b && b !== id) { setSrc(thumb(b)); return }
    }
    setStep(2); setSrc(art(fallback))
  }
  return <img className={className} src={src} alt="" draggable={false} onError={step < 2 ? onError : undefined} />
}
