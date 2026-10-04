// A stage played on the server (runecast-api): start a session, play its questions in the
// existing mini-games (one round per game), send the answers for server grading, then show
// what the server awarded (stars, XP, coins, gems, the boss drop, level up).
// Same look as StageScreen (lobby -> play -> result); the reward modals reuse rw-card.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { HeartIcon } from '../components/Icon'
import { Panel, Art, art } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import stageBg from '../assets/stage_bg.webp'
import icEnergy from '../assets/sky/ic_energy.png'
import icCoin from '../assets/sky/ic_coin.png'
import icHeart from '../assets/sky/ic_heart.png'
import type { Stage, ServerQuestion } from '../types/game'
import { gameFor } from '../games/registry'
import { HintCtx, type HintFn } from '../games/boosters'
import { BoosterTray } from '../components/BoosterTray'
import { api, errorText, ApiError, type CompleteOut, type StartOut, type Topic } from '../services/api'
import { planRounds, AnswerSheet, solve, type Round } from '../services/serverPlay'
import { sfx, enterScene, leaveScene } from '../services/audio'
import '../components/gametitle.css'
import './stage.css'
import './serverstage.css'
import '../components/progression.css'

type Phase = 'loading' | 'error' | 'gate' | 'intro' | 'play' | 'between' | 'sending' | 'rescue' | 'result'

const FULL_BLEED = new Set(['echo', 'rune-type', 'potion-mix', 'curse-breaker', 'spell-weaver', 'crystal-ball', 'bards-tale', 'guild-letters', 'oracle-trial', 'rune-order', 'whisper-scroll', 'tavern-talk', 'gap-gate', 'memory-crystals', 'match-blitz', 'bubble-pop', 'boss-battle'])
export const MG_LABEL: Record<string, string> = {
  'oracle-trial': 'Oracle', 'rune-order': 'Rune Order', 'whisper-scroll': 'Whisper Scroll', 'tavern-talk': 'Tavern Talk', 'boss-battle': 'Boss Battle', 'match-blitz': 'Match Blitz', 'bubble-pop': 'Bubble Pop',
  'rune-type': 'Rune Type', 'memory-crystals': 'Memory Crystals', 'gap-gate': 'Gap Gate',
  'spell-weaver': 'Spell Weaver', 'echo': 'Echo Cave', 'portal-run': 'Portal Run', 'potion-mix': 'Potion Mix',
  'curse-breaker': 'Curse Breaker', 'crystal-ball': 'Crystal Ball', 'bards-tale': "Bard's Tale", 'guild-letters': 'Guild Letters',
}
const KIND_LABEL: Record<string, string> = { lesson: 'Spellbook', practice: 'Practice', practice2: 'Echoes', trial: 'Trial', boss: 'Boss Fight', bonus: 'Treasure' }
const LV = ['A1', 'A2', 'B1', 'B2', 'C1']
// TEST BUILDS ONLY (base path contains -test) with ?autoplay: a button that answers every item right,
// to check the whole loop (server grading, rewards, modals) end to end. Never in a live build.
const AUTOPLAY = import.meta.env.BASE_URL.includes('-test') && typeof location !== 'undefined' && new URLSearchParams(location.search).has('autoplay')

function SceneAudio({ id }: { id: string }) {
  useEffect(() => { enterScene(id); return () => leaveScene() }, [id])
  return null
}

/** **bold** in the Spellbook text (the topic copy uses markdown bold only) */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return <>{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>
}

