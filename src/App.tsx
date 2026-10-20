import icSound from './assets/ui/v2/ic_sound.webp'
import { Splash } from './components/Splash'
import icMusic from './assets/ui/v2/ic_music.webp'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useGame } from './services/ServiceProvider'
import { HUD } from './components/HUD'
import { BottomNav, type Tab } from './components/BottomNav'
import { Sheet } from './components/Sheet'
import { Toggle, Checkbox } from './components/Controls'
import { useFocusPref } from './games/coach'

// Boss Lab (admin 5915): ?mock=1&bosslab=1, a test bench for all 11 Boss Battles; its own chunk, never loaded otherwise
const BossLab = lazy(() => import('./screens/BossLab').then((m) => ({ default: m.BossLab })))

const DAILY_GOALS = [{ n: 1, t: 'Casual' }, { n: 2, t: 'Regular' }, { n: 3, t: 'Serious' }]
import { MapScreen } from './screens/MapScreen'
import { QuestsScreen } from './screens/QuestsScreen'
import { LeagueScreen } from './screens/LeagueScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { ShopSheet } from './screens/ShopSheet'
import { ShopScreen } from './screens/ShopScreen'
import { StageScreen } from './screens/StageScreen'
import { ServerStage } from './screens/ServerStage'
import { CauldronScreen, cauldronSeenToday } from './screens/CauldronScreen'
import { HearthSheet } from './screens/HearthSheet'
import { CharacterScreen } from './screens/CharacterScreen'
import { WardrobeScreen } from './screens/WardrobeScreen'
import { AchievementsScreen } from './screens/AchievementsScreen'
import { RewardPopup } from './components/Rewards'
import { PortraitCapture, portraitStale } from './components/Portrait'
import { NameSheet } from './components/NameSheet'
import { Onboarding, firstStageOf, useIntroNeeded } from './screens/Onboarding'
import { MapTour } from './screens/MapTour'
import { SeasonPassScreen } from './screens/SeasonPassScreen'
import { mockFx, signedInAs, unnamed } from './services/api'
import { LoginScreen } from './screens/LoginScreen'
import { ReminderSheet } from './components/ReminderSheet'
import { hookTaps, isBlocked as remindersBlocked, isNative, isOn as remindersOn, pushSupported, resync as remindersResync, savePrefs, shouldOffer, turnOff as remindersOff, turnOn as remindersTurnOn } from './services/push'
import { api } from './services/api'
import { setMusic as playMusic } from './services/audio'
import type { CurrencyId, Stage, MiniGameId } from './types/game'

