import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Btn, art } from './PageArt'
import { isNative, markOffered, turnOn } from '../services/push'
import './namesheet.css'

/** Phase D: our own soft ask after a won stage (never on load). Only "Yes" calls the system permission prompt
 *  (browser, or Android 13+ POST_NOTIFICATIONS in the app). */
export function ReminderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (open) { markOffered(); setMsg(null) } }, [open])
  const yes = async () => {
    setBusy(true)
    try {
      const ok = await turnOn()
      if (ok) { onClose(); return }
      setMsg(`Your ${isNative() ? 'phone' : 'browser'} said no. You can turn reminders on later in Settings.`)
    } catch { setMsg('Reminders could not be turned on here. Try again later in Settings.') }
    setBusy(false)
  }
  return (
    <Sheet open={open} title="Keep it lit" variant="light" onClose={onClose}>
      <div className="nm-sheet rmd-sheet">
        <img className="rmd-art" src={art('qi_flame')} alt="" draggable={false} />
        <p className="nm-note">Well cast! Want a gentle owl note on days you have not played yet, so your Hearthfire does not go out?</p>
        <p className="nm-note rmd-small">One short note a day at most, at your usual play time. You can change the time or turn it off in Settings.</p>
        {msg && <p className="nm-err">{msg}</p>}
        <Btn className="lg" name="btn_gold" onClick={yes} disabled={busy}>{busy ? 'Asking…' : 'Yes, remind me'}</Btn>
        <button className="cb cb-white rmd-later" onClick={onClose} disabled={busy}>Not now</button>
      </div>
    </Sheet>
  )
}
