// Phase C (UX audit 10-11, admin 4814): what every mini-game shares around a stage.
//  - StageCtl: the host tells a game whether it is paused, in Focus mode or a tutorial practice item, and gives it
//    `wrong()`, the one wrong-answer card all games use (right answer, one-line rule, "Why?").
//  - Tutorial: the first-time spotlight (dimmed scene with holes on the question and the answer area), the ghost
//    hand demo, then one untimed practice item; the "?" button in the booster tray replays it.
// Games mark their question panel with data-coach="q", their answer area with data-coach="a", and (in practice
// only) the elements the ghost hand taps with data-demo="<order>".
// Phase E (admin 4847): an answer area that is mostly painted scene (a tall board, a field) names its real parts with
// data-coach-parts="<selector>": the tutorial hole is then the box around those parts only, and Focus mode lights each
// part on its own. Anything else Focus mode must keep visible (an action button, the innkeeper's line) is marked
// data-focus-keep.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import oracleIdle from '../assets/games/oracle/oracle_idle.webp'
import { API_BASE } from '../services/api'
import type { ServerQuestion } from '../types/game'
import './coach.css'

// ------------------------------------------------------------------ stage control
export interface WrongInfo {
  /** the right answer, as the player should remember it */
  answer: string
  /** the caption above it ("The right answer", "The right order", ...) */
  label?: string
  /** what the player chose (shown struck through) */
  yours?: string
  /** a short meaning line under the answer (Bubble Pop synonyms: the definition) */
  meaning?: string
  rule?: string
  why?: string
}
export interface StageCtl {
  /** a wrong answer: the shared card; resolves when the player taps "Got it" (no host: after `fallbackMs`) */
  wrong: (info: WrongInfo, fallbackMs?: number) => Promise<void>
  /** a card, a tutorial or the 3-2-1 is on screen: timed games freeze their clock */
  paused: boolean
  /** Focus mode: no timers, calm screen */
  focus: boolean
  /** the tutorial's practice item: untimed, nothing is recorded */
  practice: boolean
}
const NO_HOST: StageCtl = { wrong: (_i, ms = 1000) => new Promise((r) => setTimeout(r, ms)), paused: false, focus: false, practice: false }
export const StageCtlCtx = createContext<StageCtl>(NO_HOST)
export const useStageCtl = () => useContext(StageCtlCtx)
/** timed games read the latest pause state from timers without re-creating them */
export function usePausedRef() {
  const c = useStageCtl()
  const r = useRef(false)
  r.current = c.paused
  return r
}

const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined)
/** the explanation fields of a payload (DeepSeek explain pass 10-11: payload.why / payload.rule) */
export function explain(p: any): { rule?: string; why?: string } {
  return { rule: str(p?.rule), why: str(p?.why) }
}
/** the payload of one server question of this round (SrsItem games only know the qid) */
export function payloadOf(srv: { qid: string; payload: any }[] | undefined, qid: string | undefined): any {
  return (qid && srv?.find((q) => q.qid === qid)?.payload) || {}
}

/** Bubble Pop items (all vocabulary rows): synonym mode (payload.mode 'synonym', 1-2 word synonyms, admin 4817) or
 *  definition mode ('definition', syn_ok = false). Both keep the definition in payload.definition. */
export function bubbleMode(p: any): 'syn' | 'def' {
  if (!p) return 'def'
  if (p.mode === 'syn' || p.mode === 'synonym') return 'syn'
  if (p.mode === 'def' || p.mode === 'definition' || p.syn_ok === false) return 'def'
  return str(p.definition) ? 'syn' : 'def'
}

