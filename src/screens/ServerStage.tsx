// A stage played on the server (runecast-api): start a session, play its questions in the
// existing mini-games (one round per game), send the answers for server grading, then show
// what the server awarded (stars, XP, coins, gems, the boss drop, level up).
// Same look as StageScreen (lobby -> play -> result); the reward modals reuse rw-card.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Btn, Card } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import stageBg from '../assets/stage_bg.webp'
import icEnergy from '../assets/sky/ic_energy.png'
import icHeart from '../assets/sky/ic_heart.png'
import type { Stage, ServerQuestion } from '../types/game'
import { gameFor } from '../games/registry'
import { GamePlay } from '../games/GamePlay'
import { useTutorials, useFocusPref } from '../games/coach'
import { HintCtx, type HintFn } from '../games/boosters'
import { BoosterTray } from '../components/BoosterTray'
import { ItemThumb } from '../components/ItemThumb'
import { SpellLetter, hasLetter } from '../components/SpellLetter'
import { api, mockFx, errorText, ApiError, type CompleteOut, type StartOut, type Topic, type HintsState } from '../services/api'
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
import { GAME_ICON } from '../games/gameIcons'
import { ResultHero } from './ResultHero'
import './stage2.css'
import heartEmptyArt from '../assets/es2/k/p14/heart_empty_art.webp'
import elixirArt from '../assets/es2/k/p14/elixir_art.webp'
import hourglass from '../assets/es2/k/p14/icon_hourglass.webp'
import flaskIc from '../assets/es2/k/kit/booster_btn_flask.webp'
import waxSeal from '../assets/es2/k/p12/wax_seal.webp'
import starGold from '../assets/es2/k/p13/star_gold.webp'
import starEmpty from '../assets/es2/k/p13/star_empty.webp'
import icLightning from '../assets/es2/k/p13/icon_lightning.webp'
import icLeague from '../assets/es2/k/p13/icon_league_crest.webp'
import icFlame from '../assets/es2/k/p13/icon_flame.webp'
import icCoinK from '../assets/es2/k/kit/icon_coin.webp'
import icGemsK from '../assets/es2/k/kit/icon_gems.webp'
import icHeartK from '../assets/es2/k/kit/icon_heart.webp'
import cfV from '../assets/es2/k/p13/confetti_violet.webp'
import cfG from '../assets/es2/k/p13/confetti_gold.webp'
import cfP from '../assets/es2/k/p13/confetti_pink.webp'
import cfB from '../assets/es2/k/p13/confetti_blue.webp'
import { TitleMark } from '../components/TitleMark'
const CONFETTI = [cfV, cfG, cfP, cfB, cfG, cfV, cfB, cfP, cfG, cfV]

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
  const [contGems, setContGems] = useState(10)   // Phase E: the server's continue price (was a hard-coded 15)
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
    // ?mock=1 screenshot rig only (inert on live): window.__esFx['ES2 phase'] opens the gate / rescue / result card directly
    const jump = mockFx<string>('ES2 phase')
    if (jump === 'gate' || (stage.heartsApply && (currencies?.hearts ?? 0) <= 0)) { setPhase('gate'); return }
    api.start(stage.id).then((s) => {
      if (!live) return
      if (!s.questions.length) { setErr('This stage has no questions yet. Try another one.'); setPhase('error'); return }
      setSession(s)
      sheet.current = new AnswerSheet(planRounds(s.questions, boss).answerMap)
      setHintState(s.hints ?? null); setContLeft(s.continue?.left ?? 0); setContGems(s.continue?.cost_gems ?? 10)
      if (jump === 'rescue') { setPhase('rescue'); return }
      if (jump === 'result') { api.complete(s.session_id, [], 0, false, false).then((r) => { if (live) { setOut(r); setPhase('result') } }); return }
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
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      {/* ES2 concept 14: the painted card with the empty heart over a gold ribbon; green Get Hearts, cream Back to Map */}
      <div className="rescue-wrap"><div className="rescue rs2 pop">
        <img className="rs2-art rs2-heart" src={heartEmptyArt} alt="" draggable={false} />
        <TitleMark as="h2" size="lg" className="rs2-tm">Out of Hearts</TitleMark>
        <p>Trials, bosses and treasure vaults need a heart. Review in the Overnight Cauldron (10 right answers brew a heart), wait for one to recharge, or get more.</p>
        <NextHeart at={currencies?.heartsRefillAt ?? 0} />
        <button className="k-btn k-green" onClick={onNeedHearts}>Get Hearts</button>
        <button className="k-btn k-cream" onClick={onExit}>Back to Map</button>
      </div></div>
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
          <button className="k-btn k-green lobby-go" onClick={() => { setErr(''); setAttempt((n) => n + 1) }}>Try again</button>
          <button className="k-btn k-cream ss-sec" onClick={onExit}>Back to the map</button>
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
          <SpellLetter topicId={stage.topicId!} level={stage.cefr ?? ''} onStart={begin}
            meta={<GameChips games={games} hearts={stage.heartsApply ? session.hearts : null} />}
            foot={<FocusToggle on={focusPref} set={setFocusPref} compact />} />
        </div>
      </div>
    )
    return (
      <div className="stage-host full">
        <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
        <button className="stage-close" onClick={onExit} aria-label="Close">✕</button>
        <div className="lobby pop ss-lobby">
          {guided && <Coach className="gd-top">Your first stage! Read the card, then tap Start.</Coach>}
          {/* ES2 concept 12: the same painted spellbook page as the lesson letter, wax seal, gold ribbon, game chips with each game's art */}
          <div className="ss-page">
          <img className="ss-seal" src={waxSeal} alt="" draggable={false} />
          <TitleMark size="sm" className="lobby-tag2">{KIND_LABEL[stage.serverKind ?? ''] ?? 'Stage'} · {stage.cefr}</TitleMark>
          <h2 className="lobby-title ss-title">{stage.title.replace(/^(Spellbook|Practice|Echoes|Trial): /, '')}</h2>
          <div className="ss-card">
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
          </div>
          </div>
          <GameChips games={games} hearts={stage.heartsApply ? session.hearts : null} />
          <div className="ss-foot">
            <FocusToggle on={focusPref} set={setFocusPref} compact />
            <button className="k-btn k-green lobby-go" onClick={begin}>{boss ? 'Fight' : 'Start'}</button>
          </div>
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
        {/* ES2 concept 14: the elixir over a gold ribbon on the painted card; green Continue, cream Keep / Give up */}
        <div className="rescue-wrap"><div className="rescue rs2 pop">
          <img className="rs2-art" src={elixirArt} alt="" draggable={false} />
          <TitleMark as="h2" size="lg" className="rs2-tm">The {what} holds</TitleMark>
          <p>{contLeft > 0 ? 'Half the runes must land to win. Try 3 more questions?' : `Drink an elixir to keep your heart. You have ${potion}.`}</p>
          {contLeft > 0 && (potion > 0
            ? <button className="k-btn k-green rs-btn" onClick={() => doContinue('elixir')}>Continue: +3 questions<span className="rs-cost"><img src={flaskIc} alt="" />1</span></button>
            : <button className={`k-btn k-green rs-btn${gems < contGems ? ' rs-short' : ''}`} disabled={gems < contGems} onClick={() => doContinue('gems')}>Continue: +3 questions<span className="rs-cost"><img src={skySrc('ic_gem')} alt="" />{contGems}</span></button>)}
          {contLeft > 0 && potion === 0 && gems < contGems && <small className="rs-note">You need {contGems} gems or an elixir.</small>}
          {potion > 0 && <button className="k-btn k-cream rs-btn" onClick={() => send(true)}>Keep my heart<span className="rs-cost"><img src={flaskIc} alt="" />1</span></button>}
          {contErr && <small className="rs-note">{contErr}</small>}
          <button className="k-btn k-cream" onClick={() => send(false)}>Give up (−1 heart)</button>
        </div></div>
      </div>
    )
  }

  if (phase === 'result' && out) return (
    <div className="stage-host full">
      <div className="stage-bg" style={{ backgroundImage: `url(${stageBg})` }} />
      {/* ES2 concept 13: painted stars, the arched ribbon, the player's 3D hero on the rune pedestal, two-part reward cards,
          the Hearthfire chip, the stage drop card, green Continue (+ cream Play again) */}
      <div className="result rs3 pop">
        {out.stars > 0 && <span className="rs3-confetti" aria-hidden>{CONFETTI.map((c, i) => <img key={i} src={c} alt="" style={{ ['--i' as string]: i }} />)}</span>}
        <div className="result-stars rs3-stars">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`rstar s${i} ${i < out.stars ? 'on' : ''}`} style={{ animationDelay: `${i * 150}ms` }}>
              <img src={i < out.stars ? starGold : starEmpty} alt="" draggable={false} />
            </span>
          ))}
        </div>
        <TitleMark as="h2" size="xl" className="rs3-tm">{out.stars === 3 ? 'Perfect!' : out.stars >= 1 ? 'Nice!' : 'Try again'}</TitleMark>
        <ResultHero win={out.stars > 0} />
        <p className="rs3-sum">{out.correct} of {out.total} runes cast{out.first_clear ? ' · first clear' : ''}</p>
        <div className="rs3-cards">
          <span className="rs3-card k9"><img src={icLightning} alt="" /><b>XP +{out.rewards.xp}{out.rewards.boosted || out.rewards.double_xp ? ' ×2' : ''}</b></span>
          <span className="rs3-card k9"><img src={icCoinK} alt="" /><b>+{out.rewards.coins}</b></span>
          {!!out.rewards.gems && <span className="rs3-card k9"><img src={icGemsK} alt="" /><b>+{out.rewards.gems}</b></span>}
          {out.league_points > 0 && <span className="rs3-card k9"><img src={icLeague} alt="" /><b>+{out.league_points} League</b></span>}
        </div>
        {out.streak.today_done && <p className="rs3-chip k9 k-chip-c"><img src={icFlame} alt="" />Hearthfire: {out.streak.current} day{out.streak.current === 1 ? '' : 's'}</p>}
        {(out.hearts_lost > 0 || out.elixir_used || out.rewards.double_xp || out.rewards.boss_rush || out.focus) && (
          <p className="ss-extra rs3-extra">
            {out.hearts_lost > 0 && <span>−{out.hearts_lost} heart{out.hearts_lost === 1 ? '' : 's'}</span>}
            {out.elixir_used && <span>Elixir used, heart kept</span>}
            {out.rewards.double_xp && <span>Double XP Wednesday</span>}
            {!!out.rewards.boss_rush?.gems && <span>Boss Rush +{out.rewards.boss_rush.gems} gems{out.rewards.boss_rush.left ? ` (${out.rewards.boss_rush.left} more today)` : ''}</span>}
            {out.rewards.boss_rush && !out.rewards.boss_rush.gems && <span>Boss Rush: today's 2 rewards are taken</span>}
            {out.focus && <span>Focus mode: up to 2 stars, no league points</span>}
          </p>
        )}
        {out.rewards.items?.length ? (
          <div className="rs3-drop k9 k-panel">
            <span className="rs3-droptab">Stage drop</span>
            <ItemThumb id={out.rewards.items[0].item_id} fallback="chest_epic" />
            <b>New item: {out.rewards.items[0].name}{out.rewards.items.length > 1 ? ` +${out.rewards.items.length - 1}` : ''}</b>
          </div>
        ) : null}
        <button className="k-btn k-green result-continue rs3-go" onClick={() => { refreshReview(); onExit() }}>Continue</button>
        {out.stars < 3 && <button className="k-btn k-cream ss-sec rs3-again" onClick={() => setAttempt((n) => n + 1)}>Play again</button>}
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
export function FocusToggle({ on, set, compact }: { on: boolean; set: (v: boolean) => void; compact?: boolean }) {
  const why = 'No timers, calm screen. Up to 2 stars, no league points.'
  // ES2 concept 12: compact = the painted switch with its label beside the Start button (the rule shows once it is on)
  return (
    <button className={`fx-toggle${on ? ' on' : ''}${compact ? ' fx-compact' : ''}`} role="switch" aria-checked={on} aria-label={`Focus mode. ${why}`} onClick={() => set(!on)}>
      {compact && <span className="fx-sw" aria-hidden />}
      <span className="fx-t"><b>Focus mode</b>{(!compact || on) && <small>{compact ? 'Up to 2 stars, no league points' : why}</small>}</span>
      {!compact && <span className="fx-sw" aria-hidden />}
    </button>
  )
}

/** ES2 concept 12: the stage's games as painted chips with each game's own art, and the heart it costs */
function GameChips({ games, hearts }: { games: string[]; hearts: number | null }) {
  return (
    <div className="ss-chips">
      {games.map((g) => (
        <span key={g} className="ss-gchip">{GAME_ICON[g] && <img src={GAME_ICON[g]} alt="" draggable={false} />}<b>{MG_LABEL[g] ?? g}</b></span>
      ))}
      {hearts != null && <span className="ss-gchip ss-hchip" aria-label={`${hearts} hearts`}><img src={icHeartK} alt="" draggable={false} /><b>{hearts}</b></span>}
    </div>
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
  return <p className="gate-next k9 k-chip-c"><img src={hourglass} alt="" />Next heart in {t.label}</p>
}
