import { Suspense, useEffect, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { HeartIcon, StarIcon, CoinIcon, BoltIcon } from '../components/Icon'
import type { Stage, SrsItem, StageResult } from '../types/game'
import { gameFor } from '../games/registry'
import type { MiniGameOutcome } from '../games/types'
import './stage.css'

type Phase = 'gate' | 'intro' | 'play' | 'result'
const MG_LABEL: Record<string, string> = {
  'boss-battle': 'Boss Battle', 'match-blitz': 'Match Blitz', 'bubble-pop': 'Bubble Pop',
  'rune-type': 'Rune Type', 'memory-crystals': 'Memory Crystals', 'gap-gate': 'Gap Gate',
  'spell-weaver': 'Spell Weaver', 'echo': 'Echo', 'portal-run': 'Portal Run', 'potion-mix': 'Potion Mix',
}

export function StageScreen({ stage, onExit, onNeedHearts }: { stage: Stage; onExit: () => void; onNeedHearts: () => void }) {
  const { currencies, service, submitResult } = useGame()
  const hearts = currencies?.hearts ?? 0
  const [phase, setPhase] = useState<Phase>(hearts > 0 ? 'intro' : 'gate')
  const [items, setItems] = useState<SrsItem[]>([])
  const [maxCombo, setMaxCombo] = useState(0)
  const [result, setResult] = useState<StageResult | null>(null)

  useEffect(() => { service.getStageItems(stage.id, stage.miniGame).then(setItems) }, [stage, service])

  function handleFinish(o: MiniGameOutcome) {
    setMaxCombo(o.maxCombo)
    const total = o.total || 1
    const acc = o.correct / total
    const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : o.correct > 0 ? 1 : 0
    const r: StageResult = {
      stageId: stage.id, correct: o.correct, total,
      stars, heartsLost: stars === 0 ? 1 : 0,
      xpGained: o.correct * 12 + stars * 10,
      coinsGained: o.correct * 5 + stars * 15,
    }
    setResult(r); setPhase('result'); submitResult(r)
  }

  // ---- render ----
  if (phase === 'gate') return (
    <div className="stage-host full">
      <div className="sky" />
      <div className="gate-card pop">
        <div className="gate-heart"><HeartIcon size={44} /></div>
        <h2>Out of Hearts</h2>
        <p>You need a heart to play this stage. Refill or wait for them to recharge.</p>
        <button className="btn btn-gold big" onClick={onNeedHearts}>Get Hearts</button>
        <button className="btn btn-ghost big" onClick={onExit}>Back to Map</button>
      </div>
    </div>
  )

  if (phase === 'intro') return (
    <div className="stage-host full">
      <div className="sky" />
      <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
      <div className="intro-card pop">
        <span className="mg-tag">{MG_LABEL[stage.miniGame] ?? stage.miniGame}</span>
        <h2>{stage.title}</h2>
        <p>Study 3 words for this stage, then use them in the game.</p>
        <div className="teach-list">
          {items.slice(0, 3).map((it) => (
            <div className="teach-row" key={it.id}><b>{it.front}</b><span>{it.back}</span></div>
          ))}
        </div>
        <button className="btn btn-cyan big" disabled={!items.length} onClick={() => setPhase('play')}>Start</button>
      </div>
    </div>
  )

  if (phase === 'result' && result) return (
    <div className="stage-host full">
      <div className="sky" />
      <div className="result-card pop">
        <div className="result-stars">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`rstar ${i < result.stars ? 'on' : ''}`} style={{ animationDelay: `${i * 140}ms` }}>
              <StarIcon size={i === 1 ? 62 : 50} />
            </span>
          ))}
        </div>
        <h2>{result.stars === 3 ? 'Perfect!' : result.stars >= 1 ? 'Nice!' : 'Try again'}</h2>
        <p>{result.correct} of {result.total} correct · Best combo: {maxCombo}</p>
        <div className="reward-row">
          <span className="rw"><BoltIcon size={18} />{result.xpGained} XP</span>
          <span className="rw"><CoinIcon size={18} />{result.coinsGained}</span>
        </div>
        <button className="btn btn-gold big" onClick={onExit}>Continue</button>
      </div>
    </div>
  )

  // play — dispatch to the mini-game for this stage
  const Game = gameFor(stage.miniGame)
  return (
    <div className="stage-host full">
      <div className="sky" />
      <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
      <div className="play-top">
        <div className="play-hearts"><HeartIcon size={18} /><b>{hearts}</b></div>
        <span className="play-mg">{MG_LABEL[stage.miniGame] ?? stage.miniGame}</span>
      </div>
      <div className="game-host">
        {items.length
          ? <Suspense fallback={<div className="game-wait">…</div>}><Game items={items} onFinish={handleFinish} /></Suspense>
          : <div className="game-wait">…</div>}
      </div>
    </div>
  )
}