export function App() {
  const { ready, quests, achievements, error, refresh, mode, reviewDue, worlds, account, patchMe, streak } = useGame()
  const initialTab = (typeof location !== 'undefined'
    ? (new URLSearchParams(location.search).get('tab') as Tab | null) : null) || 'map'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [shop, setShop] = useState<CurrencyId | null>(null)
  const [settings, setSettings] = useState(false)
  const [playing, setPlaying] = useState<Stage | null>(null)
  const [customizing, setCustomizing] = useState(false)
  const [achOpen, setAchOpen] = useState(false)
  const [cauldron, setCauldron] = useState(false)
  const [hearth, setHearth] = useState(false)
  // admin 6018: Settings > Account opens the sign-in screen (log in / switch account / back to the guest)
  const [signIn, setSignIn] = useState(false)
  // first run (10-11): the intro, then the guided first stage of the chosen level, then the map tour
  const intro = useIntroNeeded()
  const [guideLevel, setGuideLevel] = useState<string | null>(null)
  const [guided, setGuided] = useState(false)
  const [naming, setNaming] = useState(false)
  // Phase D: Season Pass screen + the reminder offer after a won stage (never on load)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [wonPending, setWonPending] = useState(false)
  const [remind, setRemind] = useState(false)
  // audit preview (mock only, ?remindpreview=1|sheet): the reminder rows in Settings / the soft ask, never on live data
  const remindPreview = mode === 'mock' && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('remindpreview') : null
  useEffect(() => { if (ready && remindPreview === 'sheet') setRemind(true) }, [ready, remindPreview])
  useEffect(() => { const on = () => setWonPending(true); addEventListener('es-stage-won', on); return () => removeEventListener('es-stage-won', on) }, [])
  useEffect(() => {
    if (!wonPending || playing || mode !== 'http' || !account?.onboarded) return
    setWonPending(false)
    remindersResync().catch(() => {})        // Android: the plan restarts from today's fire
    shouldOffer(streak?.current ?? 0).then((y) => { if (y) setTimeout(() => setRemind(true), 900) }).catch(() => {})
  }, [wonPending, playing, mode, account?.onboarded])
  // 10-20 reminders: Android reschedules the plan on start and on every return to the app; a tapped notification
  // (Android 'es-go' event, the web service worker's message or ?go=) opens its place
  useEffect(() => {
    if (!ready || mode !== 'http') return
    hookTaps(); remindersResync().catch(() => {})
    const vis = () => { if (document.visibilityState === 'visible') remindersResync().catch(() => {}) }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [ready, mode])
  const goRef = useRef<(r: string) => void>(() => {})
  goRef.current = (r: string) => {
    if (playing) return                     // never pull the player out of a stage
    setShop(null); setSettings(false); setAchOpen(false); setCauldron(false)
    if (r === 'hearth') { setTab('map'); setHearth(true) }
    else if (r === 'season') setSeasonOpen(true)
    else if (r === 'league' || r === 'quests') { setSeasonOpen(false); setTab(r) }
    else { setSeasonOpen(false); setTab('map') }
  }
  useEffect(() => {
    if (!ready) return
    const on = (e: Event) => goRef.current(String((e as CustomEvent).detail ?? 'map'))
    addEventListener('es-go', on)
    const sw = (e: MessageEvent) => { if (e.data?.type === 'es-go') goRef.current(String(e.data.route ?? 'map')) }
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', sw)
    const first = new URLSearchParams(location.search).get('go')
    if (first) {
      goRef.current(first)
      const u = new URL(location.href); u.searchParams.delete('go'); history.replaceState(null, '', u.toString())
    }
    return () => { removeEventListener('es-go', on); if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', sw) }
  }, [ready])
  useEffect(() => {
    if (!guideLevel || !worlds.length) return
    const st = firstStageOf(worlds, guideLevel)
    setGuideLevel(null)
    if (st) { setTab('map'); setGuided(true); setPlaying(st) }
  }, [guideLevel, worlds])
  const tour = mode === 'http' && !!account?.onboarded && account.flags?.tour === 'pending'
  const endTour = () => { patchMe({ flags: { tour: 'done' } }).catch(() => { /* shown again next time */ }) }
  const leaveStage = () => {
    setPlaying(null)
    if (guided) { setGuided(false); patchMe({ flags: { guided: 'done' } }).catch(() => {}) }
  }
  const goGems = (to: 'quests' | 'achievements' | 'league') => {
    setPlaying(null); setCauldron(false)
    if (to === 'achievements') { setTab('profile'); setAchOpen(true) } else { setAchOpen(false); setTab(to) }
  }
  const toProfile = () => { setAchOpen(false); setTab('profile') }
  // Phase B: a Hearthfire that just went out can be repaired for gems; offer it once a day
  useEffect(() => {
    if (!ready || mode !== 'http' || !streak?.repair) return
    const day = new Date().toDateString()
    try { if (localStorage.getItem('rc.repairSeen') === day) return; localStorage.setItem('rc.repairSeen', day) } catch { /* show it */ }
    setHearth(true)
  }, [ready, mode, streak?.repair])
  // the spaced review comes first each day (plan: "review first"), once, when something is due
  useEffect(() => {
    if (ready && mode === 'http' && reviewDue > 0 && !cauldronSeenToday() && !new URLSearchParams(location.search).has('nocauldron')) setCauldron(true)
  }, [ready, mode, reviewDue])
  const curLevel = Math.max(0, ['A1', 'A2', 'B1', 'B2', 'C1'].indexOf([...worlds].reverse().find((w) => w.status === 'current')?.cefr ?? 'A1'))
  // retake the avatar picture on start and whenever the player leaves the wardrobe
  const [portraitV, setPortraitV] = useState(() => (portraitStale() ? 1 : 0))
  // Phase B: a look loaded from the account or changed by Wear (shop, My Items, a boss treasure) retakes the portrait
  useEffect(() => { const on = () => setPortraitV((v) => v + 1); addEventListener('rc-look', on); return () => removeEventListener('rc-look', on) }, [])

  // Android app (admin 5935): the hardware back button asks window.__esBack() first; true = handled here,
  // false = the app may exit. Closes the top sheet/screen, a running stage keeps back (no accidental quit).
  const backState = { signIn, shop, settings, hearth, naming, remind, customizing, achOpen, seasonOpen, cauldron, playing, tab }
  const backRef = useRef(backState); backRef.current = backState
  useEffect(() => {
    const w = window as unknown as { __esBack?: () => boolean }
    w.__esBack = () => {
      const b = backRef.current
      if (b.signIn) { setSignIn(false); return true }
      if (b.shop) { setShop(null); return true }
      if (b.settings) { setSettings(false); return true }
      if (b.hearth) { setHearth(false); return true }
      if (b.naming) { setNaming(false); return true }
      if (b.remind) { setRemind(false); return true }
      if (b.playing) return true
      if (b.customizing) { setCustomizing(false); setPortraitV((v) => v + 1); return true }
      if (b.achOpen) { setAchOpen(false); return true }
      if (b.seasonOpen) { setSeasonOpen(false); return true }
      if (b.cauldron) { setCauldron(false); return true }
      if (b.tab !== 'map') { setTab('map'); return true }
      return false
    }
    return () => { delete w.__esBack }
  }, [])

  // admin 6225 (Home load): the map, and with it the 3D hero page, stays mounted (hidden and paused) while another tab,
  // an overlay or a stage is open, so coming back to Home does not rebuild the hero from scratch. It is let go for
  // Boss Battle and the wardrobe (both run their own 3D page) and for the sign-in / first-run screens.
  const mapOn = ready && !signIn && !customizing && !intro && !achOpen && !seasonOpen && !cauldron && !playing && tab === 'map'
  const bossPlaying = !!playing && (playing.kind === 'boss' || playing.serverKind === 'boss' || playing.miniGame === 'boss-battle')
  const mapKept = useRef(false)
  if (mapOn) mapKept.current = true
  if (!ready || signIn || customizing || intro || bossPlaying) mapKept.current = false
  const mapMounted = mapOn || mapKept.current

  const questBadge = ready && quests.some((q) => q.progress >= q.target && !q.done)
  const achBadge = ready && achievements.some((a) => a.progress >= a.target && !a.claimed)

  // dev preview: ?screen=character opens the mage customizer directly
  const previewScreen = typeof location !== 'undefined'
    ? new URLSearchParams(location.search).get('screen') : null
  if (ready && previewScreen === 'character') {
    return <div className="app-frame"><div className="sky" /><CharacterScreen onClose={() => { location.search = '' }} /></div>
  }

  // Boss Lab: mock mode only (the local test save), so the real account is never spent or posted to
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('bosslab')) {
    if (mode !== 'mock') { const p = new URLSearchParams(location.search); p.set('mock', '1'); location.replace(location.pathname + "?" + p); return null }
    if (ready) return <Suspense fallback={<Loader />}><BossLab /></Suspense>
  }

  // dev preview: ?game=<miniGameId> jumps straight into that mini-game (inert otherwise)
  const previewGame = (typeof location !== 'undefined'
    ? new URLSearchParams(location.search).get('game') : null) as MiniGameId | null
  if (ready && previewGame) {
    const stage: Stage = { id: 'preview', index: 1, kind: 'practice', status: 'current', stars: 0, miniGame: previewGame, title: 'Preview' }
    const previewPhase = new URLSearchParams(location.search).get('phase') as any
    return (
      <div className="app-frame">
        <div className="sky" />
        <StageScreen stage={stage} onExit={() => { location.search = '' }} onNeedHearts={() => {}} previewPhase={previewPhase || undefined} />
      </div>
    )
  }

  return (
    <div className="app-frame">
      <div className="sky" />

      {mapMounted && <MapScreen active={mapOn} onPlay={setPlaying} onCauldron={() => setCauldron(true)} onHearth={() => setHearth(true)} onQuests={() => setTab('quests')} />}

      {signIn ? (
        <LoginScreen onDone={() => location.reload()} onCancel={() => setSignIn(false)} />
      ) : !ready ? (
        error ? <Offline message={error} onRetry={refresh} /> : <Loader />
      ) : customizing ? (
        <WardrobeScreen onClose={() => { setCustomizing(false); setPortraitV((v) => v + 1) }} />
      ) : intro ? (
        <Onboarding onDone={(lv) => lv && setGuideLevel(lv)} onWardrobe={() => setCustomizing(true)} onLook={() => setPortraitV((v) => v + 1)} />
      ) : achOpen ? (
        <>
          <HUD onBuy={setShop} onSettings={() => setSettings(true)} onProfile={toProfile} />
          <AchievementsScreen onClose={() => setAchOpen(false)} />
        </>
      ) : seasonOpen ? (
        <>
          <HUD onBuy={setShop} onSettings={() => setSettings(true)} onProfile={toProfile} />
          <SeasonPassScreen onClose={() => setSeasonOpen(false)} />
        </>
      ) : cauldron ? (
        <CauldronScreen level={curLevel} onClose={() => setCauldron(false)} />
      ) : playing ? (
        mode === 'http'
          ? <ServerStage stage={playing} onExit={leaveStage} onNeedHearts={() => setShop('hearts')} guided={guided} />
          : <StageScreen stage={playing} onExit={() => setPlaying(null)} onNeedHearts={() => setShop('hearts')} />
      ) : (
        <>
          <HUD onBuy={setShop} onSettings={() => setSettings(true)} onProfile={toProfile} />

          {tab === 'quests' && <QuestsScreen onGo={(to) => { if (to === 'cauldron' && mode === 'http') setCauldron(true); else setTab('map') }}
            onSeason={mode === 'http' || mockFx('GET /v1/season') ? () => setSeasonOpen(true) : undefined} />}
          {tab === 'shop' && <ShopScreen onSeason={mode === 'http' || mockFx('GET /v1/season') ? () => setSeasonOpen(true) : undefined} />}
          {tab === 'league' && <LeagueScreen />}
          {tab === 'profile' && <ProfileScreen onBuy={setShop} onCustomize={() => setCustomizing(true)} onAchievements={() => setAchOpen(true)}
            onSeason={mode === 'http' || mockFx('GET /v1/season') ? () => setSeasonOpen(true) : undefined} />}

          <BottomNav tab={tab} onChange={setTab} badge={{ quests: questBadge, profile: achBadge }} />
          {tour && tab === 'map' && !guideLevel && <MapTour onDone={endTour} />}
        </>
      )}

      <ShopSheet currency={shop} onClose={() => setShop(null)} onGo={goGems} />
      {mode === 'http' && <HearthSheet open={hearth} onClose={() => setHearth(false)} />}
      <RewardPopup />
      {ready && portraitV > 0 && !customizing && !playing && <PortraitCapture version={portraitV} />}

      <Sheet open={settings} title="Settings" variant="light" onClose={() => setSettings(false)}>
        <SettingsBody server={mode === 'http'} remindPreview={!!remindPreview} onRename={() => { setSettings(false); setNaming(true) }} onAccount={() => { setSettings(false); setSignIn(true) }} />
      </Sheet>
      {mode === 'http' && <NameSheet open={naming} onClose={() => setNaming(false)} />}
      {(mode === 'http' || remindPreview) && <ReminderSheet open={remind} onClose={() => setRemind(false)} />}
    </div>
  )
}

function Loader() {
  return <Splash />   // admin 6041: the startup splash (same as the static one in index.html)
}

/** the first load failed: say so and offer a retry instead of a blank screen */
export function Offline({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 1, padding: 24 }}>
      <div className="gate-card pop" style={{ position: 'relative' }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 24, letterSpacing: '.08em', color: 'var(--gold)' }}>ENGLISH SPELL</div>
        <h2>The realm is out of reach</h2>
        <p>{message}</p>
        <button className="btn btn-gold big" disabled={busy} onClick={async () => { setBusy(true); await onRetry(); setBusy(false) }}>
          {busy ? 'Reaching the realm…' : 'Try again'}
        </button>
      </div>
    </div>
  )
}

