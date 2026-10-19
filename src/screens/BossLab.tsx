// Boss Lab (admin 5915, 10-19): a test bench for every world's Boss Battle inside the real app.
// Opens with ?mock=1&bosslab=1 (optional &w=1..11, &wand=<id>). Mock mode only: the local test save is used, so the
// real account's hearts, coins and results are never touched and nothing is posted. It mounts the REAL stage flow
// (StageScreen -> GamePlay -> BossBattle with the world's boss, arena, gate and weapon, the 3D hero iframe, the result
// card) and only adds a bar on top: boss picker + prev/next, wand picker (sent to the hero page as rc-wand, never
// written to localStorage), restart, and a small health readout (3D hero ready time, page errors).
import { useEffect, useRef, useState } from 'react'
import { StageScreen } from './StageScreen'
import { useGame } from '../services/ServiceProvider'
import type { Stage } from '../types/game'
import './bosslab.css'

// the 11 world bosses in BossBattle.tsx BOSSES (0-based world = paint index); keep the names in step with it
const BOSSES = ['Bramblehorn Beast', 'Geode Guardian', 'Tome Tyrant', 'Thornroot Brute', 'Toadstool Troll', 'Eclipse Sentinel',
  'Frostfang Yeti', 'Cinder Drake', 'Rune Colossus', 'Gargoyle Proctor', 'Nebula Titan']
// the hero page's WANDS (runecast-hero index.html)
const WANDS = ['wand_starter', 'wand_classic', 'wand_forest', 'wand_frost', 'wand_fire', 'wand_sea', 'wand_stars', 'wand_sun', 'wand_shadow', 'wand_royal']
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

const qs = () => new URLSearchParams(location.search)
const clampW = (n: number) => ((n % 11) + 11) % 11
function initialWand() {
  const q = qs().get('wand')
  if (q && WANDS.includes(q)) return q
  try { const v = localStorage.getItem('wand'); if (v && WANDS.includes(v)) return v } catch { /* private mode */ }
  return 'wand_starter'
}

export function BossLab() {
  const { refillHearts, currencies } = useGame()
  const [w, setW] = useState(() => { const n = +(qs().get('w') ?? 1); return Number.isFinite(n) ? clampW(n - 1) : 0 })
  const [wand, setWand] = useState(initialWand)
  const [lv, setLv] = useState(() => { const l = qs().get('lv'); return l && LEVELS.includes(l) ? l : 'A1' })
  const [run, setRun] = useState(0)
  const [ready, setReady] = useState<number | null>(null)
  const [errs, setErrs] = useState<string[]>([])
  const t0 = useRef(performance.now())
  const wandRef = useRef(wand); wandRef.current = wand

  // keep the choice in the URL (reload = same boss / wand)
  useEffect(() => {
    const p = qs(); p.set('w', String(w + 1)); p.set('wand', wand); p.set('lv', lv)
    history.replaceState(null, '', `${location.pathname}?${p}`)
  }, [w, wand, lv])

  // a new battle: reset the readout; the mock save gets its hearts back so the battle never stops at "Out of Hearts"
  useEffect(() => {
    t0.current = performance.now(); setReady(null); setErrs([])
    if ((currencies?.hearts ?? 1) <= 0) refillHearts().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, run, lv])

  const heroWin = () => (document.querySelector('iframe.bb2-hero3d') as HTMLIFrameElement | null)?.contentWindow ?? null
  // the hero page says rc-ready: give it the chosen wand and watch its errors too
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const hw = heroWin()
      if (!hw || e.source !== hw || e.data?.type !== 'rc-ready') return
      setReady((r) => r ?? (performance.now() - t0.current) / 1000)
      hw.postMessage({ type: 'rc-wand', id: wandRef.current }, '*')
      try {
        const x = hw as Window & { __bossLab?: boolean }
        if (!x.__bossLab) { x.__bossLab = true; x.addEventListener('error', (ev) => setErrs((a) => [...a, 'hero: ' + (ev.message || 'error')])) }
      } catch { /* cross-origin: not expected */ }
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [])
  useEffect(() => { heroWin()?.postMessage({ type: 'rc-wand', id: wand }, '*') }, [wand])

  // page errors while the lab is open (window errors, unhandled rejections, console.error)
  useEffect(() => {
    const add = (s: string) => setErrs((a) => (a.length > 30 ? a : [...a, s]))
    const onErr = (e: ErrorEvent) => add(e.message || 'error')
    const onRej = (e: PromiseRejectionEvent) => add('promise: ' + String(e.reason?.message ?? e.reason))
    const ce = console.error
    console.error = (...a: unknown[]) => { add(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ').slice(0, 200)); ce.apply(console, a) }
    addEventListener('error', onErr); addEventListener('unhandledrejection', onRej)
    return () => { console.error = ce; removeEventListener('error', onErr); removeEventListener('unhandledrejection', onRej) }
  }, [])

  const stage: Stage = { id: `bosslab-w${w + 1}`, index: 1, kind: 'boss', status: 'current', stars: 0, miniGame: 'boss-battle',
    title: BOSSES[w], paint: w, cefr: lv } as Stage
  const restart = () => setRun((n) => n + 1)

  return (
    <div className="app-frame bosslab">
      <div className="bl-bar" data-focus-keep="">
        <button className="bl-btn" onClick={() => setW((x) => clampW(x - 1))} aria-label="Previous boss">‹</button>
        <select className="bl-sel bl-boss" value={w} onChange={(e) => setW(+e.target.value)} aria-label="Boss">
          {BOSSES.map((n, i) => <option key={n} value={i}>{`W${i + 1} ${n}`}</option>)}
        </select>
        <button className="bl-btn" onClick={() => setW((x) => clampW(x + 1))} aria-label="Next boss">›</button>
        <button className="bl-btn bl-go" onClick={restart} aria-label="Restart battle">↻</button>
      </div>
      <div className="bl-bar bl-bar2" data-focus-keep="">
        <select className="bl-sel" value={wand} onChange={(e) => setWand(e.target.value)} aria-label="Wand">
          {WANDS.map((id) => <option key={id} value={id}>{id.replace('wand_', 'Wand: ')}</option>)}
        </select>
        <select className="bl-sel bl-lv" value={lv} onChange={(e) => setLv(e.target.value)} aria-label="Question level">
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className={`bl-st${ready != null ? ' ok' : ''}`} title="3D hero">{ready != null ? `3D ✓ ${ready.toFixed(1)}s` : '3D …'}</span>
        <span className={`bl-st${errs.length ? ' bad' : ' ok'}`} title={errs.join('\n') || 'no errors'}
          onClick={() => errs.length && alert(errs.join('\n\n'))}>{errs.length ? `${errs.length} err` : '0 err'}</span>
      </div>
      <div className="bl-stage" data-boss={w + 1} data-ready={ready != null ? '1' : '0'} data-errs={errs.length}>
        <div className="sky" />
        <StageScreen key={`${w}-${run}-${lv}`} stage={stage} previewPhase="play" onExit={restart}
          onNeedHearts={() => { refillHearts().catch(() => {}).finally(restart) }} />
      </div>
    </div>
  )
}
