// The Overnight Cauldron: the day's spaced review (Leitner boxes on the server), offered first
// each day. Items due today are played in the existing mini-games, then graded by
// POST /v1/review/submit (every 10 right answers brew a heart; one round lights the Hearthfire).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Panel, Card, Chip, art } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import stageBg from '../assets/stage_bg.webp'
import icHeart from '../assets/sky/ic_heart.png'
import { gameFor } from '../games/registry'
import { HintCtx, type HintFn } from '../games/boosters'
import { BoosterTray } from '../components/BoosterTray'
import { api, errorText, type ReviewOut, type ReviewToday } from '../services/api'
import { planRounds, AnswerSheet } from '../services/serverPlay'
import { dayKey } from '../services/progress'
import { MG_LABEL } from './ServerStage'
import { sfx } from '../services/audio'
import './stage.css'
import './serverstage.css'
import '../components/progression.css'

const SEEN_KEY = 'es.review.day'
/** the Cauldron opens by itself once a day, before the map */
export function cauldronSeenToday() { try { return localStorage.getItem(SEEN_KEY) === dayKey() } catch { return true } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, dayKey()) } catch { /* private mode */ } }

type Phase = 'loading' | 'error' | 'intro' | 'play' | 'between' | 'sending' | 'result' | 'empty'

