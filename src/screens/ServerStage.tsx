// A stage played on the server (runecast-api): start a session, play its questions in the
// existing mini-games (one round per game), send the answers for server grading, then show
// what the server awarded (stars, XP, coins, gems, the boss drop, level up).
// Same look as StageScreen (lobby -> play -> result); the reward modals reuse rw-card.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { HeartIcon } from '../components/Icon'
import { Panel, Art, Btn, Card, Chip } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import stageBg from '../assets/stage_bg.webp'
import icEnergy from '../assets/sky/ic_energy.png'
import icCoin from '../assets/sky/ic_coin.png'
import icHeart from '../assets/sky/ic_heart.png'
import type { Stage, ServerQuestion } from '../types/game'
import { gameFor } from '../games/registry'
import { GamePlay } from '../games/GamePlay'
import { useTutorials, useFocusPref } from '../games/coach'
import { HintCtx, type HintFn } from '../games/boosters'
import { BoosterTray } from '../components/BoosterTray'
import { ItemThumb } from '../components/ItemThumb'
import { SpellLetter, hasLetter } from '../components/SpellLetter'
import { api, errorText, ApiError, type CompleteOut, type StartOut, type Topic, type HintsState } from '../services/api'
import { toCurrencies } from '../services/httpService'
import { wearItem } from '../services/look'
import { useCountdown } from '../components/Rewards'
import { planRounds, AnswerSheet, solve, type Round } from '../services/serverPlay'
import { sfx, enterScene, leaveScene, quietStage, VOICE_GAMES } from '../services/audio'
import '../components/gametitle.css'
import './stage.css'
import './serverstage.css'
import '../components/progression.css'
import oracleIdle from '../assets/games/oracle/oracle_idle.webp'

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

/** the guided first stage after the intro (10-11): a wizard line on the lobby. Phase C: the first round's old coach note
 *  is gone; every game's first-time tutorial (games/GamePlay.tsx) teaches it instead */
function Coach({ children, onClose, className }: { children: React.ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className={`gd-coach pop${className ? ' ' + className : ''}`} role="note" onClick={onClose}>
      <img src={oracleIdle} alt="" draggable={false} />
      <p>{children}</p>
    </div>
  )
}

