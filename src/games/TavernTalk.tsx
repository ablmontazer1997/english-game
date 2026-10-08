import { useEffect, useMemo, useRef, useState } from 'react'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import bgPlate from '../assets/games/tavern/tt_bg.webp'
import kIdle from '../assets/games/tavern/tt_idle.webp'
import kTalk from '../assets/games/tavern/tt_talk.webp'
import kHappy from '../assets/games/tavern/tt_happy.webp'
import kThink from '../assets/games/tavern/tt_think.webp'
import './taverntalk.css'

// Tavern Talk — a spoken role-play with a mission. Prototype: the shopkeeper
// follows a scripted branch (a live AI partner needs a server-side key, next
// step). She speaks through browser speech synthesis with a flapping mouth, and
// reacts to the player's choice. The player can tap a reply or say it aloud.

type Mood = 'idle' | 'happy' | 'think'
type Choice = { say: string; ok: boolean; reply?: string; mood?: Mood; next: number | 'end' | 'stay' }
type Node = { line: string; mood?: Mood; price?: number; choices: Choice[] }

const MISSION = 'Buy a healing potion for less than 10 coins'
const SCRIPT: Node[] = [
  { line: 'Welcome, traveler! What can I get you today?', choices: [
    { say: "I'd like a healing potion, please.", ok: true, next: 1 },
    { say: 'I want potion healing give.', ok: false, reply: 'Ah, you would like a healing potion!', mood: 'think', next: 1 },
    { say: 'Where is the library?', ok: false, reply: "The library? Up the hill. But you came for a potion, didn't you?", mood: 'think', next: 'stay' },
  ] },
  { line: 'Of course! This one is my finest. It costs fifteen coins.', price: 15, choices: [
    { say: "That's a bit expensive. Could you make it cheaper?", ok: true, next: 2 },
    { say: 'Fifteen coins? OK, here you go.', ok: false, reply: 'Hmm, your mission says less than ten coins. Try to haggle!', mood: 'think', next: 'stay' },
    { say: 'Is cheaper it can be?', ok: false, reply: 'Can it be cheaper? Let me think.', mood: 'think', next: 2 },
  ] },
  { line: 'Hmm. I could sell it for twelve coins.', mood: 'think', price: 12, choices: [
    { say: "How about eight coins? I'm just a poor apprentice.", ok: true, next: 3 },
    { say: 'Twelve is fine.', ok: false, reply: 'Still more than ten, my friend. Make me an offer!', mood: 'think', next: 'stay' },
    { say: 'I will paying eight.', ok: false, reply: "You'll pay eight? Hmm.", mood: 'think', next: 3 },
  ] },
  { line: "Eight? Ha! You drive a hard bargain. Nine coins, and it's yours.", mood: 'happy', price: 9, choices: [
    { say: 'Deal! Here are nine coins. Thank you so much!', ok: true, next: 'end' },
    { say: 'No. Give me it for free.', ok: false, reply: 'Free? Ha ha, no, no, no.', mood: 'think', next: 'stay' },
    { say: 'Deal! Thanks you very much.', ok: false, reply: 'Thank you very much, you mean? You are welcome!', mood: 'happy', next: 'end' },
  ] },
]
const END_LINE = "Here's your healing potion. Come back anytime!"

type Msg = { who: 'npc' | 'me'; text: string }

function speak(text: string, onState: (on: boolean) => void) {
  try {
    const s = window.speechSynthesis
    if (!s) { onState(false); return }
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'; u.rate = 1; u.pitch = 1.25
    const v = s.getVoices().find((x) => /en[-_](US|GB)/i.test(x.lang) && /female|samantha|zira|google us/i.test(x.name))
      || s.getVoices().find((x) => /en[-_]/i.test(x.lang))
    if (v) u.voice = v
    u.onstart = () => onState(true); u.onend = () => onState(false); u.onerror = () => onState(false)
    s.speak(u)
  } catch { onState(false) }
}

