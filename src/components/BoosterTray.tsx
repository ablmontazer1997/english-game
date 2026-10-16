import { useEffect, useRef, useState } from 'react'
import icCoin from '../assets/sky/ic_coin.png'
import { HINT_COST } from '../games/boosters'
import './boostertray.css'

/** The same two boosters, in the same spot, in every mini-game:
 *  💡 hint (paid in coins, applied by the game) and 🧪 elixir (count; spent on
 *  the rescue step when a stage is lost, so the heart is kept). */
export function BoosterTray({ coins, elixirs, canHint, onHint, free, freeLeft, cost = HINT_COST, onHelp }: {
  coins: number; elixirs: number; canHint: boolean; onHint: () => Promise<boolean>
  /** hints are not charged at all (old server stages) */
  free?: boolean
  /** Phase B server stages: free hints left today (3 a day), then `cost` coins each (the server charges) */
  freeLeft?: number; cost?: number
  /** Phase C: "?" replays this game's tutorial (null while it plays) */
  onHelp?: (() => void) | null
}) {
  const [tip, setTip] = useState('')
  const el = useRef<HTMLDivElement>(null)
  useTrayPlacement(el)
  const [pulse, setPulse] = useState(false)
  const say = (t: string) => { setTip(t); setTimeout(() => setTip(''), 2200) }

  async function hint() {
    if (!canHint) return say('No hint in this game')
    const paid = !free && !(freeLeft && freeLeft > 0)
    if (paid && coins < cost) return say(`A hint costs ${cost} coins`)
    const used = await onHint()
    if (!used) return say('Nothing to hint right now')
    setPulse(true); setTimeout(() => setPulse(false), 500)
  }

  return (
    <div className="bt" ref={el} aria-label="Boosters">
      {onHelp !== undefined && (
        <button className={`bt-btn bt-help${onHelp ? '' : ' off'}`} onClick={() => onHelp?.()} aria-label="How to play">
          <span className="bt-ic bt-q">?</span>
        </button>
      )}
      <button className={`bt-btn bt-hint${pulse ? ' pulse' : ''}${canHint ? '' : ' off'}`} onClick={hint}
        aria-label={free ? 'Hint, free' : freeLeft && freeLeft > 0 ? `Hint, ${freeLeft} free today` : `Hint, ${cost} coins`}>
        <span className="bt-ic">💡</span>
        {free ? <span className="bt-cost">free</span>
          : freeLeft && freeLeft > 0 ? <span className="bt-cost">free ×{freeLeft}</span>
            : <span className="bt-cost"><img src={icCoin} alt="" />{cost}</span>}
      </button>
      <button className="bt-btn bt-elixir" onClick={() => say(free || freeLeft !== undefined ? 'Lose a trial, boss or vault? An elixir buys 3 more questions or keeps your heart' : 'Lose a stage? An elixir lets you retry and keep your heart')} aria-label={`Elixirs: ${elixirs}`}>
        <span className="bt-ic">🧪</span>
        <span className="bt-count">{elixirs}</span>
      </button>
      {tip && <div className="bt-tip">{tip}</div>}
    </div>
  )
}

// admin 4351 / coordinator 10-08: the tray must never sit on a panel, a label or a button. It stays on the right edge and
// slides to the free gap nearest its usual spot (38% down); if no vertical gap is tall enough it lies flat (two buttons
// side by side) in the largest gap. Re-checked on resize and once a second, because rounds change the layout.
const OBSTACLES = '.gs-panel,.lp,.gtask,button:not(.bt-btn),.ws-scroll,.gg-tablet,.ot-q,.ot-opts,.tt-msg,.mc-card,.mc-stat,.mb-board,.mb-tbar,'
  + 'input,textarea,.ro-slots,.gs-pill,.gs-chip,.gt-ribbon,.gt-count,.bp-ring,.play-top,.swv-slot'
  // audit 10-11 P0: the bubble field (bubbles are drawn on a canvas, so the field itself is the obstacle; it leaves a
  // free strip at the bottom for the tray), the Match Blitz combo header and the Guild Letters letter
  + ',.bp-field,.mb-combo,.gl-letter,.bb2-hp,.cbk-locked,.pm-slot,.pm-tag,.pm-word'
