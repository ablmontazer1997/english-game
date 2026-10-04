import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { art, type ArtName } from './PageArt'

// Wardrobe thumbnails live with the 3D wardrobe: /runecast-wardrobe/thumbs/item_<item id>.png.
// Recoloured items (catalogue base_mesh set, e.g. coat_amethyst <- coat_frost) have no thumbnail of their
// own, so they show their base mesh's; anything else falls back to a painted icon.
const thumb = (id: string) => `/runecast-wardrobe/thumbs/item_${id}.png`
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