export function ServerStage({ stage, onExit, onNeedHearts }: { stage: Stage; onExit: () => void; onNeedHearts: () => void }) {
  const { currencies, applyComplete, setCurrencies, refreshReview } = useGame()
  const [phase, setPhase] = useState<Phase>('loading')
  const [err, setErr] = useState('')
  const [session, setSession] = useState<StartOut | null>(null)
  const [topic, setTopic] = useState<Topic | null>(null)
  const [ri, setRi] = useState(0)                 // round index
  const [out, setOut] = useState<CompleteOut | null>(null)
  const [modal, setModal] = useState<'drop' | 'level' | 'done' | null>(null)
  const [attempt, setAttempt] = useState(0)        // bump to start a fresh session (retry)
  const sheet = useRef<AnswerSheet>(new AnswerSheet())
  const hints = useRef(0)
  const hintFn = useRef<HintFn | null>(null)
  const [canHint, setCanHint] = useState(false)
  const registerHint = useCallback((fn: HintFn | null) => { hintFn.current = fn; setCanHint(!!fn) }, [])
  const level = Math.max(0, LV.indexOf(stage.cefr ?? 'A1'))
  const boss = stage.serverKind === 'boss' || stage.kind === 'boss'

  const plan = useMemo(() => session ? planRounds(session.questions, boss) : null, [session, boss])
  const rounds: Round[] = plan?.rounds ?? []
  const round = rounds[ri]

  // start (or restart) the session
  useEffect(() => {
    let live = true
    setPhase('loading'); setOut(null); setRi(0); setModal(null); hints.current = 0
    if (stage.heartsApply && (currencies?.hearts ?? 0) <= 0) { setPhase('gate'); return }
    api.start(stage.id).then((s) => {
      if (!live) return
      if (!s.questions.length) { setErr('This stage has no questions yet. Try another one.'); setPhase('error'); return }
      setSession(s)
      sheet.current = new AnswerSheet(planRounds(s.questions, boss).answerMap)
      setPhase('intro')
    }).catch((e) => {
      if (!live) return
      if (e instanceof ApiError && e.code === 'no_hearts') { setPhase('gate'); return }
      setErr(errorText(e)); setPhase('error')
    })
    if (stage.topicId && stage.serverKind === 'lesson') api.topic(stage.topicId).then((t) => live && setTopic(t)).catch(() => { /* the lobby works without it */ })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id, attempt])

  useEffect(() => { if (phase === 'result' && out) sfx(out.stars > 0 ? 'win' : 'lose') }, [phase, out])

  const onAnswer = useCallback((qid: string, answer: unknown, correct: boolean) => sheet.current.record(qid, answer, correct), [])
  const onHint = async () => {
    const fn = hintFn.current
    if (!fn || !fn()) return false
    hints.current++
    return true
  }

  async function send(useElixir: boolean) {
    if (!session) return
    setPhase('sending')
    try {
      const r = await api.complete(session.session_id, sheet.current.answers, hints.current, useElixir)
      setOut(r)
      setCurrencies({ ...r.wallet })
      applyComplete(r, stage.cefr ?? r.me.level)
      setPhase('result')
      // the boss drop / level up modals follow the result card
      if (r.rewards.items?.length) setModal('drop')
      else if (r.level_completed) setModal('done')
      else if (r.level_up) setModal('level')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'already_completed') { setErr('This round was already counted.'); setPhase('error'); return }
      setErr(errorText(e)); setPhase('error')
    }
  }

  function roundDone() {
    if (!session) return
    // items a game skipped (it ended early) are sent as unanswered: the server counts them wrong
    if (ri + 1 < rounds.length) { setPhase('between'); setTimeout(() => { setRi(ri + 1); setPhase('play') }, 1300); return }
    const total = session.questions.length
    const acc = sheet.current.correct / Math.max(1, total)
    // a lost boss/bonus costs a heart: an elixir can keep it (the server spends it)
    if (stage.heartsApply && acc < 0.5 && (currencies?.potion ?? 0) > 0) { setPhase('rescue'); return }
    send(false)
  }

  // ---- render ----
  if (phase === 'gate') return (
    <div className="stage-host full">
      <div className="sky" />
      <div className="gate-card pop">
        <div className="gate-heart"><HeartIcon size={44} /></div>
        <h2>Out of Hearts</h2>
        <p>Bosses and treasure vaults need a heart. Review in the Overnight Cauldron (10 right answers brew a heart), wait for one to recharge, or get more.</p>
        <button className="btn btn-gold big" onClick={onNeedHearts}>Get Hearts</button>
        <button className="btn btn-ghost big" onClick={onExit}>Back to Map</button>
      </div>
    </div>
  )

  if (phase === 'loading' || phase === 'sending' || phase === 'error') return (
    <div className="stage-host full">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
      <div className="lobby pop">
        {phase === 'error' ? <>
          <h2 className="lobby-title" style={{ fontSize: 28 }}>The spell fizzled</h2>
          <p className="lobby-sub">{err}</p>
          <Panel name="btn_gold" className="lobby-start btn-h" inner="lobby-start-in" onClick={() => { setErr(''); setAttempt((n) => n + 1) }}>Try again</Panel>
          <button className="ss-link" onClick={onExit}>Back to the map</button>
        </> : <>
          <div className="ss-spinner" aria-hidden />
          <p className="lobby-sub">{phase === 'sending' ? 'The runes are being judged…' : 'Opening the stage…'}</p>
        </>}
      </div>
    </div>
  )

  if (phase === 'intro' && session) {
    const games = [...new Set(rounds.map((r) => r.game))]
    return (
      <div className="stage-host full">
        <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
        <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
        <div className="lobby pop ss-lobby">
          <Panel name="ribbon_gold" className="lobby-tag" inner="lobby-tag-in">
            {KIND_LABEL[stage.serverKind ?? ''] ?? 'Stage'} · {stage.cefr}
          </Panel>
          <h2 className="lobby-title ss-title">{stage.title.replace(/^(Spellbook|Practice|Echoes|Trial): /, '')}</h2>
          {topic ? (
            <div className="ss-book">
              <p className="ss-sum"><Rich text={topic.summary ?? ''} /></p>
              {Array.isArray(topic.rules) && <ul className="ss-rules">{(topic.rules as string[]).slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}</ul>}
              {Array.isArray(topic.examples) && (
                <div className="ss-ex">{(topic.examples as { en: string; note?: string }[]).slice(0, 3).map((x, i) => <span key={i}><b>{x.en}</b>{x.note && <small>{x.note}</small>}</span>)}</div>
              )}
              {Array.isArray(topic.common_mistakes) && (topic.common_mistakes as { wrong: string; right: string }[]).slice(0, 2).map((m, i) => (
                <p key={i} className="ss-mis"><s>{m.wrong}</s> → <b>{m.right}</b></p>
              ))}
            </div>
          ) : (
            <p className="lobby-sub">{session.questions.length} runes to cast{session.review_ratio > 0 ? ' · some from earlier spells' : ''}</p>
          )}
          <div className="ss-games">
            {games.map((g) => <span key={g} className="ss-chip">{MG_LABEL[g] ?? g}</span>)}
            {stage.heartsApply && <span className="ss-chip ss-heart"><img src={icHeart} alt="" />{session.hearts}</span>}
          </div>
          <Panel name="btn_gold" className="lobby-start btn-h" inner="lobby-start-in" onClick={() => setPhase('play')}>
            {boss ? 'Fight' : 'Start'}
          </Panel>
        </div>
      </div>
    )
  }

  if (phase === 'rescue') return (
    <div className="stage-host full">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <div className="rescue-wrap"><div className="rescue pop">
        <div className="rescue-ic">🧪</div>
        <h2>The {boss ? 'boss' : 'vault'} holds</h2>
        <p>Drink an elixir to keep your heart. You have {currencies?.potion ?? 0}.</p>
        <button className="cb cb-violet" onClick={() => send(true)}>Use Elixir</button>
        <button className="cb cb-white" onClick={() => send(false)}>Give up (−1 ❤️)</button>
      </div></div>
    </div>
  )

  if (phase === 'result' && out) return (
    <div className="stage-host full">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      <div className="result pop">
        <div className="result-stars">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`rstar s${i} ${i < out.stars ? 'on' : ''}`} style={{ animationDelay: `${i * 150}ms` }}>
              <Art name="qi_star" />
            </span>
          ))}
        </div>
        <h2 className="result-title">{out.stars === 3 ? 'Perfect!' : out.stars >= 1 ? 'Nice!' : 'Try again'}</h2>
        <p className="result-sub">{out.correct} of {out.total} runes cast{out.first_clear ? ' · first clear' : ''}</p>
        <div className="result-rewards">
          <span className="rwd"><img src={icEnergy} alt="" /><b>{out.rewards.xp}</b><small>{out.rewards.boosted ? 'XP ×2' : 'XP'}</small></span>
          <span className="rwd"><img src={icCoin} alt="" /><b>{out.rewards.coins}</b></span>
          {!!out.rewards.gems && <span className="rwd"><img src={skySrc('ic_gem')} alt="" /><b>{out.rewards.gems}</b></span>}
        </div>
        <p className="ss-extra">
          {out.league_points > 0 && <span>+{out.league_points} league points</span>}
          {out.streak.today_done && <span>🔥 Hearthfire {out.streak.current} day{out.streak.current === 1 ? '' : 's'}</span>}
          {out.hearts_lost > 0 && <span>−{out.hearts_lost} ❤️</span>}
          {out.elixir_used && <span>🧪 elixir used, heart kept</span>}
        </p>
        {out.rewards.items?.length ? <Art name="chest_open" className="result-chest" /> : null}
        <Panel name="btn_gold" className="result-continue btn-h" inner="lobby-start-in" onClick={() => { refreshReview(); onExit() }}>
          Continue
        </Panel>
        {out.stars < 3 && <button className="ss-link" onClick={() => setAttempt((n) => n + 1)}>Play again</button>}
      </div>
      {modal && <RewardModal kind={modal} out={out} stage={stage} onClose={() => setModal(modal === 'drop' && out.level_completed ? 'done' : modal === 'drop' && out.level_up ? 'level' : null)} />}
    </div>
  )

  if (!round) return null
  const Game = gameFor(round.game)
  return (
    <div className="stage-host full">
      <div className="sky" />
      <SceneAudio id={round.game} />
      <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
      <div className="play-top">
        <div className="play-hearts"><img src={icHeart} alt="" /><b>{currencies?.hearts ?? session?.hearts ?? 0}</b></div>
        {rounds.length > 1 && <span className="play-mg">Round {ri + 1} / {rounds.length}</span>}
      </div>
      <div className={`game-host${FULL_BLEED.has(round.game) ? ' bleed' : ''}`}>
        <HintCtx.Provider value={registerHint}>
          <Suspense fallback={<div className="game-wait">…</div>}>
            <Game key={`${attempt}:${ri}`} items={round.items} srv={round.qs as ServerQuestion[]} onAnswer={onAnswer} onFinish={roundDone} level={level} />
          </Suspense>
        </HintCtx.Provider>
      </div>
      {AUTOPLAY && session && (
        <button className="mapdemo-btn ss-auto" onClick={() => {
          // keep ~2 s per item so the server's minimum play time is met
          const wait = Math.max(0, session.questions.length * 2000 - sheet.current.elapsed)
          setTimeout(() => { session.questions.forEach((q) => sheet.current.record(q.qid, solve(q), true)); send(false) }, wait)
        }}>Test: answer all</button>
      )}
      {phase === 'between' && (
        <div className="ss-between pop"><span>Round {ri + 2}</span><b>{MG_LABEL[rounds[ri + 1]?.game] ?? ''}</b></div>
      )}
      <BoosterTray coins={currencies?.coins ?? 0} elixirs={currencies?.potion ?? 0} canHint={canHint} onHint={onHint} free />
    </div>
  )
}

