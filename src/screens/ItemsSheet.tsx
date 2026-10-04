// The wardrobe items the server says you own, by slot, with what is worn (PUT /v1/inventory/equip).
// The 3D wardrobe (Edit) still keeps its own look; this is the server's record of owned and equipped items.
import { useEffect, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Btn, art } from '../components/PageArt'
import { api, errorText, type InventoryOut, type CatalogItem } from '../services/api'
import './pages.css'
import './serverstage.css'

const SLOT_NAME: Record<string, string> = { hat: 'Hats', coat: 'Cloaks', top: 'Tops', shirt: 'Shirts', pants: 'Trousers', shoes: 'Boots', hair: 'Hair', haircolor: 'Hair colour', eyes: 'Eyes', palette: 'Palettes', pose: 'Poses' }
const SOURCE: Record<string, string> = { free: 'Free', boss: 'Boss treasure', bonus: 'Vault treasure', shop: 'Bought', gem: 'Bought' }

export function ItemsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [inv, setInv] = useState<InventoryOut | null>(null)
  const [cat, setCat] = useState<Record<string, CatalogItem>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setErr('')
    Promise.all([api.inventory(), api.catalog()]).then(([i, c]) => { setInv(i); setCat(Object.fromEntries(c.map((x) => [x.id, x]))) })
      .catch((e) => setErr(errorText(e)))
  }, [open])
  if (!open) return null
  const slots = inv ? [...new Set(inv.items.map((i) => i.slot))] : []
  const equip = async (slot: string, id: string) => {
    setBusy(id)
    try { setInv(await api.equip(slot, id)) } catch (e) { setErr(errorText(e)) }
    setBusy(null)
  }
  return (
    <Sheet open={open} title="My Items" variant="light" onClose={onClose}>
      <div className="ss-list it-list">
        {err && <p className="ss-note">{err}</p>}
        {!inv && !err && <p className="ss-note">Opening your chest…</p>}
        {slots.map((slot) => (
          <div key={slot} className="it-slot">
            <b className="it-h">{SLOT_NAME[slot] ?? slot}</b>
            {inv!.items.filter((i) => i.slot === slot).map((i) => {
              const on = inv!.equipped[slot] === i.item_id
              return (
                <div key={i.item_id} className={`it-row${on ? ' on' : ''}`}>
                  <img src={`/runecast-wardrobe/thumbs/item_${i.item_id}.png`} alt="" draggable={false}
                    onError={(e) => { (e.target as HTMLImageElement).src = art('qi_star') }} />
                  <span><b>{cat[i.item_id]?.name ?? i.item_id}</b><small>{SOURCE[i.source] ?? i.source}</small></span>
                  {on ? <em>Worn</em> : <Btn className="sm" disabled={!!busy} onClick={() => equip(slot, i.item_id)}>Wear</Btn>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