// ------------------------------------------------------------------ the wrong-answer card
function WrongCard({ info, onDone }: { info: WrongInfo; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const go = useRef<HTMLButtonElement>(null)
  useEffect(() => { go.current?.focus({ preventScroll: true }) }, [])
  return (
    <div className="wfb-scrim" onClick={(e) => e.stopPropagation()}>
      <div className="wfb" role="alertdialog" aria-label="Not quite">
        <div className="wfb-head">
          <span className="wfb-x" aria-hidden><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" /></svg></span>
          <b>Not quite</b>
          {info.yours && <s className="wfb-yours">{info.yours}</s>}
        </div>
        <div className={`wfb-ans${info.answer.length > 60 ? ' long' : ''}`}>
          <small>{info.label ?? 'The right answer'}</small>
          <b>{info.answer}</b>
          {info.meaning && <span className="wfb-mean">{info.meaning}</span>}
        </div>
        {info.rule && (
          <p className="wfb-rule"><span aria-hidden><svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" /></svg></span>{info.rule}</p>
        )}
        {info.why && (open
          ? <p className="wfb-why">{info.why}</p>
          : <button className="wfb-whybtn" onClick={() => setOpen(true)}>Why?</button>)}
        <button ref={go} className="cb cb-green wfb-go" onClick={onDone}>Got it</button>
      </div>
    </div>
  )
}

/** host side of `wrong()`: the card state and its element */
export function useWrongCard() {
  const [card, setCard] = useState<{ info: WrongInfo; done: () => void } | null>(null)
  const wrong = useCallback((info: WrongInfo) => new Promise<void>((done) => setCard({ info, done })), [])
  const el = card ? <WrongCard key={card.info.answer + (card.info.yours ?? '')} info={card.info} onDone={() => { setCard(null); card.done() }} /> : null
  return { open: !!card, wrong, el }
}

// ------------------------------------------------------------------ tutorials
type Line = { look: string; demo: string }
export const TUT: Record<string, Line> = {
  'bubble-pop': { look: 'Read the word at the top. Find the bubble with the same meaning.', demo: 'Tap that bubble before the timer runs out.' },
  'match-blitz': { look: 'Words on the left, meanings on the right.', demo: 'Drag from a word to its meaning to link them.' },
  'memory-crystals': { look: 'Each crystal hides a word or its meaning. Remember where they are!', demo: 'Flip two crystals that belong together.' },
  'gap-gate': { look: 'The meaning is on the tablet. Which word is it?', demo: 'Tap the missing word to open the gate.' },
  'oracle-trial': { look: 'Read the sentence. One word is missing.', demo: 'Choose the answer, then tap Check.' },
  'rune-order': { look: 'The words of a sentence are mixed up.', demo: 'Tap them in the right order, then tap Cast.' },
  'whisper-scroll': { look: 'The scroll whispers a sentence. Two words are missing.', demo: 'Tap the words you hear, then tap Check.' },
  'tavern-talk': { look: 'Talk to the innkeeper and finish your mission.', demo: 'Tap what you would say, or use the mic.' },
  'echo': { look: 'Listen to the cave, then say the sentence aloud.', demo: 'Tap the mic and repeat it.' },
  'rune-type': { look: 'Read the clue and listen to the word.', demo: 'Tap the letters to spell it.' },
  'potion-mix': { look: 'Brew one word from two parts.', demo: 'Pour the parts in order, then tap Brew.' },
  'curse-breaker': { look: 'One word in the sentence is cursed: it is wrong.', demo: 'Tap the wrong word, then pick the right one.' },
  'spell-weaver': { look: 'Change the sentence the way the card says.', demo: 'Tap the pieces in order, then tap Weave.' },
  'crystal-ball': { look: 'Two people talk in the vision. Listen well.', demo: 'Play it, then answer the questions about it.' },
  'bards-tale': { look: 'The lines of a story are mixed up.', demo: 'Tap them from first to last, then tell the tale.' },
  'guild-letters': { look: 'Read the letter, then write a short reply.', demo: 'Type your reply and send it with the owl.' },
  'boss-battle': { look: 'Every right answer hits the boss. A wrong one costs you a heart.', demo: 'Tap the right answer.' },
}
export const TIMED = new Set(['bubble-pop', 'match-blitz'])
/** how many sample items one practice run needs (pair games need a small board) */
const PRACTICE_N: Record<string, number> = { 'match-blitz': 3, 'memory-crystals': 3, 'gap-gate': 4 }

/** a few easy items of one game from the server (no auth, not graded); null when offline */
export async function fetchSamples(game: string, level = 'A1', n = PRACTICE_N[game] ?? 1): Promise<ServerQuestion[] | null> {
  try {
    const r = await fetch(`${API_BASE}/v1/samples/${game}?level=${level}&n=${n}`)
    if (!r.ok) return null
    const qs = (await r.json()) as ServerQuestion[]
    return qs.length ? qs.map((q, i) => ({ ...q, qid: `tut:${q.qid}:${i}` })) : null
  } catch { return null }
}

const LS_TUT = 'rc.tut', LS_FOCUS = 'rc.focus'
function lsGet(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

/** the games whose tutorial this player has seen: the account flag `tut` (server), localStorage in mock previews.
 *  ?tut=1 shows every tutorial again, ?tut=0 skips them (previews and checks). */
export function useTutorials(flags: { tut?: string[] | string } | undefined, save: ((games: string[]) => void) | null) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tut') : null
  const [local, setLocal] = useState<string[]>(() => { try { return JSON.parse(lsGet(LS_TUT) ?? '[]') } catch { return [] } })
  const seen = useMemo(() => new Set([...(save && Array.isArray(flags?.tut) ? flags!.tut as string[] : []), ...local]), [flags?.tut, local, save])
  const need = useCallback((game: string) => (q === '0' ? false : q === '1' ? true : !seen.has(game)) && !!TUT[game], [seen, q])
  const mark = useCallback((game: string) => {
    if (seen.has(game) && q !== '1') return
    const next = [...new Set([...local, game])]
    setLocal(next); lsSet(LS_TUT, JSON.stringify(next))
    save?.([game])
  }, [seen, local, save, q])
  return { need, mark }
}

/** Focus mode on/off: the account flag `focus` (server), localStorage in mock previews */
export function useFocusPref(flags: { focus?: string } | undefined, save: ((on: boolean) => void) | null) {
  const [local, setLocal] = useState(() => lsGet(LS_FOCUS) === 'on')
  const on = save && flags?.focus ? flags.focus === 'on' : local
  const set = useCallback((v: boolean) => { setLocal(v); lsSet(LS_FOCUS, v ? 'on' : 'off'); save?.(v) }, [save])
  return [on, set] as const
}

// ---- the spotlight overlay
export type Box = { x: number; y: number; w: number; h: number }
const PAD = 8
type R = { l: number; t: number; r: number; b: number }
const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width >= 4 && r.height >= 4 && getComputedStyle(el).visibility !== 'hidden' }
const rectOf = (el: Element): R => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom } }
const union = (rs: R[]): R => rs.reduce((a, c) => ({ l: Math.min(a.l, c.l), t: Math.min(a.t, c.t), r: Math.max(a.r, c.r), b: Math.max(a.b, c.b) }))

