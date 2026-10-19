// Sign-in screen (admin 6018; look = mockup B, admin 6056/6062): the full-screen magic letter (ScrollSheet) with the
// waving hero, "Welcome back", username + password fields (show/hide), the green Log in, "or", the cream Play as guest.
// First launch (no token on this install yet) shows it before the game loads; Settings opens it again as "Log in" /
// "Switch". A successful login keeps the guest token aside (es.api.guest_token) and the device id unchanged, so
// "Play as guest" always returns to the same guest.

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { accountLogin, errorText, needsAuthChoice, playAsGuest, signedInAs } from '../services/api'
import { Btn } from '../components/PageArt'
import { ScrollSheet } from '../components/ScrollSheet'
import divider from '../assets/spellbook/divider.webp'
import '../components/es2kit.css'
import './stage.css'
import './login.css'

const IcUser = () => (
  <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="7.6" r="4.6" /><path d="M3.4 21.2c.6-5 4.1-7.7 8.6-7.7s8 2.7 8.6 7.7Z" /></svg>
)
const IcLock = () => (
  <svg viewBox="0 0 24 24" aria-hidden><path className="ln" d="M7.6 10.6V7.8a4.4 4.4 0 0 1 8.8 0v2.8" /><rect x="4.2" y="10.2" width="15.6" height="11.4" rx="2.8" /></svg>
)
const IcEye = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden className="ln"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3.1" />
    {off && <path d="M4 4l16 16" />}</svg>
)

export function LoginScreen({ firstRun, onDone, onCancel }: {
  /** first launch: no account on this install yet (guest is the second choice, no confirm needed) */
  firstRun?: boolean
  /** signed in, or chose to play as a guest */
  onDone: () => void
  /** opened from Settings: go back without changing anything */
  onCancel?: () => void
}) {
  const current = signedInAs()
  const [user, setUser] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const pwRef = useRef<HTMLInputElement>(null)
  const ready = user.trim().length > 0 && pw.length > 0

  const doLogin = async () => {
    setBusy(true); setErr(null)
    try { await accountLogin(user, pw); onDone() } catch (e) {
      setErr(errorText(e)); setBusy(false); setConfirm(false)
      if (pwRef.current) { pwRef.current.select(); pwRef.current.focus() }
    }
  }
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!ready || busy) return
    // switching away from a guest: say once that its progress stays on this phone
    if (!firstRun && !current) { setConfirm(true); return }
    doLogin()
  }
  const guest = () => { playAsGuest(); onDone() }
  const sheet = (body: ReactNode) => <div className="stage-host full lg-screen"><ScrollSheet title="English Spell" hero>{body}</ScrollSheet></div>

  if (confirm) return sheet(
    <>
      <h1 className="lg-h">Switch account?</h1>
      <p className="lg-sub">Your guest progress stays on this phone. Tap <b>Play as guest</b> on this screen any time to go back to it.</p>
      <div className="lg-acts">
        <Btn className="lg lg-main" onClick={doLogin} disabled={busy}>{busy ? 'Opening…' : `Log in as ${user.trim().toLowerCase()}`}</Btn>
        <button className="cb cb-white lg-sec" onClick={() => setConfirm(false)} disabled={busy}>Go back</button>
      </div>
    </>,
  )

  return sheet(
    <>
      <h1 className="lg-h">{current ? 'Switch account' : 'Welcome back'}</h1>
      <p className="lg-sub">{current ? <>Now playing as <b>{current}</b></> : 'Log in to continue your journey'}</p>
      <img className="lg-div" src={divider} alt="" draggable={false} />
      <form className="lg-form" onSubmit={submit} noValidate>
        <label className={`lg-field${err ? ' bad' : ''}`}>
          <span className="lg-ic"><IcUser /></span>
          <input name="username" value={user} maxLength={64} autoComplete="username" autoCapitalize="none" autoCorrect="off"
            spellCheck={false} placeholder="Username" aria-label="Username" aria-invalid={!!err} enterKeyHint="next"
            onChange={(e) => { setUser(e.target.value); setErr(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pwRef.current?.focus() } }} />
        </label>
        <label className={`lg-field${err ? ' bad' : ''}`}>
          <span className="lg-ic"><IcLock /></span>
          <input ref={pwRef} name="password" type={show ? 'text' : 'password'} value={pw} maxLength={200} autoComplete="current-password"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Password" aria-label="Password" aria-invalid={!!err}
            enterKeyHint="go" onChange={(e) => { setPw(e.target.value); setErr(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} />
          <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)} aria-pressed={show}
            aria-label={show ? 'Hide password' : 'Show password'}><IcEye off={show} /></button>
        </label>
        <p className="lg-err" role="alert" aria-live="assertive">{err ?? ''}</p>
      </form>
      <div className="lg-acts">
        <Btn className="lg lg-main" onClick={() => submit()} disabled={!ready || busy}>{busy ? 'Opening…' : 'Log in'}</Btn>
        <div className="lg-or" aria-hidden><i /><span>or</span><i /></div>
        <div className="lg-row">
          <button className="cb cb-white lg-sec" onClick={guest} disabled={busy}>Play as guest</button>
          {onCancel && <button className="cb cb-white lg-sec" onClick={onCancel} disabled={busy}>Cancel</button>}
        </div>
      </div>
    </>,
  )
}

/** first launch: ask before any guest account is made; everyone who already plays goes straight in */
export function AuthGate({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState(needsAuthChoice)
  if (ask) return <div className="app-frame"><LoginScreen firstRun onDone={() => setAsk(false)} /></div>
  return <>{children}</>
}
