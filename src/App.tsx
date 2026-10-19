import icSound from './assets/ui/v2/ic_sound.webp'
import icMusic from './assets/ui/v2/ic_music.webp'
import { lazy, Suspense, useEffect, useState } from 'react'
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
import { mockFx } from './services/api'
import { ReminderSheet } from './components/ReminderSheet'
import { isOn as remindersOn, pushSupported, shouldOffer, turnOff as remindersOff, turnOn as remindersTurnOn } from './services/push'
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
  // first run (10-11): the intro, then the guided first stage of the chosen level, then the map tour
  const intro = useIntroNeeded()
  const [guideLevel, setGuideLevel] = useState<string | null>(null)
  const [guided, setGuided] = useState(false)
  const [naming, setNaming] = useState(false)
  // Phase D: Season Pass screen + the reminder offer after a won stage (never on load)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [wonPending, setWonPending] = useState(false)
  const [remind, setRemind] = useState(false)
  useEffect(() => { const on = () => setWonPending(true); addEventListener('es-stage-won', on); return () => removeEventListener('es-stage-won', on) }, [])
  useEffect(() => {
    if (!wonPending || playing || mode !== 'http' || !account?.onboarded) return
    setWonPending(false)
    if (shouldOffer()) setTimeout(() => setRemind(true), 900)   // no cleanup: clearing wonPending re-runs this effect
  }, [wonPending, playing, mode, account?.onboarded])
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

      {!ready ? (
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

          {tab === 'map' && <MapScreen onPlay={setPlaying} onCauldron={() => setCauldron(true)} onHearth={() => setHearth(true)} onQuests={() => setTab('quests')} />}
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
        <SettingsBody server={mode === 'http'} onRename={() => { setSettings(false); setNaming(true) }} />
      </Sheet>
      {mode === 'http' && <NameSheet open={naming} onClose={() => setNaming(false)} />}
      {mode === 'http' && <ReminderSheet open={remind} onClose={() => setRemind(false)} />}
    </div>
  )
}

function Loader() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 1 }}>
      <div className="pop" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 34, letterSpacing: '.12em',
          background: 'linear-gradient(180deg,#fff,var(--gold))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          ENGLISH SPELL
        </div>
        <div style={{ color: 'var(--ink-faint)', marginTop: 8, fontSize: 13 }}>Summoning the realm…</div>
      </div>
    </div>
  )
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

function SettingsBody({ server, onRename }: { server: boolean; onRename: () => void }) {
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
  return (
    <div>
      {server && (
        <div className="set-name">
          <span><small>Your name</small><b>{name === 'Apprentice' ? 'Not chosen yet' : name}</b></span>
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
      {server && <ReminderRow />}
      <Checkbox label="Focus mode: no timers, calm screen" on={focusOn} onChange={setFocusOn} />
      <Toggle label="Sound effects" icon={icSound} on={sound} onChange={set('sound', setSound)} />
      <Toggle label="Music" icon={icMusic} on={music} onChange={(v) => { set('music', setMusic)(v); playMusic(v) }} />
      <Checkbox label="Reduce motion" on={motion} onChange={set('motion', setMotion)} />
      {!server && <button className="btn-candy-red" onClick={reset}>Reset test progress</button>}
    </div>
  )
}

/** Phase D: the daily reminder (English Spell's own Web Push). On = ask + subscribe; off = unsubscribe everywhere */
function ReminderRow() {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { remindersOn().then(setOn).catch(() => setOn(false)) }, [])
  if (!pushSupported()) return (
    <div className="set-name"><span><small>Daily reminder</small><b>Not available in this browser</b></span></div>
  )
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied'
  const flip = async () => {
    if (busy || on == null) return
    setBusy(true); setMsg(null)
    try {
      if (on) { await remindersOff(); setOn(false) }
      else { const ok = await remindersTurnOn(); setOn(ok); if (!ok) setMsg('Your browser blocked it. Allow notifications for this site, then try again.') }
    } catch { setMsg('Could not change it right now. Try again later.') }
    setBusy(false)
  }
  return (
    <div className="set-name">
      <span><small>Daily reminder</small><b>{msg ?? (blocked ? 'Blocked in your browser' : on ? 'On, near your play time' : 'Off')}</b></span>
      <button className="cb cb-white set-name-btn" disabled={busy || on == null} onClick={flip}>{busy ? '…' : on ? 'Turn off' : 'Turn on'}</button>
    </div>
  )
}