function useTrayPlacement(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const place = () => {
      const bt = ref.current, host = bt?.offsetParent as HTMLElement | null
      if (!bt || !host) return
      const H = host.getBoundingClientRect()
      bt.classList.remove('flat', 'sm', 'cmp'); bt.style.removeProperty('--bt-s')
      const vert = { w: bt.offsetWidth, h: bt.offsetHeight + 12 }
      bt.classList.add('flat'); const flat = { w: bt.offsetWidth + 6, h: bt.offsetHeight + 12 }
      bt.classList.remove('flat')
      // the stage X sits outside the host: the tray (and its top gem) starts below it (coordinator 10-12, Guild Letters)
      const xr = document.querySelector('.stage-close')?.getBoundingClientRect()
      const top0 = Math.max(8, xr && xr.width ? xr.bottom - H.top + 16 : 8), bot = H.height - 8, pref = H.height * 0.38
      const gaps = (w: number) => {
        const x0 = H.right - 8 - w - 4
        const ys: [number, number][] = []
        for (const e of host.querySelectorAll<HTMLElement>(OBSTACLES)) {
          if (bt.contains(e)) continue
          // the game-name intro ribbon is a passing overlay (1.9 s), not a layout obstacle: it used to push the tray flat at first paint
          if (e.closest('.gt-intro')) continue
          const r = e.getBoundingClientRect()
          if (!r.width || !r.height || r.right < x0 || r.left > H.right) continue
          const cs = getComputedStyle(e)
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
          // the painted Whisper scroll's rollers and the Guild letter's parchment reach past their boxes: keep a wider gap (coordinator 10-12)
          const pad = e.matches('.ws-scroll,.gl-letter') ? 16 : 6
          ys.push([r.top - H.top - pad, r.bottom - H.top + pad])
        }
        ys.sort((a, b) => a[0] - b[0])
        const out: [number, number][] = []; let y = top0
        for (const [a, b] of ys) { if (a > y) out.push([y, a]); y = Math.max(y, b) }
        if (bot > y) out.push([y, bot])
        return out
      }
      const fit = (g: [number, number][], h: number) => {
        let best: number | null = null
        for (const [a, b] of g) {
          if (b - a < h) continue
          const t = Math.min(Math.max(pref, a), b - h)
          if (best == null || Math.abs(t - pref) < Math.abs(best - pref)) best = t
        }
        return best
      }
      // coordinator 10-12: the upright capsule on the right edge is preferred in every game; when the full size does not
      // fit a gap, a slightly smaller upright capsule is tried before the tray lies flat, but never below 44px tap targets
      const btn = bt.querySelector<HTMLElement>('.bt-btn')?.offsetWidth || 48
      const upright = (v: { w: number; h: number }) => {
        for (const k of [1, .96, .92].filter((x) => btn * x >= 44)) {
          const t = fit(gaps(v.w * k), (v.h - 12) * k + 12)
          if (t == null) continue
          if (k < 1) { bt.classList.add('sm'); bt.style.setProperty('--bt-s', String(k)) }
          bt.style.top = `${Math.round(t)}px`; return true
        }
        return false
      }
      if (upright(vert)) return
      // admin 5838: in Bard's Tale, before lying flat, try the upright capsule with the buttons closer together (.cmp);
      // the other games keep their current placement
      if (host.querySelector('.bdt')) {
        bt.classList.add('cmp')
        if (upright({ w: bt.offsetWidth, h: bt.offsetHeight + 12 })) return
        bt.classList.remove('cmp')
      }
      let t: number | null
      t = fit(gaps(flat.w), flat.h)
      if (t != null) { bt.classList.add('flat'); bt.style.top = `${Math.round(t)}px` }
    }
    // coordinator 10-12: the tray stays hidden until the game has laid out (two frames + 350 ms), so it never shows in a
    // wrong spot (e.g. lying flat over the boss) on the first paint; then it is placed again once a second as before
    const bt0 = ref.current; bt0?.classList.add('bt-wait')
    let r1 = 0, r2 = 0
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(place) })
    const t0 = window.setTimeout(() => { place(); bt0?.classList.remove('bt-wait') }, 350)
    const id = window.setInterval(place, 1000)
    window.addEventListener('resize', place)
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t0); window.clearInterval(id); window.removeEventListener('resize', place) }
  }, [ref])
}
