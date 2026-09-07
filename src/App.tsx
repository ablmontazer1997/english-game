import { useState } from 'react'
import { useGame } from './services/ServiceProvider'
import { HUD } from './components/HUD'
import { BottomNav, type Tab } from './components/BottomNav'
import { Sheet } from './components/Sheet'
import { Toggle, Checkbox } from './components/Controls'
import { MapScreen } from './screens/MapScreen'
import { QuestsScreen } from './screens/QuestsScreen'
import { LeagueScreen } from './screens/LeagueScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { ShopSheet } from './screens/ShopSheet'
import { ShopScreen } from './screens/ShopScreen'
import { StageScreen } from './screens/StageScreen'
import { CharacterScreen } from './screens/CharacterScreen'
import type { CurrencyId, Stage, MiniGameId } from './types/game'

export function App() {
  const { ready, quests } = useGame()
  const initialTab = (typeof location !== 'undefined'
    ? (new URLSearchParams(location.search).get('tab') as Tab | null) : null) || 'map'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [shop, setShop] = useState<CurrencyId | null>(null)
  const [settings, setSettings] = useState(false)
  const [playing, setPlaying] = useState<Stage | null>(null)
  const [customizing, setCustomizing] = useState(false)

  const questBadge = ready && quests.some((q) => q.progress >= q.target && !q.done)

  // dev preview: ?screen=character opens the mage customizer directly
  const previewScreen = typeof location !== 'undefined'
    ? new URLSearchParams(location.search).get('screen') : null
  if (ready && previewScreen === 'character') {
    return <div className="app-frame"><div className="sky" /><CharacterScreen onClose={() => { location.search = '' }} /></div>
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
        <Loader />
      ) : customizing ? (
        <CharacterScreen onClose={() => setCustomizing(false)} />
      ) : playing ? (
        <StageScreen stage={playing} onExit={() => setPlaying(null)} onNeedHearts={() => setShop('hearts')} />
      ) : (
        <>
          <HUD onBuy={setShop} onSettings={() => setSettings(true)} />

          {tab === 'map' && <MapScreen onPlay={setPlaying} />}
          {tab === 'quests' && <QuestsScreen />}
          {tab === 'shop' && <ShopScreen />}
          {tab === 'league' && <LeagueScreen />}
          {tab === 'profile' && <ProfileScreen onBuy={setShop} onCustomize={() => setCustomizing(true)} />}

          <BottomNav tab={tab} onChange={setTab} badge={{ quests: questBadge }} />
        </>
      )}

      <ShopSheet currency={shop} onClose={() => setShop(null)} />

      <Sheet open={settings} title="Settings" onClose={() => setSettings(false)}>
        <SettingsBody />
      </Sheet>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 1 }}>
      <div className="pop" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 34, letterSpacing: '.12em',
          background: 'linear-gradient(180deg,#fff,var(--gold))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          RUNECAST
        </div>
        <div style={{ color: 'var(--ink-faint)', marginTop: 8, fontSize: 13 }}>Summoning the realm…</div>
      </div>
    </div>
  )
}

function SettingsBody() {
  const load = (k: string, d: boolean) => { try { const v = localStorage.getItem('rc.set.' + k); return v == null ? d : v === '1' } catch { return d } }
  const save = (k: string, v: boolean) => { try { localStorage.setItem('rc.set.' + k, v ? '1' : '0') } catch {} }
  const [sound, setSound] = useState(() => load('sound', true))
  const [music, setMusic] = useState(() => load('music', true))
  const [motion, setMotion] = useState(() => load('motion', false))
  const set = (k: string, sv: (v: boolean) => void) => (v: boolean) => { sv(v); save(k, v) }
  const reset = () => { try { localStorage.removeItem('runecast.save.v1') } catch {} location.reload() }
  return (
    <div style={{ color: 'var(--ink-soft)' }}>
      <Toggle label="Sound effects" on={sound} onChange={set('sound', setSound)} />
      <Toggle label="Music" on={music} onChange={set('music', setMusic)} />
      <Checkbox label="Reduce motion" on={motion} onChange={set('motion', setMotion)} />
      <button onClick={reset} style={{
        marginTop: 16, padding: '10px 14px', borderRadius: 'var(--r-md)', width: '100%',
        background: 'rgba(255,93,108,.12)', border: '1px solid rgba(255,93,108,.35)', color: '#ffd0d5', fontWeight: 700, fontSize: 13,
      }}>Reset test progress</button>
    </div>
  )
}
