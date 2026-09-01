// Layered paper-doll character system (Sims-like mage customization).
// Every layer art is authored on the SAME square canvas (1024x1024) with the
// body centered, so layers stack pixel-aligned with no per-item offsets.

// A layered paper-doll on a base MANNEQUIN. Skin color = a mannequin variant
// (a separate asset), not a runtime recolor. Everything else is a separate layer.
export type SlotId = 'body' | 'bottom' | 'shoes' | 'top' | 'cloak' | 'eyes' | 'hair' | 'hat' | 'staff'

export interface SlotDef {
  id: SlotId
  label: string
  z: number          // paint order, low = back
  tintable: boolean  // can the player recolor it
  required: boolean  // must always have a pick (the mannequin)
}

// back -> front
export const SLOTS: SlotDef[] = [
  { id: 'body',   label: 'Body',  z: 10, tintable: false, required: true },  // mannequin (skin variant)
  { id: 'bottom', label: 'Pants', z: 20, tintable: true,  required: false },
  { id: 'shoes',  label: 'Shoes', z: 24, tintable: true,  required: false },
  { id: 'top',    label: 'Top',   z: 30, tintable: true,  required: false },
  { id: 'cloak',  label: 'Cloak', z: 36, tintable: true,  required: false },
  { id: 'eyes',   label: 'Eyes',  z: 42, tintable: true,  required: false },
  { id: 'hair',   label: 'Hair',  z: 50, tintable: true,  required: false },
  { id: 'hat',    label: 'Hat',   z: 56, tintable: true,  required: false },
  { id: 'staff',  label: 'Staff', z: 62, tintable: true,  required: false },
]

export interface WardrobeItem {
  id: string        // filename stem, e.g. "robe_02"
  slot: SlotId
  url: string
  thumb: string     // same url; a real thumb can be added later
}

// what the player has equipped: chosen item id (or null) + optional tint per slot
export type Equipped = Partial<Record<SlotId, string | null>>
export type Tints = Partial<Record<SlotId, string>>

export interface AvatarConfig {
  equipped: Equipped
  tints: Tints
}