/** the lit areas of a game root, in host coordinates.
 *  mode 'tut': one box per data-coach / data-focus-keep element (an area with data-coach-parts shrinks to the box
 *  around its parts; the action buttons are lit too, the ghost hand taps them);
 *  mode 'focus': the question, each answer part on its own, and every data-focus-keep element. */
export function boxesIn(root: HTMLElement | null, host: HTMLElement | null, mode: 'tut' | 'focus' = 'tut', pad = PAD): Box[] {
  if (!root || !host) return []
  const H = host.getBoundingClientRect()
  const rs: R[] = []
  root.querySelectorAll<HTMLElement>('[data-coach], [data-focus-keep]').forEach((el) => {
    if (!visible(el)) return
    const sel = el.dataset.coachParts
    const parts = sel ? [...el.querySelectorAll(sel)].filter(visible) : []
    if (!parts.length) rs.push(rectOf(el))
    else if (mode === 'focus') parts.forEach((p) => rs.push(rectOf(p)))
    else rs.push(union(parts.map(rectOf)))
  })
  return rs.map((r) => {
    const x = Math.max(2, r.l - H.left - pad), y = Math.max(2, r.t - H.top - pad)
    return { x, y, w: Math.min(H.width - 2, r.r - H.left + pad) - x, h: Math.min(H.height - 2, r.b - H.top + pad) - y }
  }).filter((b) => b.w > 0 && b.h > 0)
}

