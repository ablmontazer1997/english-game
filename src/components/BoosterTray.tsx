import { useEffect, useRef, useState } from 'react'
import icCoin from '../assets/sky/ic_coin.png'
import { HINT_COST } from '../games/boosters'
import './boostertray.css'

/** The same two boosters, in the same spot, in every mini-game:
 *  💡 hint (paid in coins, applied by the game) and 🧪 elixir (count; spent on
 *  the rescue step when a stage is lost, so the heart is kept). */
export function BoosterTray({ coins, elixirs, canHint, onHint, free }: {
  coins: number; elixirs: number; canHint: boolean; onHint: () => Promise<boolean>
  /** server stages: hints are not charged (the server counts them per session) */
  free?: boolean
}) {
  const [tip, setTip] = useState('')
  const el = useRef<HTMLDivElement>(null)
  useTrayPlacement(el)
  const [pulse, setPulse] = useState(false)
  const say = (t: string) => { setTip(t); setTimeout(() => setTip(''), 2200) }

  async function hint() {
    if (!canHint) return say('No hint in this game')
    if (!free && coins < HINT_COST) return say(`A hint costs ${HINT_COST} coins`)
    const used = await onHint()
    if (!used) return say('Nothing to hint right now')
    setPulse(true); setTimeout(() => setPulse(false), 500)
  }

  return (
    <div className="bt" ref={el} aria-label="Boosters">
      <button className={`bt-btn${pulse ? ' pulse' : ''}${canHint ? '' : ' off'}`} onClick={hint} aria-label={`Hint, ${HINT_COST} coins`}>
        <span className="bt-ic">💡</span>
        {free ? <span className="bt-cost">free</span> : <span className="bt-cost"><img src={icCoin} alt="" />{HINT_COST}</span>}
      </button>
      <button className="bt-btn" onClick={() => say(free ? 'Lose a boss or vault? An elixir keeps your heart' : 'Lose a stage? An elixir lets you retry and keep your heart')} aria-label={`Elixirs: ${elixirs}`}>
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
function useTrayPlacement(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const place = () => {
      const bt = ref.current, host = bt?.offsetParent as HTMLElement | null
      if (!bt || !host) return
      const H = host.getBoundingClientRect()
      bt.classList.remove('flat'); const vert = { w: bt.offsetWidth, h: bt.offsetHeight + 12 }
      bt.classList.add('flat'); const flat = { w: bt.offsetWidth + 6, h: bt.offsetHeight + 12 }
      bt.classList.remove('flat')
      const top0 = 8, bot = H.height - 8, pref = H.height * 0.38
      const gaps = (w: number) => {
        const x0 = H.right - 8 - w - 4
        const ys: [number, number][] = []
        for (const e of host.querySelectorAll<HTMLElement>(OBSTACLES)) {
          if (bt.contains(e)) continue
          const r = e.getBoundingClientRect()
          if (!r.width || !r.height || r.right < x0 || r.left > H.right) continue
          const cs = getComputedStyle(e)
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
          ys.push([r.top - H.top - 6, r.bottom - H.top + 6])
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
      let t = fit(gaps(vert.w), vert.h)
      if (t != null) { bt.style.top = `${Math.round(t)}px` ; return }
      t = fit(gaps(flat.w), flat.h)
      if (t != null) { bt.classList.add('flat'); bt.style.top = `${Math.round(t)}px` }
    }
    place()
    const id = window.setInterval(place, 1000)
    window.addEventListener('resize', place)
    return () => { window.clearInterval(id); window.removeEventListener('resize', place) }
  }, [ref])
}
