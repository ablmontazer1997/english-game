import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { HeartIcon } from '../components/Icon'
import { Panel, Art } from '../components/PageArt'
import stageBg from '../assets/stage_bg.webp'
import wordCard from '../assets/games/word_card.png'
import icEnergy from '../assets/sky/ic_energy.png'
import icCoin from '../assets/sky/ic_coin.png'
import icHeart from '../assets/sky/ic_heart.png'
import type { Stage, SrsItem, StageResult, ServerQuestion } from '../types/game'
import { gameFor } from '../games/registry'
import { GamePlay } from '../games/GamePlay'
import { useTutorials, useFocusPref, fetchSamples } from '../games/coach'
import { SRS_GAMES, srsOf } from '../services/serverPlay'
import { FocusToggle } from './ServerStage'
import { HintCtx, HINT_COST, type HintFn } from '../games/boosters'
import { BoosterTray } from '../components/BoosterTray'
import '../components/gametitle.css'
import type { MiniGameOutcome } from '../games/types'
import './stage.css'
import { sfx, enterScene, leaveScene, quietStage, VOICE_GAMES } from '../services/audio'

type Phase = 'gate' | 'intro' | 'play' | 'rescue' | 'result'
// the placement test must be fair: no boosters, no rescue
const NO_BOOSTERS = new Set(['oracle-trial'])
// mini-games that paint a full-bleed background paint edge-to-edge (no host padding)
const FULL_BLEED = new Set(['echo', 'rune-type', 'potion-mix', 'curse-breaker', 'spell-weaver', 'crystal-ball', 'bards-tale', 'guild-letters', 'oracle-trial', 'rune-order', 'whisper-scroll', 'tavern-talk', 'gap-gate', 'memory-crystals', 'match-blitz', 'bubble-pop', 'boss-battle'])
const MG_LABEL: Record<string, string> = {
  'oracle-trial': 'Oracle Trial', 'rune-order': 'Rune Order', 'whisper-scroll': 'Whisper Scroll', 'tavern-talk': 'Tavern Talk', 'boss-battle': 'Boss Battle', 'match-blitz': 'Match Blitz', 'bubble-pop': 'Bubble Pop',
  'rune-type': 'Rune Type', 'memory-crystals': 'Memory Crystals', 'gap-gate': 'Gap Gate',
  'spell-weaver': 'Spell Weaver', 'echo': 'Echo Cave', 'portal-run': 'Portal Run', 'potion-mix': 'Potion Mix',
  'curse-breaker': 'Curse Breaker', 'crystal-ball': 'Crystal Ball', 'bards-tale': "Bard's Tale", 'guild-letters': 'Guild Letters',
}

// while a mini-game is on screen its own soundtrack replaces the app theme
function SceneAudio({ id }: { id: string }) {
  useEffect(() => { enterScene(id); return () => leaveScene() }, [id])
  return null
}