function SettingsBody({ server, remindPreview, onRename, onAccount }: { server: boolean; remindPreview?: boolean; onRename: () => void; onAccount: () => void }) {
  const { account, profile, patchMe } = useGame()
  // Phase C (audit §2 Settings): daily goal, Focus mode and the game tutorials live here too
  const [focusOn, setFocusOn] = useFocusPref(account?.flags, server ? (on) => { patchMe({ flags: { focus: on ? 'on' : 'off' } }).catch(() => {}) } : null)
  const [tutReset, setTutReset] = useState(false)
  const goal = account?.daily_goal ?? null
  const load = (k: string, d: boolean) => { try { const v = localStorage.getItem('rc.set.' + k); return v == null ? d : v === '1' } catch { return d } }
  const save = (k: string, v: boolean) => { try { localStorage.setItem('rc.set.' + k, v ? '1' : '0') } catch {} }
  const [sound, setSound] = useState(() => load('sound', true))
  const [music, setMusic] = useState(() => load('music', true))
  const [motion, setMotion] = useState(() => load('motion', false))
  const set = (k: string, sv: (v: boolean) => void) => (v: boolean) => { sv(v); save(k, v) }
  // mock previews only (?mock=1): wipe the local test save. Live players never see it (audit 10-11 P0).
  const reset = () => { try { ['runecast.save.v1', 'es.map.seen.v2', 'es.ach.claimed', 'es.review.day'].forEach((k) => localStorage.removeItem(k)) } catch {} location.reload() }
  const name = account?.display_name ?? profile?.name ?? ''
  const acct = signedInAs()
  return (
    <div>
      {server && (
        <div className="set-name">
          <span><small>Account</small><b>{acct ? `Signed in as ${acct}` : 'Playing as a guest'}</b></span>
          <button className="cb cb-white set-name-btn" onClick={onAccount}>{acct ? 'Switch' : 'Log in'}</button>
        </div>
      )}
      {server && (
        <div className="set-name">
          <span><small>Your name</small><b>{unnamed(name) ? 'Not chosen yet' : name}</b></span>
          <button className="cb cb-white set-name-btn" onClick={onRename}>Change</button>
        </div>
      )}
      {server && (
        <div className="set-name set-goal">
          <span><small>Daily goal: stages a day</small><b>{DAILY_GOALS.find((g) => g.n === goal)?.t ?? 'Not set'}</b></span>
          <span className="set-goal-btns">{DAILY_GOALS.map((g) => (
            <button key={g.n} className={`set-goal-b${g.n === goal ? ' on' : ''}`} aria-pressed={g.n === goal}
              onClick={() => { patchMe({ daily_goal: g.n }).catch(() => {}) }}>{g.n}</button>
          ))}</span>
        </div>
      )}
      {server && (
        <div className="set-name">
          <span><small>Game tutorials</small><b>{tutReset ? 'Will show again' : 'Shown once'}</b></span>
          <button className="cb cb-white set-name-btn" disabled={tutReset} onClick={() => {
            try { localStorage.removeItem('rc.tut') } catch { /* private mode */ }
            patchMe({ flags: { tut: 'reset' } }).then(() => setTutReset(true)).catch(() => {})
          }}>Show again</button>
        </div>
      )}
      {(server || remindPreview) && <ReminderRow preview={!!remindPreview && !server} />}
      <Checkbox label="Focus mode: no timers, calm screen" on={focusOn} onChange={setFocusOn} />
      <Toggle label="Sound effects" icon={icSound} on={sound} onChange={set('sound', setSound)} />
      <Toggle label="Music" icon={icMusic} on={music} onChange={(v) => { set('music', setMusic)(v); playMusic(v) }} />
      <Checkbox label="Reduce motion" on={motion} onChange={set('motion', setMotion)} />
      {!server && <button className="btn-candy-red" onClick={reset}>Reset test progress</button>}
    </div>
  )
}