export function CauldronScreen({ onClose, level }: { onClose: () => void; level: number }) {
  const { currencies, applyReview, streak } = useGame()
  const [phase, setPhase] = useState<Phase>('loading')
  const [err, setErr] = useState('')
  const [today, setToday] = useState<ReviewToday | null>(null)
  const [ri, setRi] = useState(0)
  const [out, setOut] = useState<ReviewOut | null>(null)
  const sheet = useRef(new AnswerSheet())
  const hintFn = useRef<HintFn | null>(null)
  const [canHint, setCanHint] = useState(false)
  const registerHint = useCallback((fn: HintFn | null) => { hintFn.current = fn; setCanHint(!!fn) }, [])
  const plan = useMemo(() => today ? planRounds(today.items, false) : null, [today])
  const rounds = plan?.rounds ?? []
  const round = rounds[ri]

  const load = useCallback(() => {
    setPhase('loading'); setRi(0); setOut(null)
    api.reviewToday(20).then((t) => {
      setToday(t); sheet.current = new AnswerSheet(planRounds(t.items, false).answerMap)
      setPhase(t.items.length ? 'intro' : 'empty')
    }).catch((e) => { setErr(errorText(e)); setPhase('error') })
  }, [])
  useEffect(() => { markSeen(); load() }, [load])

  const onAnswer = useCallback((qid: string, answer: unknown, correct: boolean) => sheet.current.record(qid, answer, correct), [])

  async function send() {
    setPhase('sending')
    try {
      const r = await api.reviewSubmit(sheet.current.answers)
      setOut(r); applyReview(r); setPhase('result'); sfx(r.correct > 0 ? 'win' : 'lose')
    } catch (e) { setErr(errorText(e)); setPhase('error') }
  }
  function roundDone() {
    if (ri + 1 < rounds.length) { setPhase('between'); setTimeout(() => { setRi(ri + 1); setPhase('play') }, 1300); return }
    send()
  }

  const frame = (body: React.ReactNode) => (
    <div className="stage-host full">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <button className="stage-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="lobby pop ss-lobby">{body}</div>
    </div>
  )

  if (phase === 'loading' || phase === 'sending') return frame(<>
    <Card className="ss-card ss-card-c">
      <div className="ss-spinner" aria-hidden />
      <p className="ss-card-p">{phase === 'sending' ? 'The cauldron bubbles…' : 'Stirring the cauldron…'}</p>
    </Card>
  </>)
  if (phase === 'error') return frame(<>
    <h2 className="lobby-title ss-title">The fire went out</h2>
    <Card className="ss-card ss-card-c"><p className="ss-card-p">{err}</p></Card>
    <Panel name="btn_gold" className="lobby-start" inner="lobby-start-in" onClick={load}>Try again</Panel>
    <button className="cb cb-white ss-sec" onClick={onClose}>Back to the map</button>
  </>)
  if (phase === 'empty') return frame(<>
    <img className="cd-pot" src={art('qi_potion')} alt="" draggable={false} />
    <Panel name="ribbon_gold" className="lobby-tag" inner="lobby-tag-in">Overnight Cauldron</Panel>
    <h2 className="lobby-title ss-title">Nothing to brew today</h2>
    <Card className="ss-card ss-card-c"><p className="ss-card-p">Every spell you learn comes back here on the day you are about to forget it.{today?.new_tomorrow ? ` ${today.new_tomorrow} will be ready tomorrow.` : ''}</p></Card>
    <Panel name="btn_gold" className="lobby-start" inner="lobby-start-in" onClick={onClose}>To the map</Panel>
  </>)
  if (phase === 'intro' && today) return frame(<>
    <img className="cd-pot" src={art('qi_potion')} alt="" draggable={false} />
    <Panel name="ribbon_gold" className="lobby-tag" inner="lobby-tag-in">Overnight Cauldron</Panel>
    <h2 className="lobby-title ss-title">{today.due_count} spell{today.due_count === 1 ? '' : 's'} to remember</h2>
    <Card className="ss-card ss-card-c">
      <p className="ss-card-p">First, today's review: the spells you are about to forget. Every 10 right answers brew a heart{streak && !streak.today_done ? ', and one round lights your Hearthfire' : ''}.</p>
      <div className="ss-games">
        <Chip>{today.items.length} now</Chip>
        {[...new Set(rounds.map((r) => r.game))].map((g) => <Chip key={g}>{MG_LABEL[g] ?? g}</Chip>)}
      </div>
    </Card>
    <Panel name="btn_gold" className="lobby-start" inner="lobby-start-in" onClick={() => setPhase('play')}>Brew</Panel>
    <button className="cb cb-white ss-sec" onClick={onClose}>Later</button>
  </>)
  if (phase === 'result' && out) return frame(<>
    <img className="cd-pot" src={art('qi_potion')} alt="" draggable={false} />
    <h2 className="result-title">{out.correct >= out.graded * 0.8 ? 'Well remembered!' : 'Brewed!'}</h2>
    <Card className="ss-card ss-card-c">
    <p className="ss-card-p ss-strong">{out.correct} of {out.graded} remembered</p>
    <div className="result-rewards ss-rw">
      {out.hearts_gained > 0 && <span className="rwd"><img src={icHeart} alt="" /><b>+{out.hearts_gained}</b></span>}
      <span className="rwd"><img src={art('qi_flame')} alt="" /><b>{out.streak.current}</b><small>day{out.streak.current === 1 ? '' : 's'}</small></span>
    </div>
    <p className="ss-card-p">The ones you missed come back tomorrow; the rest wait longer each time.</p>
    </Card>
    <Panel name="btn_gold" className="result-continue" inner="lobby-start-in" onClick={onClose}>To the map</Panel>
    {(today?.due_count ?? 0) > (today?.items.length ?? 0) && <button className="cb cb-white ss-sec" onClick={load}>Brew more</button>}
  </>)

  if (!round) return null
  const Game = gameFor(round.game)
  return (
    <div className="stage-host full">
      <div className="sky" />
      <button className="stage-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="play-top">
        <div className="play-hearts"><img src={skySrc('ic_heart')} alt="" /><b>{currencies?.hearts ?? 0}</b></div>
        {rounds.length > 1 && <span className="ss-pips" aria-label={`Round ${ri + 1} of ${rounds.length}`}>{rounds.map((_, k) => <i key={k} className={k < ri ? 'done' : k === ri ? 'on' : ''} />)}</span>}
      </div>
      <div className="game-host bleed">
        <HintCtx.Provider value={registerHint}>
          <Suspense fallback={<div className="game-wait">…</div>}>
            <Game key={ri} items={round.items} srv={round.qs} onAnswer={onAnswer} onFinish={roundDone} level={level} />
          </Suspense>
        </HintCtx.Provider>
      </div>
      {phase === 'between' && <div className="ss-between pop"><span>Next</span><b>{MG_LABEL[rounds[ri + 1]?.game] ?? ''}</b></div>}
      <BoosterTray coins={currencies?.coins ?? 0} elixirs={currencies?.potion ?? 0} canHint={canHint} onHint={async () => !!hintFn.current?.()} free />
    </div>
  )
}
