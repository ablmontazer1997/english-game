import { SLOTS, type SlotId, type WardrobeItem } from '../types/character'

// Eagerly import every character asset. Files are grouped by slot folder:
//   src/assets/character/<slot>/<id>.png
// Drop new PNGs into those folders and they appear automatically.
const files = import.meta.glob('../assets/character/*/*.png', {
  eager: true, import: 'default',
}) as Record<string, string>

function slotOf(path: string): SlotId | null {
  const m = path.match(/character\/([^/]+)\//)
  const s = m?.[1] as SlotId | undefined
  return s && SLOTS.some((sl) => sl.id === s) ? s : null
}

export const WARDROBE: Record<SlotId, WardrobeItem[]> = Object.fromEntries(
  SLOTS.map((s) => [s.id, [] as WardrobeItem[]]),
) as Record<SlotId, WardrobeItem[]>

for (const [path, url] of Object.entries(files)) {
  const slot = slotOf(path)
  if (!slot) continue
  const id = path.split('/').pop()!.replace(/\.png$/, '')
  WARDROBE[slot].push({ id, slot, url, thumb: url })
}
for (const slot of Object.keys(WARDROBE) as SlotId[]) {
  WARDROBE[slot].sort((a, b) => a.id.localeCompare(b.id))
}

export const hasAnyAsset = Object.values(WARDROBE).some((a) => a.length > 0)
export const hasBody = WARDROBE.body.length > 0

// magic-night palette offered for recoloring tintable slots
export const TINT_SWATCHES = [
  '', // '' = original colors (no tint)
  '#8b5cf6', '#6366f1', '#3b82f6', '#22d3ee',
  '#ef4444', '#f59e0b', '#f5c451', '#10b981',
  '#ec4899', '#a855f7', '#f8fafc', '#1f2937',
]
