// Phase C: one mini-game round inside a stage, with what every game shares around it: the wrong-answer card, the
// first-time tutorial (spotlight -> ghost hand demo -> one untimed practice item -> "now for real"), the "?" replay
// and Focus mode. Used by ServerStage (live) and StageScreen (mock previews).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import type { MiniGameProps } from './types'
import '../components/es2kit.css'
import type { MiniGameId, ServerQuestion } from '../types/game'
import { SRS_GAMES, srsOf } from '../services/serverPlay'
import { HintCtx } from './boosters'
import { StageCtlCtx, useWrongCard, fetchSamples, Spotlight, FocusVeil, TutBanner, TutReady, Countdown, TIMED, type StageCtl, type TutStep } from './coach'

type Tut = { step: TutStep; qs: ServerQuestion[] | null | undefined; n: number; replay: boolean }

export function GamePlay({ Game, game, gameKey, props, bleed, cefr, focus, need, mark, onTut, tray }: {
  Game: ComponentType<MiniGameProps>
  game: MiniGameId
  /** changes when a new round (or a retry) mounts */
  gameKey: string
  props: MiniGameProps
  bleed: boolean
  cefr?: string
  focus: boolean
  need: (game: string) => boolean
  mark: (game: string) => void
  /** the tutorial is on screen (the host lifts its close button above the dim) */
  onTut?: (on: boolean) => void
  /** the booster tray, given the "?" replay */
  tray: (help: (() => void) | null) => ReactNode
}) {
  const { open, wrong, el: card } = useWrongCard()
  const [tut, setTut] = useState<Tut | null>(null)
  const runs = useRef(0)
  const wrap = useRef<HTMLDivElement>(null)
  const pracHost = useRef<HTMLDivElement>(null)
  const realHost = useRef<HTMLDivElement>(null)

  const start = useCallback((replay: boolean) => {
    const n = ++runs.current
    setTut({ step: 'look', qs: undefined, n, replay })
    fetchSamples(game, cefr && /^(A1|A2|B1|B2|C1)$/.test(cefr) ? cefr : 'A1').then((qs) => {
      setTut((t) => (t && t.n === n ? { ...t, qs: qs ?? null } : t))
    })
  }, [game, cefr])

  // a new round of a game this player has never had explained: the tutorial comes first
  useEffect(() => {
    if (need(game)) start(false)
    else setTut(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey])
  useEffect(() => { onTut?.(!!tut) }, [tut, onTut])

  const done = useCallback(() => { mark(game); setTut(null) }, [game, mark])
  const toReady = useCallback(() => setTut((t) => (t ? { ...t, step: 'ready' } : t)), [])
  const afterReady = useCallback(() => {
    if (TIMED.has(game) && !focus) setTut((t) => (t ? { ...t, step: 'count' } : t))
    else done()
  }, [game, focus, done])

  const practiceQs = tut?.qs && tut.qs.length ? tut.qs : null
  const practiceOn = !!tut && !!practiceQs && (tut.step === 'look' || tut.step === 'demo' || tut.step === 'try')
  // the real round: mounted unless a first-time tutorial is still teaching on its practice item
  const realOn = !tut || tut.replay || tut.qs === null || tut.step === 'ready' || tut.step === 'count'
  const waiting = !!tut && tut.qs === undefined && !tut.replay

  const realCtl = useMemo<StageCtl>(() => ({ wrong, paused: open || !!tut, focus, practice: false }), [wrong, open, tut, focus])
  const pracCtl = useMemo<StageCtl>(() => ({ wrong, paused: open || tut?.step !== 'try', focus: true, practice: true }), [wrong, open, tut?.step])
  const pracProps = useMemo<MiniGameProps | null>(() => practiceQs ? {
    items: SRS_GAMES.has(game) ? practiceQs.map(srsOf) : [], srv: practiceQs, level: props.level, world: props.world,
    onAnswer: () => { /* practice: nothing is recorded */ }, onFinish: toReady,
  } : null, [practiceQs, game, props.level, props.world, toReady])

  const live = useRef({ practiceOn })
  live.current.practiceOn = practiceOn
  const getRoot = useCallback(() => (live.current.practiceOn ? pracHost.current : realHost.current), [])
  const getHost = useCallback(() => wrap.current, [])
  const help = tut ? null : () => start(true)
  return (
    <div ref={wrap} className={`gp-wrap${tut?.step === 'try' ? ' tut-try' : ''}`}>
      {realOn && (
        <div ref={realHost} className={`game-host${bleed ? ' bleed' : ''}${practiceOn ? ' gh-hidden' : ''}`}>
          <StageCtlCtx.Provider value={realCtl}>
            <Suspense fallback={<div className="game-wait">…</div>}>
              <Game key={gameKey} {...props} />
            </Suspense>
          </StageCtlCtx.Provider>
        </div>
      )}
      {practiceOn && pracProps && (
        <div ref={pracHost} className={`game-host gh-prac${bleed ? ' bleed' : ''}`}>
          {/* practice: no hints (nothing is charged, and the real round keeps its own hint) */}
          <HintCtx.Provider value={null}>
            <StageCtlCtx.Provider value={pracCtl}>
              <Suspense fallback={<div className="game-wait">…</div>}>
                <Game key={`tut${tut!.n}`} {...pracProps} />
              </Suspense>
            </StageCtlCtx.Provider>
          </HintCtx.Provider>
        </div>
      )}
      {waiting && <div className="game-host"><div className="game-wait">…</div></div>}
      {/* Phase E: Focus mode = black around the question and the answers (not while a tutorial teaches) */}
      {focus && !tut && <FocusVeil getRoot={getRoot} getHost={getHost} />}
      {tray(help)}
      {tut && (tut.step === 'look' || tut.step === 'demo') && tut.qs !== undefined && (
        <Spotlight game={game} step={tut.step} getRoot={getRoot} getHost={getHost} canDemo={!!practiceQs}
          onNext={() => (tut.step === 'look' && practiceQs ? setTut({ ...tut, step: 'demo' }) : tut.step === 'demo' ? setTut({ ...tut, step: 'try' }) : done())}
          onSkip={done} />
      )}
      {tut?.step === 'try' && <TutBanner />}
      {tut?.step === 'ready' && <TutReady game={game} onGo={afterReady} />}
      {tut?.step === 'count' && <Countdown onDone={done} />}
      {card}
    </div>
  )
}
