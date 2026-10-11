import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Btn } from './PageArt'
import { useGame } from '../services/ServiceProvider'
import { errorText } from '../services/api'
import './namesheet.css'

/** the name other players see in the league; checked again on the server (2..20 letters or numbers) */
export const nameOk = (n: string) => n.trim().replace(/\s+/g, ' ').length >= 2

/** the quill line where the player writes their apprentice name (intro, Settings, League) */
export function NameField({ value, onChange, onEnter, autoFocus }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean }) {
  return (
    <label className="nm-field">
      <span className="nm-quill" aria-hidden>✒</span>
      <input value={value} maxLength={20} autoFocus={autoFocus} autoComplete="nickname" spellCheck={false} placeholder="Your name"
        aria-label="Your apprentice name" onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.() }} />
    </label>
  )
}

/** rename sheet (Settings + League): saves through PATCH /v1/me */
export function NameSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account, profile, patchMe } = useGame()
  const cur = account?.display_name ?? profile?.name ?? ''
  const [v, setV] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setV(cur === 'Apprentice' ? '' : cur); setMsg(null) } }, [open, cur])
  const save = async () => {
    if (!nameOk(v) || busy) return
    setBusy(true)
    try { await patchMe({ display_name: v.trim() }); onClose() } catch (e) { setMsg(errorText(e)) }
    setBusy(false)
  }
  return (
    <Sheet open={open} title="Your name" variant="light" onClose={onClose}>
      <div className="nm-sheet">
        <p className="nm-note">Other apprentices see this name in the weekly league.</p>
        <NameField value={v} onChange={setV} onEnter={save} autoFocus />
        {msg && <p className="nm-err">{msg}</p>}
        <Btn className="lg" onClick={save} disabled={!nameOk(v) || busy}>{busy ? 'Saving…' : 'Save'}</Btn>
      </div>
    </Sheet>
  )
}
