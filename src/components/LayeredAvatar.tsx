import { useEffect, useRef } from 'react'
import { SLOTS, type AvatarConfig } from '../types/character'
import { WARDROBE } from '../data/wardrobe'
import './avatar.css'

// Recolors a layer while keeping the hand-painted shading: canvas 'color' blend
// applies the tint's hue+saturation but keeps the source luminance, then clips
// back to the original alpha.
function TintedLayer({ url, tint, z }: { url: string; tint: string; z: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const img = new Image()
    img.onload = () => {
      cv.width = img.naturalWidth
      cv.height = img.naturalHeight
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = 'color'
      ctx.fillStyle = tint
      ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
    }
    img.src = url
  }, [url, tint])
  return <canvas ref={ref} className="av-layer" style={{ zIndex: z }} />
}

export function LayeredAvatar({ config, className }: { config: AvatarConfig; className?: string }) {
  return (
    <div className={`avatar-stage ${className ?? ''}`}>
      {SLOTS.map((slot) => {
        const itemId = config.equipped[slot.id]
        if (!itemId) return null
        const item = WARDROBE[slot.id].find((i) => i.id === itemId)
        if (!item) return null
        const tint = slot.tintable ? config.tints[slot.id] : undefined
        return tint
          ? <TintedLayer key={slot.id} url={item.url} tint={tint} z={slot.z} />
          : <img key={slot.id} className="av-layer" style={{ zIndex: slot.z }} src={item.url} alt="" draggable={false} />
      })}
    </div>
  )
}
