// First-run intro (UX audit 10-11 §3, admin msg 4814): the Archmage's letter, a name, a quick look, a daily vow,
// then a level choice OR the Oracle placement test. Only for new players (server: me.onboarded = false); every step
// after the letter can be skipped. Each answer is saved on the account at once (PATCH /v1/me), and the step the
// player is on is kept in flags.intro_step, so a reload resumes where they left. The guided first stage and the map
// tour (MapTour.tsx) follow in App.

import { Children, isValidElement, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useGame } from '../services/ServiceProvider'
import { api, errorText, unnamed } from '../services/api'
import { lsToLook } from '../services/look'
import { Btn } from '../components/PageArt'
import { ScrollSheet } from '../components/ScrollSheet'
import { NameField, nameOk } from '../components/NameSheet'
import { ORACLE_BANK, LEVELS, type OracleQ } from '../games/oracleBank'
import faceBoy from '../assets/character/portrait_default_m.webp'
import faceGirl from '../assets/character/portrait_default_f.webp'
import oracleIdle from '../assets/games/oracle/oracle_idle.webp'
import oracleHappy from '../assets/games/oracle/oracle_happy.webp'
import '../components/spellletter.css'
import '../components/gametitle.css'
import './stage.css'
import './onboarding.css'

const OracleTrial = lazy(() => import('../games/OracleTrial').then((m) => ({ default: m.OracleTrial })))

type Step = 'letter' | 'name' | 'look' | 'goal' | 'level' | 'oracle' | 'spoken'
const ORDER: Step[] = ['letter', 'name', 'look', 'goal', 'level', 'oracle', 'spoken']
/** the dots at the top: the four choices after the letter */
const DOTS: Step[] = ['name', 'look', 'goal', 'level']

export const GRIMOIRE = ['Beginner Grimoire', 'Elementary Grimoire', 'Intermediate Grimoire', 'Upper-Intermediate Grimoire', 'Advanced Grimoire']
const LEVEL_CARDS = [
  { t: "I'm new to English", s: 'First words and simple sentences.' },
  { t: 'I know the basics', s: 'I can talk about myself, my family and my day.' },
  { t: 'I can handle daily life', s: 'I follow everyday talk and simple stories.' },
  { t: "I'm fairly confident", s: 'I discuss many topics and read most texts.' },
  { t: "I'm advanced", s: 'I want to polish complex grammar and rich words.' },
]
const GOALS = [
  { n: 1, t: 'Casual', s: '1 stage a day · about 5 minutes' },
  { n: 2, t: 'Regular', s: '2 stages a day · about 10 minutes' },
  { n: 3, t: 'Serious', s: '3 stages a day · about 15 minutes' },
]

/** the server's oracle-trial items (a few per level) merged with the local bank (it adds vocabulary and reading) */
function toBank(items: Awaited<ReturnType<typeof api.placementItems>>): OracleQ[] {
  const srv: OracleQ[] = items.filter((q) => q.payload?.prompt && q.payload?.answer && Array.isArray(q.payload?.wrong)).map((q) => ({
    id: q.qid, level: Math.max(0, LEVELS.indexOf(q.level as typeof LEVELS[number])),
    skill: 'Grammar', prompt: String(q.payload.prompt), answer: String(q.payload.answer), wrong: (q.payload.wrong as unknown[]).map(String).slice(0, 3),
  }))
  return [...srv, ...ORACLE_BANK]
}