export function ServerStage({ stage, onExit, onNeedHearts, guided }: { stage: Stage; onExit: () => void; onNeedHearts: () => void; guided?: boolean }) {
  const { currencies, applyComplete, setCurrencies, refreshReview, account, patchMe, mode } = useGame()
  // Phase C: first-time tutorials per game (account flag `tut`) and Focus mode (account flag `focus`, locked at Start)
  const http = mode === 'http'
  const saveTut = useCallback((g: string[]) => { patchMe({ flags: { tut: g } }).catch(() => { /* kept locally */ }) }, [patchMe])
  const saveFocus = useCallback((on: boolean) => { patchMe({ flags: { focus: on ? 'on' : 'off' } }).catch(() => {}) }, [patchMe])
  const tuts = useTutorials(account?.flags, http ? saveTut : null)
  const [focusPref, setFocusPref] = useFocusPref(account?.flags, http ? saveFocus : null)
  const [focus, setFocus] = useState(false)
  const [tutOn, setTutOn] = useState(false)
  const begin = () => { setFocus(focusPref); setPhase('play') }
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
  // Phase B: 3 free hints a day then coins; "continue +3 questions" after a lost trial / boss / vault
  const [hintState, setHintState] = useState<HintsState | null>(null)
  const [extra, setExtra] = useState<Round[]>([])
  const [extraN, setExtraN] = useState(0)
  const [contLeft, setContLeft] = useState(0)
  const [contErr, setContErr] = useState('')
  const registerHint = useCallback((fn: HintFn | null) => { hintFn.current = fn; setCanHint(!!fn) }, [])
  const level = Math.max(0, LV.indexOf(stage.cefr ?? 'A1'))
  const boss = stage.serverKind === 'boss' || stage.kind === 'boss'

  const plan = useMemo(() => session ? planRounds(session.questions, boss) : null, [session, boss])
  const rounds: Round[] = useMemo(() => [...(plan?.rounds ?? []), ...extra], [plan, extra])
  const round = rounds[ri]
  // a stage with a speaking / listening game in any round has no music at all (lobby to result)
  const quiet = VOICE_GAMES.has(stage.miniGame) || rounds.some((r) => VOICE_GAMES.has(r.game))
  useEffect(() => { quietStage(quiet || focus); return () => quietStage(false) }, [quiet, focus])

  // start (or restart) the session
  useEffect(() => {
    let live = true
    setPhase('loading'); setOut(null); setRi(0); setModal(null); hints.current = 0; setExtra([]); setExtraN(0); setContErr('')
    if (stage.heartsApply && (currencies?.hearts ?? 0) <= 0) { setPhase('gate'); return }
    api.start(stage.id).then((s) => {
      if (!live) return
      if (!s.questions.length) { setErr('This stage has no questions yet. Try another one.'); setPhase('error'); return }
      setSession(s)
      sheet.current = new AnswerSheet(planRounds(s.questions, boss).answerMap)
      setHintState(s.hints ?? null); setContLeft(s.continue?.left ?? 0)
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
    // the hint is already on screen; the server counts it (free 3 a day, then it charges the coins)
    try { const r = await api.useHint(); setHintState(r.hints); setCurrencies(toCurrencies(r.wallet)) } catch { /* offline: counted with the session */ }
    return true
  }

  /** "+3 questions" for an elixir or gems: the server adds them to this session, then they are played as one more round */
  async function doContinue(pay: 'elixir' | 'gems') {
    if (!session) return
    setContErr('')
    try {
      const r = await api.continueSession(session.session_id, pay)
      setCurrencies(toCurrencies(r.wallet)); setContLeft(r.continue?.left ?? 0)
      const more = planRounds(r.questions, boss)
      sheet.current.extend(more.answerMap)
      setExtraN((n) => n + r.questions.length)
      const at = rounds.length
      setExtra((x) => [...x, ...more.rounds])
      setRi(at); setPhase('play')
    } catch (e) { setContErr(errorText(e)) }
  }

  async function send(useElixir: boolean) {
    if (!session) return
    setPhase('sending')
    try {
      const r = await api.complete(session.session_id, sheet.current.answers, hints.current, useElixir, focus)
      setOut(r)
      setCurrencies({ ...r.wallet })
      applyComplete(r, stage.cefr ?? r.me.level)
      setPhase('result')
      // Phase D: a won stage is the good moment to offer the daily reminder (App shows it back on the map)
      if (r.stars > 0) window.dispatchEvent(new CustomEvent('es-stage-won'))
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
    const total = session.questions.length + extraN
    const acc = sheet.current.correct / Math.max(1, total)
    // a lost trial / boss / vault costs a heart: continue (+3 questions) or an elixir can save it
    if (stage.heartsApply && acc < 0.5 && (contLeft > 0 || (currencies?.potion ?? 0) > 0)) { setPhase('rescue'); return }
    send(false)
  }

  // ---- render ----
  if (phase === 'gate') return (
    <div className="stage-host full">
      <div className="sky" />
      <div className="gate-card pop">
        <div className="gate-heart"><HeartIcon size={44} /></div>
        <h2>Out of Hearts</h2>
        <p>Trials, bosses and treasure vaults need a heart. Review in the Overnight Cauldron (10 right answers brew a heart), wait for one to recharge, or get more.</p>
        <NextHeart at={currencies?.heartsRefillAt ?? 0} />
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
          <h2 className="lobby-title ss-title">The spell fizzled</h2>
          <Card className="ss-card ss-card-c"><p className="ss-card-p">{err}</p></Card>
          <Panel name="btn_gold" className="lobby-start" inner="lobby-start-in" onClick={() => { setErr(''); setAttempt((n) => n + 1) }}>Try again</Panel>
          <button className="cb cb-white ss-sec" onClick={onExit}>Back to the map</button>
        </> : (
          <Card className="ss-card ss-card-c">
            <div className="ss-spinner" aria-hidden />
            <p className="ss-card-p">{phase === 'sending' ? 'The runes are being judged…' : 'Opening the stage…'}</p>
          </Card>
        )}
      </div>
    </div>
  )

  if (phase === 'intro' && session) {
    const games = [...new Set(rounds.map((r) => r.game))]
    if (stage.serverKind === 'lesson' && hasLetter(stage.topicId)) return (
      <div className="stage-host full">
        <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
        <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
        <div className="sl-lobby pop">
          {guided && <Coach className="gd-top">This is a page of your Spellbook. Read the rule and the examples, then tap Start.</Coach>}
          <SpellLetter topicId={stage.topicId!} level={stage.cefr ?? ''} onStart={begin} />
          <FocusToggle on={focusPref} set={setFocusPref} />
        </div>
      </div>
    )
    return (
      <div className="stage-host full">
        <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
        <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
        <div className="lobby pop ss-lobby">
          {guided && <Coach className="gd-top">Your first stage! Read the card, then tap Start.</Coach>}
          <Panel name="ribbon_gold" className="lobby-tag" inner="lobby-tag-in">
            {KIND_LABEL[stage.serverKind ?? ''] ?? 'Stage'} · {stage.cefr}
          </Panel>
          <h2 className="lobby-title ss-title">{stage.title.replace(/^(Spellbook|Practice|Echoes|Trial): /, '')}</h2>
          <Card className="ss-card">
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
            <p className="ss-card-p ss-c">{session.questions.length} runes to cast{session.review_ratio > 0 ? ', some from earlier spells' : ''}</p>
          )}
          <div className="ss-games">
            {games.map((g) => <Chip key={g}>{MG_LABEL[g] ?? g}</Chip>)}
            {stage.heartsApply && <Chip className="ss-heart"><img src={icHeart} alt="" />{session.hearts}</Chip>}
          </div>
          </Card>
          <Panel name="btn_gold" className="lobby-start" inner="lobby-start-in" onClick={begin}>
            {boss ? 'Fight' : 'Start'}
          </Panel>
          <FocusToggle on={focusPref} set={setFocusPref} />
        </div>
      </div>
    )
  }

  if (phase === 'rescue') {
    const potion = currencies?.potion ?? 0, gems = currencies?.gems ?? 0
    const what = boss ? 'boss' : stage.serverKind === 'trial' ? 'trial' : 'vault'
    return (
      <div className="stage-host full">
        <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
        <div className="rescue-wrap"><div className="rescue pop">
          <div className="rescue-ic">🧪</div>
          <h2>The {what} holds</h2>
          <p>{contLeft > 0 ? 'Half the runes must land to win. Try 3 more questions?' : `Drink an elixir to keep your heart. You have ${potion}.`}</p>
          {contLeft > 0 && (potion > 0
            ? <button className="cb cb-violet rs-btn" onClick={() => doContinue('elixir')}>Continue: +3 questions<span className="rs-cost">🧪 1</span></button>
            : <button className={`cb cb-violet rs-btn${gems < 15 ? ' rs-short' : ''}`} disabled={gems < 15} onClick={() => doContinue('gems')}>Continue: +3 questions<span className="rs-cost"><img src={skySrc('ic_gem')} alt="" />15</span></button>)}
          {contLeft > 0 && potion === 0 && gems < 15 && <small className="rs-note">You need 15 gems or an elixir.</small>}
          {potion > 0 && <button className="cb cb-white" onClick={() => send(true)}>Keep my heart<span className="rs-cost">🧪 1</span></button>}
          {contErr && <small className="rs-note">{contErr}</small>}
          <button className="cb cb-white" onClick={() => send(false)}>Give up (−1 ❤️)</button>
        </div></div>
      </div>
    )
  }

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
        <Card className="ss-card ss-card-c">
        <p className="ss-card-p ss-strong">{out.correct} of {out.total} runes cast{out.first_clear ? ' · first clear' : ''}</p>
        <div className="result-rewards ss-rw">
          <span className="rwd"><img src={icEnergy} alt="" /><b>{out.rewards.xp}</b><small>{out.rewards.boosted ? 'XP ×2' : 'XP'}</small></span>
          <span className="rwd"><img src={icCoin} alt="" /><b>{out.rewards.coins}</b></span>
          {!!out.rewards.gems && <span className="rwd"><img src={skySrc('ic_gem')} alt="" /><b>{out.rewards.gems}</b></span>}
        </div>
        <p className="ss-extra">
          {out.league_points > 0 && <span>+{out.league_points} league points</span>}
          {out.streak.today_done && <span>🔥 Hearthfire {out.streak.current} day{out.streak.current === 1 ? '' : 's'}</span>}
          {out.hearts_lost > 0 && <span>−{out.hearts_lost} ❤️</span>}
          {out.elixir_used && <span>🧪 elixir used, heart kept</span>}
          {out.focus && <span>Focus mode: up to 2 stars, no league points</span>}
        </p>
        </Card>
        {out.rewards.items?.length ? <Art name="chest_open" className="result-chest" /> : null}
        <Panel name="btn_gold" className="result-continue" inner="lobby-start-in" onClick={() => { refreshReview(); onExit() }}>
          Continue
        </Panel>
        {out.stars < 3 && <button className="cb cb-white ss-sec" onClick={() => setAttempt((n) => n + 1)}>Play again</button>}
      </div>
      {modal && <RewardModal kind={modal} out={out} stage={stage} onClose={() => setModal(modal === 'drop' && out.level_completed ? 'done' : modal === 'drop' && out.level_up ? 'level' : null)} />}
    </div>
  )

  if (!round) return null
  const Game = gameFor(round.game)
  return (
    <div className={`stage-host full${focus ? ' focus' : ''}${tutOn ? ' tut-on' : ''}`}>
      <div className="sky" />
      <SceneAudio id={round.game} />
      <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
      <div className="play-top">
        <div className="play-hearts"><img src={icHeart} alt="" /><b>{currencies?.hearts ?? session?.hearts ?? 0}</b></div>
        {rounds.length > 1 && <span className="ss-pips" aria-label={`Round ${ri + 1} of ${rounds.length}`}>{rounds.map((_, k) => <i key={k} className={k < ri ? 'done' : k === ri ? 'on' : ''} />)}</span>}
        {focus && <span className="ss-focus-chip"><i><FocusIc /></i>Focus</span>}
      </div>
      <HintCtx.Provider value={registerHint}>
        <GamePlay Game={Game} game={round.game} gameKey={`${attempt}:${ri}`} bleed={FULL_BLEED.has(round.game)} cefr={stage.cefr}
          props={{ items: round.items, world: stage.paint, srv: round.qs as ServerQuestion[], onAnswer, onFinish: roundDone, level }}
          focus={focus} need={tuts.need} mark={tuts.mark} onTut={setTutOn}
          tray={(help) => <BoosterTray coins={currencies?.coins ?? 0} elixirs={currencies?.potion ?? 0} canHint={canHint} onHint={onHint}
            free={!hintState} freeLeft={hintState?.free_left} cost={hintState?.cost_coins} onHelp={help} />} />
      </HintCtx.Provider>
      {AUTOPLAY && session && (
        <button className="ss-auto" onClick={() => {
          // keep ~2 s per item so the server's minimum play time is met
          const wait = Math.max(0, session.questions.length * 2000 - sheet.current.elapsed)
          setTimeout(() => { session.questions.forEach((q) => sheet.current.record(q.qid, solve(q), true)); send(false) }, wait)
        }}>Test: answer all</button>
      )}
      {AUTOPLAY && ri + 1 < rounds.length && <button className="ss-auto ss-auto2" onClick={roundDone}>Test: next round</button>}
      {phase === 'between' && (
        <div className="ss-between pop"><span>Round {ri + 2} of {rounds.length}</span><b>{MG_LABEL[rounds[ri + 1]?.game] ?? ''}</b></div>
      )}
    </div>
  )
}

