import { Suspense, useEffect, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { HeartIcon } from '../components/Icon'
import { Panel, Art } from '../components/PageArt'
import stageBg from '../assets/stage_bg.webp'
import wordCard from '../assets/games/word_card.png'
import icEnergy from '../assets/sky/ic_energy.png'
import icCoin from '../assets/sky/ic_coin.png'
import icHeart from '../assets/sky/ic_heart.png'
import type { Stage, SrsItem, StageResult } from '../types/game'
import { gameFor } from '../games/registry'
import type { MiniGameOutcome } from '../games/types'
import './stage.css'

type Phase = 'gate' | 'intro' | 'play' | 'result'
// mini-games that paint a full-bleed background paint edge-to-edge (no host padding)
const FULL_BLEED = new Set(['gap-gate', 'memory-crystals', 'match-blitz', 'bubble-pop'])
const MG_LABEL: Record<string, string> = {
  'boss-battle': 'Boss Battle', 'match-blitz': 'Match Blitz', 'bubble-pop': 'Bubble Pop',
  'rune-type': 'Rune Type', 'memory-crystals': 'Memory Crystals', 'gap-gate': 'Gap Gate',
  'spell-weaver': 'Spell Weaver', 'echo': 'Echo', 'portal-run': 'Portal Run', 'potion-mix': 'Potion Mix',
}

export function StageScreen({ stage, onExit, onNeedHearts, previewPhase }: { stage: Stage; onExit: () => void; onNeedHearts: () => void; previewPhase?: Phase }) {
  const { currencies, service, submitResult } = useGame()
  const hearts = currencies?.hearts ?? 0
  const [phase, setPhase] = useState<Phase>(previewPhase ?? (hearts > 0 ? 'intro' : 'gate'))
  const [items, setItems] = useState<SrsItem[]>([])
  const [, setMaxCombo] = useState(0)
  const [result, setResult] = useState<StageResult | null>(previewPhase === 'result'
    ? { stageId: stage.id, correct: 8, total: 10, stars: 3, heartsLost: 0, xpGained: 126, coinsGained: 85 }
    : null)

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
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
      <div className="lobby pop">
        <Panel name="ribbon_gold" className="lobby-tag" inner="lobby-tag-in">
          {MG_LABEL[stage.miniGame] ?? stage.miniGame}
        </Panel>
        <h2 className="lobby-title">{stage.title}</h2>
        <p className="lobby-sub">Learn 3 runes, then cast them</p>
        <div className="lobby-cards">
          {items.slice(0, 3).map((it) => (
            <div className="lobby-card" style={{ backgroundImage: `url(${wordCard})` }} key={it.id}>
              <b>{it.front}</b><span>{it.back}</span>
            </div>
          ))}
        </div>
        <Panel name="btn_gold" className="lobby-start btn-h" inner="lobby-start-in"
          disabled={!items.length} onClick={() => items.length && setPhase('play')}>
          Start
        </Panel>
      </div>
    </div>
  )

  if (phase === 'result' && result) return (
    <div className="stage-host full">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <div className="result pop">
        <div className="result-stars">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`rstar s${i} ${i < result.stars ? 'on' : ''}`} style={{ animationDelay: `${i * 150}ms` }}>
              <Art name="qi_star" />
            </span>
          ))}
        </div>
        <h2 className="result-title">{result.stars === 3 ? 'Perfect!' : result.stars >= 1 ? 'Nice!' : 'Try again'}</h2>
        <p className="result-sub">{result.correct} of {result.total} runes cast</p>
        <div className="result-rewards">
          <span className="rwd"><img src={icEnergy} alt="" /><b>{result.xpGained}</b><small>XP</small></span>
          <span className="rwd"><img src={icCoin} alt="" /><b>{result.coinsGained}</b></span>
        </div>
        <Art name="chest_open" className="result-chest" />
        <Panel name="btn_gold" className="result-continue btn-h" inner="lobby-start-in" onClick={onExit}>
          Continue
        </Panel>
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
        <div className="play-hearts"><img src={icHeart} alt="" /><b>{hearts}</b></div>
        <span className="play-mg">{MG_LABEL[stage.miniGame] ?? stage.miniGame}</span>
      </div>
      <div className={`game-host${FULL_BLEED.has(stage.miniGame) ? ' bleed' : ''}`}>
        {items.length
          ? <Suspense fallback={<div className="game-wait">…</div>}><Game items={items} onFinish={handleFinish} /></Suspense>
          : <div className="game-wait">…</div>}
      </div>
    </div>
  )
}
