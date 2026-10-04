import { useEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameProps } from './types'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import bgPlate from '../assets/games/whisper/ws_bg.webp'
import scrollImg from '../assets/games/whisper/ws_scroll.webp'
import './whisperscroll.css'

// Whisper Scroll — listening. The scroll whispers a sentence (browser speech
// synthesis, free, no network); two words on the parchment are missing. Tap the
// words you heard into the gaps. Replay and a slow replay are always free.

type Line = { text: string; gaps: number[]; extra: string[] } // gaps = word indexes hidden
const LINES: Line[] = [
  { text: 'I left my keys on the table this morning', gaps: [3, 6], extra: ['kitchen', 'coat', 'garden'] },
  { text: 'The ship sails north when the moon is full', gaps: [3, 8], extra: ['south', 'sun', 'sells'] },
  { text: 'Could you bring me a cup of warm tea', gaps: [2, 7], extra: ['buy', 'cold', 'cap'] },
  { text: 'We heard a strange noise behind the door', gaps: [1, 4], extra: ['had', 'window', 'nose'] },
  { text: 'The old wizard lives at the top of the hill', gaps: [3, 9], extra: ['cold', 'mill', 'leaves'] },
]
const OK_MS = 1300
const BAD_MS = 1100

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]] }
  return b
}

function speak(text: string, rate: number, onState: (on: boolean) => void) {
  try {
    const s = window.speechSynthesis
    if (!s) return
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'; u.rate = rate
    const v = s.getVoices().find((x) => /en[-_](US|GB)/i.test(x.lang))
    if (v) u.voice = v
    u.onstart = () => onState(true); u.onend = () => onState(false); u.onerror = () => onState(false)
    s.speak(u)
  } catch { onState(false) }
}

export function WhisperScroll({ onFinish, srv, onAnswer }: MiniGameProps) {
  const lines = useMemo<Line[]>(() => srv ? srv.map((q) => ({ text: String(q.payload.text ?? ''), gaps: q.payload.gaps ?? [], extra: q.payload.extra ?? [] })) : LINES, [srv])
  const [round, setRound] = useState(0)
  const line = lines[round]
  const words = useMemo(() => line.text.split(' '), [line])
  const options = useMemo(() => shuffle([...line.gaps.map((g) => words[g]), ...line.extra]), [line, words])
  const [fill, setFill] = useState<string[]>([])
  const [state, setState] = useState<'play' | 'ok' | 'bad'>('play')
  const [talking, setTalking] = useState(false)
  const right = useRef(0)
  const combo = useRef({ now: 0, max: 0 })

  useEffect(() => {
    setFill([]); setState('play')
    const t = setTimeout(() => speak(line.text, 0.95, setTalking), 500) // whisper once on arrival
    return () => { clearTimeout(t); try { window.speechSynthesis?.cancel() } catch { /* no speech */ } }
  }, [line])

  // hint: keep the right words so far and fill in the next missing one
  useHint(() => {
    if (state !== 'play') return false
    let k = 0
    while (k < fill.length && fill[k] === words[line.gaps[k]]) k++
    if (k >= line.gaps.length) return false
    setFill(line.gaps.slice(0, k + 1).map((g) => words[g]))
    return true
  })

  const pick = (w: string) => { if (state === 'play' && fill.length < line.gaps.length) setFill([...fill, w]) }
  const unpick = (i: number) => { if (state === 'play') setFill(fill.filter((_, j) => j !== i)) }

  function check() {
    if (fill.length !== line.gaps.length || state !== 'play') return
    const ok = line.gaps.every((g, i) => words[g] === fill[i])
    if (srv?.[round]) onAnswer?.(srv[round].qid, fill, ok)
    setState(ok ? 'ok' : 'bad')
    if (ok) {
      right.current++; combo.current.now++; combo.current.max = Math.max(combo.current.max, combo.current.now)
      setTimeout(() => {
        if (round + 1 >= lines.length) onFinish({ correct: right.current, total: lines.length, maxCombo: combo.current.max })
        else setRound(round + 1)
      }, OK_MS)
    } else {
      combo.current.now = 0
      setTimeout(() => { setFill([]); setState('play'); speak(line.text, 0.7, setTalking) }, BAD_MS)
    }
  }

  let gapNo = -1
  return (
    <div className={`ws ws-${state}${talking ? ' ws-talking' : ''}`}>
      <img className="ws-plate" src={bgPlate} alt="" draggable={false} />
      <GameTitle title="Whisper Scroll" count={`Scroll ${round + 1} / ${lines.length}`} />

      <div className="ws-scroll" style={{ backgroundImage: `url(${scrollImg})` }}>
        <p className="ws-line">
          {words.map((w, i) => {
            if (!line.gaps.includes(i)) return <span key={i} className="ws-w">{w} </span>
            gapNo++
            const f = fill[gapNo]
            const k = gapNo
            return f
              ? <button key={i} className="ws-gap filled" onClick={() => unpick(k)}>{f}</button>
              : <span key={i} className="ws-gap" />
          })}
        </p>
      </div>

      <div className="ws-listen">
        <button className="ws-playbtn" aria-label="Play" onClick={() => speak(line.text, 0.95, setTalking)}>
          <span className="ws-wave l" /><span className="ws-wave r" />
          <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="#fff" /></svg>
        </button>
        <div className="ws-small">
          <button className="cb cb-white" onClick={() => speak(line.text, 0.95, setTalking)}>Replay</button>
          <button className="cb cb-white" onClick={() => speak(line.text, 0.6, setTalking)}>🐢 Slow</button>
        </div>
      </div>

      <div className="ws-ui">
        <div className="ws-opts lp">
          {options.map((o, i) => (
            <button key={o + i} className={`ws-opt${fill.includes(o) ? ' used' : ''}`} disabled={fill.includes(o) || state !== 'play'} onClick={() => pick(o)}>{o}</button>
          ))}
        </div>
        <button className="cb cb-green ws-check" onClick={check} disabled={fill.length !== line.gaps.length || state !== 'play'}>Check</button>
      </div>
    </div>
  )
}