function FocusIc() { return <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /></svg> }

/** Phase C: the lobby switch for Focus mode (untimed, calm screen; at most 2 stars, no league points) */
export function FocusToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button className={`fx-toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => set(!on)}>
      <span className="fx-t"><b>Focus mode</b><small>No timers, calm screen. Up to 2 stars, no league points.</small></span>
      <span className="fx-sw" aria-hidden />
    </button>
  )
}

/** the boss drop, the level up and the level completed cards (rw-card style, like the app's reward popup) */
function RewardModal({ kind, out, stage, onClose }: { kind: 'drop' | 'level' | 'done'; out: CompleteOut; stage: Stage; onClose: () => void }) {
  useEffect(() => { sfx(kind === 'drop' ? 'reveal' : 'win') }, [kind])   // admin 4530: a new wardrobe item = reveal
  const first = out.rewards.items?.[0]
  const [worn, setWorn] = useState<string | null>(null)
  return (
    <div className="rw-scrim" onClick={onClose}>
      <div className="rw-card ss-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rw-rays" />
        {kind === 'drop' && <>
          <div className="rw-title">{out.rewards.items.some((i) => !i.why || i.why === 'Boss treasure') ? (stage.kind === 'boss' ? 'The boss dropped a treasure!' : 'Treasure found!') : 'You earned a new look!'}</div>
          <div className="rw-items">
            {out.rewards.items.map((it) => (
              <div key={it.item_id} className="rw-big ss-drop"><ItemThumb id={it.item_id} fallback="chest_epic" /><b>{it.name}</b><span>{it.why && it.why !== 'Boss treasure' ? it.why : 'New for your wardrobe'}</span></div>
            ))}
          </div>
          {first?.slot && <Btn name="btn_green" className="lg" disabled={worn !== null} onClick={async () => {
            setWorn('…'); try { await wearItem(first.slot!, first.item_id); setWorn('ok') } catch { setWorn(null) }
          }}>{worn === 'ok' ? 'Wearing it' : 'Wear it now'}</Btn>}
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
        <Btn name="btn_gold" className="lg" onClick={onClose}>Great!</Btn>
      </div>
    </div>
  )
}

/** the time to the next heart on the "Out of Hearts" card */
function NextHeart({ at }: { at: number }) {
  const t = useCountdown(at)
  if (!at || t.ms <= 0) return null
  return <p className="gate-next">Next heart in {t.label}</p>
}