export function StageScreen({ stage, onExit, onNeedHearts, previewPhase }: { stage: Stage; onExit: () => void; onNeedHearts: () => void; previewPhase?: Phase }) {
  const { currencies, service, submitResult, spend, drinkElixir, inventory, noteHint } = useGame()
  const hintFn = useRef<HintFn | null>(null)
  const [canHint, setCanHint] = useState(false)
  const [run, setRun] = useState(0) // bump to remount the game for a retry
  const [pending, setPending] = useState<StageResult | null>(null)
  const registerHint = useCallback((fn: HintFn | null) => { hintFn.current = fn; setCanHint(!!fn) }, [])
  const onHint = async () => {
    const fn = hintFn.current
    if (!fn || (currencies?.coins ?? 0) < HINT_COST) return false
    if (!fn()) return false // nothing to hint right now: nothing spent
    const ok = await spend('coins', HINT_COST)
    if (ok) noteHint()
    return ok
  }
  const hearts = currencies?.hearts ?? 0
  const [phase, setPhase] = useState<Phase>(previewPhase ?? (hearts > 0 ? 'intro' : 'gate'))
  const [items, setItems] = useState<SrsItem[]>([])
  const [, setMaxCombo] = useState(0)
  const [result, setResult] = useState<StageResult | null>(previewPhase === 'result'
    ? { stageId: stage.id, correct: 8, total: 10, stars: 3, heartsLost: 0, xpGained: 126, coinsGained: 85 }
    : null)

  // Phase C: previews play real sample items from the server (with their rule / why); the local bank only offline
  const [srv, setSrv] = useState<ServerQuestion[] | undefined>(undefined)
  useEffect(() => {
    let live = true
    fetchSamples(stage.miniGame, stage.cefr ?? 'A1', 5).then((qs) => {
      if (!live) return
      if (qs) { setSrv(qs); setItems(SRS_GAMES.has(stage.miniGame) ? qs.map(srsOf) : qs.map((q) => ({ id: q.qid, front: '', back: '', distractors: [], mastery: 0 }))) }
      else service.getStageItems(stage.id, stage.miniGame).then((x) => live && setItems(x))
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id, stage.miniGame, stage.cefr, service])
  const tuts = useTutorials(undefined, null)
  const [focusPref, setFocusPref] = useFocusPref(undefined, null)
  const [focus, setFocus] = useState(false)
  const [tutOn, setTutOn] = useState(false)
  // speaking / listening games: no music for the whole stage (admin msg 4310)
  useEffect(() => { quietStage(VOICE_GAMES.has(stage.miniGame)); return () => quietStage(false) }, [stage.miniGame])
  // fanfare or a soft sad chord when the result card appears
  useEffect(() => { if (phase === 'result' && result && !previewPhase) sfx(result.stars > 0 ? 'win' : 'lose') }, [phase, result, previewPhase])

  function handleFinish(o: MiniGameOutcome) {
    setMaxCombo(o.maxCombo)
    const total = o.total || 1
    const acc = o.correct / total
    const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : o.correct > 0 ? 1 : 0
    const boosted = (inventory?.xpBoostUntil ?? 0) > Date.now()
    const r: StageResult = {
      stageId: stage.id, correct: o.correct, total,
      stars, heartsLost: stars === 0 ? 1 : 0,
      xpGained: (o.correct * 12 + stars * 10) * (boosted ? 2 : 1), boosted,
      miniGame: stage.miniGame, boss: stage.kind === 'boss',
      coinsGained: o.correct * 5 + stars * 15,
      gemsGained: stage.miniGame === 'oracle-trial' ? 10 : 0,
    }
    // lost the stage but holding an elixir: offer the rescue before any heart is taken
    if (stars === 0 && !NO_BOOSTERS.has(stage.miniGame) && (currencies?.potion ?? 0) > 0) { setPending(r); setPhase('rescue'); return }
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
          {MG_LABEL[stage.miniGame] ?? stage.miniGame.replace(/-/g, ' ')}
        </Panel>
        <h2 className="lobby-title">{stage.title}</h2>
        <p className="lobby-sub">Learn 3 runes, then cast them</p>
        <div className="lobby-cards">
          {items.filter((it) => it.front).slice(0, 3).map((it) => (
            <div className="lobby-card" style={{ backgroundImage: `url(${wordCard})` }} key={it.id}>
              <b>{it.front}</b><span>{it.back}</span>
            </div>
          ))}
        </div>
        <Panel name="btn_gold" className="lobby-start btn-h" inner="lobby-start-in"
          disabled={!items.length} onClick={() => { if (items.length) { setFocus(focusPref); setPhase('play') } }}>
          Start
        </Panel>
        <FocusToggle on={focusPref} set={setFocusPref} />
      </div>
    </div>
  )

  if (phase === 'rescue' && pending) return (
    <div className="stage-host full">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <div className="rescue-wrap"><div className="rescue pop">
        <div className="rescue-ic">🧪</div>
        <h2>Stage lost</h2>
        <p>Drink an elixir to try again and keep your heart. You have {currencies?.potion ?? 0}.</p>
        <button className="cb cb-violet" onClick={async () => { if (await drinkElixir()) { setPending(null); setRun((n) => n + 1); setPhase('play') } }}>Use Elixir</button>
        <button className="cb cb-white" onClick={() => { setResult(pending); setPending(null); setPhase('result'); submitResult(pending) }}>Give up (−1 ❤️)</button>
      </div></div>
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
          <span className="rwd"><img src={icEnergy} alt="" /><b>{result.xpGained}</b><small>{result.boosted ? 'XP ×2' : 'XP'}</small></span>
          <span className="rwd"><img src={icCoin} alt="" /><b>{result.coinsGained}</b></span>
          {!!result.gemsGained && <span className="rwd"><b>💎 {result.gemsGained}</b></span>}
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
    <div className={`stage-host full${focus ? ' focus' : ''}${tutOn ? ' tut-on' : ''}`}>
      <div className="sky" />
      <SceneAudio id={stage.miniGame} />
      <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
      <div className="play-top">
        <div className="play-hearts"><img src={icHeart} alt="" /><b>{hearts}</b></div>
      </div>
      {items.length
        ? <HintCtx.Provider value={registerHint}>
          <GamePlay Game={Game} game={stage.miniGame} gameKey={String(run)} bleed={FULL_BLEED.has(stage.miniGame)} cefr={stage.cefr}
            props={{ items, srv, world: stage.paint, onFinish: handleFinish, level: Math.max(0, ['A1', 'A2', 'B1', 'B2', 'C1'].indexOf(stage.cefr ?? 'A1')) }}
            focus={focus} need={tuts.need} mark={tuts.mark} onTut={setTutOn}
            tray={(help) => NO_BOOSTERS.has(stage.miniGame) ? null
              : <BoosterTray coins={currencies?.coins ?? 0} elixirs={currencies?.potion ?? 0} canHint={canHint} onHint={onHint} onHelp={help} />} />
        </HintCtx.Provider>
        : <div className="game-host"><div className="game-wait">…</div></div>}
    </div>
  )
}
