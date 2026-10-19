// Sign-in screen (admin 6018): username + password on the intro's Spellbook parchment, the Archmage's apprentice
// cheering above it. First launch (no token on this install yet) shows it before the game loads, with "Play as guest"
// as the second choice; Settings opens it again as "Log in" / "Switch". A successful login keeps the guest token
// aside (es.api.guest_token) and the device id unchanged, so "Play as guest" always returns to the same guest.

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { accountLogin, errorText, needsAuthChoice, playAsGuest, signedInAs } from '../services/api'
import { Btn } from '../components/PageArt'
import { Parchment } from './Onboarding'
import stageBg from '../assets/stage_bg.webp'
import heroCheer from '../assets/games/boss2/hero_cheer.webp'
import '../components/spellletter.css'
import '../components/namesheet.css'
import './stage.css'
import './onboarding.css'
import './login.css'

const IcUser = () => (
  <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21c.9-4.4 4.2-6.6 8.2-6.6s7.3 2.2 8.2 6.6" /></svg>
)
const IcLock = () => (
  <svg viewBox="0 0 24 24" aria-hidden><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.6" /><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" /></svg>
)
const IcEye = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3.1" />
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

  const frame = (content: ReactNode, actions: ReactNode) => (
    <div className="stage-host full ob lg-screen">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <div className="ob-scroll">
        <img className="lg-hero" src={heroCheer} alt="" draggable={false} />
        <div className="ob-card lg-card pop">{content}</div>
        <div className="ob-actions">{actions}</div>
      </div>
    </div>
  )

  if (confirm) return frame(
    <Parchment tag="Account">
      <h2 className="sl-title sm">Leave the guest path?</h2>
      <p className="sl-sum">Your guest progress stays on this phone. Choose <em>Play as guest</em> on this screen any time to return to it.</p>
    </Parchment>,
    <>
      <Btn className="lg ob-main" onClick={doLogin} disabled={busy}>{busy ? 'Opening the gates…' : `Log in as ${user.trim().toLowerCase()}`}</Btn>
      <button className="cb cb-white ob-sec" onClick={() => setConfirm(false)} disabled={busy}>Go back</button>
    </>,
  )

  return frame(
    <Parchment tag="English Spell">
      <h2 className="sl-title sm">{current ? 'Switch account' : 'Welcome, apprentice'}</h2>
      <p className="sl-sum lg-sub">{current ? <>Signed in as <b>{current}</b>. Log in with another account below.</> : 'Log in to continue your journey.'}</p>
      <form className="lg-form" onSubmit={submit} noValidate>
        <label className={`nm-field lg-field${err ? ' bad' : ''}`}>
          <span className="lg-ic"><IcUser /></span>
          <input name="username" value={user} maxLength={64} autoComplete="username" autoCapitalize="none" autoCorrect="off"
            spellCheck={false} placeholder="Username" aria-label="Username" aria-invalid={!!err} enterKeyHint="next"
            onChange={(e) => { setUser(e.target.value); setErr(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pwRef.current?.focus() } }} />
        </label>
        <label className={`nm-field lg-field${err ? ' bad' : ''}`}>
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
    </Parchment>,
    <>
      <Btn className="lg ob-main" onClick={() => submit()} disabled={!ready || busy}>{busy ? 'Opening the gates…' : 'Log in'}</Btn>
      <div className="ob-row2">
        <button className="cb cb-white ob-sec" onClick={guest} disabled={busy}>Play as guest</button>
        {onCancel && <button className="cb cb-white ob-sec" onClick={onCancel} disabled={busy}>Cancel</button>}
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