/** where a card of height `ch` covers the least of the holes (ties: the middle of the biggest free band); null = centred */
export function placeCard(boxes: Box[], hostH: number, ch: number, top = 64, bottom = 16): number | null {
  const lo = top, hi = hostH - bottom - ch
  if (hi < lo) return null
  const cover = (y: number) => boxes.reduce((s, b) => s + Math.max(0, Math.min(y + ch, b.y + b.h) - Math.max(y, b.y)) * b.w, 0)
  // free bands first: the biggest band that fits the card, centred in it
  const ys = boxes.map((b) => [b.y, b.y + b.h]).sort((a, b) => a[0] - b[0])
  const gaps: [number, number][] = []
  let at = lo
  for (const [a, b] of ys) { if (a > at) gaps.push([at, a]); at = Math.max(at, b) }
  if (hostH - bottom > at) gaps.push([at, hostH - bottom])
  const fit = gaps.filter(([a, b]) => b - a >= ch + 12).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0]
  if (fit) return Math.round(fit[0] + (fit[1] - fit[0] - ch) / 2)
  // no free band: slide the card to where it hides the least of the lit areas
  let best = lo, bestC = Infinity
  for (let y = lo; y <= hi; y += 6) { const c = cover(y); if (c < bestC - 1) { best = y; bestC = c } }
  return best
}
function demoTargets(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>('[data-demo]')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden' })
    .sort((a, b) => Number(a.dataset.demo) - Number(b.dataset.demo))
}

export type TutStep = 'look' | 'demo' | 'try' | 'ready' | 'count'

/** the dimmed spotlight with the coach line; on 'demo' the ghost hand taps the practice item's right answer once */
export function Spotlight({ game, step, getRoot, getHost, onNext, onSkip, canDemo }: {
  game: string; step: 'look' | 'demo'; getRoot: () => HTMLElement | null; getHost: () => HTMLElement | null
  onNext: () => void; onSkip: () => void; canDemo: boolean
}) {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hand, setHand] = useState<{ x: number; y: number; tap: number; on: boolean }>({ x: 0, y: 0, tap: 0, on: false })
  const [demoDone, setDemoDone] = useState(false)
  const coach = useRef<HTMLDivElement>(null)
  const [coachAt, setCoachAt] = useState<number | null>(null)

  // measure the holes now and while the scene settles (titles slide in, fonts load)
  useLayoutEffect(() => {
    let alive = true
    const m = () => {
      const host = getHost(), root = getRoot()
      if (!alive || !host) return
      const H = host.getBoundingClientRect()
      setSize({ w: H.width, h: H.height })
      setBoxes(boxesIn(root, host))
    }
    m()
    const t = setInterval(m, 400)
    addEventListener('resize', m)
    return () => { alive = false; clearInterval(t); removeEventListener('resize', m) }
  }, [getRoot, getHost, step])

  // the coach card goes into the biggest free band; with none, where it hides the least of the lit areas
  useLayoutEffect(() => {
    const ch = coach.current?.offsetHeight ?? 90
    if (!size.h) return
    setCoachAt(placeCard(boxes, size.h, ch))
  }, [boxes, size, step])

  // ghost hand: glide to each target, tap it (a ripple + a press glow on the element), then rest
  useEffect(() => {
    if (step !== 'demo') return
    setDemoDone(false)
    const root = getRoot(), host = getHost()
    const els = canDemo ? demoTargets(root) : []
    if (!els.length || !host) { setDemoDone(true); return }
    let alive = true
    const H = host.getBoundingClientRect()
    const at = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.left - H.left + r.width * 0.55, y: r.top - H.top + r.height * 0.6 } }
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      const first = at(els[0])
      setHand({ x: first.x + 40, y: first.y + 120, tap: 0, on: true })
      await wait(450)
      for (let i = 0; i < els.length && alive; i++) {
        const p = at(els[i])
        setHand((h) => ({ ...h, x: p.x, y: p.y }))
        await wait(720)
        if (!alive) return
        setHand((h) => ({ ...h, tap: h.tap + 1 }))
        els[i].classList.add('gh-press')
        await wait(420)
        els[i].classList.remove('gh-press')
      }
      await wait(300)
      if (alive) { setHand((h) => ({ ...h, on: false })); setDemoDone(true) }
    })()
    return () => { alive = false; els.forEach((e) => e.classList.remove('gh-press')) }
  }, [step, getRoot, getHost, canDemo])

  const t = TUT[game]
  return (
    <div className="tut" role="dialog" aria-label="How to play">
      <svg className="tut-dim" width={size.w} height={size.h} aria-hidden>
        <defs>
          <mask id="tut-holes">
            <rect width="100%" height="100%" fill="#fff" />
            {boxes.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="18" fill="#000" />)}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(8, 5, 26, .84)" mask="url(#tut-holes)" />
        {boxes.map((b, i) => <rect key={'g' + i} className="tut-glow" x={b.x} y={b.y} width={b.w} height={b.h} rx="18" />)}
        {boxes.map((b, i) => <rect key={i} className="tut-ring" x={b.x} y={b.y} width={b.w} height={b.h} rx="18" />)}
      </svg>
      {/* taps on the dim do nothing; the holes stay visible but the game waits for the coach */}
      <div className="tut-block" />
      <div ref={coach} className={`tut-coach tut-in${coachAt == null ? ' tut-coach-mid' : ''}`} style={coachAt == null ? undefined : { top: coachAt }}>
        <div className="tut-line">
          <img src={oracleIdle} alt="" draggable={false} />
          <p>{step === 'look' ? t.look : t.demo}</p>
        </div>
        <div className="tut-btns">
          <button className="cb cb-white tut-skip" onClick={onSkip}>Skip</button>
          {step === 'look'
            ? <button className="cb cb-violet tut-next" onClick={onNext}>{canDemo ? 'Show me' : "Let's play"}</button>
            : <button className="cb cb-green tut-next" disabled={!demoDone} onClick={onNext}>Your turn</button>}
        </div>
      </div>
      {hand.on && (
        <div className="gh-hand" style={{ transform: `translate(${hand.x}px, ${hand.y}px)` }} aria-hidden>
          <span key={hand.tap} className={hand.tap ? 'gh-ripple' : ''} />
          <svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4.2 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16" /></svg>
        </div>
      )}
    </div>
  )
}

