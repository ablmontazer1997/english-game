import { useState } from 'react'
import icCoin from '../assets/sky/ic_coin.png'
import { HINT_COST } from '../games/boosters'
import './boostertray.css'

/** The same two boosters, in the same spot, in every mini-game:
 *  💡 hint (paid in coins, applied by the game) and 🧪 elixir (count; spent on
 *  the rescue step when a stage is lost, so the heart is kept). */
export function BoosterTray({ coins, elixirs, canHint, onHint }: {
  coins: number; elixirs: number; canHint: boolean; onHint: () => Promise<boolean>
}) {
  const [tip, setTip] = useState('')
  const [pulse, setPulse] = useState(false)
  const say = (t: string) => { setTip(t); setTimeout(() => setTip(''), 2200) }

  async function hint() {
    if (!canHint) return say('No hint in this game')
    if (coins < HINT_COST) return say(`A hint costs ${HINT_COST} coins`)
    const used = await onHint()
    if (!used) return say('Nothing to hint right now')
    setPulse(true); setTimeout(() => setPulse(false), 500)
  }

  return (
    <div className="bt" aria-label="Boosters">
      <button className={`bt-btn${pulse ? ' pulse' : ''}${canHint ? '' : ' off'}`} onClick={hint} aria-label={`Hint, ${HINT_COST} coins`}>
        <span className="bt-ic">💡</span>
        <span className="bt-cost"><img src={icCoin} alt="" />{HINT_COST}</span>
      </button>
      <button className="bt-btn" onClick={() => say('Lose a stage? An elixir lets you retry and keep your heart')} aria-label={`Elixirs: ${elixirs}`}>
        <span className="bt-ic">🧪</span>
        <span className="bt-count">{elixirs}</span>
      </button>
      {tip && <div className="bt-tip">{tip}</div>}
    </div>
  )
}