/** The daily reminder (English Spell's own: Web Push on the web, local notifications in the Android app) with its
 *  time and Event news (10-20, admin 6138). On = ask + subscribe/schedule; off = nothing more is sent here. */
function ReminderRow({ preview = false }: { preview?: boolean }) {
  const [on, setOn] = useState<boolean | null>(preview ? true : null)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [minute, setMinute] = useState<number | null>(null)       // null = auto
  const [auto, setAuto] = useState(18 * 60)
  const [events, setEvents] = useState(true)
  useEffect(() => {
    if (preview) return
    remindersOn().then(setOn).catch(() => setOn(false))
    remindersBlocked().then(setBlocked).catch(() => {})
    api.pushStatus().then((st) => {
      setMinute(st.minute ?? null); setAuto(st.auto_minute ?? (st.reminder_hour ?? 18) * 60); setEvents(st.events !== false)
    }).catch(() => {})
  }, [])
  if (!pushSupported()) return (
    <div className="set-name"><span><small>Daily reminder</small><b>{isNative() ? 'Needs the new app version' : 'Not in this browser'}</b></span></div>
  )
  const where = isNative() ? 'phone' : 'browser'
  const flip = async () => {
    if (busy || on == null) return
    setBusy(true); setMsg(null)
    try {
      if (on) { await remindersOff(); setOn(false) }
      else {
        const ok = await remindersTurnOn(); setOn(ok)
        if (!ok) { setBlocked(await remindersBlocked()); setMsg(`Allow notifications in your ${where} settings`) }
      }
    } catch { setMsg('Try again later') }
    setBusy(false)
  }
  const pickTime = (v: string) => {
    const m = v === 'auto' ? null : Number(v)
    setMinute(m)
    savePrefs(m == null ? { auto: true } : { minute: m }).catch(() => setMsg('Try again later'))
  }
  const flipEvents = (v: boolean) => { setEvents(v); savePrefs({ events: v }).catch(() => setMsg('Try again later')) }
  const times: number[] = []
  for (let m = 7 * 60; m <= 22 * 60; m += 30) times.push(m)
  return (
    <>
      <div className="set-name">
        <span><small>Daily reminder</small><b>{msg ?? (blocked && !on ? `Blocked in your ${where}` : on ? 'On' : 'Off')}</b></span>
        <button className="cb cb-white set-name-btn" disabled={busy || on == null} onClick={flip}>{busy ? '…' : on ? 'Turn off' : 'Turn on'}</button>
      </div>
      {on && (
        <label className="set-name set-time">
          <span><small>{minute == null ? 'Reminder time (auto)' : 'Reminder time'}</small><b>{clock(minute ?? auto)}</b></span>
          <span className="cb cb-white set-name-btn set-time-btn">Change
            <select aria-label="Reminder time" value={minute == null ? 'auto' : String(minute)} onChange={(e) => pickTime(e.target.value)}>
              <option value="auto">Auto (your usual play time)</option>
              {times.map((m) => <option key={m} value={m}>{clock(m)}</option>)}
            </select>
          </span>
        </label>
      )}
      {on && <Checkbox label="Event news (league, bosses)" on={events} onChange={flipEvents} />}
    </>
  )
}

/** minutes after midnight → the phone's own clock style (18:30 or 6:30 PM) */
function clock(m: number) {
  const d = new Date(2026, 0, 1, Math.floor(m / 60), m % 60)
  try { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch { return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` }
}