// word-overlap match of a spoken sentence to the closest reply
function closest(heard: string, choices: Choice[]): number {
  const w = (x: string) => new Set(x.toLowerCase().replace(/[^a-z' ]/g, '').split(' ').filter(Boolean))
  const h = w(heard)
  let best = -1, score = 0
  choices.forEach((c, i) => {
    const cw = w(c.say); let hit = 0
    cw.forEach((x) => { if (h.has(x)) hit++ })
    const s = hit / Math.max(cw.size, 1)
    if (s > score) { score = s; best = i }
  })
  return score >= 0.5 ? best : -1
}

export function TavernTalk({ onFinish, srv, onAnswer }: MiniGameProps) {
  // server mode: one scene per server item, played one after another
  const scenes = useMemo(() => srv ? srv.map((q) => ({ qid: q.qid as string | undefined, script: q.payload.script as Node[], mission: String(q.payload.mission ?? ''), end: String(q.payload.end ?? 'Goodbye!') }))
    : [{ qid: undefined as string | undefined, script: SCRIPT, mission: MISSION, end: END_LINE }], [srv])
  const [si, setSi] = useState(0)
  const sc = scenes[si]
  const picks = useRef<number[]>([])
  const [node, setNode] = useState(0)
  const [log, setLog] = useState<Msg[]>([{ who: 'npc', text: sc.script[0].line }])
  const [mood, setMood] = useState<Mood>('idle')
  const [talking, setTalking] = useState(false)
  const [mouth, setMouth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [listening, setListening] = useState(false)
  const [note, setNote] = useState('')
  const [hinted, setHinted] = useState<number | null>(null)
  const right = useRef(0), asked = useRef(0)
  const combo = useRef({ now: 0, max: 0 })
  const chatEnd = useRef<HTMLDivElement>(null)

  // mouth flaps while speaking: swap closed/open art ~7 times a second
  useEffect(() => {
    if (!talking) { setMouth(false); return }
    const t = setInterval(() => setMouth((m) => !m), 140)
    return () => clearInterval(t)
  }, [talking])

  const say = (text: string, m: Mood = 'idle') => {
    setMood(m)
    setLog((l) => [...l, { who: 'npc', text }])
    speak(text, setTalking)
  }
  useEffect(() => { const t = setTimeout(() => speak(sc.script[0].line, setTalking), 600); return () => { clearTimeout(t); try { window.speechSynthesis?.cancel() } catch { /* */ } } }, [si]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [log])

  useEffect(() => setHinted(null), [node])
  // hint: light up the reply a native speaker would give
  useHint(() => {
    if (busy || done) return false
    const i = sc.script[node].choices.findIndex((c) => c.ok)
    if (i < 0 || hinted === i) return false
    setHinted(i); return true
  })

  function choose(i: number) {
    if (busy || done) return
    const c = sc.script[node].choices[i]
    picks.current.push(i)
    if (c.next === 'end' && sc.qid) {
      // the scene is over: every choice made must have been the right one
      let nd = 0; const okAll = picks.current.every((k) => { const ch = sc.script[nd]?.choices[k]; if (!ch?.ok) return false; if (typeof ch.next === 'number') nd = ch.next; return true })
      onAnswer?.(sc.qid, [...picks.current], okAll)
    }
    asked.current++
    if (c.ok) { right.current++; combo.current.now++; combo.current.max = Math.max(combo.current.max, combo.current.now) } else combo.current.now = 0
    setLog((l) => [...l, { who: 'me', text: c.say }])
    setBusy(true); setNote('')
    setTimeout(() => {
      if (c.reply) say(c.reply, c.mood ?? 'idle')
      const go = () => {
        if (c.next === 'end') {
          say(sc.end, 'happy'); setDone(true)
        } else if (c.next !== 'stay') {
          setNode(c.next); say(sc.script[c.next].line, sc.script[c.next].mood ?? (c.ok ? 'happy' : 'idle'))
        }
        setBusy(false)
      }
      if (c.reply) setTimeout(go, c.next === 'stay' ? 200 : 2600); else go()
    }, 500)
  }

  function mic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setNote('Voice input is not supported in this browser. Tap a reply instead.'); return }
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 3
    setListening(true); setNote('')
    r.onresult = (e: any) => {
      const heard = Array.from(e.results[0]).map((x: any) => x.transcript)
      let idx = -1
      for (const h of heard) { idx = closest(h as string, sc.script[node].choices); if (idx >= 0) break }
      if (idx >= 0) choose(idx); else setNote(`I heard: "${heard[0]}". Try one of the replies.`)
    }
    r.onerror = () => setNote('I could not hear you. Try again or tap a reply.')
    r.onend = () => setListening(false)
    r.start()
  }

  const art = talking ? (mouth ? kTalk : (mood === 'happy' ? kHappy : kIdle)) : mood === 'happy' ? kHappy : mood === 'think' ? kThink : kIdle
  const price = sc.script[node].price

  return (
    <div className={`tt${done ? ' tt-done' : ''}`}>
      <img className="tt-plate" src={bgPlate} alt="" draggable={false} />
      <GameTitle title="Tavern Talk" />

      <div className="tt-mission lp">
        <Task className="gtask-row" icon="speak" text="Pick what you would say" sub="Or tap the mic and say it" first={si === 0 && node === 0} />
        <span className="tt-coin">🪙</span>
        <div><b>Mission</b><p>{sc.mission}</p></div>
        {price != null && <span className={`tt-price${price < 10 ? ' ok' : ''}`}>{price}</span>}
      </div>

      <div className="tt-keeper" aria-hidden>
        <div className="tt-keeper-float">
          {[kIdle, kTalk, kHappy, kThink].map((src) => <img key={src} src={src} alt="" draggable={false} className={src === art ? 'on' : ''} />)}
        </div>
      </div>

      <div className="tt-ui">
        <div className="tt-chat">
          {log.slice(-2).map((m, i) => <div key={log.length - 2 + i} className={`tt-msg ${m.who}`}>{m.text}</div>)}
          <div ref={chatEnd} />
        </div>
        {note && <div className="tt-note">{note}</div>}
        {!done ? (
          <div className="tt-choices">
            {sc.script[node].choices.map((c, i) => (
              <button key={node + ':' + i} className={`tt-choice${hinted === i ? ' hinted' : ''}`} disabled={busy} onClick={() => choose(i)}>{c.say}</button>
            ))}
            <button className={`tt-mic${listening ? ' on' : ''}`} aria-label="Say it" onClick={mic} disabled={busy}>
              <svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z" /></svg>
            </button>
          </div>
        ) : (
          <button className="cb cb-green tt-finish" onClick={() => {
            if (si + 1 < scenes.length) {
              // next scene: a new mission with a new partner line
              const nx = scenes[si + 1]
              picks.current = []; setSi(si + 1); setNode(0); setDone(false); setMood('idle'); setNote('')
              setLog([{ who: 'npc', text: nx.script[0].line }])
              return
            }
            onFinish({ correct: right.current, total: asked.current, maxCombo: combo.current.max })
          }}>
            Mission complete!
          </button>
        )}
      </div>
    </div>
  )
}