/** Phase E (admin 4847, Q11): Focus mode is BLACK. A black veil over the whole scene with tight windows on the
 *  question, each answer part and the data-focus-keep elements (action buttons, a spoken line). The veil does not
 *  catch taps; the game underneath plays as usual. */
export function FocusVeil({ getRoot, getHost }: { getRoot: () => HTMLElement | null; getHost: () => HTMLElement | null }) {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    let alive = true
    const m = () => {
      const host = getHost()
      if (!alive || !host) return
      const H = host.getBoundingClientRect()
      setSize((s) => (s.w === H.width && s.h === H.height ? s : { w: H.width, h: H.height }))
      const next = boxesIn(getRoot(), host, 'focus', 4)
      setBoxes((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next))
    }
    m()
    const t = setInterval(m, 250)
    addEventListener('resize', m)
    return () => { alive = false; clearInterval(t); removeEventListener('resize', m) }
  }, [getRoot, getHost])
  return (
    <svg className="fx-veil" width={size.w} height={size.h} aria-hidden>
      <defs>
        <mask id="fx-holes">
          <rect width="100%" height="100%" fill="#fff" />
          {boxes.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="16" fill="#000" />)}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="#07060c" mask="url(#fx-holes)" />
    </svg>
  )
}

/** the practice banner (no dim) and the "now for real" card */
export function TutBanner() {
  return <div className="tut-banner tut-in" role="note"><b>Practice</b><span>No timer. It does not count.</span></div>
}
export function TutReady({ game, onGo }: { game: string; onGo: () => void }) {
  return (
    <div className="tut-scrim">
      <div className="tut-coach tut-ready tut-in">
        <div className="tut-line"><img src={oracleIdle} alt="" draggable={false} /><p>Well done! Now the real round.{TIMED.has(game) ? ' The clock starts after 3, 2, 1.' : ''}</p></div>
        <div className="tut-btns"><button className="cb cb-green tut-next" onClick={onGo}>Start</button></div>
      </div>
    </div>
  )
}
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3)
  useEffect(() => {
    if (n <= 0) { onDone(); return }
    const t = setTimeout(() => setN(n - 1), 650)
    return () => clearTimeout(t)
  }, [n, onDone])
  return <div className="tut-scrim tut-count" aria-live="polite">{n > 0 && <b key={n}>{n}</b>}</div>
}
