import { useMemo, useState } from 'react'
import { SLOTS, type AvatarConfig, type SlotId } from '../types/character'
import { WARDROBE, TINT_SWATCHES, hasBody } from '../data/wardrobe'
import { LayeredAvatar } from '../components/LayeredAvatar'
import './character.css'

const STORE_KEY = 'runecast.avatar'

function loadConfig(): AvatarConfig {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  // default: male base if present, else first available body
  const male = WARDROBE.body.find((b) => b.id === 'mage_m')
  return { equipped: { body: male?.id ?? WARDROBE.body[0]?.id ?? null }, tints: {} }
}

export function CharacterScreen({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<AvatarConfig>(loadConfig)
  const [slot, setSlot] = useState<SlotId>('body')

  const slotDef = SLOTS.find((s) => s.id === slot)!
  const items = WARDROBE[slot]

  const pick = (id: string | null) =>
    setConfig((c) => ({ ...c, equipped: { ...c.equipped, [slot]: id } }))
  const tint = (color: string) =>
    setConfig((c) => ({ ...c, tints: { ...c.tints, [slot]: color } }))

  const randomize = () => setConfig(() => {
    const equipped: AvatarConfig['equipped'] = {}
    const tints: AvatarConfig['tints'] = {}
    for (const s of SLOTS) {
      const arr = WARDROBE[s.id]
      if (s.required) equipped[s.id] = arr[0]?.id ?? null
      else equipped[s.id] = arr.length ? (Math.random() < 0.75 ? arr[Math.floor(Math.random() * arr.length)].id : null) : null
      if (s.tintable && Math.random() < 0.6) tints[s.id] = TINT_SWATCHES[1 + Math.floor(Math.random() * (TINT_SWATCHES.length - 1))]
    }
    return { equipped, tints }
  })

  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(config)) } catch { /* ignore */ }
    onClose()
  }

  const currentTint = config.tints[slot] ?? ''
  const empty = useMemo(() => !hasBody, [])

  return (
    <div className="screen char-screen full">
      <header className="char-top">
        <button className="char-x" onClick={onClose} aria-label="Close">‹</button>
        <h2>Your Mage</h2>
        <button className="char-rand" onClick={randomize} aria-label="Randomize">🎲</button>
      </header>

      <div className="char-stage">
        {empty ? (
          <div className="char-empty">
            <div className="char-empty-orb" />
            <p>Add a base mage body to bring this to life.</p>
            <small>src/assets/character/body/*.png</small>
          </div>
        ) : (
          <LayeredAvatar config={config} className="char-avatar" />
        )}
      </div>

      {slotDef.tintable && (
        <div className="char-tints">
          {TINT_SWATCHES.map((c) => (
            <button key={c || 'none'} className={`sw${currentTint === c ? ' on' : ''}${c ? '' : ' sw-none'}`}
              style={c ? { background: c } : undefined} onClick={() => tint(c)} aria-label={c || 'Original'}>
              {c ? '' : '×'}
            </button>
          ))}
        </div>
      )}

      <div className="char-items">
        {!slotDef.required && (
          <button className={`item item-none${!config.equipped[slot] ? ' on' : ''}`} onClick={() => pick(null)}>None</button>
        )}
        {items.map((it) => (
          <button key={it.id} className={`item${config.equipped[slot] === it.id ? ' on' : ''}`} onClick={() => pick(it.id)}>
            <img src={it.thumb} alt={it.id} draggable={false} />
          </button>
        ))}
        {items.length === 0 && <div className="item-empty">No items for "{slotDef.label}" yet</div>}
      </div>

      <nav className="char-slots">
        {SLOTS.map((s) => (
          <button key={s.id} className={`slot-tab${slot === s.id ? ' active' : ''}`} onClick={() => setSlot(s.id)}>
            {s.label}
            {WARDROBE[s.id].length > 0 && <i className="slot-count">{WARDROBE[s.id].length}</i>}
          </button>
        ))}
      </nav>

      <button className="char-save" onClick={save}>Save</button>
    </div>
  )
}
