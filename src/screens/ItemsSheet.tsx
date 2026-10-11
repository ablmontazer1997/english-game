// My Items: the wardrobe items the server says you own, by slot. "Wear" changes the look on the account
// (PUT /v1/inventory/equip), which the 3D wardrobe, the hero and the portrait load (Phase B, audit 10-11).
import { useEffect, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Btn, type ArtName } from '../components/PageArt'
import { ItemThumb } from '../components/ItemThumb'
import { api, errorText, type WardrobeOut, type Look } from '../services/api'
import { wearItem } from '../services/look'
import './pages.css'
import './serverstage.css'

const SLOTS: [string, string][] = [['hat', 'Hats'], ['coat', 'Cloaks'], ['top', 'Tops'], ['pants', 'Trousers'], ['shoes', 'Boots'], ['hair', 'Hair'], ['haircolor', 'Hair colour'], ['eyes', 'Eyes']]
const TIER: Record<string, string> = { free: 'Starter', boss: 'Boss treasure', earned: 'Earned', coin: 'Bought', gem: 'Bought', premium: 'Premium' }
const FALLBACK: Record<string, ArtName> = { hair: 'qi_crystal', haircolor: 'qi_potion', eyes: 'qi_star' }

export function ItemsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [wd, setWd] = useState<WardrobeOut | null>(null)
  const [look, setLook] = useState<Look | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setErr('')
    api.wardrobe().then((w) => { setWd(w); setLook(w.look ?? w.default_look) }).catch((e) => setErr(errorText(e)))
  }, [open])
  if (!open) return null
  const mine = wd ? wd.items.filter((i) => i.owned) : []
  const wear = async (slot: string, id: string) => {
    setBusy(id)
    try { const l = await wearItem(slot, id); if (l) setLook(l) } catch (e) { setErr(errorText(e)) }
    setBusy(null)
  }
  return (
    <Sheet open={open} title="My Items" variant="light" onClose={onClose}>
      <div className="ss-list it-list">
        {err && <p className="ss-note">{err}</p>}
        {!wd && !err && <p className="ss-note">Opening your chest…</p>}
        {wd && SLOTS.map(([slot, title]) => {
          const list = mine.filter((i) => i.slot === slot)
          if (!list.length) return null
          return (
            <div key={slot} className="it-slot">
              <b className="it-h">{title}</b>
              {list.map((i) => {
                const on = (look as Record<string, unknown> | null)?.[slot] === i.id
                return (
                  <div key={i.id} className={`it-row${on ? ' on' : ''}`}>
                    <ItemThumb id={i.id} fallback={FALLBACK[slot] ?? 'qi_star'} />
                    <span><b>{i.name}</b><small>{TIER[i.tier] ?? i.tier}</small></span>
                    {on ? <em>Worn</em> : <Btn className="sm" disabled={!!busy} onClick={() => wear(slot, i.id)}>Wear</Btn>}
                  </div>
                )
              })}
            </div>
          )
        })}
        {wd && <p className="ss-note">Win more in boss fights, keep your Hearthfire burning, or buy looks in the Shop. Fine-tune colours in Edit.</p>}
      </div>
    </Sheet>
  )
}