export function Onboarding({ onDone, onWardrobe, onLook }: {
  /** the intro is finished: `level` is where the guided first stage opens */
  onDone: (level: string) => void
  /** open the full 3D wardrobe; the intro stays on the look step */
  onWardrobe: () => void
  /** a quick look was picked (the avatar picture is retaken) */
  onLook: () => void
}) {
  const { account, patchMe, mode } = useGame()
  const startAt = (() => {
    const i = Number(account?.flags?.intro_step ?? 0)
    const s = ORDER[i] ?? 'name'
    // admin 6288: the welcome letter is gone (login already asks new vs returning); a saved 'letter' step opens the name step
    return s === 'oracle' || s === 'spoken' ? 'level' : s === 'letter' ? 'name' : s
  })()
  const [step, setStep] = useState<Step>(startAt)
  const [name, setName] = useState(account && !unnamed(account.display_name) ? account.display_name : '')
  const [nameErr, setNameErr] = useState<string | null>(null)
  const [look, setLook] = useState<'boy' | 'girl' | null>(() => { try { return localStorage.getItem('girl') === '1' ? 'girl' : null } catch { return null } })
  const [goal, setGoal] = useState<number | null>(account?.daily_goal ?? null)
  const [level, setLevel] = useState<number | null>(null)
  const [placed, setPlaced] = useState<number | null>(null)
  const [bank, setBank] = useState<OracleQ[] | null>(null)
  const [busy, setBusy] = useState(false)

  // remember the step on the account (fire and forget: the intro never waits for it)
  const go = (s: Step) => {
    setStep(s)
    patchMe({ flags: { intro_step: ORDER.indexOf(s) } }).catch(() => { /* offline: the step is only a resume hint */ })
  }
  // the placement bank loads while the player is still on the level cards
  useEffect(() => {
    if (step !== 'level' || bank) return
    api.placementItems(6).then((it) => setBank(toBank(it))).catch(() => setBank(ORACLE_BANK))
  }, [step, bank])

  const saveName = async () => {
    if (!nameOk(name) || busy) return
    setBusy(true); setNameErr(null)
    try { await patchMe({ display_name: name.trim() }); go('look') } catch (e) { setNameErr(errorText(e)) }
    setBusy(false)
  }
  const pickLook = (l: 'boy' | 'girl') => {
    setLook(l)
    // the 3D wardrobe's own keys (same origin): body type + the matching starter hair (Short / Long)
    try {
      localStorage.setItem('girl', l === 'girl' ? '1' : '0'); localStorage.setItem('hairPick', l === 'girl' ? '1' : '0')
      localStorage.removeItem('rc.portrait')
    } catch { /* private mode: the default look stays */ }
  }
  const saveLook = () => {
    // Phase B: the look lives on the account too (it used to stay in this browser only)
    if (look) { onLook(); patchMe({ flags: { look } }).catch(() => {}); if (mode === 'http') api.saveLook(lsToLook()).catch(() => {}) }
    go('goal')
  }
  const saveGoal = async (n: number | null) => {
    if (n) patchMe({ daily_goal: n }).catch(() => {})
    go('level')
  }
  const finish = async (lv: number) => {
    setBusy(true)
    const code = LEVELS[lv]
    try {
      await patchMe({ level: code, onboarded: true, flags: { tour: 'pending', guided: 'pending', intro_step: ORDER.length, ...(placed != null ? { placement: LEVELS[placed] } : {}) } })
      try { localStorage.removeItem('es.map.seen.v2') } catch { /* the map plans its walk from scratch */ }
      onDone(code)
    } catch (e) {
      setNameErr(errorText(e)); setBusy(false)
    }
  }

  const dot = DOTS.indexOf(step === 'oracle' || step === 'spoken' ? 'level' : step)
  // admin 6056/6062: every intro step is written on the full-screen letter (mockup B); the hero waves on the first one
  // admin 6070: every intro step uses the same mock-B letter and the same slots as the sign-in screen: the step
  // content in the content box (scrolls inside when long), the first action in the primary button slot, the rest in
  // the secondary slot, so the buttons never move between steps. The step name stays in the code as the frame key.
  const frame = (tag: string, content: ReactNode, actions: ReactNode) => {
    const acts = Children.toArray(isValidElement<{ children?: ReactNode }>(actions) ? actions.props.children : actions)
    return (
      <div className="stage-host full ob ob-b" data-step={tag}>
        <ScrollSheet primary={acts[0]} secondary={acts.length > 1 ? <>{acts.slice(1)}</> : undefined} top={dot >= 0 ? (
            <div className="ob-dots" aria-label={`Step ${dot + 1} of ${DOTS.length}`}>
              {DOTS.map((d, i) => <i key={d} className={i < dot ? 'done' : i === dot ? 'on' : ''} />)}
            </div>
          ) : undefined}>
          <div className="ob-in pop" key={step}>{content}</div>
        </ScrollSheet>
      </div>
    )
  }

  if (step === 'oracle') return (
    <div className="stage-host full ob-oracle">
      <div className="sky" />
      <Suspense fallback={<div className="game-wait">…</div>}>
        <OracleTrial items={[]} onFinish={() => {}} placement={{ bank: bank ?? ORACLE_BANK, onPlaced: (lv) => { setPlaced(lv); go('spoken') }, onExit: () => go('level') }} />
      </Suspense>
    </div>
  )

  if (step === 'name') return frame(
    "Your name", <>
      <h2 className="sl-title sm">What shall we call you?</h2>
      <p className="sl-sum">Other players will see this name in the weekly league.</p>
      <NameField value={name} onChange={(v) => { setName(v); setNameErr(null) }} onEnter={saveName} />
      {nameErr && <p className="nm-err">{nameErr}</p>}
    </>,
    <>
      <Btn className="lg ob-main" onClick={saveName} disabled={!nameOk(name) || busy}>{busy ? 'Signing…' : 'Sign the scroll'}</Btn>
      <button className="cb cb-white ob-sec" onClick={() => go('look')}>Skip</button>
    </>,
  )

  if (step === 'look') return frame(
    "Your look", <>
      <h2 className="sl-title sm">Who walks the path?</h2>
      <div className="ob-looks">
        {([['boy', faceBoy, 'Boy'], ['girl', faceGirl, 'Girl']] as const).map(([id, src, label]) => (
          <button key={id} className={`ob-look${look === id ? ' on' : ''}`} onClick={() => pickLook(id)} aria-pressed={look === id}>
            <img src={src} alt="" draggable={false} />
            <b>{label}</b>
          </button>
        ))}
      </div>
      <p className="sl-sum ob-small">Hair, robes, hats and colours wait in the wardrobe.</p>
    </>,
    <>
      <Btn className="lg ob-main" onClick={saveLook} disabled={!look}>This is me</Btn>
      <div className="ob-row2">
        <button className="cb cb-white ob-sec" onClick={() => { if (look) onLook(); patchMe({ flags: { look: 'custom' } }).catch(() => {}); onWardrobe() }}>Open the wardrobe</button>
        <button className="cb cb-white ob-sec" onClick={() => go('goal')}>Skip</button>
      </div>
    </>,
  )

  if (step === 'goal') return frame(
    "Daily vow", <>
      <h2 className="sl-title sm">How much magic a day?</h2>
      <div className="ob-opts">
        {GOALS.map((g) => (
          <button key={g.n} className={`ob-opt${goal === g.n ? ' on' : ''}`} onClick={() => setGoal(g.n)} aria-pressed={goal === g.n}>
            <span className="ob-opt-n">{g.n}</span>
            <span className="ob-opt-tx"><b>{g.t}</b><small>{g.s}</small></span>
          </button>
        ))}
      </div>
      <p className="sl-sum ob-small">Your daily quest follows your vow. You can play more any time.</p>
    </>,
    <>
      <Btn className="lg ob-main" onClick={() => saveGoal(goal)} disabled={!goal}>I vow it</Btn>
      <button className="cb cb-white ob-sec" onClick={() => saveGoal(null)}>Skip</button>
    </>,
  )

  if (step === 'level') return frame(
    "The Oracle", <>
      <h2 className="sl-title sm">How well do you know English?</h2>
      <div className="ob-opts ob-lvopts">
        {LEVEL_CARDS.map((c, i) => (
          <button key={i} className={`ob-opt${level === i ? ' on' : ''}`} onClick={() => setLevel(i)} aria-pressed={level === i}>
            <span className="ob-opt-n ob-lv">{LEVELS[i]}</span>
            <span className="ob-opt-tx"><b>{c.t}</b><small>{c.s}</small></span>
          </button>
        ))}
      </div>
      <button className="ob-link" onClick={() => finish(0)} disabled={busy}>Skip: start at the very beginning</button>
    </>,
    <>
      <Btn className="lg ob-main" onClick={() => level != null && finish(level)} disabled={level == null || busy}>
        {level == null ? 'Choose a level' : `Begin at ${LEVELS[level]}`}
      </Btn>
      {/* admin 6101: the Oracle offer sits in the secondary slot, so all five levels fit in the content box */}
      <button className="ob-oracle-btn" onClick={() => go('oracle')}>
        <img src={oracleIdle} alt="" draggable={false} />
        <span><b>Not sure? Let the Oracle test you</b><small>12 questions · about 3 minutes</small></span>
      </button>
      {nameErr && <p className="nm-err">{nameErr}</p>}
    </>,
  )

  // 'spoken': the Oracle's verdict
  const lv = placed ?? 0
  return frame(
    "The verdict", <>
      <img className="ob-oracle-face" src={oracleHappy} alt="" draggable={false} />
      <p className="ob-big">{LEVELS[lv]}</p>
      <h2 className="sl-title sm">{GRIMOIRE[lv]}</h2>
      <p className="sl-sum">{lv === 0 ? 'Your path begins at the very first page. Every great mage started here.'
        : `Your path begins in the ${GRIMOIRE[lv]}. The earlier grimoires stay open if you want to look back.`}</p>
    </>,
    <>
      <Btn className="lg ob-main" onClick={() => finish(lv)} disabled={busy}>Begin at {LEVELS[lv]}</Btn>
      {lv > 0 && <button className="cb cb-white ob-sec" onClick={() => finish(lv - 1)} disabled={busy}>Start at {LEVELS[lv - 1]}</button>}
      {nameErr && <p className="nm-err">{nameErr}</p>}
    </>,
  )
}

/** the stage the guided first run opens: the first stage of the chosen level's first world */
export function firstStageOf<S extends { status: string }>(worlds: { cefr?: string; stages: S[] }[], level: string): S | null {
  const w = worlds.find((x) => x.cefr === level)
  const s = w?.stages[0]
  return s && s.status === 'current' ? s : null
}

export const useIntroNeeded = () => {
  const { mode, account } = useGame()
  return useMemo(() => mode === 'http' && !!account && account.onboarded === false, [mode, account])
}