/** the boss drop, the level up and the level completed cards (rw-card style, like the app's reward popup) */
function RewardModal({ kind, out, stage, onClose }: { kind: 'drop' | 'level' | 'done'; out: CompleteOut; stage: Stage; onClose: () => void }) {
  useEffect(() => { sfx('win') }, [kind])
  return (
    <div className="rw-scrim" onClick={onClose}>
      <div className="rw-card ss-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rw-rays" />
        {kind === 'drop' && <>
          <div className="rw-title">{stage.kind === 'boss' ? 'The boss dropped a treasure!' : 'Treasure found!'}</div>
          <div className="rw-items">
            {out.rewards.items.map((it) => (
              <div key={it.item_id} className="rw-big ss-drop"><img src={art('chest_epic')} alt="" draggable={false} /><b>{it.name}</b><span>New for your wardrobe</span></div>
            ))}
          </div>
          <p className="rw-note">Wear it from your profile: Edit.</p>
        </>}
        {kind === 'level' && <>
          <div className="rw-title">Level up!</div>
          <div className="rw-items">
            <div className="rw-big"><img src={icEnergy} alt="" draggable={false} /><b>{out.me.player_level}</b><span>Your level</span></div>
            <div className="rw-big"><img src={skySrc('ic_gem')} alt="" draggable={false} /><b>+5</b><span>Gems</span></div>
          </div>
        </>}
        {kind === 'done' && <>
          <div className="rw-title">{stage.cefr} complete!</div>
          <p className="rw-note">A new grimoire opens: level {out.me.level}. Your journey goes on.</p>
        </>}
        <Panel name="btn_gold" className="ss-modal-btn btn-h" inner="lobby-start-in" onClick={onClose}>Great!</Panel>
      </div>
    </div>
  )
}
